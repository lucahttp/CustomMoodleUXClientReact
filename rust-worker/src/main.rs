use pgmq::{Message, pg_ext::PGMQueueExt};
use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tokio::time::sleep;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use anyhow::Context;

#[derive(Debug, Serialize, Deserialize)]
struct DownloadTask {
    recurso_id: String,
    url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TranscribeTask {
    recurso_id: String,
    rustfs_path: String,
}

async fn process_downloads(pgmq: &PGMQueueExt, client: &Client, rustfs_url: &str, pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    loop {
        // Read a message from the queue
        let msg: Option<Message<DownloadTask>> = pgmq.read("video_downloads", 30_i32)
            .await
            .context("Failed to read from video_downloads queue")?;

        if let Some(m) = msg {
            let task = &m.message;
            println!("📥 Processing download for resource: {}", task.recurso_id);
            
            // Mark as downloading in the main DB
            sqlx::query("UPDATE recursos SET status = 'downloading' WHERE id = $1")
                .bind(&task.recurso_id)
                .execute(pool)
                .await?;

            match download_to_rustfs(client, &task.url, &task.recurso_id, rustfs_url).await {
                Ok(path) => {
                    println!("✅ Download successful: {}", path);
                    
                    // Update DB
                    sqlx::query("UPDATE recursos SET status = 'pending_transcription', rustfs_path = $1 WHERE id = $2")
                        .bind(&path)
                        .bind(&task.recurso_id)
                        .execute(pool)
                        .await?;

                    // Enqueue transcription task
                    let transcribe_task = TranscribeTask {
                        recurso_id: task.recurso_id.clone(),
                        rustfs_path: path,
                    };
                    pgmq.send("video_transcriptions", &transcribe_task).await?;
                    
                    // Archive (delete) from current queue
                    pgmq.archive("video_downloads", m.msg_id).await?;
                }
                Err(e) => {
                    eprintln!("❌ Error downloading {}: {}", task.recurso_id, e);
                    // Revert status so it can be retried or handled
                    sqlx::query("UPDATE recursos SET status = 'error_download' WHERE id = $1")
                        .bind(&task.recurso_id)
                        .execute(pool)
                        .await?;
                    
                    // We don't archive so it becomes visible again after visibility timeout
                    // Or we could move to an error queue
                }
            }
        } else {
            sleep(Duration::from_secs(5)).await;
        }
    }
}

async fn download_to_rustfs(client: &Client, url: &str, id: &str, rustfs_url: &str) -> Result<String, anyhow::Error> {
    // 1. Download from Moodle
    let resp = client.get(url).send().await?.error_for_status()?;
    
    // 2. Upload to RustFS
    let filename = format!("{}.mp4", id);
    let upload_url = format!("{}/upload", rustfs_url);
    
    let upload_resp = client.post(&upload_url)
        .header("X-File-Name", &filename)
        .body(reqwest::Body::wrap_stream(resp.bytes_stream()))
        .send()
        .await?;
        
    upload_resp.error_for_status()?;
    
    Ok(format!("/data/{}", filename))
}

async fn process_transcriptions(pgmq: &PGMQueueExt, pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    loop {
        let msg: Option<Message<TranscribeTask>> = pgmq.read("video_transcriptions", 300_i32) // Longer visibility for transcription
            .await
            .context("Failed to read from video_transcriptions queue")?;

        if let Some(m) = msg {
            let task = &m.message;
            println!("🎙️ Transcribing resource: {}", task.recurso_id);
            
            sqlx::query("UPDATE recursos SET status = 'transcribing' WHERE id = $1")
                .bind(&task.recurso_id)
                .execute(pool)
                .await?;

            // SIMULATE Transcription logic for now
            // In a real scenario, we would download from RustFS to a temp file, 
            // call transcribe-rs, and then upload the VTT back or just save to DB.
            println!("🚀 Running transcribe-rs on {}...", task.rustfs_path);
            sleep(Duration::from_secs(10)).await;

            // Insert placeholder transcription
            sqlx::query("INSERT INTO transcripciones_video (video_id, start_time, text_content) VALUES ($1, $2, $3)")
                .bind(&task.recurso_id)
                .bind("00:00:00.000")
                .bind("Transcripción automática procesada por Rust Worker.")
                .execute(pool)
                .await?;

            sqlx::query("UPDATE recursos SET status = 'completado' WHERE id = $1")
                .bind(&task.recurso_id)
                .execute(pool)
                .await?;

            pgmq.archive("video_transcriptions", m.msg_id).await?;
            println!("✅ Finished transcription for {}", task.recurso_id);
        } else {
            sleep(Duration::from_secs(5)).await;
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    println!("🚀 Starting Moodle UX Rust Worker...");
    
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let rustfs_url = env::var("RUSTFS_URL").unwrap_or_else(|_| "http://rustfs:9000".to_string());
    
    println!("🔗 Connecting to PostgreSQL at {}", database_url);
    
    let pool = loop {
        match PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await 
        {
            Ok(p) => break p,
            Err(e) => {
                println!("⏳ DB not ready, retrying... ({})", e);
                sleep(Duration::from_secs(2)).await;
            }
        }
    };
    
    println!("✅ Connected to PostgreSQL!");

    // Initialize PGMQ
    let pgmq = PGMQueueExt::new(database_url, 5).await?;
    
    // Create queues if they don't exist
    let _ = pgmq.create("video_downloads").await;
    let _ = pgmq.create("video_transcriptions").await;
    println!("📦 PGMQ Queues initialized.");

    let client = Client::new();

    // Spawn download worker
    let pgmq_d = pgmq.clone();
    let pool_d = pool.clone();
    let client_d = client.clone();
    let rustfs_d = rustfs_url.clone();
    let download_handle = tokio::spawn(async move {
        if let Err(e) = process_downloads(&pgmq_d, &client_d, &rustfs_d, &pool_d).await {
            eprintln!("🛑 Download worker crashed: {}", e);
        }
    });

    // Spawn transcription worker
    let pgmq_t = pgmq.clone();
    let pool_t = pool.clone();
    let transcribe_handle = tokio::spawn(async move {
        if let Err(e) = process_transcriptions(&pgmq_t, &pool_t).await {
            eprintln!("🛑 Transcription worker crashed: {}", e);
        }
    });

    println!("✨ Workers are running. Waiting for tasks...");
    let _ = tokio::join!(download_handle, transcribe_handle);

    Ok(())
}
