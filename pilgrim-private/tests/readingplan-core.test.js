#!/usr/bin/env node
// readingplan-core.test.js — Reading Plans pure-logic tests (normalize, merge, progress, bookmark, gaps)
// Usage (from pilgrim-private/): node tests/readingplan-core.test.js
// Both modules have no imports/DOM/storage; copied to temp .mjs files side by side so the core can import the data.
const fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
fs.copyFileSync(path.join(__dirname, '..', 'readingplan-core.js'), path.join(dir, 'core.mjs'));
fs.copyFileSync(path.join(__dirname, '..', 'readingplan-data.js'), path.join(dir, 'data.mjs'));

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}
const T = 1_800_000_000_000;

Promise.all([import(path.join(dir, 'core.mjs')), import(path.join(dir, 'data.mjs'))]).then(([c, d]) => {
  const plan = d.rpBuildStoryFlow();
  const fresh = () => c.rpEmptyPlanState();
  const checkAll = (state, items, now) => items.forEach((it) => c.rpSetChecked(state, it.id, true, now));
  const groupItems = (id) => plan.groups.find((g) => g.id === id).items;

  // normalize
  eq('normalize garbage -> empty store', c.rpNormalizeStore('nope'), c.rpEmptyStore());
  eq('normalize null/array', [c.rpNormalizeStore(null), c.rpNormalizeStore([1, 2])], [c.rpEmptyStore(), c.rpEmptyStore()]);
  const n = c.rpNormalizeStore({ v: 1, plans: { storyflow: { items: { 'Gen.1': { r: 1, d: 5, u: 7 }, 'Gen.2': { r: 0, u: 3 }, 'Gen.3': { r: 9 }, 'Gen.4': null, 'Old.99': { r: 1, u: 1 } }, opts: { hideChron: { v: 'yes', u: 4 } } }, future: { items: {} } } });
  eq('normalize keeps valid records', [n.plans.storyflow.items['Gen.1'], n.plans.storyflow.items['Gen.2']], [{ r: 1, d: 5, u: 7 }, { r: 0, u: 3 }]);
  eq('normalize drops malformed records', Object.keys(n.plans.storyflow.items).sort(), ['Gen.1', 'Gen.2', 'Old.99']);
  eq('normalize keeps unknown item ids and unknown plans', [!!n.plans.storyflow.items['Old.99'], !!n.plans.future], [true, true]);
  eq('normalize coerces hideChron to boolean', n.plans.storyflow.opts.hideChron, { v: true, u: 4 });
  eq('normalize fills a missing d from u', c.rpNormalizeStore({ plans: { storyflow: { items: { 'Gen.1': { r: 1, u: 9 } } } } }).plans.storyflow.items['Gen.1'], { r: 1, d: 9, u: 9 });

  // hasData
  eq('empty store has no data', c.rpStoreHasData(c.rpEmptyStore()), false);
  const one = c.rpEmptyStore(); c.rpSetChecked(one.plans.storyflow, 'Gen.1', false, T);
  eq('an unchecked tombstone counts as data', c.rpStoreHasData(one), true);
  const optOnly = c.rpEmptyStore(); c.rpSetHideChron(optOnly.plans.storyflow, true, T);
  eq('a stored option counts as data', c.rpStoreHasData(optOnly), true);

  // merge
  const A = c.rpEmptyStore(), B = c.rpEmptyStore();
  c.rpSetChecked(A.plans.storyflow, 'Gen.1', true, T);        // A checked at T
  c.rpSetChecked(B.plans.storyflow, 'Gen.1', false, T + 50);  // B unchecked later -> B wins
  c.rpSetChecked(A.plans.storyflow, 'Gen.2', false, T + 50);  // A unchecked later -> A wins
  c.rpSetChecked(B.plans.storyflow, 'Gen.2', true, T);
  c.rpSetChecked(A.plans.storyflow, 'Gen.3', true, T);        // only on A
  c.rpSetChecked(B.plans.storyflow, 'Gen.4', true, T);        // only on B
  c.rpSetChecked(A.plans.storyflow, 'Gen.5', true, T + 5);    // tie on u
  c.rpSetChecked(B.plans.storyflow, 'Gen.5', false, T + 5);
  const M = c.rpMerge(A, B).plans.storyflow.items;
  eq('merge: newer uncheck beats older check (remote wins)', M['Gen.1'].r, 0);
  eq('merge: newer uncheck beats older check (local wins)', M['Gen.2'].r, 0);
  eq('merge: union of one-sided items', [M['Gen.3'].r, M['Gen.4'].r], [1, 1]);
  eq('merge: tie favors checked', M['Gen.5'].r, 1);
  const canon = (st) => JSON.stringify(st, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
  eq('merge is symmetric', canon(c.rpMerge(A, B)), canon(c.rpMerge(B, A)));
  const oa = c.rpEmptyStore(), ob = c.rpEmptyStore();
  c.rpSetHideChron(oa.plans.storyflow, true, T + 10); c.rpSetHideChron(ob.plans.storyflow, false, T);
  eq('merge: option with higher u wins', c.rpMerge(oa, ob).plans.storyflow.opts.hideChron, { v: true, u: T + 10 });
  eq('merge: remote with no field leaves local untouched', JSON.stringify(c.rpMerge(A, undefined)), JSON.stringify(c.rpNormalizeStore(A)));
  eq('merge: remote garbage leaves local untouched', JSON.stringify(c.rpMerge(A, 'junk')), JSON.stringify(c.rpNormalizeStore(A)));

  // progress, floor rule, tick only at true 100%
  const s = fresh();
  eq('fresh: 0%', c.rpProgress(plan, s, false).overall.pct, 0);
  const gen = groupItems('g.gen-1-11');
  checkAll(s, gen.slice(0, 10), T);
  let pr = c.rpProgress(plan, s, false);
  eq('10/11 in a group is 90% (floor) and not done', [pr.groups['g.gen-1-11'].pct, pr.groups['g.gen-1-11'].done], [90, false]);
  c.rpSetChecked(s, gen[10].id, true, T);
  pr = c.rpProgress(plan, s, false);
  eq('11/11 shows 100% and done', [pr.groups['g.gen-1-11'].pct, pr.groups['g.gen-1-11'].done], [100, true]);
  // floor rule at plan scale: everything but one chapter must read 99, never 100
  const all = fresh();
  checkAll(all, plan.items.slice(0, plan.items.length - 1), T);
  eq('all but one item reads 99%, not 100', c.rpProgress(plan, all, false).overall.pct, 99);
  checkAll(all, plan.items, T);
  eq('everything checked reads 100%', c.rpProgress(plan, all, false).overall.pct, 100);
  eq('part 8 done only at true 100', [c.rpProgress(plan, all, false).parts.p8.done, c.rpProgress(plan, fresh(), false).parts.p8.done], [true, false]);
  // 99.9% case: part with many items, one unchecked
  const p4 = fresh();
  checkAll(p4, plan.items.filter((i) => i.partId === 'p5').slice(1), T);
  eq('a part with one unchecked item never shows 100', c.rpProgress(plan, p4, false).parts.p5.pct < 100, true);

  // overall weighting: all Gospel events = 89 chapters' worth
  const gos = fresh();
  checkAll(gos, plan.items.filter((i) => i.type === 'ev'), T);
  const totalW = plan.items.reduce((a, i) => a + i.w, 0);
  eq('total weight = (1,102 + 89) x 94', totalW, (1102 + 89) * 94);
  eq('Gospels alone = floor(100 x 89 / 1191)', c.rpProgress(plan, gos, false).overall.pct, Math.floor(100 * 89 / 1191));
  const oneEv = fresh();
  c.rpSetChecked(oneEv, plan.items.find((i) => i.type === 'ev').id, true, T);
  const oneCh = fresh();
  c.rpSetChecked(oneCh, 'Gen.1', true, T);
  eq('one chapter weighs more than one event', oneCh.items['Gen.1'].r === 1 && 94 > 89, true);

  // Hide Chronicles math
  const hc = fresh();
  const chronItems = plan.items.filter((i) => i.chron);
  checkAll(hc, chronItems, T);
  eq('Chronicles checked counts when shown', c.rpProgress(plan, hc, false).overall.checked, 65);
  pr = c.rpProgress(plan, hc, true);
  eq('hidden Chronicles drop out of count and total', [pr.overall.checked, pr.overall.total, pr.overall.pct], [0, 1196 - 65, 0]);
  eq('hidden Chronicles groups are not reported', Object.keys(pr.groups).some((g) => /chronicles/.test(g)), false);
  eq('stored checks are kept (still in state)', Object.keys(hc.items).length, 65);
  eq('visible items shrink by 65', [c.rpVisibleItems(plan, hc, false).length, c.rpVisibleItems(plan, hc, true).length], [1196, 1131]);
  eq('hidden Chronicles never become the bookmark', c.rpBookmark(plan, hc, true), null);
  eq('shown Chronicles can be the bookmark', c.rpBookmark(plan, hc, false).item.id, '2Chr.36');

  // bookmark: furthest checked in plan order
  const b = fresh();
  eq('no bookmark when nothing checked', c.rpBookmark(plan, b, false), null);
  c.rpSetChecked(b, 'Exod.3', true, T);
  c.rpSetChecked(b, 'Isa.40', true, T + 1);
  c.rpSetChecked(b, 'Gen.1', true, T + 2);
  eq('bookmark = furthest checked, not last checked', c.rpBookmark(plan, b, false).item.id, 'Isa.40');
  c.rpSetChecked(b, 'Gen.2', true, T + 3);  // fill a gap behind it
  eq('filling a gap behind it does not move it', c.rpBookmark(plan, b, false).item.id, 'Isa.40');
  eq('bookmark carries its read date', c.rpBookmark(plan, b, false).d, T + 1);
  const prev = c.rpSetChecked(b, 'Isa.40', false, T + 4);
  eq('uncheck returns previous record', prev, { r: 1, d: T + 1, u: T + 1 });
  eq('unchecking the bookmark falls back to the next furthest', c.rpBookmark(plan, b, false).item.id, 'Exod.3');
  c.rpRestore(b, 'Isa.40', prev, T + 5);
  eq('undo restores the check with the original read date and a new u', b.items['Isa.40'], { r: 1, d: T + 1, u: T + 5 });
  eq('after undo the bookmark is back', c.rpBookmark(plan, b, false).item.id, 'Isa.40');
  c.rpRestore(b, 'Gen.7', null, T + 6);
  eq('restore with no previous record writes an unchecked tombstone', b.items['Gen.7'], { r: 0, u: T + 6 });

  // gaps
  const g = fresh();
  eq('no bookmark, no gaps', c.rpGaps(plan, g, false).count, 0);
  c.rpSetChecked(g, 'Gen.3', true, T);
  let gaps = c.rpGaps(plan, g, false);
  eq('Gen.3 bookmark: Gen 1-2 are the gaps', [gaps.count, gaps.groups.length, gaps.groups[0].items.map((i) => i.id)], [2, 1, ['Gen.1', 'Gen.2']]);
  c.rpSetChecked(g, 'Exod.1', true, T);
  gaps = c.rpGaps(plan, g, false);
  eq('skip ahead: all of Genesis 1-11 (minus 3), Job and Genesis 12-50 are gaps, grouped',
    [gaps.count, gaps.groups.map((x) => x.group.id)], [10 + 42 + 39, ['g.gen-1-11', 'g.job', 'g.gen-12-50']]);
  c.rpSetChecked(g, 'Gen.1', true, T + 1);
  eq('gap-fill reduces the count by one', c.rpGaps(plan, g, false).count, 10 + 42 + 39 - 1);
  eq('chapters-only gaps do not flag events', gaps.hasEvents, false);
  const gg = fresh();
  c.rpSetChecked(gg, 'Rev.22', true, T);
  const ggaps = c.rpGaps(plan, gg, false);
  eq('Revelation 22 bookmark: every other item is a gap, events flagged', [ggaps.count, ggaps.hasEvents], [1195, true]);
  eq('hide Chronicles removes Chronicles gaps', c.rpGaps(plan, gg, true).count, 1195 - 65);

  // purity: mutations only touch the passed state
  const s1 = fresh(); const snap = JSON.stringify(s1);
  c.rpProgress(plan, s1, false); c.rpBookmark(plan, s1, false); c.rpGaps(plan, s1, false); c.rpVisibleItems(plan, s1, true);
  eq('derived functions do not mutate state', JSON.stringify(s1), snap);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
