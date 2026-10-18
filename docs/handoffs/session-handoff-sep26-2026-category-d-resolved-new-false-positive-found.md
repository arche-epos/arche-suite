# Session Handoff — Sep 26, 2026: Category D closed (was a misread), new false-positive class found (grammatical-example words)

**Repo state:** `arche-epos/arche-suite`, `main` @ `0adf68c72cc983e8cd075ef1f98aa1887956ac10` (v4.38.6) — no code changes this session, diagnosis only.

---

## What happened this session

Picked up the top open lead from `session-handoff-sep23-2026-ai-tools-grounding-phase3-part2.md`: check pilgrim-admin's error log for the κατοικοῦντες strip flagged live during Phase 3 testing, using the `_contextSnippet()` diagnostic shipped at v4.38.5.

### Step 1 — pulled the log
Boss exported pilgrim-admin's diagnostics (`pilgrim-admin-full-export-2026-09-26_222857.json`). Found two grammar strips from the Sep 24 QA Test session on Acts 2:1-13, both carrying the new `context` field:

- `συνεχόμενοι` — context: `"οικοῦντες**, **συνεχόμενοι**, **διαχλευάζ"`
- `εἰ` — context: `"rotasis with **εἰ**; the logical"`

### Step 2 — cloned `arche-suite`, checked both against real MACULA source data
Pulled the full word list for Acts 2:1-13 directly from `data/macula/44.json` (all 13 verses, 150 words) and checked both flagged tokens against it, plus read `verifyGroundedOutput()`, `_replaceIsolatedToken()`, and `_contextSnippet()` in `studyTools.js`.

**Category D (κατοικοῦντες mid-word split) — closed, was a misread, not a bug.**
Last session's live read saw `κατοικ[unverified original-language text removed]` and concluded κατοικοῦντες itself had split mid-word — the same shape as the v4.38.2 ἐγένετο bug. The log's context field shows the opposite: κατοικοῦντες (Acts 2:5, genuine) renders completely intact. The word that actually got flagged is `συνεχόμενοι` — a separate, later word in the same list (Acts 2:5-6's run of words: κατοικοῦντες, ..., συνεχόμενοι [fabricated], ..., διαχλευάζοντες). Confirmed in code: `_replaceIsolatedToken()`'s lookaround regex (`(?<![GREEK_HEBREW_CLASS])token(?![GREEK_HEBREW_CLASS])`) only matches a token as a complete standalone run — it cannot partially consume an adjacent word. κατοικοῦντες was never touched. The real word simply butts up against the `[unverified...]` replacement with no space, which read as one broken word at a glance during live testing.

**No code fix needed for Category D.** `verifyGroundedOutput()` / `_replaceIsolatedToken()` are working as designed. The `_contextSnippet()` diagnostic did its job — this is exactly the kind of misdiagnosis it was added to prevent, and it worked the first time it was actually needed.

**συνεχόμενοι — confirmed genuine fabrication, correctly stripped.**
Pulled the complete word list for Acts 2:1-13 from MACULA. `συνεχόμενοι` does not appear anywhere in the real Greek text of this passage — not a wrong-case/wrong-word substitution (Category B/C), a fully invented word inserted into an otherwise-real list. The verifier caught it correctly; this occurrence is not a defect.

**εἰ — new, uncategorized false-positive class found.**
Context (`"rotasis with **εἰ**; the logical"`) shows the model discussing a grammatical concept — "protasis with εἰ" describes a conditional clause — not claiming εἰ appears in the passage. Confirmed εἰ does not occur anywhere in Acts 2:1-13's real word list, so the strip is technically correct per the current rule (word not in `allowedWords` → strip), but the *intent* wasn't to cite passage text — it was legitimate grammatical exposition using a standard example word from outside the passage. The current verifier has no way to distinguish "quoting/claiming this is in the passage" from "using a Greek term to explain a grammar point." This is a fifth failure category, distinct from A (accent/case) / B (wrong case) / C (wrong word) / D (mid-word split, now closed) — call it **Category E: legitimate off-passage grammatical terminology stripped as if fabricated passage text.**

---

## Net effect on Phase 3 status

- The top open lead from the prior handoff (Category D root cause) is resolved: **there is nothing to fix.** The `_contextSnippet()` diagnostic can be removed or left in place per Boss's earlier call (harmless either way) — no longer blocking on new Category-D evidence.
- Confidence in the Category A fix (v4.38.4) and the Category B/C mitigation (v4.38.5/4.38.6) is **not changed** by this session — neither strip examined here was a B/C recurrence.
- A new, real issue is open: **Category E false positives** in Language & Structure, whenever the tool's explanatory prose cites a Greek/Hebrew example word that isn't literally in the passage being studied. Not yet scoped for a fix — needs a decision on approach (e.g., detect words inside explanatory prose vs. words presented as passage quotes; or allow a small fixed set of common grammatical-example particles; or restructure the prompt to avoid citing bare original-language terms outside quoted passage text).

---

## Next session should

1. Decide on and scope a fix for Category E (off-passage grammatical-example words being stripped). Options to weigh: prompt-level (tell the model to avoid bare Greek/Hebrew terms in explanatory prose, paraphrase or transliterate instead) vs. verifier-level (some way to distinguish quoted-passage tokens from cited-example tokens — likely harder, since plain text doesn't mark the difference reliably).
2. Resume the rest of the Phase 3 test plan (spec-ai-tools-grounding-v1.md §5.1), now unblocked from the Category D question:
   - Spot-check 5-10 more passages, OT + NT, one long (>10 verses), one single-verse
   - Malformed-data strip/log test
   - Lexicon-specific pass (Word Study search box)
3. Once Phase 3 fully passes: Phase 4 — remove the `/groq` emergency lockdown.
4. Still carried, untouched: `DIAGNOSTIC (temporary)` debug-line removal, Scripture Memory edit feature + apostrophe fix, "Go Deeper" grounding gap.
