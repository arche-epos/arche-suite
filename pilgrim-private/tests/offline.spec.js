// tests/offline.spec.js — Pilgrim Private offline downloads (Phase 1 foundation, v4.64.0)
//
// Pins the offline store and the lookup hook so Phase 3 (real Bible text packs) can rely on them:
//   1. A downloaded pack answers getBibleAPI with NO network: whole chapter, one verse, a range, a comma list.
//   2. No pack (or a chapter the pack lacks) falls through to the network, which is blocked here, so it fails loudly
//      instead of returning made-up text.
//   3. A pack survives a reload, shows in Settings > Offline Downloads, and the two-tap Delete removes only that pack.
//   4. Clear All Data leaves downloads alone, and the backup file never contains them.
//   5. A failed install (a payload IndexedDB cannot store) leaves nothing half-installed.
//   6. (v4.65.0) The Word study data pack downloads from a faked CDN, then fetchGroundData answers from the phone with
//      the CDN blocked; one failing file installs nothing and shows an error; offline shows a clear message.
//   7. (v4.66.0) The five Bible text packs (the REAL data/bibles/*.json files, served through a faked CDN) download,
//      then read with the CDN blocked: omitted verses say so, WEB keeps its published Romans numbering, the YLT
//      has the Old Testament, and a file that is not a whole Bible installs nothing.
//   8. (v4.67.0) Cross-references and the Old / New Testament interlinear (the REAL data/crossrefs and data/macula files,
//      served through a faked CDN) download file by file, then answer fetchGroundData with the CDN blocked; each pack
//      answers only its own books; a file that fails mid-download installs nothing.
//   9. (v4.67.1) The app OPENED with no connection (navigator.onLine false at boot, as when Phase 5 lets it open offline):
//      Read tab, study scripture, Memory auto-fill and Bible Tools (Cross-References, Interlinear) still use downloaded packs;
//      and the app notices when the connection comes back.
//  10. (v4.68.0) Several packs can be tapped at once: two download at a time and the rest show Queued; "Download all" queues
//      every pack not yet saved; a refused file (403) is retried and a file that keeps failing is named in the error.
//
// Only behavior that is verified good is asserted. The fake pack uses made-up text on purpose, so a test can never be
// satisfied by real network text. Seeds qa-local in a throwaway context, blocks all non-local network, localhost only.
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js):  npx playwright test tests/offline.spec.js

'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.use({ viewport: { width: 390, height: 780 } });

let app = null;

test.beforeAll(({ baseURL }) => {
  const host = new URL(baseURL).hostname;
  if (!/^(127\.0\.0\.1|localhost)$/.test(host)) throw new Error('offline.spec.js only runs against localhost (got ' + host + ').');
});
test.afterEach(async () => { if (app) { await app.ctx.close(); app = null; } });

// ───────────────────────────── helpers ─────────────────────────────

/** Fresh throwaway context as qa-local, no external network, keeping every backup Blob for inspection. */
async function openApp(browser, baseURL) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('bsn_active_user')) localStorage.setItem('bsn_active_user', 'qa-local');
    localStorage.setItem('bsn_tour_settings_seen_qa-local', '1'); // keep the first-visit Settings tour from covering the buttons
    try { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); } catch (e) { /* ignore */ }
    window.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { window.__blobs.push(b); return orig(b); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const origin = new URL(baseURL).origin;
  await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
  await page.goto('/index.html');
  await ready(page);
  return { ctx, page, errors };
}

async function ready(page) {
  await page.waitForFunction(() => typeof window.offlineInstallPack === 'function' && document.getElementById('scr-library') && document.getElementById('scr-library').classList.contains('on'));
  await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay', 'tour-offer-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
}

/** Installs a small FAKE "kjv" pack (John 3 and Psalm 23, invented words) through the app's own installer. */
async function installFake(page, id) {
  return page.evaluate(async (packId) => {
    const john3 = [];
    for (let v = 1; v <= 20; v++) john3.push({ verse: v, text: 'zz-john-' + v });
    const ps23 = [{ verse: 1, text: 'zz-psalm-1' }, { verse: 2, text: 'zz-psalm-2' }];
    return window.offlineInstallPack({ id: packId || 'bible-kjv', name: 'Fake KJV', version: '1', license: 'Test only' },
      [['43:3', john3], ['19:23', ps23]]);
  }, id);
}

const fetchText = (page, ref, trans) => page.evaluate(([r, t]) => window.getBibleAPI(r, t).then(x => ({ ok: true, x }), e => ({ ok: false, x: String(e && e.message || e) })), [ref, trans]);

// ───────────────────────────── tests ─────────────────────────────

test.describe('Pilgrim Private: offline downloads (qa-local, localhost only)', () => {
  test('a downloaded pack answers with no network: chapter, verse, range and comma list', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installFake(page);
    expect(await fetchText(page, 'John 3:16', 'kjv')).toEqual({ ok: true, x: '[16] zz-john-16' });
    expect(await fetchText(page, 'John 3:16-18', 'kjv')).toEqual({ ok: true, x: '[16] zz-john-16 [17] zz-john-17 [18] zz-john-18' });
    expect(await fetchText(page, 'John 3:18,16', 'kjv')).toEqual({ ok: true, x: '[18] zz-john-18 [16] zz-john-16' });
    const whole = await fetchText(page, 'John 3', 'kjv');
    expect(whole.ok).toBe(true);
    expect(whole.x.startsWith('[1] zz-john-1 [2] zz-john-2')).toBe(true);
    expect(await fetchText(page, 'Psalm 23:2', 'kjv')).toEqual({ ok: true, x: '[2] zz-psalm-2' });
    expect(app.errors).toEqual([]);
  });

  test('no pack, or a chapter the pack lacks, falls through to the network and fails (never invents text)', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    const none = await fetchText(page, 'John 3:16', 'kjv');
    expect(none.ok).toBe(false);
    await installFake(page);
    const lacking = await fetchText(page, 'Romans 8:28', 'kjv');
    expect(lacking.ok, 'Romans 8 is not in the fake pack, so this must not return pack text').toBe(false);
    const otherVersion = await fetchText(page, 'John 3:16', 'web');
    expect(otherVersion.ok, 'a different version must not read the kjv pack').toBe(false);
    const missingVerse = await fetchText(page, 'John 3:99', 'kjv');
    expect(missingVerse.ok, 'a verse the chapter lacks must fall through, not return an empty string').toBe(false);
  });

  test('a pack survives a reload, shows in Settings with its size, and two-tap Delete removes only that pack', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installFake(page, 'bible-kjv');
    await installFake(page, 'bible-asv');
    await page.reload();
    await ready(page);
    const packs = await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id)));
    expect(packs).toEqual(['bible-asv', 'bible-kjv']);
    expect((await fetchText(page, 'John 3:16', 'kjv')).x).toBe('[16] zz-john-16');

    await page.evaluate(() => window.navTo('settings'));
    // v4.66.0: the five Bible catalog rows are always listed (Download or Delete); a catalog id shows its catalog name
    await expect(page.locator('#offline-list [data-pack^="bible-"]')).toHaveCount(5);
    await expect(page.locator('#offline-list [data-pack="bible-asv"]')).toContainText('Delete');
    await expect(page.locator('#offline-list [data-pack="bible-web"]')).toContainText('Download');
    await expect(page.locator('#offline-list')).toContainText('King James Version');
    await expect(page.locator('#offline-list')).toContainText('MB');

    const del = page.locator('#offline-list [data-pack="bible-kjv"]');
    await del.click();                                    // first tap arms it
    await expect(del).toContainText('Tap again');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(2);
    await del.click();                                    // second tap deletes
    await expect(page.locator('#offline-list [data-pack="bible-kjv"]')).toContainText('Download');
    await expect(page.locator('#offline-list [data-pack="bible-asv"]')).toContainText('Delete');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id)))).toEqual(['bible-asv']);
    expect((await fetchText(page, 'John 3:16', 'kjv')).ok).toBe(false);
    expect((await fetchText(page, 'John 3:16', 'asv')).x).toBe('[16] zz-john-16');
  });

  test('Clear All Data leaves downloads alone, and the backup file never contains them', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installFake(page);
    const n = await page.evaluate(() => window.__blobs.length);
    await page.evaluate(() => window.exportData());
    await page.waitForFunction(k => window.__blobs.length > k, n);
    const json = await page.evaluate(k => window.__blobs[k].text(), n);
    expect(json).not.toContain('zz-john');
    expect(json).not.toContain('bible-kjv');

    await page.evaluate(() => window.clearAll());
    await expect(page.locator('#clearall-overlay')).toHaveClass(/\bon\b/);
    await Promise.all([page.waitForEvent('load'), page.click('#clearall-overlay button.btn-danger')]);
    await ready(page);
    expect((await fetchText(page, 'John 3:16', 'kjv')).x).toBe('[16] zz-john-16');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(1);
  });

  test('a failed install leaves nothing half-installed and keeps an older copy out of the way', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    // A function cannot be stored by IndexedDB, so the second entry fails after the first has been written.
    const err = await page.evaluate(() => window.offlineInstallPack({ id: 'bible-bad', name: 'Bad', version: '1' },
      [['43:3', [{ verse: 1, text: 'ok' }]], ['19:23', { f: function () {} }]]).then(() => 'no error', e => String(e && e.name || e)));
    expect(err).not.toBe('no error');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(0);
    expect(await page.evaluate(() => window.offlineGet('bible-bad', '43:3'))).toBeNull();
    const idErr = await page.evaluate(() => window.offlineInstallPack({ id: 'a|b', name: 'x' }, []).then(() => 'no error', e => String(e && e.message || e)));
    expect(idErr).toContain('Invalid pack id');
  });

  const CDN = /\/data\/strongs\//;
  const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

  test('Word study data downloads, then study data is answered from the phone with the CDN blocked', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.route(CDN, r => r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ fake: r.request().url().split('/').pop().split('?')[0] }) }));
    await page.evaluate(() => window.navTo('settings'));
    const btn = page.locator('#offline-list [data-pack="words-core"]');
    await expect(btn).toContainText('Download');
    await btn.click();
    await expect(page.locator('#offline-list [data-pack="words-core"]')).toContainText('Delete');
    const packs = await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id + ':' + x.count)));
    expect(packs).toEqual(['words-core:4']);

    await page.unroute(CDN);                 // the CDN is blocked again (all non-local network is aborted)
    await page.reload();                     // fresh page: the in-memory cache is empty, so only the pack can answer
    await ready(page);
    const gloss = await page.evaluate(() => window.fetchGroundData('strongs/gloss-index.json').then(x => ({ ok: true, x }), e => ({ ok: false, x: String(e.message) })));
    expect(gloss).toEqual({ ok: true, x: { fake: 'gloss-index.json' } });
    const heb = await page.evaluate(() => window.fetchGroundData('strongs/hebrew.json'));
    expect(heb).toEqual({ fake: 'hebrew.json' });
    const notInPack = await page.evaluate(() => window.fetchGroundData('strongs/occurrences.json').then(() => 'loaded', () => 'failed'));
    expect(notInPack, 'a file that is not in the pack must fall through to the (blocked) network').toBe('failed');
    expect(app.errors).toEqual([]);

    // Deleting the pack removes the offline answer.
    await page.evaluate(() => window.offlineRemovePack('words-core'));
    await page.reload();
    await ready(page);
    const after = await page.evaluate(() => window.fetchGroundData('strongs/gloss-index.json').then(() => 'loaded', () => 'failed'));
    expect(after).toBe('failed');
  });

  test('a download where one file fails installs nothing and shows an error', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.route(CDN, r => r.request().url().includes('greek.json')
      ? r.fulfill({ status: 404, headers: cors, body: '{}' })
      : r.fulfill({ status: 200, headers: cors, body: '{"ok":1}' }));
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="words-core"]').click();
    await expect(page.locator('#offline-list')).toContainText('could not be downloaded');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(0);
    expect(await page.evaluate(() => window.offlineGet('words-core', 'strongs/hebrew.json'))).toBeNull();
    await expect(page.locator('#offline-list [data-pack="words-core"]')).toContainText('Download');   // can try again
  });

  test('with no internet the Download button explains instead of failing', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.evaluate(() => window.navTo('settings'));
    await app.ctx.setOffline(true);
    await page.locator('#offline-list [data-pack="words-core"]').click();
    await expect(page.locator('#offline-list')).toContainText('You are offline');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(0);
  });

  // ───────── v4.66.0: Bible text packs, using the real built files ─────────
  const BIBLE_CDN = /\/data\/bibles\//;
  const BIBLES = path.join(__dirname, '..', '..', 'data', 'bibles');
  /** Serves data/bibles/<name>.json from disk for any BIBLE_CDN request ending in that name. */
  async function serveBibles(page) {
    await page.route(BIBLE_CDN, r => {
      const m = r.request().url().match(/\/bibles\/([a-z]+)\.json/);
      if (!m) return r.fulfill({ status: 404, headers: cors, body: '{}' });
      r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: fs.readFileSync(path.join(BIBLES, m[1] + '.json')) });
    });
  }
  /** Downloads one Bible pack from Settings, then blocks the BIBLE_CDN and reloads so only the stored pack can answer. */
  async function downloadBible(page, trans) {
    await serveBibles(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="bible-' + trans + '"]').click();
    await expect(page.locator('#offline-list [data-pack="bible-' + trans + '"]')).toContainText('Delete', { timeout: 20000 });
    await page.unroute(BIBLE_CDN);
    await page.reload();
    await ready(page);
  }

  test('KJV downloads whole (1,189 chapters) and reads with no network', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadBible(page, 'kjv');
    const packs = await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id + ':' + x.count)));
    expect(packs).toEqual(['bible-kjv:1189']);
    const john = await fetchText(page, 'John 3:16', 'kjv');
    expect(john.ok).toBe(true);
    expect(john.x.startsWith('[16] For God so loved the world, that he gave his only begotten Son')).toBe(true);
    const gen = await fetchText(page, 'Genesis 1:1', 'kjv');
    expect(gen).toEqual({ ok: true, x: '[1] In the beginning God created the heaven and the earth.' });
    const rev = await fetchText(page, 'Revelation 22:21', 'kjv');
    expect(rev.ok && rev.x.startsWith('[21] The grace of our Lord Jesus Christ')).toBe(true);
    const ps = await fetchText(page, 'Psalm 23', 'kjv');
    expect(ps.ok && (ps.x.match(/\[\d+\]/g) || []).length).toBe(6);
    expect((await fetchText(page, 'John 3:16', 'asv')).ok, 'a version that is not downloaded must not answer from the KJV pack').toBe(false);
    expect(app.errors).toEqual([]);
  });

  test('ASV: a verse the version omits says so instead of showing a blank', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadBible(page, 'asv');
    expect(await fetchText(page, 'Matthew 17:21', 'asv')).toEqual({ ok: true, x: '[21] (omitted in this version)' });
    const around = await fetchText(page, 'Matthew 17:20-22', 'asv');
    expect(around.ok && around.x.includes('[21] (omitted in this version) [22] ')).toBe(true);
    const ok = await fetchText(page, 'Matthew 17:20', 'asv');
    expect(ok.ok && ok.x.startsWith('[20] ') && !ok.x.includes('omitted')).toBe(true);
  });

  test('WEB keeps its published Romans numbering (doxology at 14:24-26, nothing at 16:25-27)', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadBible(page, 'web');
    const dox = await fetchText(page, 'Romans 14:24-26', 'web');
    expect(dox.ok && dox.x.startsWith('[24] Now to him who is able to establish you') && dox.x.includes('[26] ')).toBe(true);
    expect(await fetchText(page, 'Romans 16:25', 'web')).toEqual({ ok: true, x: '[25] (omitted in this version)' });
    expect((await fetchText(page, 'Romans 16:26', 'web')).ok, 'WEB has no Romans 16:26, so it falls through to the blocked network').toBe(false);
    const ps = await fetchText(page, 'Psalm 23:1', 'web');
    expect(ps.ok && ps.x.startsWith('[1] Yahweh is my shepherd')).toBe(true);  // WEB's own text: no title added
  });

  test('YLT and Darby download whole; the YLT has the Old Testament', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadBible(page, 'ylt');
    const gen = await fetchText(page, 'Genesis 1:1', 'ylt');
    expect(gen.ok && gen.x.startsWith("[1] In the beginning of God's preparing the heavens and the earth")).toBe(true);
    await serveBibles(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="bible-darby"]').click();
    await expect(page.locator('#offline-list [data-pack="bible-darby"]')).toContainText('Delete', { timeout: 20000 });
    await page.unroute(BIBLE_CDN);
    await page.reload();
    await ready(page);
    const d = await fetchText(page, 'Genesis 1:1', 'darby');
    expect(d).toEqual({ ok: true, x: '[1] In the beginning God created the heavens and the earth.' });
    expect(await page.evaluate(() => window.offlineHasPack('bible-ylt'))).toBe(true);
    expect(await page.evaluate(() => window.offlineHasPack('bible-web'))).toBe(false);
  });

  test('a Bible file that is not a whole Bible installs nothing and shows an error', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.route(BIBLE_CDN, r => r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ '1:1': [{ verse: 1, text: 'zz' }] }) }));
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="bible-kjv"]').click();
    await expect(page.locator('#offline-list')).toContainText('looks incomplete');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(0);
    await expect(page.locator('#offline-list [data-pack="bible-kjv"]')).toContainText('Download');
  });

  // ───────── v4.67.0: cross-references and interlinear, using the real data files ─────────
  const STUDY_CDN = /\/data\/(crossrefs|macula)\//;
  const DATA = path.join(__dirname, '..', '..', 'data');
  const onDisk = rel => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
  /** Serves data/<dir>/<NN>.json from disk. `failAt` (optional) is a path fragment that answers 404 instead. */
  async function serveStudy(page, failAt) {
    await page.route(STUDY_CDN, r => {
      const m = r.request().url().match(/\/data\/((?:crossrefs|macula)\/\d\d\.json)/);
      if (!m || (failAt && m[1].includes(failAt))) return r.fulfill({ status: 404, headers: cors, body: '{}' });
      r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: fs.readFileSync(path.join(DATA, m[1])) });
    });
  }
  /** Downloads one study pack from Settings, then blocks the CDN and reloads so only the stored pack can answer. */
  async function downloadStudy(page, id) {
    await serveStudy(page);
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="' + id + '"]').click();
    await expect(page.locator('#offline-list [data-pack="' + id + '"]')).toContainText('Delete', { timeout: 120000 });
    await page.unroute(STUDY_CDN);
    await page.reload();
    await ready(page);
  }
  const ground = (page, p) => page.evaluate(x => window.fetchGroundData(x).then(d => ({ ok: true, d }), e => ({ ok: false, d: String(e.message) })), p);
  const packCounts = page => page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id + ':' + x.count)));

  test('Cross-references download (66 books) and answer with the CDN blocked, only for their own path', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.evaluate(() => window.navTo('settings'));
    await expect(page.locator('#offline-list')).toContainText('STUDY DATA');
    for (const id of ['words-core', 'crossrefs', 'macula-nt', 'macula-ot']) await expect(page.locator('#offline-list [data-pack="' + id + '"]')).toContainText('Download');
    await downloadStudy(page, 'crossrefs');
    expect(await packCounts(page)).toEqual(['crossrefs:66']);
    const john = await ground(page, 'crossrefs/43.json');
    expect(john.ok).toBe(true);
    expect(john.d).toEqual(onDisk('crossrefs/43.json'));
    expect(Object.keys(john.d).length).toBeGreaterThan(100);
    expect((await ground(page, 'macula/43.json')).ok, 'interlinear is not in the cross-reference pack').toBe(false);
    expect(app.errors).toEqual([]);
  });

  test('Interlinear NT downloads 27 books; the Old Testament is not answered until its own pack is installed', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadStudy(page, 'macula-nt');
    expect(await packCounts(page)).toEqual(['macula-nt:27']);
    const john = await ground(page, 'macula/43.json');
    expect(john.ok).toBe(true);
    expect(john.d).toEqual(onDisk('macula/43.json'));
    expect(john.d['1:1'][0].strongs).toBe('G1722');
    expect((await ground(page, 'macula/66.json')).ok).toBe(true);
    expect((await ground(page, 'macula/01.json')).ok, 'Genesis is Old Testament: not in the NT pack').toBe(false);
    expect(app.errors).toEqual([]);
  });

  test('Interlinear OT downloads 39 books and answers Genesis to Malachi with no network', async ({ browser, baseURL }) => {
    test.setTimeout(180000);
    app = await openApp(browser, baseURL);
    const { page } = app;
    await downloadStudy(page, 'macula-ot');
    expect(await packCounts(page)).toEqual(['macula-ot:39']);
    for (const n of ['01', '19', '39']) expect((await ground(page, 'macula/' + n + '.json')).d).toEqual(onDisk('macula/' + n + '.json'));
    expect((await ground(page, 'macula/40.json')).ok, 'Matthew is New Testament: not in the OT pack').toBe(false);
    expect(app.errors).toEqual([]);
  });

  test('a study pack where one file fails mid-download installs nothing and can be retried', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await serveStudy(page, 'macula/60.json');          // 21 of 27 files succeed, then 404
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="macula-nt"]').click();
    await expect(page.locator('#offline-list')).toContainText('could not be downloaded', { timeout: 60000 });
    expect(await packCounts(page)).toEqual([]);
    expect(await page.evaluate(() => window.offlineGet('macula-nt', 'macula/40.json')), 'files stored before the failure must be removed').toBeNull();
    await expect(page.locator('#offline-list [data-pack="macula-nt"]')).toContainText('Download');
    await page.unroute(STUDY_CDN);                      // retry with a good CDN
    await serveStudy(page);
    await page.locator('#offline-list [data-pack="macula-nt"]').click();
    await expect(page.locator('#offline-list [data-pack="macula-nt"]')).toContainText('Delete', { timeout: 60000 });
    expect(await packCounts(page)).toEqual(['macula-nt:27']);
  });

  // ───────── v4.67.1: screens used when the app is OPENED offline (navigator.onLine false at boot) ─────────
  /** Installs small FAKE packs: KJV (John 3), crossrefs, macula-nt and the Greek dictionary (John 3:16), with invented values. */
  async function installScreenFakes(page) {
    await page.evaluate(async () => {
      const john3 = []; for (let v = 1; v <= 20; v++) john3.push({ verse: v, text: 'zz-john-' + v });
      await window.offlineInstallPack({ id: 'bible-kjv', name: 'Fake KJV', version: '1', license: 'Test' }, [['43:3', john3]]);
      await window.offlineInstallPack({ id: 'crossrefs', name: 'Fake refs', version: '1', license: 'Test' }, [['crossrefs/43.json', { '3:16': [['Romans 5:8', 10], ['1 John 4:9', 7]] }]]);
      await window.offlineInstallPack({ id: 'macula-nt', name: 'Fake interlinear', version: '1', license: 'Test' },
        [['macula/43.json', { '3:16': [{ word: 'zzword', lemma: 'zz', strongs: 'G25', morph: 'V-AAI-3S', gloss: 'zzgloss' }] }]]);
      await window.offlineInstallPack({ id: 'words-core', name: 'Fake words', version: '1', license: 'Test' },
        [['strongs/greek.json', { G25: { translit: 'zztranslit', strongs_def: 'zz definition', kjv_def: 'zz' } }]]);
    });
  }
  /** Reloads the page as a phone that has no connection: navigator.onLine is false from the first line of the app. */
  async function reopenOffline(page) {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'onLine', { get: () => !window.__offline, configurable: true }); window.__offline = true; });
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  }

  test('opened with no connection, the Read tab shows a downloaded Bible chapter', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installScreenFakes(page);
    await reopenOffline(page);
    await page.evaluate(() => { window.navTo('read'); document.getElementById('read-trans').value = 'kjv'; document.getElementById('read-ref').value = 'John 3'; return window.fetchReadChapter(); });
    await expect(page.locator('#read-display')).toContainText('zz-john-16');
    await expect(page.locator('#read-display')).not.toContainText('requires a connection');
    expect(app.errors).toEqual([]);
  });

  test('opened with no connection, study scripture loads from a downloaded version', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installScreenFakes(page);
    await reopenOffline(page);
    await page.evaluate(() => { document.getElementById('f-trans').value = 'kjv'; document.getElementById('f-ref').value = 'John 3:16'; return window.fetchScr(); });
    await expect(page.locator('#scrdisplay')).toContainText('zz-john-16');
    expect(await page.locator('#scr-error-overlay.on').count()).toBe(0);
  });

  test('opened with no connection, Memory fills the verse text from a downloaded version', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installScreenFakes(page);
    await reopenOffline(page);
    await page.evaluate(() => { document.getElementById('mem-in-trans').value = 'kjv'; document.getElementById('mem-in-ref').value = 'John 3:16'; return window.memAutoFetchVerseText(); });
    await expect.poll(() => page.evaluate(() => document.getElementById('mem-in-text').value)).toContain('zz-john-16');
  });

  test('opened with no connection, Bible Tools shows cross-references and interlinear words from downloaded packs', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await installScreenFakes(page);
    await reopenOffline(page);
    await page.evaluate(() => window.openBibleTools('John 3:16', 'kjv'));
    await expect(page.locator('#bt-overlay')).toHaveClass(/on/);
    await page.evaluate(() => window.btToggleTool('xref'));
    await expect(page.locator('#bt-overlay')).toContainText('2 refs');                 // read from the cross-reference pack
    await page.evaluate(() => window.btToggleVerse('3:16'));
    await expect(page.locator('#bt-overlay')).toContainText('Romans 5:8');           // from the cross-reference pack
    await page.evaluate(() => window.btToggleTool('ilx'));
    await expect(page.locator('#bt-il-rows')).toContainText('zzword', { timeout: 10000 });   // from the interlinear pack
  });

  test('the app notices when the connection comes back after being opened offline', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await reopenOffline(page);
    await page.evaluate(() => { window.__offline = false; window.dispatchEvent(new Event('online')); });
    await expect(page.locator('#offbadge'), 'the offline badge must clear after a reconnect').not.toHaveClass(/show/);
    await page.evaluate(() => { window.__offline = true; window.dispatchEvent(new Event('offline')); });
    await expect(page.locator('#offbadge')).toHaveClass(/show/);
  });

  // ───────── v4.68.0: queued downloads, Download all, retries (fake small files, any CDN path) ─────────
  const ANY_CDN = /\/data\//;
  const fakeBible = () => { const o = {}; for (let i = 0; i < 1189; i++) o['k' + i] = [{ verse: 1, text: 'zz' }]; return JSON.stringify(o); };
  /** Answers every data request with a tiny fake file (a fake whole Bible for bibles/), after `delayMs`. */
  async function fakeAll(page, delayMs) {
    await page.route(ANY_CDN, async r => {
      if (delayMs) await new Promise(res => setTimeout(res, delayMs));
      const bible = /\/bibles\//.test(r.request().url());
      r.fulfill({ status: 200, headers: cors, body: bible ? fakeBible() : '{"ok":1}' });
    });
  }

  test('tapping several packs queues them: two download at once, the rest wait and then finish', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await fakeAll(page, 700);
    await page.evaluate(() => window.navTo('settings'));
    await page.evaluate(() => ['bible-kjv', 'bible-asv', 'bible-web'].forEach(id => window.offlineDownloadPack(id)));
    await expect(page.locator('#offline-list')).toContainText('Queued');
    expect(await page.locator('#offline-list button:has-text("Queued")').count(), 'two run, one waits').toBe(1);
    expect(await page.locator('#offline-list button:has-text("Please wait")').count()).toBe(2);
    await expect(page.locator('#offline-list [data-pack="bible-web"]')).toContainText('Delete', { timeout: 20000 });
    expect((await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id).sort())))).toEqual(['bible-asv', 'bible-kjv', 'bible-web']);
    expect(app.errors).toEqual([]);
  });

  test('Download all queues every pack that is not saved yet, and goes away when all are saved', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const { page } = app;
    await fakeAll(page, 0);
    await page.evaluate(() => window.navTo('settings'));
    await installFake(page, 'bible-kjv');               // one pack already saved: Download all must skip it
    await page.evaluate(() => window.renderOfflineSection());
    const all = page.locator('#offline-list button:has-text("Download all")');
    await expect(all).toContainText('8 not saved yet');
    await all.click();
    await expect.poll(() => page.evaluate(() => window.offlineListPacks().then(p => p.length)), { timeout: 30000 }).toBe(9);
    await expect(all).toHaveCount(0);
    expect(await page.evaluate(() => window.offlineGet('bible-kjv', '43:3').then(x => x && x[0].text)), 'the saved KJV was not replaced').toBe('zz-john-1');
  });

  test('a refused file (403) is retried and the download then succeeds', async ({ browser, baseURL }) => {
    test.setTimeout(60000);
    app = await openApp(browser, baseURL);
    const { page } = app;
    let hits = 0;
    await page.route(ANY_CDN, r => {
      if (r.request().url().includes('crossrefs/01.json') && hits++ < 2) return r.fulfill({ status: 403, headers: cors, body: 'no' });
      r.fulfill({ status: 200, headers: cors, body: '{"ok":1}' });
    });
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="crossrefs"]').click();
    await expect(page.locator('#offline-list [data-pack="crossrefs"]')).toContainText('Delete', { timeout: 30000 });
    expect(hits).toBe(3);
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.map(x => x.id + ':' + x.count)))).toEqual(['crossrefs:66']);
  });

  test('a file that keeps being refused fails the pack, names the file, installs nothing and can be retried', async ({ browser, baseURL }) => {
    test.setTimeout(60000);
    app = await openApp(browser, baseURL);
    const { page } = app;
    await page.route(ANY_CDN, r => r.request().url().includes('crossrefs/37.json')
      ? r.fulfill({ status: 403, headers: cors, body: 'no' })
      : r.fulfill({ status: 200, headers: cors, body: '{"ok":1}' }));
    await page.evaluate(() => window.navTo('settings'));
    await page.locator('#offline-list [data-pack="crossrefs"]').click();
    await expect(page.locator('#offline-list')).toContainText('crossrefs/37.json', { timeout: 30000 });
    await expect(page.locator('#offline-list')).toContainText('code 403');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(0);
    expect(await page.evaluate(() => window.offlineGet('crossrefs', 'crossrefs/01.json')), 'files saved before the failure are removed').toBeNull();
    await expect(page.locator('#offline-list [data-pack="crossrefs"]')).toContainText('Download');
  });
});
