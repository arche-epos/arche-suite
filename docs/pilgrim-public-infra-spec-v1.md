# Pilgrim Public — Infrastructure Spec v1.0

**Date:** June 6, 2026
**Author:** Jesse Caldwell
**Advisors:** Ashley & Matt
**Status:** Spec — No code written yet

---

## Vision
Pilgrim Public becomes a fully hosted, zero-setup Bible study application. Users sign in once and their data follows them across every device. No tokens, no configuration, no technical knowledge required.

---

## Environment Structure

| Environment | File | Database | Purpose |
|---|---|---|---|
| **Pilgrim Private** | `pilgrim-private.html` | Personal Gist (current) | Jesse's personal study tool |
| **Pilgrim Dev** | `pilgrim-dev.html` | D1 Dev database | Testing all changes before public release |
| **Pilgrim Public** | `pilgrim-public.html` | D1 Production database | Live users |

### GitHub Branch Structure
| Branch | Purpose |
|---|---|
| `main` | Live production code — Pilgrim Public |
| `dev` | Active development and testing — Pilgrim Dev |
| `private` | Jesse's personal Private version |

**Rule:** Nothing goes to `main` without being confirmed working in `dev` first.

---

## Authentication

### Primary — Google OAuth
- User clicks **"Sign in with Google"**
- One tap — session created automatically
- Returns a unique user ID that keys all their data
- Handled entirely through Cloudflare Worker — no auth library needed client-side
- Cost: $0

### Backup — Magic Link Email
- User enters email address
- Worker sends a one-time sign-in link via **Resend** (free tier: 3,000 emails/month)
- User clicks link — signed in automatically
- Token is one-time use, expires in 15 minutes
- Same experience after sign-in as Google OAuth
- Cost: $0

### Session Management
- On successful auth, Worker issues a signed **JWT token**
- Token stored in localStorage on device
- Token expires after 30 days — silent refresh on activity
- All API calls include token in header — Worker validates before responding

### Rejected Options
- **Email + Password** — password storage liability, breach risk, reset flows required
- **GitHub OAuth** — wrong audience (church/general public users won't have GitHub accounts)
- **Apple Sign In** — $99/year Apple Developer account required

---

## Data Storage — Cloudflare D1

### Why D1
- Already in Jesse's Cloudflare stack
- Jesse owns the infrastructure entirely — no third party holds user data
- 5GB free, 25M reads/day, 50k writes/day
- Cost: $0

### Database Structure

**Users table**
```
id              — unique user ID (from Google or generated)
email           — user email
auth_method     — 'google' or 'magic'
created_at
last_active
```

**Studies table**
```
id              — study ID (preserves existing bsn_ format)
user_id         — foreign key to users table
data            — full study JSON blob (same shape as today)
updated_at
created_at
```

### Why JSON Blob
Stores the entire study object as-is — zero migration pain. Existing backup files import directly. Future schema changes don't require database migrations.

---

## API Architecture — arche-proxy Updates

All existing routes stay. New routes added:

| Route | Purpose |
|---|---|
| `POST /auth/google` | Handle Google OAuth callback |
| `POST /auth/magic/request` | Send magic link email |
| `POST /auth/magic/verify` | Verify magic link token |
| `GET /auth/session` | Validate existing JWT |
| `GET /studies` | Fetch all studies for authenticated user |
| `POST /studies` | Save/update a study |
| `DELETE /studies/:id` | Delete a study |

**Rule:** Every route except auth endpoints requires a valid JWT. No JWT = 401 rejected.

---

## Migration Path — Jesse's Gist → D1

1. Jesse signs into Pilgrim Public with Google
2. Import screen detects existing backup JSON
3. Jesse uploads his `arche-pilgrim-backup.json`
4. Worker imports all 40 studies into D1 under Jesse's user ID
5. Gist sync retired for Public — D1 is the source of truth
6. Private version keeps Gist sync until Jesse decides to unify

---

## Multi-Device Sync

- Every study save calls `POST /studies` immediately
- Every app load calls `GET /studies` on startup
- No manual Push/Pull — fully automatic
- Conflict resolution: **last write wins** (same as current Gist model)

---

## What Users Experience

1. Visit Pilgrim Public URL
2. See sign-in screen — **"Sign in with Google"** or **"Sign in with Email"**
3. One tap/click — they're in
4. Their studies load automatically on any device
5. Every save is automatic — nothing to manage

**They never see:** tokens, keys, Gist, GitHub, configuration of any kind.

---

## Cost Summary

| Service | Free Limit | Cost After |
|---|---|---|
| Cloudflare Workers | 100,000 req/day | $5/month flat |
| Cloudflare D1 | 5GB, 25M reads/day | $0.75/GB after |
| Cloudflare KV | 100k reads/day, 1GB | Minimal |
| Resend (email) | 3,000 emails/month | $20/month after |
| **Total current** | | **$0** |

---

## Open Questions for Ashley & Matt

1. JWT signing — Cloudflare-native secret or dedicated signing library?
2. Google OAuth callback — standard redirect or popup? Popup keeps users inside Pilgrim
3. Magic link email — Resend confirmed as best free option, worth their input
4. D1 indexing strategy — index on `user_id` and `updated_at` at minimum

---

## What This Does NOT Include Yet
- Payment / monetization
- User profile management UI (being specced separately)
- Admin dashboard for Jesse to see users
- Apple Sign In
- Offline mode beyond localStorage cache

---

## Next Steps (In Order)
1. **GitHub workflow education session** — before any build begins
2. **User profile management spec** — what users can control inside Pilgrim
3. **Ashley & Matt review this spec** — gather input on open questions
4. **Set up branch structure** in GitHub repo
5. **Build D1 schema** in Cloudflare dashboard
6. **Build auth routes** in arche-proxy
7. **Build Pilgrim Dev** as first test environment
8. **Test end-to-end** in Dev before touching Public

---

*Pilgrim Public Infrastructure Spec v1.0 — June 6, 2026*
