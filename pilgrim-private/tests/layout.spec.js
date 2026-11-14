// tests/layout.spec.js — Pilgrim Private phone-width layout sweep
//
// At 360px and 390px, on every bottom-nav screen: no sideways scroll, the floating Guide button (FAB) covers no
// visible control, and the bottom-nav tabs are comfortable tap targets. Also checks the Read-tab bottom buttons
// (Start a Study / Save to Memory, v4.63.2) against the FAB. Layout only: no Scripture text, no audio.
// Run from pilgrim-private/: npx playwright test tests/layout.spec.js

'use strict';

const { test, expect } = require('@playwright/test');

for (const width of [360, 390]) {
  test.describe('layout at ' + width + 'px', () => {
    test.use({ viewport: { width: width, height: 780 } });

    async function boot(page, baseURL) {
      const origin = new URL(baseURL).origin;
      await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
      await page.addInitScript(() => localStorage.setItem('bsn_active_user', 'qa-local'));
      await page.goto('/index.html');
      await expect(page.locator('#scr-library')).toHaveClass(/\bon\b/, { timeout: 10000 });
      await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
    }

    // Visible interactive elements (outside the FAB) whose box intersects the FAB box.
    function fabCollisions() {
      const fab = document.getElementById('main-fab').getBoundingClientRect();
      const out = [];
      document.querySelectorAll('button, a[href], input, select, textarea').forEach(el => {
        if (el.closest('.fab-wrap') || el.closest('.botnav')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.offsetParent === null) return;
        // v4.68.2: measure against the round button (nearest point of the control to the circle's centre), not its square box;
        // a real study puts the translation select's box corner inside the FAB's box but outside the circle.
        const cx = (fab.left + fab.right) / 2, cy = (fab.top + fab.bottom) / 2, rad = fab.width / 2;
        const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom));
        const hit = Math.hypot(nx - cx, ny - cy) < rad;
        if (hit) out.push((el.id || el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
      return out;
    }

    test('no sideways scroll and no FAB collisions on any screen', async ({ page, baseURL }) => {
      await boot(page, baseURL);
      for (const id of ['library', 'study', 'read', 'stats', 'settings']) {
        await page.click('#nav-' + id);
        if (id === 'study') { await expect(page.locator('#tpl-overlay')).toHaveClass(/\bon\b/); await page.evaluate(() => window.closeOverlay('tpl-overlay')); continue; } // Study has its own tests below; v4.68.2: with no study open the tab offers the template picker
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), 'sideways scroll on ' + id).toBe(false);
        const hits = await page.evaluate(fabCollisions);
        expect(hits, 'controls under the Guide button on ' + id).toEqual([]);
      }
    });

    // Found Nov 10, 2026 (first run of this sweep): on Study > Notes with an empty study, the Guide button covered the right
    // edge of the "Listen" button (about 56px at 390px). Fixed in v4.63.3 (the button row keeps a 64px lane for the Guide button).
    test('Study > Notes: no control sits under the Guide button', async ({ page, baseURL }) => {
      await boot(page, baseURL);
      await page.evaluate(() => window.createFromTemplate('blank'));   // v4.68.2: a real, empty study (the Study tab alone now opens the template picker)
      expect(await page.evaluate(fabCollisions), 'controls under the Guide button on study').toEqual([]);
    });

    test('Study screen has no sideways scroll', async ({ page, baseURL }) => {
      await boot(page, baseURL);
      await page.evaluate(() => window.createFromTemplate('blank'));   // v4.68.2
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    });

    test('Read-tab bottom buttons sit side by side and clear the Guide button', async ({ page, baseURL }) => {
      await boot(page, baseURL);
      await page.click('#nav-read');
      await page.evaluate(() => { ['read-start-study-btn', 'read-save-mem-btn'].forEach(i => { document.getElementById(i).style.display = ''; }); });
      const g = await page.evaluate(() => {
        const a = document.getElementById('read-start-study-btn').getBoundingClientRect();
        const b = document.getElementById('read-save-mem-btn').getBoundingClientRect();
        return { aTop: a.top, bTop: b.top, aRight: a.right, bLeft: b.left, h: a.height, bottom: a.bottom, vh: innerHeight };
      });
      expect(Math.abs(g.aTop - g.bTop), 'buttons share one row').toBeLessThan(2);
      expect(g.bLeft, 'Save button is right of Start button').toBeGreaterThan(g.aRight - 1);
      expect(g.h, 'buttons stay compact').toBeLessThanOrEqual(40);
      expect(await page.evaluate(fabCollisions), 'Read buttons under the Guide button').toEqual([]);
    });

    test('bottom-nav tabs are at least 44px tall and 56px wide', async ({ page, baseURL }) => {
      await boot(page, baseURL);
      for (const id of ['library', 'study', 'read', 'stats', 'settings']) {
        const r = await page.locator('#nav-' + id).boundingBox();
        expect(r.height, id + ' tab height').toBeGreaterThanOrEqual(44);
        expect(r.width, id + ' tab width').toBeGreaterThanOrEqual(56);
      }
    });
  });
}
