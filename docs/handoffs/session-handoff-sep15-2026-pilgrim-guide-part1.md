# Session Handoff — Pilgrim Guide Spec (Conversational Philosophy) Part 1 — September 15, 2026

**First thing next session:** Push the finalized ambiguity-handling addendum (below) into the
real `docs/pilgrim-guide-app-help-reference.md` on `arche-epos/arche-suite` main, as a proper
delivery — version bump, changelog, commit message, byte-verified — per project SOP. It has NOT
been pushed yet; everything this session lives only in a throwaway test-harness artifact.

---

## Correction from earlier in this session — read this first

Early in this chat I pulled the wrong GitHub repo (`Gizmo5332/JC-Study-Tool`, from a stale
account-level memory file) instead of `arche-epos/arche-suite`, which is the actual, current repo
and was already correctly listed in this project's own `ways-of-working.md`. This led to briefly
believing Pilgrim Guide was entirely unbuilt ("coming soon" placeholder in the stale repo).
**Reality: Pilgrim Guide is live in production** — `_pgRunTurn()` in `pilgrim-private/ui.js` —
with App Help and Scripture Finder modes shipping since Sep 7-8. Only Word Study is genuinely
unbuilt (confirmed via a hardcoded build-status note in the live code).

I've corrected this project's memory (`/areas/arche-study-tools.md` in this project's subtree,
and a new entry in `learnings.md`) so a future session pulling from this project's memory gets it
right. **The account-level `/areas/arche-study-tools.md` file itself is still stale** — I can't
edit it from a project-bound session; if you want it corrected at the source, that needs a
non-project chat.

---

## What the real Pilgrim Guide system actually is (corrects the spec's/my own assumptions)

- No standalone "philosophy" system prompt exists. The entire system prompt is
  `docs/pilgrim-guide-app-help-reference.md` (v3), fetched live from GitHub raw at runtime, plus
  one hardcoded Word Study status note appended in `ui.js`.
- Envelope shape already in production: `{"mode":"app_help|scripture_finder|word_study|out_of_scope","reply":"...","candidates":[...]}`.
  **No new envelope/mode is needed for Part 1** — my originally-drafted `ask_back` mode was
  unnecessary. The client already pushes any `reply` (question or answer) as a chat message and
  resends full history every turn, so "ask, then answer next turn" already works today with zero
  client-side changes, for every mode.
- Scripture Finder already has clarifying-question behavior built into the v3 doc (empty
  `candidates` + a question in `reply`). App Help and Word Study do not yet.
- **Real doc gap found (separate from Part 1, not yet actioned):** the live reference doc never
  documents an "Export Study to PDF" path — only the JSON `Export / Backup` path — even though
  the app itself has both. Worth a doc update at some point, independent of this work.

---

## Part 1 — Ambiguity-handling addendum (drafted, tested, NOT yet shipped)

Tested via an interactive artifact (Claude via the `sample` capability, not the production
`gpt-oss-120b-Turbo` model — a real caveat, see below) against the actual live reference doc.
Six test cases, all passing after one fix:

| Test | Mode | Result |
|---|---|---|
| "How do I back up my studies" (real ambiguity: cloud sync vs. export file) | app_help | ✅ clarifies (after fix — see below) |
| "How do I change my Bible translation" (unambiguous control) | app_help | ✅ answers directly |
| "Where was the flood of Noah" (unambiguous) | scripture_finder | ✅ returns candidates |
| "That verse about strength" (genuinely ambiguous) | scripture_finder | ✅ clarifies |
| "Where does it say God helps those who help themselves" (false premise — not in the Bible) | scripture_finder | ✅ flags it, asks for the real intent |
| "What's the Greek behind 'love'" (regression check) | word_study | ✅ still declines — build-status gate unaffected |

**One real bug found and fixed:** the first pass of "back up my studies" answered directly
(picked cloud sync) instead of clarifying, even though the doc has two genuinely separate backup
mechanisms. Root cause: the model was pattern-matching to whichever Quick Reference entry shared
the most literal wording with the question, rather than checking whether multiple entries could
plausibly apply. Fixed by adding an explicit instruction to scan the *entire* Quick Reference for
all plausible matches before answering, specifically for App Help. Retested clean after the fix.

### Final addendum text (paste-ready for the real doc)

Insert into `docs/pilgrim-guide-app-help-reference.md`, in the "How to use this document" section,
after the "Signal to lean on..." paragraph and before the "A follow-up message may ask..."
paragraph:

```
If a request could reasonably be satisfied by more than one distinct answer —
two different app features that could each be "the" answer, more than one
specific word/verse/passage it could point to, or genuinely unclear scope —
ask ONE brief clarifying question via reply (empty candidates, for
scripture_finder) rather than guessing. This applies to app_help and
word_study exactly the same way it already applies to scripture_finder.

For app_help specifically: before answering, scan the ENTIRE Quick Reference
for every entry that could plausibly satisfy the request — not just the
entry with the closest wording match. Two entries often share vocabulary
(e.g. both "back up my studies" and "export a backup file" use the word
"backup") while pointing to genuinely different features. If more than one
entry plausibly fits, that is ambiguous — ask which one, don't default to
whichever entry's wording happens to overlap most with the user's phrasing.

Do NOT ask when there's a single clear reading, even if loosely phrased —
an unnecessary question is worse than a terse answer.

If the request rests on a false premise — e.g. it names a passage, word, or
detail that doesn't actually exist or doesn't appear where the user thinks —
say plainly what you found (or didn't find) and ask them to clarify, using
the same mechanism as any other ambiguous case. Never guess an answer to a
premise you can see is wrong.
```

### Caveat that still applies
All testing above used Claude (via the artifact `sample` capability), not the production
`openai/gpt-oss-120b-Turbo` model that `_pgRunTurn()` actually calls. This validates the *logic*
of the addendum (does the instruction reliably produce the right ambiguity behavior for an
independent LLM), not guaranteed identical wording/behavior on the real production model. Genuine
validation happens once this is live and gets real usage, or via a manual test against the
`/groq` worker endpoint directly if you want that before shipping.

### Test artifact
Interactive test harness (not a deliverable, just scratch tooling for this session):
https://claude.ai/artifact/5pENj6oLWzYKfgJXMA18AY

---

## Not yet touched this session

- **Word Study stub build** — still fully unbuilt. Per the spec, this only requires wiring the
  existing Lexicon modal (`runLexiconLookup()` in `studyTools.js`) with a two-call
  classify-then-candidates flow — does NOT require the Pilgrim Guide chat UI at all, since Word
  Study's sole entry point is the Lexicon modal, unchanged UI. Agreed approach going in (not yet
  built):
  1. Cheap classify call: is the input unambiguous (Strong's number, exact transliteration,
     specific original-language word) or ambiguous (bare English word, multiple possible
     originals)?
  2. Unambiguous → today's single full-lookup path, unchanged.
  3. Ambiguous → second call generates 3-5 candidate senses with one-line differentiators →
     render as buttons/rows in the existing result area (reusing existing `.btn.btn-ghost` /
     `.lex-kjv-pill` visual language, not a new UI element) → user picks → full lookup runs by
     Strong's number.
  - Real code found: `openLexiconModal()`/`runLexiconLookup()` at `studyTools.js` — confirmed the
    Lexicon field is a bare free-text input with **no verse/passage context required**, which is
    what makes English-word sense ambiguity ("love" → agapē/phileō/eros/storgē) a real, common
    case, not an edge case.
  - This is real production code — flagged as a "large build" per Boss's standing preference,
    better scheduled for weekday-after-2pm or weekend.
- **Part 2 (AI Tools mode)** — not started, per the spec's own sequencing (Part 1 first).

## Outstanding / open items for next session
1. Ship the Part 1 addendum for real (see "First thing next session" above).
2. Decide whether to validate against the real `/groq` worker before or after shipping, given the
   Claude-vs-production-model caveat.
3. Word Study stub build (scoped above, not started).
4. Minor, non-blocking: the live reference doc doesn't document PDF export at all — separate doc
   fix, unrelated to Part 1.
5. The account-level `/areas/arche-study-tools.md` memory file is still stale outside this
   project's subtree — fix from a non-project chat if desired.
