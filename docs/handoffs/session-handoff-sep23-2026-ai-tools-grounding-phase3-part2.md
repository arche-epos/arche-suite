# Session Handoff — Sep 23, 2026: AI Study Tools Grounding — Phase 3 continued (Category A/B/C/D found, three more fixes shipped, live-verified)

**Repo state at end of session:** `arche-epos/arche-suite`, `main` @ `0adf68c72cc983e8cd075ef1f98aa1887956ac10` (v4.38.6)
**Session start point:** `main` @ `b5a0daefcd560df570abdb8eb5f58a650ff09cc6` (v4.38.3, end of `session-handoff-sep23-2026-ai-tools-grounding-phase3.md`)
**Live-site check:** confirmed v4.38.6 serving live on `archestudytools.com/pilgrim-private/` before testing — no propagation lag this time.

---

## What happened this session

Picked up exactly where Phase 3 left off: confirm the three verification-pass bugs fixed at v4.38.3 hold together live on Acts 2:1-13. They didn't, fully — found two *new* categories of drift, root-caused both against real MACULA source data (not guessed), fixed one mechanically and mitigated the other, then live-verified the fixes actually work.

### Step 1 — re-tested v4.38.3 live, found it wasn't clean
Regenerated Language & Structure and Cross-References fresh on the existing "Untitled Study" (Acts 2:1-13). Found new `[unverified ...]` strips that were **not** any of the three bugs already fixed — different failure mode entirely.

### Step 2 — Boss supplied the pilgrim-admin error-log export; root-caused against live MACULA data
Boss exported `pilgrim-admin`'s full diagnostics (`pilgrim-admin-full-export-2026-09-23_025252.json`) containing every `stripped` token this session had triggered, verbatim. Cross-referenced every single one against the actual MACULA word/lemma/morph data for Acts 2 (pulled live from `raw.githubusercontent.com/arche-epos/arche-suite/main/data/macula/44.json`). Found four distinct categories:

- **Category A — accent/case-only false positives (majority of strips).** The word is 100% correct; only the accent mark or letter-case differs from the source dictionary's exact recorded form. Confirmed on: Ἰερουσαλήμ (×4 separate runs — citation-form acute vs. the source's in-context grave), οὗτοι (missing enclitic accent shift → οὗτοί), λάλουντων (accent 3 syllables off), ἔδιδου (accent 1 syllable off), φὲρομένης (spurious accent inserted), ΚΑΙ (all-caps, no accent). **This is a bug in the verification pass itself** — exact-string matching is too strict for legitimate Greek accent variance.
- **Category B — wrong grammatical case, same word.** τὰς ἡμετέρας γλώσσας (accusative plural) generated where the source has ταῖς ἡμετέραις γλώσσαις (dative plural) — all three words shifted together, consistently, across separate runs. Also φωνὴ (nominative) for the source's φωνῆς (genitive), and ἡμέρας for the source's ἡμέραν. Consistent with the model reciting a remembered form of a quoted clause instead of copying the individually-tagged words it was actually given (which *do* contain the correct case).
- **Category C — a genuinely different word, not in the passage.** ὅπου ("where") generated where the source uses οὗ, a different word entirely. Same root cause as Category B.
- **Category D — a real word split mid-word, similar to the ἐγένετο bug fixed at v4.38.2 but a *different* word.** γένετο (missing the ἐ- augment) found with no data match, exactly matching the shape of the v4.38.2 bug this session was supposed to have fixed. No raw pre-strip text was available to confirm the exact character/cause.

### Step 3 — three fixes shipped, all confirmed byte-for-byte against the GitHub Contents API (not the CDN-cached raw.githubusercontent.com, which lagged behind on this session's second push and briefly looked like a failed deploy — it wasn't; always verify via `api.github.com/repos/.../contents/...` when in doubt, not the raw CDN URL, if you've fetched that same raw URL recently)

**v4.38.4** (`e9b56bfe`) — mechanical fix for Category A. Added `_foldGreekWord()`: strips combining diacritics (`̀-ͯ`, what a precomposed polytonic Greek character decomposes into under NFD) and folds case/final-sigma, used only for the `allowedWords` comparison in `verifyGroundedOutput()`. Strong's numbers and cross-references untouched. Unit-tested against all 12 real tokens from the admin export before pushing: the 6 accent-only false positives now pass, the 6 genuine mismatches (Category B/C) still correctly fail.

**v4.38.5** (`35a260c5`) — mitigation for Category B/C + diagnostic for Category D, labeled untested at push time (Boss unavailable to test that morning).
- Added an explicit instruction to the Language & Structure prompt: copy original-language words character-for-character from the supplied data, never retype a full clause from memory — targets the root cause (the model has the correct forms in its prompt already; it just isn't always using them).
- Added `_contextSnippet()`: captures ~15 characters of raw surrounding text for any stripped word and includes it in the existing `beaconError()` log payload. Purely additive — no behavior change — so the next Category-D occurrence will actually show what character/formatting is causing the split, instead of us guessing again.

**v4.38.6** (`0adf68c7`) — Language & Structure's `/groq` call now sends `Reasoning: medium` instead of `low`; every other AI Study Tool (Word Study, Historical, Cultural, Cross-References, Places & Geography) is unchanged at `low`. Targeted because the Category B/C drift was specific to Language & Structure and is exactly the kind of error more model deliberation should reduce. `max_tokens` raised 1.8× alongside it (6000→10800 main call, 2048→3686 Go Deeper/Continue) so the added reasoning phase can't eat into the visible-answer budget and cause truncation. Added `_reasoningConfigFor(toolName, baseMaxTokens)` and applied it at all four call sites the grammar tool can be invoked from (`runTool()`, `runOneSnapshotTool()` in the Study Snapshot batch, `expandCurrentTool()`/Go Deeper, `continueCurrentTool()`/truncation-recovery Continue) — unit-verified only `'grammar'` gets the bump, all five other tool keys are unaffected.

Discussed with Boss before shipping: reasoning effort trade-off is real latency, not free — "low" reasoning previously used ~3,600/6,000 tokens and took roughly 15-20s; "medium" was expected to run noticeably slower. Confirmed acceptable to Boss as a targeted, single-tool trade rather than a global change.

Also discovered mid-session (not part of the fix, just a correction to prior assumptions): the `/groq` route on `arche-proxy` is a pure pass-through to **DeepInfra** (`api.deepinfra.com`), not Groq directly — legacy route name from before the Aug 25 2026 migration. The Worker does zero transformation of the request body (confirmed by reading the full live Worker source via the Cloudflare API), so `max_tokens`/`Reasoning:` set client-side in `studyTools.js` are exactly what reaches the model. The `🔧 DIAGNOSTIC (temporary)` line's `max_tokens: 16384` is a stale hardcoded display string unrelated to the actual request — still on the list to clean up (see below), now doubly worth removing since it's actively misleading about the real cap.

### Step 4 — live-verified all three fixes together on Acts 2:1-13 (Chrome extension access, enabled by Boss mid-session)
Confirmed v4.38.6 live, then Clear + regenerate on the existing "Untitled Study":

- **Language & Structure, run 1:** `completion_tokens: 2070`, `finish_reason: stop`, ~20-25s. One issue: mid-word split on κατοικοῦντες → `κατοικ[unverified original-language text removed]` — same word rendered correctly elsewhere in the *same* response, so non-systematic. This is a fresh Category-D occurrence; **the v4.38.5 context-capture diagnostic should have logged its exact surrounding text to pilgrim-admin's error log — check that first next session, it's the concrete lead we've been missing.**
- **Language & Structure, run 2:** `completion_tokens: 3031`, `finish_reason: stop`, ~20s. **Completely clean** — zero unverified markers across all 13 verses, including every word that failed before (Ἰερουσαλήμ, οὗτοι, λαλούντων, ταῖς ἡμετέραις γλώσσαις all correct). No Category B/C drift either.
- **Cross-References:** `completion_tokens: 1944`, `finish_reason: stop`. Self-reference still resolves cleanly (v4.38.1 fix holding). One recurring strip: a reference to the disciples gathering in the upper room (reads like Acts 1:13) — same one seen earlier this session, consistent both times. **This looks like correct behavior, not a bug** — the verification pass enforcing "don't cite anything outside the supplied ranked list," and the model reaching for a real, biblically-accurate reference that's simply outside the top-8/10 OpenBible.info cap for this passage. Not touched, not flagged as a defect.
- **Word Study** (bonus, accidentally triggered mid-test): clean.

Net read: encouraging but a small sample (2 Language & Structure runs, 1 Cross-References run). Boss wants to do more live testing next session before calling any of this confirmed.

---

## Not done / carried over

### Phase 3 — test plan (spec §5.1), still partially done
- [x] jsDelivr serving confirmed live (Phase 3, part 1)
- [x] Acts 2:1-13 re-run through Word Study — clean (Phase 3, part 1, and again this session)
- [x] Acts 2:1-13 re-run through Language & Structure and Cross-References on the *combined* v4.38.4+4.38.5+4.38.6 fix — **1 of 2 Language & Structure runs clean, 1 had a Category-D mid-word split; Cross-References clean modulo the expected out-of-list-reference strip.** Not yet enough runs to call this fully confirmed — **more live testing planned next session, at Boss's request.**
- [ ] Spot-check 5-10 more passages, OT + NT, one long (>10 verses), one single-verse
- [ ] Malformed-data strip/log test: temporarily feed a request without grounding data, confirm the now-ungrounded output gets flagged/stripped rather than silently rendered
- [ ] Lexicon-specific pass (Plan A / Word Study search box): common English word with multiple senses, a rare/unambiguous word, a direct Strong's-number query, a word with zero gloss-index match (confirm the honest "not found" message)

### Phase 4 — lockdown removal, not started
Remove `PILGRIM_PRIVATE_ALLOWED_PINS` gate on `/groq` in `arche-proxy` (Worker deploy is manual — Boss pastes into the Cloudflare dashboard). **Do not start until Phase 3 fully passes**, including the still-outstanding items above and more Language & Structure runs to build real confidence in the Category B/C mitigation.

### New open item this session — Category D (mid-word split), NOT resolved
Two confirmed occurrences now (ἐγένετο pre-v4.38.2, κατοικοῦντες this session, both under different app versions), non-systematic (same word can render correctly elsewhere in the same response), root cause still unknown. **The fix path is already deployed** (v4.38.5's `_contextSnippet()` diagnostic) — next session's first move on this should be checking pilgrim-admin's error log for today's κατοικοῦντες strip and reading its `context` field. That should finally show the exact character or formatting artifact causing the split.

### Flagged, not fixed (out of this session's confirmed scope)
- **`🔧 DIAGNOSTIC (temporary)` debug line** — still renders on every AI Study Tools response. Now confirmed to display an inaccurate `max_tokens` value (hardcoded `16384`, not the real per-tool cap of 6000/10800/2048/3686). Worth removing once Phase 3 clears — confirm with Boss first, per standing instruction.

### Known residual risk — flagged, not fixed (carried from Phase 2 handoff, untouched again)
`expandCurrentTool()` ("Go Deeper" button) runs its own separate, still-ungrounded prompt that explicitly asks for "named scholars on each side." For lexical/grammar/crossrefs this reopens the same fabrication risk after a clean grounded result. Not in the original bug report or the spec, so left alone rather than scope-creep — worth a Phase 2b once Phase 3 clears. (Note: Go Deeper's `max_tokens`/reasoning were touched this session only for the grammar tool specifically, per `_reasoningConfigFor()` — the ungrounded-prompt issue itself is unchanged.)

### Still carried from earlier handoffs (untouched again this session)
- **Scripture Memory edit feature** — fully scoped, Data Safety Warning issued, never confirmed. Design not written to a doc — re-derive from conversation history if needed, or re-scope fresh.
- **Grading apostrophe bug** — diagnosed, not fixed: `_memGradeWords()` in `memory-core.js` doesn't normalize curly apostrophes (U+2019) before stripping punctuation. Bundle with the Memory edit-feature build.
- **`verse-memory-spec-v1.md` superseded banner** — still not added (flagged six times now).
- **Pilgrim Private device-testing pass** on Stage 2 Scripture Memory — still untested on real devices, still the highest-risk untested surface in the app.

---

## Next session should

1. Confirm `archestudytools.com/pilgrim-private/` is serving v4.38.6 (sidebar version number).
2. **Check pilgrim-admin's error log for today's κατοικοῦντες strip and read its `context` field** — first real evidence on the Category-D mid-word-split bug since v4.38.2. This is the most concrete open lead from this session.
3. Continue live testing on Language & Structure specifically (Boss's stated priority for next round) — more runs on Acts 2:1-13, then branch into fresh passages, to build real confidence that Category B/C (wrong case, wrong word) is actually improved by the prompt hardening + reasoning bump, not just lucky on one clean run. Watch `completion_tokens`/`finish_reason` in the diagnostic line every time to confirm no truncation from the raised reasoning effort, and keep an eye on response time (both runs this session landed at ~20-25s, better than the ~25-45s worst-case estimate, but worth confirming that holds).
4. If Category D produces a clear root cause from step 2's log check, fix it and remove the temporary `_contextSnippet()` diagnostic (or leave it — it's harmless and additive; Boss's call).
5. Once confident in Language & Structure and Cross-References: continue the rest of the Phase 3 test plan (spot-check passages, malformed-data test, lexicon pass) per `spec-ai-tools-grounding-v1.md` §5.1.
6. If Phase 3 fully passes: Phase 4 — remove the `/groq` emergency lockdown (Boss pastes Worker code into Cloudflare dashboard).
7. Circle back to the `DIAGNOSTIC` debug-line removal (confirm with Boss first — now doubly worth it, the `max_tokens` it displays is wrong), Scripture Memory edit feature + apostrophe fix, and the "Go Deeper" grounding gap, per Boss's priority.
