# Session Handoff — June 18, 2026 (Session D)
## GitHub Migration: gizmo5332/JC-Study-Tool → arche-epos/arche-suite

---

## Migration: COMPLETE and verified live

`archestudytools.com` now serves from `arche-epos/arche-suite` (`main` branch, root).
Old repo `Gizmo5332/JC-Study-Tool` is fully inert — domain removed, no longer reachable
at the custom domain. Confirmed working live by Boss:
- Root loads Pilgrim Public ✅
- Old flat path `/Pilgrim-Private.html` correctly 404s ✅
- New path `/pilgrim-private/` loads with Boss's existing studies (via arche-proxy → Gist) ✅
- Pages source switched dev → main ✅

### New URL structure (folder-based, chosen over flat mirror per "best not easiest")

| App | Old URL | New URL | Version |
|---|---|---|---|
| Pilgrim Public | archestudytools.com/ (index.html) | archestudytools.com/ → redirects to /pilgrim-public/ | v4.1.1 |
| Pilgrim Private | archestudytools.com/Pilgrim-Private.html | archestudytools.com/pilgrim-private/ | v4.9.73 |
| Scribe | archestudytools.com/scribe.html | archestudytools.com/scribe/ | v2.1 |
| Codex | archestudytools.com/codex-private.html | archestudytools.com/codex/ | v3.1.2 (unchanged) |

Root `index.html` is now a thin redirect stub → `pilgrim-public/` (relative path, same
pattern as DPS's `index.html` → `dps.html` redirect).

### Code fixes made during migration (all 3 apps, live)
- `APP_SHARE_URL` constant (Public + Private) updated: `archestudytools.com/public` →
  `https://www.archestudytools.com/pilgrim-public/`
- `shareStudyLinkById()` in both Public and Private: was hardcoded to
  `https://gizmo5332.github.io/JC-Study-Tool/` (broken regardless of migration) — now
  uses `APP_SHARE_URL` constant, single source of truth per the original changelog intent
- Scribe's "Open in Pilgrim →" link: updated to new pilgrim-public URL
- Per Boss: Private's share links intentionally always point to the **Public** URL
  (Private is testers-only, not meant to be shared directly)

### Service worker split
Old shared `sw.js` (covered both Public + Scribe via relative paths in one file) no longer
works now that they're in separate folders. Split into:
- `pilgrim-public/sw.js` — cache `arche-pilgrim-v1`
- `scribe/sw.js` — cache `arche-scribe-v1`
Both use the same install/activate/fetch logic as the original, just scoped independently.

### Codex
No code changes — file moved as-is to `codex/index.html`, v3.1.2.

---

## ⚠️ Action items — do these soon

### 1. Revoke both PATs used this session
- `arche-suite` write token (Contents: R/W) — github.com → Settings → Developer settings → Fine-grained tokens
- `JC-Study-Tool` read token (Contents: Read-only) — same location
**Both were shared in this chat and should be revoked now that the migration is done.**

### 2. Old repo fate
`Gizmo5332/JC-Study-Tool` — domain removed, Pages still technically active at
`gizmo5332.github.io/JC-Study-Tool/` but nothing points to it anymore. Your call: archive,
make private, or delete whenever you're fully confident (not urgent — it's harmless as-is).

### 3. `arche-suite` repo cleanup
- `prayer/`, `worship/`, `teacher/` placeholder folders from original scaffold still present — unchanged, fine to leave
- `pilgrim-private/{app,utils,storage,tts,sync,studyTools,ui}.js` — ES Modules Step 3 placeholders from this morning, still just TODO stubs, untouched by this migration

---

## Next up: Pilgrim Private v4.10.0 deployment (PIN auth)

This was the original goal before we discovered the migration needed to happen first.
**Status: blocked on reconciliation.**

The v4.10.0 file (PIN auth + multi-user namespacing) that Boss has locally was built
**before** this session's share-link fix. It needs that fix merged in before deploying,
or it'll reintroduce the broken `gizmo5332.github.io` share URL.

### Completed already (from earlier this session, still valid)
- ✅ Stage 1: Cloudflare KV namespace `PILGRIM_USERS` created with 3 entries:
  `pin:8144→jesse`, `pin:1224→frank`, `pin:3245→renee`
- ✅ Stage 2: KV binding `PILGRIM_USERS` added to `arche-proxy` worker
- ✅ Stage 3: New `arche-proxy.js` (with `/auth/pin` route) deployed and verified live

### Remaining for next session
- **Reconcile v4.10.0** — merge the `APP_SHARE_URL`/`shareStudyLinkById` fix (this session)
  into the v4.10.0 PIN-auth build, OR rebuild v4.10.0 fresh from the new v4.9.73 baseline
  (recommend the rebuild — cleaner, avoids merge errors)
- **Deploy to new path** — goes to `pilgrim-private/index.html` on `arche-suite` `main`
  (not the old flat-file location from the original deploy guide)
- **Stage 5** — first launch verification (PIN gate, JSON import, Gist push)
- **Stage 6** — notify Frank and Renee with URL + their PINs
- **Stage 7** — covered by action item #1 above

### Next session opener
```
Read all project knowledge files and this handoff before anything else.
Pilgrim Private v4.10.0 (PIN auth) needs to be rebuilt from the current live
v4.9.73 baseline (post-migration) and deployed to pilgrim-private/index.html
on arche-epos/arche-suite main branch. Upload current Pilgrim-Private.html
if you have a copy, otherwise I'll pull v4.9.73 fresh from the repo and add
PIN auth from the v4.10.0 spec.
```

---

## Files modified this session (all already pushed live)
- `pilgrim-public/index.html` (v4.1.1)
- `pilgrim-private/index.html` (v4.9.73)
- `scribe/index.html` (v2.1)
- `codex/index.html` (v3.1.2, unchanged content)
- `pilgrim-public/sw.js`, `scribe/sw.js` (new, split from shared sw.js)
- `index.html` (root redirect stub)
- `CNAME`, `arche-gist-uploader.html`, both READMEs (migrated as-is)

---

*Session D — Generated at ~78% chat space*
