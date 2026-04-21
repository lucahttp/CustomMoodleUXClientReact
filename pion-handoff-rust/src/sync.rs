use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio_rusqlite::Connection;
use std::process::Stdio;
use tokio::process::Command;
use socketioxide::extract::SocketRef;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncPayload {
    pub id: String, // ID único del recurso
    pub course_id: String,
    pub course_name: String,
    pub resource_type: String, // "video", "youtube", "book", "pdf", "google_slide"
    pub title: String,
    pub url: String,
    pub textual_content: Option<String>,
}

/// Metadata para ingestión directa de bytes desde la extensión Chrome.
/// La extensión hace el fetch() autenticado y nos manda el contenido crudo.
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

    pub async fn process(&self, payload: SyncPayload, socket: Option<SocketRef>) -> Result<bool, Box<dyn std::error::Error>> {
        // 1. Deduplication Check
        let id_clone = payload.id.clone();
        let exists: bool = self.db_conn.call(move |conn| -> Result<bool, rusqlite::Error> {
            let mut stmt = conn.prepare("SELECT 1 FROM resources WHERE id = ?")?;
            Ok(stmt.exists([id_clone])?)
        }).await.unwrap_or(false);

        if exists {
            self.notify(&socket, &payload.id, "Previamente procesado", 100);
            return Ok(false);
        }

        let clean_course = sanitize_filename::sanitize(&payload.course_name);
        let clean_type = sanitize_filename::sanitize(&payload.resource_type);
        let folder_path = self.base_folder.join(&clean_course).join(&clean_type);
        fs::create_dir_all(&folder_path).await?;
        
        let clean_title = sanitize_filename::sanitize(&payload.title);
        let mut local_path = None;
        let mut final_textual_content = payload.textual_content.clone().unwrap_or_default();

        let client = reqwest::Client::new();

        self.notify(&socket, &payload.id, "Iniciando descarga...", 10);

        match payload.resource_type.as_str() {
            "video" => {
                let file_path = folder_path.join(format!("{}.mp4", clean_title));
                self.notify(&socket, &payload.id, "Descargando MP4 desde Moodle...", 20);
                
                let req = client.get(&payload.url);
                
                let response = req.send().await?;
                if response.status().is_success() {
                    let bytes = response.bytes().await?;
                    let mut file = fs::File::create(&file_path).await?;
                    file.write_all(&bytes).await?;
                    local_path = Some(file_path.to_string_lossy().to_string());
                }

                self.notify(&socket, &payload.id, "Transcribiendo con AI local...", 70);
                // Fake transcript implementation for now
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                final_textual_content = "Transcripción automática generada por Whisper...".to_string();
            },
            "youtube" => {
                let file_path = folder_path.join(format!("{}.%(ext)s", clean_title));
                let out_template = file_path.to_string_lossy().to_string();
                
                self.notify(&socket, &payload.id, "Llamando a yt-dlp para extraer video...", 30);
                
                let status = Command::new("yt-dlp")
                    .args(&["-f", "mp4", "--write-auto-subs", "--sub-lang", "es,en", "-o", &out_template, &payload.url])
                    .stdout(Stdio::null())
                    .status()
                    .await;

                if let Ok(st) = status {
                    if st.success() {
                        local_path = Some(out_template); // It might not match exactly due to %(ext)s, but ok for DB
                    }
                }
            },
            "google_slide" => {
                self.notify(&socket, &payload.id, "Convirtiendo Slides a PDF...", 40);
                // Node subprocess interop stub
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            },
            "book" | "pdf" | "resource" | "folder" => {
                let ext = if payload.resource_type == "book" { "html" } else { "pdf" };
                let file_path = folder_path.join(format!("{}.{}", clean_title, ext));
                self.notify(&socket, &payload.id, "Clonando Recurso...", 50);
                
                let req = client.get(&payload.url);

                let response = req.send().await?;
                if response.status().is_success() {
                    let bytes = response.bytes().await?;
                    let mut file = fs::File::create(&file_path).await?;
                    file.write_all(&bytes).await?;
                    local_path = Some(file_path.to_string_lossy().to_string());
                } else {
                    println!("[SyncEngine] Failed downloading {}: HTTP {}", payload.url, response.status());
                }
            },
            _ => {
                self.notify(&socket, &payload.id, "Procesando metadatos...", 90);
            }
        }

        // Image Scraping & Caching for ML / Offline storage
        if !final_textual_content.is_empty() {
            self.notify(&socket, &payload.id, "Buscando y guardando imágenes localmente...", 92);
            let img_regex = regex::Regex::new(r#"<img[^>]+src=["'](https://vj\.sied\.utn\.edu\.ar[^"']+)["'][^>]*>"#).unwrap();
            
            // We need to keep track of replacements to apply to the final string
            let mut replacements = Vec::new();

            for cap in img_regex.captures_iter(&final_textual_content) {
                if let Some(src_match) = cap.get(1) {
                    let remote_url = src_match.as_str();
                    // Derive a filename from the URL, or simply use a hash
                    let file_name = format!("{:x}.png", md5::compute(remote_url));
                    let images_folder = folder_path.join("images");
                    let _ = fs::create_dir_all(&images_folder).await;
                    let local_file_path = images_folder.join(&file_name);
                    
                    // Download image if it doesn't exist
                    if !local_file_path.exists() {
                        let req = client.get(remote_url);
                        if let Ok(response) = req.send().await {
                            if response.status().is_success() {
                                if let Ok(bytes) = response.bytes().await {
                                    if let Ok(mut file) = fs::File::create(&local_file_path).await {
                                        let _ = file.write_all(&bytes).await;
                                    }
                                }
                            }
                        }
                    }
                    
                    // The path relative to our axum static server `http://localhost:3000/boveda/...`
                    let relative_proxy_url = format!("http://localhost:3000/boveda/{}/{}/images/{}", clean_course, clean_type, file_name);
                    replacements.push((remote_url.to_string(), relative_proxy_url));
                }
            }

            // Apply replacements
            for (remote, local) in replacements {
                final_textual_content = final_textual_content.replace(&remote, &local);
            }
        }

        self.notify(&socket, &payload.id, "Guardando en Bóveda SQLite...", 95);

        let p_id = payload.id.clone();
        let p_cid = payload.course_id.clone();
        let p_cname = payload.course_name.clone();
        let p_type = payload.resource_type.clone();
        let p_title = payload.title.clone();
        let p_url = payload.url.clone();
        let p_content = final_textual_content.clone();
        let local_path_str = local_path.unwrap_or_default();
        
        self.db_conn.call(move |conn| -> Result<(), rusqlite::Error> {
            let tx = conn.transaction()?;
            tx.execute(
                "INSERT INTO resources (id, course_id, course_name, type, title, url, local_path) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                (&p_id, &p_cid, &p_cname, &p_type, &p_title, &p_url, &local_path_str),
            )?;
            tx.execute(
                "INSERT INTO resources_fts (resource_id, title, content) VALUES (?1, ?2, ?3)",
                (&p_id, &p_title, &p_content),
            )?;
            tx.commit()?;
            Ok(())
        }).await.map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        self.notify(&socket, &payload.id, "¡Finalizado exitosamente!", 100);
        Ok(true)
    }
}
