# Pilgrim Private — Session Handoff — July 20, 2026

**Replaces:** session-handoff-july19-2026.md (archived to `docs/handoffs/` on `main`, PAT redacted, this session)
**Branch:** `dev` — unchanged, still `feb4360`, v4.15.0
**No code shipped this session** — this was a PAT-resolution + provider-research session, not a dev session.

---

## Carried in from July 19 (still current)

- Pilgrim Private ES Modules on `dev` is fully built: 7 modules + `index.html` shell.
- **`main` is still the old monolithic v4.13.2 single-file app.** ES Modules build is NOT live on archestudytools.com. `dev` still 31 ahead / 32 behind `main`.
- `dev → main` merge unblocked but still needs: AI/OCR spot-check re-pass, remove `127.0.0.1:5500` from `arche-proxy` `ALLOWED_ORIGINS`.
- bridge-check.js: ✅ PASS — 115/115 (unchanged this session).

---

## This session's work: PAT resolution + OCR provider research

### 1. PAT mismatch fully resolved (was open blocker from July 19)

Clarified there is **no third dangling token** — only two PATs exist on GitHub, each intentional:
- **`github-proxy-2026-07-19`** — deployed in Cloudflare as `github-proxy`'s `GITHUB_PAT` secret. Powers `/commit`, `/issue`, `/label` (feedback pipeline + repo deploys). Value lives only in Cloudflare; not logged in MKB by design. Has no expiration date set — open risk, not urgent, flagged in MKB.
- **`github-proxy-worker2.0`** (regenerated) — Claude's session/dev token for direct `api.github.com` calls via `bash_tool`. Expires Sep 16, 2026. Confirmed working this session.

**MKB updated to v3.3.0** — P5 credentials table now correctly splits these two by purpose instead of treating one as "the real one."

### 2. Live OCR test surfaced a real Groq rate-limit hit

Boss tested OCR on a new resource (photographed antique document). Got a Groq TPM rate-limit error on `qwen/qwen3.6-27b`. Retried ~1 minute later — worked fine. One-off, not reproduced as recurring.

### 3. Provider research — OCR alternatives evaluated, decision made

Researched and ruled out Moondream 3, OpenAI, and Perplexity as OCR alternatives; confirmed Groq's own vision model (Llama 4 Scout) is preview-only and not a fix for the TPM ceiling (a free-tier-wide trait).

**Decision (Boss):** Keep Groq as primary for both AI Study Tools and OCR. Spec Gemini as a documented backup/pivot plan instead, to execute later only if OCR rate-limiting recurs or quality complaints surface.

**Delivered:** `spec-gemini-ocr-backup-v1.md`.

### 4. Claude API logged as future paid-tier target

Once a paid AI tier becomes necessary, Claude API is Boss's preferred choice over other paid providers (quality/reasoning preference, not cost-driven). Logged as a future consideration that would likely replace Gemini (and possibly Groq) rather than sit alongside them.

---

## Open items at end of this session

1. Upload MKB v3.3.0 and Gemini backup spec to Project Knowledge.
2. AI/OCR spot-check re-pass (§7/§8/§9/§18).
3. Remove `127.0.0.1:5500` from `arche-proxy` `ALLOWED_ORIGINS`.
4. `dev → main` merge.
5. Post-merge live site verification.
6. Playwright smoke test setup (post-merge).

*(Superseded by session-handoff-july20-2026-p2.md — all six items above were resolved or progressed in the following session.)*
