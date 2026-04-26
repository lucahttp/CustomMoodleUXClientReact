import { getPgliteInstance } from '../db/pgliteSync';
/**
 * Extract the actual MP4 URL from a Moodle Zoom module page.
 * The extension's fetch() has the session cookies — it can follow the auth redirects.
 */
async function extractVideoUrlFromMoodlePage(sessionUrl, zoomModId) {
  const pageUrl = `${sessionUrl}/mod/zoomutnba/view.php?id=${zoomModId}`;
  const resp = await fetch(pageUrl, { credentials: 'include' });
  if (!resp.ok) throw new Error(`Page fetch failed: HTTP ${resp.status}`);
  const html = await resp.text();

  // Try various patterns: explicit src, data-src, file: property in JS
  const patterns = [
    /["']?(https?:\/\/[^"'\s]+\.mp4(?:\?[^"'\s]*)?)["']?/i,
    /file:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i,
    /source\s+src=["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * processZoomRecording — Full lifecycle:
 *   1. Check PGlite: if already transcribed/saved → return local:// URL immediately.
 *   2. Check Rust daemon SQLite: if file exists on disk → return daemon URL.
 *   3. Otherwise: extension fetches the MP4 blob (has cookies!), POSTs to /api/ingest.
 *      Daemon saves to Boveda/, queues transcription with transcribe-rs.
 */
export const processZoomRecording = async (sessionUrl, courseId, zoomModId, courseName, resourceName, onProgress) => {
  const progress = (msg) => { console.log(`[Zoom] ${msg}`); onProgress?.(msg); };

  try {
    // ── Step 1: Check PGlite (transcription already done locally) ──────────
    const db = await getPgliteInstance();
    const pgliteCheck = await db.query(
      'SELECT rustfs_path, moodle_url, status FROM recursos WHERE id = $1 LIMIT 1',
      [String(zoomModId)]
    );
    if (pgliteCheck.rows.length > 0) {
      const row = pgliteCheck.rows[0];
      // Si el video ya está descargado en RustFS
      if (row.status === 'completado' || row.status === 'pending_transcription' || row.status === 'transcribing') {
        progress("✅ Grabación ya descargada en el servidor. Sirviendo localmente.");
        const localVideoUrl = `http://localhost:9000/download?path=${encodeURIComponent(row.rustfs_path)}`;
        return { success: true, videoUrl: localVideoUrl, vttUrl: null };
      } else if (row.moodle_url) {
        // Aún no descargado, pero ya registramos la URL, sirviendo stream
        progress("▶️ Video encolado. Sirviendo streaming directo desde Moodle mientras se descarga...");
        return { success: true, videoUrl: row.moodle_url, vttUrl: null };
      }
    }

    // ── Step 2: Extract Moodle Video URL ─────────
    progress("🔍 Extrayendo URL del video desde Moodle...");
    const videoUrl = await extractVideoUrlFromMoodlePage(sessionUrl, zoomModId);

    if (!videoUrl) {
      progress("⚠️ No se encontró URL de video en la página. Puede que aún no esté disponible.");
      return { success: false, error: "No video URL found in Moodle page" };
    }

    progress(`✅ URL extraída. Registrando en PGlite para que el servidor descargue...`);
    
    // Generar fecha en el formato solicitado
    const fechaActual = new Intl.DateTimeFormat('es-AR', { 
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    }).format(new Date());

    const placeholderRustFs = `_placeholder_link_s2_rustfs`;

    // ── Step 3: Insertar en PGlite (ElectricSQL sincronizará al Backend) ─────────
    await db.query(
      `INSERT INTO recursos 
       (id, curso_id, titulo, tipo, fecha, moodle_url, rustfs_path, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (id) DO UPDATE SET status = 'no_descargado'`,
      [
        String(zoomModId), 
        String(courseId), 
        resourceName || 'Grabación', 
        'video', 
        fechaActual, 
        videoUrl, 
        placeholderRustFs, 
        'no_descargado'
      ]
    );

    progress(`🚀 Tarea encolada exitosamente. El servidor descargará el video y generará las transcripciones.`);
    
    // Retornamos la URL original de Cloudfront para que el player pueda reproducir el video instantáneamente
    return { success: true, videoUrl: videoUrl, vttUrl: null };
  } catch (err) {
    progress(`❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
};
