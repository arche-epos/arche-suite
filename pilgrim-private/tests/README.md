# Pilgrim Private — Test Suite

## Tests

| Script | Tool | Purpose |
|---|---|---|
| `bridge-check.js` | Node.js | Static — verifies all inline HTML handlers are exported + bridged to `window.*` |
| `smoke.spec.js` | Playwright | Dynamic — full regression against Live Server *(coming after dev → main merge)* |

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

## smoke.spec.js — When to Run *(coming soon)*

**Every time you:**
1. Port a feature from Private → Public
2. Make changes to `ui.js`, `studyTools.js`, or `storage.js`
3. Before any tester-facing release

**Command:**
```bash
# Requires Live Server running at 127.0.0.1:5500
npx playwright test
npx playwright test --headed   # watch it run
```

---

## Quick Reference — Pre-Merge Gate

```
1. node tests/bridge-check.js     ← must pass
2. npx playwright test             ← must pass (once built)
3. git merge dev → main
4. Deploy via github-proxy
```
