// tests/regress.spec.js — Pilgrim Private bug-class regression suite
//
// Pins three classes of bug that already bit once, so they cannot come back unseen:
//   1. Inline-onclick / markup class: a study title (or tag name) with an apostrophe, double quotes, a backslash and an
//      emoji must keep every Library card button working (open, Share, Duplicate, Delete) and the Progress list row.
//   2. Memory grading class (S5b-3, fixed in v4.55.0): a straight apostrophe typed for a stored curly one (and the other
//      way round, and straight vs curly double quotes) grades 100%, so the verse can still level up in Test Me.
//   3. Practice Repeat class (S5b-4, fixed in v4.55.0): the Repeat switch always starts off when Practice reopens.
//
// Lesson 18 (es-modules-lessons-v2.md): only behavior that is verified good is asserted. Known bugs go in as test.fixme
// with the finding written next to them (see the title-markup finding below).
//
// No PIN needed: it seeds the active user (qa-local) in a throwaway browser context and blocks all non-local network.
// Localhost only (the suite refuses to run elsewhere), because the tests write to local storage on purpose.
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js baseURL / PILGRIM_BASE_URL):
//   npx playwright test tests/regress.spec.js

'use strict';

const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 780 } });

const TITLE = 'Dad\'s "Big" Study \\ 😀';
const TAG_LABEL = 'Dad\'s "tag" 😀';

let app = null;

test.beforeAll(({ baseURL }) => {
  const host = new URL(baseURL).hostname;
  if (!/^(127\.0\.0\.1|localhost)$/.test(host)) throw new Error('regress.spec.js only runs against localhost (got ' + host + ').');
});
test.afterEach(async () => { if (app) { await app.ctx.close(); app = null; } });

// ───────────────────────────── helpers ─────────────────────────────

/** Opens a fresh throwaway browser context as qa-local, no external network, capturing uncaught errors. */
async function openApp(browser, baseURL) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript(() => { if (!localStorage.getItem('bsn_active_user')) localStorage.setItem('bsn_active_user', 'qa-local'); });
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

/** Waits for the app to boot, then removes first-run overlays that would block clicks. */
async function ready(page) {
  await page.waitForFunction(() => typeof window.rpOpenBrowse === 'function' && document.getElementById('scr-library') && document.getElementById('scr-library').classList.contains('on'));
  await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay', 'tour-offer-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
}

/** Seeds two studies (the first with a tricky title and tag) and a returning-user state, then reloads. */
async function seedStudies(page, firstTitle) {
  await page.evaluate(([title, tagLabel]) => {
    const U = '_qa-local';
    const study = (id, t, tags) => ({
      id, date: '2026-11-01', title: t, series: '', teacher: '', fieldNotes: '', tags, resources: [],
      refs: [{ id: 'r_' + id, reference: 'John 3:16', translation: 'esv', pastedTranslation: '', scriptureText: 'For God so loved the world.', type: 'primary', deep: { studyScope: 'passage' } }],
      deep: { conclusions: '', outline: '' }, words: [], updatedAt: 1762000000000, lastOpened: '2026-11-02'
    });
    localStorage.setItem('bsn_studies_v2' + U, JSON.stringify([study('bsn_t1', title, ['tag_q']), study('bsn_t2', 'Plain study', [])]));
    localStorage.setItem('bsn_tags_v1' + U, JSON.stringify([{ id: 'tag_q', label: tagLabel, color: '#c9a84c', bg: 'rgba(201,168,76,.18)' }]));
    localStorage.setItem('bsn_ob_done' + U, '1');
    localStorage.setItem('bsn_tab_hints_shown' + U, '1');
  }, [firstTitle, TAG_LABEL]);
  await page.reload();
  await ready(page);
}

const card = (page, text) => page.locator('.studycard', { hasText: text });

/** Adds a Memory verse through the app's own function and returns its id. */
async function addVerse(page, reference, text) {
  const id = await page.evaluate(([ref, txt]) => {
    const r = window.memAddVerse({ reference: ref, translation: 'esv', text: txt, source: 'manual' });
    if (r !== 'added') return 'ERR:' + r;
    return window.memLoad().items.find(i => i.text === txt).id;
  }, [reference, text]);
  expect(id.indexOf('ERR:')).toBe(-1);
  return id;
}

/** Types an answer into the open quiz, presses Check, and returns the shown percentage. */
async function gradeTyped(page, typed) {
  await page.fill('#mem-quiz-input', typed);
  await page.click('#mem-quiz-footer button');
  const t = await page.textContent('#mem-quiz-result');
  const m = t.match(/(\d+)% correct/);
  expect(m, 'no percentage shown: ' + t).not.toBeNull();
  return Number(m[1]);
}

// ───────────────────────────── 1. titles with apostrophes, quotes, emoji ─────────────────────────────

test.describe('Library cards with a tricky study title', () => {
  test('the card shows the title exactly and opening it fills the title field exactly', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await expect(card(page, 'Big').locator('.sc-title')).toHaveText(TITLE);
    await card(page, 'Big').locator('.sc-title').click();
    await expect(page.locator('#scr-study')).toHaveClass(/\bon\b/);
    await expect(page.locator('#f-title')).toHaveValue(TITLE);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('Duplicate works and the copy keeps the title', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await card(page, 'Big').locator('button:has-text("Duplicate")').click();
    await expect(page.locator('#toast')).toContainText('Study duplicated');
    await expect(page.locator('.studycard')).toHaveCount(3);
    await expect(card(page, '(Copy)').locator('.sc-title')).toHaveText(TITLE + ' (Copy)');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bsn_studies_v2_qa-local')).map(s => s.title));
    expect(stored).toContain(TITLE + ' (Copy)');
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('Share builds a link without an error (title survives the link encoding)', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await card(page, 'Big').locator('.sc-card-actions button').first().click();
    // Either the link is copied or a share dialog opens; it must not report a failure.
    await page.waitForFunction(() => /link copied|copied/i.test(document.getElementById('toast').textContent) || document.querySelector('.overlay.on'));
    await expect(page.locator('#toast')).not.toContainText(/not found|fail|error/i);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('Delete asks first, then removes exactly that study', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await card(page, 'Big').locator('button:has-text("Delete")').click();
    await expect(page.locator('#del-overlay')).toHaveClass(/\bon\b/);
    await page.click('#del-overlay .btn-danger');
    await expect(page.locator('#toast')).toContainText('Study deleted');
    await expect(page.locator('.studycard')).toHaveCount(1);
    await expect(page.locator('.studycard .sc-title')).toHaveText('Plain study');
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('bsn_studies_v2_qa-local')).map(s => s.id));
    expect(left).toEqual(['bsn_t2']);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('the Progress tab recent list shows the title and its row opens the study', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await page.click('#nav-stats');
    const row = page.locator('#stats-recent > div', { hasText: 'Big' }).first();
    await expect(row).toContainText(TITLE);
    await row.click();
    await expect(page.locator('#scr-study')).toHaveClass(/\bon\b/);
    await expect(page.locator('#f-title')).toHaveValue(TITLE);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('a tag named with an apostrophe, quotes and an emoji shows on the card and its Library filter works', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, TITLE);
    await expect(card(page, 'Big').locator('.sc-tags')).toContainText(TAG_LABEL);
    await page.locator('.tag-filter-btn', { hasText: 'Dad' }).click();
    await expect(page.locator('.studycard')).toHaveCount(1);
    await expect(page.locator('.studycard .sc-title')).toHaveText(TITLE);
    await page.locator('.tag-filter-btn', { hasText: 'All' }).click();
    await expect(page.locator('.studycard')).toHaveCount(2);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  // FOUND Nov 10, 2026 (probing this suite): renderLib() writes s.title (and the reference) into the card with NO escHtml,
  // so a title that contains HTML is run as markup. A title of <img src=x onerror="window.__pwned=1">Hi sets window.__pwned
  // the moment the Library draws. Titles can arrive from a shared study link (checkImportHash / confirmImportLink), so this is
  // a script-injection path from another person's link (the link path itself is not tested here). The same raw title is
  // used in the Progress recent list. Not fixed (Boss to decide). Remove .fixme once the title is escaped.
  test.fixme('a study title that contains HTML is shown as text and never runs', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStudies(page, '<img src=x onerror="window.__pwned=1">Hi');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__pwned), 'script from a title ran').toBeUndefined();
    await expect(card(page, 'Hi').locator('.sc-title')).toHaveText('<img src=x onerror="window.__pwned=1">Hi');
  });
});

// ───────────────────────────── 2. Memory grading: apostrophes and quotes ─────────────────────────────

test.describe('Memory grading treats straight and curly punctuation the same', () => {
  const CURLY_APOS = 'He restores my soul. He leads me in paths of righteousness for his name’s sake.';
  const STRAIGHT_APOS = 'He restores my soul. He leads me in paths of righteousness for his name\'s sake.';
  const CURLY_QUOTES = 'And he said, “Follow me,” and they followed him.';
  const STRAIGHT_QUOTES = 'And he said, "Follow me," and they followed him.';

  for (const [label, stored, typed] of [
    ['stored curly apostrophe, typed straight', CURLY_APOS, STRAIGHT_APOS],
    ['stored straight apostrophe, typed curly', STRAIGHT_APOS, CURLY_APOS],
    ['stored curly double quotes, typed straight', CURLY_QUOTES, STRAIGHT_QUOTES],
    ['stored straight double quotes, typed curly', STRAIGHT_QUOTES, CURLY_QUOTES]
  ]) {
    test('Practice: ' + label + ' grades 100%', async ({ browser, baseURL }) => {
      app = await openApp(browser, baseURL);
      const page = app.page;
      const id = await addVerse(page, 'Psalm 23:3', stored);
      await page.evaluate(i => window.memPracticeVerse(i), id);
      await expect(page.locator('#mem-quiz-overlay')).toHaveClass(/\bon\b/);
      expect(await gradeTyped(page, typed)).toBe(100);
      expect(app.errors, app.errors.join('\n')).toEqual([]);
    });
  }

  test('Test Me: a straight apostrophe for a stored curly one still counts as 100% and moves the verse up a level', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await addVerse(page, 'Psalm 23:3', CURLY_APOS);
    const level = () => page.evaluate(() => window.memLoad().items[0].chunks[0].level);
    expect(await level()).toBe(0);
    await page.evaluate(() => window.memOpenQuiz('due'));
    await expect(page.locator('#mem-quiz-overlay')).toHaveClass(/\bon\b/);
    expect(await gradeTyped(page, STRAIGHT_APOS)).toBe(100);
    expect(await level(), 'a perfect answer must advance the level').toBe(1);
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });

  test('a genuinely wrong word is still marked wrong (the apostrophe fix did not loosen grading)', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    const id = await addVerse(page, 'Psalm 23:3', CURLY_APOS);
    await page.evaluate(i => window.memPracticeVerse(i), id);
    const pct = await gradeTyped(page, STRAIGHT_APOS.replace('restores', 'returns'));
    expect(pct).toBeLessThan(100);
    expect(pct).toBeGreaterThan(80);
  });
});

// ───────────────────────────── 3. Practice Repeat resets ─────────────────────────────

test.describe('Practice Repeat always starts off', () => {
  test('Repeat switched on is off again when Practice is reopened (no reload)', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    const id = await addVerse(page, 'Psalm 23:3', 'He restores my soul.');
    const repeat = page.locator('#mem-practice-repeat');

    await page.evaluate(i => window.memPracticeVerse(i), id);
    await expect(repeat).toBeVisible();
    await expect(repeat).not.toContainText(' on');
    await repeat.click();
    await expect(repeat).toContainText('Repeat on');
    expect(await page.evaluate(() => window.getTTSPracticeRepeat())).toBe(true);

    // Close Practice and open it again for the same verse.
    await page.evaluate(() => window.memCloseQuiz());
    await expect(page.locator('#mem-quiz-overlay')).not.toHaveClass(/\bon\b/);
    await page.evaluate(i => window.memPracticeVerse(i), id);
    await expect(repeat).toBeVisible();
    await expect(repeat).not.toContainText(' on');
    expect(await page.evaluate(() => window.getTTSPracticeRepeat())).toBe(false);

    // And for a different verse, with Repeat left on when switching.
    const id2 = await addVerse(page, 'Psalm 23:4', 'Even though I walk through the valley.');
    await repeat.click();
    await expect(repeat).toContainText('Repeat on');
    await page.evaluate(() => window.memCloseQuiz());
    await page.evaluate(i => window.memPracticeVerse(i), id2);
    await expect(repeat).not.toContainText(' on');
    expect(app.errors, app.errors.join('\n')).toEqual([]);
  });
});
