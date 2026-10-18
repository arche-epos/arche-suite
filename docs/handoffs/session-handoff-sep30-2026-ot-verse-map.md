# Session Handoff — Sep 30, 2026 — OT verse map (v4.44.0 / v4.44.1) shipped

**Read order for next chat:** SESSION-BOOT.md → this file → `claude/session-handoff-sep29-2026-bible-tools-release3-interlinear.md` (Interlinear background) → ways-of-working.md → spec for the active item.

## State
- Live: **pilgrim-private v4.44.1** (commit `edfcc86` on `arche-epos/arche-suite` main). v4.44.0 = `848a07d` (verse map). v4.43.1 = `7e38da9`.
- Both releases live-tested in the built-in browser (v4.44.1 confirmed live before the final test). Changelog label is "Latest — untested" until Boss checks on his phone.
- **Still pending (Boss, phone):** v4.42.2 hot patch (leave the app mid-chapter, come back: Resume on the same verse, no chapter jump), and Interlinear on the phone.
- Pages deploy took about 5-8 minutes each push. Poll the live `utils.js` version through the browser instead of sleeping.

## What shipped
**v4.44.0** — Interlinear OT verse map. `data/macula/01-39` follows the Hebrew (WLC) verse numbers, but the picker holds English numbers, so English Psalm 51:1, Joel 2:28-32, Malachi 4 and Genesis 31:55 showed the wrong words. New `pilgrim-private/versemap.js` (6 KB, generated, do not hand-edit) exports `hebrewVerses(book, c, v)` → `{verses:[{c,v,title,partial}], differs}`.
- Source: `wlc/VerseMap.xml` in openscriptures/morphhb (WLC vs KJV, 1,978 pairs, 27 books). **License CC BY 4.0**, required wording: "Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb". Recorded in `data/README.md`.
- Generator: `data/build-versemap.py` (usage in its header; needs `VerseMap.xml` fetched from raw.githubusercontent.com, which the sandbox can reach; api.github.com and bolls.life are blocked from the shell).
- Rules: a mapped English verse → its Hebrew verse(s); an unmapped verse is identity. 70 "orphan" Hebrew verses (63 Psalm titles, plus Num 26:1, 1 Sam 20:42, 1 Kgs 18:33 / 20:2 / 22:22 / 22:43, 1 Chr 12:4) attach to the English verse with the same number. 6 half-shared Hebrew verses (1 Kgs 18:34, 20:3, 22:21, 22:44, Isa 63:19, Ps 13:6) are flagged partial.
- Display (Boss chose "group by Hebrew verse"): where numbering differs, rows sit under headings such as "Hebrew 51:1 · Psalm title", "Hebrew 51:2", "Hebrew 13:6 · shared with a neighbouring English verse", plus one short explanatory note. Matching verses look exactly as before. The old always-on OT note was removed.
- Tests: `node tests/versemap.test.js` (24 checks, incl. every mapped Hebrew verse exists in data/macula and a pair count of 1,978) and `node tests/morph.test.js` (27). Run from `pilgrim-private/`.
**v4.44.1** — half-shared verses whose Hebrew number equals the English number (Ps 13:6) were not getting a heading; `differs` is now also true for partial verses.
- Nothing stored, no Data Safety Warning needed. Help reference (`docs/pilgrim-guide-app-help-reference.md`) updated in v4.44.0.

## Live test results (v4.44.0 / v4.44.1)
Ps 51:1 → three headings (title, 51:2, 51:3), 19 words; Ps 51:2 → Hebrew 51:4; Joel 2:28 → Hebrew 3:1; Mal 4:1 → Hebrew 3:19; Gen 31:55 → Hebrew 32:1; Ps 13:1 → title + 13:2; Ps 13:5 and 13:6 → shared-verse heading (after 4.44.1); Gen 1:1 and John 1:1 unchanged with no headings; card still opens from a row in a grouped verse; no console errors, no horizontal scroll.

## Findings worth keeping
- Only the OT was checked. **NT versification was not audited** (SBLGNT vs English can differ in a few places, e.g. 3 John 14/15, Rev 12:17/18, 2 Cor 13:12/13, Acts 19:40/41). Unverified; candidate follow-up.
- **The Word Study facts panel and AI tools still slice `data/macula` by the English reference** (`buildLexicalGround` / `sliceBookData`), so OT passages such as Psalm 51:1-… or Joel 2:28-32 hit the same mismatch there. Not fixed. `hebrewVerses` could be reused.
- Translations that number Psalm titles as verse 1 (if any of the 14 do) would not line up with the KJV-based map. Not checked.
- The verse map does not affect Cross-References (OpenBible uses English numbering) or Translation Comparison.

## Approved by Boss, not yet built
1. **v4.44.2 / next: Attribution section in Settings.** Credit wording needed for MACULA Greek (CC BY 4.0), Open Scriptures Hebrew Bible incl. the verse map (CC BY 4.0, wording above), Strong's (CC BY-SA tagging / public domain), OpenBible.info (CC BY). Show Boss the wording before pushing.
2. **Then: retire AI Language & Structure** (Interlinear replaces it). **Touches saved studies and exports: issue the formal Data Safety Warning first and wait for confirmation.** Follow the v4.41.0 precedent for retiring AI Cross-References (saved output stays exportable).
3. **Background audio** (`claude/spec-background-audio-v1.md`) comes after those.
Still undecided: fate of AI Word Study commentary; `/groq` lockdown lifts only after the AI tools are retired or grounded.

## Testing recipes
- Call the app's own functions in the built-in browser: `openBibleTools('Psalm 51','esv','51:1',{c:51,nums:[1,2]})`, click the Interlinear tool, wait ~6 s, then read `#bt-il-rows` (`.bt-ilhd` headings, `.bt-ilr` rows). `btCmpPick('13:6')` changes the verse.
- Screenshots time out when the Claude window is hidden; read the DOM instead.
