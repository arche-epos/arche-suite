# Session Handoff — Sep 29, 2026 — Bible Tools Release 3 (Interlinear) shipped

**Read order for next chat:** SESSION-BOOT.md → this file → ways-of-working.md → the spec for whatever is active (`claude/spec-background-audio-v1.md` is next). MKB only if needed.

## State
- Live: **pilgrim-private v4.43.1** (commit `7e38da9` on `arche-epos/arche-suite` main). v4.43.0 = `fa7da58` (the Interlinear feature). v4.42.2 = `939d148`.
- Verified at session start: repo HEAD and live site were both v4.42.2, and the hot-patch code (`_ttsErrRun`, `ttsSyncAfterResume`) was present in the live `tts.js`. **Still pending (Boss): phone test of the v4.42.2 hot patch** (read a chapter, leave the app, come back: Resume on the same verse, never a chapter jump).
- v4.43.x is changelog-labelled "Latest — untested": live-tested in the built-in browser at a 375px mobile viewport, **not yet on Boss's phone.**
- GitHub Pages deploy lag was ~8 minutes this time (not 3-5).

## What shipped
**v4.43.0** — Interlinear row in the Bible Tools sheet (below Translation Comparison; tool key `'ilx'`). One verse, one row per word. Layout chosen by Boss: two-line row, same for Greek and Hebrew. Line 1: original word (large; `dir=rtl` inside its own span for Hebrew/Aramaic) + English meaning right-aligned. Line 2: dictionary form · transliteration · Strong's number · plain-English parsing chip. Tap a row → dictionary card inline. Words with no Strong's number show but are not tappable (Boss's choice). No AI call. **No new stored setting** (no Data Safety Warning needed).
- **New file `pilgrim-private/morph.js`** (pure, no imports): `decodeMorph(tag,isOT)` → `{chip,unknown}` and `shortGloss(strongsDef)`. Verified against **every distinct tag in all 66 book files (4,507 tags, 443,247 words): 0 unrecognised codes.** Anything unknown would print as `[code]` in the chip, never silently dropped.
- **New test `pilgrim-private/tests/morph.test.js`** (`node tests/morph.test.js` from `pilgrim-private/`; 27 checks incl. the full-data coverage sweep).
- Dictionary card extracted from `buildLexicalFactsHtml` into shared `_dictCardBodyHtml(e)` (studyTools.js). Word Study panel output unchanged.
- Verse picker shared with Translation Comparison (`x.cmpSel`, `btCmpPick`): picking a verse in one tool moves the other. From Study it opens on the passage's first verse; from Read on the tapped verse.
- `docs/pilgrim-guide-app-help-reference.md` updated (Read and Study sections).
**v4.43.1** — gloss fix. Strong's opens many entries with "properly, ..."; the direct-object marker (10,977 OT words) and "all" (5,414) showed just "properly". `shortGloss` now drops leading filler and skips usage notes when a real clause follows. Weak-looking OT glosses fell from 17% to 1.7% of words (frequency-weighted).

## Data findings (all verified against the files in the repo, not assumed)
- **OT data is OSHB, not MACULA** (data/README.md). OSHB has **no English gloss** (305,506/305,506 empty) and its `lemma` field is a **number code** (`b/7225`, `1254 a`), not Hebrew text. Hebrew lemma, transliteration and meaning therefore come from `data/strongs/hebrew.json` via the Strong's number.
- **Boss chose the Hebrew gloss = short Strong's definition (first clause).** Strong's KJV-rendering lists are **alphabetical**, so "first KJV rendering" was rejected (would show "choose" for bara, "angels" for Elohim). Caveat: Strong's definitions are sometimes root senses, not usual translations (e.g. אֵת "self", עוֹלָם "concealed", לַמְנַצֵּחַ "to glitter from afar").
- 6,766 Hebrew words have no Strong's number (mostly prefix+pronoun forms like בּוֹ, לָהֶם, plus 461 bare `HNp` names). 830 Greek words have no MACULA gloss (fall back to the short Strong's definition; 20 Greek entries have no definition at all, so a blank gloss is possible).
- Transliteration shown is the **dictionary form's** (Strong's), not the inflected word's.
- Hebrew tags: `H`/`A` language letter + segments joined by `/` (prefix parts, word, suffix). 1,212 distinct segments, ~17 decode rules. **A letter's meaning depends on position** (`c` = common gender OR construct state), so decoding is by position (`_hFields`). Aramaic (4,828 words) has its own stem table.
- Greek tags: Robinson-style. Trailing flags confirmed against real words: `-C` comparative, `-S` superlative, `-N` negative, `-I` interrogative, `-ATT` Attic, `-K` crasis. One real tag has a trailing dash (`P-AP-`), handled.
- **OT verse numbering follows the Hebrew text** (Ps 51 has 21 verses; English has 19; Joel has 4 chapters; Malachi 3 vs English 4; Gen 31 has 54 verses vs English 55). Confirmed live: English Psalm 51:1 ("Have mercy") shows the Hebrew *title* words. Mitigation shipped: a visible note on OT verses. **Not fixed** (see open items).

## Live test results (built-in browser, 375px mobile viewport, v4.43.0 then v4.43.1)
- Study entry, John 1:1: 3 tools listed; Interlinear rows load with real data; card opens from a row (chevron and `aria-expanded` update).
- OT: Genesis 1:1 (7 rows, RTL, Strong's glosses, chips), Genesis 1:11 (no-Strong's row `ב֖וֹ` present and disabled), picker with 31 verses.
- Read entry, Psalm 51: Bible Tools button disabled until the verse number was tapped; opened on 51:1; picker showed 19 English verses; OT note visible; no horizontal scroll.
- Two console 404s appear on every fresh load with nothing opened (pre-existing; likely the `arche-proxy.../track` beacon). Not from Interlinear (`morph.js` returns 200).
- First Interlinear open on a book downloads the book file (~1 MB for Genesis) plus the Strong's dictionary (~2 MB Hebrew); the "Loading words…" spinner covers a few seconds.

## Testing recipes that worked
- Verse selection in Read: tap the superscript `.vnum` (`document.querySelector('#read-v-0 .vnum').click()`); clicking the verse span does nothing. Reference box is `#read-ref`.
- Study entry: open a saved study card, then the "Bible Tools" button. Sheet body is `#bt-body`; Interlinear rows are `#bt-il-rows .bt-ilr`.
- Screenshots time out when the Claude window is hidden; use `javascript_exec` to read the DOM instead.
- Sandbox shell cannot reach archestudytools.com or jsDelivr; the data files are in the local clone (`data/macula`, `data/strongs`) so decode audits run offline.

## Open items / decisions for Boss
1. **OT verse numbering (real accuracy gap).** Options: (a) leave the note; (b) add a small English-to-Hebrew verse map for the ~60 Psalms with titles plus Joel, Malachi, Genesis 31-32 and a few others so English verse numbers land on the right words. Recommend (b) as its own small release.
2. **Retire AI Language & Structure?** Spec §6 says it waits for Interlinear, and §9 says confirm retirement at each release. Not done (Release 3 scope was Interlinear only). `/groq` lockdown still waits on the AI tools being retired or grounded.
3. **Attribution section in Settings** (MACULA CC BY 4.0, OpenScriptures OSHB, Strong's CC BY-SA / public domain, OpenBible.info CC BY): still not built. Interlinear now displays MACULA and OSHB data, so this is more pressing. License table is in `data/README.md`; confirm wording.
4. Fate of AI Word Study commentary (still undecided).
5. Possible polish: gloss for a few very common function words is descriptive rather than a translation (e.g. כִּי shows "very widely used as a relative conjunction or adverb").

## Next
- **Background audio** (`claude/spec-background-audio-v1.md`) is next per Boss. Do not start it before deciding item 1-3 priorities with Boss.
