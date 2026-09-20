# Session Handoff — Pilgrim Transcript + Recording (spec locked) — September 19, 2026

## Status
Research + spec DONE. Data Safety Warning for Pass 1 ISSUED and **CONFIRMED by Jesse** ("Confirmed"). **No code written.** Next: build Pass 1 in a fresh chat.

## Start of next chat
1. Read Project Knowledge, this handoff, and `spec-transcript-recording-v2.md` (upload both to Project Knowledge first).
2. Clone `https://github.com/arche-epos/arche-suite.git`; work in `pilgrim-private/` only. Confirm context loaded, then start Pass 1 (scope confirmed; do not re-ask settled decisions).
3. Take a fresh backup before testing (Settings → Export/Backup); test with a test PIN user first.

## Decisions locked (Jesse)
- Private only; port to Public later. Multi-file OK (new `media.js`).
- Media flags/position in IndexedDB `meta` store, NOT on the study record.
- Transcript text backed up in JSON export; audio not. No transcripts in Gist sync.
- Player pinned at top of Study screen. pdf.js lazy for PDFs.
- No "Save a copy" button; no Record button / timestamped notes (parked as possible Pass 3).
- Must work on all platforms (iOS Safari is the risk: eviction, weaker Media Session).
- Usage: typical class = 30–60 min audio (~30–100 MB).

## Key research findings (pilgrim-private v4.34.39)
- Files: index.html, app.js, ui.js (4057 lines), storage.js, sync.js, tts.js, utils.js, studyTools.js.
- All storage is namespaced per PIN user (`activateUser()` utils.js ~L428) → DB name `pilgrimMedia_<userId>`.
- Existing doc upload (`resHandleDoc`/`resAddDocResource`, studyTools.js ~L1820) truncates at 30,000 chars into localStorage; transcripts need their own store.
- Add-resource modal `#addres-overlay` index.html ~L1533; Notes-tab button ~L836.
- Gist sync pushes whole study objects; `importDataFromFile` replaces studies wholesale; `persist()` rewrites all studies → why flags stay off the study record.
- `exportData()` ui.js ~L2661; `importDataFromFile()` ui.js ~L1666; `deleteStudy()` storage.js ~L216.
- `ttsPlay()` tts.js ~L125 is the single speech start; `navTo()` ui.js ~L814 cancels TTS on screen change; screens are CSS show/hide.
- FAB (bottom-right) + nav occupy the bottom → player goes on top.
- No existing IndexedDB use found. Mammoth loads eagerly (index.html L23). Tests: `tests/smoke.spec.js` (Playwright).

## Open items to resolve during build
- What "Note" means as an upload type (default: Doc and Note both use existing doc flow).
- Sync-delete path: do tombstoned studies leave orphaned audio? Surface in storage meter.
- Exact active-user variable for the DB name.
- Push path (corrected Sep 20, 2026): Claude CAN push to `arche-suite` branch `jesse/transcript-recording` via the dev PAT + Git Data API (see SESSION-BOOT.md). Deliver a commit message too.

## Rules reminder
Ask clarifying questions first; no unrequested features; targeted edits; `node --check`; version bump + changelog + commit message; `present_files`; report 🟢/🟡/🔴 space each response; address Jesse as "Boss".
