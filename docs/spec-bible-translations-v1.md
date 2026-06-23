# Spec: Bible Translation Expansion
**App:** Pilgrim Private → Pilgrim Public (future)
**Status:** ✅ **Phases 1 & 2 SHIPPED** — confirmed live in `arche-proxy.js` (`/bible` route + `API_BIBLE_KEY` secret present). Phase 3 (Public port) still pending.
**Created:** May 31, 2026

---

## Goal
Expand available in-app Bible translations from 5 to 12 by wiring Darby through the existing bible-api.com route and adding 6 translations via a new api.bible Worker endpoint.

---

## Current State
**Available (fetchable):** YLT, ASV, KJV, WEB, ESV
**Reference only (spectrum display, no fetch):** Darby, NASB, NKJV, RSV, NET, CSB, HCSB, NIV, AMP, NLT, MSG

---

## Translations to Add

| Abbr | Full Name | Route | Philosophy | Status |
|---|---|---|---|---|
| Darby | Darby Translation | bible-api.com | Word-for-Word | Zero new infra |
| NKJV | New King James Version | api.bible | Essentially Literal | New endpoint |
| NET | New English Translation | api.bible | Essentially Literal | New endpoint |
| AMP | Amplified Bible | api.bible | Expanded | New endpoint |
| CSB | Christian Standard Bible | api.bible | Optimal Equivalence | New endpoint |
| NLT | New Living Translation | api.bible | Thought-for-Thought | New endpoint |
| MSG | The Message | api.bible | Paraphrase | New endpoint |

**Cannot get free (locked regardless of platform):** NASB, NIV, RSV, HCSB

---

## Phase 1 — Darby (v4.9.23)

### What
bible-api.com already supports Darby. Zero new infrastructure.

### Change
In `TRANS_DATA`, find the Darby entry and flip:
```js
available: false  →  available: true
```

### Verification
Open any study → change translation to Darby → confirm text loads.

---

## Phase 2 — api.bible (v4.9.24)

### Prerequisites
- Create free account at bible.api.bible
- Generate API key
- Add as Worker secret: `API_BIBLE_KEY`

### api.bible Bible IDs
⚠️ Verify these in the api.bible dashboard at build time — IDs can change.

| Abbr | api.bible Bible ID |
|---|---|
| NKJV | `314f0ea9f2c0413b-01` |
| NET | `f72b840c855f362c-04` |
| AMP | `78a9f6124f344018-01` |
| CSB | `a556c5305ee15c3f-01` |
| NLT | `65eec8e0b60e656b-01` |
| MSG | `65eec8e0b60e656b-02` |

### Worker Change
Add `/bible` endpoint to `arche-proxy`:

```js
// POST /bible
// Body: { ref, bibleId }
if (path === '/bible') {
  const { ref, bibleId } = await req.json();
  const passageId = encodeURIComponent(ref);
  const url = `https://api.scripture.api.bible/v1/passages/${passageId}?bible-id=${bibleId}&content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false`;
  const res = await fetch(url, {
    headers: { 'api-key': env.API_BIBLE_KEY }
  });
  const data = await res.json();
  const text = data?.data?.content?.trim() || '';
  return new Response(JSON.stringify({ text }), { headers: corsHeaders });
}
```

### Client Changes

**1. Bible ID map (add near top of script):**
```js
var API_BIBLE_IDS = {
  nkjv: '314f0ea9f2c0413b-01',
  net:  'f72b840c855f362c-04',
  amp:  '78a9f6124f344018-01',
  csb:  'a556c5305ee15c3f-01',
  nlt:  '65eec8e0b60e656b-01',
  msg:  '65eec8e0b60e656b-02'
};
```

**2. New fetch function:**
```js
async function getApiBible(ref, bibleId) {
  var r = await fetch(WORKER_URL + '/bible', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: ref, bibleId: bibleId })
  });
  if (!r.ok) throw new Error('api.bible fetch failed');
  var d = await r.json();
  return d.text || '';
}
```

**3. Update `getBibleAPI()` routing:**
```js
async function getBibleAPI(ref, trans) {
  if (API_BIBLE_IDS[trans]) return getApiBible(ref, API_BIBLE_IDS[trans]);
  var r = await fetch('https://bible-api.com/' + encodeURIComponent(ref) + '?translation=' + trans);
  if (!r.ok) throw new Error('Bible fetch failed');
  var d = await r.json();
  return d.text || '';
}
```

**4. TRANS_DATA** — flip `available: true` on NKJV, NET, AMP, CSB, NLT, MSG.

---

## Phase 3 — Public Port (future, during port pass)

### Architecture Difference
Public has no Worker. User supplies own api.bible key. api.bible supports CORS so direct browser fetch works.

### Settings UI Addition
Same pattern as Groq key field:
- Label: "api.bible Key"
- Input (password type)
- Status text: "Key saved ✔" / "No key saved"
- Stored in `sett.apiBibleKey`
- `loadSett()` / `saveSett()` unchanged — just add key to default sett object

### Public Client Function
```js
async function getApiBible(ref, bibleId) {
  if (!sett.apiBibleKey) throw new Error('api.bible key required — add in Settings');
  var passageId = encodeURIComponent(ref);
  var url = 'https://api.scripture.api.bible/v1/passages/' + passageId
    + '?bible-id=' + bibleId
    + '&content-type=text&include-notes=false&include-titles=false'
    + '&include-chapter-numbers=false&include-verse-numbers=false';
  var r = await fetch(url, { headers: { 'api-key': sett.apiBibleKey } });
  if (!r.ok) throw new Error('api.bible fetch failed');
  var d = await r.json();
  return d?.data?.content?.trim() || '';
}
```

`getBibleAPI()` routing identical to Private. No Worker URL involved.

---

## Build Order
1. Phase 1 — Darby flag flip → v4.9.23 (5 min)
2. Phase 2 — Worker secret + endpoint + client changes → v4.9.24 (30–45 min)
3. Phase 3 — during Public port pass (scoped separately)

---

## Versioning
- v4.9.23 — Darby available
- v4.9.24 — NKJV, NET, AMP, CSB, NLT, MSG available via api.bible
