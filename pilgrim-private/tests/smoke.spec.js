// tests/smoke.spec.js — Pilgrim Private smoke suite
//
// Purpose: catch the bug class that shipped in v4.34.15 — a runtime
// ReferenceError that node --check cannot see (not a syntax error) and that
// a static bridge-check pass cannot see either (the broken reference wasn't
// an HTML-called, unexported function — it was a bare identifier left over
// after its import was removed). node --check and bridge-check.js both
// passed clean on that build; only actually loading the page in a browser
// surfaced it. That's this suite's one job: load the app, drive a few core
// taps, and fail loudly if anything throws.
//
// This is NOT a feature-regression suite. It does not assert on Scripture
// Finder results, AI tool output, sync behavior, etc. — see tests/README.md
// for where that fuller suite is scoped to land once the codebase settles.
//
// Requires:
//   - Live Server (or any static server) running at the baseURL in
//     playwright.config.js (default http://127.0.0.1:5500)
//   - Environment variable PILGRIM_TEST_PIN set to a real tester PIN.
//     Never hardcode a PIN in this file or commit one anywhere in the repo.
//
// Run from pilgrim-private/:
//   PILGRIM_TEST_PIN=1234 npx playwright test
//   PILGRIM_TEST_PIN=1234 npx playwright test --headed

'use strict';

const { test, expect } = require('@playwright/test');

/**
 * Attaches console/page-error listeners and returns the accumulator array.
 * Call before page.goto() so nothing from initial load is missed.
 * @param {import('@playwright/test').Page} page
 * @returns {Array<string>}
 */
function captureErrors(page) {
  const errors = [];
  page.on('pageerror', function (err) {
    errors.push('pageerror: ' + err.message);
  });
  page.on('console', function (msg) {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });
  return errors;
}

/**
 * Logs in through the real PIN gate using PILGRIM_TEST_PIN. Skips the
 * network round trip on any run after the first within the same browser
 * context, since a successful submitPin() caches bsn_active_user and
 * initPinGate() takes the cached branch on reload.
 * @param {import('@playwright/test').Page} page
 */
async function login(page) {
  const pin = process.env.PILGRIM_TEST_PIN;
  if (!pin) {
    throw new Error(
      'PILGRIM_TEST_PIN is not set. Export a real tester PIN before running ' +
      'this suite — see tests/README.md.'
    );
  }
  const gate = page.locator('#pin-gate-overlay');
  if (await gate.evaluate((el) => el.classList.contains('on'))) {
    await page.fill('#pin-input', pin);
    await page.click('#pin-submit-btn');
  }
  // Library is the default landing screen post-login.
  await expect(page.locator('#scr-library')).toHaveClass(/\bon\b/, { timeout: 10000 });
}

test.describe('Pilgrim Private — smoke', () => {
  test('app boots to Library with no console/runtime errors', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto('/');
    await login(page);
    // Core shell present — the exact check that would have failed on the
    // v4.34.15 white screen (nothing past the static HTML would have painted).
    await expect(page.locator('.botnav')).toBeVisible();
    await expect(page.locator('.fab-wrap')).toBeVisible();
    expect(errors, 'unexpected console/runtime errors during boot:\n' + errors.join('\n')).toEqual([]);
  });

  test('bottom nav switches to Study with no new errors', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto('/');
    await login(page);
    await page.click('#nav-study');
    await expect(page.locator('#scr-study')).toHaveClass(/\bon\b/);
    await expect(page.locator('#nav-study')).toHaveClass(/\bon\b/);
    expect(errors, 'unexpected console/runtime errors navigating to Study:\n' + errors.join('\n')).toEqual([]);
  });

  test('FAB opens the New Study / Pilgrim Guide menu on Library', async ({ page }) => {
    const errors = captureErrors(page);
    await page.goto('/');
    await login(page);
    await page.click('#main-fab');
    await expect(page.locator('#fab-menu')).toHaveClass(/\bon\b/);
    expect(errors, 'unexpected console/runtime errors opening the FAB menu:\n' + errors.join('\n')).toEqual([]);
  });
});
