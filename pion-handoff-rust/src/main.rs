mod db;
mod sync;

use axum::{extract::{Multipart, State}, routing::{get, post}, Json, Router};
use iced::Center;
use iced::widget::{button, column, container, text, text_input};
use iced::Element;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use socketioxide::{
    extract::SocketRef,
    SocketIo,
};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tower_http::cors::CorsLayer;
use tokio_rusqlite::Connection;
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(get_media_url),
    components(schemas(MoodleResponse))
)]
struct ApiDoc;

#[derive(Serialize, Deserialize, ToSchema)]
struct MoodleResponse {
    success: bool,
    data: Option<Value>,
    error: Option<String>,
}

use tower_http::services::ServeDir;

#[utoipa::path(
    get,
    path = "/api/media/{id}",
    responses(
        (status = 200, description = "Ruta local del medio", body = MoodleResponse)
    )
)]
async fn get_media_url(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Json<MoodleResponse> {
    let id_clone = id.clone();
    let result = state.db.call(move |conn| -> Result<Option<String>, rusqlite::Error> {
        let mut stmt = conn.prepare("SELECT local_path FROM resources WHERE id = ?").unwrap();
        let mut rows = stmt.query([&id_clone])?;
        if let Some(row) = rows.next()? {
            let path: String = row.get(0)?;
            if path.is_empty() { Ok(None) } else { Ok(Some(path)) }
        } else {
            Ok(None)
        }
    }).await;

    match result {
        Ok(Some(local_path)) => {
            // Verify the file actually exists on disk (guards against stale SQLite entries)
            if !std::path::Path::new(&local_path).exists() {
                println!("[Daemon] ⚠️ Stale entry: local_path set but file missing for ID {}. Clearing.", id);
                let _ = state.db.call(move |conn| -> Result<(), rusqlite::Error> {
                    conn.execute("UPDATE resources SET local_path = '' WHERE id = ?", [&id])?;
                    Ok(())
                }).await;
                return Json(MoodleResponse {
                    success: false,
                    data: None,
                    error: Some("Archivo no encontrado en disco (entrada obsoleta limpiada)".into()),
                });
            }

            // Convert absolute local path to a URL served by the /boveda endpoint
            let url_path = local_path
                .replace('\\', "/")
                .replacen("Boveda/", "", 1)
                .replacen("Boveda\\\\", "", 1);
            Json(MoodleResponse {
                success: true,
                data: Some(serde_json::json!({
                    "local_path": local_path,
                    "url": format!("http://localhost:3000/boveda/{}", url_path)
                })),
                error: None,
            })
        }
        Ok(None) => Json(MoodleResponse { success: false, data: None, error: Some("Recurso no encontrado en la Bóveda".into()) }),
        Err(e) => Json(MoodleResponse { success: false, data: None, error: Some(e.to_string()) }),
    }
}

#[derive(Clone)]
struct AppState {
    db: Arc<Connection>,
    sync_engine: Arc<sync::SyncEngine>,
}

async fn ingest_video(
    State(state): State<AppState>,
    io: axum::extract::Extension<SocketIo>,
    mut multipart: Multipart,
) -> Json<MoodleResponse> {
    let mut id = String::new();
    let mut course_id = String::new();
    let mut course_name = String::new();
    let mut resource_type = String::from("video");
    let mut title = String::new();
    let mut file_bytes: Vec<u8> = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("id") => id = field.text().await.unwrap_or_default(),
            Some("course_id") => course_id = field.text().await.unwrap_or_default(),
            Some("course_name") => course_name = field.text().await.unwrap_or_default(),
            Some("resource_type") => resource_type = field.text().await.unwrap_or_default(),
            Some("title") => title = field.text().await.unwrap_or_default(),
            Some("file") => file_bytes = field.bytes().await.unwrap_or_default().to_vec(),
            _ => {}
        }
    }

    if id.is_empty() || file_bytes.is_empty() {
        return Json(MoodleResponse { success: false, data: None, error: Some("Faltan campos: id o file".into()) });
    }

    // Get the first connected socket for progress notifications (best-effort)
    let socket: Option<SocketRef> = io.of("/")
        .ok()
        .and_then(|ns| ns.sockets().ok())
        .and_then(|sockets| sockets.into_iter().next());

    let meta = sync::IngestMetadata { id, course_id, course_name, resource_type, title };

    match state.sync_engine.ingest_bytes(meta, file_bytes, socket).await {
        Ok(local_path) => Json(MoodleResponse {
            success: true,
            data: Some(serde_json::json!({ "local_path": local_path })),
            error: None,
        }),
        Err(e) => Json(MoodleResponse { success: false, data: None, error: Some(e.to_string()) }),
    }
}

async fn run_background_server() {
    println!("[Daemon] Iniciando servidor Axum + Socket.io en segundo plano...");

    // Inicializar SQLite
    let db_path = PathBuf::from("moodle_boveda.db");
    let db_conn = db::init_db(&db_path).await.expect("Failed to init SQLite FTS5 database");
    println!("[Daemon] SQLite Módulo cargado en moodle_boveda.db");

    let base_folder = PathBuf::from("Boveda");
    let db_conn = Arc::new(db_conn);
    let sync_engine = Arc::new(sync::SyncEngine::new((*db_conn).clone(), base_folder));
    let app_state = AppState { db: db_conn.clone(), sync_engine: sync_engine.clone() };

    let (layer, io) = SocketIo::new_layer();

    io.ns("/", |socket: SocketRef| {
        println!("[Daemon Socket] Moodle Extension connected: {}", socket.id);

        socket.on_disconnect(|socket: SocketRef| {
            println!("[Daemon Socket] Extension desconectada: {}", socket.id);
        });
    });

    let app_router = Router::new()
        .nest_service("/boveda", ServeDir::new("Boveda"))
        .route("/api/ping", get(|| async { Json(MoodleResponse { success: true, data: None, error: None }) }))
        .route("/api/media/:id", get(get_media_url))
        .route("/api/ingest", post(ingest_video))
        .merge(SwaggerUi::new("/api-docs").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(app_state)
        .layer(axum::extract::Extension(io))
        .layer(layer)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("[Daemon] Escuchando localmente en http://localhost:3000");

    axum::serve(listener, app_router).await.unwrap();
}

// ---- ICE APP STATE ----
#[derive(Default)]
struct App {
    search_query: String,
}

#[derive(Debug, Clone)]
enum Message {
    SearchInputChanged(String),
    SearchSubmitted,
}

impl App {
    fn update(&mut self, message: Message) {
        match message {
            Message::SearchInputChanged(value) => {
                self.search_query = value;
            }
            Message::SearchSubmitted => {
                println!("Searching for: {}", self.search_query);
                // TODO: wire to db::search_resources via async command
            }
        }
    }

    fn view(&self) -> Element<'_, Message> {
        let input = text_input("Buscar videos o recursos descargados...", &self.search_query)
            .on_input(Message::SearchInputChanged)
            .on_submit(Message::SearchSubmitted)
            .padding(15)
            .size(20);

        let search_btn = button(text("Buscar"))
            .on_press(Message::SearchSubmitted)
            .padding(10);

        let content = column![
            text("Moodle Handoff Local Bóveda").size(40),
            input,
            search_btn,
            text("Ingresá un término para buscar dentro de SQLite FTS...").size(14)
        ]
        .spacing(20)
        .padding(40)
        .max_width(800.0);

        container(content)
            .width(iced::Length::Fill)
            .height(iced::Length::Fill)
            .align_x(Center)
            .align_y(Center)
            .into()
    }
}

pub fn main() -> iced::Result {
    // 1. Spawning al Background Server
    thread::spawn(|| {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to build tokio runtime");

        rt.block_on(async {
            run_background_server().await;
        });
    });

    // 2. Iniciando la Vista UI
    iced::run(App::update, App::view)
}
