# Pilgrim Private — Test Suite

## Tests

| Script | Tool | Purpose |
|---|---|---|
| `bridge-check.js` | Node.js | Static — verifies all inline HTML handlers are exported + bridged to `window.*` |
| `smoke.spec.js` | Playwright | Dynamic — boots the real app in a browser and fails on any console/runtime error. Not a feature-regression suite — see "Scope" below. |
| `batch10.spec.js` | Playwright | Reading-plan regression (v4.60.0 to v4.63.2): Browse/Start, plan bar, Mark read, Stop at the end, Repeat popup, per-plan progress, content-plan data, streak, storage untouched. No PIN needed; 360px viewport. Cannot test audio or look and feel (phone test). |

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
- `smoke.spec.js` needs `PILGRIM_TEST_PIN` (a real tester PIN, never committed), so Claude cannot run it; `batch10.spec.js` needs none.
- The suite blocks all non-local network, so Scripture text, AI and the Worker are never reached.
