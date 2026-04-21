# Moodle Handoff Project Context Summary

## Architecture & Current Status
This project consists of:
1. **Frontend / Extension (React + Vite + Chrome Extension APIs)**: 
   - A Moodle UX extension injected into `https://vj.sied.utn.edu.ar/`.
   - Modifies the UI, renders native video players (`ClassView.jsx`, `VideoPlayer.jsx`), and provides a clean UI for downloading resources.
   - Extracts Google Slides to SVG utilizing an iframe RPC mechanism (`postMessage`) to keep the iframe native instead of using background tabs.
2. **Backend Daemon (Rust `pion-handoff-rust`)**:
   - An asynchronous local daemon running Axum and Socket.io.
   - Listens on `http://localhost:3000` to serve the local proxy files (`/boveda/*`).
   - Maintains an SQLite FTS5 database (`moodle_boveda.db`) for indexed search and local offline syncing of Moodle resources.
   - Features a Dual-Queue (async I/O for downloading, CPU queue for transcoding/transcription tasks).
3. **Database (FTS5)**:
   - Stores videos, transcriptions, downloaded HTML books, and embedded scraped images to provide 100% offline retrieval.

## The Problem (Moodle Auth)
We successfully implemented the Rust logic to clone Moodle resources and traverse raw HTML files replacing remote image paths with localhost proxy paths (`Boveda`). 

However, **Moodle's Authentication relies on highly restrictive HttpOnly cookies** for `https://vj.sied.utn.edu.ar/`.
Our attempt:
- We tried accessing `chrome.cookies.get({ name: 'MoodleSession' })` via the `background.js` worker and passing `session_cookie` down to the Rust Daemon so `reqwest` could impersonate the browser.
- **Result:** The Rust Daemon still falls into a `TooManyRedirects` loop ending up at `/login/index.php`.
- **User decision:** Passing `session_key` and `session_cookie` to Rust was discarded, as downloading Moodle-protected elements directly from the Rust Daemon failed.

## Pending Direction / Work for Claude
- Since the Rust backend can't easily download Moodle files (due to the auth redirects), the downloading/scraping of secure Moodle resources (like Books and specific course files) needs to be shifted. 
- You need to decide if the Chrome Extension itself (which has the active session) should locally `fetch()` and download the payloads (arrays of bytes/HTML/Images) and then upload them sequentially to the local Rust daemon (via Socket.io or POST), rather than telling the Rust daemon to fetch the remote Moodle URL.
- The `SyncPayload` struct in Rust (`pion-handoff-rust/src/sync.rs`) currently has the discarded `session_key` and `session_cookie` fields removed.
- Need to re-architect the Moodle Download flow: Extension pulls the content -> ships it to Rust for saving, instead of Extension sending URL -> Rust pulls content.
