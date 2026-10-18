# Session Handoff — Sep 30, 2026 — Retired AI Word Study commentary + AI Language & Structure (v4.46.0 / v4.46.1)

**Read order for next chat:** SESSION-BOOT.md → this file → `claude/session-handoff-sep30-2026-settings-about-v4-45-0.md` → ways-of-working.md → spec for the active item.

## State
- Live: **pilgrim-private v4.46.1** (`1a5e0ec` on `arche-epos/arche-suite` main). v4.46.0 = `02913f0` (the retirement). v4.45.0 = `c8a7c52` (Settings > About). Pushed via the GitHub App; base checked fresh before each push; Pages deploy took about 1-2 minutes each.
- Changelog label "Latest — untested": live-tested in the built-in browser only, **not on Boss's phone.**
- **Still pending on Boss's phone:** v4.42.2 hot patch (Resume same verse), Interlinear, Settings > About > Check for updates (the banner mystery), and now the Word Study / Study Snapshot changes.

## Boss decisions this chat (all confirmed in chat)
- Retire the **AI Word Study commentary** and **AI Language & Structure** together, after the formal Data Safety Warning (amended to include L&S) and an explicit "Confirm".
- Word Study button stays as **source-data only** (facts panel, no AI). Language & Structure button removed. Study Snapshot runs three tools.
- **Pilgrim Guide** data lookups (Strong's word/number, Interlinear, cross-references, translation comparison, rendered from the data files with no AI-written facts): Boss wants to **talk about it later**. Proposed design (not built, not decided): the Guide's model only classifies the request into a JSON envelope (new mode, e.g. `bible_lookup` with tool + reference or Strong's number); the app renders real rows from the same data builders; ephemeral, nothing stored. Needs a refactor to extract data-only builders from the Bible Tools sheet renderers. This replaces the old "Part 2: run the six AI tools from chat" plan in `spec-pilgrim-guide-conversational-v1.md`, which should be amended when the design is agreed.

## What shipped
**v4.46.0** (studyTools.js, index.html, ui.js, utils.js, docs help reference):
- `RETIRED_AI_TOOLS=['lexical','grammar']`. `runTool('lexical')` now only calls `showAIPanel('lexical', <saved commentary or ''>)`: **no /groq call, no write to ar.deep.** `runTool('grammar')` just toasts (button removed anyway).
- Saved `ar.deep.lexical/_book` and `ar.deep.grammar/_book` are untouched, still appear as tabs in the AI results panel (with a one-line label), still in exports (export modal still lists both), sync and backup. Go Deeper / Continue are hidden for these two tools' tabs so nothing new can be written to them.
- Study Snapshot: `SNAPSHOT_TOOL_ORDER=['geography','historical','cultural']`, `passageTools=['geography']`, ready check now `geography && historical_book && cultural_book`, subtitle and mobile confirm text updated.
- `btn-grammar` removed from index.html; hint text under the scope toggle updated; Settings tour text updated ("Four Study Tools"; Snapshot step); help reference updated.
- Retired code paths (buildGrammarGround, grammar/lexical prompt branches in `buildPrompt`) deliberately left in place but unreachable, same as Cross-References in v4.41.0.
**v4.46.1** — two Word Study facts-panel bugs found during live testing, fixed:
1. **Word Study facts were empty for the entire Old Testament.** `_isContentWordMorph` only understood Greek tags; every OSHB Hebrew/Aramaic tag (e.g. `HTd/Ncmsa`, `HVhc`) failed the test and was filtered out. Now takes an `isOT` flag (book number <= 39) and treats a word as content if any `/`-segment (after dropping the H/A language letter) is N, V, A or D. Checked against all 305,506 OT words: 78% content; NT unchanged (50.5%). Numbers 9:15 now shows 12 unique content words.
2. **Facts cache was keyed by tool+scope only** (`aiFactsResults[ck]`), so the first study opened in a session decided what every other study showed until reload. Now keyed by `ck|reference`. A failed load is no longer cached (retry on next tap).
- Known minor: the v4.46.1 changelog says "its 14 content words" for Numbers 9:15; the panel lists 12 (unique by Strong's number; 14 counts repeats). Fix the wording in the next release.

## Live test results (built-in browser, QA Test user)
- Baseline (before) vs after v4.46.0: localStorage identical except `_sw_ver` (the existing version-tracker); IndexedDB list identical.
- After opening studies and running Word Study: all saved AI results (lexical/grammar/historical/cultural/crossrefs/geography, passage and book) byte-identical to baseline; the only differences on opened studies are `updatedAt` and `lastOpened` (normal open-a-study behavior, not from this change).
- Word Study: **0 /groq calls** across Numbers 9:15 (12 rows + saved commentary under a label), John 1:1 (4 rows), Genesis 1:1 (5 rows), John whole book (24 rows); switching between studies now shows each study's own words. Saved Language & Structure result shows as "Lang & Structure" tab with its note; Go Deeper and Continue rows hidden on both.
- Study Snapshot: progress modal shows three rows (Places & Geography, Historical, Cultural), all "cached", "All tools ready", 0 AI calls. Export modal still lists Word Study and Language & Structure "This Passage" controls.
- Unit tests 24 + 27 pass; all modules pass `node --check` (as .mjs).

## Findings / open items
- **OT passages still slice `data/macula` by the English verse number** in the Word Study facts panel (`buildLexicalGround` / `sliceBookData`), so a passage like Psalm 51:1-… or Joel 2:28-32 shows the wrong Hebrew verses' words. Now more visible because Word Study is facts-only. Fix idea: reuse `hebrewVerses()` from `versemap.js`. Not fixed.
- Go Deeper / Continue can still generate NEW commentary on saved Cross-References tabs (retired in v4.41.0 but not guarded). Not changed (out of scope); worth guarding the same way (`RETIRED_AI_TOOLS`) if Boss wants.
- **Not retired, untouched:** the Word Study search box (`_lexClassify` / `_lexFullLookup`, still makes an AI explanation call at ~line 2237 of studyTools.js, feeds the saved words list); Historical, Cultural, Places & Geography.
- `/groq` lockdown (only two allowlisted PINs [digits redacted in this public copy] allowed on AI tool runs) **stays**: the tools above still use it. It can lift only after the remaining AI surfaces are retired or grounded.
- Undecided: whether to retire or ground the Word Study search box's AI explanation.
- Earlier open items: NT versification audit; background audio (`claude/spec-background-audio-v1.md`) next after the above; the phone-side update-banner diagnosis (use Settings > About > Check for updates).
- `data/README.md` still says a credit line "needs to be added" to About/Credits; now done in v4.45.0. Update that sentence next time the file is touched.
- Stale text elsewhere: the `spec-bible-tools-v1.md` §6 list ("Retire ... Language & Structure, Word Study AI tools") is now done for those two; Cross-References was done in v4.41.0.

## Testing recipes that worked
- Study IDs in the QA Test user: `bsn_1782587954128` (Numbers 9:15; saved lexical + grammar + geography + book results), `bsn_1790145071230` and `bsn_1790645157377` (Acts 2:1-13; saved lexical, one also grammar), `bsn_1784431914035` (John 1:1, nothing saved), `bsn_1782593390220` (Genesis 1:1, nothing saved).
- Open a study and the tool panel from the console: `openStudy(id); switchStudyTab('tools'); setScope('passage'); await runTool('lexical')`, then read `#aipanel-content`, `#aipanel-title`, `#aipanel-tabs button`.
- Count AI calls: wrap `window.fetch` and count URLs containing `/groq`.
- Inspect module state: `const m = await import('./studyTools.js?v=<current version>')` gives the live instance (`m.aiFactsResults`).
- Data-safety compare: store `localStorage` + `indexedDB.databases()` in `window.name` before navigating (survives reload), compare after; ignore `_sw_ver`, `lastOpened`, `updatedAt`.
- Browser polling scripts must stay under ~45 s per call; poll live version with several short calls.
