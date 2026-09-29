# Session Handoff — Sep 28, 2026 — Bible Tools Release 1 (Cross-References) shipped

**Read order for next chat:** SESSION-BOOT.md → this file → ways-of-working.md → `claude/spec-bible-tools-v1.md` (§4 Release 2). MKB only if needed.

## State
- Live: **pilgrim-private v4.41.0** (commit `075c992` on `arche-epos/arche-suite` main). v4.40.0 = `dc41dff`.
- Release 1 (Cross-References) is DONE and live-tested in the built-in browser (Read flow, ESV + NIV/Bolls, cross-chapter range). **Study-screen entry point was NOT live-tested** — Boss to confirm.
- v4.41.0 is untested live beyond load (see "Verify first").

## What shipped
**v4.40.0** — Bible Tools sheet (`#bt-overlay`), opened from Read (verse selected → "Bible Tools" button in player bar, `openBibleToolsFromRead` in ui.js) and Study (button in `#scracts`, `openBibleToolsFromStudy`). Cross-References row: one collapsed row per verse + ref count; tap → refs ranked by votes, OT/NT tag, verse text in the current translation. No AI. Removed both temp DIAGNOSTIC lines. Help reference doc updated.
**v4.41.0** — AI Cross-References RETIRED (button removed from Study Tools tab; removed from Study Snapshot → now 5 tools; tour + snapshot copy updated). Saved `ar.deep.crossrefs` data untouched. "Show all" dropped (max 8 refs/verse in dataset).

## Where the code lives (studyTools.js "SECTION 12b")
`openBibleTools(ref,trans,focusKey,verseNums)` → `_btLoad` (fetches `data/crossrefs/<book#>.json` via existing `getCrossrefsBook`) → `_btRender` / `_btVerseHTML` / `_btHydrate`. Verse text: `_btLoadText` → `_btFetchText` (ESV = `getESV`; Bolls translations = own cached chapter fetch `_btBollsChapter`, sliced locally so cross-chapter ranges like `Matthew 27:64-28:10` work — `parseRef` can't parse those; other translations = `getBibleAPI`). `_btParseCitation` / `_btParseSection` are pure helpers (unit-tested against all 194,064 dataset citations, 0 unparsed). All state is in memory only — **no new stored keys, no ar.deep/sync/backup change.**

## Findings worth keeping
- Providers do NOT batch (one ref string per call; Bolls re-downloads the whole chapter every call, uncached in `getBollsBible`). Bible Tools caches chapters itself; the shared fetch path is untouched.
- Crossrefs data: 66 files, max **8** refs per verse (spec said ~25), 340 cross-chapter ranges, ~46k same-chapter ranges.
- Sandbox shell cannot reach archestudytools.com; poll deploy via the browser (`fetch('/pilgrim-private/index.html?cb=…')`). GitHub Pages lagged ~2–3 min after push.
- The built-in browser was already past the PIN gate (no PIN needed).
- Cache-buster convention: all `?v=` in app.js/index.html/modules bumped to the new version each release (utils.js's own `?v=4.30.0` is a stale string, harmless).

## Verify first (next chat, ~2 min)
1. Hard-refresh → header shows v4.41.0.
2. Study Tools tab: Cross-References button gone; Study Snapshot subtitle lists Word Study · Language & Structure · Places & Geography + Historical · Cultural; snapshot runs 5 rows.
3. Open a study → Scripture panel → **Bible Tools** button works (Study entry point, untested).
4. An old study that had a saved AI Cross-References result still exports it.

## Next: Release 2 — Translation Comparison (spec §4)
One verse, stacked rows, one per translation Pilgrim already loads (ESV, KJV, ASV, WEB, YLT, Darby via bible-api.com; NKJV, NET, AMP, CSB, NLT, MSG, NASB, NIV via Bolls). No AI, no new data, no new stored settings. Add as a second row in the existing sheet (`_btRender`) — Bible Tools is verse-scoped, so the row needs a verse picker or should act on the tapped verse. Reuse `_btBollsChapter` cache (it is why 8 Bolls translations for one verse = 8 chapter fetches, cached). Open questions for Boss: which verse does the row act on when opened from Study (whole passage list vs picker); whether to retire nothing (there is no AI equivalent to retire).
Release 3 (Interlinear) after that; Hebrew morph coverage still open.

## Still open
- Attribution section in Settings (MACULA, OpenScriptures, OpenBible.info) — licenses unconfirmed, not built.
- Fate of AI Word Study commentary; Language & Structure retirement waits for Interlinear.
- `/groq` lockdown lifts only after AI tools are retired/grounded.
- Spec §9 checklist: verse-text batching → RESOLVED (no batching; per-tap load + chapter cache); AI Cross-References retirement → CONFIRMED by Boss Sep 28.
