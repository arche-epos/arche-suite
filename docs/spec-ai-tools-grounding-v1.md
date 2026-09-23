# AI Study Tools Grounding Spec v1.0

**Status:** DRAFT — awaiting Boss sign-off before implementation.
**Origin:** `pilgrim-ai-tools-fabrication` bug report, Sep 23 2026 — Word Study, Language & Structure,
and Cross-References were fabricating Strong's numbers, inventing Greek text presented as direct
Scripture quotations, and citing unverifiable named scholars. Root cause: all six AI Study Tools
call `openai/gpt-oss-120b-Turbo` (`Reasoning: low`) with zero retrieval grounding — the model is
free-generating exact-token content (numbers, word forms, citations) it has no way to verify.
**Emergency mitigation already live:** `/groq` on `arche-proxy` blocks AI tool calls for any
tester ID other than Jesse's two PINs (5332, 8144). Login and the rest of the app are unaffected.
This spec is the real fix that lets the lockdown come off.
**Scope of this phase:** Word Study, Language & Structure, Cross-References only. Historical,
Cultural, and Places & Geography are explicitly deferred — see §7.
**Target version:** TBD (minor+ — new data files, prompt rewrite for 3 of 6 tools, no breaking
change to saved study data).

---

## 1. Why grounding, not better prompting

A prompt can tell the model to "be careful" or "cite real sources," but it cannot give the model
a way to check whether the exact number or word form it's about to output is correct — the model
has no memory of what's true, only of what *sounds* true. The only structural fix is to stop
asking the model to *recall* facts and start asking it to *explain facts we hand it*. That
requires real source data, fetched before the AI call, injected into the prompt as ground truth,
with the model instructed to describe only what it was given.

This closes fabrication for content that has a checkable real-world answer (a Strong's number, a
Greek word, a cross-reference). It does **not** make the model's prose commentary infallible — see
§6 for what this guarantees and what it doesn't.

---

## 2. Data sources

All three sources below are freely licensed, already compiled by others, and require no
purchase or API key.

| Source | Covers | License | Used by |
|---|---|---|---|
| **MACULA** (Clear-Bible/Biblica) | 613,690 Greek NT + Hebrew/Aramaic OT words, each tagged with lemma, Strong's number, morphology (part of speech, tense/mood/voice/case), and gloss | CC BY 4.0 | Word Study, Language & Structure |
| **Strong's Hebrew & Greek Dictionaries** (OpenScriptures) | Full definition text for every Strong's number | CC BY-SA (tagging) / Public Domain (underlying Strong's/BDB text) | Word Study |
| **OpenBible.info Cross-References** | ~345,000 ranked cross-references, sourced from the public-domain Treasury of Scripture Knowledge, community vote-weighted | CC BY | Cross-References |

Attribution requirements (CC BY / CC BY-SA) are satisfied with a credit line in the app's About/
Credits screen and a comment block in the transformed data files — no per-response attribution
needed.

---

## 3. Pipeline: raw data → hosted lookup files

We do **not** point the live app at the raw datasets — they're shaped for research (huge
multi-column files, one 49MB cross-reference table), not for "give me the data for John 3:16."

**One-time transform** (done once per dataset, re-run only if upstream data updates):
1. Download the raw MACULA and OpenBible.info source files.
2. Reshape into **one small JSON file per Bible book**, keyed by verse:
   - Lexical/grammar file (`data/macula/<book>.json`): for each verse, the ordered list of
     original-language words, each with `{word, lemma, strongs, morph, gloss}`.
   - Cross-reference file (`data/crossrefs/<book>.json`): for each verse, its top-N ranked
     cross-references (capped — see §5.3).
3. Commit the transformed files to the `arche-suite` repo under a new `data/` folder, versioned
   in git like everything else in the suite.

**Hosting:** served via **jsDelivr** (`cdn.jsdelivr.net/gh/arche-epos/arche-suite@main/data/...`),
which mirrors the public GitHub repo with CDN caching at no cost and no new Cloudflare bindings.
No change to `arche-proxy` needed for this.

**Runtime fetch:** the client fetches the one small per-book file for the active reference's
book (same pattern already used for ESV/bolls.life lookups), extracts the verse(s) in scope, and
passes that extracted slice — not the whole book file — into the AI prompt as ground truth.

---

## 4. Per-tool changes

### 4.1 Word Study
- Fetch the MACULA words for the target verse(s) + look up each word's Strong's number in the
  Strong's dictionary file for its full definition text.
- Prompt no longer asks the model to "identify" a Strong's number or write a definition from
  memory — it receives the real word, lemma, Strong's number, and dictionary definition, and is
  asked to explain semantic range, plain reading, and disputed points **about the supplied word**.
  The model may not introduce a Strong's number, original word, or definition not present in the
  supplied data.

### 4.2 Language & Structure
- Fetch the MACULA words + morphology tags for the passage.
- Prompt is rebuilt around explaining the **real** parsing (tense/mood/voice/case as actually
  tagged) in plain language — never asked to "quote" the Greek/Hebrew text, since the real text is
  already supplied verbatim from the data file, not generated.

### 4.3 Cross-References
- Fetch the ranked cross-reference list for the passage from the OpenBible.info file.
- Prompt asks the model to group and explain the **supplied** references (direct/thematic/
  narrative categorization, connection description) — it may not add a reference not in the list.

### 4.4 Shared prompt rule (new, all three tools)
Every prompt for these three tools gets an explicit, structural constraint: *"You are given the
verified source data below. You may explain, categorize, and describe it. You may NOT state a
Strong's number, original-language word, or cross-reference that does not appear in the supplied
data. If the supplied data doesn't cover something, say so — do not fill the gap."*

---

## 5. Verification pass (the mechanical guarantee)

Grounding the input reduces fabrication; it doesn't guarantee the model won't add something from
memory anyway on a long response. The guarantee comes from checking the *output*:

1. After the AI responds, before rendering, the client extracts every Strong's number and every
   original-language word token from the response text (regex-scannable — Strong's numbers are
   `G####`/`H####`, original-language words are the tagged script).
2. Each extracted token is checked against the verified data slice that was actually sent in that
   request's prompt.
3. Anything that doesn't match is stripped from the rendered output and logged (tool name,
   passage, the unmatched token) to the existing `PILGRIM_ANALYTICS` error-log pattern already
   used for other diagnostics — so drift is visible and fixable, not silent.
4. Cross-References gets the equivalent check: every reference cited in the response must appear
   in the supplied ranked list for that passage.

This is what turns "the AI was told the real data" into "the app cannot display a fabricated
number" — enforced in code, not requested in a prompt.

### 5.1 Test plan (must pass before the emergency lockdown comes off)
- Re-run the exact passage from the original bug report (Acts 2:1-13) through all three tools;
  confirm every Strong's number, Greek word, and cross-reference matches the source data exactly.
- Spot-check 5-10 additional passages spanning OT and NT, including at least one long passage
  (>10 verses) and one single-verse lookup.
- Confirm the verification-pass strip/log path actually fires on a deliberately malformed test
  case (temporarily feed the AI a prompt without the grounding data, confirm the output gets
  flagged/stripped rather than silently rendered).

### 5.2 Rollback / lockdown removal
Only after §5.1 passes: remove the `PILGRIM_PRIVATE_ALLOWED_PINS` gate on `/groq` in `arche-proxy`
(the block is clearly commented for easy removal — see the deployed Worker source).

### 5.3 Cross-reference cap
Cap displayed cross-references at a reasonable number per passage (e.g., top 8-10 by vote weight)
— OpenBible.info's data can return dozens of low-confidence matches for a single verse; capping
keeps the tool's output focused and keeps token/payload size sane.

---

## 6. What this guarantees, and what it doesn't

- **Fabricated Strong's numbers, Greek/Hebrew word forms, or cross-references: closable to zero,
  mechanically enforced** via §5's verification pass.
- **Fabricated named-scholar citations in these three tools: closable to zero** by removing the
  instruction to cite named scholars from these prompts entirely (Word Study/Language &
  Structure/Cross-References don't need named citations the way Historical/Cultural do).
- **AI interpretive commentary being subtly wrong** (the "plain reading," the "disputed" note, the
  explanation of *why* two verses connect): reduced by grounding the facts underneath it, but not
  eliminated — this is true of any AI-written prose. Mitigation is honest labeling, not a false
  claim of zero risk.

### 6.1 Labeling (UI requirement)
Every response from a grounded tool carries a visible marker distinguishing **verified data**
(the Strong's number, the word, the cross-reference itself — sourced, exact) from **AI-written
explanation** (everything built around it). This directly targets the actual failure mode from
the bug report: fabricated and correct content looked visually identical. They should not, going
forward, for these three tools.

---

## 7. Explicitly out of scope for this phase

- **Historical Context, Cultural Context:** no equivalent structured, verifiable dataset exists.
  These stay AI-generated for now. Interim mitigation (prompt-level only, not part of this spec's
  build): forbid specific named-scholar-plus-year citations unless the source is a genuinely
  well-known, real, checkable figure; require hedged language ("many conservative scholars hold…")
  instead of invented specificity. Real grounding here (e.g., web-search-based retrieval) is a
  future brainstorm, not this spec.
- **Places & Geography:** not currently exhibiting the fabrication pattern (well-known place names
  are heavily represented in training data); left untouched. A gazetteer-based hardening could be
  a later, lower-priority pass.
- **Model/provider change:** this spec doesn't change the underlying model or reasoning effort —
  grounding + verification is the fix, not a bigger model. Worth revisiting separately if grounded
  tools still show a meaningfully high strip rate in §5's logging after launch.

---

## 8. Open items for Boss sign-off

- [ ] Confirm `data/` as the repo folder name for the transformed lookup files (or propose another).
- [ ] Confirm jsDelivr-over-GitHub-Pages as the hosting approach (vs. serving from `pilgrim-private/`
      directly, which would also work but bypasses CDN caching benefits).
- [ ] Confirm cross-reference cap count (§5.3) — default proposed: top 8.
- [ ] Confirm this spec's scope (3 tools) matches intent before implementation begins.
