# Session Handoff — Sep 21, 2026 — Scripture Memory Stage 2 build + Pilgrim Guide fix

**This is now the most recent dated session-handoff-*.md.** Read this before
`session-handoff-sep21-2026-scripture-memory-stage2-spec.md` (that one is the
spec Boss confirmed at the *start* of this session — still accurate as a design
record, but everything in it is now built and shipped).

---

## 1. What shipped this session (chronological)

All four deploys went through the full Git Data API flow (blob → tree → commit
→ ref) with a fresh-HEAD check before each tree build and a mandatory
post-push fetch-and-diff verification after each ref update. All passed clean.
**None of this has been device-tested yet** — see Section 3.

| Version | Commit SHA | Parent | What |
|---|---|---|---|
| 4.37.0 | `bfce360b6a1110b6513c7ca78a5b017279b909d2` | `5f1fbb6` | Scripture Memory Stage 2: spaced-recall quizzes (Test Me / Practice All), per spec-scripture-memory-stage2-v1.md |
| 4.37.1 | `4eb938dfdc578cd81145a9e87d0a467b86b06604` | `bfce360` | Fix: Pilgrim Guide falsely said an already-shown verse "didn't check out" |
| 4.37.2 | `7a3f3da04cb8c924ff3989ac555b683fb4973de4` | `4eb938d` | Hide Passage / Hide All toggle in the quiz UI |
| 4.37.3 | `7725e53d636144c0f419656df6c21327e973cb53` | `7a3f3da` | Add-a-Verse form auto-pulls scripture text from the reference |

Current `main` HEAD: **`7725e53`**. Local clone in this environment was reset
to match after each push; a fresh session should re-clone or re-verify HEAD
before touching anything.

### 4.37.0 — Scripture Memory Stage 2 (the big one)
Full spec: `spec-scripture-memory-stage2-v1.md` (already in Project
Knowledge). All 5 open decisions from the Sep 21 spec session were confirmed
by Boss before any code:
1. 5-level cue-removal ladder (L0 full text → L4 free recall) — kept as drafted.
2. Interval ladder 1/2/4/7/14/30/60 days, hold-twice-then-drop rule confirmed.
3. Practice All: logged, never touches the schedule.
4. Long passages: chunked ~4 verses per chunk (`MEM_CHUNK_SIZE`), each chunk
   independently scheduled.
5. Quiz UI: full-screen overlay from the Memory tab.

**memory-core.js** (pure logic, no DOM/localStorage) gained: `MEM_CHUNK_SIZE`,
`MEM_INTERVAL_LADDER`, `MEM_LEVEL_MAX` constants; `memParseVerseTexts` /
`memMakeChunks` / `memNormalizeChunk` (chunking); `memGradeAttempt` (LCS-based
word-diff grading); `memNextChunkState` / `memLogPracticeAttempt` (scheduling);
`memGetDueChunks` / `memGetAllChunks`; `memBuildBlankedText`;
`memMergeChunkArrays` wired into `memMerge` so two devices reviewing different
chunks before syncing no longer clobber each other.

**Implementation additions beyond the spec's literal chunk shape** (disclosed
to Boss at the time, not scope creep — necessary plumbing):
- `chunk.text` — each chunk's own text slice (needed to quiz it independently).
- `chunk.updatedAt` — needed for the per-chunk merge rule.
- `chunk.holdCount` — internal counter behind the hold-twice-then-drop rule.

**memory.js** gained the quiz session state machine (`memOpenQuiz`,
`_memRenderQuizStep`, `memSubmitQuizAnswer`, `memAdvanceQuiz`, `memFinishQuiz`,
`memCloseQuiz`) and a due-count badge on the Memory tab.

**Migration:** a Stage 1 item with no `chunks` gets them built on load
(`memNormalizeStore`). If it splits into exactly 1 chunk, that chunk seeds
from the item's existing flat `level`/`interval`/`reviewHistory` (no progress
lost). If it splits into >1 chunk, each starts fresh — a single flat history
can't be honestly divided across chunks.

**Tests:** `tests/memory-core.test.js` extended from 35 → 77 passing (chunking,
grading, interval transitions incl. hold-twice, level bounds, due-selection,
per-chunk and full-store merge).

### 4.37.1 — Pilgrim Guide bug fix
**Root cause found:** `_pgShownRefs` (ui.js) excluded any candidate reference
already shown *on every turn*, not just on "Deeper Dive." Once a reference had
been shown once, asking about it again in a normal typed message got silently
filtered to zero results, then mis-reported as "None of those references
checked out against the real text" — copy meant for genuine verification
failures. Live repro: Boss asked to see 1 John 5:21 again (already shown via
an earlier Deeper Dive tap) and got two consecutive false negatives.

**Fix:** `_pgVerifyCandidates(candidates, excludeShown)` only applies the
`_pgShownRefs` exclusion when `excludeShown` is true. Only `_pgDeeperDive`
passes `true`. An ordinary typed turn never suppresses a reference just
because it was shown earlier — the user naming/re-asking about it is
deliberate. Added `allAlreadyShown` to the verify result so the empty-results
fallback can show honest copy ("already shown above") instead of the generic
failure message when that's actually why nothing came back.

**Known related gap, NOT fixed, logged for backlog:** asking for a specific
translation by name in a Pilgrim Guide message (e.g. "in the NLT") does
nothing — `_pgVerifyCandidates` always fetches in `sett.defaultTrans`
regardless of what the user names. "Search All Translations" is a partial
workaround but only covers KJV/NASB/NIV/ESV, no NLT.

### 4.37.2 — Hide Passage / Hide All
Per-verse "Hide Passage"/"Show Passage" button under the quiz prompt box
(resets to visible at the start of each new verse, unless Hide All is on, in
which case it resets to hidden). "Hide All" checkbox in the quiz header
applies to the whole session; not persisted, resets off every time a new
Test Me/Practice All session opens. Implementation split
`_memRenderQuizPromptBox()` out of `_memRenderQuizStep()` so toggling
visibility never wipes an in-progress typed answer in the textarea.

### 4.37.3 — Add-a-Verse auto-fetch
New `memAutoFetchVerseText()` **lives in ui.js, not memory.js** — memory.js is
deliberately kept free of the scripture-fetch dependency chain so
sync.js/studyTools.js can import it without a cycle (see memory.js's own
header comment). Fetch-on-blur on the Reference field (Enter blurs), re-fetch
on Version dropdown change — same pattern as the Read tab's
`fetchReadChapter`. Routes through `getESV`/`getBibleAPI` +
`parseVerseChunks` + `memJoinVerses`, the same pipeline
Save-to-Memory-from-Read/Study already uses. **Overwrites** the Verse Text
box on each successful fetch (matches Read tab behavior) — a failed lookup
leaves the box empty with a toast, never keeps stale text silently.

---

## 2. Correction to a mistake made mid-session

I told Boss I couldn't mark `verse-memory-spec-v1.md` superseded because I
"can't edit Project Knowledge files." **That conflated two different things.**
`verse-memory-spec-v1.md` lives in the repo at `docs/verse-memory-spec-v1.md`
— it is NOT in this Claude Project's Project Knowledge at all (only
`spec-scripture-memory-stage2-v1.md`, the Stage 2 spec, is). The repo copy is
fully writable via the same Git Data API flow used for every other file this
session.

**Next session should just do this** — small, low-risk, no Data Safety
Warning needed (it's a doc, not app data/logic): fetch
`docs/verse-memory-spec-v1.md`, prepend a short "SUPERSEDED —
see spec-scripture-memory-stage2-v1.md" banner (or replace its content
entirely with a pointer, Boss's call), and push as its own tiny commit.

---

## 3. Outstanding — device testing (nothing below has been tested on a real device)

- **Stage 1 Memory tab** (v4.36.0/4.36.1) — Boss confirmed tested and working
  on mobile, Chromebook, and laptop earlier this session. This is the one
  clean bill of health in the whole Memory feature.
- **Stage 2 quiz flow (4.37.0–4.37.3, all of it)** — zero device testing.
  This is the highest-risk untested surface: full-screen overlay, grading,
  chunk migration of existing Stage 1 verses, Hide Passage/Hide All, and the
  new auto-fetch on Add-a-Verse. Suggested pass, in order:
  1. Open Memory tab — does it still render correctly with the new
     Test Me/Practice All buttons and due banner?
  2. Add a verse manually — does the reference blur auto-pull the right text?
     Try changing the Version dropdown after.
  3. Tap Test Me / Practice All — does the quiz open, grade correctly, show
     an accurate diff?
  4. Toggle Hide Passage on a verse mid-typing — does the typed text survive?
  5. Toggle Hide All — does every subsequent verse start hidden?
  6. Check that an existing Stage 1 verse's progress wasn't reset by the
     chunk migration (if any pre-4.36.0 verses with real review history
     exist on the test account).
- **Pilgrim Guide fix (4.37.1)** — reproduce the original bug: get a Deeper
  Dive result, then type that same reference back in as a normal message.
  Should now show it instead of erroring.

## 4. Not done this session (from the original spec handoff, still open)
- NLT gap in Pilgrim Guide (see 4.37.1 section above) — not scheduled, just logged.
- Real push notifications for due verses — explicitly out of scope for Stage 2
  (Phase B, separate future project; Pilgrim has no push infra currently).

## 5. Session mechanics note
Every deploy this session bumped `?v=` cache-busting query strings across
*all* module files + index.html, even files with zero logic changes — this
matches established convention in this repo's git history (confirmed against
prior commits, e.g. `c92e31f`), not a one-off decision. Keep doing this on
every future patch for consistency.
