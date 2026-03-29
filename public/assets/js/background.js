chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSCRIBE_VIBE') {
    (async () => {
      try {
        console.log("[Background] Fetching video to bypass CORS for Vibe. URL:", message.videoUrl);
        // The background script fetches the video. This avoids fetching it via the content script
        // keeping the heavy lifted blob outside the bridge, and uses the browser's cache 
        // if the content script already downloaded it.
        const res = await fetch(message.videoUrl);
        if (!res.ok) throw new Error("Background failed to download video: " + res.statusText);
        
        const blob = await res.blob();
        console.log("[Background] Blob size for Vibe:", blob.size);
        
        // Chrome Extension Service Workers (Manifest V3) have a known bug causing 'TypeError: Failed to fetch'
        // when uploading a FormData containing a Blob. We must manually construct the multipart/form-data buffer!
        const boundary = '----WebKitFormBoundaryMoodleVibeProxy123';
        const arrayBuffer = await blob.arrayBuffer();
        
        let prefix = '--' + boundary + '\r\n';
        prefix += 'Content-Disposition: form-data; name="response_format"\r\n\r\n';
        prefix += 'vtt\r\n';
        prefix += '--' + boundary + '\r\n';
        prefix += 'Content-Disposition: form-data; name="file"; filename="recording.mp4"\r\n';
        prefix += 'Content-Type: video/mp4\r\n\r\n';
        
        const enc = new TextEncoder();
        const prefixBuf = enc.encode(prefix);
        const postfixBuf = enc.encode('\r\n--' + boundary + '--\r\n');
        
        const finalBody = new Uint8Array(prefixBuf.length + arrayBuffer.byteLength + postfixBuf.length);
        finalBody.set(prefixBuf, 0);
        finalBody.set(new Uint8Array(arrayBuffer), prefixBuf.length);
        finalBody.set(postfixBuf, prefixBuf.length + arrayBuffer.byteLength);
        
        console.log("[Background] Sending ArrayBuffer to Vibe local API:", message.vibeUrl);
        const vibeRes = await fetch(message.vibeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data; boundary=' + boundary
          },
          body: finalBody
        });
        
        if (!vibeRes.ok) {
          const errText = await vibeRes.text();
          throw new Error('Vibe API responded with ' + vibeRes.status + ': ' + errText);
        }
        
        const text = await vibeRes.text();
        console.log("[Background] Vibe transcription complete!");
        sendResponse({ success: true, text });
      } catch (err) {
        console.error("[Background] Error in transcribe workflow:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep the message channel open for the async response
  }
});
