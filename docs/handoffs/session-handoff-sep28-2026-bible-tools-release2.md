# Session Handoff — Sep 28, 2026 — Bible Tools Release 2 (Translation Comparison) shipped

**Read order for next chat:** SESSION-BOOT.md → this file → ways-of-working.md → `claude/spec-bible-tools-v1.md` (§5 Release 3). MKB only if needed.

## State
- Live: **pilgrim-private v4.42.2** (commit `939d148` on `arche-epos/arche-suite` main; pushed Sep 29, NOT yet live-verified — confirm the live version via the browser before bumping). v4.42.1 = `acbaf1c`, v4.42.0 = `75945fa`, v4.41.0 = `075c992`.
- **Pending phone test (Boss):** v4.42.2 hot patch — read a chapter on the Read tab, leave the app, come back: it should show Resume on the same verse and never jump chapters.
- Release 2 live-tested in the built-in browser (Study entry, NT + OT verses, picker, reorder + persistence across reload). **Sep 29 follow-up (v4.42.1, fresh load): Read-tab entry PASSED** (Romans 8, Bible Tools greyed until verse 28 tapped, picker defaulted to 8:28, 14/14 rows loaded, no failures).
- Verify-first results: v4.41.0 header OK; Cross-References AI button gone; Snapshot subtitle lists 5 tools; Study-screen Bible Tools button WORKS (opened on John 1:1, 8 refs). **Old-study export check PASSED (Sep 29):** "First Study" (saved AI cross-refs on Numbers 9:15 and 1 John 1:9) still lists Cross-References in the Export modal; saved data unchanged (3622 / 1691 chars). Only the modal was opened; no file generated. All four verify-first items are now closed.

## What shipped
**v4.42.0** — Translation Comparison row beneath Cross-References in the Bible Tools sheet (studyTools.js "SECTION 12b"). Verse picker (native `<select>`; starts on the tapped verse from Read, first verse from Study), 14 stacked rows in default order ESV, KJV, ASV, WEB, YLT, Darby, NKJV, NET, AMP, CSB, NLT, MSG, NASB, NIV. Auto-loads all 14. Tools are now an exclusive accordion (`x.tool` = 'xref' | 'cmp' | null; replaces `toolOpen`). **Reorder** button → ▲▼ per row, saved as **`sett.cmpOrder`** (array of codes) inside the existing `bsn_settings_v1[_userId]` object. Data Safety Warning issued and approved by Boss (option 1). Validated on load (unknown dropped, missing appended). Settings are NOT in sync.js → per device. CSB footnote markers stripped in Bolls text (`<sup>` removed; also affects R1 refs). Help reference updated.
**v4.42.1** — Bolls returned HTTP 429 when 8 fresh chapters fired at once (3 of 8 rows failed). `_btBollsGet` spaces requests ~300ms and retries 429 (up to 3, backoff). Verified: Romans 8 and Isaiah 53 loaded 14/14.

**v4.42.2 (hot patch, Sep 29)** — Boss reported Read tab jumping to later chapters (Mark 1 → 14, Amos 1 → 4 → Jonah 3) after leaving the app. Root cause (tts.js): `utt.onerror` treated any error, including the OS cutting off speech on backgrounding, as "verse finished", so the chain raced through the chapter and `readAutoAdvance()` fetched the next one, repeating. Fix: `interrupted`/`canceled` errors now pause in place (no advance); 3 consecutive other errors pause; a chapter that "ends" in <800ms cannot auto-advance (`_ttsPlayStart`, `_ttsLastStart`); new `ttsSyncAfterResume()` (exported, called from the `visibilitychange` handler in app.js) shows Resume on the verse left. Simulated in node (mocked speechSynthesis): interrupted → 0 advances/paused; synthesis-failed → paused after 3; instant-end → 0 advances; normal → exactly 1 auto-advance at real end. No stored data touched. Reading still STOPS when the app is backgrounded (platform limit).
**Background audio** — Boss wants reading to continue behind other apps; needs real audio + Media Session, not the built-in voice. Written up as `claude/spec-background-audio-v1.md` (options A provider audio / B cloud TTS via Worker / C native wrapper / D nothing). **Boss set Interlinear as the next priority; background audio comes after.**

## Findings worth keeping
- **YLT on bible-api.com is New Testament only** (404 for every OT verse). Row shows a notice for `sec.book<=39`, no fetch.
- bible-api.com rate limit ~15 calls / 30s per IP; one call per verse per translation (6/verse). `_btApiSlot` caps Bible Tools at 12 per rolling 31s; queued requests bail (`'stale'`) if the row/verse is gone. My own probing tripped the limit (fetch fails as "Failed to fetch", no CORS on 429).
- Bolls 429 on bursts (see 4.42.1). Bolls text includes `<sup>` footnote markers (CSB) and `<i>` (AMP); NASB Ps 23:1 includes the psalm title.
- Sandbox shell cannot reach bible-api.com / bolls.life / archestudytools.com (403 tunnel); probe from the built-in browser via `fetch`. GitHub Pages deploy lag ~3–5 min.
- Built-in browser session runs as profile "QA Test" (`bsn_settings_v1_QA Test`); test reorder was reverted (cmpOrder deleted).
- Cache-buster convention: all `?v=` in app.js/index.html/modules bumped each release (utils.js's own `?v=4.30.0` is stale, harmless).

## Still open
- Release 3 — Interlinear (spec §5); Hebrew morph coverage open.
- Attribution section in Settings (MACULA, OpenScriptures, OpenBible.info) — licenses unconfirmed, not built.
- Fate of AI Word Study commentary; Language & Structure retirement waits for Interlinear; `/groq` lockdown lifts after AI tools retired/grounded.
- Possible follow-up: "reset order" button for cmpOrder (not built; delete field to reset).
