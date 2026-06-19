# Arché · Pilgrim — Private (Staging)

This is the Private staging environment for Arché · Pilgrim. Features are built and confirmed here before being ported to the Public repo.

**Private is always ahead of Public.** Do not treat this as the stable version — it is the active development environment.

---

## Relationship to Public

```
Pilgrim Private (this repo)
  └── Features confirmed here first
        └── Ported to Pilgrim Public after sign-off
              └── Public dev branch → smoke test → main → live
```

Private runs with `WORKER_MODE=true` — all API calls route through the Arché proxy. Users never bring their own keys in Private.

Public runs with `WORKER_MODE=false` — users supply their own Groq, ESV, and GitHub keys in Settings.

---

## Stack

Same as Public. See `README.md` in the Public repo for full stack details.

---

## File

```
/
├── Pilgrim-Private.html    ← The entire application
└── README.md               ← This file
```

---

## Versioning

Private versioning runs ahead of Public:
- Private: `v4.9.x`
- Public: `v4.0.x`

When a Private feature is ported to Public, Public receives a feature version bump.

---

## Contributing

Same standards as Public. See `github-team-dev-spec-v1.md` for full contribution rules.

**Private-specific rules:**
- Never deploy Private features to Public without Jesse's explicit sign-off
- Private is the only place to test Groq AI features without a personal API key
- Do not change `WORKER_MODE` — it must stay `true` in Private

---

## Contacts

| Role | Person |
|---|---|
| Project Lead | Jesse Caldwell |
| Proxy / Infrastructure | Jesse Caldwell |

---

*Part of Arché Study Tools — archestudytools.com*
