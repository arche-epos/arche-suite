# Session Handoff — Sep 23, 2026: AI Study Tools Grounding — Phase 3 In Progress (3 verification-pass bugs found and fixed)

**Repo state at end of session:** `arche-epos/arche-suite`, `main` @ `b5a0daefcd560df570abdb8eb5f58a650ff09cc6` (v4.38.3)
**Session start point:** `main` @ `4e237956e70692ff08a42f16e751332ae775cbcb` (v4.38.0, Phase 2 complete)
**Live-site check needed first:** as of session end, `archestudytools.com/pilgrim-private/` was still serving v4.38.2 after ~15s of waiting + hard refresh, while GitHub was confirmed byte-verified at v4.38.3. Likely just deploy-pipeline lag (seen ~10-20s lag on the two earlier pushes this session too) — **first thing next session: reload and confirm v4.38.3 is live before anything else.**

---

## What happened this session

Continuation of `pilgrim-ai-tools-fabrication` / `spec-ai-tools-grounding-v1.md`. Picked up from `session-handoff-sep23-2026-ai-tools-grounding-phase2.md`. Started Phase 3 (spec §5.1 test plan).

### New capability this session: live browser access
Boss activated the Chrome extension mid-session, giving direct browser access for the first time in this thread. This unblocked two things that were stuck in prior sessions:
- Confirmed jsDelivr is actually serving `@main` (`data/strongs/greek.json`, `data/macula/44.json` both fetched live and matched GitHub exactly) — the jsDelivr-unreachable problem flagged in the last two handoffs was a tooling limitation (`web_fetch` refuses unseen URLs; jsdelivr.net isn't on the bash sandbox allowlist), not jsDelivr being down.
- Drove the actual live Pilgrim Private app (already logged in under Boss's session) to run real Study Tools calls against Acts 2:1-13 for Phase 3 testing.
- **Correction to a Phase 2 assumption:** the app's own JS files (`studyTools.js` etc.) are served directly from `archestudytools.com`, NOT via jsDelivr — jsDelivr is only used for the `data/` grounding files (`GROUND_CDN` in `studyTools.js`). Checking jsDelivr for app-code files is a dead end; only `archestudytools.com` itself needs checking for app deploys.

### Phase 3 test plan progress (spec §5.1)
1. **jsDelivr check: PASSED.** Both `data/strongs/greek.json` and `data/macula/44.json` confirmed live on `@main`, content matches GitHub raw exactly.
2. **Acts 2:1-13 re-run: PASSED on Word Study, initially FAILED on Language & Structure and Cross-References — root-caused and fixed (see below).**
   - **Word Study:** clean pass. All 5 lexical entries (ἐπλήρωσεν/G4137, πνεύματος/G4151, ἁγίου/G40, γλῶσσαι/G1100, ἔθνος/G1484) matched the real MACULA/Strong's data exactly. Zero fabrication.
   - **Language & Structure / Cross-References:** the underlying grounding data was accurate in every case checked, but the verification pass itself (the code that strips unverified content — spec §5) had three separate bugs, all of which corrupted genuinely-correct output rather than catching real fabrications. All three found via live re-testing in this session, not via spec-writing — see "Bugs found and fixed."
3. **Spot-check 5-10 more passages (OT+NT, one long, one single-verse):** NOT STARTED.
4. **Malformed-data strip/log test (verification pass fires on deliberately ungrounded input):** NOT STARTED.
5. **Lexicon-specific pass (common word, rare word, direct Strong's query, zero-match word):** NOT STARTED.

---

## Bugs found and fixed this session (3, in sequence — each found by re-testing the previous fix live)

All three live in `verifyGroundedOutput()` and its helper extraction functions in `pilgrim-private/studyTools.js`. All three were **false positives** — the verification pass flagging/stripping genuinely-grounded, correct content, not failures to catch real fabrication. Each was reproduced in an isolated Node test harness before and after the fix (regression suite grew to 12 checks, all passing at v4.38.3).

### 1. v4.38.1 — two bugs, one commit (`f0621d6f`)
- **Decomposed-Unicode Greek words wrongly stripped.** The AI provider can emit accented Greek as decomposed base-letter + combining-mark sequences even when the source dictionaries store precomposed characters (e.g. `ῆ` vs `ῆ`). `extractOriginalScriptWords()`'s regex only covers precomposed ranges, so a genuinely-grounded word failed the exact-string match. **Fix:** `content.normalize('NFC')` before extraction, and normalize `allowedWords` the same way.
- **Cross-References stripped the passage's own self-reference.** `extractRefTokens()` has no concept of "the passage under study" — it just pattern-matches any `Book Ch:V(-V)` shape and checks it against the supplied cross-reference list. Since a passage is never its own cross-reference, mentioning "Acts 2:1-13" while studying Acts 2:1-13 got flagged and replaced with `[unverified cross-reference removed]`, corrupting the opening line of every Cross-References response. **Fix:** parse the passage's own reference (`parseRef()`, already available) and exclude any extracted ref token whose book+chapter match and whose verse range falls within the passage's own range.
- **Bonus find in the same pass:** a Unicode dash mismatch — AI-generated verse ranges use a non-breaking hyphen (`‑`) or similar, not ASCII `-`. `extractRefTokens()`'s regex only matched ASCII `-` for the end-verse group, so "Acts 2:1‑13" only matched "Acts 2:1", leaving a stray "‑13" un-stripped. **Fix:** broadened the dash character class to common Unicode dash variants.

### 2. v4.38.2 — invisible zero-width characters (`49e8b933`)
Found by re-testing 4.38.1 live: a *different* word (ἐγένετο) got split mid-word (`ἐ` + `[unverified original-language text removed]`), even after the NFC fix. Root cause: an invisible zero-width character (most likely a zero-width joiner, a known artifact of some LLM providers' tokenizers reassembling sub-word pieces for non-Latin scripts) inserted between characters, splitting one real word into two separate regex matches. **Fix:** strip known invisible/zero-width Unicode characters (`​ ‌ ‍ ⁠ ﻿ ­`) from content before matching.

### 3. v4.38.3 — the big one: global substring replace (`b5a0daefcd560df570abdb8eb5f58a650ff09cc6`)
Found by re-testing 4.38.2 live: a Language & Structure response came back with **every single occurrence of the Greek letter σ removed from the entire response** — corrupting a dozen otherwise-correct, properly-grounded words (ἦσαν, πεντηκοστῆς, ἐπλήρωσεν, γλῶσσαι, ὡσεὶ, ἐκάθισεν, ἕκαστον, ἐπλήσθησαν, Ἱερουσαλήμ, συνῆλθε, συνεχύθη, εἰσίν, συμπληροῦσθαι — all had their σ's stripped) that had nothing to do with the actual problem.

**Root cause:** `verifyGroundedOutput()` replaced an unverified token with `cleaned.split(tok).join(replacement)` — a bare substring replace across the *entire* response text, not just at the position where the token was extracted. Almost certainly the model discussed a Greek grammatical marker in isolation somewhere in its explanation (e.g. "the σ suffix marks the aorist") — a single lone "σ" got extracted as its own "word" token, failed the grounding check (it's not a real dictionary word), and `.split('σ').join(...)` then replaced *every* σ character anywhere in the whole response, since that's how `String.split` works on a bare substring.

This is an architectural flaw, not an edge case — any short or common token that also happens to be a substring of other correctly-grounded content is unsafe to strip this way. It could as easily have been a 2-3 letter root shared across several inflected forms.

**Fix:** replaced the naive substring replace with a boundary-aware regex replace (`_replaceIsolatedToken()`) that only strips a token where it appears as a complete, isolated match — using a negative lookaround for the same character class the token was extracted with (Greek/Hebrew/Latin for words, alphanumeric for Strong's numbers and refs). A token embedded inside a larger correctly-grounded word no longer matches the strip pattern at all.

**This fix supersedes the risk profile of the first two** — even without the NFC/invisible-character fixes, a boundary-aware replace would have prevented cross-contamination of unrelated words, though the NFC and invisible-character fixes are still independently correct and worth keeping (they reduce how often *anything* gets falsely flagged in the first place).

### Verification before each push
Every fix went through the same discipline: isolated Node test harness (function bodies extracted from the real file, not rewritten) reproducing the exact failure seen live, `node --check` syntax validation, fresh-HEAD check immediately before tree creation, and byte-for-byte Contents API verification after push. Final regression suite (12 checks, all passing at v4.38.3):
- extractRefTokens captures full non-breaking-hyphen range
- self-reference to the passage under study is NOT stripped
- genuinely-grounded cross-reference IS kept
- a fabricated cross-reference (wrong chapter, not in supplied list) IS still stripped
- a decomposed-Unicode Greek word is NOT wrongly stripped
- a genuinely fabricated Greek word IS still stripped
- a fabricated Strong's number IS still stripped
- a word with an embedded zero-width-joiner artifact is NOT wrongly stripped
- an isolated stray sigma (not a real word) IS flagged
- three separate real words that merely *contain* a sigma are NOT corrupted by that flag

### Deploy chain this session
`4e237956` (Phase 2 end) → `f0621d6f` (v4.38.1) → `49e8b933` (v4.38.2) → `b5a0daefcd560df570abdb8eb5f58a650ff09cc6` (v4.38.3). All direct-to-`main`, Git Data API flow, dev PAT. Every push: fresh HEAD confirmed unmoved before tree creation, all 10 touched files (`memory.js`, `app.js`, `ui.js`, `index.html`, `tts.js`, `storage.js`, `media.js`, `studyTools.js`, `sync.js`, `utils.js`) version-bumped in lockstep per the established cache-busting pattern (all cross-module `?v=` import strings must move together or browsers can run mismatched module instances — see Phase 2 handoff and utils.js changelog history for why), `node --check` clean on every file, byte-for-byte Contents-API verified post-push.

---

## Not done / carried over

### Phase 3 — test plan (spec §5.1), partially done
- [x] jsDelivr serving confirmed live
- [x] Acts 2:1-13 re-run through Word Study — clean
- [ ] **Acts 2:1-13 re-run through Language & Structure and Cross-References on v4.38.3 — not yet confirmed clean.** This is the very next step: once v4.38.3 is confirmed live, clear the cached results for this passage's study (Library → "Untitled Study", Acts 2:1-13) and regenerate both tools fresh. Expect zero `[unverified ...]` markers this time, since all three known bugs are now fixed — but this hasn't been observed yet, only inferred from isolated unit tests.
- [ ] Spot-check 5-10 more passages, OT + NT, one long (>10 verses), one single-verse
- [ ] Malformed-data strip/log test: temporarily feed a request without grounding data, confirm the now-ungrounded output gets flagged/stripped rather than silently rendered
- [ ] Lexicon-specific pass (Plan A / Word Study search box): common English word with multiple senses, a rare/unambiguous word, a direct Strong's-number query, a word with zero gloss-index match (confirm the honest "not found" message)

### Phase 4 — lockdown removal, not started
Remove `PILGRIM_PRIVATE_ALLOWED_PINS` gate on `/groq` in `arche-proxy` (Worker deploy is manual — Boss pastes into the Cloudflare dashboard). **Do not start until Phase 3 fully passes**, including the still-outstanding items above.

### Flagged, not fixed (out of this session's confirmed scope)
- **`🔧 DIAGNOSTIC (temporary)` debug line** renders at the top of every AI Study Tools response (token counts, finish_reason). Looks like a dev leftover that shouldn't be user-facing. Mentioned to Boss as a separate item from the two verification bugs; not touched this session since it wasn't part of the explicit "fix now" scope. Worth a quick removal pass once Phase 3 clears — confirm with Boss first.

### Known residual risk — flagged, not fixed (carried from Phase 2 handoff, untouched again)
`expandCurrentTool()` ("Go Deeper" button) runs its own separate, still-ungrounded prompt that explicitly asks for "named scholars on each side." For lexical/grammar/crossrefs this reopens the same fabrication risk after a clean grounded result. Not in the original bug report or the spec, so left alone rather than scope-creep — worth a Phase 2b once Phase 3 clears.

### Still carried from earlier handoffs (untouched again this session)
- **Scripture Memory edit feature** — fully scoped, Data Safety Warning issued, never confirmed. Design not written to a doc — re-derive from conversation history if needed, or re-scope fresh.
- **Grading apostrophe bug** — diagnosed, not fixed: `_memGradeWords()` in `memory-core.js` doesn't normalize curly apostrophes (U+2019) before stripping punctuation. Bundle with the Memory edit-feature build.
- **`verse-memory-spec-v1.md` superseded banner** — still not added (flagged five times now).
- **Pilgrim Private device-testing pass** on Stage 2 Scripture Memory — still untested on real devices, still the highest-risk untested surface in the app.

---

## Next session should

1. Confirm `archestudytools.com/pilgrim-private/` is serving v4.38.3 (hard refresh; check the version number in the sidebar). If still showing v4.38.2, wait a bit longer and retry — GitHub is confirmed correct at `b5a0daefcd560df570abdb8eb5f58a650ff09cc6`, so this is a propagation-timing question, not a content question.
2. Re-run Language & Structure and Cross-References fresh (Clear → regenerate) on the existing "Untitled Study" (Acts 2:1-13) and confirm zero `[unverified ...]` markers appear anywhere in either response. This is the real end-to-end confirmation that all three fixes hold together — the isolated unit tests passed, but the live model hasn't been re-tested against the combined fix yet.
3. If that's clean: continue the rest of the Phase 3 test plan (spot-check passages, malformed-data test, lexicon pass) per spec-ai-tools-grounding-v1.md §5.1.
4. If Phase 3 fully passes: Phase 4 — remove the `/groq` emergency lockdown (Boss pastes Worker code into Cloudflare dashboard).
5. Circle back to the DIAGNOSTIC debug-line removal (confirm with Boss first), Scripture Memory edit feature + apostrophe fix, and the "Go Deeper" grounding gap, per Boss's priority.
