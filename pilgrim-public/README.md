# Arché · Pilgrim — Public

Arché · Pilgrim is a browser-based Bible study tool built as a single-file HTML application. It runs entirely in the browser with no install required, powered by Groq AI and the Arché proxy worker on Cloudflare.

---

## Stack

> ⚠️ **Updated June 18, 2026:** Repo migrated from the old `Gizmo5332/JC-Study-Tool` to
> `arche-epos/arche-suite`. Pilgrim Public now lives in the `pilgrim-public/` folder of
> that repo, not the repo root — see corrected File Structure and Branch Structure below.

| Layer | Technology |
|---|---|
| App | Single-file HTML (Vanilla JS) |
| Hosting | GitHub Pages, `arche-epos/arche-suite`, `main` branch, `/pilgrim-public/` folder |
| AI | Groq — `llama-3.3-70b-versatile` via `arche-proxy` |
| Bible API | bolls.life (14 translations), bible-api.com, ESV API, api.bible (6 more translations) |
| Sync | GitHub Gist via `arche-proxy` Cloudflare Worker |
| TTS | Web Speech API (browser-native) |

---

## File Structure

```
arche-epos/arche-suite/
├── index.html                ← Thin redirect stub → /pilgrim-public/
├── pilgrim-public/
│   ├── index.html            ← The entire application (6,500+ lines)
│   ├── sw.js                 ← Service worker (offline support, cache arche-pilgrim-v1)
│   └── README.md             ← This file
├── pilgrim-private/           ← Separate app, separate README
├── scribe/                    ← Separate app, separate README
└── codex/                     ← Separate app
```

Everything for this app lives in `pilgrim-public/index.html`. There is no build step, no node_modules, no bundler. What you see is what ships. Other Arché apps are sibling folders in the same monorepo — see their own READMEs.

---

## Branch Structure

```
main     ← live site (archestudytools.com, served from /pilgrim-public/)
└── dev  ← staging — all PRs merge here first
      ├── yourname/feature-name
      └── yourname/fix-name
```

> Repo is now the `arche-epos/arche-suite` monorepo (post-June-18-2026 migration) —
> same branch model, this app is just one folder among several siblings now.

**Rules:**
- Never commit directly to `main` or `dev`
- All work happens on personal branches (`yourname/what-you-are-doing`)
- PRs target `dev` first — Jesse promotes `dev` → `main` after smoke test
- `main` is branch-protected — requires 1 approval and PR before merge

---

## Deployment

GitHub Pages serves `pilgrim-public/index.html` (mapped to `archestudytools.com/` via the root redirect stub) automatically on every merge to `main`. There is no manual deploy step.

**Critical:** This file is 6,500+ lines. **Never paste it into the GitHub web editor** — it silently truncates at ~5,900 characters and will corrupt the file. Always use the **file picker** (drag and drop or "choose file") when uploading via the GitHub UI.

---

## Local Development

No local server required for basic work. Open `index.html` directly in your browser.

**For AI features to work locally** you will need:
- A Groq API key (free at console.groq.com)
- A GitHub personal access token + Gist ID (for sync)
- An ESV API key (free at api.esv.org) — optional

Enter these in Settings → API Keys when running locally. These keys are stored in localStorage only and never leave your browser.

---

## Contributing

Read `github-team-dev-spec-v1.md` before opening your first PR. It covers commit standards, PR format, code review expectations, and how to coordinate on a single-file codebase.

**Short version:**
1. Branch off `dev` → `yourname/what-you-are-doing`
2. Make your change — one feature or fix per branch
3. Run syntax check: extract the `<script>` block, run `node --check`
4. Bump the patch version in the JS constant and the changelog array
5. Open PR → `dev` with description, test steps, and version number
6. Assign Jesse as reviewer — do not merge your own PR

---

## Versioning

Three-part scheme: `major.feature.patch`

- **Major** — full architecture overhaul
- **Feature** — new user-facing capability
- **Patch** — bug fix, copy change, minor adjustment

Current version is declared in the JS constant at the top of `index.html` and reflected in the `CHANGELOG` array inside the file.

---

## Key Constraints

| Rule | Why |
|---|---|
| No build step — ever | Single-file constraint, GitHub Pages simplicity |
| Syntax check before every PR | Catches unclosed braces before they hit users |
| No direct commits to `main` | Branch protection — protects live users |
| Merge via squash only | Keeps `main` history clean and readable |
| Storage keys prefixed `bsn_*` | Namespace consistency across Arché suite |
| NASB locked for cornerstone verses | Theological authority baseline — not negotiable |

---

## Contacts

| Role | Person |
|---|---|
| Project Lead | Jesse Caldwell |
| Proxy / Infrastructure | Jesse Caldwell |
| Theological standards | Jesse Caldwell |

---

*Part of Arché Study Tools — archestudytools.com*
