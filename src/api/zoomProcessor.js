import { enqueueMediaSync } from './handoffProxy';
import { getPgliteInstance } from '../db/pgliteSync';

/**
 * processZoomRecording queues a zoom or video resource into the Rust Desktop daemon
 * allowing the Moodle client to stay fast and snappy while processing happens offline.
 */
export const processZoomRecording = async (sessionUrl, courseId, zoomModId, courseName, resourceName, onProgress) => {
  try {
    const db = await getPgliteInstance();
    
    // Verificamos si el video ya está indexado
    const check = await db.query('SELECT 1 FROM recursos WHERE id = $1 LIMIT 1', [String(zoomModId)]);
    if (check.rows.length > 0) {
      if (onProgress) onProgress("Grabación ya en base de datos. Usando versión local.");
      return { success: true, message: "Already transcribed", videoUrl: `local://${zoomModId}`, vttUrl: `local://${zoomModId}` };
    }

    if (onProgress) onProgress("Enviando a la Bóveda Sync (Desktop)...");
    
    // Dispatch to Rust via Handoff
    enqueueMediaSync({
        id: String(zoomModId),
        course_id: String(courseId || '0'),
        course_name: courseName || 'Unknown',
        resource_type: 'video',
        title: resourceName || `zoom-${zoomModId}`,
        url: `${sessionUrl}/mod/zoomutnba/view.php?id=${zoomModId}`
    });

    return { success: true, queued: true, videoUrl: null, vttUrl: null };
  } catch (err) {
    if (onProgress) onProgress(`Error al encolar: ${err.message}`);
    return { success: false, error: err.message };
  }
};

export const findVideoInMinio = async (courseName, resourceName, zoomModId) => {
   // Deprecated: Minio logic removed in favor of Rust Daemon Local storage query
   // Here we can eventually ask Rust over REST or WebSocket:
   return null;
};
