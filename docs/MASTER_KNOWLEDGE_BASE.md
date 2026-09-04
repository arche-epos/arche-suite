# MASTER KNOWLEDGE BASE v3
## Jesse Caldwell — Single-File Web Apps
### Projects: Arché Study Tools (Pilgrim + Scribe) · Waypoint · DPS Daily Planner
*Consolidated: April 23, 2026 — synthesized from all handoff docs, known-issues files, and Worker v2.0 spec through Waypoint v2.1.5*

**Doc Version: v3.7.6** | *Last updated: September 4, 2026*

> **Versioning scheme:** Filename (`v3`) only changes on full structural overhaul. Internal version follows semver: Minor bump (3.1→3.2) = new sections or major SOP changes; Patch bump (3.x.0→3.x.1) = corrections or small additions. Update the changelog below on every edit.

### Document Changelog
| Version | Date | Summary |
|---|---|---|
| v3.7.6 | Sep 4, 2026 | **Full documentation audit** (`project-docs-eval-sep04-2026.md`) found the P1 registry itself was badly stale -- corrected here: **DPS** row was showing v32.9.2 (July 14) despite a later note in Part 4 already saying v32.18.0; live is now **v32.28.2** (Sep 3 -- new Mock Call Bank feature, Seating Chart print export, agent-roster fixes; `DPS_HANDOFF_MASTER.md` and both modularization-prep specs are also stale against this and need their own re-baseline, tracked separately, not fixed in this pass). **Codex** row was showing v3.3.2 while `CODEX_HANDOFF_MASTER.md` separately claimed v3.6.3 -- the two docs disagreed with each other, and both were wrong; live is **v3.6.4**. **pilgrim-admin** row corrected from v1.2.0 to live **v1.6.0** (mobile table-scroll fix, JSON export system, refresh/export toasts, AI Tool Run Timing card -- four shipped features this row didn't reflect). **Pilgrim Private** row corrected v4.29.0 -> **v4.30.3**. **Pilgrim Public** and **Scribe** "unverified" labels changed to "confirmed live Sep 4, 2026" after direct fetch confirmed both still match (v4.1.1 / v2.1 respectively -- no drift, just a stale label). **Structural fix, not just a number fix:** this pass also pushed this file, `CODEX_HANDOFF_MASTER.md`, and several long-lived specs into `arche-epos/arche-suite/docs/` on GitHub (previously PK-only, no version history, no diff, no automated backup coverage) -- see new A9 section. `sync-config.json` (Arché local backup) updated to track `pilgrim-admin` (previously completely absent from the backup app list despite being a real deployed app since Aug 30) and the newly-added docs. |
| v3.7.5 | Sep 1, 2026 | **Corrected Part 4 (DPS) header + line 1795 sync-approval claim.** Brent Appleby (former manager) superseded by Jonathan Whisman — no longer relevant to DPS approvals. Corrected stale claim that cross-device sync is "blocked on Brent's approval": `dps-vault` has actually been live and running unapproved since v32.9.0 (June 22, 2026). No formal approval exists or is being sought; sync is left running as-is. If pursued later, planned approach is a shared network-drive folder, not `dps-vault`/Cloudflare — see `dps-standalone-arch-spec-v1.md` v1.1 §1a. Also fixed Part 4 header relic (`HANDOFF_27 \| ~7,583 lines`, predating v32.x versioning) to reflect live v32.18.0 / ~16,140 lines. |\n| v3.7.4 | Aug 30, 2026 | **P1 Pilgrim Private caught up** from stale v4.17.0 to live **v4.29.0** — ~12 versions of untracked history folded in: usage tracking v1→v3, pilgrim-admin dashboard (new app), TTS/dirty-flag/tool-scope/tour/upload beacons, photo-resource stub guard (Aug 25 wipe-bug fix), Diagnostics & Error Log feature. **New P1 row added for pilgrim-admin** (v1.2.0), previously undocumented despite being a real deployed app. **Corrected A8's v3.7.2 reconciliation note** — it had the two `arche-proxy.js` copies backwards; the local backup folder was reconciled (current as of Aug 24), the PK copy is the one still pending re-upload. Manual round-trip test status of the new Diagnostics & Error Log feature is unknown — flagged for Boss to confirm. **DPS_HANDOFF_MASTER.md separately regenerated same day** (not tracked in this doc's changelog — see that file's own version history): full catch-up from v32.9.2 to live v32.17.2, ES Modules migration status folded in (classic-script-split path confirmed, not started), three "known bugs" resolved and closed out. |
| v3.7.3 | Aug 25, 2026 | Added **XP-21** (Self-Check Functions Silently Break When Their Target File Moves in a Refactor) — Pilgrim Private's `checkForUpdate()` update banner had been silently broken since the July 19 ES Modules migration moved `CHANGELOG` out of `index.html` into `utils.js`; the function's own fetch/regex kept targeting the old location with no error surfaced. Fixed same session (v4.28.1). |
| v3.7.2 | Aug 25, 2026 | **A8 (arche-proxy) corrected and brought current** — confirmed live against `arche-proxy.js` local backup copy (Boss-pasted Aug 24 2026, verified accurate). `/groq` route migrated from Groq (`llama-3.3-70b-versatile`, itself stale — actual pre-migration model was `openai/gpt-oss-120b`) to **DeepInfra** (same model string, same MXFP4 quantization, OpenAI-compatible endpoint), migration executed and smoke-tested successfully Aug 25 2026 against Pilgrim Private's Places & Geography tool. `GROQ_API_KEY` retained as rollback only. **Corrected a standing factual inversion**: A8 previously stated OCR runs through Groq vision and that Gemini OCR was retired — this was backwards. Actual state since July 20, 2026 (v4.15.3): OCR runs on **Gemini 3.5 Flash** via `/gemini-ocr`; Groq `/ocr` (Llama 4 Scout) is the *retired-in-practice* route, kept live only as an unused rollback path. Added missing secrets (`GEMINI_API_KEY`, `DEEPINFRA_API_KEY`, `GITHUB_PROXY_SECRET`) and missing routes (`/gemini-ocr`, `/feedback`, full Mentor + Codex route lists) to the table. Removed stale local-dev CORS origins (`127.0.0.1:5500`, `localhost:5500`) — confirmed not present in current live file. **Flagged for later reconciliation:** the `/mnt/project/arche-proxy.js` copy in Project Knowledge itself is separately stale (predates July 20 Gemini OCR migration) — needs re-upload from the local backup folder once convenient; tracked in Claude's memory, not yet done. **[Correction, v3.7.4]:** the local backup folder copy (`Arché-Offline-Backup\cloudflare-workers-source\arche-proxy.js`) was updated to match live on Aug 24, 2026 and is now current — that reconciliation is done. The **PK copy** (`/mnt/project/arche-proxy.js`) is the one still pending re-upload; it still predates the Gemini OCR migration. Don't confuse the two — always trust the local backup folder over PK for this file (see A8 below). |
| v3.7.1 | Aug 16, 2026 | Corrected stale Pilgrim Private data via live GitHub audit of `arche-epos/arche-suite/pilgrim-private/` (7 files pulled and inspected directly): P1 version was stale at v4.15.2, actually v4.17.0 (Aug 3, 2026 — Short Link share fix live); P11 backlog item (PIN auth + per-user namespacing) was marked "In progress — blocked," actually fully live and confirmed via code inspection (Section 27, `ui.js`/`utils.js`). Playwright test scaffolding confirmed still NOT started as of this date despite `dev→main` merge completing July 19 — remains the real next workstream. |
| v3.7.0 | July 24, 2026 | **Memory → MKB migration (Bucket B).** Landed all standing rules previously held only in Claude's project memory: guiding principle (HOW TO USE); P0.6 Model-Swap Protocol (Fable/Sonnet); P0.5 manual-backup discipline bullet; P1.5 Tester Roster + discretion rule; P5 External Accounts + Git Data API deployment patterns; U11 Code Placement & Documentation Discipline; U12 Untrusted-Until-Verified SOP; U13 Ship-Time Hygiene & Deploy Verification SOP (Quick Reference Card renumbered U11→U14); A1 port-to-Public reminder; A2 release-timing rule; D14 DPS working-model boundary. Redirect-stub clarity confirmed already covered by P1 repo note (no duplicate added). Work-schedule rule migrated to `jesse-caldwell-context-v1.md`, not the MKB. |
| v3.6.0 | July 22, 2026 | **ES Modules retrospective rollup.** Version reconciliation: filename had drifted to v3-5-4 while internal changelog stopped at v3.3.1 (entries v3.3.2–v3.5.4 unaccounted); jumped to v3.6.0 to guarantee uniqueness — filename and internal version now locked together going forward. Backfilled missing XP-10 through XP-15 (referenced by es-modules-lessons-v1.md since June 24 but never landed in MKB — dropped at an 85% session cutoff). Added XP-17 (long-lived branch misses main hotfixes), XP-18 (structural rewrite blocks auto-merge — two-parent merge tree), XP-19 (extraction spec drift — audit spec vs. live code first), XP-20 (Service Worker serves stale modules through hard refresh). Registered `es-modules-lessons-v2.md` as the authoritative ES Modules / DPS-transition playbook. |
| v3.3.1 | July 19, 2026 | **Pilgrim Private `dev → main` merge complete and confirmed live** (v4.15.2, commit `ee575fdb9809ca43c2c0ff256e82832bf44672f3`). Structural conflict (monolith vs. ES Modules shell) resolved via hand-built 2-parent merge tree — dev's `pilgrim-private/` wins, main's independent changes (mentor rollout, codex update, archived handoffs, gist-uploader removal) preserved. Post-merge verification: bridge-check 358/358, syntax clean, no localhost leaks, Boss confirmed live with studies intact. Archived both July 19 merge-session handoffs to `docs/handoffs/`. Issue #8 (ES Modules migration) updated/closed. |
| v3.3.0 | July 20, 2026 | Corrected P5 credentials table: `github-proxy-2026-07-19` and `github-proxy-worker2.0` (regenerated) are two separate, intentional tokens — not a mismatch. Former is the deployed production token in Cloudflare (`github-proxy`'s `GITHUB_PAT`, powers feedback/commit/issue endpoints, value not tracked here, flagged for having no expiration date); latter is Claude's session/dev token for direct `api.github.com` calls (Sep 16, 2026 expiry, confirmed working). Added Cloudflare Worker-to-Worker Service Binding rule (error 1042 — plain `fetch()` to another Worker's `*.workers.dev` URL is blocked; must use Service Binding) to standing architecture notes. |
| v3.2.9 | July 18, 2026 | Corrected Pilgrim Private P1 version to v4.14.0 (was stale at v4.13.5). Live QA pass: Groups A–F all complete (Group D confirmed — "Footnotes" = Scripture panel in Notes tab; Group E complete — Snapshot got real Cancel button + progress modal, toast z-index bug fixed as byproduct, Copy Link/Share flagged a real secondary bug spun off to backlog; Group F confirmed complete by Boss). Added `spec-share-short-link-v1.md` to doc registry (Group E1 finding — Gmail native share target 400 error on long study URLs, backlog fix). Remaining QA: diagnostic pill selectors [21] not yet investigated; full 170-item re-pass decision still open before `dev→main` merge. |
| v3.2.8 | July 14, 2026 | DPS Supervisors row updated to sup-v4.5.1 (code fix shipped this session — `SUP_VERSION` synced to changelog top entry); `waypoint-reference-1.md` header corrected from v2.4.1 to v2.6.0 (doc-internal mismatch — its own VERSION HISTORY table already showed v2.6.0) |
| v3.2.7 | July 14, 2026 | Corrected Waypoint (v2.6.0) and DPS Supervisors (sup-v4.4.0) versions via uploaded live HTML; resolved sup-v3.3/sup-v4.2.1 numbering conflict; flagged supervisors.html's embedded stale DPS_VERSION constant (v32.8.1) for future investigation |
| v3.2.6 | July 14, 2026 | Logged CSBC KB v2 rebuild (real hosting `Gizmo5332/CSBC`, corrected palette/nav/status, delivered as CSBC_PROJECT_KB_v2.docx — see session-handoff-july14-2026-audit-part3.md) |
| v3.2.5 | July 14, 2026 | Corrected Codex live version to v3.3.2 (confirmed via GitHub fetch); logged CODEX_VERSION dashboard bug (constant frozen at 3.3.0, fix queued) |
| v3.2.4 | July 14, 2026 | Cross-app stale-data audit: corrected P1 versions for Pilgrim Private (v4.13.5), DPS (v32.9.2); flagged Waypoint, Codex, CSBC docs as stale (see session-handoff-july14-2026-audit.md) |
| v3.2.3 | June 26, 2026 | Added XP-16 (bridge coverage gate); Handoff Archive SOP in P0; updated A8 CORS origins + PAT in P5; arche-proxy Mentor routes noted |
| v3.2.2 | June 21, 2026 | Added GitHub PAT + proxy secret to P5 credentials table; P0 Step 3 now uses PAT directly via api.github.com; added rotation reminder (exp. Sep 19, 2026) |
| v3.2.1 | June 21, 2026 | P0 Step 1: added recent_chats review of last 3–5 conversations |
| v3.2.0 | June 21, 2026 | Added P5 GitHub Issues workflow; P0 confirmed SOP (files → issues → report) |
| v3.1.0 | June 21, 2026 | Fixed title (was "v2"); added internal versioning scheme + changelog; updated P0 with live GitHub verification step |
| v3.0.0 | Apr 23, 2026 | Initial consolidation (baseline) |

---

## HOW TO USE THIS DOCUMENT
**Guiding principle (non-negotiable): "Do what is best, not what is easiest."** Apply this to every stack, architecture, and design recommendation across all projects.

Read this before writing a single line of code on any project. Every bug documented here cost real debugging time. Every pattern here was proven in production. When starting a session on any project, read the relevant Part first, then check Part 1 for universal rules that always apply.

---

# PART 0 — MULTI-PROJECT CHAT SETUP

This knowledge base covers three projects in one Claude chat. Use this section to orient each session.

---

## P0. SESSION START PROTOCOL

**Execute these steps in order at the start of every new chat. Do not skip steps. Do not write any code until step 4 is complete.**

### Step 1 — Read Context Docs
- Read the most recent dated `session-handoff-*.md` in Project Knowledge (always latest date — never a fixed filename)
- Read this document (`MASTER_KNOWLEDGE_BASE_v3.md`) — at minimum P0–P5 and the relevant project Part
- Use `recent_chats` to pull the last 3–5 conversations and scan for any context, decisions, or carry-overs that may not have made it into the handoff doc

### Step 2 — Check Application Files on GitHub
Fetch the live HTML file for each active app and extract the deployed version number:

| App | Raw URL |
|---|---|
| Pilgrim Private | `https://raw.githubusercontent.com/arche-epos/arche-suite/main/pilgrim-private/index.html` |
| Pilgrim Public | `https://raw.githubusercontent.com/arche-epos/arche-suite/main/pilgrim-public/index.html` |
| Codex | `https://raw.githubusercontent.com/arche-epos/arche-suite/main/codex/index.html` |
| Scribe | `https://raw.githubusercontent.com/arche-epos/arche-suite/main/scribe/index.html` |

> ⚠️ For brand-new/just-pushed files use `codeload.github.com` tarballs or `git ls-remote` — not raw.githubusercontent.com (CDN can be stale). For existing deployed files, raw fetch is reliable.

### Step 3 — Check Issues on GitHub
Fetch open issues directly via the GitHub API using the PAT from P5 credentials:
```
GET https://api.github.com/repos/arche-epos/arche-suite/issues?state=open
Authorization: Bearer <GITHUB_PAT>
Accept: application/vnd.github+json
```

### Step 4 — Present Consolidated Report
Deliver one report before any work begins:
- **Current versions** — confirmed from live GitHub files
- **Open issues** — from GitHub Issues (number + title)
- **Session priorities** — carry-overs and open decisions from the handoff doc

---

## P0.5. HANDOFF ARCHIVE SOP

- **Current session handoff:** Project Knowledge only — one file at a time
- **At session start:** move previous handoff to `docs/handoffs/` on GitHub, then delete from PK
- **Full archive + index:** `docs/handoffs/README.md` on `arche-epos/arche-suite` main
- **PAT redaction:** Strip any live PAT strings before pushing a handoff to GitHub (secret scanning will block the push)
- **Bridge check gate:** Run `node tests/bridge-check.js` from `pilgrim-private/` before every `dev → main` merge
- **Manual backup discipline:** At meaningful milestones (major merges, structural migrations, large multi-file sessions, before/after risky Git Data API operations), Claude proactively reminds Boss — one brief line with a concrete method (`git clone` or GitHub's ZIP download) — to take a manual hard backup of the repo onto his own computer/Drive, independent of GitHub. A Claude-side tree/blob mistake could corrupt repo content before anyone notices. Standing habit, not a one-time task.

---

### Legacy chat prompt (deprecated — superseded by Project Knowledge SOP above)
```
Hi! I'm Jesse Caldwell ("Boss"). I'm working across three single-file HTML projects in this 
chat. I'm attaching this MASTER_KNOWLEDGE_BASE_v3.md as the project reference. Please read it 
fully before anything else, then confirm you're ready by listing all three projects, their 
current versions, and the top open issue for each. Address me as "Boss" throughout.
```

---

## P0.6. MODEL-SWAP PROTOCOL (FABLE / SONNET)

Boss runs Sonnet by default with a limited Fable credit budget. Claude manages the swap signals:
- **Flag Fable-tier tasks** with `⚡ Swap to Fable for this` — structural/multi-module refactors, merges, large file reassemblies, Playwright scaffolding, stubborn multi-file debugging
- **Signal return** with `✅ Back to Sonnet` when the heavy task is done
- Small patches, docs, commit messages, routine Q&A stay on Sonnet

---

## P1. PROJECT DIRECTORY

> ⚠️ **This table is a snapshot and will drift.** Live GitHub verification (P0 Step 2) is the
> primary source of truth for deployed version numbers. The most recent dated session handoff
> doc is the secondary source. This table is tertiary — update it when a handoff confirms a
> version bump, but never trust it over a live fetch.

| Project | Repo | Live URL | Stack | Current Version |
|---|---|---|---|---|
| Arché Study Tools (Pilgrim Private) | `arche-epos/arche-suite` | `archestudytools.com/pilgrim-private/` | Vanilla JS | **v4.30.3 -- LIVE ON MAIN, confirmed Sep 4, 2026 via direct fetch.** Since v4.29.0 (Aug 30): tester-tagging fix on diagnostic pings (v4.30.1), 30s cooldown on Run Full Diagnostics (v4.30.2), and **AI Tool Run Timing** (v4.30.3) -- per-tool last-5-runs + running average, individual tools timed server-side in the Worker, Snapshot timed client-side as its own full-batch entry. Manual round-trip test of Diagnostics & Error Log (flagged Aug 30) still unconfirmed -- carry forward. Bridge-check baseline clean. PIN auth + per-user namespacing confirmed fully live. Playwright test scaffolding (`pilgrim-private/tests/`) still NOT started -- remains the declared top-priority workstream. |
| Arché Study Tools (pilgrim-admin) | `arche-epos/arche-suite` | `archestudytools.com/pilgrim-admin/` | Vanilla JS | **v1.6.0 -- LIVE, confirmed Sep 4, 2026.** Boss-only analytics dashboard for Pilgrim Private. Since v1.2.0: mobile table-scroll fix (v1.3.2), full JSON export system incl. global "Export All" (v1.4.0), refresh/export toast feedback + timestamped export filenames (v1.5.0), and **AI Tool Run Timing card** (v1.6.0) -- per-tool last-5-runs + running average, includes Snapshot's full-batch entry. **Was completely absent from the local backup system (`sync-config.json`) despite being live since Aug 30 -- added Sep 4, 2026.** Cards: health/rate-limits, ranked usage, per-tester breakdown, Errors, Diagnostic Runs, AI Tool Run Timing. No row cap/pagination. |
| Arché Study Tools (Pilgrim Public) | same repo | `archestudytools.com/` -> redirects to `/pilgrim-public/` | Vanilla JS | v4.1.1 -- **confirmed live Sep 4, 2026** (direct fetch, no drift; still unported from the Aug 2026 Pilgrim Private work, see Issue #15) |
| Arché Study Tools (Scribe) | same repo | `archestudytools.com/scribe/` | Vanilla JS | v2.1 -- **confirmed live Sep 4, 2026** (direct fetch, no drift since April) |
| Arché Study Tools (Codex Arête) | same repo | `archestudytools.com/codex/` | Vanilla JS | **v3.6.4 -- confirmed live Sep 4, 2026 via direct fetch.** This row was showing v3.3.2 (July 14) while `CODEX_HANDOFF_MASTER.md` separately claimed v3.6.3 -- the two docs disagreed with each other and both were wrong. Whether the old `CODEX_VERSION`-frozen-at-3.3.0 dashboard bug is still live is unconfirmed now that the constant correctly reads 3.6.4 -- spot-check next Codex session, not urgent. |
| Waypoint | `Gizmo5332/Waypoint` | `gizmo5332.github.io/Waypoint/` | React 18 CDN | v2.6.0 — confirmed via uploaded live HTML, July 14, 2026. Adds PIN security upgrade (6→8 digit), Worker v2.0 KV rate limiting, onboarding flow. `waypoint-reference.md` still shows v2.2.1/May 20 — **doc is significantly stale, needs regeneration.** |
| DPS Daily Planner | `jcaldwelldmp/Daily-Planner` | `jcaldwelldmp.github.io/Daily-Planner/` | React 18 CDN | **v32.28.2 -- confirmed live Sep 4, 2026 via direct fetch.** This row was still showing v32.9.2 (July 14); `DPS_HANDOFF_MASTER.md` separately said v32.22.0. Live has moved 6+ minor versions past even that: new Mock Call Bank feature (import parser + role-separated scenario views + pathway viewer, v32.24.0-32.26.0), Seating Chart print export (v32.27.0-.1), agent-roster supervisor-dropdown safeguard (v32.28.0), two pre-hire panel fixes (v32.28.1-.2). **`DPS_HANDOFF_MASTER.md` and both modularization-prep specs (`dps-multi-file-split-spec-v2.md`, `dps-dependency-graph-v2.md`) need a full re-baseline against this -- not done in this pass, flagged as its own dedicated-session item.** |
| DPS Supervisors | same repo, `supervisors.html` | `jcaldwelldmp.github.io/Daily-Planner/supervisors.html` | React 18 CDN | sup-v4.5.1 — code fix shipped July 14, 2026: `SUP_VERSION` constant was frozen at 4.4.0, one behind its own changelog's top entry (4.5.0); resolved prior sup-v3.3/sup-v4.2.1 numbering conflict along the way. **Open:** embedded `DPS_VERSION='v32.8.1'` constant is unused dead code, internally consistent with its own local changelog copy, but stale vs. confirmed DPS main v32.9.2 — needs live `dps.html` to fix correctly, not actioned. |

**Repo note:** `Gizmo5332/JC-Study-Tool` (the old Arché repo) was retired June 18, 2026 —
domain removed, fully inert. All three Arché apps now live as folders in
`arche-epos/arche-suite` on `main`. Root `index.html` in that repo is a thin redirect
stub to `/pilgrim-public/`, mirroring the same pattern as DPS's `index.html` → `dps.html`
redirect — do not confuse the two repos' redirect stubs with each other.

---

## P1.5. TESTER ROSTER & TECH PROFILES

> ⚠️ **Internal use only — never surface these classifications in anything shared with testers** (release notes, feedback replies, UI copy, etc.).

| Tester | Technical level |
|---|---|
| Ashley | Professional developer — highest technical level |
| Matt | Software background |
| Jacob | DPS supervisor + tech-savvy tester |
| Cody, Helena | DMP tech support colleagues — technical |
| Frank | Uncertain — treat as middle case |
| Dan, Shirley, John, Renee, Alexandria | Average users |

Use profiles to calibrate repro-step detail, feedback-form expectations, and how much hand-holding release instructions need.

---

## P2. SWITCHING PROJECT CONTEXT

When Boss names a project or uploads a file, establish context immediately:
1. Identify which project is active
2. Read the relevant Part (2 = Arché, 3 = Waypoint, 4 = DPS)
3. Confirm the project + version before any code work
4. Apply both universal rules (Part 1) AND project-specific rules

---

## P3. CROSS-PROJECT WORKFLOW RULES

- **Boss = Jesse Caldwell.** Always address as Boss.
- **Report context % after every response.** Warn at 25% / 50% / 75% / 85%.
- **At 85%:** Stop all dev work. Generate updated handoff. Present all modified files. Start new chat.
- **Discuss before building.** Never write code until spec is confirmed. Ask clarifying questions first.
- **Confirm before acting.** Small changes (<20 lines, <5 locations) → apply after confirm. Large → confirm full plan first.
- **Batch related changes into single file delivery.** Never one-change-per-response.
- **Targeted edits only.** `str_replace` for surgical changes. Never reprint large code blocks.
- **Always present files after changes** using `present_files` — do not wait to be asked.
- **Syntax check before delivery.** `node --check` on extracted `<script>` blocks. Catches syntax errors but NOT runtime errors, wrong variable names, JSX issues, or logic errors.
- **`node --check` always errors on `.html` files** — this is expected and normal.
- **View before every str_replace.** After any str_replace, prior view output is stale — re-view before further edits.
- **Never go beyond what was specified.** Clarify scope; don't add unrequested features.
- **Never copy-paste file into GitHub editor** — silently truncates at ~5,900 lines. Always use file picker.
- **Efficiency and saving chat space is always a priority.**

---

## P4. CROSS-PROJECT LEARNING PROTOCOL

**This is a standing rule. Apply it at the end of every session AND at the start of the next session.**

### At End of Chat
Before generating the handoff document, scan the full conversation for:
- Bugs found and fixed (regardless of which project)
- Patterns that caused the bug (data structure, state management, UI, storage, etc.)
- The fix pattern used
- Whether that same bug pattern could exist in any OTHER project

If yes → add to Part 6 (Cross-Project Learnings Log) in this knowledge base.

**ES Modules migrations:** `es-modules-lessons-v2.md` in Project Knowledge is the authoritative extraction/merge playbook (supersedes v1). Read it in full before starting ANY single-file → ES Modules split, especially DPS.

### At Start of Next Chat
When reading handoff documents to orient, also scan Part 6. Before writing any code on any project, check whether any recent learnings apply to the current task.

### What Qualifies as a Cross-Project Learning
- A data deduplication pattern that wiped flags (any project using filter+push)
- A shared storage key written by two different code paths (merge-on-save required)
- A stale reference bug after reloading from localStorage
- A CSS default that caused always-visible hidden elements
- A version string stored in multiple locations (must update all)
- A GitHub deploy failure mode (truncation, wrong file, etc.)
- Any pattern where "injected" entries are overwritten by a modal's save

### Format for New Entries (add to Part 6)
```
### XP-[N]: [Short Title]
**Discovered:** [Project] v[X.X.X] — [Date]
**Pattern:** [What the bug pattern is — generic, not project-specific]
**Root cause:** [Why it happens]
**Fix:** [The fix pattern]
**Check in:** [List all projects where this pattern may exist]
```

---

## P5. GITHUB ISSUES WORKFLOW

GitHub Issues on `arche-epos/arche-suite` is the authoritative backlog for the Arché suite. Claude can create, update, and close issues via the `github-proxy` Worker.

### When to Create an Issue
**Simple test:** *Will this outlive more than one handoff without being done?*

| ✅ Create an Issue | ❌ Don't bother |
|---|---|
| Multi-session feature builds | Same-session fixes |
| Major rewrites or architectural changes | Quick patches |
| Specced but not yet scheduled | Anything resolved before session ends |
| Blocked on external dependency | Decisions/context (use handoff doc instead) |
| Confirmed bug that has survived multiple handoffs | |

### Label System
Two tiers — every issue gets one Type label + one App label.

**Type labels:**
| Label | Use for |
|---|---|
| `bug` | Confirmed defect |
| `feature` | New functionality |
| `architecture` | Major structural change or rewrite |

**App labels:**
| Label | Use for |
|---|---|
| `pilgrim-private` | Pilgrim Private only |
| `pilgrim-public` | Pilgrim Public only |
| `pilgrim` | Both Pilgrim apps |
| `codex` | Codex Arête |
| `scribe` | Scribe |
| `arche-suite` | Cross-app or suite-wide |

### github-proxy Issue Endpoints
All require `X-Proxy-Auth` header. Worker URL: `https://github-proxy.archestudytools.workers.dev`

```
GET  /issues   ?owner=arche-epos&repo=arche-suite&state=open
POST /issue    { owner, repo, title, body?, labels?, assignees? }
PATCH /issue   { owner, repo, issue_number, state?, title?, body?, labels? }
POST /label    { owner, repo, name, color, description? }
```

### Credentials
**Note (git copy only):** actual secret values are redacted here since this file is git-tracked and more broadly exposed than Project Knowledge. The full values live in the Project Knowledge copy of this file and in Keeper — see those, not this copy, when a credential value is actually needed.

| Credential | Value | Expires | Storage | Purpose |
|---|---|---|---|---|
| `github-proxy-2026-07-19` | **Not logged here — lives only in Cloudflare** | ⚠️ **No expiration date set** | Cloudflare (`github-proxy` → `GITHUB_PAT` secret only) | **Deployed production token.** Powers `github-proxy`'s `/commit`, `/issue`, `/label` endpoints — repo deploys + the feedback pipeline. |
| `github-proxy-worker2.0` (regenerated) | **[REDACTED in git copy — see Project Knowledge / Keeper for actual value]** | **Sep 16, 2026** | MKB + used directly via `bash_tool` | **Session/dev token.** Claude's direct `api.github.com` calls during dev work (Git Data API blob/tree/commit/ref flow). Confirmed working July 20, 2026. |
| Proxy secret | **[REDACTED in git copy — see Project Knowledge / Keeper for actual value]** | None | MKB + Keeper | Auth header (`X-Proxy-Auth`) for browser-initiated `github-proxy` calls |

> ⚠️ **PAT rotation reminder (session token):** `github-proxy-worker2.0` expires Sep 16, 2026. Generate a new fine-grained PAT, update this table, and give the new value at the start of the session it's needed.
>
> ⚠️ **Open risk — production token has no expiration:** `github-proxy-2026-07-19` (deployed in Cloudflare, powers feedback/commit/issue endpoints) was created with no expiration date. Recommend regenerating it with a proper expiry set, since it's live in production and its value isn't tracked anywhere Boss can re-derive it if lost. Boss holds this value; Claude does not need it and it should not be pasted into chat.

### External Accounts

| Service | Account |
|---|---|
| Discord | `enarchelogos` (Arché server) |
| Civitai | `En_Arche_Logos` / `jessecaldwell07@gmail.com` |
| GitHub (Arché) | `arche-epos` |

### Git Data API Deployment Patterns (Claude-side deploys)

Proven multi-file commit flow — follow in order, no shortcuts:
1. Fetch `HEAD` SHA → fetch base tree SHA
2. Create blobs (sleep 1.5s between); **payloads over ~50KB always via `curl --data-binary @file`, never inline `-d` strings** (OS arg-length limits silently produce empty/broken blobs — caused a near-miss deletion July 23)
3. **Re-fetch fresh HEAD immediately before tree creation** (avoids 409 conflicts)
4. Create tree with `base_tree` → create commit with `parents: [HEAD]` → PATCH `git/refs/heads/main`
5. **Mandatory post-push fetch-and-diff verification** against the pushed content — every push, no exceptions

Additional patterns:
- `POST /repos/.../merges` returns 409 on structural rewrites (not just line conflicts) — hand-build a two-parent merge tree (see XP-18)
- `sha: null` in a tree payload deletes that file
- `GET /git/trees/{sha}?recursive=1` returns a flat blob list; blob SHAs are directly reusable in tree payloads
- GitHub secret scanning blocks pushes containing live PAT strings — redact first
- Post-push verification via `api.github.com/repos/.../contents/{path}?ref=branch` with `Accept: application/vnd.github.v3.raw` — `raw.githubusercontent.com` CDN can be stale for fresh pushes

### Usage in Sessions
Claude calls `api.github.com` directly from `bash_tool` using the GitHub PAT — no proxy needed for read/write operations within a session. The proxy Worker remains available for browser-initiated operations (e.g. the HTML setup tool).

### Closing Issues
Close an issue when the fix/feature is confirmed deployed and live — not when the code is written.

---

# PART 1 — UNIVERSAL RULES (All Projects)

---

## U1. BABEL CDN HARD LIMITS — SILENT CRASH PATTERNS

These **silently crash** the entire app with a blank screen and zero error message. Apply to all React projects using Babel Standalone 7.23.2. Arché (Vanilla JS) is exempt from Babel limits but must follow iOS rules in U5.

| ❌ Never Use | ✅ Use Instead | Reason |
|---|---|---|
| `a?.b` optional chaining | `a && a.b` or `(a\|\|{}).b` | Silent blank screen crash |
| `a ?? b` nullish coalescing | `a !== null && a !== undefined ? a : b` or `a \|\| b` | Silent blank screen crash |
| `async/await` | `.then()/.catch()` Promise chains | Crashes Android WebView — `regeneratorRuntime` ReferenceError |
| `title={expr\|\|expr}` in JSX attributes | Extract to `const t = expr\|\|expr; <el title={t}>` | Some Babel/proxy combos reject inline OR in attributes |
| Arrow functions with complex bodies in event handlers | `function(){}` style | Subtle parse issues in older Babel CDN |
| `gemini-1.5-flash` model | `gemini-2.0-flash` | 1.5-flash is shut down — all calls fail |

**CDN Links — Pin These Versions, Do Not Upgrade Mid-Project:**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
```

---

## U2. REACT RULES OF HOOKS — VIOLATION = FULL APP CRASH

### All Hooks Before Any Return
React tracks hooks by call order. Skipping one corrupts the entire tree.

```js
// ❌ CRASH — useState called after conditional return
function MyComponent() {
  var[tab, setTab] = useState('a');
  if (tab === 'b') return <OtherComponent/>;
  var[selected, setSelected] = useState(null); // ← CRASH
}

// ✅ CORRECT — all hooks declared first
function MyComponent() {
  var[tab, setTab] = useState('a');
  var[selected, setSelected] = useState(null);
  if (tab === 'b') return <OtherComponent/>;
}
```

**Real bug (Waypoint v2.0.7):** `RemindersModule` had `useState` after `if(subTab==='payments') return ...` — crashed entire app whenever Payments or Goals were opened.

### All useRef() Declarations Must Be Present
After any refactor that touches a component's state/ref declarations, grep for every `ref={...}` in that component's JSX and verify each has a matching `useRef()`.

**Real bug (Waypoint v2.0.9):** `GoalDetail` — `fileRef=useRef()` removed during refactor. Caused `ReferenceError` on every render — crashed Chromebook on every goal select. Mobile used a different component so appeared unaffected.

### No Nested Function Components
Do NOT define components inside other components. React creates a new component identity on every render, causing unnecessary remounts.

```js
// ❌ Nested — remounts on every render
function Parent() {
  function Child({item}) { return <div>{item.name}</div>; }
  return <div>{items.map(i => <Child item={i}/>)}</div>;
}

// ✅ Top-level — stable identity
function Child({item}) { return <div>{item.name}</div>; }
function Parent() {
  return <div>{items.map(i => <Child key={i.id} item={i}/>)}</div>;
}
```

**Real anti-pattern still present (Waypoint):** `PaymentCard` defined inside `PaymentRemindersTab`. Extract when touching that component.

---

## U3. JSX STRUCTURE DISCIPLINE

### Gate All Conditional Content
```jsx
// ❌ Renders on every tab — corrupts React tree
<div>{/* settings about content */}</div>

// ✅ Gated correctly
{tab === 'about' && (
  <div>{/* settings about content */}</div>
)}
```

**Real bug (Waypoint v2.0.6):** Settings About tab lost its `{tab==='about'&&(...)}` wrapper — About section rendered on all tabs, corrupting the tree and crashing on detail panel open.

### Scan ±10 Lines After Every str_replace
After inserting or removing JSX blocks, always scan for:
- Extra `</div>` closing tags
- Orphaned `)}` closing the wrong block

One extra `</div>` = blank screen with no error. **Real bug:** Inserting `+ Add Milestone` block left a duplicate `</div>` — blank screen on load.

### No autoFocus on Inputs
Causes unpredictable behavior on mobile Chrome with Babel CDN. If focus is needed, use `useEffect` with `ref.current.focus()`.

### No position:fixed in Claude's Artifact Viewer
Fixed positioning breaks inside Claude's iframe preview. Use flex column layout for testing in artifacts. Live GitHub Pages deployment works correctly.

---

## U4. LOCALSTORAGE PATTERNS

### The storageReady Write Guard — Never Remove
This prevents blank state from overwriting saved localStorage data during the initial render. Removing or misplacing this guard **silently wipes all user data on page load.**

```js
var[storageReady, setStorageReady] = useState(false);

useEffect(function() {
  setData(load('app_key', defaultValue));
  setStorageReady(true);
}, []);

useEffect(function() {
  if (!storageReady) return; // ← never write before load completes
  save('app_key', data);
}, [data, storageReady]);

function load(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch(e) { console.warn('Storage write failed', e); }
}
```

### Namespace All Keys
Prefix every key with the app's namespace. Never use generic names like `data`.

```js
// ✅ Good
localStorage.setItem('waypoint_goals', ...)
localStorage.setItem('dps-agents', ...)
localStorage.setItem('bsn_studies_v2', ...)
```

### Version Your Primary State Key
When data shape changes significantly, bump the key suffix: `dps-v2` → `dps-v3`. Old data stays under the old key; write a one-time migration on first load.

### Keep Credentials in Separate Keys
Gist tokens, IDs, API keys: separate keys, not buried in main state. They persist through backup/restore independently.

### Normalize Array Fields at Every Ingestion Point
Any field that will be `.map()`, `.filter()`, `.length`'d, or `.find()`'d must be defaulted to `[]` when loaded. Apply at all three points: localStorage load, Gist pull, JSON import.

```js
goals.map(function(g) {
  return { ...g, milestones: g.milestones || [], images: g.images || [] };
});
```

**Real bug (Waypoint v2.0.8):** Goals synced from Gist had `milestones: undefined` — `.map()` threw `TypeError`, crashed app on every goal select.

### useState Lazy Initializer for Storage Reads
```js
// ✅ Reads storage once on mount — not on every render
var[token, setToken] = useState(function() {
  return localStorage.getItem('app-gist-token') || '';
});
```

---

## U5. GITHUB GIST SYNC — PROVEN PATTERNS

### The Three Golden Rules
1. **Only `Authorization` header on `api.github.com` GET requests.** Extra headers (like `Cache-Control`) trigger a CORS preflight that GitHub rejects → "Network error" on Pull. **Real bug (Waypoint v2.0.2).**
2. **No headers at all on `raw_url` fetches.** `gist.githubusercontent.com` is a public CDN. Sending an auth header causes CORS failure. **Real bug (Waypoint v2.0.1).**
3. **Always handle Gist truncation.** GitHub truncates inline content above ~1MB. Always check `file.truncated || !file.content` and fall back to `raw_url`.

### Complete Pull Pattern (Production-Safe)
```js
function pullFromGist() {
  var token = settings.gistToken;
  var gistId = settings.gistId;
  if (!token || !gistId) { showError('No credentials'); return; }

  fetch('https://api.github.com/gists/' + gistId, {
    headers: { 'Authorization': 'token ' + token }
    // ← ONLY Authorization — no Cache-Control or other headers
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    var file = d.files && d.files['app-data.json'];
    if (!file) { showError('File not found'); return; }

    if (file.truncated || !file.content) {
      fetch(file.raw_url) // ← NO headers on raw_url
        .then(function(r) { return r.text(); })
        .then(function(text) { applyRemote(text); })
        .catch(function(e) { showError('Raw fetch error'); });
    } else {
      applyRemote(file.content);
    }
  })
  .catch(function(e) { showError('Network error'); });
}
```

### Most-Recent-Wins Merge Pattern
```js
function mergeCollection(local, remote) {
  var merged = {};
  local.forEach(function(item) { merged[item.id] = item; });
  remote.forEach(function(item) {
    if (!merged[item.id]) {
      merged[item.id] = item;
    } else {
      var lt = merged[item.id].updatedAt || 0;
      var rt = item.updatedAt || 0;
      if (rt > lt) merged[item.id] = item;
    }
  });
  return Object.keys(merged).map(function(k) { return merged[k]; });
}
```

### Key Rules
- Stamp `updatedAt` on every item create/modify — required for per-record merge
- One JSON file per app in the Gist — simpler, fewer API calls
- Auto-sync for phones/Chromebooks (every 5 min); manual only for PCs
- Never block the UI waiting for a pull — pull is manual or on first load

---

## U6. DATA MODEL DISCIPLINE

### Stable IDs — Never Use Array Index
```js
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function createItem(overrides) {
  return { ...DEFAULT_SHAPE, ...overrides, id: nid(), updatedAt: Date.now() };
}
```

### updatedAt on Every Object
Required for Gist sync conflict resolution. Every entity must have `updatedAt` stamped on create and every update.

### The sanitize/migrate Pattern — Run on Every Load
Write a `sanitize` (React) or `migrateStudy` (Vanilla JS) function that runs on every single load. It:
- Sets missing fields to safe defaults
- Backfills new fields introduced in later versions
- Never removes data — only adds defaults

**Rule:** Any time you add a new field to an entity, add it to `sanitize`/`migrate` with a safe default. No migration scripts needed.

### Date Timezone Trap
`new Date('YYYY-MM-DD')` parses as UTC midnight → displays as previous day in US timezones. Always append `T12:00:00`.

```js
const fmtDate = str => {
  const d = new Date(str + 'T12:00:00'); // noon anchor prevents off-by-one
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
```

---

## U7. DEPLOYMENT — GITHUB PAGES

### The Silent Truncation Problem
Copy-pasting into GitHub's web editor **silently truncates content above ~5,900 lines.** No warning. File looks fine — bottom is just gone.

**Rule: Always use Add file → Upload files (file picker). Never paste into the editor.**

### Deployment Workflow (All Projects)
1. Delete existing file in repo
2. Upload new file via file picker (never paste)
3. Verify ✅ green check in GitHub Actions/Pages (not ❌)
4. Wait 2–3 minutes for CDN propagation
5. Hard refresh: Ctrl+Shift+R (Chromebook/desktop), clear cache (Android)
6. Confirm version number in the app's About/Settings section

### Version Discipline — Always Update Both
Every code change must update BOTH:
1. The in-app version display string
2. The in-app changelog entry array

These are in different places and easy to forget independently.

**Convention:** Major = architecture change · Minor = new feature · Patch = bug fix

---

## U8. AI ENGINE RULES

| Engine | Model | Notes |
|---|---|---|
| Groq (primary) | `llama-3.3-70b-versatile` | Fast, reliable |
| Gemini (fallback) | `gemini-2.0-flash` | **NEVER** use `gemini-1.5-flash` — shut down |

- Gemini 429 quota hit → auto-switch to Groq until midnight reset
- All AI write actions (create/edit/delete) require user confirmation before executing

---

## U9. MOBILE / DESKTOP DUAL RENDER PATHS

When an app has both mobile and desktop layouts, detail views are often **two separate components.**

```
Mobile (< breakpoint):  Card tap → Modal (bottom sheet overlay)
Desktop (≥ breakpoint): Card tap → setSelectedItem → DetailPanel on right
```

**These are two separate components. A fix in one does NOT automatically fix the other.**

After any bug fix or feature addition, always check if the same change is needed in the counterpart component.

**Breakpoint hook pattern:**
```js
function useWindowWidth() {
  var[w, setW] = useState(window.innerWidth);
  useEffect(function() {
    function h() { setW(window.innerWidth); }
    window.addEventListener('resize', h);
    return function() { window.removeEventListener('resize', h); };
  }, []);
  return w;
}
var isDesktop = useWindowWidth() >= 900;
```

---

## U10. iOS / ANDROID COMPATIBILITY RULES

### iOS 14 — Two Non-Negotiables
1. `100dvh` → use `100vh` or `--app-height` CSS variable set via `window.innerHeight`. `dvh` not supported on iOS 14.
2. `inset: 0` → always use longhand `top:0; right:0; bottom:0; left:0`. `inset` shorthand not supported.

### FAB / Fixed Element DOM Position
On iOS Safari, `position:fixed` elements inside an `overflow:hidden` parent lose touch events. FAB and sticky UI elements must be **siblings** of the scrollable container, not children.

### Android WebView — No Checkboxes in Modals
Android WebView doesn't reliably fire `change` events on `<input type="checkbox">` inside dynamically-inserted modal HTML. Use a `<div>` with a toggled `.on` CSS class instead.

---

## U11. CODE PLACEMENT & DOCUMENTATION DISCIPLINE (HARD RULE)

- Every new function or feature goes in its **correct logical section** of the file — never appended wherever convenient
- **JSDoc on every new function** and inline section comments — always, not a judgment call
- If a new section is inserted, **renumber downstream sections sequentially** — no "25.5" decimal insertions
- The reorg and commenting work must never degrade over time

---

## U12. UNTRUSTED-UNTIL-VERIFIED — UNREACHABLE FILES

Project Knowledge copies of files Claude cannot fetch/deploy with the dev PAT are **potentially stale**. Dev PAT (`github-proxy-worker2.0`) write/push scope is `arche-epos/arche-suite` only.

**Correction (v3.7.4):** read-only live checks are NOT limited to that scope. `jcaldwelldmp/Daily-Planner` and `Gizmo5332/*` are public repos — `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` works unauthenticated for any public repo, confirmed working Aug 30, 2026 (pulled live `DPS.html` this way). So for DPS/Waypoint/Gizmo5332 apps: Claude CAN verify live version/content directly, just cannot push changes (no PAT scope) — Boss still deploys those manually via file picker. `arche-proxy.js` remains genuinely unreachable (Cloudflare Worker, not git-tracked at all) — that one still requires Boss to paste/confirm current content.

- Before relying on a PK copy of a DPS/Gizmo5332 file for edits: pull the live raw copy first to confirm it matches, rather than assuming staleness or asking Boss to paste it
- For `arche-proxy.js` specifically: **explicitly flag possible staleness and ask Boss to paste/confirm current live content** — no live-read path exists for this one
- Never assume the PK copy matches production — this exact drift bit `arche-proxy.js` in July 2026 and `DPS_HANDOFF_MASTER.md` itself through most of Aug 2026

---

## U13. SHIP-TIME HYGIENE & DEPLOY VERIFICATION

1. **Ship-time memory/doc hygiene:** the moment a backlog or QA-flagged item ships live, mark its tracking entry (memory, MKB backlog, handoff) resolved **in that same turn** — never leave it for a later review to discover (3 items shipped July 20 were still listed open on July 23)
2. **Every Git Data API push gets a mandatory post-push fetch-and-diff verification** against the pushed content — every time, no exceptions (full flow in P5)
3. **Blob payloads over ~50KB always via `curl --data-binary @file`**, never inline `-d` strings

---

## U14. QUICK REFERENCE CARD

```
ALWAYS                           NEVER
───────────────────────          ───────────────────────
.then()/.catch()                 async/await
obj && obj.prop                  obj?.prop
val || 'default'                 val ?? 'default'
Hooks before any return          Hooks after if/return
Top-level components             Nested function components
Normalize arrays on load         Assume fields exist
storageReady guard on save       Write before load completes
Auth header only on API GET      Cache-Control on GET
No headers on raw_url fetch      Auth header on raw_url
Update version + changelog       Update only one of them
Test mobile AND desktop          Test only one path
Scan ±10 lines after edits       Trust str_replace blindly
node --check before delivery     Ship untested scripts
File upload to GitHub            Copy-paste into editor
Confirm before any change        Build first, ask later
```

---

# PART 2 — ARCHÉ STUDY TOOLS (Pilgrim + Scribe)

**Apps:** Pilgrim-Private (v4.9.73) · Pilgrim Public (v4.1.1) · Scribe (v2.1) · Codex (v3.1.2)
**Repo:** `arche-epos/arche-suite` (migrated June 18, 2026 from `Gizmo5332/JC-Study-Tool`, now inert)
**Stack:** Vanilla JS, single HTML file per app, no build tools, no framework

---

## A1. ARCHITECTURE — PUBLIC / PRIVATE SPLIT PATTERN

- **Private:** All features. All APIs routed through a Cloudflare Worker backend proxy (no keys on device).
- **Public:** Subset of features. User supplies their own API key. No proxy required.
- Both versions share the **same data model and storage key** (`bsn_studies_v2`) so JSON backups are cross-compatible.
- Never let the public changelog reference private-only features. Maintain a strict feature fence.

**Private-only features (never appear in public changelog):**
- Cloudflare Worker / proxy
- Auto Study Sync / GitHub Gist
- Passage/Book Outline section
- Primary / Secondary ref type (★ / ○)
- AI result Clear button
- Lexicon modal
- Document upload (DOCX/TXT/MD)
- Unlimited passages (public capped at 12)
- API test buttons for Sync or OCR

---

**Port-to-Public reminder (standing):** After Boss confirms a new Pilgrim Private feature works, always ask whether to port it to Pilgrim Public (BYOK model — see Issue #15 for the active port backlog).

---

## A2. VERSIONING STRATEGY

- Private: major bumps (3.3 → 3.4) — bigger, batched feature sweeps
- Public: minor bumps (2.5 → 2.6) — smaller, user-visible changes only
- Scribe: minor bumps (1.5 → 1.6)
- Every file delivery = new changelog entry, no exceptions
- **Release timing rule:** avoid major Arché deploys immediately before Sunday or Wednesday night peak usage — prefer a Mon–Tue window for anything structural

**Changelog entry format — all 6 fields required:**
```js
{ version: '3.4', date: 'Apr 3, 2026', label: 'Latest',
  _clSectionOpen: false, _clOpen: false, items: [] }
```
- `label:'Latest'` on newest entry only — remove from previous top entry when adding new
- `_clSectionOpen` and `_clOpen` must always be `false` — never change defaults

---

## A3. DATA MODEL — PILGRIM (Both Versions)

```js
{
  id,                          // stable — set at creation with Date.now() + Math.random()
  date, title, teacher,
  fieldNotes, tags, lastOpened,
  resources: [],
  refs: [{
    id,                        // stable per-ref ID
    reference, translation, pastedTranslation, scriptureText,
    type,                      // 'primary' (★) or 'secondary' (○) — private only
    deep: {
      lexical, grammar, historical, cultural, crossrefs,
      lexical_book, grammar_book, historical_book, cultural_book, crossrefs_book,
      studyScope: 'passage'    // per-ref: 'passage' or 'book'
    }
  }],
  deep: {                      // study-level (not per-ref)
    conclusions: '',
    outline: ''
  },
  updatedAt
}
```

**Critical:** All scripture/AI data lives in `cur.refs[activeRefIdx]`. `studyScope` is per-ref. `conclusions` and `outline` are study-level (`cur.deep`). Use the `activeRef()` helper — never access `cur.deep.lexical` directly.

`activeRefIdx` is in-memory only — never persist it. Always resets to `0` when a study is opened.

---

## A4. DATA MODEL — SCRIBE

```js
{
  id, passage, title: '', translation, text, textTranslation,
  createdAt, updatedAt,
  methods: { [methodId]: { notes, aiResponse, completed } },
  exegesis: { [stageId]: { notes, completed } }
}
```

---

## A5. LOCALSTORAGE KEYS — ARCHÉ

| Key | Contents | App |
|---|---|---|
| `bsn_studies_v2` | Study objects | Both Pilgrim versions |
| `bsn_settings_v1` | `{ geminiKey, scrMode, lastPasteTrans }` | Public only |
| `bsn_streak` | `{ lastDay, streak }` | Both |
| `bsn_ob_done` | `'1'` after onboarding | Both |
| `bsn_tags_v1` | Tag objects | Both |
| `bsapp-v2-studies` | Study objects | Scribe |

---

## A6. MIGRATE STUDY — RUN ON EVERY LOAD

```js
function migrateStudy(s) {
  if (!s.refs) s.refs = [];
  if (!s.deep) s.deep = { conclusions: '', outline: '' };
  s.refs.forEach(function(r) {
    if (!r.id) r.id = Date.now() + Math.random();
    if (!r.deep) r.deep = {};
    if (!r.deep.studyScope) r.deep.studyScope = 'passage';
  });
  return s;
}

// In loadStudies:
studies = raw ? JSON.parse(raw).map(migrateStudy) : [];
```

---

## A7. SYNC FROM INPUTS — THE FORCE PARAM

The `syncFromInputs(force)` function syncs form inputs back to the data model before saving.
- `force = false` → skip optional/heavy sections if not visible
- `force = true` → always sync everything

```js
// Manual Save, Share, Export — always force=true:
syncFromInputs(true); persist();

// Auto-save on input change:
syncFromInputs(false); persist();
```

**Never remove the force param from manual Save, Share, or Export triggers.** Conclusions and Outline are both guarded by `deepOn || force`.

---

## A8. CLOUDFLARE WORKER PROXY — ARCHÉ (Private)

All API calls in the private build go through `https://arche-proxy.archestudytools.workers.dev`. No API keys on the client device. **Not git-tracked** — dashboard-only, hand-pasted deploys. Trust the local backup folder copy (`Arché-Offline-Backup\cloudflare-workers-source\arche-proxy.js`) or a fresh dashboard paste over any Project Knowledge copy, which can silently drift stale.

| Service | Worker Endpoint | Notes |
|---|---|---|
| PIN auth | `/auth/pin` | POST — validates 4-digit PIN against `PILGRIM_USERS` KV, returns `userId`. Added June 2026 for v4.10.0. |
| AI Study Tools | `/groq` | `openai/gpt-oss-120b`. **Migrated to DeepInfra Aug 25, 2026** (route name unchanged to avoid a client-side rename). Same model string, same MXFP4 quantization, OpenAI-compatible endpoint — swap was upstream URL + auth header only. `GROQ_API_KEY` retained as fallback/rollback, not deleted. |
| Vision OCR (Groq, unused) | `/ocr` | Groq vision (Llama 4 Scout). Live on the Worker but **not called by any client** — kept only as a one-line rollback path for `/gemini-ocr`. |
| Vision OCR (Gemini, live) | `/gemini-ocr` | **Actual live OCR route since July 20, 2026 (v4.15.3).** Gemini 3.5 Flash (`gemini-2.5-flash` is retired for new keys — do not use). Client: `resRunOCR()` in `pilgrim-private/studyTools.js`. Thinking-model response — Worker joins all non-thought `parts`, doesn't read `parts[0].text` directly. |
| ESV Bible | `/esv` | Proxied Crossway API |
| api.bible | `/bible` | POST `{ref, bibleId}` — NKJV, NET, AMP, CSB, NLT, MSG (added with Bible translation expansion) |
| GitHub Gist | `/gist` | GET/PATCH — study sync across devices |
| GitHub Gist (raw) | `/gist-raw` | GET — bypasses cache/truncation via `raw_url`, no auth header |
| Feedback | `/feedback` | POST — files a GitHub Issue via `github-proxy` Service Binding (screenshots committed to `feedback-attachments/{app}/`, labeled, issue opened on `arche-epos/arche-suite`) |

**Worker secrets:** `DEEPINFRA_API_KEY`, `GROQ_API_KEY` (fallback), `GEMINI_API_KEY`, `ESV_TOKEN`, `GITHUB_TOKEN`, `GIST_ID`, `API_BIBLE_KEY`, `GITHUB_PROXY_SECRET`, `CODEX_SETUP_KEY`
**KV bindings:** `PILGRIM_USERS` — keys `pin:<4digit>` → userId string (e.g. `pin:8144` → `jesse`) | `MENTOR_USERS` — Mentor auth + user records | `CODEX_USERS` — Codex auth + user records
**Service Bindings:** `GITHUB_PROXY` — bound to the `github-proxy` Worker (Service Binding required, not public `fetch()` — Cloudflare blocks worker-to-worker `fetch()` over `*.workers.dev`, error 1042)
**Cloudflare account:** `archestudytools@gmail.com`
**Allowed origins (CORS):** `https://archestudytools.com`, `https://arche-epos.github.io` — local-dev origins (`127.0.0.1:5500`, `localhost:5500`) confirmed removed from the live file as of Aug 24, 2026.

**Mentor routes (added June 2026):** `/mentor/auth`, `/mentor/user/get`, `/mentor/users/list`, `/mentor/user/create`, `/mentor/user/update`, `/mentor/user/delete` — all POST, auth via `MENTOR_USERS` KV.

**Codex routes:** `/codex/auth`, `/codex/user/get`, `/codex/users/list`, `/codex/user/create` (gated by `CODEX_SETUP_KEY` or an existing admin), `/codex/user/update`, `/codex/user/delete` — all POST, auth via `CODEX_USERS` KV.

> ⚠️ Do not describe OCR as running through Groq — that was true only through mid-July
> 2026. Since v4.15.3 (July 20, 2026), OCR runs on Gemini 3.5 Flash via `/gemini-ocr`.
> Groq's `/ocr` route is a dead-but-live rollback path only.

---

## A9. PDF EXPORT — CRITICAL RULES

### pdfSafe() — Always Use charCodeAt Loop, Never Regex

```js
function pdfSafe(str) {
  if (!str) return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x2000) out += str[i];
  }
  return out;
}
```

`str.replace(/[^\x00-\x7F]/g, '')` **breaks silently on Android/older Safari.** Use the `charCodeAt` loop exclusively.

### PDF Export Layout (v3.4 / v2.6+)
1. Header block → Reference List → Outline → Field Notes → Resources
2. [Page break]
3. Per-ref grouped sections — one per ref, page break between: Ref heading → verse text → populated AI tabs (skip empty)
4. My Conclusions — own page at end

---

## A10. INLINE ONCLICK APOSTROPHE ESCAPING

When building HTML strings in JS and injecting with `innerHTML`, inner single quotes must be escaped as `\'`. `node --check` will NOT catch this.

```js
// ✅ Correct
el.innerHTML = `<button onclick="doThing(\'${item.id}\')">Click</button>`;

// ❌ Breaks silently at runtime
el.innerHTML = `<button onclick="doThing('${item.id}')">Click</button>`;
```

After any HTML string changes, manually search every `onclick="` to verify apostrophe escaping.

---

## A11. DATA SAFETY PROTOCOL — ARCHÉ

Before writing any code that touches these areas, Claude must **stop and post a DATA SAFETY WARNING** and wait for explicit acknowledgment before proceeding:

- `localStorage` — any read, write, clear, or rename
- The data model — adding, removing, or renaming fields
- `migrateStudy()` — any modification
- `persist()`, `loadStudies()`, or any serialize/deserialize function
- `confirmClearAll()` or any bulk delete
- GitHub Gist sync — push, pull, or merge logic
- JSON backup/restore — import or export
- Version bumps that change storage key names

**Warning format:**
```
🚨 DATA SAFETY WARNING
This change touches: [specific function/area]
Risk: [what could be lost and how]
Mitigation: [what we will do to protect data]
Proceed only after Boss confirms.
```

---

## A12. CSS DESIGN SYSTEM — ARCHÉ

```css
:root {
  --bg0:#0b0907; --bg1:#120f0a; --bg2:#1b1710; --bg3:#252019; --bg4:#2f2a1f;
  --border:#3a3022; --borderlit:#4d4430;
  --gold:#c9a84c; --golddim:#7a6520; --goldpale:#e8ca80;
  --crimson:#8b3535; --crimsonbright:#c05050; --sagebright:#5a9b70;
  --txt1:#e8d5a3; --txt2:#c4a870; --txt3:#8a7550; --txt4:#5a4d35;
  --r:8px; --rl:14px;
}
```

**Fonts:** EB Garamond (display/headings), Crimson Pro (body/UI)
**Breakpoints:** Mobile-first · Tablet: `min-width: 481px` · Desktop: `min-width: 901px`

**Screen Switching Critical Rules:**
- `.scr` rule at desktop breakpoint **must include `display:none`** — otherwise all screens bleed through
- `#scr-field` must **not** have `display:flex` hardcoded at base level — overrides `.scr{display:none}`
- `#desktop-main` requires exactly: `flex:1; overflow:hidden; min-height:0` — never remove these three

---

## A13. BRAND IDENTITY — ARCHÉ

- **Suite name:** Arché Study Tools | **Origin:** John 1:1 — ἀρχή | **Ornament:** ✦
- **Style:** Arché · Pilgrim / Arché · Scribe (middle dot, ē = `&#275;`)
- **Philosophy:** AI provides objective scholarly/linguistic/historical data only. All theological conclusions belong to the user.
- AI-Free zones are clearly labeled.
- ESV attribution must appear wherever ESV text is displayed (Crossway requirement).
- Never use developer vocabulary in user-facing text (no "API", "token", "endpoint", "proxy").

**Cornerstone verses (NASB, locked — see `spec-cornerstone-verses-v1.md`):**
| App | Verse |
|---|---|
| Arché (suite-wide) | John 1:1 |
| Pilgrim | 2 Timothy 2:15 |
| Scribe | Ezra 7:10 |
| Codex | James 1:22 |

Waypoint is explicitly excluded from the cornerstone verse system. Full verse text on
onboarding/about screens; reference-only wherever space is limited.

---

## A14. KNOWN BUGS & REGRESSION RISKS — ARCHÉ

### Critical
- **`charCodeAt` in `pdfSafe()`** — Never use regex. PDF corrupts silently on any special character.
- **Inline `onclick` apostrophes** — Must be `\'`. `node --check` won't catch this.
- **`input type="checkbox"` in modals** — Breaks Android. Use `<div>` with `.on` toggle.
- **`display:flex` hardcoded on `#scr-field`** — Overrides `.scr{display:none}` — all screens show simultaneously.
- **Desktop `.scr` rule missing `display:none`** — Same multi-screen bleed.
- **`#desktop-main` missing `flex:1; overflow:hidden; min-height:0`** — Breaks scroll.

### High
- **`syncFromInputs(true)` force param** — Manual Save/Share/Export require `force=true`. Never remove.
- **`activeRef()` helper** — All scripture/AI data at `cur.refs[activeRefIdx]`. Never access `cur.deep.lexical` directly.
- **FAB DOM position** — Must be sibling of `#desktop-main`, NOT inside it.
- **Worker proxy** — No API keys client-side. No `Authorization` headers client-side.

### Open Items
- Private version history gap v2.0 → v2.9 (intentional — public-only bumps; verify in-app array)
- Public dates v2.0–v2.5 show March 22; public fork was created March 31 — consider updating

---

## A15. BACKLOG — ARCHÉ

### Pilgrim
| # | Feature | Effort | Priority |
|---|---------|--------|----------|
| P2 | Cloudflare Worker proxy for public version | Large | Low — own chat |
| P4 | Dark/light mode toggle | Large | Low — own chat |
| P5 | Tooltip/help system | Small–Med | Last |
| P6 | BLB deep links on scripture panel | Trivial | Medium |
| P7 | Memorization tool | Large | Low — own chat |
| P8 | Cross-app export — send Pilgrim study to Scribe | Medium | Low — own chat |
| P9 | Markdown rendering in AI responses | Small | Medium |
| P10 | ~~Bible translations expansion (api.bible route)~~ | — | ✅ **Done** — Darby + NKJV/NET/AMP/CSB/NLT/MSG live via `/bible` |
| P11 | PIN auth + per-user namespacing (Private) | Large | ✅ **Done** — confirmed fully live via direct code audit, Aug 16, 2026. Section 27 in `ui.js`/`utils.js`: 4-digit PIN gate at app boot (`initPinGate`/`submitPin`), validated against `PILGRIM_USERS` KV via Worker route `/auth/pin`, per-user `localStorage` namespacing via `activateUser()` (re-namespaces all 12 `SK_*` keys per user ID), non-destructive legacy-key migration (`migrateLegacyKey()`, move-not-copy) for pre-v4.10.0 data. |

### Scribe
| # | Feature | Effort | Priority |
|---|---------|--------|----------|
| S8 | Cloudflare Worker — ESV proxy | Large | Deferred |
| S9 | Cloudflare KV — cloud sync | Large | Deferred |
| S10 | Dark/light mode | Large | Deferred |
| S17 | Streak tracker + stats depth | Medium | Low |
| S18 | Cross-app import — receive Pilgrim study | Medium | Low — own chat |
| S19 | Markdown rendering in AI responses | Small | Medium |
| S20 | Mobile sidebar collapse in study workspace | Medium | Medium |
| S22 | Study export as formatted PDF | Large | Low — own chat |

---

## A16. DOCUMENTATION STORAGE & STALENESS PREVENTION — CROSS-PROJECT SOP
**Added Sep 4, 2026, after a full documentation audit found the DPS and Codex P1 rows
above were stale by 6–30+ versions, `DPS_HANDOFF_MASTER.md` and `CODEX_HANDOFF_MASTER.md`
each disagreed with this file's own numbers, and `pilgrim-admin` — a real deployed app
since Aug 30 — was completely absent from the local backup system. Root cause in every
case: these "living reference" docs exist ONLY in Project Knowledge, which has no version
history, no diffing, and nothing that can detect when the live app has moved past what
the doc says.**

### The fix: move living reference docs into git, not just Project Knowledge
Project Knowledge is right for specs/handoffs that are genuinely session-scoped (a plan
being written, a handoff for the next chat). It is the wrong home for docs that claim to
describe *current state* indefinitely (this MKB, `DPS_HANDOFF_MASTER.md`,
`CODEX_HANDOFF_MASTER.md`) — those need real version history and a copy that lives next
to the code they describe.

**As of Sep 4, 2026:** this file, `CODEX_HANDOFF_MASTER.md`, and the long-lived
Pilgrim/Codex/Mentor specs are pushed to `arche-epos/arche-suite/docs/` (a `docs/` folder
already existed there with ~9 specs and 26 archived handoffs — this just extends it to
cover the docs that were still PK-only). This gets them three things for free: (1) git
history — every future edit is diffable, nothing silently overwrites the record of what
changed; (2) automatic local-backup coverage — `sync-config.json`'s `Arche-Suite-Docs`
target already pulls everything in `docs/` on the existing Mon/Fri 4:30 AM schedule, no
new automation needed; (3) any future Claude session can pull the current copy directly
via `raw.githubusercontent.com` without depending on which files happen to be uploaded to
that session's Project. **Project Knowledge keeps a courtesy copy of each for in-chat
search — the `docs/` copy in GitHub is the authoritative one going forward.**
`DPS_HANDOFF_MASTER.md` and the DPS-specific specs are NOT yet moved this way — DPS
deployment is manual-only per Boss's compliance rule, so Boss needs to add a `docs/`
folder to `jcaldwelldmp/Daily-Planner` himself via the file picker before this pattern can
extend there. Recommended, not yet done.

### What still can't be automated — and the mitigation
No tool can watch Project Knowledge for edits, and no chat session has a background job —
staleness in *prose* (a version number typed into a sentence) can't be fully eliminated,
only caught faster. Two standing rules close most of that gap:
1. **Never trust a stated version number over a live fetch.** The P1 table above already
   carried this caveat; it now applies to every prose "Current Version" line in every
   Part of this doc, `DPS_HANDOFF_MASTER.md`, and `CODEX_HANDOFF_MASTER.md` too — treat
   all of them as *directional*, and confirm live via `raw.githubusercontent.com` (public
   repos, no auth needed — see A8/A2 for the exact fetch pattern) before relying on a
   number for anything that matters (a version bump, a "safe to modularize" claim, etc.).
2. **Whenever Claude presents an updated copy of any living-reference doc, resync BOTH
   copies in the same turn — don't wait to be asked.** (a) Write the corrected file into
   the matching local `_Reference/KB/` folder via Filesystem MCP (already a standing SOP
   in `Arché-Offline-Backup\_MANIFEST.md`, in place since Aug 10 but not consistently
   followed — the local MKB snapshot there was still v3.7.0 from Aug 10 when this file
   had already reached v3.7.5). (b) Push the corrected file to its repo's `docs/` folder
   per the pattern above, where one exists. Doing both closes the loop immediately instead
   of relying on a future session to notice the drift.

### Known remaining gap
`dps-vault.js` and `waypoint-worker.js` (separate Cloudflare accounts, no connector
access) still can't be auto-checked — see A8 and the DPS/Gizmo5332 manifests' existing
30-day manual-reminder SOP. This is a hard limit, not an oversight: nothing short of
Boss re-pasting the code can close it.

---

# PART 3 — WAYPOINT

**App:** Personal life management (Goals, Tasks, Reminders, Notes, AI Assistant)
**Repo:** `Gizmo5332/Waypoint`
**Live URL:** `https://gizmo5332.github.io/Waypoint/`
**Stack:** React 18.2.0 CDN + Babel Standalone 7.23.2 + localStorage + GitHub Gist via Cloudflare Worker
**Current Version:** v2.1.5
**File size:** ~2,805 lines
**Primary device:** Chromebook (1366px) + Pixel phone

---

## W1. ARCHITECTURE RULES — WAYPOINT

1. Single HTML file (`index.html`) — never split
2. All JSX inside `<script type="text/babel">`
3. All styles inline
4. `isDesktop = useWindowWidth() >= 900`
5. Modals: bottom sheet on mobile, centered on desktop
6. `storageReady` guard on all saves — never remove (see U4)
7. All Babel CDN constraints apply — see U1
8. `saveAny` not `saveGuarded` — `saveGuarded` was replaced; use `saveAny` for all data saves

---

## W2. COLOR SYSTEM & FONT — WAYPOINT

```js
const C = {
  bg: '#0d1117', su: '#161b27', ca: '#1a1f2e', bo: '#2e3347',
  te: '#14b8a6', gr: '#22c55e', rd: '#ef4444', yl: '#eab308',
  bl: '#3b82f6', pu: '#a855f7', tx: '#eef1fa', mu: '#8b90a8'
};
```

Font: `'Courier New', Courier, monospace` throughout. High-contrast dark theme — never deviate.

---

## W3. LOCALSTORAGE KEYS — WAYPOINT

```
waypoint_tasks            waypoint_reminders        waypoint_goals
waypoint_categories       waypoint_settings          waypoint_notes
waypoint_lastSynced       waypoint_payments          waypoint_payment_cats
```

**`waypoint_payWindow`** — stored directly via `localStorage.getItem/setItem` (NOT App state). Holds selected balance window string. Default: `'this-month'`.

---

## W4. DATA SHAPES — WAYPOINT

### Task
```js
{ id, text, priority: 'High'|'Medium'|'Low', category, done,
  date: 'YYYY-MM-DD', notes, images: [{id, base64}],
  goalRef: { goalId, goalTitle, milestoneId, milestoneText, isMilestoneSelf },
  updatedAt }
```

### Reminder
```js
{ id, title, datetime: 'YYYY-MM-DDTHH:MM',
  recurrence: 'none'|'daily'|'weekly'|'monthly',
  category, notes, images: [], dismissed: boolean, updatedAt }
```

### Payment
```js
{ id, title, payee, amountMin, amountMax,
  dueDate: 'YYYY-MM-DD', recurrence, category,
  paid: boolean, notes, updatedAt }
```

### Goal
```js
{ id, title, category, targetDate, notes,
  milestones: [{id, text, done, date}],  // always normalize to [] on load
  images: [{id, base64}],               // always normalize to [] on load
  completed, completedDate, updatedAt }
// goalRef on tasks:
{ goalId, goalTitle, milestoneId, milestoneText, isMilestoneSelf }
```

### Category (task/goal)
```js
{ id, label, color }  // stored in waypoint_categories
```

### Payment Categories
```js
['Utilities', 'Subscriptions', 'Loans', ...]  // plain string[], waypoint_payment_cats
```

### Settings
```js
{ name, notificationsEnabled, geminiApiKey, groqApiKey,
  gistToken, gistId, aiEngine, aiEngineForcedGroqUntil,
  closePhrase, deviceType: 'phone'|'chromebook'|'pc' }
```

---

## W5. COMPONENT ARCHITECTURE — WAYPOINT

| Component | Purpose |
|---|---|
| `App` | Root state, all handlers, layout |
| `Dashboard` | Tasks + At a Glance + Coming Up + Upcoming Payments (7 days) |
| `RemindersModule` | Personal + Payments sub-tabs |
| `PaymentRemindersTab` | Payments list + outstanding balance card |
| `GoalsModule` | Goal cards list |
| `GoalDetail` | Desktop 540px panel — read/edit mode |
| `GoalDetailModal` | Mobile bottom sheet — read/edit mode |
| `DetailPanel` | 540px right column wrapper (desktop) |
| `SettingsModal` | 7-tab settings (App · Categories · Api · Data · Sync · Reset · About) |
| `QuickAddModal` | + button modal — Task/Reminder/Goal, tab-aware default |
| `DateNav` | Sticky date navigator, all tabs |
| `AIAssistant` | Chat modal with full read/write access |

### Desktop Layout
```
[220px sidebar fixed] [flex:1 main] [540px detail panel (conditional)]
```

### Two Render Paths
| Mobile | Desktop |
|---|---|
| `GoalDetailModal` | `GoalDetail` in `DetailPanel` |
| `ReminderDetailModal` | `ReminderDetail` in `DetailPanel` |

**Known asymmetry:** `+ Add Milestone` button exists in `GoalDetail` (desktop) but not in `GoalDetailModal` (mobile). Address when touching that component.

---

## W6. PROP CHAINS — WAYPOINT

These prop chains must stay in sync when touching these components.

### paymentCats
```
App.paymentCats (state, waypoint_payment_cats)
  → SettingsModal (props: paymentCats, onPayCatSave)
```
⚠️ `PaymentRemindersTab` add/edit form **still uses hardcoded `PAYMENT_CATS` constant** — known open issue. Fix: pass `paymentCats` prop through `RemindersModule` → `PaymentRemindersTab`.

### payments → Dashboard
```
App.payments → Dashboard (prop: payments)
```

### onTaskSwap
```
App.handleTaskSwap
  → GoalsModule → GoalDetailModal
  → DetailPanel → GoalDetail
```
⚠️ `onTaskSwap` missing from `DetailPanel` was the v2.1.1 bug — verify this prop is threaded through whenever touching that chain.

---

## W7. MODULE STATUS — WAYPOINT (v2.1.5)

| Module | Status | Notes |
|---|---|---|
| Dashboard | ✅ | Tasks, At a Glance, Coming Up, Upcoming Payments (7 days) |
| Reminders | ✅ | Personal + Payments sub-tabs |
| Goals | ✅ | Read/Edit mode, milestone collapse |
| Notes | ✅ | Quick capture, tags, search |
| AI Assistant | ✅ | Groq/Gemini, voice, write-access |
| Settings | ✅ | App / Categories (project + payment) / Api / Data / Sync / Reset / About |
| Quick Add Modal | ✅ | Defaults to correct type based on active tab (`initialTab` prop wired) |
| Desktop Sidebar | ✅ | 220px fixed |
| Desktop Detail Panel | ✅ | 540px, Tasks/Reminders/Goals |
| Date Navigator | ✅ | Sticky, ← Prev / Today / Next → |
| Carry-Forward | ✅ | Incomplete past tasks auto-move to today |
| Gist Sync | ✅ | Push/Pull/Auto (5 min), per-record merge |
| Payment Reminders | ✅ | Sub-tab under Reminders |

---

## W8. CLOUDFLARE WORKER — WAYPOINT (v2.0)

**Worker name:** `waypoint-vault`
**Worker URL:** `https://waypoint-vault.jessecaldwell07.workers.dev`
**Origin lock:** `https://gizmo5332.github.io`
**KV binding:** Variable name `KV` | Namespace `WAYPOINT_KV`

### Required Secrets
| Secret | Value Type |
|---|---|
| `GROQ_API_KEY` | Groq API key (Encrypted) |
| `GITHUB_TOKEN` | GitHub PAT with gist scope (Encrypted) |
| `GIST_ID` | 32-character Gist ID (plain) |
| `WAYPOINT_PIN` | 8-digit PIN (Encrypted) |
| `WAYPOINT_PASSPHRASE` | Recovery passphrase (Encrypted) |

### Routes
| Method | Route | Purpose |
|---|---|---|
| `POST` | `/groq` | Proxy to Groq AI (`llama-3.3-70b-versatile`) |
| `GET` | `/gist` | Pull latest data from GitHub Gist (handles truncation via raw_url) |
| `POST` | `/gist` | Push local data to GitHub Gist |
| `POST` | `/recover` | Recovery passphrase → reset KV lockout (no PIN required) |
| `POST` | `/ocr` | BACKLOG — returns 501 |

### Authentication & Rate Limiting
- Every request (except `/recover`) must include header: `X-Waypoint-Pin: <pin>`
- Wrong PIN → `401 { error: "wrong_pin", remaining: N }`
- 3 wrong PINs → `423 { error: "locked", until: ISO }` — 30-min lockout
- Wrong passphrase ×2 → 30-min full lockout
- Non-allowed origin → `403`

### What Changed from v1.0
- Added `jsonResponse()` helper
- KV rate limiting: 3 wrong PINs → 30-min IP lockout
- `/recover` route: passphrase resets lockout
- 8-digit PIN support

### Worker v2.0 Code
Paste into Cloudflare dashboard → Workers & Pages → waypoint-vault → Edit Code:

```js
// ─── WAYPOINT WORKER v2.0 ────────────────────────────────
const ALLOWED_ORIGIN = "https://gizmo5332.github.io";

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Waypoint-Pin",
    "Content-Type": "application/json",
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (origin !== ALLOWED_ORIGIN) {
      return jsonResponse({ error: "Forbidden" }, 403, origin);
    }

    if (path === "/recover") return handleRecover(request, env, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const attemptKey = "attempts:" + ip;
    let attemptData = { count: 0, lockedUntil: null };
    try {
      const stored = await env.KV.get(attemptKey);
      if (stored) attemptData = JSON.parse(stored);
    } catch (e) {}

    if (attemptData.lockedUntil && new Date(attemptData.lockedUntil) > new Date()) {
      return jsonResponse({ error: "locked", until: attemptData.lockedUntil }, 423, origin);
    }

    const pin = request.headers.get("X-Waypoint-Pin") || "";
    if (pin !== env.WAYPOINT_PIN) {
      attemptData.count = (attemptData.count || 0) + 1;
      if (attemptData.count >= 3) {
        attemptData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await env.KV.put(attemptKey, JSON.stringify(attemptData), { expirationTtl: 3600 });
        return jsonResponse({ error: "locked", until: attemptData.lockedUntil }, 423, origin);
      } else {
        await env.KV.put(attemptKey, JSON.stringify(attemptData), { expirationTtl: 3600 });
        return jsonResponse({ error: "wrong_pin", remaining: 3 - attemptData.count }, 401, origin);
      }
    }

    try { await env.KV.delete(attemptKey); } catch (e) {}

    if (path === "/groq") return handleGroq(request, env, origin);
    if (path === "/gist") return handleGist(request, env, origin);
    if (path === "/ocr")  return handleOCR(request, env, origin);

    return jsonResponse({ error: "Not found" }, 404, origin);
  }
};

async function handleRecover(request, env, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const passKey = "pass_attempts:" + ip;
  const attemptKey = "attempts:" + ip;
  let passData = { count: 0, lockedUntil: null };
  try {
    const stored = await env.KV.get(passKey);
    if (stored) passData = JSON.parse(stored);
  } catch (e) {}

  if (passData.lockedUntil && new Date(passData.lockedUntil) > new Date()) {
    return jsonResponse({ error: "locked", until: passData.lockedUntil }, 423, origin);
  }

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const passphrase = body.passphrase || "";

  if (passphrase === env.WAYPOINT_PASSPHRASE) {
    try { await env.KV.delete(attemptKey); } catch (e) {}
    try { await env.KV.delete(passKey); } catch (e) {}
    return jsonResponse({ ok: true }, 200, origin);
  }

  passData.count = (passData.count || 0) + 1;
  if (passData.count >= 2) {
    passData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await env.KV.put(passKey, JSON.stringify(passData), { expirationTtl: 3600 });
    return jsonResponse({ error: "locked", until: passData.lockedUntil }, 423, origin);
  } else {
    await env.KV.put(passKey, JSON.stringify(passData), { expirationTtl: 3600 });
    return jsonResponse({ error: "wrong_passphrase", remaining: 2 - passData.count }, 401, origin);
  }
}

async function handleGroq(request, env, origin) {
  const body = await request.json();
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.GROQ_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await upstream.json();
  return jsonResponse(data, upstream.status, origin);
}

async function handleGist(request, env, origin) {
  if (request.method === "GET") {
    const upstream = await fetch("https://api.github.com/gists/" + env.GIST_ID, {
      headers: {
        "Authorization": "token " + env.GITHUB_TOKEN,
        "User-Agent": "Waypoint/2"
      }
    });
    const gist = await upstream.json();
    const file = gist.files && gist.files["waypoint-data.json"];
    if (!file) return jsonResponse({ error: "Gist file not found" }, 404, origin);

    if (file.truncated) {
      const raw = await fetch(file.raw_url);  // ← no headers on raw_url
      const content = await raw.text();
      return new Response(content, { status: 200, headers: corsHeaders(origin) });
    }
    return new Response(file.content, { status: 200, headers: corsHeaders(origin) });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const upstream = await fetch("https://api.github.com/gists/" + env.GIST_ID, {
      method: "PATCH",
      headers: {
        "Authorization": "token " + env.GITHUB_TOKEN,
        "User-Agent": "Waypoint/2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: { "waypoint-data.json": { content: JSON.stringify(body) } }
      })
    });
    const data = await upstream.json();
    return jsonResponse({ ok: true, updated_at: data.updated_at }, upstream.status, origin);
  }

  return jsonResponse({ error: "Method not allowed" }, 405, origin);
}

async function handleOCR(request, env, origin) {
  return jsonResponse({ error: "OCR not yet implemented" }, 501, origin);
}
```

---

## W9. SYNC SPEC — WAYPOINT

- Push includes: tasks, reminders, goals, categories, notes, payments
- Pull handles truncation — fetches `raw_url` with NO headers when `content` is null/truncated
- Device types: Phone + Chromebook = auto-sync every 5 min. PC = manual only
- Per-record merge: highest `updatedAt` wins

---

## W10. IMAGE HANDLING — WAYPOINT

All `handleImg` functions compress to max 800px / 60% JPEG (~80KB). Gist push payload safety valve strips all `images` arrays if payload exceeds 800KB.

---

## W11. KNOWN BUGS & OPEN ISSUES — WAYPOINT (as of v2.1.5)

### Open Issues
| Issue | Severity | Notes |
|---|---|---|
| `PaymentRemindersTab` form uses hardcoded `PAYMENT_CATS` | Medium | Doesn't reflect custom payment cats from Settings. Fix: pass `paymentCats` prop through `RemindersModule` → `PaymentRemindersTab`; replace `PAYMENT_CATS.map(...)` in form dropdown |
| Payment recurrence logic incomplete | Medium | Marking paid doesn't auto-schedule next occurrence |
| `PaymentCard` defined inside `PaymentRemindersTab` | Low | Extract to top-level component when touching that file |
| `+ Add Milestone` missing from `GoalDetailModal` (mobile) | Low | Desktop `GoalDetail` has it; mobile users must use Edit flow |

### Fixed — Do Not Reintroduce
| Version | Bug | What Was Wrong |
|---|---|---|
| v2.0.1 | Auth header on `raw_url` fetch | CORS failure on Gist Pull |
| v2.0.2 | `Cache-Control` header on GitHub GET | CORS preflight rejection |
| v2.0.5 | Stray `)}` after changelog collapsible | Blank screen |
| v2.0.6 | About section missing `{tab==='about'&&(...)}` wrapper | Rendered on all tabs |
| v2.0.7 | `useState` after conditional return in `RemindersModule` | Crashed entire app |
| v2.0.8 | `goal.milestones` undefined on synced goals | TypeError on goal select |
| v2.0.9 | `fileRef=useRef()` missing in `GoalDetail` | ReferenceError on Chromebook goal select |
| v2.1.1 | `onTaskSwap` not passed through `DetailPanel` | ReferenceError on desktop goal click |
| v2.1.5 | `initialTab` prop not wired at QuickAddModal call site | Always defaulted to Task type regardless of active tab |

---

## W12. VERSION HISTORY — WAYPOINT (Recent)

| Version | Date | Summary |
|---|---|---|
| v2.1.5 | 2026-04-09 | Quick Add defaults to correct type based on active tab (initialTab wired) |
| v2.1.4 | 2026-04-09 | Dashboard: Upcoming Payments (7 days); Settings: Categories tab merges Project + Payment cats |
| v2.1.3 | 2026-04-06 | Goal category dropdowns use custom cats list |
| v2.1.2 | 2026-04-06 | Settings → Categories: full add/rename/recolor/delete |
| v2.1.1 | 2026-04-06 | Fixed blank screen on desktop goal click (onTaskSwap missing from DetailPanel) |
| v2.1.0 | 2026-04-04 | Goals read/edit mode; Dashboard reminders tappable |
| v2.0.9 | 2026-04-04 | fileRef missing in GoalDetail — ReferenceError on Chromebook |
| v2.0.8 | 2026-04-04 | normalizeGoal — milestones/images always arrays |
| v2.0.7 | 2026-04-04 | Hook violation fix in RemindersModule |

---

## W13. BACKLOG — WAYPOINT (Priority Order)

| Priority | Item |
|---|---|
| **MEDIUM** | Wire `paymentCats` into `PaymentRemindersTab` form dropdown — replace hardcoded `PAYMENT_CATS` |
| **MEDIUM** | Payment recurrence — mark paid → prompt to schedule next occurrence |
| LOW | Extract `PaymentCard` to top-level component |
| LOW | `+ Add Milestone` in `GoalDetailModal` (mobile) |
| LOW | Family Context / Scout module (Phase 2) |

---

## W14. DEPLOYMENT CHECKLIST — WAYPOINT

1. Delete existing `index.html` in repo
2. Upload new `index.html` via GitHub file picker
3. Verify ✅ green check in GitHub Actions
4. Wait 2–3 min for CDN propagation
5. Hard refresh: Ctrl+Shift+R (Chromebook), clear cache (Android)
6. Confirm version number in Settings → About tab

---

# PART 4 — DPS DAILY PLANNER

**App:** Daily supervisor planning tool for training tracking and coverage
**Repo:** `jcaldwelldmp/Daily-Planner`
**Live URL:** `https://jcaldwelldmp.github.io/Daily-Planner/`
**Stack:** React 18 CDN + Babel Standalone 7.23.2 + localStorage + GitHub Gist
**Current:** v32.18.0 | `DPS.html` ~16,140 lines (see P1 registry for live version — cross-check before trusting this line)

---

## D1. DESIGN SYSTEM — DPS

```js
const C = {
  bg: '#111318', su: '#181b24', ca: '#1c1f2b', bo: '#252836',
  or: '#f97316', gr: '#22c55e', rd: '#ef4444', yl: '#eab308',
  pu: '#a855f7', bl: '#3b82f6', tx: '#e8ebf4', mu: '#8b90a8', te: '#14b8a6'
};
const MO = "'Courier New', Courier, monospace";
```

**Semantic color assignments:**
- Orange = Schedule
- Purple = Training
- Blue = Department
- Teal = Personal Projects

**Supervisor → color mapping:**
- Dolan Parnell → blue
- Ryan Kay → dark-green
- Stephen Bowen → light-green
- Brent Appleby → red

---

## D2. LOCALSTORAGE KEYS — DPS

```
dps-v2              dps-agents           dps-absences
dps-training-outline  dps-queue-minimums  dps-seat-roles
dps-added-seats     dps-deleted-seats    dps-mode
dps-fontscale       dps-projects
```

---

## D3. FILE SIZE MANAGEMENT — DPS

The DPS file is ~7,583 lines. This requires special care:
- **Never copy-paste into GitHub editor** — silently truncates at ~5,900 lines
- Track line count in every handoff document
- Use `grep -c ''` to get exact line count before delivery
- Context management per session is critical — batch changes efficiently

---

## D4. TRAINING WORKFLOW — DPS

Complete flow (must be sequential — each phase gates the next):

1. **Days (15)** — daily check-ins, quizzes, homework → gate requires all 15 days + all quiz scores + final quiz → generates supervisor HTML email + agent plain text email
2. **Mock Calls** — logged calls + `mockDoingWell` + `mockAreasOfImprovement` → gate requires ≥1 call + both fields → emails
3. **Buddy Calls** — logged calls + `buddyDoingWell` + `buddyAreasOfImprovement` → gate requires ≥1 call + both fields → emails
4. **Eval** — DMP Values + TSWP ratings → Clear for Solo requires `mockCallsComplete` + `buddyCallsComplete` + all categories rated
5. **Clear for Solo** → sets `trainingComplete`, `clearForSoloDate`, graduates agent to active roster

---

## D5. AGENT DATA MODEL — DPS

```js
{
  // Core
  name, status, notes: [],

  // Days phase
  doingWell, areasOfImprovement,

  // Mock phase
  mockCallStartDate,
  mockDoingWell, mockAreasOfImprovement,
  mockCallsComplete, mockCallsCompleteDate,

  // Buddy phase
  buddyCallStartDate,
  buddyDoingWell, buddyAreasOfImprovement,
  buddyCallsComplete, buddyCallsCompleteDate,

  // Eval
  trainingEval: {
    signedOff, signedOffDate,
    dmpValues,   // ratings object
    tswp         // ratings object
  }
}
```

**Critical rule:** Any time `sanitizeAgent` gets new fields, `initAgent` must also be updated. Verify `buddyDoingWell`, `buddyAreasOfImprovement`, `buddyCallStartDate` exist in `initAgent`. Failure = new records missing fields, old records crashing on access.

---

## D6. SANITIZE + INIT PATTERN — DPS

Both functions must stay in sync. Every new field added to one must be added to both.

```js
// sanitizeAgent — runs on every load (handles old records)
const sanitizeAgent = h => ({
  ...h,
  name: h.name || '',
  status: h.status || 'trainee',
  notes: h.notes || [],
  mockCallsComplete: h.mockCallsComplete || false,
  buddyDoingWell: h.buddyDoingWell || '',
  buddyAreasOfImprovement: h.buddyAreasOfImprovement || '',
  buddyCallStartDate: h.buddyCallStartDate || '',
});

// initAgent — runs when creating a NEW record — must match sanitize exactly
const initAgent = () => ({
  name: '', status: 'trainee', notes: [],
  mockCallsComplete: false,
  buddyDoingWell: '',
  buddyAreasOfImprovement: '',
  buddyCallStartDate: '',
});
```

---

## D7. MIMECAST URL ISSUE — DPS

**BUG-02:** GitHub API URLs in the source may be wrapped by Mimecast proxy (appear as `url.us.m.mimecastprotect.com/...`). These must be the real GitHub API URLs (`https://api.github.com/gists`, etc.) in any clean copy. Check `useGistSync` around lines 1981, 1989, 2005.

---

## D8. EMAIL GENERATION PATTERN — DPS

### Two Emails Per Phase
1. **Supervisor email** — HTML formatted, embedded progress data, professional layout
2. **Agent email** — Plain text, conversational tone, wraps narrative fields

### Copy State Pattern
```js
const[copiedSupEmail, setCopiedSupEmail] = useState(false);
setCopiedSupEmail(true);
setTimeout(function() { setCopiedSupEmail(false); }, 2000);
```

### Conditional Email Button Rule
Email buttons appear only after a phase is marked complete. Never show before.

```jsx
{hire.mockCallsComplete && (
  <div>
    <button onClick={copyMockSupEmail}>📋 Supervisor Email</button>
    <button onClick={copyMockAgentEmail}>📋 Agent Email</button>
  </div>
)}
```

---

## D9. COMPLETION GATE PATTERN — DPS

Always gate actions to when all requirements are satisfied. Show specific missing items, not generic errors.

```js
const missingItems = [];
if (!allDaysChecked) missingItems.push('All training days must be checked');
if (!allQuizScoresEntered) missingItems.push('All quiz scores must be entered');
if (!finalQuizScore) missingItems.push('Final quiz score is required');
const canComplete = missingItems.length === 0;

// In JSX:
{!canComplete && (
  <ul style={{ color: C.rd, fontFamily: MO, fontSize: 11 }}>
    {missingItems.map(function(m, i) { return <li key={i}>{m}</li>; })}
  </ul>
)}
<button disabled={!canComplete} onClick={handleComplete}
  style={{ opacity: canComplete ? 1 : 0.4 }}>
  Mark Complete
</button>
```

---

## D10. KEY LINE REFERENCE — DPS

| Approx Line | Section |
|---|---|
| ~59 | C, MO, PD constants |
| ~175 | expandSyncData |
| ~250 | loadOutline / saveOutline |
| ~340 | loadProjects / saveProjects |
| ~400 | Modal component |
| ~720 | FullBackupRestoreModal |
| ~760 | CollectTab |
| ~1961 | useGistSync hook |
| ~2330 | Training Mode constants |
| ~2442 | sanitizeAgent |
| ~2612 | initAgent |
| ~3274 | buddySectionHtml |
| ~3420 | generateMockSupEmailHtml |
| ~3494 | generateBuddySupEmailHtml |
| ~4119 | Buddy Calls tab |
| ~4265 | Eval tab |
| ~5010 | CoverageGrid |
| ~6503 | DailyPlanner |

---

## D11. KNOWN BUGS & REGRESSION RISKS — DPS

### Open Bugs
| # | Issue | Notes |
|---|---|---|
| BUG-01 | Buddy Calls flow untested end-to-end | Gate, narrative fields, email gen, Clear for Solo dependency |
| BUG-02 | Gist Mimecast URL wrapping | Real GitHub URLs must replace any mimecastprotect.com URLs |
| BUG-03 | Personal Projects (PROJ-E) — untested post-build | Check for state bleed after buddy calls changes |
| BUG-04 | Auto-poll disabled | Commented out at ~line 2043 — ready to uncomment but not validated |
| BUG-05 | `initAgent` may be missing new buddy fields | Verify `buddyDoingWell`, `buddyAreasOfImprovement`, `buddyCallStartDate` |
| BUG-06 | Date input timezone off-by-one | Use `fmtDate()` with `T12:00:00` on all date displays |
| BUG-07 | Gist pull `raw_url` fallback risk | Falls back to inline `content` if `raw_url` missing — will truncate at 1MB as data grows |
| BUG-08 | `mobile.html` not kept in sync | Intentionally lightweight but diverging from main features |

### Regression Risks
- Adding a new agent field without updating both `sanitizeAgent` AND `initAgent`
- Deploying via copy-paste — silent truncation at ~5,900 lines
- Using `?.` or `??` in any new code — silent Babel crash
- `JSX title={expr||expr}` — extract to const first
- ISO date strings displayed directly — always append `T12:00:00` or use `fmtDate()`

---

## D12. BACKLOG — DPS (Priority Order)

| # | Priority | Item |
|---|----------|------|
| BUDDY-TEST | **NEXT** | Test full buddy calls flow end-to-end after deploy |
| PROJ-E | POST-TEST | Bug reports & polish from personal projects after testing |
| DEPT-A | PLANNED | Department Projects tab — Jesse's view, `dps-dept-projects` key |
| DEPT-B | PLANNED | Team-facing secondary page — 6 team tabs, check-off + time log |
| DEPT-C | PLANNED | Gist sync for dept projects — merge-on-read strategy |
| CODE-1 | MEDIUM | Code documentation — after architecture meeting |
| DOCS-1 | MEDIUM | Development Archaeology — synthesize changelog + error pattern doc |
| 7 | LOW | JSON import on mobile |

---

## D13. DEPLOYMENT — DPS

1. Download `index.html` from Claude output to phone Downloads
2. GitHub.com → repo → **Add file → Upload files** → select → commit to main
3. **Never copy-paste** — truncates silently at ~5,900 lines
4. Run 💾 BACKUP immediately after every deploy
5. Verify version number in Settings → About

---

## D14. WORKING-MODEL BOUNDARY — DPS & WORK APPS

**Claude writes all code; Boss performs ALL deploys and infra changes** for DPS and related work apps (GitHub pushes, Cloudflare, anything on `jcaldwelldmp/` infrastructure).

- Claude delivers files + exact commit messages/instructions
- Claude **never** attempts direct API deploys to `jcaldwelldmp/` repos or DPS infrastructure (dev PAT doesn't cover them anyway — see P5)
- Brent Appleby (former manager) has been superseded by Jonathan Whisman. No formal cross-device sync approval exists or is being sought; `dps-vault` sync has been running live and unapproved since v32.9.0 (June 22, 2026), predating the standalone-arch spec by 2 days. Left running as-is, not expanded. If sync work resumes, planned approach is a shared network-drive folder, not `dps-vault`. See `dps-standalone-arch-spec-v1.md` §1a.

---

# PART 5 — UTILITY PATTERNS (All Projects)

---

## UP1. SAFE ID GENERATION
```js
// React projects (Waypoint, DPS)
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Vanilla JS (Arché)
function genId() { return Date.now() + Math.random(); }
```

---

## UP2. DATE FORMATTING (Safe for US Timezones)
```js
const fmtDate = str => {
  const d = new Date(str + 'T12:00:00'); // noon anchor prevents off-by-one day
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });
};

// Convert display (MM/DD/YYYY) → ISO (YYYY-MM-DD) for storage
const parseFmt = str => {
  const p = str.split('/');
  if (p.length === 3) {
    const [m, d, y] = p;
    if (y && m && d) return `${y.trim()}-${m.trim().padStart(2,'0')}-${d.trim().padStart(2,'0')}`;
  }
  return null;
};
```

---

## UP3. FULL BACKUP SHAPE & VALIDATION
```js
// Backup
const backup = {
  version: 'full-backup-1',   // sentinel for validation
  exportedAt: new Date().toISOString(),
  mainState: JSON.parse(localStorage.getItem('app-v1') || '{}'),
  agents: JSON.parse(localStorage.getItem('app-agents') || '[]'),
};

// Restore — always validate sentinel first
if (d.version !== 'full-backup-1') {
  setErr('This does not look like a valid backup file.');
  return;
}
```

---

## UP4. useCallback FOR ASYNC HANDLERS
Use `useCallback` for all push/pull functions to prevent stale closure bugs.

```js
const gistPush = useCallback(function(currentData) {
  // push logic
}, [gistToken, gistId, data]);
```

---

## UP5. JSX SYNTAX CHECKING NOTE
`node --check` and `node -e` with `vm.compileFunction` give false "Unexpected token '<'" errors due to JSX — this is expected and normal. Use manual `view` review instead for JSX validation.

---

*MASTER_KNOWLEDGE_BASE_v3.md*
*Consolidated April 23, 2026 from: MASTER_KNOWLEDGE_BASE-1.md · WAYPOINT-KNOWN-ISSUES.md · waypoint-handoff-v13.md · waypoint-worker-v2.docx*
*Original coverage snapshot: Waypoint v2.1.5 · Arché v3.4/v2.6/v1.6 · DPS HANDOFF_27 (all stale — see P1 table for current versions)*
*Updated June 18, 2026 — P1 directory, Part 2 Arché section (A8 Worker routes, A13 brand identity, A15 backlog), and Part 6 (XP-8) refreshed against the post-migration Pilgrim/Scribe/Codex state. Parts 3 (Waypoint) and 4 (DPS) untouched this pass — audit those in the DPS/Waypoint thread.*
*Upload to unified Claude Project. Do not delete or replace — append new learnings at bottom.*

---

# PART 6 — CROSS-PROJECT LEARNINGS LOG

*Entries added per P4 protocol. Scan this section at the start of every session before writing code.*

---

### XP-1: Filter+Push Deduplication Wipes Flags
**Discovered:** Pilgrim v4.9.15 — May 28, 2026
**Pattern:** When deduplicating a list item by removing the old entry and pushing a new one, any flags set on the old entry (e.g. `inGlobal`, `inStudy`) are lost — the new entry only has flags set at push time.
**Root cause:** `array.filter(w => w.id !== id).push(newItem)` — the filter removes all data on the old record. If `newItem` was built before the filter, it doesn't know what flags the old entry had.
**Fix:** Find the existing item first. If found, MERGE flags onto it (`if(toGlobal) existing.inGlobal = true`) and update its content. Only push if not found.
**Check in:** DPS (extTraining session dedup), Codex (any word/lesson save dedup), Waypoint (reminder/payment dedup).

---

### XP-2: localStorage Reload Invalidates Active Object References
**Discovered:** Pilgrim v4.9.15 — May 28, 2026
**Pattern:** A function calls `loadStudies()` (or equivalent) which does `studies = JSON.parse(localStorage.getItem(...))`, creating a brand new array. Any variable (`cur`, `selectedItem`, etc.) that pointed into the old array is now stale — modifications to it no longer affect `studies`, so `persist()` saves without those changes.
**Root cause:** `JSON.parse` always creates new objects. Old references point to orphaned objects.
**Fix:** After any `load*()` call that replaces the array, immediately re-sync active references: `if(cur){ cur = studies.find(s => s.id === cur.id) || cur; }`
**Check in:** Pilgrim (`loadStudies` in `renderWordList`, `renderLib`), DPS (any function that re-reads `sd` from localStorage mid-session), Codex (any module reload pattern).

---

### XP-3: Shared Storage Key Written by Two Code Paths — Replace vs. Merge
**Discovered:** DPS v31.94 — May 28, 2026
**Pattern:** Two separate code paths write to the same storage key. Path A (modal) reads the key on open, stores local state, then REPLACES the key on save. Path B (external function) writes entries to the same key at any time. If Path A saves after Path B wrote, Path B's entries are wiped.
**Root cause:** Modal's `onSave(rows)` does `setSd({...p, [key]: rows})` — full replace, not merge.
**Fix:** Tag Path B entries with `source:'injected'` (or similar). On Path A save, merge: `[...rows.filter(r => r.source !== 'injected'), ...existing.filter(e => e.source === 'injected')]`. Display injected entries as read-only in the modal.
**Check in:** DPS (`timerLogs-DATE` shared by Timer Modal + `upsertDeptTimerLog`). Any project where a modal edits a list that another system also writes to.

---

### XP-4: CSS display:flex Hardcoded on Hidden Panel — Always Visible
**Discovered:** Codex v1.9.3 — May 28, 2026
**Pattern:** A panel intended to be hidden by default has `display:flex` hardcoded in its CSS. Only the overlay or backdrop toggles visibility, not the panel itself. The panel header/content is always rendered and visible at the bottom/edge of the screen.
**Root cause:** Missing `display:none` default. The `.on` toggle was only applied to the overlay wrapper, not the panel element.
**Fix:** CSS default → `display:none`. Add `.panel.on { display:flex }`. Update open/close JS to toggle `.on` on the panel element, not just the overlay.
**Check in:** Codex (test panel — fixed), Pilgrim (any overlay panels), DPS (any slide-up or fixed panels with `.on` toggling), Waypoint (any modal/panel components).

---

### XP-5: Version String Stored in Multiple Locations
**Discovered:** Codex v1.9.3 — May 28, 2026
**Pattern:** App version appears in both a JS constant (`const CODEX_VERSION = '1.9.0'`) AND an HTML string in the About section. Bumping only one leaves the displayed version stale.
**Root cause:** Two sources of truth for the same value.
**Fix:** Always grep for ALL instances of the version string before closing a session. Update every occurrence. Consider making the HTML about text reference the JS constant via `innerHTML` or template.
**Check in:** Codex (both fixed), Pilgrim (uses changelog array + header — verify both), DPS (`DPS_VERSION` constant only — single source ✓), Waypoint (verify).

---

### XP-6: Working File Lost — Never Deploy Only to Claude Outputs
**Discovered:** DPS — May 28, 2026
**Pattern:** Many consecutive Claude sessions built v31.57 through v31.92, but none were uploaded to GitHub. When the GitHub file was deleted, recovery from commit history only returned v31.56 — 36 versions of work lost.
**Root cause:** Relying on Claude's session output files as the only copy. Claude outputs expire. GitHub is the only persistent store.
**Fix / Standing Rule:** Deploy to GitHub immediately after EVERY session. Do not start a new session until the previous session's output is committed. After any deploy, verify the version number at the live URL.
**Check in:** ALL projects. This is a workflow rule, not a code rule.

---

### XP-7: openAiPanel (or similar context function) Must Handle Null Context Gracefully
**Discovered:** Codex v1.9.3 — May 28, 2026
**Pattern:** A function like `openAiPanel(lessonId, secIdx)` queries the DOM for elements based on `lessonId`. If called with `null` (e.g. from a FAB with no lesson loaded), the DOM query fails and the function crashes or shows blank content.
**Root cause:** No null guard on the context parameter before DOM/data access.
**Fix:** Add a null check at the top: `if(lessonId){ /* DOM query */ } else { /* generic fallback title/context */ }`.
**Check in:** Codex (fixed), DPS (any panel-open functions that take an entity ID), Pilgrim (lexicon modal open functions), Waypoint (detail panel open handlers).

---

### XP-8: Hardcoded External URLs Survive Migrations Undetected
**Discovered:** Pilgrim Private/Public/Scribe v4.9.73/v4.1.1/v2.1 — June 18, 2026 (GitHub repo migration session)
**Pattern:** A share/deep-link function (`shareStudyLinkById()` in this case) had the destination URL hardcoded as a string literal rather than referencing a single named constant. When the repo/domain moved (`gizmo5332.github.io/JC-Study-Tool` → `archestudytools.com/pilgrim-public/`), the hardcoded copy kept pointing at the dead URL. It wasn't caught until manual testing post-migration because the function still "worked" (produced *a* URL) — it just produced the wrong one.
**Root cause:** Two sources of truth for the same URL: an `APP_SHARE_URL` constant used in most places, and a leftover hardcoded literal in one function that predated the constant's introduction.
**Fix:** Route every outbound share/deep-link/redirect URL through one named constant (`APP_SHARE_URL` or equivalent). After any domain/repo migration, `grep -n` the codebase for the literal old domain string to catch stragglers before declaring the migration done.
**Check in:** DPS (any hardcoded `jcaldwelldmp.github.io` references), Codex (`Open in Pilgrim →` style cross-links — already fixed in Scribe this session, verify Codex), Waypoint (any share/export links), CSBC (external links to Planning Center/YouTube once wired).

---

### XP-9: Stale Browser Tabs Mimic Data-Loss Bugs in Single-Page Apps
**Discovered:** Pilgrim Private v4.10.0–v4.10.5 — June 20, 2026 (PIN auth namespacing session)
**Pattern:** A long-lived single-page app holds all its state in memory with no full page reload between actions. If the same app is open in multiple browser tabs, each tab freezes its own independent copy of that state at whatever moment it last loaded. Restore/sync/import actions in one tab don't propagate to other open tabs — checking the result in a *different* tab than the one used for the action looks exactly like a data-loss bug: the toast reports success, but the visible UI shows the stale tab's old state.
**Root cause:** Browsers suspend rather than kill background tabs; nothing in the app detects or warns about multiple simultaneous instances of itself running against the same storage.
**Fix:** When a user reports "data vanished" or "it said success but nothing changed," rule out multi-tab/stale-session state FIRST — have them close all tabs of the app and reload fresh in a single tab before investigating storage or code further. Future enhancement to consider: a `storage` event listener or `BroadcastChannel` to detect and warn about multiple open tabs.
**Check in:** DPS, DPS Supervisors, Waypoint, leads.html, Gmail Cleaner, Scribe, Codex — any single-page app a user might reasonably leave open across multiple tabs during a session.

---

### XP-10: Mechanical Search/Replace Prepends `window.` to Keywords
**Discovered:** Pilgrim Private ES Modules extraction — June 2026
**Pattern:** A bulk search/replace that prepends `window.` to bare identifiers also catches language keywords, producing `window.if(`, `window.for(`, `window.while(` — a SyntaxError that makes the whole module load as a blank script, killing every function it exports.
**Root cause:** Regex identifier matching can't distinguish keywords from function names without a keyword exclusion list.
**Fix:** Full-file scan after ANY mechanical replace: `grep -n "window\.if(\|window\.for(\|window\.while(\|window\.return\b"` — must return 0. Fix ALL instances in one pass (`re.sub`), never just the reported line.
**Check in:** DPS ES Modules extraction (JSX variants: `window.useState(`, `window.useEffect(`, `window.onClick=`), any future single-file split.

---

### XP-11: ES Module Imported Bindings Are Read-Only
**Discovered:** Pilgrim Private ES Modules extraction — June 2026
**Pattern:** `import { TAGS } from './utils.js'` then `TAGS = saved;` → `TypeError: Assignment to constant variable`. Imports are live read-only bindings — readable, never writable from the importing module.
**Root cause:** ES module spec. Previously-global vars silently become unwritable after extraction.
**Fix:** Declaring module exports a setter (`export function setTags(v){ TAGS = v; }`); importers call the setter. Audit: for every name in an import block, grep that file for bare `name =` assignments — must return 0.
**Check in:** DPS extraction (React equivalent: never assign to props — use state setters/context dispatch), all future module splits.

---

### XP-12: Cross-Module Variable Writes Need Setters in the Declaring Module
**Discovered:** Pilgrim Private ES Modules extraction — June 2026
**Pattern:** Module B writes directly to a var declared in Module A (`_ttsActive`, `_fnotesOpen`) without importing it — worked as monolith globals, becomes `ReferenceError` after extraction.
**Root cause:** Monolith code assumes one shared scope; extraction fragments it.
**Fix:** Every variable written by >1 module gets a setter in its declaring module. During extraction phase a `window.setX(v)` accessor bridge is acceptable; replace with direct imports at finalization. Pre-extraction audit: for every `var _x =` in a module, grep all OTHER modules for `_x =` assignments.
**Check in:** DPS shared state (`sd`, `roster`, `agents`, `shiftData`) — controlled update paths required.

---

### XP-13: Missing Imports Are Invisible to Syntax Checkers
**Discovered:** Pilgrim Private ES Modules extraction — June 2026
**Pattern:** Identifier used in a module but never added to its import block (`libTab` in ui.js) → runtime `ReferenceError`. `node --check` passes clean — it catches syntax errors only, not reference errors.
**Root cause:** Static syntax validation can't resolve cross-module references.
**Fix:** Cross-reference audit: every bare identifier must be locally declared OR in an import block. Runtime smoke test (open every screen, click every tab) is the only reliable net until real tooling (bundler/ESLint) exists.
**Check in:** DPS extraction — worse there, since JSX blocks static auditing further; browser console is the detector.

---

### XP-14: localStorage Key Migration Must MOVE, Not COPY
**Discovered:** Pilgrim Private v4.13.2 hotfix — June 24, 2026
**Pattern:** Legacy-key migration copied data to the new key without deleting the old one. Both keys coexist, doubling usage; near-full storage throws `QuotaExceededError` on the copy — blocking login entirely.
**Root cause:** Copy-only migration treats storage as unlimited.
**Fix:** MOVE pattern — write new key, delete legacy key, with `QuotaExceededError` catch that deletes legacy first then retries the write. (Full code in es-modules-lessons-v2.md, Lesson 7.)
**Check in:** DPS vault migration, any key rename/namespace change in any app.

---

### XP-15: Proxy ALLOWED_ORIGINS Must Include localhost Before First Local Test
**Discovered:** Pilgrim Private ES Modules local dev — June 2026
**Pattern:** First local run of the modular build on `127.0.0.1:5500` had every proxy call CORS-blocked. Debug time burned on the "broken build" when the build was fine.
**Root cause:** Worker CORS whitelist only had production domains.
**Fix:** Add `http://127.0.0.1:5500` + `http://localhost:5500` to the Worker's ALLOWED_ORIGINS BEFORE the first local test — and log a reminder to REMOVE them before the production merge (Pilgrim did this as a pre-merge checklist item).
**Check in:** DPS extraction → dps-vault Worker (separate Cloudflare account from arche-proxy — update there, not arche-proxy).

---

### XP-16: ES Module Export Gaps Are Silent Runtime Failures

**Discovered:** Pilgrim Private ES Modules dev branch — June 26, 2026
**Pattern:** A function is defined in a module and works correctly, but is missing from the module's `export { }` block. The `app.js` window bridge loop only iterates `Object.keys(mod)` — which only includes exports. So `window.fnName` is never assigned. Any HTML `onclick="fnName()"` call fails at runtime with `ReferenceError: fnName is not defined`. No build error, no warning — completely silent until the user clicks the button.
**Root cause:** ES module bindings are explicit — only what's in the export block is visible to importers. A function defined but not exported is module-private. The window bridge loop cannot bridge what it cannot see.
**Fix:** Add `closeVerseModal` (or any missing function) to the export block. The bridge loop handles the rest automatically.
**Prevention:** Run `node tests/bridge-check.js` from `pilgrim-private/` before every `dev → main` merge. This script diffs HTML inline handler function calls against module export blocks and reports any gap. Exit code `1` on failure — CI-friendly.
**Check in:** Every ES module extraction session. Any time a new `onclick`/`onX` handler is added to `index.html`, verify the target function is in its module's export block.

---

### XP-17: Long-Lived Migration Branch Misses Hotfixes Landed on main
**Discovered:** Pilgrim Private `dev → main` merge — July 19, 2026
**Pattern:** During the month-long ES Modules migration on `dev`, `main` received a direct hotfix (v4.13.2 `migrateLegacyKey` move-not-copy). The extraction was based on the pre-hotfix file, so `dev` silently carried the OLD buggy code. Merging would have reintroduced a previously-fixed data-loss bug as a production regression.
**Root cause:** Extraction snapshots the source file at one moment; any later change to the original on `main` is invisible to the branch unless deliberately ported.
**Fix:** Before ANY long-lived branch merges to main: list main-only commits since the common ancestor (`git log ancestor..main` / compare API), and verify each one's change exists on the branch. During the migration itself: any hotfix to `main` gets an immediate port-forward entry in the session handoff — no exceptions.
**Check in:** DPS ES Modules migration — near-certain to recur since DPS gets live workplace fixes; institute a main-freeze or a mandatory port-forward log on day 1.

---

### XP-18: Structural File Rewrites Block GitHub Auto-Merge — Two-Parent Merge Tree Required
**Discovered:** Pilgrim Private `dev → main` merge — July 19, 2026
**Pattern:** `POST /repos/.../merges` returned 409 — not from line conflicts but because `main`'s ~7,284-line monolithic `index.html` vs. `dev`'s ~1,652-line shell can't be line-merged at all.
**Root cause:** Git's merge algorithm needs comparable line structure; a full-file rewrite has none.
**Fix:** Hand-build the merge via Git Data API: construct a tree taking the migrated directory wholesale from the branch and everything else that diverged from `main`, then `POST /git/commits` with BOTH heads as parents (a true merge commit, not a rewrite), then PATCH `refs/heads/main`. Verify post-merge: syntax check all modules, bridge-check, live smoke test. (Exact procedure: es-modules-lessons-v2.md, Lesson 15.)
**Check in:** DPS `dev → main` merge — guaranteed to hit this; plan the hand-built merge from the start, don't attempt the auto-merge endpoint first.

---

### XP-19: Extraction Spec Drifts From Live Code — Audit Before Session 1
**Discovered:** Pilgrim Private ES Modules Session 1 prep — June 23, 2026
**Pattern:** The module map in `pilgrim-es-modules-plan-v1.md` was written against v4.9.72 (28 sections). By extraction start the live file was v4.13.1 with 30 sections — two whole sections (Guided Tours, PIN Auth) had no module assignment.
**Root cause:** Specs are snapshots; active apps keep growing between spec-writing and execution.
**Fix:** Mandatory pre-extraction audit session: pull the LIVE file, diff its section list against the spec's module map, assign every unmapped section, and do cleanup (JSDoc gaps, dead code) BEFORE extracting — a clean baseline version (Pilgrim: v4.13.2) is the extraction source.
**Check in:** DPS — dps-reorg-plan-v2 and any DPS module map MUST be re-audited against the live file immediately before extraction begins, especially since DPS changes weekly with work needs.

---

### XP-20: Service Worker Serves Stale Modules Through Hard Refresh
**Discovered:** Pilgrim Private ES Modules QA — July 2026
**Pattern:** Fixed module pushed and downloaded, but the browser kept executing the pre-fix version even through Ctrl+F5 — a stale-file false negative that mimics "the fix didn't work."
**Root cause:** The PWA Service Worker serves cached module files; hard refresh doesn't reliably bypass SW caches. Compounding factor the same week: DevTools attached to the wrong tab entirely.
**Fix:** Debug-environment discipline before touching code: (1) confirm DevTools is on the app's actual tab/origin; (2) `fetch('./file.js?nocache='+Date.now())` to confirm what the server actually serves; (3) if stale, unregister the SW + clear caches from console. Line-number drift in stack traces is the fast stale-file tell. Also: the SW cache list must enumerate every `.js` module file post-split, or updates never propagate.
**Check in:** DPS (if/when it gets a SW), Pilgrim Public port, any PWA with cached modules.

---

### XP-21: Self-Check Functions Silently Break When Their Target File Moves in a Refactor
**Discovered:** Pilgrim Private — Aug 25, 2026 (Boss noticed the "New version available" banner had stopped appearing)
**Pattern:** `checkForUpdate()` re-fetched `index.html` and regex-matched for `CHANGELOG = [{version:'...'}]` to detect a newer deployed version — a pattern that worked when the app was one monolithic file. The ES Modules migration (dev→main merge, July 19) moved `CHANGELOG` out to `utils.js`; `index.html` never contained it again after that. The function's own `.catch()`/no-match branch fails silently by design (no error, no banner — never blocks the app), so there was zero symptom besides the banner quietly never appearing again. It sat broken for over a month before Boss noticed by absence.
**Root cause:** A function that fetches a specific file to check its own contents for staleness/version info implicitly assumes that file still contains what it's looking for. A file-reorganization refactor (ES Modules being the repeat offender) can silently invalidate that assumption with no build error, since it's a runtime string/regex match against fetched content, not a static reference the syntax checker or bridge-check.js would catch.
**Fix:** Point the fetch/regex at wherever the target data actually lives post-refactor (here: `utils.js` instead of `index.html`).
**Check in:** Any other self-referential "fetch my own file to check X" pattern, in this or any app, especially around the same ES Modules migration — audit for other functions that assume pre-migration file layout. Also worth a standing habit: after any structural file-reorg migration, grep for `fetch('./` and `fetch("./` calls in the affected app and confirm each target file still contains what the caller expects.
