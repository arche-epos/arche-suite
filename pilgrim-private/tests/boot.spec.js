// tests/boot.spec.js — Pilgrim Private no-login boot check
//
// Same job as smoke.spec.js (catch runtime errors that node --check and bridge-check cannot see, like the v4.34.15
// white screen), but WITHOUT the real PIN gate, so Claude can run it in its sandbox before every push. It seeds the
// active user (qa-local), blocks all non-local network, and ignores the resulting "failed to load" noise.
// smoke.spec.js (real PIN login, run by Boss with PILGRIM_TEST_PIN) stays as the real-login check.
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js baseURL / PILGRIM_BASE_URL):
//   npx playwright test tests/boot.spec.js

'use strict';

const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 780 } });

const NETWORK_NOISE = /Failed to load resource|ERR_FAILED|ERR_BLOCKED|ERR_TUNNEL|ERR_INTERNET|net::/i;

/** Seeds the user, blocks external network, removes first-run overlays, and returns the runtime-error list. */
async function boot(page, baseURL) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !NETWORK_NOISE.test(m.text())) errors.push('console.error: ' + m.text()); });
  const origin = new URL(baseURL).origin;
  await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
  await page.addInitScript(() => localStorage.setItem('bsn_active_user', 'qa-local'));
  await page.goto('/index.html');
  await expect(page.locator('#scr-library')).toHaveClass(/\bon\b/, { timeout: 10000 });
  await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
  return errors;
}

test.describe('Pilgrim Private — no-login boot check', () => {
  test('app boots to Library with the shell present and no runtime errors', async ({ page, baseURL }) => {
    const errors = await boot(page, baseURL);
    await expect(page.locator('.botnav')).toBeVisible();
    await expect(page.locator('.fab-wrap')).toBeVisible();
    expect(errors, 'unexpected errors during boot:\n' + errors.join('\n')).toEqual([]);
  });

  test('every bottom-nav tab opens with no new errors', async ({ page, baseURL }) => {
    const errors = await boot(page, baseURL);
    for (const id of ['study', 'read', 'stats', 'settings', 'library']) {
      await page.click('#nav-' + id);
      await expect(page.locator('#scr-' + id)).toHaveClass(/\bon\b/);
      await expect(page.locator('#nav-' + id)).toHaveClass(/\bon\b/);
    }
    expect(errors, 'unexpected errors switching tabs:\n' + errors.join('\n')).toEqual([]);
  });

  test('FAB opens the New Study / Pilgrim Guide menu on Library', async ({ page, baseURL }) => {
    const errors = await boot(page, baseURL);
    await page.click('#main-fab');
    await expect(page.locator('#fab-menu')).toHaveClass(/\bon\b/);
    expect(errors, 'unexpected errors opening the FAB menu:\n' + errors.join('\n')).toEqual([]);
  });

  test('no screen scrolls sideways at 390px', async ({ page, baseURL }) => {
    await boot(page, baseURL);
    for (const id of ['library', 'study', 'read', 'stats', 'settings']) {
      await page.click('#nav-' + id);
      const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(over, 'horizontal overflow on ' + id).toBe(false);
    }
  });
});
