# Session Handoff — Sep 21, 2026 — Scripture Memory: Stage 1 shipped, Stage 2 spec drafted

**Read first next session:** SESSION-BOOT.md, MKB Part 1, this file, `verse-memory-spec-v1.md` (older; see "Conflicts" below).

## 1. State of play
- **Pilgrim Private v4.36.1 is live on `arche-suite` `main`**, commit `5f1fbb6` (v4.36.0 was `58c295f`). Pushed by Claude with the Dev PAT via Git Data API; all files verified against remote.
- **NOT device-tested.** Boss was driving. Pending device checks:
  1. Type `John 3:16-18` in Read, load, tap **Save Passage to Memory** -> one Memory card with `[16] [17] [18]`.
  2. Type `John 3:16` -> separate single-verse card.
  3. Study Scripture panel **Save to Memory** works the same way.
  4. Manual add on Memory tab survives reload; duplicate save shows "already in Memory" toast.
  5. Backup on device A, restore on device B -> Memory appears.
  6. Remove on A, sync -> stays gone on B (tombstones).
- Tests: `node tests/memory-core.test.js` (35 pass), `node tests/bridge-check.js` clean, `node --check` clean. Playwright smoke NOT run (no browser in Claude env).

## 2. What Stage 1 built (for reference)
- Library has 3 tabs: Studies / Words / **Memory**.
- Store: per-user localStorage key `bsn_memverses_<userId>` = `{items:[], deleted:[{id,at}]}`.
- Item: `{id, reference, translation, text, source('read'|'study'|'manual'), createdAt, updatedAt, interval:0, easeFactor:2.5, nextReviewDate:null, reviewHistory:[]}` (last four inert until Stage 2).
- Save entry points save the **whole reference box as ONE item**: range = whole range, single verse = that verse, bare chapter = whole chapter. Multi-verse text keeps `[n]` numbers; single verse is plain text. (Boss decision Sep 21.)
- Synced in Gist push/pull/force-restore (tombstone-aware merge) and in JSON export/import (full export only).
- Files: `memory.js` (store + UI), `memory-core.js` (pure logic, node-testable), tests in `tests/`.
- Dedupe key = normalized reference + translation. `John 3:16-18` and `John 3:16` are separate items by design.

## 3. Research summary (verified sources; details in chat)
- Practice testing + distributed practice = the two high-utility techniques (Dunlosky et al. 2013, PSPI). Rereading/highlighting/summarizing = low utility.
- Testing beats restudy (Karpicke & Roediger 2008, Science); caveat: with spacing controlled both help (Soderstrom, Kerr & Bjork). Meta-analyses: testing effect g ~0.50-0.61 (Rowland 2014; Adesope 2017); recall tests beat recognition tests.
- Spacing: optimal gap grows with the retention interval (Cepeda et al. 2006, 839 assessments/317 experiments).
- Reading aloud helps memory (production effect, MacLeod 2010/2017); modest when everything is aloud (Fawcett 2013 meta, g~0.37). Writing/typing/mouthing also help but usually less than aloud.
- **Diminishing cues** (start with more cues, remove across trials) gave best final recall vs accumulating cues (Finley et al. 2011, JML); works where plain testing doesn't (Fiechter & Benjamin 2017). Caveat: word pairs/letter cues, not verses. Classic "vanishing cues" in memory-impaired patients: small, nonsignificant meta-analytic effect.
- Flashcards: one big stack > small stacks; spacing > cramming (Kornell 2009). Students use them heavily but mostly to *monitor* learning and drop cards after one correct recall (Wissman, Rawson & Pyc 2012). No research found on people "hating" them.
- Ebbinghaus forgetting curve: replicated (Murre & Dros 2015, single subject, nonsense syllables; small bump near 24h). Applies to meaningless material; meaningful material decays slower. Modern work refines it (how to flatten it), doesn't contradict it. Do NOT put numbers like "50% in 24h" in app copy.
- **No rigorous scripture-specific studies found.** Scripture-app claims borrow general research; some cite unsourced stats.
- Web Speech API support is uneven (Chromium yes, Safari via prefix, Firefox flagged off) — relevant only if voice input is added later.

## 4. Stage 2 spec — DRAFT (Boss decisions marked BOSS; my proposals marked PROPOSED, need confirmation)

### 4.1 Model
Each memory item has two dials:
- **Interval / `nextReviewDate`** — when it is next due.
- **Level** — how much of the verse is hidden in the quiz (cue removal ladder).

### 4.2 Grading — BOSS
Recall is **typed from memory**; the app compares **word-for-word** and computes % correct.
- PROPOSED matching rules: case-insensitive; ignore punctuation and `[n]` verse markers; compare as a word sequence (longest-common-subsequence, so one missed word does not zero the rest). % = matched words / total words in the stored text.
- PROPOSED: show the diff after grading (missed words highlighted) so the attempt doubles as feedback/restudy.

### 4.3 Interval rules — BOSS (with proposed edge handling)
- **100% correct** -> extend interval one step; level steps up.
- **>50% and <100%** -> hold the same interval; level holds. (BOSS: ">50% hold")
- **<50%** -> shorten the interval; level steps down. (BOSS: "<50% shorten")
- PROPOSED: exactly 50% counts as hold. 0% / blank -> drop to the first (1-day) step.
- PROPOSED interval ladder (days): 1, 2, 4, 7, 14, 30, 60. Tunable constants in one place. New verses start at step 1 (**daily at the start — BOSS**). Not a proven schedule; based on the spacing research (expanding gaps).

### 4.4 Level ladder — PROPOSED (needs Boss sign-off)
Diminishing-cues design: L0 full text visible (read aloud, then type it) -> L1 ~25% words blanked -> L2 ~50% -> L3 ~75% / first letters only -> L4 no cue (free recall). Blanked words chosen randomly, re-randomized each quiz. Every verse's mastered state = passes at L4. Ends every session at the hardest level the verse has earned.

### 4.5 "Test Me" — BOSS
A button on the Memory tab. Pulls the **due** verses in **random order**; for each, uses that verse's stored level. Per-verse state (interval, level, history) persists — "it maintains a memory of each scripture and the interval."
- OPEN: also offer "Practice all" (not just due)? If yes, does extra practice change the schedule? (PROPOSED: practice outside the due window is logged but does not move the interval.)

### 4.5b Reminder — BOSS: "Both, badge first"
- **Phase A (Stage 2):** in-app "N due" badge on the Memory tab / Library and a banner on open.
- **Phase B (later, separate project):** real push notifications. Caveat: web push needs a service worker + subscription + a server to send; Pilgrim currently clears its service worker on version change (app.js) and has no push infra. Do not promise this in Stage 2.

### 4.6 Data model change (needs Data Safety Warning before any code)
- New field on items: `level` (integer, default 0). Additive; `memNormalizeStore` must default it; `memMerge` already preserves unknown fields. Uses existing `interval`, `nextReviewDate`, `reviewHistory` (entries e.g. `{at, pct, level, intervalBefore, intervalAfter}`).
- Sync: merge rule for the same id currently = newer `updatedAt` wins. Reviewing on two devices between syncs would lose one device's review. PROPOSED: acceptable for now (documented); revisit by merging `reviewHistory` union.
- Old app versions ignore/preserve `level` (unknown-field preservation is already in memory-core).
- Bump: minor (4.37.0). Tests: extend `tests/memory-core.test.js` for grading %, interval transitions, ladder bounds, due-selection, LCS edge cases.

### 4.7 Explicitly out of scope for Stage 2
Voice input/AI transcription check (deferred; if added later: deterministic text compare of transcript vs stored verse, NOT an LLM judge — LLM may be lenient, costs tokens, and speech-to-text itself can silently "correct" words), real push notifications, memory palaces/mnemonics, whole-passage chunking within a long passage.

## 5. Open decisions for Boss
1. Confirm the level ladder in 4.4 (5 levels, percentages).
2. Confirm interval ladder in 4.3 and 0% -> back to step 1.
3. "Practice all" mode? Does it affect the schedule?
4. Long passages (e.g. a 10-verse range saved as ONE item): quiz the whole thing at once, or allow chunking? (Current Stage 1 saves them as one item, so a bare chapter could be 30+ verses.)
5. Where does the quiz UI live — full-screen overlay from the Memory tab (PROPOSED) vs. its own nav item?

## 6. Conflicts / doc hygiene
- `verse-memory-spec-v1.md` (older) puts memory UI in the **Progress tab** and names the key `_pilgrim_memory_verses`. Superseded by what shipped: **Library > Memory tab**, key `bsn_memverses_<userId>`. Update or supersede that spec; don't let a future session build from the old one.
- Update MKB Part 1 / README module lists: new modules `memory.js`, `memory-core.js`; bridge-check now includes `memory.js`.
- Existing 4.36.0 changelog wording (tap a verse then Save) is superseded by 4.36.1's entry; history is fine as is.

## 7. Process notes
- Direct-to-main push by Claude was confirmed by Boss this session ("Deploy with the Pat on file").
- Working clone was reset to `origin/main` (`5f1fbb6`) mid-session after the first push; it matches deployed code.
- Chat space at handoff: ~82% (🔴). Handoff generated per the 85% rule, slightly early, to capture decisions.
