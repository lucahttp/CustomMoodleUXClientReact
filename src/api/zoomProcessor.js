import { AwsClient } from 'aws4fetch';

// Configure this with your local Minio settings
const MINIO_URL = 'http://localhost:9000/utn';
const MINIO_ACCESS_KEY = 'minioadmin';
const MINIO_SECRET_KEY = 'minioadmin';

// Vibe API endpoint
const VIBE_URL = 'http://127.0.0.1:58615/v1/audio/transcriptions';

const aws = new AwsClient({
  accessKeyId: MINIO_ACCESS_KEY,
  secretAccessKey: MINIO_SECRET_KEY,
  service: 's3',
  region: 'us-east-1', // default for Minio
});

/**
 * Extracts the .mp4 video URL from a Zoom activity page HTML.
 */
export const extractZoomVideoUrl = async (sessionUrl, zoomModId) => {
  const url = `${sessionUrl}/mod/zoomutnba/view.php?id=${zoomModId}`;
  const response = await fetch(url);
  const html = await response.text();
  
  // NOTE: This parsing heavily depends on how Moodle/Zoom renders the page.
  // Common patterns: direct .mp4 links, <video src="...">, or an iframe to zoom.us.
  // Here we search for the first .mp4 link as a best-effort, or we can look for "zoom.us/rec/"
  
  const mp4Match = html.match(/(https?:\/\/[^\s"'<]+?\.mp4)/i);
  if (mp4Match) {
    return mp4Match[1];
  }

  const recMatch = html.match(/(https?:\/\/[^\s"'<]+?zoom\.us\/rec\/(play|share)\/[^\s"'<]+)/i);
  if (recMatch) {
    throw new Error("Found Zoom Cloud URL, but direct MP4 download might require authentication: " + recMatch[1]);
  }

  throw new Error("Could not find a recording video URL on the page.");
};

export const downloadVideoBlob = async (videoUrl) => {
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error("Failed to download video");
  return await response.blob();
};

export const uploadToMinio = async (blob, filename) => {
  const uploadUrl = `${MINIO_URL}/${filename}`;
  
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
    throw new Error(`Minio upload failed: ${response.status} - ${errText}`);
  }
  
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

export const processZoomRecording = async (sessionUrl, zoomModId, courseName, resourceName, onProgress) => {
  try {
    onProgress("Extrayendo URL del video...");
    const videoUrl = await extractZoomVideoUrl(sessionUrl, zoomModId);
    
    // Create safe folder name from courseName: lowercase, remove accents, leave alphanumeric and hyphens
    const safeCourseName = courseName
      ? courseName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '/'
      : 'uncategorized/';

    const safeResourceName = resourceName 
      ? resourceName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      : `zoom-${zoomModId}`;

    const dateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    onProgress("Descargando grabación...");
    const videoBlob = await downloadVideoBlob(videoUrl);
    
    onProgress("Subiendo video a Minio...");
    const baseFilename = `${safeCourseName}${safeResourceName}-${dateStr}`;
    const mp4Filename = `${baseFilename}.mp4`;
    const minioVideoUrl = await uploadToMinio(videoBlob, mp4Filename);
    
    onProgress("Generando subtítulos (VTT) con Vibe...");
    const vttText = await transcribeWithVibe(videoBlob);
    
    onProgress("Subiendo subtítulos a Minio...");
    const vttFilename = `${baseFilename}.vtt`;
    const vttBlob = new Blob([vttText], { type: 'text/vtt' });
    const minioVttUrl = await uploadToMinio(vttBlob, vttFilename);

    onProgress("¡Completado!");
    return { success: true, text: vttText, videoUrl: minioVideoUrl, vttUrl: minioVttUrl };
  } catch (error) {
    console.error("Zoom processing error:", error);
    onProgress(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};
