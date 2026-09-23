# Session Handoff — Sep 23, 2026: AI Study Tools Fabrication — Lockdown + Grounding Spec

**Repo state at end of session:** `arche-epos/arche-suite`, `main` @ `00352d6`
**Session start point:** `main` @ `7725e53` (v4.37.3, Scripture Memory Stage 2)

---

## What happened this session

Started on a Scripture Memory edit-feature request (still pending — see "Not done" below), then
a bug report came in from Boss's own testing: **Pilgrim's AI Study Tools were fabricating Strong's
numbers, inventing Greek text presented as direct Scripture quotations, and citing unverifiable
named scholars** — a critical-trust issue discovered while prepping a real Thursday study.

### 1. Emergency containment (shipped, live)
- **Pilgrim Public** (`archestudytools.com/pilgrim-public/`) — the app was pulled entirely; the
  live page is now a static "temporarily offline" notice (Boss's contact message). No app code
  loads. Service worker cache bumped (`arche-pilgrim-v2-maintenance`) so returning visitors get
  the offline page, not a stale cached copy of the app.
- **Pilgrim Private** (v4.37.4) — access itself was NOT locked down (Boss reversed the initial
  broader lockdown once other testers confirmed the narrower approach worked). What's live:
  - Login (`/auth/pin` on `arche-proxy`) works normally for everyone.
  - The AI Study Tools call itself (`/groq` on `arche-proxy`) is blocked for any tester ID other
    than Jesse's two PINs — **5332 ("QA Test")** and **8144 ("jesse")**. Anyone else tapping an AI
    tool button gets Boss's exact message instead of a result. Read, Study, Memory, and sync all
    work normally for everyone.
  - Client-side (`ui.js`, `studyTools.js`): the PIN screen and the AI-tool error panel both
    surface the lockdown message verbatim if the Worker ever returns it, instead of a generic
    error. (The PIN-screen branch is currently dead code since login isn't gated — harmless,
    left in place.)
- **Verified working** by Boss: a non-allowed PIN gets the lockdown message on an AI tool call;
  PIN 8144 gets a real (if currently ungrounded) AI tool response.
- The emergency block in the Worker (`PILGRIM_PRIVATE_ALLOWED_PINS`, `PILGRIM_LOCKDOWN_MESSAGE`,
  and its one call site inside `/groq`) is clearly commented `EMERGENCY LOCKDOWN` for easy removal
  once the real fix (below) ships and is verified.
- **Worker deploy note:** `arche-proxy` deploy is manual (Boss pastes into the Cloudflare
  dashboard) — already done twice this session (first with the broader lockdown, then the
  narrowed version). Current live Worker state matches the narrowed version described above.

### 2. Real fix — scoped, not yet built
Wrote **`docs/spec-ai-tools-grounding-v1.md`** (pushed, `main` @ `00352d6`). Summary:
- Root cause: all six AI Study Tools call `openai/gpt-oss-120b-Turbo` (`Reasoning: low`) with zero
  retrieval grounding — free-generating exact-token content (Strong's numbers, Greek word forms,
  scholar citations) from memory, with no way to self-check.
- Fix for **Word Study, Language & Structure, Cross-References** (this phase's scope): ground each
  tool in real, freely-licensed source data (MACULA — Strong's/lemma/morphology tagged Greek+Hebrew
  text, CC BY 4.0; OpenBible.info cross-references, CC BY), transformed once into small per-book
  JSON lookup files hosted in the repo's new `data/` folder via jsDelivr, fetched client-side per
  reference, and injected into the prompt as ground truth the model may only explain, not add to.
- **Verification pass** (the actual mechanical guarantee, not just a prompt ask): after the AI
  responds, code extracts every Strong's number / original-language word / cross-reference from
  the output and checks it against the data actually sent; anything unmatched gets stripped and
  logged. This is what makes "can't fabricate" enforced in code rather than hoped-for in a prompt.
- **Explicitly deferred:** Historical, Cultural (no equivalent verifiable dataset — interim
  mitigation is prompt-level only: forbid fake named-scholar-plus-year citations), and Places &
  Geography (not currently exhibiting the bug). Boss wants to brainstorm those separately, after
  this phase locks down.
- **Open items awaiting Boss sign-off** (spec §8): `data/` folder name, jsDelivr vs. serving from
  `pilgrim-private/` directly, cross-reference cap count (proposed: top 8), scope confirmation.
- **Rollback condition:** the emergency `/groq` lockdown comes off only after the spec's §5.1 test
  plan passes (re-run the original bug-report passage, spot-check 5-10 more, confirm the
  verification pass actually strips a deliberately-bad test case).

---

## Not done / carried over

- **Scripture Memory edit feature** (the original ask this session started with): Boss wants to
  edit a saved verse's reference/translation/text in place instead of delete-and-re-add. Scoped
  and confirmed via 3 questions (full edit of ref+translation+text; reset chunk progress only if
  verse count/chunk count changes, preserve otherwise; new "Edit" button next to "Remove"). A
  **Data Safety Warning was issued and never confirmed** — the fabrication bug interrupted before
  Boss responded. Nothing was built. Pick up by re-confirming the Data Safety Warning before
  writing `memSaveEdit()` / `memRebuildChunksOnEdit()` (design already spec'd out in-chat, not
  written to a doc — see conversation history if this thread isn't available, or re-derive from
  the scoping questions/answers above).
- **Pilgrim Private device-testing pass** on Stage 2 Scripture Memory (v4.37.0-4.37.3) — still
  flagged from the prior session as untested on real devices. Now further behind the fabrication
  fire drill. Still the highest-risk untested surface in the app.
- **Grading apostrophe bug** — diagnosed but not fixed: `_memGradeWords()` in `memory-core.js`
  only treats a straight apostrophe as a real character, so a curly apostrophe (`'`, U+2019) in
  fetched verse text splits contractions like "don't" into two words during quiz grading, causing
  false "wrong" marks. Fix identified (normalize curly/backtick apostrophe variants to straight
  before stripping punctuation) but not applied — bundle with the Memory edit-feature build.
- **`verse-memory-spec-v1.md` superseded banner** — still not added (small, flagged twice now).

---

## Next session should

1. Get Boss's sign-off on the 4 open items in `spec-ai-tools-grounding-v1.md` §8 (or take answers
   if already given elsewhere).
2. Build the grounding pipeline for all 3 tools in one pass (per spec §3-5) — this was Boss's
   explicit call: build once, wire all three, rather than one tool per session.
3. Run the §5.1 test plan; only then remove the emergency `/groq` lockdown.
4. Circle back to the Scripture Memory edit feature and the apostrophe grading fix — both fully
   scoped, just displaced by the fire drill.
5. Brainstorm Historical/Cultural grounding options once the above is stable (Boss's explicit
   sequencing request).
