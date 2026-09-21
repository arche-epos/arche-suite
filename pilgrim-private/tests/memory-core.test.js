#!/usr/bin/env node
// memory-core.test.js — Scripture Memory pure-logic tests (merge, tombstones, dedupe, reference building)
// Usage (from pilgrim-private/): node tests/memory-core.test.js
// memory-core.js has no imports/DOM/storage, so no browser is needed. The package has no "type":"module",
// so the source is copied to a temp .mjs and imported from there.
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = path.join(os.tmpdir(), 'memory-core-' + process.pid + '.mjs');
fs.copyFileSync(path.join(__dirname, '..', 'memory-core.js'), tmp);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}
const T = 1_800_000_000_000; // fixed "now"
const iso = (ms) => new Date(ms).toISOString();
const item = (id, ref, upd, extra) => Object.assign({ id, reference: ref, translation: 'esv', text: 'text ' + id, source: 'manual', createdAt: upd, updatedAt: upd }, extra || {});
const ids = (s) => s.items.map((i) => i.id).sort();

import(tmp).then((m) => {
  // normalize
  const n = m.memNormalizeStore({ items: [item('a', 'John 3:16', 'x'), { id: 'bad' }, null, item('c', '  ', 'x')], deleted: [{ id: 'd', at: 'y' }, {}] });
  eq('normalize drops malformed items', ids(n), ['a']);
  eq('normalize keeps valid tombstone only', n.deleted, [{ id: 'd', at: 'y' }]);
  eq('normalize fills Stage 2 defaults', [n.items[0].interval, n.items[0].easeFactor, n.items[0].nextReviewDate, n.items[0].reviewHistory], [0, 2.5, null, []]);
  eq('normalize keeps unknown future fields', m.memNormalizeStore({ items: [item('a', 'R 1:1', 'x', { futureField: 7 })] }).items[0].futureField, 7);
  eq('normalize garbage', m.memNormalizeStore('nope'), { items: [], deleted: [] });

  // merge: union
  let r = m.memMerge({ items: [item('a', 'John 3:16', iso(T - 5))] }, { items: [item('b', 'Rom 8:1', iso(T - 4))] }, T);
  eq('union of distinct ids', ids(r), ['a', 'b']);

  // merge: same id, newer wins; tie keeps local
  r = m.memMerge({ items: [item('a', 'John 3:16', iso(T - 5), { text: 'LOCAL' })] }, { items: [item('a', 'John 3:16', iso(T - 1), { text: 'REMOTE' })] }, T);
  eq('newer updatedAt wins', r.items[0].text, 'REMOTE');
  r = m.memMerge({ items: [item('a', 'John 3:16', iso(T - 5), { text: 'LOCAL' })] }, { items: [item('a', 'John 3:16', iso(T - 5), { text: 'REMOTE' })] }, T);
  eq('tie keeps local', r.items[0].text, 'LOCAL');

  // tombstones
  r = m.memMerge({ items: [item('a', 'John 3:16', iso(T - 5))] }, { items: [], deleted: [{ id: 'a', at: iso(T - 2) }] }, T);
  eq('remote tombstone removes local item', [ids(r), r.deleted.map((d) => d.id)], [[], ['a']]);
  r = m.memMerge({ items: [], deleted: [{ id: 'a', at: iso(T - 2) }] }, { items: [item('a', 'John 3:16', iso(T - 5))] }, T);
  eq('local tombstone blocks remote re-import', ids(r), []);
  r = m.memMerge({ deleted: [{ id: 'a', at: iso(T - 9) }] }, { deleted: [{ id: 'a', at: iso(T - 2) }] }, T);
  eq('tombstone union keeps latest at', r.deleted, [{ id: 'a', at: iso(T - 2) }]);
  r = m.memMerge({ deleted: [{ id: 'old', at: iso(T - m.TOMBSTONE_TTL_MS - 1000) }, { id: 'new', at: iso(T - 1000) }] }, {}, T);
  eq('stale tombstones pruned, fresh kept', r.deleted.map((d) => d.id), ['new']);

  // dedupe across devices (same verse, different ids)
  r = m.memMerge({ items: [item('z', 'John 3:16', iso(T - 5))] }, { items: [item('a', ' john  3:16 ', iso(T - 9))] }, T);
  eq('duplicate collapses to earliest-created', ids(r), ['a']);
  eq('duplicate loser gets tombstone', r.deleted.map((d) => d.id), ['z']);
  r = m.memMerge({ items: [item('z', 'John 3:16', iso(T - 9), { reviewHistory: [1, 2] })] }, { items: [item('a', 'John 3:16', iso(T - 20))] }, T);
  eq('duplicate keeps the one with review history', ids(r), ['z']);
  r = m.memMerge({ items: [item('a', 'John 3:16', iso(T - 9))] }, { items: [{ ...item('b', 'John 3:16', iso(T - 8)), translation: 'kjv' }] }, T);
  eq('same ref, different translation is NOT a duplicate', ids(r), ['a', 'b']);

  // purity
  const A = { items: [item('a', 'John 3:16', iso(T - 5))], deleted: [] }, snap = JSON.stringify(A);
  m.memMerge(A, { items: [item('b', 'Rom 8:1', iso(T))] }, T);
  eq('merge does not mutate inputs', JSON.stringify(A), snap);

  // memMakeItem
  const mi = m.memMakeItem({ reference: ' John 3:16 ', translation: 'esv', text: ' For God ', source: 'read' }, 'id1', iso(T));
  eq('makeItem trims + inert Stage 2 fields', [mi.reference, mi.text, mi.interval, mi.nextReviewDate, mi.reviewHistory], ['John 3:16', 'For God', 0, null, []]);

  // memBuildVerseRef
  const V = (nums) => nums.map((n) => ({ num: String(n), text: 't' }));
  eq('ref: chapter load', m.memBuildVerseRef('John 3', V([1, 2, 3, 16]), 3), 'John 3:16');
  eq('ref: same-chapter range', m.memBuildVerseRef('Romans 8:28-30', V([28, 29, 30]), 1), 'Romans 8:29');
  eq('ref: cross-chapter range, before boundary', m.memBuildVerseRef('John 3:35-4:2', V([35, 36, 1, 2]), 1), 'John 3:36');
  eq('ref: cross-chapter range, after boundary', m.memBuildVerseRef('John 3:35-4:2', V([35, 36, 1, 2]), 2), 'John 4:1');
  eq('ref: numbered book', m.memBuildVerseRef('1 John 3', V([1, 2, 3]), 2), '1 John 3:3');
  eq('ref: multi-word book', m.memBuildVerseRef('Song of Solomon 2', V([1, 2]), 1), 'Song of Solomon 2:2');
  eq('ref: multi-passage falls back', m.memBuildVerseRef('John 3:16; Rom 8:1', V([16, 1]), 1), 'John 3:16; Rom 8:1 v.1');
  eq('ref: bad idx returns ref', m.memBuildVerseRef('John 3', V([1]), 5), 'John 3');

  fs.unlinkSync(tmp);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
