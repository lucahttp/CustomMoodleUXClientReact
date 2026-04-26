use sqlx::postgres::PgPoolOptions;
use std::env;
use std::time::Duration;
use tokio::time::sleep;
use reqwest::Client;
use std::path::Path;

#[derive(Debug)]
struct Recurso {
    id: String,
    moodle_url: Option<String>,
}

async fn process_downloads(pool: &sqlx::PgPool, client: &Client, rustfs_url: &str) -> Result<(), anyhow::Error> {
    loop {
        // Find a pending resource to download
        let mut tx = pool.begin().await?;

        let recurso: Option<Recurso> = sqlx::query_as!(
            Recurso,
            "SELECT id, moodle_url FROM recursos WHERE status = 'no_descargado' FOR UPDATE SKIP LOCKED LIMIT 1"
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(r) = recurso {
            println!("Found resource to download: {}", r.id);
            
            // Mark as downloading
            sqlx::query!("UPDATE recursos SET status = 'downloading' WHERE id = $1", r.id)
                .execute(&mut *tx)
                .await?;
            
            tx.commit().await?;

            if let Some(url) = r.moodle_url {
                println!("Downloading from: {}", url);
                match download_to_rustfs(client, &url, &r.id, rustfs_url).await {
                    Ok(path) => {
                        println!("Download successful, saved to {}", path);
                        // Mark as pending transcription
                        sqlx::query!("UPDATE recursos SET status = 'pending_transcription', rustfs_path = $1 WHERE id = $2", path, r.id)
                            .execute(pool)
                            .await?;
                    }
                    Err(e) => {
                        eprintln!("Error downloading: {}", e);
                        // Revert status to no_descargado so it can be retried later
                        sqlx::query!("UPDATE recursos SET status = 'no_descargado' WHERE id = $1", r.id)
                            .execute(pool)
                            .await?;
                    }
                }
            } else {
                eprintln!("Resource {} has no URL", r.id);
                sqlx::query!("UPDATE recursos SET status = 'completado' WHERE id = $1", r.id)
                    .execute(pool)
                    .await?;
            }
        } else {
            tx.rollback().await?;
            // No jobs, sleep
            sleep(Duration::from_secs(5)).await;
        }
    }
}

async fn download_to_rustfs(client: &Client, url: &str, id: &str, rustfs_url: &str) -> Result<String, anyhow::Error> {
    // 1. Download the stream from Moodle
    let resp = client.get(url).send().await?.error_for_status()?;
    
    // 2. Upload the stream to RustFS (which expects POST /upload with X-File-Name)
    let upload_url = format!("{}/upload", rustfs_url);
    let filename = format!("{}.mp4", id);
    
    let upload_resp = client.post(&upload_url)
        .header("X-File-Name", filename)
        .body(reqwest::Body::wrap_stream(resp.bytes_stream()))
        .send()
        .await?;
        
    upload_resp.error_for_status_ref()?;
    
    // Attempt to parse response for path, or just assume standard path
    // Let's just return standard path as in the frontend
    Ok(format!("/data/{}.mp4", id))
}

async fn process_transcriptions(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    loop {
        // Find a pending transcription
        let mut tx = pool.begin().await?;

        let recurso: Option<Recurso> = sqlx::query_as!(
            Recurso,
            "SELECT id, moodle_url FROM recursos WHERE status = 'pending_transcription' FOR UPDATE SKIP LOCKED LIMIT 1"
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(r) = recurso {
            println!("Found resource to transcribe: {}", r.id);
            
            // Mark as transcribing
            sqlx::query!("UPDATE recursos SET status = 'transcribing' WHERE id = $1", r.id)
                .execute(&mut *tx)
                .await?;
            
            tx.commit().await?;

            // HERE CALL transcribe-rs logic
            // Since it's a CLI tool, we can spawn a process: 
            // Command::new("transcribe").arg("...").spawn()
            // For now we'll simulate the transcription:
            println!("Simulating transcription for {}...", r.id);
            sleep(Duration::from_secs(5)).await;
            
            println!("Transcription finished for {}", r.id);

            // Insert a fake transcription chunk
            sqlx::query!(
                "INSERT INTO transcripciones_video (video_id, start_time, text_content) VALUES ($1, $2, $3)",
                r.id, "00:00:00.000", "Esta es una transcripción de prueba generada automáticamente por el worker en Rust."
            ).execute(pool).await?;

            // Mark as completed
            sqlx::query!("UPDATE recursos SET status = 'completado' WHERE id = $1", r.id)
                .execute(pool)
                .await?;
        } else {
            tx.rollback().await?;
            // No jobs, sleep
            sleep(Duration::from_secs(5)).await;
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    println!("Starting Rust Worker...");
    
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://postgres:password@postgres:5432/moodledb".to_string());
    let rustfs_url = env::var("RUSTFS_URL").unwrap_or_else(|_| "http://rustfs:9000".to_string());
    
    println!("Connecting to db at {}", database_url);
    
    // Wait for DB to be available
    let pool = loop {
        match PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await 
        {
            Ok(p) => break p,
            Err(e) => {
                println!("DB not ready, retrying in 2s... ({})", e);
                sleep(Duration::from_secs(2)).await;
            }
        }
    };
    
    println!("Connected to PostgreSQL!");

    let client = Client::new();

    // Spawn download worker
    let pool_clone = pool.clone();
    let client_clone = client.clone();
    let rustfs_url_clone = rustfs_url.clone();
    
    let download_handle = tokio::spawn(async move {
        if let Err(e) = process_downloads(&pool_clone, &client_clone, &rustfs_url_clone).await {
            eprintln!("Download worker error: {}", e);
        }
    });

    // Spawn transcription worker
    let pool_clone2 = pool.clone();
    let transcribe_handle = tokio::spawn(async move {
        if let Err(e) = process_transcriptions(&pool_clone2).await {
            eprintln!("Transcription worker error: {}", e);
        }
    });

    // Wait forever
    let _ = tokio::join!(download_handle, transcribe_handle);

    Ok(())
}
