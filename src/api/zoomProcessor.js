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
      'SELECT 1 FROM recursos WHERE id = $1 LIMIT 1',
      [String(zoomModId)]
    );
    if (pgliteCheck.rows.length > 0) {
      progress("✅ Grabación ya transcripta en PGlite. Sirviendo localmente.");
      return { success: true, videoUrl: `local://${zoomModId}`, vttUrl: `local://${zoomModId}` };
    }

    // ── Step 2: Download via Extension (has Moodle session cookies!) ─────────
    progress("🔍 Extrayendo URL del video desde Moodle...");
    const videoUrl = await extractVideoUrlFromMoodlePage(sessionUrl, zoomModId);

    if (!videoUrl) {
      progress("⚠️ No se encontró URL de video en la página. Puede que aún no esté disponible.");
      return { success: false, error: "No video URL found in Moodle page" };
    }

    progress(`✅ URL de video extraída correctamente. Iniciando reproducción directa.`);
    
    // Just return the video URL so the player can stream it directly.
    return { success: true, videoUrl: videoUrl, vttUrl: null };
  } catch (err) {
    progress(`❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
};
