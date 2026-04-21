use tokio_rusqlite::Connection;
use std::path::Path;

pub async fn init_db<P: AsRef<Path>>(path: P) -> Result<Connection, tokio_rusqlite::Error> {
    let conn = Connection::open(path).await?;
    
    conn.call(|conn| -> Result<(), rusqlite::Error> {
        // Tabla de recursos principal
        conn.execute(
            "CREATE TABLE IF NOT EXISTS resources (
                id TEXT PRIMARY KEY,
                course_id TEXT,
                course_name TEXT,
                type TEXT,
                title TEXT,
                url TEXT,
                local_path TEXT,
                transcript_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // FTS5 Virtual Table para búsquedas Full-Text con BM25
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS resources_fts USING fts5(
                resource_id,
                title,
                content,
                tokenize='unicode61'
            )",
            [],
        )?;

        Ok(())
    }).await?;
    
    Ok(conn)
}

pub async fn search_resources(conn: &Connection, query: String) -> Result<Vec<String>, tokio_rusqlite::Error> {
    conn.call(move |conn| -> Result<Vec<String>, rusqlite::Error> {
        let mut stmt = conn.prepare(
            "SELECT resource_id, title FROM resources_fts WHERE resources_fts MATCH ? ORDER BY rank"
        )?;

        let resource_iter = stmt.query_map([query], |row| {
            let id: String = row.get(0)?;
            let title: String = row.get(1)?;
            Ok(format!("{} - {}", id, title))
        })?;

        let mut results = Vec::new();
        for r in resource_iter {
            results.push(r?);
        }
        
        Ok(results)
    }).await
}
