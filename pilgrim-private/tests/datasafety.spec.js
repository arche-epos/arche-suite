// tests/datasafety.spec.js — Pilgrim Private data-safety regression suite
//
// Guards the paths that can lose or resurrect a user's data: the JSON backup round trip (export, wipe, restore),
// Clear All Data and its Undo (safety copy), tombstones (a deleted tag or Memory verse stays deleted after a restore),
// the Study Tour sample study never reaching a backup, and the red "Not saved" banner when device storage is full.
//
// Lesson 18 (es-modules-lessons-v2.md): these assert only behavior that is verified good. Each check below follows the
// current rule in the code and the passing S5/S8 regression results (Oct 27-28, 2026) plus the v4.49.2 fixes for
// S8-2, S8-3 and S8-N3. Nothing here locks in a known bug.
//
// Safety, by design:
//   - qa-local only. Every test runs in its own throwaway Playwright browser context (fresh localStorage), seeded as the
//     user "qa-local". It cannot see a real browser profile.
//   - Localhost only. The suite refuses to run unless the base URL host is 127.0.0.1 or localhost, so it can never wipe
//     or write data on the live site. All non-local network is blocked (the Worker, Scripture, AI are never reached).
//   - No PIN, no secrets, no app code touched.
//
// NOT covered here (needs the live Worker, so it belongs to the live-site run): Study Sync backup/restore and study
// tombstones. A JSON file restore deliberately re-adds studies deleted earlier (S8-N2, plausibly by design), so study
// tombstones are not asserted for file restores.
//
// Run from pilgrim-private/ with a static server up (see playwright.config.js baseURL / PILGRIM_BASE_URL):
//   npx playwright test tests/datasafety.spec.js

'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({ viewport: { width: 390, height: 780 } });

const U = '_qa-local';
const OTHER_USER_KEY = 'bsn_studies_v2_other-user';
const OTHER_USER_VALUE = '[{"id":"other1","title":"Not mine"}]';

let app = null;

test.beforeAll(({ baseURL }) => {
  const host = new URL(baseURL).hostname;
  if (!/^(127\.0\.0\.1|localhost)$/.test(host)) {
    throw new Error('datasafety.spec.js only runs against localhost (got ' + host + '). It wipes data on purpose.');
  }
});

test.afterEach(async () => {
  if (app) { await app.ctx.close(); app = null; }
});

// ───────────────────────────── helpers ─────────────────────────────

/** Opens a fresh throwaway browser context as qa-local, no external network, capturing uncaught errors and confirm text. */
async function openApp(browser, baseURL) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('bsn_active_user')) localStorage.setItem('bsn_active_user', 'qa-local');
    // Desktop path: no native share sheet, so exportData() builds a Blob download. Keep every Blob for inspection.
    try { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); } catch (e) { /* ignore */ }
    window.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { window.__blobs.push(b); return orig(b); };
  });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  const origin = new URL(baseURL).origin;
  await page.route(u => new URL(u.href).origin !== origin, r => r.abort());
  await page.goto('/index.html');
  await ready(page);
  return { ctx, page, errors, dialogs };
}

/** Waits for the app to finish booting, then removes first-run overlays that would block clicks. */
async function ready(page) {
  await page.waitForFunction(() => typeof window.rpOpenBrowse === 'function' && document.getElementById('scr-library') && document.getElementById('scr-library').classList.contains('on'));
  await page.evaluate(() => { ['ai-lockdown-overlay', 'ob-overlay', 'tour-offer-overlay'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }); });
}

/** Writes studies, tags, words, streak, settings and other per-user keys straight into localStorage, then reloads. */
async function seedStorage(page) {
  await page.evaluate(([OTHER_KEY, OTHER_VAL]) => {
    const U = '_qa-local';
    const study = (id, title, notes, tags, ref, text) => ({
      id, date: '2026-11-01', title, series: '', teacher: 'Boss', fieldNotes: notes, tags, resources: [],
      refs: [{ id: 'r_' + id, reference: ref, translation: 'esv', pastedTranslation: '', scriptureText: text, type: 'primary', deep: { studyScope: 'passage' } }],
      deep: { conclusions: 'Conclusion ' + id, outline: '' }, words: [], updatedAt: 1762000000000
    });
    const studies = [
      study('bsn_qa_1', 'Dad\'s "Big" Study 😀', '<p>It’s “quoted” &amp; fine</p>', ['tag_a'], 'John 3:16', 'For God so loved the world, that he gave his only Son.'),
      study('bsn_qa_2', 'Plain study', '<p>Second</p>', ['tag_a', 'tag_b'], 'Psalm 23:1-3', 'The LORD is my shepherd; I shall not want.'),
      study('bsn_qa_3', 'Third study', '<p>Third</p>', [], 'Romans 8:1', 'There is therefore now no condemnation.')
    ];
    const tags = [
      { id: 'tag_a', label: 'Alpha', color: '#c9a84c', bg: 'rgba(201,168,76,.18)' },
      { id: 'tag_b', label: 'Beta', color: '#5a9b70', bg: 'rgba(90,155,112,.18)' }
    ];
    localStorage.setItem('bsn_studies_v2' + U, JSON.stringify(studies));
    localStorage.setItem('bsn_tags_v1' + U, JSON.stringify(tags));
    localStorage.setItem('bsn_tags_deleted_v1' + U, JSON.stringify([{ id: 'tag_gone', deletedAt: '2026-11-01T00:00:00.000Z' }]));
    localStorage.setItem('bsn_words_global' + U, JSON.stringify([{ id: 'w_qa', query: 'agape', html: '<p>love</p>' }]));
    localStorage.setItem('bsn_streak' + U, JSON.stringify({ lastDay: '2026-11-09', streak: 4 }));
    localStorage.setItem('bsn_settings_v1' + U, JSON.stringify({ scrMode: 'auto', defaultTrans: 'nasb', theme: 'dark', fontFamily: 'original', fontScale: 1 }));
    localStorage.setItem('bsn_tts_sett' + U, JSON.stringify({ practiceGap: 5 }));
    localStorage.setItem('bsn_tour_study_seen' + U, '1');
    localStorage.setItem('bsn_tour_settings_seen' + U, '1');
    localStorage.setItem('bsn_ob_done' + U, '1');
    localStorage.setItem('bsn_tab_hints_shown' + U, '1'); // a returning user: hints already dismissed (see the note on dismissTabHints in the quota test)
    localStorage.setItem('bsn_pgchat' + U, '["qa-marker"]');
    localStorage.setItem(OTHER_KEY, OTHER_VAL); // a different user on the same browser
  }, [OTHER_USER_KEY, OTHER_USER_VALUE]);
  await page.reload();
  await ready(page);
}

/** Adds two Memory verses and one checked reading-plan item through the app's own functions. */
async function seedMemoryAndPlan(page) {
  const added = await page.evaluate(() => [
    window.memAddVerse({ reference: 'Psalm 23:1', translation: 'esv', text: 'The LORD is my shepherd; I shall not want.', source: 'manual' }),
    window.memAddVerse({ reference: 'Romans 8:1', translation: 'esv', text: 'There is therefore now no condemnation for those who are in Christ Jesus.', source: 'manual' })
  ]);
  expect(added).toEqual(['added', 'added']);
  await page.evaluate(() => window.rpEnroll('life-of-jesus', true));
  await page.click('#nav-read');
  await page.evaluate(async () => { await window.rpContinue('life-of-jesus', false); });
  await page.evaluate(() => window.rpMarkRead());
  await page.click('#nav-library');
}

/** Reads every per-user storage key of qa-local (parsed where it is JSON) plus the other user's key. */
async function snap(page) {
  return page.evaluate(() => {
    const U = '_qa-local', get = k => localStorage.getItem(k + U);
    const j = k => { const v = get(k); try { return v === null ? null : JSON.parse(v); } catch (e) { return '__unparseable__'; } };
    const all = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.slice(-U.length) === U || k.indexOf(U + '_') > 0) all[k] = localStorage.getItem(k); }
    return {
      studies: j('bsn_studies_v2') || [], tags: j('bsn_tags_v1'), tagsDel: j('bsn_tags_deleted_v1') || [], words: j('bsn_words_global'),
      mem: j('bsn_memverses'), plan: j('bsn_readplan'), streak: j('bsn_streak'), sett: j('bsn_settings_v1'),
      raw: { studies: get('bsn_studies_v2'), tags: get('bsn_tags_v1'), tagsDel: get('bsn_tags_deleted_v1'), words: get('bsn_words_global'), mem: get('bsn_memverses'), plan: get('bsn_readplan'), streak: get('bsn_streak'), sett: get('bsn_settings_v1') },
      other: localStorage.getItem('bsn_studies_v2_other-user'), all
    };
  });
}

/** What a backup is expected to preserve about a study (AI results are never part of a backup). */
function studyView(list) {
  return list.map(s => ({ id: s.id, title: s.title, notes: s.fieldNotes, tags: s.tags, concl: s.deep && s.deep.conclusions, refs: s.refs.map(r => [r.reference, r.scriptureText]) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
// Memory normalizes the book name ("Psalm" becomes "Psalms", S5 note N2), so compare translation + text, not the typed reference.
function memView(mem) { return (mem ? mem.items : []).map(i => [i.translation, i.text]).sort(); }
function planChecks(plan) {
  const out = {};
  Object.keys((plan && plan.plans) || {}).forEach(id => { out[id] = Object.keys(plan.plans[id].items || {}).sort(); });
  return out;
}

/** Runs the real exportData() and returns the backup JSON text it built. */
async function exportJson(page) {
  const n = await page.evaluate(() => window.__blobs.length);
  await page.evaluate(() => window.exportData());
  await page.waitForFunction(k => window.__blobs.length > k, n);
  return page.evaluate(k => window.__blobs[k].text(), n);
}

/** Runs Clear All Data through the real overlay button, waits for the reload, and re-boots. */
async function clearAllViaUi(page) {
  await page.evaluate(() => window.clearAll());
  await expect(page.locator('#clearall-overlay')).toHaveClass(/\bon\b/);
  await Promise.all([page.waitForEvent('load'), page.click('#clearall-overlay button.btn-danger')]);
  await ready(page);
}

/** Restores a backup file through the real file input (confirm dialog auto-accepted). */
async function importFile(page, path) {
  await page.setInputFiles('#import-file-input', path);
  await page.waitForFunction(() => /Imported \d+ stud/.test(document.getElementById('toast').textContent));
}

// ───────────────────────────── tests ─────────────────────────────

test.describe('Pilgrim Private: data safety (qa-local, localhost only)', () => {
  test('backup file round trip: export, Clear All, restore brings back studies, tags, Memory, plan and streak', async ({ browser, baseURL }, testInfo) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);
    await seedMemoryAndPlan(page);
    const before = await snap(page);
    expect(before.studies.length).toBe(3);
    expect(memView(before.mem).length).toBe(2);
    expect(Object.keys(planChecks(before.plan))).toContain('life-of-jesus');

    // The backup file holds everything that is supposed to be in it, and nothing it must not hold.
    const json = await exportJson(page);
    const file = JSON.parse(json);
    expect(file.studies.map(s => s.id).sort()).toEqual(['bsn_qa_1', 'bsn_qa_2', 'bsn_qa_3']);
    expect(file.tags.map(t => t.id)).toEqual(expect.arrayContaining(['tag_a', 'tag_b']));
    expect(file.deletedTags.map(d => d.id)).toContain('tag_gone');
    expect(file.streak).toEqual({ lastDay: '2026-11-09', streak: 4 });
    expect(memView(file.memoryVerses)).toEqual(memView(before.mem));
    expect(planChecks(file.readingPlan)).toEqual(planChecks(before.plan));
    expect(json).not.toContain('_tourDemo');
    const path = testInfo.outputPath('backup.json');
    fs.writeFileSync(path, json);

    // Wipe it all for this user. The login and the other user stay.
    await clearAllViaUi(page);
    const wiped = await snap(page);
    expect(wiped.studies).toEqual([]);
    expect(memView(wiped.mem)).toEqual([]);
    expect(planChecks(wiped.plan)).toEqual({});
    expect(wiped.other).toBe(OTHER_USER_VALUE);

    // Restore from the file: everything is back, byte-for-byte in the fields a backup covers.
    await importFile(page, path);
    const after = await snap(page);
    expect(studyView(after.studies)).toEqual(studyView(before.studies));
    expect((after.tags || []).map(t => t.id)).toEqual(expect.arrayContaining(['tag_a', 'tag_b']));
    expect(after.tagsDel.map(d => d.id)).toContain('tag_gone');
    expect(memView(after.mem)).toEqual(memView(before.mem));
    expect(planChecks(after.plan)).toEqual(planChecks(before.plan));
    expect(after.streak).toEqual(before.streak);
    expect(after.other).toBe(OTHER_USER_VALUE);
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });

  test('Clear All wipes everything it lists for this user only; Undo puts it all back', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);
    await seedMemoryAndPlan(page);
    const before = await snap(page);
    const userKeys = Object.keys(before.all);
    expect(userKeys.length).toBeGreaterThanOrEqual(10);

    await clearAllViaUi(page);
    const after = await snap(page);
    // A safety copy exists, nothing else this user stored is left holding its old content.
    expect(after.all['bsn_safety_snapshot' + U]).toBeTruthy();
    expect(after.studies).toEqual([]);
    expect(after.tagsDel).toEqual([]);
    expect(after.tags === null || after.tags.every(t => t.id !== 'tag_a' && t.id !== 'tag_b')).toBe(true);
    expect(memView(after.mem)).toEqual([]);
    expect(planChecks(after.plan)).toEqual({});
    expect(after.words === null || after.words.length === 0).toBe(true);
    expect(after.sett === null || after.sett.theme !== 'dark').toBe(true);
    for (const k of userKeys) {
      if (k === 'bsn_safety_snapshot' + U) continue;
      expect(after.all[k] === undefined || after.all[k] !== before.all[k], 'still holds its old content after Clear All: ' + k).toBe(true);
    }
    expect(after.other, 'another user must never be touched').toBe(OTHER_USER_VALUE);

    // Undo from Settings > Data & Storage (confirm auto-accepted); the page reloads.
    await page.click('#nav-settings');
    const undo = page.locator('#safety-copy-row button');
    await expect(undo).toContainText('Undo "Clear All Data"');
    await Promise.all([page.waitForEvent('load'), undo.evaluate(b => b.click())]);
    await ready(page);
    const undone = await snap(page);
    // The keys the safety copy covers come back exactly as they were.
    for (const k of ['studies', 'tags', 'tagsDel', 'words', 'mem', 'plan', 'sett']) {
      expect(undone.raw[k], 'not restored by Undo: ' + k).toBe(before.raw[k]);
    }
    expect(undone.streak).toEqual(before.streak);
    expect(undone.all['bsn_safety_snapshot' + U], 'the safety copy is used up by Undo').toBeUndefined();
    expect(undone.other).toBe(OTHER_USER_VALUE);
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });

  test('tombstones: a deleted tag and a deleted Memory verse stay deleted after restoring an older backup', async ({ browser, baseURL }, testInfo) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);
    await seedMemoryAndPlan(page);
    const before = await snap(page);
    const path = testInfo.outputPath('older-backup.json');
    fs.writeFileSync(path, await exportJson(page)); // the older backup still contains tag_a and both verses

    // Delete tag_a and the Romans verse the way a user does (confirm auto-accepted).
    await page.evaluate(() => { window.deleteTag('tag_a'); window.confirmDeleteTag(); });
    const romans = before.mem.items.find(i => i.reference === 'Romans 8:1');
    await page.evaluate(id => window.memDelete(id), romans.id);
    const mid = await snap(page);
    expect(mid.tags.map(t => t.id)).not.toContain('tag_a');
    expect(mid.tagsDel.map(d => d.id)).toContain('tag_a');
    expect(memView(mid.mem)).toEqual([['esv', 'The LORD is my shepherd; I shall not want.']]);

    await importFile(page, path);
    const after = await snap(page);
    expect(after.tags.map(t => t.id), 'deleted tag came back').not.toContain('tag_a');
    expect(after.tags.map(t => t.id)).toContain('tag_b');
    expect(after.tagsDel.map(d => d.id)).toContain('tag_a');
    expect(memView(after.mem), 'deleted verse came back').toEqual([['esv', 'The LORD is my shepherd; I shall not want.']]);
    expect(after.mem.deleted.map(d => d.id)).toContain(romans.id);
    // v4.63.5: the dead tag id is no longer left behind on the restored studies (it used to stay there, invisible),
    // and the dead tag must not show as a chip on its Library card, and the live tag must.
    for (const st of after.studies) expect(st.tags || [], 'dead tag id left on study ' + st.title).not.toContain('tag_a');
    expect(after.studies.some(st => (st.tags || []).includes('tag_b')), 'the live tag was stripped too').toBe(true);
    await page.click('#nav-library');
    const chips = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.studycard')].find(c => c.textContent.indexOf('Plain study') >= 0);
      return card && card.querySelector('.sc-tags') ? card.querySelector('.sc-tags').textContent : null;
    });
    expect(chips, 'the Plain study card has no tag chips at all').not.toBeNull();
    expect(chips).toContain('Beta');
    expect(chips, 'the deleted tag shows on the restored study card').not.toContain('Alpha');
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });

  test('Study Tour sample studies never reach a backup, and are never imported from an old one', async ({ browser, baseURL }, testInfo) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);

    // Walk the whole Study Tour. At every step take a real backup and check no sample is in it.
    await page.evaluate(() => window.startTour('study'));
    let sampleSeenInStorage = false, finished = false;
    for (let i = 0; i < 60 && !finished; i++) {
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bsn_studies_v2_qa-local') || '[]'));
      if (stored.some(s => s._tourDemo)) sampleSeenInStorage = true;
      const json = await exportJson(page);
      const file = JSON.parse(json);
      expect(file.studies.some(s => s._tourDemo || /^bsn_tourdemo_/.test(s.id)), 'tour sample in the backup at step ' + i).toBe(false);
      expect(file.studies.map(s => s.id), 'real studies must still be in the backup at step ' + i).toEqual(expect.arrayContaining(['bsn_qa_1', 'bsn_qa_2', 'bsn_qa_3']));
      finished = (await page.textContent('#tour-next-btn')) === 'Done'; // last step shows Done
      await page.evaluate(() => window.tourNext()); // on the last step this ends the tour and removes the samples
    }
    expect(finished, 'the tour never reached its last step').toBe(true);
    // Guard against a vacuous pass: the tour really did put sample studies into storage while it ran.
    expect(sampleSeenInStorage, 'the tour never stored a sample study, so this test proved nothing').toBe(true);
    const done = await snap(page);
    expect(done.studies.some(s => s._tourDemo), 'tour left a sample study behind').toBe(false);

    // The same filter is what Study Sync uses to build its payload.
    const stripped = await page.evaluate(() => window.stripAiResultsForBackup([
      { id: 'bsn_tourdemo_x', title: 'Sample', refs: [], _tourDemo: true },
      { id: 'real_1', title: 'Real', refs: [] }
    ]).map(s => s.id));
    expect(stripped).toEqual(['real_1']);

    // An old backup that already contains a sample study: only the real study is restored (object and legacy array formats).
    for (const [name, payload] of [
      ['object.json', { studies: [{ id: 'bsn_tourdemo_old', title: 'First-Time Study', refs: [], _tourDemo: true }, { id: 'real_old', title: 'Real old', refs: [] }], tags: [], deletedTags: [] }],
      ['array.json', [{ id: 'bsn_tourdemo_old2', title: 'First-Time Study', refs: [], _tourDemo: true }, { id: 'real_old2', title: 'Real old 2', refs: [] }]]
    ]) {
      const p = testInfo.outputPath(name);
      fs.writeFileSync(p, JSON.stringify(payload));
      await importFile(page, p);
    }
    const ids = (await snap(page)).studies.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['real_old', 'real_old2']));
    expect(ids.some(id => /tourdemo/.test(id)), 'a sample study was imported').toBe(false);
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });

  test('full device storage: a failed tag save and a failed study save show the red "Not saved" banner, and it clears once saves work', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);
    const before = await snap(page);

    // Fill localStorage until not even one more character fits.
    await page.evaluate(() => {
      let i = 0;
      for (let size = 500000; size >= 1; size = Math.floor(size / 2)) {
        for (;;) { try { localStorage.setItem('qa_fill_' + i, 'x'.repeat(size)); i++; } catch (e) { break; } }
      }
    });
    const banner = page.locator('#storage-full-banner');
    await expect(banner).toHaveCount(0);

    // 1. Create a tag while full.
    await page.evaluate(() => window.openNewTagModal());
    await page.fill('#tag-name-input', 'Quota tag');
    await page.evaluate(() => window.saveTag());
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Not saved');
    await expect(page.locator('#toast')).not.toContainText('Tag created');
    expect((await snap(page)).raw.tags).toBe(before.raw.tags); // storage still holds the old tag list, intact
    await page.click('#storage-full-banner button:has-text("Dismiss")');
    await expect(banner).toHaveCount(0);

    // 2. Save a study while full.
    await page.evaluate(() => window.createFromTemplate('blank'));
    await page.fill('#f-title', 'Study written while storage is full');
    await page.evaluate(() => window.saveStudy());
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Not saved');
    expect((await snap(page)).raw.studies).toBe(before.raw.studies); // the saved studies are untouched

    // 3. Free the space: the next save works and the banner goes away.
    await page.evaluate(() => { Object.keys(localStorage).filter(k => k.indexOf('qa_fill_') === 0).forEach(k => localStorage.removeItem(k)); });
    await page.evaluate(() => window.saveStudy());
    await expect(banner).toHaveCount(0);
    const saved = (await snap(page)).studies.map(s => s.title);
    expect(saved).toContain('Study written while storage is full');
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });

  // v4.63.5: dismissTabHints saved its "seen" flag with an unguarded setItem, so with full storage the first tab tap threw.
  test('full device storage: the first-run tab hints close and tab switching still works', async ({ browser, baseURL }) => {
    app = await openApp(browser, baseURL);
    const page = app.page;
    await seedStorage(page);
    await page.evaluate(() => localStorage.removeItem('bsn_tab_hints_shown_qa-local'));
    await page.reload();
    await ready(page);
    await expect(page.locator('nav.tab-hints-on'), 'the hints are not showing, so this test proves nothing').toHaveCount(1);
    await page.evaluate(() => {
      let i = 0;
      for (let size = 500000; size >= 1; size = Math.floor(size / 2)) {
        for (;;) { try { localStorage.setItem('qa_fill_' + i, 'x'.repeat(size)); i++; } catch (e) { break; } }
      }
    });
    await page.click('#nav-study');
    await expect(page.locator('#scr-study')).toHaveClass(/\bon\b/);
    await expect(page.locator('nav.tab-hints-on')).toHaveCount(0);
    await page.click('#nav-library');
    await expect(page.locator('#scr-library')).toHaveClass(/\bon\b/);
    expect(app.errors, 'uncaught errors:\n' + app.errors.join('\n')).toEqual([]);
  });
});
