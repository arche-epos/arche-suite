# Session Handoff — Sep 23, 2026: AI Study Tools Grounding — Phase 2 Complete & Deployed

**Repo state at end of session:** `arche-epos/arche-suite`, `main` @ `5c839d04` (v4.38.0)
**Session start point:** `main` @ `3434503` (Phase 1 data pipeline live)

---

## What happened this session

Continuation of `pilgrim-ai-tools-fabrication` / `spec-ai-tools-grounding-v1.md`. Picked up from
`session-handoff-sep23-2026-ai-tools-grounding-phase1.md`.

### 1. Found Phase 1 was actually incomplete — fixed before building Phase 2
`data/strongs/` only had `gloss-index.json` and `occurrences.json`. **`greek.json`/`hebrew.json`
(the actual Strong's dictionary text) were never committed**, despite `data/README.md` and the
prior handoff both describing them as done. Verified this directly against the GitHub folder
listing before building anything — did not build lexical/lexicon prompts against a guessed schema.

**Fix (Boss approved "Option 1"):** pulled `openscriptures/strongs`'s pre-built JS dictionary files
(`strongs-greek-dictionary.js` / `strongs-hebrew-dictionary.js` — same source spec-ai-tools-
grounding-v1.md §2 already names), parsed and normalized to `{lemma, translit, pron, derivation,
strongs_def, kjv_def}` keyed by Strong's number. 5,523 Greek / 8,674 Hebrew entries. Cross-checked
Strong's-number format against every existing Phase 1 file (`macula/`, `gloss-index.json`,
`occurrences.json`) before use — all aligned, no normalization mismatches found.

### 2. Phase 2 build — DONE, deployed, verified live on `main` @ `5c839d04`

**`studyTools.js` / `utils.js` (v4.38.0):**
- New Section 11B — grounding-data fetch layer: `fetchGroundData()` (jsDelivr + in-memory
  per-session cache), per-book macula/crossrefs fetchers, Strong's-dict/gloss-index/occurrence-
  index fetchers, verse-range slicing, and `verifyGroundedOutput()` (the spec §5 verification
  pass — regex-extracts Strong's numbers/original-script words/ref-shaped tokens from AI output,
  strips anything not in the data actually sent, logs via the existing `beaconError` error-log
  beacon).
- `buildPrompt()` is now `async`. For `lexical`/`grammar`/`crossrefs` it fetches real data first
  and returns `{prompt, ground}`; caller awaits, then runs the response through
  `verifyGroundedOutput()` before storing/rendering. `historical`/`cultural`/`geography` unchanged
  (spec §7 — out of scope, no equivalent dataset).
- All 3 call sites updated to `await buildPrompt(...)`: `runTool()`, `runSnapshot()`'s
  `runOneSnapshotTool()`, `continueCurrentTool()`.
- Lexicon search box (Plan A) rewritten: `_lexClassify` no longer calls the AI — it looks the
  searched word up in the real `gloss-index.json` and returns real candidate Strong's numbers (0
  matches = honest "not found," not a guess; 1 match = straight to lookup; 2+ = real-data sense
  picker). `_lexFullLookup` resolves a Strong's number, pulls the real dictionary entry, pulls real
  occurrence refs from `occurrences.json`, fetches real KJV verse text for the first 10 via the
  app's existing `getBibleAPI()` (remaining refs shown reference-only). One small AI call remains,
  for a short explanatory paragraph — tightly grounded to that single word's real data and passed
  through `verifyGroundedOutput()` too. Removed the false "Thayer's/BDB" attribution from the
  rendered output (that data was never actually sourced from those lexicons).
- Removed named-scholar (BDAG/BDB) citation instructions from the lexical prompt.
- Tunable caps (named constants, top of Section 11B): `GROUND_BOOK_WORD_CAP=40`,
  `GROUND_BOOK_CROSSREF_CAP=30`, `GROUND_PASSAGE_CROSSREF_CAP=15`, `LEX_OCCURRENCE_TEXT_CAP=10`.

**Deploy — two commits, Git Data API flow, both verified sha256-match after push:**
- `ada95df1` — `data/strongs/{greek,hebrew}.json` (new) + `studyTools.js`/`utils.js` (v4.38.0).
- `5c839d04` — cache-busting catch: `ada95df1` only bumped `studyTools.js`'s own import of
  `utils.js`. Every other importer (`app.js`, `ui.js`) and the transitive graph (`memory.js`,
  `storage.js`, `sync.js`, `tts.js`, `media.js`) plus `index.html`'s entry-script tag were still
  pinned at `?v=4.37.4` — would have kept serving stale cached files and silently defeated the
  whole fix for anyone with the old version cached. Bumped all to `?v=4.38.0`, no content changes.

---

## Not done / carried over

### Phase 3 — test plan (spec §5.1), not started
- Re-run Acts 2:1-13 through Word Study, Language & Structure, Cross-References; confirm every
  Strong's number/Greek word/cross-reference matches the real source data exactly.
- Spot-check 5-10 more passages (OT + NT, one long passage >10 verses, one single-verse).
- Confirm the verification-pass strip/log path actually fires on a deliberately malformed case
  (temporarily strip the grounding data from a request, confirm the model's now-ungrounded output
  gets flagged/stripped rather than silently rendered).
- Lexicon-specific pass (Plan A): a common English word (multiple senses), a rare/unambiguous word,
  a direct Strong's-number query, a word with zero gloss-index match (confirm the honest "not
  found" message, not a crash).
- **Not yet confirmed this session:** jsDelivr actually serving the new commits. GitHub API/raw
  confirms both commits are on `main`; jsDelivr itself has been unreachable from the build sandbox
  for two sessions running (network allowlist). First step of the next session should be checking
  it — see prompt below.

### Phase 4 — lockdown removal, not started
Remove `PILGRIM_PRIVATE_ALLOWED_PINS` gate on `/groq` in `arche-proxy` (Worker deploy is manual —
Boss pastes into the Cloudflare dashboard) — only after Phase 3 passes.

### Known residual risk — flagged, not fixed this session
`expandCurrentTool()` ("Go Deeper" button) runs its own separate, still-ungrounded prompt that
explicitly asks for "named scholars on each side." For lexical/grammar/crossrefs this reopens the
same fabrication risk after a clean grounded result. Not in the original bug report or the spec,
so left alone rather than scope-creep — worth a Phase 2b once Phase 3 clears.

### Still carried from earlier handoffs (untouched again this session)
- **Scripture Memory edit feature** — fully scoped (full edit of ref/translation/text; reset chunk
  progress only if verse/chunk count changes; new "Edit" button next to "Remove"). Data Safety
  Warning issued, never confirmed. Design not written to a doc — re-derive from conversation
  history if needed, or re-scope fresh.
- **Grading apostrophe bug** — diagnosed, not fixed: `_memGradeWords()` in `memory-core.js` doesn't
  normalize curly apostrophes (U+2019) before stripping punctuation, causing false "wrong" marks on
  contractions in Scripture Memory quizzes. Bundle with the Memory edit-feature build.
- **`verse-memory-spec-v1.md` superseded banner** — still not added (flagged four times now).
- **Pilgrim Private device-testing pass** on Stage 2 Scripture Memory — still untested on real
  devices, still the highest-risk untested surface in the app.

---

## Next session should

1. Confirm jsDelivr is serving both new commits (`ada95df1`, `5c839d04`) — quick check.
2. Run the Phase 3 test plan above.
3. Remove the `/groq` emergency lockdown once Phase 3 passes (Phase 4).
4. Circle back to Scripture Memory edit feature + apostrophe grading fix.
5. Consider the "Go Deeper" grounding gap (Phase 2b) — Boss's call on priority.
