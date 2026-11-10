# Pilgrim Private — Test Suite

## Tests

| Script | Tool | Purpose |
|---|---|---|
| `bridge-check.js` | Node.js | Static — verifies all inline HTML handlers are exported + bridged to `window.*` |
| `smoke.spec.js` | Playwright | Dynamic — boots the real app in a browser and fails on any console/runtime error. Not a feature-regression suite — see "Scope" below. |
| `boot.spec.js` | Playwright | No-login boot check (same job as `smoke.spec.js`, no PIN): app boots, every bottom-nav tab opens, FAB menu opens, no runtime errors, no sideways scroll at 390px. Claude runs it before every push. |
| `layout.spec.js` | Playwright | Phone-width layout sweep at 360px and 390px: no sideways scroll, nothing under the Guide button, Read-tab bottom buttons side by side, nav tabs at least 44px tall, and nothing under the Guide button on Study > Notes (the Listen overlap found Nov 10 was fixed in v4.63.3). |
| `release-check.js` | Node.js | Release bookkeeping gate: every `?v=` cache-buster equals CHANGELOG[0].version, and only the newest entry is labeled "untested". Run before every push. |
| `secret-scan.js` | Node.js | Public-repo secret gate: scans the lines about to be pushed (or `--all` tracked files) for GitHub tokens, the proxy secret and private keys. Never prints the secret. Run before every push. |
| `gate.js` | Node.js | One-command pre-push gate: `node --check` on every module, bridge-check, all node unit tests, release-check, secret-scan, then the headless Playwright specs (boot, layout, batch10, datasafety, regress). Stops at the first failure. `npm run gate`, or `node tests/gate.js --no-browser` for static only. |
| `batch10.spec.js` | Playwright | Reading-plan regression (v4.60.0 to v4.63.2): Browse/Start, plan bar, Mark read, Stop at the end, Repeat popup, per-plan progress, content-plan data, streak, storage untouched. No PIN needed; 360px viewport. Cannot test audio or look and feel (phone test). |
| `datasafety.spec.js` | Playwright | Data safety, qa-local only, localhost only (refuses to run elsewhere): backup file round trip (export, Clear All, restore), Clear All wipes only this user and Undo restores the safety copy, tombstones (deleted tag and Memory verse stay deleted after restoring an older backup), Study Tour sample studies never reach a backup or an import, and the red "Not saved" banner when device storage is full. Study Sync and study tombstones need the live Worker, so they are not covered. |
| `regress.spec.js` | Playwright | Bug-class regressions: study titles and tag names with an apostrophe, quotes, backslash and emoji keep every Library card button (open, Share, Duplicate, Delete) and the Progress row working; Memory grading treats straight and curly apostrophes and quotes alike (Test Me still levels up); Practice Repeat starts off when reopened. One `test.fixme`: a study title containing HTML runs as markup (found Nov 10). |

---

## bridge-check.js — When to Run

**Every time you:**
1. Add a new function call to an HTML `onclick`, `onchange`, `oninput`, or any other inline handler in `index.html`
2. Add a new exported function to any module (to confirm it's in the export block)
3. Restructure or rename an export block in any module
4. **Before every `dev → main` merge** — non-negotiable gate

**Command:**
```bash
# From pilgrim-private/
node tests/bridge-check.js

# Full output including JS-only bridges
node tests/bridge-check.js --verbose
```

**Pass = clean merge.** Fail = fix the export block first.

Exit code `0` on pass, `1` on fail — CI-friendly if a pipeline is ever added.

---

## smoke.spec.js — Scope

Boots the app in a real browser via Live Server, logs in through the real PIN
gate, and asserts on core shell/nav/FAB visibility — while capturing every
`console.error` and uncaught page error along the way. Exists specifically to
catch the class of bug that shipped in v4.34.15: a runtime `ReferenceError`
from a bare identifier left behind after its import was removed. That build
passed `node --check` clean (not a syntax error) and passed `bridge-check.js`
clean (the broken reference wasn't an HTML-called export gap) — only loading
the page in a browser actually surfaced it.

**Does not** assert on Scripture Finder results, AI tool output, sync/backup
behavior, or any other feature-level regression. A fuller Playwright suite
covering that is intentionally deferred until the codebase settles down —
rewriting deep feature tests against a still-shifting UI every week isn't
worth it. This smoke layer is cheap to maintain in the meantime and grows
into that fuller suite later rather than starting from scratch.

**When to run:**
1. Before every `dev → main` merge — same gate as `bridge-check.js`
2. After any change to `ui.js`, `app.js`, or any file touching the module
   import lines (the exact surface v4.34.15 broke)
3. Before any tester-facing release

**One-time setup (from `pilgrim-private/`):**
```bash
npm install
npx playwright install chromium
```

**Command:**
```bash
# Requires Live Server (or any static server) running at 127.0.0.1:5500,
# and a real tester PIN in PILGRIM_TEST_PIN — never hardcode one in the repo.
PILGRIM_TEST_PIN=1234 npx playwright test
PILGRIM_TEST_PIN=1234 npx playwright test --headed   # watch it run
```

---

## Quick Reference — Pre-Merge Gate

```
1. node tests/bridge-check.js                          ← must pass
2. PILGRIM_TEST_PIN=xxxx npx playwright test            ← must pass
3. git merge dev → main
4. Deploy via github-proxy
```


---

## Running the Playwright suites in Claude's sandbox (added Nov 10, 2026)

Claude runs these itself before every push (see `ways-of-working.md` > "Playwright regression suite"). Setup in the sandbox:

```bash
# one time per chat (container resets): the test runner
mkdir -p /tmp/pwt && cd /tmp/pwt && npm init -y && npm i @playwright/test
# from pilgrim-private/: serve the folder, run the suite(s)
python3 -m http.server 8765 &
NODE_PATH=/tmp/pwt/node_modules PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome \
PILGRIM_BASE_URL=http://127.0.0.1:8765 /tmp/pwt/node_modules/.bin/playwright test tests/batch10.spec.js
```

- `PILGRIM_BASE_URL` and `PW_CHROMIUM` are optional overrides in `playwright.config.js`; leave both unset on Boss's machine (Live Server at 5500, Playwright's own Chromium).
- `smoke.spec.js` needs `PILGRIM_TEST_PIN` (a real tester PIN, never committed) and the live Worker, which Claude's sandbox cannot reach, so Claude cannot run it; `boot.spec.js` and `batch10.spec.js` need neither.
- The suite blocks all non-local network, so Scripture text, AI and the Worker are never reached.
