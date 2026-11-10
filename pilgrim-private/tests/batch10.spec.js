// tests/batch10.spec.js — Pilgrim Private reading-plan regression suite (Batch 10, v4.60.0 to v4.63.2)
//
// Covers the non-audio steps of claude/pilgrim-phone-test-plan-batch10.md (steps 69, 72-75, 77-79, 81-83, 85-86)
// at a 360px phone width: plan library (Browse/Start), plan playback bar, Mark read, Stop at the end, the Repeat
// popup, per-plan progress, content-plan data, reading streak, and that nothing outside the plan store changes.
// It cannot test audio (steps 70, 71) or look and feel; those stay on the phone test.
//
// No PIN needed: it seeds the active user (qa-local) and blocks all non-local network (Scripture text will not
// load, which is fine; these checks do not depend on it).
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js baseURL / PILGRIM_BASE_URL):
//   npx playwright test tests/batch10.spec.js

'use strict';

const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 360, height: 760 } });
test.describe.configure({ mode: 'serial' });

let page, ctx, errors = [], storageBefore = '';

/** Snapshot of every localStorage key except the reading-plan store and harmless runtime keys. */
function otherStorage() {
  return Object.keys(localStorage)
    .filter(function (k) { return k.indexOf('bsn_readplan_') !== 0 && k.indexOf('error_log') < 0 && k.indexOf('tab_hints') < 0; })
    .sort().map(function (k) { return k + '=' + localStorage.getItem(k).length; }).join('|');
}

test.beforeAll(async ({ browser, baseURL }) => {
  ctx = await browser.newContext({ viewport: { width: 360, height: 760 } });
  await ctx.addInitScript(() => localStorage.setItem('bsn_active_user', 'qa-local'));
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const origin = new URL(baseURL).origin;
  await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.rpOpenBrowse === 'function');
  await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
  storageBefore = await page.evaluate(otherStorage);
});
test.afterAll(async () => { await ctx.close(); });

test('77/78 Browse lists ten plans; nothing enrolled at first', async () => {
  expect(await page.evaluate(() => window.rpStatsSummary().enrolled)).toBe(0);
  await page.evaluate(() => window.rpOpenBrowse());
  const names = await page.evaluate(() => [...document.querySelectorAll('#rp-browse-body > *')].map(e => e.innerText.split('\n')[0]));
  expect(names.length).toBe(10);
  expect(names[0]).toBe('The Biblical Story');
});

test('78/79 Start enrolls plans independently; Leave button appears', async () => {
  await page.locator('#rp-browse-body [data-rp-bstart]').first().click();
  expect(await page.evaluate(() => window.rpStatsSummary().enrolled)).toBe(1);
  await page.locator('#rp-browse-body [data-rp-bstart]').first().click();
  expect(await page.evaluate(() => window.rpStatsSummary().enrolled)).toBe(2);
  expect(await page.locator('#rp-browse-body [data-rp-bleave]').count()).toBeGreaterThan(0);
  await page.evaluate(() => window.rpCloseBrowse());
});

test('69/75 plan bar shows plan, section, item, and fits 360px', async () => {
  await page.evaluate(() => { window.rpEnroll('life-of-jesus', true); if (typeof showTab === 'function') showTab('read'); });
  await page.evaluate(async () => { await window.rpContinue('life-of-jesus', false); });
  const bar = page.locator('#rp-playbar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(/the life of jesus/i);
  await expect(bar).toContainText('Passage 1 of 2');
  const fit = await page.evaluate(() => { const e = document.getElementById('rp-playbar'); return e.scrollWidth <= e.clientWidth + 1; });
  expect(fit).toBe(true);
});

test('72 Mark read checks the item; Next and Prev move through items', async () => {
  await page.click('#rp-playbar button:has-text("Mark read")');
  await expect(page.locator('#rp-playbar .rp-pb-btns button:has-text("Read")')).toBeDisabled();
  const before = await page.innerText('#rp-playbar');
  await page.click('#rp-playbar button[aria-label="Next item"]');
  await expect.poll(() => page.innerText('#rp-playbar')).not.toBe(before);
  await page.click('#rp-playbar button[aria-label="Previous item"]');
});

test('79/85 checks count only in the session plan; reading streak is at least 1', async () => {
  const counts = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.indexOf('bsn_readplan_') === 0);
    const st = JSON.parse(localStorage.getItem(k)), out = {};
    Object.keys(st.plans || {}).forEach(id => { out[id] = Object.values(st.plans[id].items || {}).filter(x => x.r === 1).length; });
    return out;
  });
  expect(counts['life-of-jesus']).toBe(1);
  expect(counts['storyflow'] || 0).toBe(0);
  expect((await page.evaluate(() => window.rpStatsSummary())).streak).toBeGreaterThanOrEqual(1);
});

test('73 Stop at the end checkbox toggles and keeps its size (18px box, 13px text)', async () => {
  const cb = page.locator('#rp-playbar .rp-pb-stop input');
  await cb.check();
  await expect(cb).toBeChecked();
  const size = await page.evaluate(() => {
    const i = document.querySelector('#rp-playbar .rp-pb-stop input').getBoundingClientRect();
    return i.width + 'x' + i.height + ' ' + getComputedStyle(document.querySelector('#rp-playbar .rp-pb-stop')).fontSize;
  });
  expect(size).toBe('18x18 13px');
});

test('74 Repeat popup: four options, each pick works, outside tap closes, resets after Exit', async () => {
  const btn = '#rp-playbar .rp-pb-repwrap > button';
  await page.click(btn);
  expect(await page.locator('.rp-pb-repopt').count()).toBe(4);
  for (const [i, label] of [[2, 'Passage'], [3, 'Item'], [4, 'Section']]) {
    if (!(await page.locator('.rp-pb-repmenu').count())) await page.click(btn);
    await page.click('.rp-pb-repopt:nth-child(' + i + ')');
    await expect(page.locator(btn)).toContainText(label);
    expect(await page.locator('.rp-pb-repmenu').count()).toBe(0);
  }
  await page.click(btn);
  await page.mouse.click(180, 700);
  expect(await page.locator('.rp-pb-repmenu').count()).toBe(0);
  await page.click('#rp-playbar button:has-text("Exit")');
  await page.evaluate(() => window.rpContinue('life-of-jesus', false));
  await expect(page.locator(btn)).toContainText(/^Repeat/);
});

test('81-83 content plans: sizes, Day 30, multi-passage items name their books', async () => {
  const data = await page.evaluate(async () => {
    const d = await import('./readingplan-data.js'), c = await import('./readingplan-core.js');
    const out = {};
    ['psalms-proverbs', 'genesis-1-11', 'creation', 'lineage'].forEach(id => {
      const items = d.rpBuildPlan(id).items;
      const segs = items.flatMap(i => c.rpItemPassages(i));
      out[id] = { n: items.length, bad: segs.filter(s => !/^[1-3]? ?[A-Za-z][A-Za-z ]+ \d/.test(s)) };
    });
    out.day30 = c.rpItemPassages(d.rpBuildPlan('psalms-proverbs').items[29]).join('; ');
    out.multi = d.rpBuildPlan('genesis-1-11').items.map(i => c.rpItemPassages(i)).filter(a => a.length > 1)[0];
    return out;
  });
  expect(data['psalms-proverbs'].n).toBe(30);
  expect(data.day30).toMatch(/Proverbs 30/);
  expect(data.day30).toMatch(/Proverbs 31/);
  expect(data['genesis-1-11'].n).toBe(11);
  expect(data.multi).toEqual(['Genesis 4:17-26', 'Genesis 5']);
  expect(data.creation.n).toBe(21);
  expect(data.lineage.n).toBe(19);
  ['psalms-proverbs', 'genesis-1-11', 'creation', 'lineage'].forEach(id => expect(data[id].bad).toEqual([]));
});

test('86 nothing outside the plan store changed; no page errors', async () => {
  expect(await page.evaluate(otherStorage)).toBe(storageBefore);
  expect(errors).toEqual([]);
});
