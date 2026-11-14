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
//
// Only behavior that is verified good is asserted. The fake pack uses made-up text on purpose, so a test can never be
// satisfied by real network text. Seeds qa-local in a throwaway context, blocks all non-local network, localhost only.
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js):  npx playwright test tests/offline.spec.js

'use strict';

const { test, expect } = require('@playwright/test');

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
    const rows = page.locator('#offline-list [data-pack^="bible-"]'); // the Word study row is always listed too
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#offline-list')).toContainText('Fake KJV');
    await expect(page.locator('#offline-list')).toContainText('MB');

    const del = page.locator('#offline-list [data-pack="bible-kjv"]');
    await del.click();                                    // first tap arms it
    await expect(del).toContainText('Tap again');
    expect(await page.evaluate(() => window.offlineListPacks().then(p => p.length))).toBe(2);
    await del.click();                                    // second tap deletes
    await expect(rows).toHaveCount(1);
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

  const CDN = /cdn\.jsdelivr\.net\/gh\/arche-epos\/arche-suite@main\/data\/strongs\//;
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
});
