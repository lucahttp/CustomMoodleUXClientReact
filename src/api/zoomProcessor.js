import { AwsClient } from 'aws4fetch';
import { ingestZoomRecording } from '../db/pgliteIngest';

// Configure this with your local Minio settings
const MINIO_URL = 'http://localhost:9001/utn';
const MINIO_ACCESS_KEY = 'minioadmin';
const MINIO_SECRET_KEY = 'minioadmin';

// Vibe API endpoint
const VIBE_URL = 'http://127.0.0.1:57252/v1/audio/transcriptions';

const aws = new AwsClient({
  accessKeyId: MINIO_ACCESS_KEY,
  secretAccessKey: MINIO_SECRET_KEY,
  service: 's3',
  region: 'us-east-1', // default for Minio
});

export const getDeterministicMinioUrls = (courseName, resourceName, zoomModId) => {
  const safeCourseName = courseName
    ? courseName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '/'
    : 'uncategorized/';

  const safeResourceName = resourceName
    ? resourceName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, '_').toLowerCase()
    : `zoom-${zoomModId}`;

  const baseFilename = `${safeCourseName}${safeResourceName}`;
  return {
    baseFilename,
    mp4Url: `${MINIO_URL}/${baseFilename}.mp4`,
    vttUrl: `${MINIO_URL}/${baseFilename}.vtt`
  };
};

export const findVideoInMinio = async (courseName, resourceName, zoomModId) => {
  const { baseFilename } = getDeterministicMinioUrls(courseName, resourceName, zoomModId);
  console.log(`[Minio Check] courseName: "${courseName}", resourceName: "${resourceName}"`);
  console.log(`[Minio Check] baseFilename generated: "${baseFilename}"`);

  // Make an S3 ListObjectsV2 request signed by aws4fetch
  const url = `${MINIO_URL}?list-type=2&prefix=${encodeURIComponent(baseFilename)}`;
  console.log(`[Minio Check] S3 ListObjectsV2 URL: ${url}`);

  try {
    const response = await aws.fetch(url);
    if (!response.ok) {
      console.warn(`[Minio Check] Fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const xml = await response.text();
    console.log(`[Minio Check] S3 Response XML:`, xml);
    // Parse the XML for any <Key> that matches our prefix and ends with .mp4
    const keyMatch = xml.match(/<Key>([^<]+\.mp4)<\/Key>/);
    if (keyMatch) {
      const key = keyMatch[1];
      const base = key.replace(/\.mp4$/, '');
      console.log(`[Minio Check] MATCH FOUND: ${key}`);
      return {
        mp4Url: `${MINIO_URL}/${key}`,
        vttUrl: `${MINIO_URL}/${base}.vtt`
      };
    } else {
      console.log(`[Minio Check] No .mp4 matching found in the XML.`);
    }
  } catch (e) {
    console.warn("[Minio Check] Minio ListObjects fallback failed", e);
  }
  return null;
};

/**
 * Extracts the .mp4 video URL from a Zoom activity page HTML.
 */
export const extractZoomVideoUrl = async (sessionUrl, zoomModId) => {
  const url = `${sessionUrl}/mod/zoomutnba/view.php?id=${zoomModId}`;
  console.log(`[Zoom Pipeline] 1. Requesting zoomutnba view page: ${url}`);
  const response = await fetch(url);
  const html = await response.text();

  const mp4Match = html.match(/(https?:\/\/[^\s"'<]+?\.mp4)/i);
  if (mp4Match) {
    console.log(`[Zoom Pipeline] 1. Found MP4 URL natively: ${mp4Match[1]}`);
    return mp4Match[1];
  }

  const recMatch = html.match(/(https?:\/\/[^\s"'<]+?zoom\.us\/rec\/(play|share)\/[^\s"'<]+)/i);
  if (recMatch) {
    console.warn("[Zoom Pipeline] 1. Found Zoom Cloud URL (Skipping due to Auth barriers): " + recMatch[1]);
    return null;
  }

  console.warn(`[Zoom Pipeline] 1. No MP4 URL found in page source.`);
  return null;
};

export const downloadVideoBlob = async (videoUrl) => {
  console.log(`[Zoom Pipeline] 2. Downloading video blob from Moodle AWS...`);
  const response = await fetch(videoUrl);
  if (!response.ok) {
    console.error(`[Zoom Pipeline] 2. Download failed: ${response.status} ${response.statusText}`);
    throw new Error("Failed to download video");
  }
  const blob = await response.blob();
  console.log(`[Zoom Pipeline] 2. Downloaded Blob. Size: ${Math.round(blob.size / 1024 / 1024)} MB`);
  return blob;
};

export const uploadToMinio = async (blob, filename) => {
  const uploadUrl = `${MINIO_URL}/${filename}`;
  console.log(`[Zoom Pipeline] 3. Uploading to Minio S3 bucket: ${uploadUrl}`);

  // Sign the PUT request for S3 API
  const signedRequest = await aws.sign(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type || 'video/mp4'
    },
    body: blob
  });

  const response = await fetch(signedRequest);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Zoom Pipeline] 3. Minio S3 Upload failed: ${response.status}`, errText);
    throw new Error(`Minio upload failed: ${response.status} - ${errText}`);
  }

  console.log(`[Zoom Pipeline] 3. Minio Upload Success: ${filename}`);
  return uploadUrl;
};

export const transcribeWithVibe = async (blob) => {
  const formData = new FormData();
  // Vibe endpoint expects 'file' parameter with the audio/video file
  formData.append('file', blob, 'recording.mp4');
  formData.append('response_format', 'vtt'); // Force VTT output

  const response = await fetch(VIBE_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vibe transcription failed: ${response.status} - ${errText}`);
  }

  const resultText = await response.text();
  return resultText; // Returning the raw VTT string
};

export const processZoomRecording = async (sessionUrl, courseId, zoomModId, courseName, resourceName, onProgress) => {
  console.log(`[Zoom Pipeline] --- INITIALIZING para "${resourceName}" (ID: ${zoomModId}) en "${courseName}" ---`);
  try {
    onProgress("Extrayendo URL del video...");
    const videoUrl = await extractZoomVideoUrl(sessionUrl, zoomModId);

    if (!videoUrl) {
      onProgress("Grabación no disponible todavía o bloqueada.");
      return { success: false, reason: "No video available" };
    }

    onProgress("Descargando grabación...");
    const videoBlob = await downloadVideoBlob(videoUrl);

    onProgress("Generando subtítulos (VTT) con Vibe...");
    const vttText = await transcribeWithVibe(videoBlob);

    onProgress("Guardando en la nueva DB PGlite y OPFS FileSystem...");
    await ingestZoomRecording(zoomModId, courseId, resourceName, videoBlob, vttText, "Grabación indexada automáticamente");

    onProgress("¡Completado!");
    console.log(`[Zoom Pipeline] --- SUCCESS ---`);
    return { success: true, text: vttText, videoUrl: `blob://${zoomModId}`, vttUrl: `blob://${zoomModId}` };
  } catch (error) {
    console.error(`[Zoom Pipeline] --- FATAL ERROR ---`, error);
    onProgress(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};
