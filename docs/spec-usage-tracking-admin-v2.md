# Spec: Pilgrim Usage Tracking + Admin Dashboard
**v2 | Pilgrim Private + arche-proxy + new standalone admin app | Status: ✅ Built — live as pilgrim-admin v1.6.0 (confirmed Sep 4, 2026).** Shipped as v1.2.0 (Aug 30, 2026); extended through v1.6.0 with mobile table-scroll fix, JSON export system, refresh/export toasts, and an **AI Tool Run Timing** card (Sep 3, 2026 addendum — per-tool last-5-runs + running average, individual tools timed server-side, Snapshot timed client-side as its own full-batch entry; not originally scoped in this spec, tracked as a follow-on). Retained below as the design record, not a pending-work tracker.
**Origin:** v1 was written Aug 16, 2026 when Boss was on Groq's free tier and the driving question was whether usage justified a paid upgrade. Boss is now on the paid tier — this v2 re-scopes the entire feature around its real remaining purpose: **know what's actually being used, so Boss knows what to spend development time improving and perfecting.** Rate-limit/token tracking is retained as a health/diagnostic signal, not a decision input.

---

## Hard Boundary (non-negotiable, per Boss's explicit ask — unchanged from v1)
**No content is ever logged.** Not prompts, not AI responses, not study titles, not scripture references studied, not notes. Only: tester ID, event type (screen name / tool name / route), timestamp, and token counts. If it's not one of those four things, it doesn't get written anywhere.

---

## Two Data Streams

### Stream 1 — Rate-Limit / Capacity Health Signal *(re-scoped in v2)*
**Goal:** Ops visibility and anomaly detection — no longer an upgrade-decision input, since Boss is on paid tier.

Tracked per call to `/groq`, `/ocr`, `/gemini-ocr`:
- **429 rejection events** — now a diagnostic flag (something throttled/broke), not a capacity ceiling signal.
- **Token usage per call** — pulled from the response body's `usage.total_tokens` field. Useful for cost/spend visibility and spotting a runaway tool or prompt regression.
- **Call volume by tester, by day** — useful for spotting anomalies (one tester suddenly far outside their normal pattern).

### Stream 2 — Feature/Screen Usage Tracking *(now the primary purpose of the entire feature)*
**Goal:** Tell Boss where to invest development time — what's getting used, what's ignored.

**Scope for v2 — top-level tabs AND one level of sub-tab, per Boss's explicit call to go one level deeper than v1:**
- `library` → sub-tabs: `library.studies`, `library.words`
- `read` (top-level only, no sub-tabs)
- `study` → sub-tabs: `study.notes`, `study.tools`
- `progress` (top-level only)
- `settings` (top-level only)

Screen names use dot-path strings (e.g. `study.notes`) — a naming convention, not a schema change.

**AI-tool breakdown** (unchanged from v1, comes free from Stream 1's tool-tagging): Word Study, Language & Structure, Historical, Cultural, Cross-References, Snapshot, OCR (7 tools).

**Explicitly deferred, not v2:** specific in-screen actions (word lookup used, share/export clicked, future Verse Memory reviews). Cheap to add individually later once screen-level data shows where it's worth digging deeper.

---

## Data Model — Cloudflare KV (new namespace: `PILGRIM_ANALYTICS`)

Reuses the existing KV-counter pattern already used by `PILGRIM_USERS`/`MENTOR_USERS` — no new infrastructure class, just a new namespace.

```
usage:{YYYY-MM-DD}:{userId}:screen:{screenPath}   → integer count (incremented) — e.g. screen:study.notes
usage:{YYYY-MM-DD}:{userId}:tool:{toolName}       → integer count (incremented)
usage:{YYYY-MM-DD}:{userId}:tokens                → integer sum (incremented by each call's total_tokens)
lastseen:{userId}                                  → timestamp, updated on any beacon (new in v2)
ratelimit:{YYYY-MM-DD}:count                       → integer count of 429s that day (all routes, all testers)
ratelimit:{YYYY-MM-DD}:events                      → JSON array, capped at last 50 — {tester, route, time} per 429
```

Daily buckets are the finest useful grain — the admin dashboard sums across days for weekly/monthly views itself; no separate weekly keys needed.

**Retention: indefinite, by design (changed in v2).** This is now a longitudinal trend tool, not a point-in-time capacity check — retention needs to be permanent for "did usage of X change after I improved it" comparisons to mean anything. No expiry set, no revisit-later hedge.

---

## New / Modified `arche-proxy` Routes

| Route | Change |
|---|---|
| `POST /track` | **New.** Fire-and-forget screen-visit beacon from Pilgrim client. Body: `{screen: 'study.notes'}`. Header: `X-Tester-Id`. Increments `usage:{date}:{userId}:screen:{screenPath}` and updates `lastseen:{userId}`. |
| `POST /groq` | **Modified.** Add `X-Tool-Name` header read (new, client-side addition — see Build-Touches). On response: parse to read `usage.total_tokens`, increment token + tool counters, check `upstream.status===429` and log to `ratelimit:*` if so — then forward the original response to the client unchanged. Use `ctx.waitUntil()` so logging never delays the response the tester sees. |
| `POST /ocr`, `POST /gemini-ocr` | **Modified.** Same 429-detection + tool-tagged counter pattern as `/groq` (tool name is implicitly `ocr` / `gemini_ocr` — no client header needed for these two). |
| `POST /admin/auth` | **New.** Validates a dedicated admin passphrase (new secret, NOT a tester PIN — Boss is the only user of this route). |
| `GET /admin/usage` | **New.** Returns aggregated screen + tool counts, ranked by volume, per tester for a given date range. Includes `lastseen` per tester. Admin-auth gated. |
| `GET /admin/ratelimits` | **New.** Returns 429 count + recent event list for a given date range. Admin-auth gated. |

**⚠️ Deployment note:** `arche-proxy.js` is manually deployed by Boss via the Cloudflare dashboard (standing rule — Claude cannot deploy Workers). This entire feature requires a manual deploy step regardless of who writes the code. New KV namespace (`PILGRIM_ANALYTICS`) also needs to be created and bound to the Worker — Claude can create the namespace itself via the Cloudflare Developer Platform MCP, but binding it to the Worker happens in the same manual dashboard deploy.

---

## New Standalone App — Admin Dashboard

**Why its own app, not a view inside Pilgrim:** Pilgrim's entire JS bundle ships to every tester's browser. Admin data behind a client-side check in that same bundle is a weak boundary — a tester could find it in dev tools. A separate app means admin data never reaches a tester's browser at all. This also matches the existing DPS Supervisors pattern (separate companion portal, elevated privilege, same repo family) — not a new architecture, an extension of one Boss already uses.

- **Location:** `arche-epos/arche-suite/pilgrim-admin/` — sibling folder to `pilgrim-private`/`pilgrim-public`, single HTML file, matches suite convention
- **Auth:** passphrase gate via new `/admin/auth` route (separate secret from tester PINs)
- **Views (v2):**
  - **Rate-limit/health panel** — today's 429 count, recent event list, token-usage trend
  - **Usage panel** — per-tester table: screen visits (including sub-tabs) + AI-tool call counts + last-active (`lastseen`) column. **Default-sorted busiest-first** (screens and tools each ranked by total usage) so the "where to invest" read is immediate. Includes a **sort/filter control** letting Boss re-sort by any column (tester, date, screen, tool, last active) for manual comparison.
- **Stack:** vanilla JS, single file, no framework — matches the rest of the suite, no reason to introduce React CDN for something this simple
- **Not in v2:** charts/graphs (ranked tables are enough to start; visual charting is a cheap fast-follow once real data exists to look at)

---

## Explicitly Out of Scope for v2
- Per-tester rate limits or quotas — Groq's old free-tier limit was account-wide anyway, and Boss is on paid tier now, so there's even less reason to build a per-user cap system
- Any content logging (prompts, responses, study data) — hard boundary, see top of doc
- In-screen action-level tracking (word lookup, share, etc.) — deferred, add individually later if needed
- Charts/visualizations — ranked tables first

---

## Build-Touches (sizing note, not exhaustive)
- `arche-proxy.js` — new `/track`, `/admin/auth`, `/admin/usage`, `/admin/ratelimits` routes; modify `/groq`, `/ocr`, `/gemini-ocr` for 429 + token logging (Boss deploys manually per standing SOP)
- New `PILGRIM_ANALYTICS` KV namespace — create + bind (Cloudflare dashboard, part of the same manual deploy)
- `pilgrim-private/ui.js` — add `/track` beacon call inside `navTo()` (top-level tab switches) **and** inside `switchStudyTab()` / `switchLibTab()` (sub-tab switches) — beacon fires with the dot-path screen name (e.g. `study.notes`, `library.words`)
- `pilgrim-private/studyTools.js` — add `X-Tool-Name` header to each of the 7 AI-tool call sites — **line numbers from the v1 spec are stale** (file has changed significantly since Aug 16, including the Turbo/parallel-audience-scaling and Snapshot changes); needs a fresh grep-check at build time, not a reuse of old line references
- New file: `pilgrim-admin/index.html` — the dashboard itself, built fresh, with ranked usage table + sort/filter control and rate-limit/health panel

---

## Changelog from v1 → v2
- Overall purpose reframed: usage/investment tracking is now primary; rate-limit tracking is now a secondary health signal, not an upgrade trigger (Boss moved to paid tier)
- Screen tracking scope deepened: top-level tabs **and** one level of sub-tab (Library→Studies/Words, Study→Notes/Study Tools)
- Screen list updated to reflect the Bible Reader nav reorg (Read tab added, Notes/Study Tools merged into Study with sub-tabs)
- Added `lastseen:{userId}` KV key — tracks last-active timestamp per tester, independent of what they did
- Retention changed from "no expiry, revisit if it becomes a concern" to "indefinite by design" — now a longitudinal trend tool, needs permanent history
- Admin dashboard usage panel now default-sorted busiest-first (ranked), with a sort/filter control for manual re-sorting
- Build-touches note added: `studyTools.js` line numbers from v1 are stale, need fresh grep at build time

---

*Spec v2 — Aug 27, 2026. Reviewed section-by-section with Boss and re-scoped for paid-tier reality. Not yet built. Next step: dedicated build session — new Worker routes, new KV namespace, new standalone app, plus header/beacon additions across several Pilgrim call sites.*
