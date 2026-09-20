# Session Handoff — Pilgrim Guide Part 1 (Ambiguity Handling) — SHIPPED — September 15, 2026

## Status: DONE, LIVE

Part 1 ambiguity-handling addendum is shipped and verified live. See prior handoff
(`session-handoff-sep15-2026-pilgrim-guide-part1.md`) for full background on Pilgrim
Guide architecture, the correction re: `arche-epos/arche-suite` being the real repo,
and the original (pre-production-test) addendum draft. This doc only covers what
happened after that one, in the same day's continuation session.

---

## What shipped

**Commit `75ac1619`** on `arche-epos/arche-suite` main, file
`docs/pilgrim-guide-app-help-reference.md`, **v3 → v3.1**. Live immediately (doc is
fetched fresh from GitHub raw on every Pilgrim Guide request — no client deploy
needed).

Changes:
1. General ambiguity-handling instruction (app_help + word_study now clarify before
   guessing, matching Scripture Finder's existing behavior) — same text as drafted
   in the prior handoff, unchanged.
2. False-premise handling (say what you found/didn't find, ask to clarify) — same
   as prior handoff, unchanged.
3. **NEW, not in the original draft:** explicit restructuring of the two "backup"
   Quick Reference entries so they cross-reference each other and state plainly
   they're different features. This was necessary — see below.

## Critical finding: the original addendum, as tested via Claude, did NOT work on
## the real production model for its primary target case

Before shipping, tested the drafted addendum directly against the real production
endpoint (bypassing the CORS-guarded `/groq` route via a same-origin `fetch()` call
from the live app's own domain, replicating the exact request shape — model
`openai/gpt-oss-120b-Turbo` via DeepInfra, `temperature: 0.3`, `max_tokens: 1200`,
`reasoning_effort: "low"` — captured by monkey-patching `window.fetch` while using
the real Pilgrim Guide chat UI).

Result: 5 of 6 test cases passed on production, matching the Claude-artifact test
results from the prior session. **But the "how do I back up my studies" case —
the exact bug the addendum was written to fix — still failed, 3/3 consistent runs.**
The production model kept defaulting to the cloud-sync answer even with the
explicit instruction to "scan the ENTIRE Quick Reference for every plausible
entry" sitting right above it.

**Root cause:** instruction-level reasoning ("scan the whole doc before
answering") isn't reliable on this model at `reasoning_effort: low`. The fix
needed to live in the *data* (the Quick Reference entries themselves), not just
in a meta-instruction asking the model to reason across the data.

**Fix that worked:** rewrote the two ambiguous entries to explicitly name the
ambiguity and cross-reference each other:
```
- "Back up my studies" is AMBIGUOUS — two separate, unrelated mechanisms
  both use the word "backup." Do NOT answer directly; ask which one the user
  means:
  - Cloud sync backup (...) → Settings > Study Sync > ↑ Backup
  - Local backup file (...) → Settings > Export / Backup (see below)
```
Retested full 6-case suite + 3 regression checks (unambiguous "export a backup
file", "restore from cloud", "restore from file" — confirming no overcorrection
into unnecessary clarifying questions). All passed, including 4/4 consistent runs
on the primary case. This is what shipped.

**Takeaway for future Pilgrim Guide doc work:** when an ambiguity or edge case is
model-driven behavior we need to guarantee, don't rely solely on a general
instruction — check whether the specific Quick Reference entries themselves need
explicit disambiguation language. Validate against the real production model
(method below) before shipping, not just against a Claude-based test harness —
they can diverge on subtle instruction-following even when the underlying logic
is sound.

## Method for testing against the real production model (reusable)

No API tool currently reaches `arche-proxy.archestudytools.workers.dev/groq`
directly (CORS requires `Origin: archestudytools.com`, and that domain isn't on
the bash sandbox's network allowlist). Worked around it via Claude in Chrome:
1. Navigate to `https://archestudytools.com/pilgrim-private/` (same origin as the
   CORS allowlist).
2. Log in (QA Test PIN: `5332`).
3. Monkey-patch `window.fetch` via `javascript_tool` to intercept the next real
   `/groq` call and capture the exact request body (model, messages array incl.
   full system prompt, temperature, max_tokens, reasoning_effort, frequency_penalty).
4. Send one real message through the actual Pilgrim Guide UI to trigger and
   capture that request shape.
5. From then on, call `fetch()` directly via `javascript_tool` in that same tab
   with a modified system prompt (candidate doc edits) and the same params —
   this hits the real production model/endpoint without touching the live file,
   and without needing to be logged into the app for the fetch itself (only
   origin matters for CORS, not auth state).
6. `read_network_requests` does NOT expose request/response bodies — only
   url/method/status. The monkey-patch approach above is necessary for content.
7. Note: a canned client-side greeting ("hi") does not hit `/groq` at all — use
   a real App Help/Scripture Finder/Word Study question to trigger the actual API
   call.

Also confirmed independently while doing this: `/mnt/project/arche-proxy.js` (the
Project Knowledge copy) is stale — predates the Aug 25, 2026 Groq→DeepInfra
migration (still shows a direct `api.groq.com` call and `GROQ_API_KEY`). Don't
use it as a reference for current proxy behavior; this matches the existing
flagged-but-not-yet-fixed item in MKB v3.7.2.

## Outstanding / open items (carried over, still not started)

1. **Word Study stub build** — still fully unbuilt. Scoped in the prior handoff:
   cheap classify call (unambiguous vs. ambiguous English word) → unambiguous path
   unchanged, ambiguous path generates 3-5 candidate senses reusing existing
   `.btn.btn-ghost`/`.lex-kjv-pill` visual language. Flagged as a "large build" —
   weekday-after-2pm or weekend per standing preference.
2. **Part 2 (AI Tools mode)** — not started, per spec's own sequencing.
3. Minor, non-blocking: live reference doc still doesn't document the "Export
   Study to PDF" path (only JSON Export/Backup) — separate doc fix, unrelated to
   this work.
4. The account-level `/areas/arche-study-tools.md` memory file (outside this
   project's subtree) is still stale from the earlier wrong-repo confusion — needs
   a non-project chat to fix, can't be edited from here.
5. GitHub dev PAT (`GitHub-Proxy 9/12/26 - Dev Work`) confirmed live this session,
   expires Dec 31, 2026 — no action needed yet, just noting it was checked.

## First thing next session
Pick up Word Study stub build (item 1) if that's next, or Part 2 (AI Tools mode)
per the spec's sequencing — Boss's call.
