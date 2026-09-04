# Codex Arête — Master Project Handoff for Unified Chat
**Created:** August 15, 2026 (first version — consolidates `session-handoff-aug10-2026-codex-pin-accounts.md` and `session-handoff-aug10-2026-codex-ai-tutor-fixes.md`, both now safe to archive to `docs/handoffs/`)
**Current Version:** v3.6.4 — confirmed live Sep 4, 2026 via direct fetch (was v3.6.3 here
and v3.3.2 in the MKB P1 registry — the two disagreed with each other and both were wrong;
both corrected this pass, see MKB A16). Reconfirm at next session start, don't assume.
**Repo:** `arche-epos/arche-suite`
**Live URL:** archestudytools.com/codex/
**Purpose:** Homeschool coding curriculum. Boss's daughter (Alivia) is an active enrolled student.

---

## HOW TO USE THIS DOCUMENT

Read this before writing any Codex code. This is the authoritative Codex-specific reference — same role as `DPS_HANDOFF_MASTER.md` plays for DPS. Regenerate/fold in new sections as features land; don't let it go stale the way `DPS_HANDOFF_MASTER.md` did (2 months, 2 major features behind before its last regen).

---

## PART 1 — TECH STACK

- Vanilla JS, single-file HTML — no build step
- Cloudflare KV (`CODEX_USERS`) for PIN-based multi-student accounts
- Groq AI for AI Tutor (in-lesson) and DevTools mentor prompts
- `arche-proxy` Worker routes: `/codex/user/create`, `/codex/users/list` (others per Worker code — verify against live `arche-proxy.js` when needed, see known-stale note in MKB/Project Knowledge audit Aug 15 2026)
- GitHub Pages hosting via `arche-epos/arche-suite`, Claude deploys directly via Git Data API (dev PAT)

---

## PART 2 — ACCOUNT SYSTEM (PIN Accounts, Issue #18 Piece 1 — SHIPPED)

**Design:** Admin role (parent, sees all students) + Student role. Both KV-dashboard and in-app (passphrase-gated) creation supported.

**Bootstrap vs. in-app creation pattern:**
- `CODEX_SETUP_KEY` passphrase gates only the very **first** (bootstrap) account
- Every account created from inside an authenticated Admin dashboard session is authorized via `requestedBy` (the signed-in admin's own id) instead of re-entering the setup key
- Worker (`/codex/user/create`): destructures `requestedBy`, looks up the requester's own record, confirms `role === 'admin'` before allowing skip of the `setupKey` check
- **Reusable pattern** — worth reapplying if Mentor or another PIN-gated app ever needs the same "admin creates without re-entering setup key" flow

**Client:** "+ Add Student" button (top of Admin dashboard) → Name + 4-digit-PIN modal, no passphrase field required for in-session creates.

**Still pending (Issue #18 pieces 2–3, confirmed scope, not built):**
- Mastery gating — 75% / 6-of-8 threshold
- Idle-aware time tracking — 5-min auto-pause
- Issue #19 (automated progress reports) is blocked on #18 completing fully

---

## PART 3 — AI TUTOR

**Known-fixed bug (v3.6.2→v3.6.3):** `sendAiMessage()` had a guard `if(_aiLoading || _aiLesson === null) return;` that silently blocked sending whenever the AI Tutor was opened outside an active lesson (e.g. from the Dashboard FAB) — a legitimate, intended entry point. No error, no toast, just a dead Send button. Fixed by removing the `_aiLesson === null` half; `getAiChat()`/`_callAi()` handle a null lesson id fine.

**Pattern worth watching elsewhere:** this was a defensive guard added without a matching UI affordance (no toast, no disabled-state styling). Worth a sweep of other silent-return guards in Codex — and Mentor, which shares patterns — if similar "nothing happens" reports come up.

**Prompt quality guardrails added:**
- **"Seek first to understand"** — first teaching guideline in both system prompts (Pilgrim tutor + DevTools mentor). Vague messages ("I need help") get one short clarifying question first instead of a full unsolicited lesson dump.
- **On-topic guardrail** — AI redirects off-topic questions back to the lesson in one brief line, instructed not to answer-then-redirect. **This is a prompt-level guardrail, not a hard filter** — a determined student could work around it with clever phrasing. A true topic-classifier gate would be a separate, heavier future build if stronger enforcement is ever needed.
- **Plain-text formatting rule** — no markdown tables/headers/bold in either system prompt (AI Tutor renders in a chat bubble, not a document). Client-side `**bold**` → `<strong>` safety net added in `formatAiText()` since raw `|` and `###` characters were rendering literally before the prompt fix.

---

## PART 4 — TTS (Open Decision — Not Yet Built)

**Problem:** Alivia uses DuckDuckGo Android, which doesn't implement the Web Speech API Codex's TTS relies on — TTS silently doesn't work for her.

**Three options on the table, none built:**
| Option | Approach | Cost |
|---|---|---|
| A — No code | Bookmark/shortcut Codex in Chrome or Edge for her specifically — both support `speechSynthesis` | Zero-cost, works today |
| B — Real build | Server-side TTS via Groq's TTS model, playback via `<audio>` tag — works in any browser | Costs API credits per lesson played, adds generation latency, needs new Worker route + client TTS-player rework. Multi-session scope |
| C — Small build | Browser-detection fallback message ("TTS isn't available in this browser — try Chrome or Edge") instead of a silently broken button | Smallest to build; doesn't give her real TTS, just explains the gap. Was already on the original Priority 2 TTS punch list, never built |

**Decision needed from Boss before any code work on this.**

---

## PART 5 — UI TERMINOLOGY (v3.5.1, shipped)

Simplified app chrome — **lesson/quiz curriculum content intentionally excluded**, since students are learning terms like "Gist" and "spaced repetition" on purpose:
- About screen: dropped "Ebbinghaus" jargon, "Spaced Repetition Intervals" → "Review Schedule," dropped "GitHub Gist" mention from Study Sync description
- **Pull/Push → Restore/Backup** — buttons + all sync status toasts (Restoring.../Restored/Restore failed/Restore error, Backing up/Backed up/Backup failed/Backup error)
- Insights: "Avg Conf" → "Confidence," "Impromptu Test History" → "Practice Test History," "Groq reads your progress..." → "AI reads your progress..."

---

## PART 6 — GRADING & PACING (v3.5.2, shipped)

- Pass threshold **70% → 75%**, applied everywhere: About screen, Knowledge Check quiz meta/logic, AI grading threshold (fill-in-blank/free-response), Impromptu Test panel meta/logic, Insights history coloring
- Review Schedule (About screen table) and confidence-rating star labels now render dynamically from the logged-in student's actual `currentUser.pace` (accelerated or standard) via `renderReviewSchedule()` and `getConfLabels()` — replaced 3 duplicated hardcoded label arrays
- Neither screen names which pace the student is on, only actual day counts, per Boss's requirement

---

## PART 7 — VERSION HISTORY (through v3.6.3)

| Version | What shipped |
|---|---|
| v3.3.8 | TTS bug fix — scoped `padding-left:24px` on `<ol>`/`<ul>` inside `.lesson-section` so list markers clear the TTS active-section bar |
| v3.5.1 | UI terminology sweep (Part 5) |
| v3.5.2 | 75% pass threshold + pace-aware review schedule (Part 6) |
| v3.6.0 | Admin "Add Student" — client + Worker (Part 2). Worker deployed by Boss |
| v3.6.1 | Version display added to Admin dashboard topbar + PIN login screen |
| v3.6.2 → v3.6.3 | AI Tutor bug fixes (Part 3) |

**Known dashboard bug, unresolved as of last check (July 14 2026 audit, may still be live — verify):** in-app dashboard reads a `CODEX_VERSION` constant that was frozen at `3.3.0` — a June 24 2026 deploy script regex expected a leading `v` inside quotes, live constant has none, so it silently no-op'd on version bumps. Footer text bumps correctly via plain string replace; the dashboard constant may not. Fix was queued, not actioned as of that audit — confirm current state before assuming it's fixed.

---

## PART 8 — OPEN ITEMS / BACKLOG (as of Aug 10 2026 source handoffs — reconfirm at session start)

| Priority | Item | Notes |
|---|---|---|
| FIRST | TTS on DuckDuckGo decision (Part 4) | Pick an option before other code work |
| Issue #18 piece 2 | Mastery gating (75% / 6-of-8) | Confirmed scope, not built |
| Issue #18 piece 3 | Idle-aware time tracking (5-min auto-pause) | Confirmed scope, not built |
| — | Verify Alivia's progress state via `/codex/users/list` before she opens the app again | Real lesson locking active since v3.4.1, may gate lessons she hadn't expected |
| Issue #19 | Automated progress reports | Blocked on #18 fully completing |

---

*CODEX_HANDOFF_MASTER.md · Created August 15, 2026 · v3.6.3 · Source handoffs (`session-handoff-aug10-2026-codex-pin-accounts.md`, `session-handoff-aug10-2026-codex-ai-tutor-fixes.md`) now safe to archive to `docs/handoffs/` per Handoff Archive SOP.*
