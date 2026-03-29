# PGlite + OPFS Data Ingestion Pipeline

## Goal
Migrate the existing WatermelonDB ingestion pipeline to the new PGlite + OPFS architecture. 
This requires parsing resources (Videos with VTT and Moodle Books with HTML) into smaller chunks, storing large video blobs directly into OPFS, and inserting relations natively using PGlite arrays so that Full-Text Search (FTS) queries work securely and fast.

## Progress

| Task | Status | Description |
|---|---|---|
| Create Data Ingestion utility (`src/db/pgliteIngest.js`) | `[ ]` | Centralize DB DML inserts (recursos, transcripciones, capitulos) and chunks/blob OPFS connections. |
| Modify `zoomProcessor.js` | `[ ]` | Disconnect the deprecated `videoBlobStore` and wire it completely to `saveZoomRecording` inside `pgliteIngest.js`. |
| Modify `App.jsx` + `ClassView.jsx` | `[ ]` | Deprecate all calls utilizing `dbService.updateResourceContent()`. Bridge Book clicks to invoke `saveMoodleBook` in `pgliteIngest.js`. |
| Clean Up `videoBlobStore.js` | `[ ]` | Verify zero-duplicate code and clean out the deprecated monolithic IndexDB pipeline blobstore once OPFS integration proves functional. |

## Technical Considerations

### Chunking Logic
- **Videos (VTT)**: A regex will slice consecutive lines with `HH:MM:SS.mmm --> HH:MM:SS.mmm` tracking the active `start_time` for each paragraph until the next timestamp queue.
- **Books (HTML)**: We can use the already existing `bookParser.js` inside `src/utils` which generates an internal array of `{ id, title, content }`.

### DX First Checklist
- [ ] Implementations must have small, pure functions under 100 lines.
- [ ] No duplicated logic across components.
- [ ] Add JSDoc comments to `pgliteIngest.js` explaining the *why* (like "Why do we slice the HTML? To allow tsvector FTS direct anchor jumps.").
