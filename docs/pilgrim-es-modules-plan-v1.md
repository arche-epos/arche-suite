# Pilgrim ES Modules Split Plan — v1
**File:** `Pilgrim-Private.html` | **Version at spec:** v4.9.72 | **Lines:** ~6,551
**Date:** June 15, 2026

> ⚠️ **Status update — June 18, 2026:** Live version is now v4.9.73 (no content changes
> relevant to this plan — just the post-migration share-link fix). The repo also moved:
> this work now happens in `arche-epos/arche-suite`, `pilgrim-private/` folder, on the
> `dev` branch — placeholder files (`app.js`, `utils.js`, `storage.js`, `tts.js`,
> `sync.js`, `studyTools.js`, `ui.js`) already exist there as TODO stubs from repo
> scaffolding, untouched so far.
>
> **Execution is PAUSED.** Priority shifted to deploying v4.10.0 (PIN auth) first — see
> `deploy-guide-v4_10_0.md`. Resume Session 1 of this plan only after v4.10.0 is deployed
> and confirmed stable, per `session-handoff-june18d-2026.md`.

---

## Goal

Split the single-file `Pilgrim-Private.html` into a multi-file ES Module architecture
served via GitHub Pages. The HTML file becomes a thin shell; all logic lives in `.js` modules.

This is Step 3 of the Pilgrim refactor. ES Modules are deferred on DPS until Pilgrim
confirms the pattern works end-to-end.

---

## Target File Structure

```
/
├── index.html         ← Shell only: <head>, CSS, <div id="app">, <script type="module" src="app.js">
├── app.js             ← Entry point: imports all modules, calls init(), mounts app
├── utils.js           ← Sections 01, 02, 03, 06: constants, state, utilities, formatting
├── storage.js         ← Section 04: all localStorage read/write (persist, load, save*)
├── studyTools.js      ← Sections 11–16: Bible API, study tools, snapshot, lexicon, resources/OCR
├── tts.js             ← Section 14: Text-to-Speech (getVoices, speak, stop, TTS settings)
├── sync.js            ← Section 22: Gist sync (syncToGist, pullFromGist, useGistSync)
└── ui.js              ← Sections 05–10, 17–21, 23–26: editors, nav, library, tags, export,
                          backup, share, settings, book picker, onboarding, diagnostics, startup
```

> Note: `tts.js` is extracted from Section 14 which overlaps with `studyTools.js`.
> The boundary: TTS *engine* (speak, voices, settings) → `tts.js`. TTS *invocation* from study tools → `studyTools.js`.

---

## Section → Module Mapping

| Section | Title | Module |
|---|---|---|
| 01 | Configuration & Constants | `utils.js` |
| 02 | App State | `utils.js` |
| 03 | Utilities | `utils.js` |
| 04 | Storage | `storage.js` |
| 05 | Editor Setup | `ui.js` |
| 06 | Navigation | `ui.js` |
| 07 | Study Data Model | `utils.js` |
| 08 | Study Core (CRUD) | `storage.js` |
| 09 | Library | `ui.js` |
| 10 | Field Notes Panel | `ui.js` |
| 11 | Bible API | `studyTools.js` |
| 12 | Study Tools Panel | `studyTools.js` |
| 13 | Study Snapshot | `studyTools.js` |
| 14 | Text-to-Speech | `tts.js` |
| 15 | Lexicon & Word List | `studyTools.js` |
| 16 | Resources & OCR | `studyTools.js` |
| 17 | Tags | `ui.js` |
| 18 | Export / PDF | `ui.js` |
| 19 | Backup & Import | `ui.js` |
| 20 | Share & Deep Links | `ui.js` |
| 21 | Settings | `ui.js` |
| 22 | Sync | `sync.js` |
| 23 | Book Picker | `ui.js` |
| 24 | Onboarding | `ui.js` |
| 25 | Diagnostics & Feedback | `ui.js` |
| 26 | App Startup | `app.js` |
| 27 | Changelog | `utils.js` (CHANGELOG const) |
| 28 | Service Worker | `app.js` (SW registration) |

---

## Key Architectural Rules

### Globals become module exports
Every `var` or `const` at file scope that is shared across sections must become an explicit export.

Bad (current):
```js
var studies = [];
var cur = null;
```
Good (utils.js):
```js
export let studies = [];
export let cur = null;
```

### No `window.*` assignments for shared state
Currently many functions rely on `window.CHANGELOG`, `window.jspdf`, etc.
CDN libraries (jsPDF, Quill) stay as `<script>` tags in the HTML head — they land on `window` and are accessible globally. No change needed for those.
App globals move to module exports.

### Import order in app.js
```js
import * as Utils from './utils.js';
import * as Storage from './storage.js';
import * as TTS from './tts.js';
import * as Sync from './sync.js';
import * as StudyTools from './studyTools.js';
import * as UI from './ui.js';
```

### Circular dependency risk
`ui.js` calls `storage.js` (persist, load). `storage.js` must NOT import `ui.js`.
`studyTools.js` may call `storage.js` (saveStudy). Same rule — no back-imports.
Resolution: `app.js` wires callbacks between modules after import.

### GitHub Pages + ES Modules
ES Modules work on GitHub Pages with no build step. The only requirement:
- Files served with `Content-Type: application/javascript` — GitHub Pages does this correctly.
- All `<script type="module">` tags respect CORS — same-origin on GitHub Pages is fine.
- No `file://` protocol (ES Modules require HTTP) — already satisfied since we use Pages.

---

## Execution Plan

### Pre-requisite
- Repo transferred to `archestudytools` account ✅ (before this step)
- `dev` branch created from `main` ✅
- All Step 3 work happens on `dev` branch; never directly on `main`

### Session 1 — Extract utils.js
1. Identify all global vars/consts in Sections 01, 02, 03, 07, 27
2. Copy to `utils.js` with `export` prefixes
3. Replace in `app.html` with `import { ... } from './utils.js'`
4. Test: app loads, library renders

### Session 2 — Extract storage.js
1. Sections 04, 08: all load/save/persist functions
2. `storage.js` imports from `utils.js` (studies, cur, etc.)
3. All callers in `app.html` import from `storage.js`

### Session 3 — Extract tts.js + sync.js
1. Section 14 (TTS engine) → `tts.js`
2. Section 22 (Gist sync) → `sync.js`
3. Both are mostly self-contained; lowest dependency risk

### Session 4 — Extract studyTools.js
1. Sections 11–13, 15–16
2. Imports: `utils.js`, `storage.js`, `tts.js`
3. Test all AI tools, Bible API, lexicon

### Session 5 — Extract ui.js + finalize app.js
1. Remaining sections → `ui.js`
2. Section 26 (startup) → `app.js` init function
3. Remove all extracted code from `app.html`
4. Full integration test on `dev` branch

### Session 6 — QA + merge to main
1. Full manual test pass on `dev`
2. PR `dev` → `main` (or direct merge if no CI)
3. Verify archestudytools.com loads correctly
4. Port pattern to DPS (future)

---

## What Changes in the HTML Shell

Before (current):
```html
<script>
  // 6,551 lines of JavaScript
</script>
```

After:
```html
<script src="https://cdn.quilljs.com/..."></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/..."></script>
<!-- other CDN libs -->
<script type="module" src="app.js"></script>
```

The HTML shell keeps: `<head>`, all CSS, all HTML markup, CDN `<script>` tags.
It loses: the entire inline `<script>` block.

---

## Risk Notes

- **Quill editors** (`_qFN`, `_qOutline`, `_qConcl`) are initialized in Section 05 and referenced globally. They'll need to live in `ui.js` as exported `let` bindings.
- **`node --check` won't apply to ES modules** in the same way. Use browser DevTools console for validation during extraction.
- **Service Worker (Section 28)** caches `index.html`. After the split, the SW cache list must include all `.js` module files.
- **`async/await`** in `exportPDF`, `runDiagnostics` etc. — these work fine in ES modules. No changes needed.

---

## Handoff Notes for Session 1

Start file: `Pilgrim-Private.html` v4.9.72 on `dev` branch of `archestudytools` repo.
First action: create `utils.js` as empty file on dev branch, then begin extraction.
Use `grep -n "^var \|^const \|^let " pilgrim.html` to enumerate all global declarations before extracting.
