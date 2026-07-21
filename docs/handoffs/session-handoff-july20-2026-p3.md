# Session Handoff — July 20, 2026 (Session 3)

**Type:** Planning / verification session — no code written, no files deployed, no version bumps.

---

## Decisions made this session

### 1. CSS Extraction (Pilgrim Private)
Boss's friend suggested separating CSS from the HTML shell now that ES Modules are in
place. Agreed this is a reasonable next step (consistent with the ES Modules direction),
but **sequenced after Playwright test coverage exists** — so any regression from the
extraction (especially the known CSS-cascade bugs in MKB A14: `.scr{display:none}`
desktop breakpoint, `#desktop-main` flex rules) gets caught automatically rather than
requiring another full manual QA pass.

**Scope confirmed:** Pilgrim Private only (`dev` branch). Not Public, not suite-wide.
**Status:** Deferred, not started. Resume after Playwright + Gemini OCR migration below.

### 2. Playwright Test Suite — full spec agreed
| Decision | Answer |
|---|---|
| Coverage | Full — all 21 sections of `pilgrim-functional-test-v2.md` mapped to tests |
| Location | `pilgrim-private/tests/` (alongside existing `bridge-check.js`) |
| Target | Live site — `archestudytools.com/pilgrim-private/` |
| External API calls | **Real**, not mocked (Boss's call — see Gemini migration below re: rate-limit mitigation) |
| Auth for mutating/destructive tests | **QA Test PIN: `5332`** |

**Data safety finding (verified against live code this session):** Confirmed safe to
run destructive/sync tests (Clear All Data, delete study, force pull, etc.) under the
test PIN against the live site. Pulled `pilgrim-private/sync.js` from `main` directly
via GitHub API and confirmed `gistFilename()` gives every non-Jesse user their own file
within the shared Gist (`arche-pilgrim-<userId>.json` vs. Jesse's
`arche-pilgrim-studies.json`). Push/pull/force-pull/Clear-All all resolve through
`gistFilename()` — the test PIN's data is fully isolated from Jesse's real synced
studies. No separate test-only sync pathway will be built — tests call the real
`syncToGist`/`syncFromGist`/`gistFilename()` functions as-is, authenticated as PIN 5332,
so future sync-logic changes get tested automatically (Boss's explicit preference —
avoids a parallel path someone forgets to update).

**Not yet built:** No Playwright scaffolding, config, or test files exist yet. This is
the next session's starting work, after the Gemini OCR migration below.

### 3. Groq → Gemini OCR Migration — approved, scoped, not yet built
Boss's reasoning: hitting Groq's OCR rate limit during *manual* solo testing means
automated Playwright runs (repeated, regular) are very likely to hit it harder —
pulling forward the trigger condition in `spec-gemini-ocr-backup-v1.md` rather than
waiting for a second incident.

**Scope — confirmed explicitly by Boss:** OCR route only. AI Study Tools (Word Study,
Historical Context, Cultural Context, Cross-References, Places & Geography, Language &
Structure) **stay on Groq** (`openai/gpt-oss-120b`) — no quality/capacity issues there,
this is not a full provider migration.

**Build plan already specced** — see `spec-gemini-ocr-backup-v1.md` in Project
Knowledge, Build Order section:
1. Generate Gemini API key at ai.google.dev, add `GEMINI_API_KEY` secret on `arche-proxy`
2. Add `/gemini-ocr` route to `arche-proxy.js` (code already drafted in the spec — new
   route, does not replace `/ocr`, both can coexist during cutover)
3. Confirm exact OCR call site in live `studyTools.js`, swap fetch target + payload
   shape (`{image, mimeType}` in, `{text}` out — normalized at the Worker so the client
   change is minimal)
4. Test against the same problem resource (antique document photo) used in the original
   July 20 rate-limit incident session, compare output quality directly
5. Version bump + changelog entry noting the provider split (OCR: Gemini, AI Tools: Groq)

**Rollback safety:** `/ocr` (Groq) stays live and unchanged during cutover — reverting
is a one-line change back in `studyTools.js` if Gemini underperforms.

**Not yet built:** Nothing from this plan has been executed. Next session starts here.

---

## Next session — start order

1. Read this handoff + confirm `pilgrim-private` live version hasn't drifted (last known: v4.15.2, post-merge)
2. Execute Gemini OCR migration (steps above, ~30–45 min per spec)
3. Scaffold Playwright: config, base fixtures (test PIN 5332 auth), directory structure in `pilgrim-private/tests/`
4. Begin implementing tests in batches mapped to the 21 functional-test-v2 sections (not all at once — batch + verify each)
5. Once full Playwright coverage is running clean: resume CSS extraction (Pilgrim Private only)

## Open items carried forward (untouched this session)
- Playwright test implementation (all 21 sections) — not started
- CSS extraction — deferred until after Playwright, per above
- MKB update pass — still doesn't reflect this session's findings (Gemini OCR approval, Playwright spec decisions, sync.js Gist isolation confirmation). Recommend folding into next session's work once Gemini migration + Playwright scaffolding are actually deployed, rather than updating MKB for planning-only decisions.

---

*session-handoff-july20-2026-p3.md — Arché Study Tools*
