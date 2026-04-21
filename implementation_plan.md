# Codebase Quality Refactoring

Applying your guidelines (minimalism, no duplicate code, small functions, DX-first) to the current state of the Moodle UX pipeline.

## User Review Required

> [!CAUTION]
> **Latent compile bug:** `main.rs:36` uses `Value` but `use serde_json::Value` was removed in my last edit session. Cargo check passed (possibly utoipa macro magic), but this is fragile — the import must be restored explicitly.

> [!IMPORTANT]
> **~180 lines of dead code in `sync.rs`** — `SyncEngine::process()` (lines 160-322) is the old unauthenticated download path that was replaced by `ingest_bytes()`. It still tries `reqwest::Client::get()` against Moodle URLs that require HttpOnly cookies, so it **always fails**. I'll delete it entirely. The `SyncPayload` struct and the `SYNC_DATA` socket handler in `main.rs` that feeds it are also dead.

## Proposed Changes

### 1. Rust — Fix fragile `Value` import & remove dead code

#### [MODIFY] [main.rs](file:///c:/Users/lucas/CustomMoodleUXClientReact/pion-handoff-rust/src/main.rs)

- **Restore `use serde_json::Value;`** on line 9 (compile safety)
- **Remove `request_moodle_data()`** (lines 40-60) — returns hardcoded `json!([])`, never works
- **Remove `get_courses()`** and `get_course_details()`** (lines 62-88) — depend on broken stub above
- **Remove those routes** from the router (lines 245-246)
- **Remove `SYNC_DATA` socket handler** (lines 222-231) — feeds the dead `process()` path
- **Remove `ACTIVE_SOCKET` global** and its RwLock machinery — only used by the dead path and `ingest_video` (will pass socket differently)
- **Update OpenAPI schema** to remove references to deleted endpoints

#### [MODIFY] [sync.rs](file:///c:/Users/lucas/CustomMoodleUXClientReact/pion-handoff-rust/src/sync.rs)

- **Delete `SyncPayload` struct** (lines 10-19) — no longer received from anywhere  
- **Delete `SyncEngine::process()`** (lines 160-322) — 162 lines of dead unauthenticated download code, including the image-scraping regex pipeline
- What remains: `IngestMetadata`, `SyncEngine::new()`, `ingest_bytes()`, `notify()` — the clean, working pipeline

#### [MODIFY] [Cargo.toml](file:///c:/Users/lucas/CustomMoodleUXClientReact/pion-handoff-rust/Cargo.toml)

- **Remove `reqwest`** — only used by the dead `process()` path
- **Remove `md5`** — only used by dead image scraper in `process()`
- **Remove `regex`** — only used by dead image scraper

---

### 2. Frontend — Extract `DAEMON_URL` constant

Hardcoded in 4 places:
- `zoomProcessor.js:3`
- `handoffProxy.js:6`
- `VideoPlayer.jsx:47`
- `VideoPlayer.jsx:74`

#### [NEW] [config.js](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/config.js)

```js
// Why localhost:3000: Rust daemon runs locally alongside the extension
export const DAEMON_URL = 'http://localhost:3000';
```

#### [MODIFY] Files above → import from `config.js`

---

### 3. Frontend — Extract duplicated resource type detection

Duplicated in `handleResourceClick` (line 45-47) and `handleSyncAll` (line 139-140):

```js
const isBook = res.modname?.toLowerCase().includes('book') || ...
const isZoom = res.modname?.toLowerCase().includes('zoom') || ...
```

#### [NEW] [resourceTypes.js](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/utils/resourceTypes.js)

```js
export const isBook = (res) => {
  const mod = (res.modname || res.module || '').toLowerCase();
  return mod.includes('book') || mod.includes('libro');
};

export const isZoom = (res) => {
  const mod = (res.modname || res.module || res.type || '').toLowerCase();
  return mod.includes('zoom') || mod.includes('clase en vivo');
};
```

#### [MODIFY] [App.jsx](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/App.jsx)

Import and use in both handlers.

---

### 4. Frontend — Reuse `parseZoomDate` from dateUtils.js

`handleSyncAll` (lines 166-187) reimplements Spanish date parsing inline. `dateUtils.js` already exports `parseZoomDate()` which does the same thing.

#### [MODIFY] [App.jsx](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/App.jsx)

- **Add** `isZoomClassFinished()` to `dateUtils.js` (2-hour buffer logic)
- **Replace** the 22-line inline parsing block with a one-liner:
  ```js
  if (!isZoomClassFinished(mod.name)) { stats.skipped++; continue; }
  ```

#### [MODIFY] [dateUtils.js](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/utils/dateUtils.js)

Add:
```js
export function isZoomClassFinished(className, bufferHours = 2) {
  const info = parseZoomDate(className);
  if (!info) return true; // Can't parse → assume finished, let it try
  const endTime = new Date(info.timestamp + bufferHours * 3600_000);
  return endTime <= new Date();
}
```

---

### 5. Frontend — Extract `handleSyncAll` into its own module

Currently 130 lines inlined inside `App.jsx`. After changes 3 and 4, it'll be ~80 lines — still too big and not reusable.

#### [NEW] [syncAll.js](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/api/syncAll.js)

Move the entire sync loop here as a pure async function — receives callbacks for UI updates, returns stats. App.jsx becomes a 5-line wrapper that wires it to state setters.

---

### 6. Frontend — Clean `handoffProxy.js` dead socket handler

`handoffProxy.js` lines 38-101 handle `REQUEST_MOODLE_DATA` from the daemon — but the daemon endpoint that triggers it (`request_moodle_data()`) is being deleted in change 1. This handler becomes dead code.

#### [MODIFY] [handoffProxy.js](file:///c:/Users/lucas/CustomMoodleUXClientReact/src/api/handoffProxy.js)

- Remove the `REQUEST_MOODLE_DATA` handler
- Keep `JOB_PROGRESS`, `SYNC_DATA` emit, and connect/disconnect

---

### 7. Rust — `db.rs` unused function cleanup

`search_resources()` generates a cargo warning. It's the FTS search function but nothing calls it yet.

#### [MODIFY] [db.rs](file:///c:/Users/lucas/CustomMoodleUXClientReact/pion-handoff-rust/src/db.rs)

- Add `#[allow(dead_code)]` with a `// TODO: wire to /api/search endpoint` comment, or delete if we want zero warnings

---

## Open Questions

1. **`SyncEngine::process()` deletion** — This removes the ability for the daemon to download resources on its own (books, pdfs, youtube via yt-dlp). All downloads now go through the extension. Is that the intended architecture going forward, or do you want to keep the `yt-dlp` / book download paths?

2. **`search_resources` in db.rs** — Keep with `#[allow(dead_code)]` (you'll wire it soon) or delete?

3. **Scope** — Should I also tackle the WatermelonDB → PGlite unification as part of this, or keep it as a separate future task?

## Verification Plan

### Automated
- `cargo check` — zero errors, zero warnings after changes
- `npm run build` — clean Vite build
- Verify `processZoomRecording` → `ingest_video` → `get_media_url` roundtrip still works via browser console

### Manual
- Open a Zoom resource in the UI → should show download progress → play video from Bóveda
- Run "Sync All" → books should still download, zoom classes should skip future ones correctly
