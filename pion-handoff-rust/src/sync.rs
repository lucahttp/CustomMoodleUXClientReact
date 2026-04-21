use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio_rusqlite::Connection;
use std::process::Stdio;
use tokio::process::Command;
use socketioxide::extract::SocketRef;

/// Metadata for direct byte ingestion from the Chrome Extension.
/// The extension performs the authenticated fetch() and sends us raw content.
#[derive(Debug, Clone)]
pub struct IngestMetadata {
    pub id: String,
    pub course_id: String,
    pub course_name: String,
    pub resource_type: String,
    pub title: String,
}

pub struct SyncEngine {
    db_conn: Connection,
    base_folder: PathBuf,
}

impl SyncEngine {
    pub fn new(db_conn: Connection, base_folder: PathBuf) -> Self {
        Self { db_conn, base_folder }
    }

    /// Ingests raw bytes sent by the Chrome Extension (which has Moodle auth).
    /// Saves file to Boveda/, inserts in SQLite, queues transcription via transcribe-rs.
    pub async fn ingest_bytes(
        &self,
        meta: IngestMetadata,
        bytes: Vec<u8>,
        socket: Option<SocketRef>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        self.notify(&socket, &meta.id, "Guardando en Bóveda...", 10);

        let clean_course = sanitize_filename::sanitize(&meta.course_name);
        let clean_type = sanitize_filename::sanitize(&meta.resource_type);
        let folder_path = self.base_folder.join(&clean_course).join(&clean_type);
        fs::create_dir_all(&folder_path).await?;

        let ext = match meta.resource_type.as_str() {
            "video" => "mp4",
            "pdf" => "pdf",
            _ => "bin",
        };
        let clean_title = sanitize_filename::sanitize(&meta.title);
        let file_path = folder_path.join(format!("{}.{}", clean_title, ext));

        let mut file = fs::File::create(&file_path).await?;
        file.write_all(&bytes).await?;
        let local_path = file_path.to_string_lossy().to_string();

        self.notify(&socket, &meta.id, "Guardado. Insertando en índice...", 50);

        // Insert into SQLite
        let p_id = meta.id.clone();
        let p_cid = meta.course_id.clone();
        let p_cname = meta.course_name.clone();
        let p_type = meta.resource_type.clone();
        let p_title = meta.title.clone();
        let p_path = local_path.clone();

        self.db_conn.call(move |conn| -> Result<(), rusqlite::Error> {
            conn.execute(
                "INSERT OR REPLACE INTO resources (id, course_id, course_name, type, title, url, local_path)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                (&p_id, &p_cid, &p_cname, &p_type, &p_title, "", &p_path),
            )?;
            conn.execute(
                "INSERT OR REPLACE INTO resources_fts (resource_id, title, content) VALUES (?1, ?2, ?3)",
                (&p_id, &p_title, ""),
            )?;
            Ok(())
        }).await?;

        // Queue transcription if video
        if meta.resource_type == "video" {
            self.notify(&socket, &meta.id, "Encolando transcripción con Whisper...", 70);
            let file_path_clone = file_path.clone();
            let id_clone = meta.id.clone();
            let socket_clone = socket.clone();
            let db_clone = self.db_conn.clone();

            tokio::spawn(async move {
                println!("[Transcribe] 🎙️ Iniciando transcribe-rs para: {}", id_clone);
                let status = Command::new("transcribe-rs")
                    .args(&["--file", &file_path_clone.to_string_lossy(), "--format", "vtt"])
                    .stdout(Stdio::null())
                    .status()
                    .await;

                match status {
                    Ok(s) if s.success() => {
                        // transcribe-rs outputs vtt next to the mp4
                        let vtt_path = file_path_clone.with_extension("vtt");
                        let transcript_path_str = vtt_path.to_string_lossy().to_string();

                        let id_for_db = id_clone.clone();
                        let _ = db_clone.call(move |conn| -> Result<(), rusqlite::Error> {
                            conn.execute(
                                "UPDATE resources SET transcript_path = ?1 WHERE id = ?2",
                                (&transcript_path_str, &id_for_db),
                            )?;
                            Ok(())
                        }).await;

                        if let Some(s) = socket_clone {
                            let _ = s.emit("JOB_PROGRESS", serde_json::json!({
                                "id": id_clone,
                                "status": "¡Transcripción completa!",
                                "progress": 100
                            }));
                        }
                    }
                    _ => {
                        println!("[Transcribe] ⚠️ transcribe-rs no disponible o falló para {}", id_clone);
                        if let Some(s) = socket_clone {
                            let _ = s.emit("JOB_PROGRESS", serde_json::json!({
                                "id": id_clone,
                                "status": "Guardado (sin transcripción)",
                                "progress": 100
                            }));
                        }
                    }
                }
            });
        }

        self.notify(&socket, &meta.id, "¡Recibido en Bóveda!", 75);
        Ok(local_path)
    }

    fn notify(&self, socket: &Option<SocketRef>, id: &str, status: &str, progress: u8) {
        if let Some(s) = socket {
            let _ = s.emit("JOB_PROGRESS", serde_json::json!({
                "id": id,
                "status": status,
                "progress": progress
            }));
        }
        println!("[Sync Progress] {} - {}", id, status);
    }
}
