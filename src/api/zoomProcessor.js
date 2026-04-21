import { getPgliteInstance } from '../db/pgliteSync';

const DAEMON_URL = 'http://localhost:3000';

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

    // ── Step 2: Check Rust daemon SQLite (file saved but not yet in PGlite) ──
    try {
      const mediaResp = await fetch(`${DAEMON_URL}/api/media/${zoomModId}`);
      const mediaJson = await mediaResp.json();
      if (mediaJson.success && mediaJson.data?.url) {
        progress("✅ Video en Bóveda local (sin transcripción aún). Reproduciendo...");
        return { success: true, videoUrl: `local://${zoomModId}`, vttUrl: null };
      }
    } catch (_) {
      // Daemon not running — fall through to download
    }

    // ── Step 3: Download via Extension (has Moodle session cookies!) ─────────
    progress("🔍 Extrayendo URL del video desde Moodle...");
    const videoUrl = await extractVideoUrlFromMoodlePage(sessionUrl, zoomModId);

    if (!videoUrl) {
      progress("⚠️ No se encontró URL de video en la página. Puede que aún no esté disponible.");
      return { success: false, error: "No video URL found in Moodle page" };
    }

    progress(`⬇️ Descargando MP4 (puede tardar)...`);
    const videoResp = await fetch(videoUrl, { credentials: 'include' });
    if (!videoResp.ok) throw new Error(`Video download failed: HTTP ${videoResp.status}`);
    const videoBlob = await videoResp.blob();
    progress(`📦 Descargado ${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB. Enviando al daemon...`);

    // ── Step 4: POST to Rust daemon ───────────────────────────────────────────
    const formData = new FormData();
    formData.append('id', String(zoomModId));
    formData.append('course_id', String(courseId || '0'));
    formData.append('course_name', courseName || 'Unknown');
    formData.append('resource_type', 'video');
    formData.append('title', resourceName || `zoom-${zoomModId}`);
    formData.append('file', videoBlob, `${resourceName || zoomModId}.mp4`);

    const uploadResp = await fetch(`${DAEMON_URL}/api/ingest`, {
      method: 'POST',
      body: formData,
    });
    const result = await uploadResp.json();

    if (result.success) {
      progress("🎙️ Guardado en Bóveda. Transcripción con Whisper en proceso (en background)...");
      return { success: true, queued: true, videoUrl: `local://${zoomModId}`, vttUrl: null };
    } else {
      throw new Error(result.error || 'Ingest failed');
    }
  } catch (err) {
    progress(`❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
};
