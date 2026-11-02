#!/usr/bin/env node
// readingplan-outline.test.js — Story Flow outline integrity (spec-reading-plans-v1.md §9)
// Usage (from pilgrim-private/): node tests/readingplan-outline.test.js
// readingplan-data.js has no imports/DOM/storage; copied to a temp .mjs and imported (package has no "type":"module").
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = path.join(os.tmpdir(), 'readingplan-data-' + process.pid + '.mjs');
fs.copyFileSync(path.join(__dirname, '..', 'readingplan-data.js'), tmp);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}

import(tmp).then((m) => {
  const plan = m.rpBuildStoryFlow();
  const chItems = plan.items.filter((i) => i.type === 'ch');
  const evItems = plan.items.filter((i) => i.type === 'ev');

  // Totals
  eq('chapter items = 1,102', chItems.length, 1102);
  eq('Gospel events = 94', evItems.length, 94);
  eq('all items = 1,196', plan.items.length, 1196);
  eq('8 parts', plan.parts.length, 8);
  eq('57 groups', plan.groups.length, 57);
  eq('OT = 38 groups, Gospels = 10, Acts/letters = 9',
    [plan.parts.slice(0, 6).reduce((a, p) => a + p.groups.length, 0), plan.parts[6].groups.length, plan.parts[7].groups.length], [38, 10, 9]);
  eq('OT chapter items = 929', chItems.filter((i) => plan.parts.slice(0, 6).some((p) => p.id === i.partId)).length, 929);
  eq('non-Gospel NT items = 173', chItems.filter((i) => i.partId === 'p8').length, 173);

  // IDs unique, one group each, positions consistent
  const ids = plan.items.map((i) => i.id);
  eq('item ids unique', new Set(ids).size, ids.length);
  eq('group ids unique', new Set(plan.groups.map((g) => g.id)).size, plan.groups.length);
  eq('every item in exactly one group', plan.groups.reduce((a, g) => a + g.items.length, 0), plan.items.length);
  eq('index maps every id to its position', plan.items.every((it, i) => plan.index[it.id] === i), true);
  eq('no group over 50 items', plan.groups.filter((g) => g.items.length > 50).map((g) => g.id), []);
  eq('event ids start with ev. and are safe slugs', evItems.every((e) => /^ev\.[a-z0-9-]+$/.test(e.id)), true);
  eq('chapter ids look like Book.N', chItems.every((c) => /^[0-9A-Za-z]+\.[0-9]+[ab]?$/.test(c.id)), true);

  // Every OT / non-Gospel NT chapter exactly once (4 Acts split items stand in for Acts 18 and 20)
  const GOSPELS = new Set(['Matt', 'Mark', 'Luke', 'John']);
  const present = {};
  chItems.forEach((c) => { present[c.id] = (present[c.id] || 0) + 1; });
  const missing = [], dup = [];
  m.RP_BOOKS.forEach((b) => {
    if (GOSPELS.has(b[0])) return;
    for (let ch = 1; ch <= b[3]; ch++) {
      const split = b[0] === 'Acts' && (ch === 18 || ch === 20);
      if (split) {
        const parts = ch === 18 ? ['Acts.18a', 'Acts.18b'] : ['Acts.20a', 'Acts.20b'];
        parts.forEach((id) => { if (present[id] !== 1) missing.push(id); });
        if (present['Acts.' + ch]) dup.push('Acts.' + ch + ' (whole)');
      } else {
        const id = b[0] + '.' + ch;
        if (present[id] !== 1) (present[id] ? dup : missing).push(id);
      }
    }
  });
  eq('no missing chapters', missing, []);
  eq('no double-read chapters', dup, []);
  eq('no Gospel chapter items (events cover them)', chItems.filter((c) => GOSPELS.has(c.book)).length, 0);

  // Each Psalm exactly once: 73 David + 77 other = 150
  const psItems = chItems.filter((c) => c.book === 'Ps');
  eq('150 Psalms once each', [psItems.length, new Set(psItems.map((p) => p.id)).size], [150, 150]);
  const david = plan.groups.filter((g) => /^g\.david-psalms/.test(g.id)).reduce((a, g) => a + g.items.length, 0);
  eq('David’s Psalms = 73', david, 73);

  // All 89 Gospel chapters covered by at least one event passage
  const covered = new Set();
  evItems.forEach((e) => m.rpPassageChapters(e.passages).forEach((c) => covered.add(c.book + '.' + c.chapter)));
  const gosMissing = [];
  m.RP_BOOKS.forEach((b) => { if (GOSPELS.has(b[0])) for (let ch = 1; ch <= b[3]; ch++) if (!covered.has(b[0] + '.' + ch)) gosMissing.push(b[0] + '.' + ch); });
  eq('all 89 Gospel chapters covered by an event', gosMissing, []);
  eq('passage parser: verse list after colon stays in chapter', m.rpPassageChapters('Matthew 26:1-5, 14-16').map((c) => c.chapter), [26]);
  eq('passage parser: cross-chapter range', m.rpPassageChapters('Matthew 9:35-11:1').map((c) => c.chapter), [9, 10, 11]);
  eq('passage parser: whole chapters', m.rpPassageChapters('Matthew 5-7; Luke 6:17-49').map((c) => c.book + c.chapter), ['Matt5', 'Matt6', 'Matt7', 'Luke6']);

  // Chronicles groups are pure; Chronicles total 65
  eq('Chronicles groups hold only Chronicles', plan.groups.filter((g) => g.chron).every((g) => g.items.every((i) => i.book === '1Chr' || i.book === '2Chr')), true);
  eq('only Chronicles groups are flagged', plan.groups.filter((g) => !g.chron).every((g) => g.items.every((i) => i.book !== '1Chr' && i.book !== '2Chr')), true);
  eq('Chronicles = 65 items', plan.items.filter((i) => i.chron).length, 65);
  eq('Chronicles sits right after the Samuel/Kings section it parallels',
    plan.groups.map((g) => g.id).filter((id, i, a) => /chronicles/.test(id)),
    ['g.1-chronicles', 'g.2-chronicles-1-9', 'g.2-chronicles-10-28', 'g.2-chronicles-29-36']);

  // Group sizes per spec 3b
  const want = {
    'g.gen-1-11': 11, 'g.job': 42, 'g.gen-12-50': 39, 'g.exodus': 40, 'g.leviticus': 27, 'g.numbers': 36, 'g.deuteronomy': 35,
    'g.joshua': 24, 'g.judges-ruth': 25, 'g.1-samuel': 31, 'g.2-samuel': 24, 'g.david-psalms-1': 25, 'g.david-psalms-2': 24, 'g.david-psalms-3': 24,
    'g.1-chronicles': 29, 'g.1-kings-1-11': 13, 'g.2-chronicles-1-9': 9, 'g.proverbs': 31, 'g.eccl-song': 20,
    'g.kings-12-22-2k-1-17': 28, 'g.2-chronicles-10-28': 19, 'g.jonah-amos-hosea': 27, 'g.isaiah-1-33': 33, 'g.isaiah-34-66-micah': 40,
    'g.2-kings-18-25': 8, 'g.2-chronicles-29-36': 8, 'g.nahum-zephaniah': 6, 'g.jeremiah-1-26': 26, 'g.jeremiah-27-52': 26, 'g.lam-hab-obad': 9,
    'g.ezekiel': 48, 'g.daniel': 12, 'g.ezra-hag-zech': 26, 'g.esther-neh-mal': 27, 'g.other-psalms-1': 25, 'g.other-psalms-2': 25, 'g.other-psalms-3': 24, 'g.joel': 3,
    'g.gos-a': 12, 'g.gos-b': 4, 'g.gos-c': 7, 'g.gos-d': 12, 'g.gos-e': 1, 'g.gos-f': 22, 'g.gos-g': 6, 'g.gos-h': 7, 'g.gos-i': 16, 'g.gos-j': 7,
    'g.acts-1-12': 12, 'g.acts-13-14-gal-jas': 13, 'g.acts-15-18a-thess': 12, 'g.acts-18b-19-1cor': 18, 'g.acts-20a-2cor-rom': 30,
    'g.acts-20b-28-prison': 24, 'g.pastoral': 13, 'g.general-letters': 29, 'g.revelation': 22
  };
  const got = {};
  plan.groups.forEach((g) => { got[g.id] = g.items.length; });
  eq('group sizes match spec 3b', got, want);
  eq('Gospel F has six sub-headings',
    [...new Set(plan.groups.find((g) => g.id === 'g.gos-f').items.map((i) => i.sub))],
    ['Healing and authority', 'Opposition', 'Parables of the kingdom', 'Nature and demons', 'Raising and healing', 'Mission']);
  eq('later-manuscripts notes on the two events', evItems.filter((e) => e.note && /earliest manuscripts/.test(e.note)).map((e) => e.id), ['ev.feast-of-tabernacles', 'ev.the-ascension']);

  // Weights: Part 7 = 89 chapters worth, whole plan integer-exact
  const w7 = evItems.reduce((a, e) => a + e.w, 0);
  eq('Part 7 weighs 89 chapters (events x 89 = 89 x 94)', w7, 89 * m.RP_W_CH);

  // Author-tied psalms sit with their period (v4.58.5): Moses after Deuteronomy, Solomon after 1 Kings 1-11
  const ps = plan.items.filter((i) => i.book === 'Ps');
  eq('all 150 Psalms still once each after the moves', [ps.length, new Set(ps.map((p) => p.id)).size], [150, 150]);
  eq('Ps 90 right after Deuteronomy 34, before Joshua', plan.index['Deut.34'] + 1 === plan.index['Ps.90'] && plan.index['Ps.90'] < plan.index['Josh.1'], true);
  eq('Ps 72 and 127 follow 1 Kings 11, before Proverbs', plan.index['1Kgs.11'] < plan.index['Ps.72'] && plan.index['Ps.127'] < plan.index['Prov.1'], true);
  eq('moved psalms are not in the Other Psalms groups', plan.groups.filter((g) => /^g\.other-psalms/.test(g.id)).every((g) => g.items.every((i) => !['Ps.72', 'Ps.90', 'Ps.127'].includes(i.id))), true);

  // Order spot checks
  const pos = (id) => plan.index[id];
  eq('Job sits between Genesis 11 and Genesis 12', pos('Gen.11') < pos('Job.1') && pos('Job.42') < pos('Gen.12'), true);
  eq('Joel is the last Old Testament item', plan.items.filter((i) => i.partId === 'p6').pop().id, 'Joel.3');
  eq('Galatians then James before Acts 15', pos('Gal.6') < pos('Jas.1') && pos('Jas.5') < pos('Acts.15'), true);
  eq('Acts 18 split brackets 1 Thessalonians / 1 Corinthians', pos('2Thess.3') < pos('Acts.18b') && pos('Acts.18a') < pos('1Thess.1') && pos('Acts.19') < pos('1Cor.1'), true);

  fs.unlinkSync(tmp);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
