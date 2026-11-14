// tests/studyguard.spec.js — v4.68.2: the Study tab with no study open offers the template picker
// (it used to show an empty Study screen where Bible Tools said "Load a passage first" and notes had nowhere to save).
// Seeds qa-local in a throwaway context, localhost only. Run from pilgrim-private/ with a static server up.
'use strict';
const { test, expect } = require('@playwright/test');
test.use({ viewport: { width: 390, height: 780 } });

async function openApp(browser, baseURL) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript(() => { if (!localStorage.getItem('bsn_active_user')) localStorage.setItem('bsn_active_user', 'qa-local'); localStorage.setItem('bsn_tour_settings_seen_qa-local', '1'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const origin = new URL(baseURL).origin;
  await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() => document.getElementById('scr-library') && document.getElementById('scr-library').classList.contains('on'));
  await page.evaluate(() => ['ai-lockdown-overlay', 'ob-overlay', 'tour-offer-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }));
  return { ctx, page, errors };
}

test.describe('Pilgrim Private: Study tab with no study open (qa-local, localhost only)', () => {
  test('tapping Study with no study open shows the template picker and stays off the empty Study screen', async ({ browser, baseURL }) => {
    const { ctx, page, errors } = await openApp(browser, baseURL);
    expect(await page.evaluate(() => window.activeRef() == null)).toBe(true);
    await page.locator('#nav-study').click();
    await expect(page.locator('#tpl-overlay')).toHaveClass(/on/);
    await expect(page.locator('#scr-study')).not.toHaveClass(/on/);
    expect(await page.evaluate(() => window.activeRef() == null)).toBe(true);        // picking nothing creates nothing
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('picking a template opens a real study, and Bible Tools opens for a typed passage', async ({ browser, baseURL }) => {
    const { ctx, page, errors } = await openApp(browser, baseURL);
    await page.locator('#nav-study').click();
    await expect(page.locator('#tpl-overlay')).toHaveClass(/on/);
    await page.evaluate(() => window.createFromTemplate('blank'));
    await expect(page.locator('#scr-study')).toHaveClass(/on/);
    expect(await page.evaluate(() => !!window.activeRef() && window.activeRef().reference === '')).toBe(true);
    await page.locator('#f-ref').click();
    await page.keyboard.type('John 1:35-51');
    await page.evaluate(() => window.openBibleToolsFromStudy());
    await expect(page.locator('#bt-overlay')).toHaveClass(/on/);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
