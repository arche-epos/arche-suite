# Session Handoff — Sep 23, 2026: AI Study Tools Grounding — Phase 1 Complete

**Repo state at end of session:** `arche-epos/arche-suite`, `main` @ `3434503`
**Session start point:** `main` @ `7bf4b87` (v4.37.4, emergency lockdown live)

---

## What happened this session

Continuation of the AI Study Tools fabrication fix (see `pilgrim-ai-tools-fabrication` doc and
`spec-ai-tools-grounding-v1.md`, both already in place from the prior session).

### 1. Scope expansion — approved by Boss
Found that "Word Study" is actually **two separate AI surfaces**, both fabricating, only one of
which the spec covered:
1. Deep Study grid → "Word Study" button (`buildPrompt('lexical', ...)` in `studyTools.js`) — the
   spec's original target.
2. **Word Study screen's search box** (`_lexClassify` → `_lexFullLookup` in `studyTools.js`) — a
   separate single-word/Strong's-number lookup that free-generates a full JSON lexicon entry
   (Strong's number, original word, definition, scholarly entry, up to 30 "occurrences" **with
   fabricated verse text**) from the same ungrounded model call. Not mentioned in the spec.
Boss approved grounding both (Plan A) rather than leaving #2 on a permanent gate. This session's
Phase 1 build already accounts for #2 (see the two new indices below).

### 2. Phase 1 — data pipeline: DONE, verified, live on `main` @ `3434503`

All real, freely-licensed source data downloaded, transformed, spot-checked against the original
bug-report passage (Acts 2:1-13) and Genesis 1:1, and pushed to `arche-suite/data/` in one atomic
commit (135 files, ~46 MB). Full attribution table in `data/README.md`.

| Path | Content | Source |
|---|---|---|
| `data/macula/01-39.json` | Hebrew OT word-level: `{word, lemma, strongs, morph, gloss}` per verse | **OpenScriptures `morphhb`** — see deviation note below |
| `data/macula/40-66.json` | Greek NT word-level (same shape, `gloss` populated) | MACULA Greek (Clear-Bible/Biblica), CC BY 4.0 |
| `data/crossrefs/01-66.json` | Per verse, top-8 cross-refs by vote: `[["Book Ch:V", votes], ...]` | OpenBible.info, CC BY |
| `data/strongs/greek.json` (5,523 entries), `hebrew.json` (8,674 entries) | Full Strong's dictionaries | OpenScriptures |
| `data/strongs/gloss-index.json` (9,335 keys, 400 KB) | English word → real candidate Strong's numbers, built only from each entry's own KJV-rendering list | derived, no fabrication risk |
| `data/strongs/occurrences.json` (14,027 numbers, 1.8 MB) | Strong's number → up to 30 real verse refs (canonical order) | derived from `data/macula/` |

**Deviation from spec §2 (flagged to Boss, acknowledged, not yet formally amended in the spec
doc):** MACULA Hebrew's own TSV export is Git-LFS-hosted and wasn't reachable from the build
sandbox. Substituted **OpenScriptures Hebrew Bible (`openscriptures/morphhb`)** directly — the same
underlying source MACULA Hebrew is itself built from (lemma/Strong's/morphology, same lexical
content, just without Clear-Bible's syntax-tree layer, which this fix doesn't need). OT `gloss`
field is empty as a result (OSHB has no English glosses; NT still has them from MACULA Greek).

**Unverified from this session:** jsDelivr CDN pickup of the new commit. The build sandbox's
network doesn't allow `cdn.jsdelivr.net`, so this couldn't be tested directly. Spec check before
Phase 2 client work depends on it:
`https://cdn.jsdelivr.net/gh/arche-epos/arche-suite@main/data/macula/44.json` should return Acts.
(jsDelivr typically mirrors a new commit within minutes — likely fine, just not confirmed.)

**Naming convention used** (not in the original spec, decided during the build to match the app's
existing internal book numbering): files are named by **BOLLS_BOOKS-style book number, zero-padded
to 2 digits** (`01`=Genesis … `66`=Revelation), matching the numbering already used internally by
`utils.js`'s `BOLLS_BOOKS` map — not the book's full name or USFM code. Phase 2's fetch code should
derive the number from `BOLLS_BOOKS[bookNameLower]` (already exists) and zero-pad it.

---

## Not done / carried over

### Phase 2 — client fetch + prompt rewrite (this session's stated next step, not started)
Per spec §4 plus the Plan A expansion:
- Add fetch + verse-slice-extraction logic to `studyTools.js` for the per-book `data/macula/` and
  `data/crossrefs/` files (jsDelivr URLs), keyed off the existing `BOLLS_BOOKS` numbering.
- Rebuild **4** prompts around the grounding rule (spec's 3 + the Lexicon expansion), each with the
  shared structural constraint from spec §4.4 ("may explain the supplied data, may NOT state a
  Strong's number/word/reference not present in it"):
  - `buildPrompt('lexical', ...)` — Word Study (Deep Study grid)
  - `buildPrompt('grammar', ...)` — Language & Structure
  - `buildPrompt('crossrefs', ...)` — Cross-References
  - `_lexClassify` / `_lexFullLookup` — Word Study lexicon search box. Candidate list from
    `gloss-index.json` (not model-invented); full entry from `strongs/{greek,hebrew}.json`;
    "occurrences" from `occurrences.json` refs + the app's **existing** translation-fetch code for
    real verse text (no new infra) instead of model-generated text.
- Verification pass (spec §5): after each AI response, extract every Strong's number / original-
  language word / cross-reference token, check against the data actually sent, strip + log
  anything unmatched via the existing `PILGRIM_ANALYTICS` error-log pattern.
- Remove the named-scholar-citation instruction from these 4 prompts (spec §6).
- UI labeling requirement (spec §6.1): visually distinguish verified data from AI-written
  explanation in the rendered output.

### Phase 3 — test plan (spec §5.1), not started
- Re-run Acts 2:1-13 through all grounded tools/paths.
- Spot-check 5-10 more passages (OT + NT, one long passage, one single-verse).
- Confirm the strip/log path actually fires on a deliberately malformed test case.
- Lexicon-specific pass (per Plan A): a common word, a rare word, a direct Strong's-number query.

### Phase 4 — lockdown removal, not started
Remove `PILGRIM_PRIVATE_ALLOWED_PINS` gate on `/groq` in `arche-proxy` (Worker deploy is manual —
Boss pastes into Cloudflare dashboard) — only after Phase 3 passes.

### Still carried from the prior handoff (untouched again this session)
- **Scripture Memory edit feature** — fully scoped (full edit of ref/translation/text; reset chunk
  progress only if verse/chunk count changes; new "Edit" button next to "Remove"). Data Safety
  Warning was issued last session, never confirmed. Design not written to a doc — re-derive from
  conversation history if needed, or re-scope fresh.
- **Grading apostrophe bug** — diagnosed, not fixed: `_memGradeWords()` in `memory-core.js` doesn't
  normalize curly apostrophes (U+2019) before stripping punctuation, causing false "wrong" marks on
  contractions in Scripture Memory quizzes. Bundle with the Memory edit-feature build.
- **`verse-memory-spec-v1.md` superseded banner** — still not added (flagged three times now).
- **Pilgrim Private device-testing pass** on Stage 2 Scripture Memory — still untested on real
  devices, still the highest-risk untested surface in the app.

---

## Next session should

1. Confirm jsDelivr is serving the new `data/` commit (quick check, see URL above).
2. Build Phase 2 in one pass — client fetch code + all 4 prompt rewrites + verification pass —
   atomic full-file reassembly of `studyTools.js`, syntax-checked with `node --check` before
   delivery, version bump + changelog per SOP.
3. Run the Phase 3 test plan.
4. Remove the `/groq` emergency lockdown once Phase 3 passes.
5. Circle back to Scripture Memory edit feature + apostrophe grading fix — both fully scoped, just
   displaced twice now.
