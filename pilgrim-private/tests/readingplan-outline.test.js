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
  eq('54 groups', plan.groups.length, 54);   // v4.59.0: six Psalm blocks gone, three added (David cluster, 2 Samuel 24, anonymous cluster)
  eq('OT = 35 groups, Gospels = 10, Acts/letters = 9',
    [plan.parts.slice(0, 6).reduce((a, p) => a + p.groups.length, 0), plan.parts[6].groups.length, plan.parts[7].groups.length], [35, 10, 9]);
  eq('OT chapter items = 929', chItems.filter((i) => plan.parts.slice(0, 6).some((p) => p.id === i.partId)).length, 929);
  eq('non-Gospel NT items = 173', chItems.filter((i) => i.partId === 'p8').length, 173);

  // IDs unique, one group each, positions consistent
  const ids = plan.items.map((i) => i.id);
  eq('item ids unique', new Set(ids).size, ids.length);
  eq('group ids unique', new Set(plan.groups.map((g) => g.id)).size, plan.groups.length);
  eq('every item in exactly one group', plan.groups.reduce((a, g) => a + g.items.length, 0), plan.items.length);
  eq('index maps every id to its position', plan.items.every((it, i) => plan.index[it.id] === i), true);
  eq('no group over 60 items', plan.groups.filter((g) => g.items.length > 60).map((g) => g.id), []);   // 1 Samuel, 2 Samuel and Ezekiel pass 50 once Psalms sit inline
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

  // Each Psalm exactly once, Ps.1 to Ps.150
  const psItems = chItems.filter((c) => c.book === 'Ps');
  eq('150 Psalms once each', [psItems.length, new Set(psItems.map((p) => p.id)).size], [150, 150]);
  eq('Psalm ids are Ps.1 to Ps.150', psItems.map((p) => p.id).sort().join() === Array.from({ length: 150 }, (_, i) => 'Ps.' + (i + 1)).sort().join(), true);
  const david = psItems.filter((p) => p.author === 'David');
  eq('David’s 73 Psalms are all present', david.length, 73);
  eq('none of the old Psalm blocks remain', plan.groups.filter((g) => /^g\.(david-psalms-[123]|other-psalms)/.test(g.id)).length, 0);

  // All 89 Gospel chapters covered by at least one event passage
  const covered = new Set();
  evItems.forEach((e) => m.rpPassageChapters(e.passages).forEach((c) => covered.add(c.book + '.' + c.chapter)));
  const gosMissing = [];
  m.RP_BOOKS.forEach((b) => { if (GOSPELS.has(b[0])) for (let ch = 1; ch <= b[3]; ch++) if (!covered.has(b[0] + '.' + ch)) gosMissing.push(b[0] + '.' + ch); });
  eq('all 89 Gospel chapters covered by an event', gosMissing, []);
  eq('passage parser: verse list after colon stays in chapter', m.rpPassageChapters('Matthew 26:1-5, 14-16').map((c) => c.chapter), [26]);
  eq('passage parser: cross-chapter range', m.rpPassageChapters('Matthew 9:35-11:1').map((c) => c.chapter), [9, 10, 11]);
  eq('passage parser: whole chapters', m.rpPassageChapters('Matthew 5-7; Luke 6:17-49').map((c) => c.book + c.chapter), ['Matt5', 'Matt6', 'Matt7', 'Luke6']);

  // Chronicles: 65 items. Pure groups are flagged; the two groups that also hold Psalms (v4.59.0) are not, but their Chronicles items are
  const isChr = (i) => i.book === '1Chr' || i.book === '2Chr';
  eq('flagged Chronicles groups hold only Chronicles', plan.groups.filter((g) => g.chron).every((g) => g.items.every(isChr)), true);
  eq('only the two pure Chronicles groups are flagged', plan.groups.filter((g) => g.chron).map((g) => g.id), ['g.2-chronicles-1-9', 'g.2-chronicles-29-36']);
  eq('every Chronicles item is flagged, nothing else is', plan.items.every((i) => !!i.chron === isChr(i)), true);
  eq('Chronicles = 65 items', plan.items.filter((i) => i.chron).length, 65);
  eq('Chronicles sits right after the Samuel/Kings section it parallels',
    plan.groups.map((g) => g.id).filter((id, i, a) => /chronicles/.test(id)),
    ['g.1-chronicles', 'g.2-chronicles-1-9', 'g.2-chronicles-10-28', 'g.2-chronicles-29-36']);

  // Group sizes per spec 3b (Psalms woven in per spec-psalms-story-placement-v1.md, v4.59.0)
  const want = {
    'g.gen-1-11': 12, 'g.job': 42, 'g.gen-12-50': 39, 'g.exodus': 41, 'g.leviticus': 27, 'g.numbers': 36, 'g.deuteronomy': 35,
    'g.joshua': 24, 'g.judges-ruth': 25, 'g.1-samuel': 51, 'g.2-samuel': 51, 'g.david-psalms-undated': 28, 'g.2-samuel-24': 2,
    'g.1-chronicles': 35, 'g.1-kings-1-11': 18, 'g.2-chronicles-1-9': 9, 'g.proverbs': 31, 'g.eccl-song': 23,
    'g.kings-12-22-2k-1-17': 31, 'g.2-chronicles-10-28': 22, 'g.jonah-amos-hosea': 27, 'g.isaiah-1-33': 33, 'g.isaiah-34-66-micah': 40,
    'g.2-kings-18-25': 12, 'g.2-chronicles-29-36': 8, 'g.nahum-zephaniah': 6, 'g.jeremiah-1-26': 26, 'g.jeremiah-27-52': 26, 'g.lam-hab-obad': 13,
    'g.ezekiel': 52, 'g.daniel': 12, 'g.ezra-hag-zech': 40, 'g.esther-neh-mal': 33, 'g.anon-psalms': 16, 'g.joel': 3,
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

  // ── Psalm story placement (v4.59.0, spec-psalms-story-placement-v1.md) ──────────────────────
  const ps = plan.items.filter((i) => i.book === 'Ps');
  // every anchor passage exists, and the Psalms listed for it follow it directly, in order
  const badAnchors = [], badOrder = [];
  Object.keys(m.PS_AFTER).forEach((key) => {
    if (plan.index[key] === undefined) { badAnchors.push(key); return; }
    const want = m.PS_AFTER[key].map((r) => 'Ps.' + r[0]);
    const got = plan.items.slice(plan.index[key] + 1, plan.index[key] + 1 + want.length).map((i) => i.id);
    if (JSON.stringify(got) !== JSON.stringify(want)) badOrder.push(key);
  });
  eq('every Psalm anchor passage exists in the plan', badAnchors, []);
  eq('each anchor is followed directly by its Psalms in spec order', badOrder, []);
  eq('anchored plus cluster Psalms = 150', Object.values(m.PS_AFTER).reduce((a, l) => a + l.length, 0) + m.PS_CLUSTERS.david.rows.length + m.PS_CLUSTERS.anon.rows.length, 150);
  // spec counts by basis: A 14, B 9, C 25, C* 58, D 44
  const basis = {}; ps.forEach((p) => { basis[p.basis] = (basis[p.basis] || 0) + 1; });
  eq('placement basis counts match the spec', Object.fromEntries(Object.entries(basis).sort((a, b) => (a[0] < b[0] ? -1 : 1))), { A: 14, B: 9, C: 25, 'C*': 58, D: 44 });
  eq('every Psalm has an author', ps.every((p) => typeof p.author === 'string' && p.author.length > 0), true);
  // clusters: David’s 28 after 2 Samuel 23 (before 2 Samuel 24), anonymous 16 after Malachi 4 (before Joel)
  const dc = plan.groups.find((g) => g.id === 'g.david-psalms-undated'), ac = plan.groups.find((g) => g.id === 'g.anon-psalms');
  eq('David cluster = 28 Psalms, own group, sits between 2 Samuel 23 and 24', [dc.items.length, dc.items.every((i) => i.book === 'Ps'), plan.index['2Sam.23'] + 1 === plan.index[dc.items[0].id], plan.index[dc.items[27].id] + 1 === plan.index['2Sam.24']], [28, true, true, true]);
  eq('anonymous cluster = 16 Psalms, after Malachi 4, before Joel', [ac.items.length, plan.index['Mal.4'] + 1 === plan.index[ac.items[0].id], plan.index[ac.items[15].id] + 1 === plan.index['Joel.1']], [16, true, true]);
  eq('Psalms 10 and 33 are anonymous but sit in David’s cluster', ['Ps.10', 'Ps.33'].map((id) => dc.items.find((i) => i.id === id).author), ['Anonymous', 'Anonymous']);
  eq('cluster groups carry their default author for display', [dc.authorDefault, ac.authorDefault, dc.psalms, ac.psalms], ['David', 'Anonymous', true, true]);
  // spot checks across the plan (heading-named events, eras, and the moved Psalm 90)
  const px = (id) => plan.index[id];
  eq('Ps 104 after Genesis 2, before Genesis 3', px('Gen.2') + 1 === px('Ps.104') && px('Ps.104') + 1 === px('Gen.3'), true);
  eq('Ps 90 between Deuteronomy 33 and 34', px('Deut.33') + 1 === px('Ps.90') && px('Ps.90') + 1 === px('Deut.34'), true);
  eq('Ps 51 after 2 Samuel 12 (Nathan), Ps 3 after 2 Samuel 15 (Absalom)', px('2Sam.12') < px('Ps.51') && px('Ps.51') < px('2Sam.13') && px('2Sam.15') < px('Ps.3') && px('Ps.3') < px('2Sam.16'), true);
  eq('Ps 72 after 1 Kings 3 and Ps 127 after 1 Kings 6', px('1Kgs.3') + 1 === px('Ps.72') && px('1Kgs.6') + 1 === px('Ps.127'), true);
  eq('Ps 89 with the exile laments (after Lamentations 5)', px('Lam.5') < px('Ps.89') && px('Ps.89') < px('Hab.1'), true);
  eq('Ps 150 closes the Nehemiah 12 Hallel, before Nehemiah 13', px('Ps.149') + 1 === px('Ps.150') && px('Ps.150') + 1 === px('Neh.13'), true);
  eq('Psalm chips in mixed groups read “Ps N”, cluster chips read “N”', [plan.items.find((i) => i.id === 'Ps.104').short, dc.items[0].short], ['Ps 104', '5']);

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
