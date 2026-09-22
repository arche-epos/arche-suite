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

  // memRangeLabel
  eq('label: same chapter range', m.memRangeLabel('Romans 8:28', 'Romans 8:30'), 'Romans 8:28-30');
  eq('label: single verse', m.memRangeLabel('John 3:16', 'John 3:16'), 'John 3:16');
  eq('label: cross-chapter', m.memRangeLabel('John 3:35', 'John 4:2'), 'John 3:35 - John 4:2');
  eq('label: cross-book', m.memRangeLabel('Malachi 4:6', 'Matthew 1:1'), 'Malachi 4:6 - Matthew 1:1');
  eq('label: numbered book range', m.memRangeLabel('1 John 3:1', '1 John 3:3'), '1 John 3:1-3');
  eq('label: unparseable falls back', m.memRangeLabel('Psalm 23', 'Psalm 24'), 'Psalm 23 - Psalm 24');

  // memJoinVerses
  const JV = [{ num: '16', text: 'For God so loved\n\nthe world' }, { num: '17', text: '  For God did not send  ' }];
  eq('join: multi-verse keeps [n]', m.memJoinVerses(JV), '[16] For God so loved the world [17] For God did not send');
  eq('join: single verse is plain', m.memJoinVerses([JV[0]]), 'For God so loved the world');
  eq('join: empty', m.memJoinVerses([]), '');

  // ── Stage 2 ──────────────────────────────────────────────────────────────

  // memParseVerseTexts / memMakeChunks — splitting
  eq('parse: no markers = single verse, num null', m.memParseVerseTexts('For God so loved the world'),
    [{ num: null, text: 'For God so loved the world' }]);
  eq('parse: markers split cleanly', m.memParseVerseTexts('[16] For God [17] so loved'),
    [{ num: '16', text: 'For God' }, { num: '17', text: 'so loved' }]);
  eq('chunks: single verse = exactly 1 chunk regardless of size', m.memMakeChunks('For God so loved', 'x', 4).length, 1);
  eq('chunks: single verse chunk has null verseStart/End', [m.memMakeChunks('For God', 'x')[0].verseStart, m.memMakeChunks('For God', 'x')[0].verseEnd], [null, null]);
  const bigText = '[1] a [2] b [3] c [4] d [5] e [6] f [7] g [8] h [9] i';
  const bigChunks = m.memMakeChunks(bigText, 'item1', 4);
  eq('chunks: 9 verses at size 4 = 3 chunks (4/4/1)', bigChunks.map((c) => [c.verseStart, c.verseEnd]), [[1, 4], [5, 8], [9, 9]]);
  eq('chunks: chunkIds are stable and sequential', bigChunks.map((c) => c.chunkId), ['item1-c0', 'item1-c1', 'item1-c2']);
  eq('chunks: fresh chunk defaults', [bigChunks[0].level, bigChunks[0].interval, bigChunks[0].holdCount, bigChunks[0].nextReviewDate], [0, 0, 0, null]);
  eq('chunks: empty text = no chunks', m.memMakeChunks('', 'x'), []);

  // memMakeItem builds chunks immediately
  const mi2 = m.memMakeItem({ reference: 'John 3:16-17', translation: 'esv', text: '[16] For God [17] so loved', source: 'read' }, 'id2', iso(T));
  eq('makeItem builds chunks', mi2.chunks.map((c) => c.chunkId), ['id2-c0']);

  // normalize: migration for a Stage 1 item with no chunks — single verse seeds from flat fields
  let migrated = m.memNormalizeStore({ items: [Object.assign(item('a', 'John 3:16', iso(T)), { interval: 3, level: 2, reviewHistory: [{ at: 'x' }] })] });
  eq('migration: single-chunk item seeds level/interval/history from flat fields', [migrated.items[0].chunks[0].level, migrated.items[0].chunks[0].interval, migrated.items[0].chunks[0].reviewHistory.length], [2, 3, 1]);
  // migration for a multi-verse item with no chunks (needs >MEM_CHUNK_SIZE verses to force >1 chunk) — fresh defaults, not seeded
  let migratedMulti = m.memNormalizeStore({ items: [Object.assign(item('a', 'John 3:16-21', iso(T)), { text: '[16] a [17] b [18] c [19] d [20] e [21] f', interval: 5, level: 3 })] });
  eq('migration: multi-chunk split gets fresh defaults, not seeded', migratedMulti.items[0].chunks.map((c) => [c.level, c.interval]), [[0, 0], [0, 0]]);
  // normalize preserves already-Stage-2 chunk state (no re-migration)
  let already = m.memNormalizeStore({ items: [Object.assign(item('a', 'John 3:16', iso(T)), { chunks: [{ chunkId: 'a-c0', level: 4, interval: 6, text: 'For God so loved' }] })] });
  eq('normalize preserves existing chunk progress', [already.items[0].chunks[0].level, already.items[0].chunks[0].interval], [4, 6]);

  // memGradeAttempt
  let g = m.memGradeAttempt('For God so loved the world', 'For God so loved the world');
  eq('grade: perfect match = 100%', g.pct, 100);
  g = m.memGradeAttempt('For God so loved the world', '');
  eq('grade: blank attempt = 0%', g.pct, 0);
  g = m.memGradeAttempt('For God so loved the world', 'for god so LOVED the world');
  eq('grade: case-insensitive = 100%', g.pct, 100);
  g = m.memGradeAttempt('[16] For God, so loved the world.', 'For God so loved the world');
  eq('grade: strips [n] markers and punctuation', g.pct, 100);
  g = m.memGradeAttempt('one two three four', 'one three four');
  eq('grade: one missed word does not zero the rest (LCS)', g.pct, 75);
  eq('grade: positional diff flags the right word', g.words.map((w) => w.ok), [true, false, true, true]);
  g = m.memGradeAttempt('', 'anything');
  eq('grade: empty target = 0/0', [g.pct, g.total], [0, 0]);

  // memNextChunkState — interval/level transitions
  const freshChunk = m.memMakeChunks('one two three', 'x')[0];
  let s = m.memNextChunkState(freshChunk, 100, T);
  eq('100% extends interval one step and levels up', [s.interval, s.level, s.holdCount], [1, 1, 0]);
  s = m.memNextChunkState(freshChunk, 40, T);
  eq('<50% shortens interval and levels down (floored at 0)', [s.interval, s.level], [0, 0]);
  s = m.memNextChunkState(Object.assign({}, freshChunk, { interval: 2, level: 2 }), 0, T);
  eq('0% drops all the way to step 1 (index 0)', [s.interval, s.level], [0, 1]);
  // hold-twice-then-drop
  let h = m.memNextChunkState(Object.assign({}, freshChunk, { interval: 3 }), 70, T);
  eq('1st hold: interval holds, holdCount 1', [h.interval, h.holdCount], [3, 1]);
  h = m.memNextChunkState(h, 70, T);
  eq('2nd hold: interval still holds, holdCount 2', [h.interval, h.holdCount], [3, 2]);
  h = m.memNextChunkState(h, 70, T);
  eq('3rd consecutive hold: drops one step, holdCount resets', [h.interval, h.holdCount], [2, 0]);
  eq('exactly 50% counts as hold, not shorten', m.memNextChunkState(freshChunk, 50, T).interval, 0);
  eq('nextReviewDate set from ladder day count', m.memNextChunkState(freshChunk, 100, T).nextReviewDate, iso(T + 2 * 86400000));
  eq('level never exceeds MEM_LEVEL_MAX', m.memNextChunkState(Object.assign({}, freshChunk, { level: m.MEM_LEVEL_MAX }), 100, T).level, m.MEM_LEVEL_MAX);
  eq('interval never exceeds ladder length', m.memNextChunkState(Object.assign({}, freshChunk, { interval: m.MEM_INTERVAL_LADDER.length - 1 }), 100, T).interval, m.MEM_INTERVAL_LADDER.length - 1);

  // memLogPracticeAttempt — never touches schedule
  const scheduled = Object.assign({}, freshChunk, { interval: 3, level: 2, nextReviewDate: iso(T - 1000) });
  const practiced = m.memLogPracticeAttempt(scheduled, 20, T);
  eq('practice attempt leaves interval/level/nextReviewDate untouched', [practiced.interval, practiced.level, practiced.nextReviewDate], [3, 2, iso(T - 1000)]);
  eq('practice attempt is logged and flagged', [practiced.reviewHistory.length, practiced.reviewHistory[0].practiceOnly], [1, true]);

  // memGetDueChunks / memGetAllChunks
  const dueItems = [
    { id: 'i1', reference: 'A', chunks: [{ chunkId: 'i1-c0', nextReviewDate: null }, { chunkId: 'i1-c1', nextReviewDate: iso(T - 1000) }] },
    { id: 'i2', reference: 'B', chunks: [{ chunkId: 'i2-c0', nextReviewDate: iso(T + 999999) }] }
  ];
  eq('due: null date and past date are due; future date is not', m.memGetDueChunks(dueItems, T).map((d) => d.chunkId), ['i1-c0', 'i1-c1']);
  eq('all: every chunk regardless of due status', m.memGetAllChunks(dueItems).map((d) => d.chunkId), ['i1-c0', 'i1-c1', 'i2-c0']);

  // memBuildBlankedText
  eq('blank: L0 returns full text unchanged', m.memBuildBlankedText('For God so loved', 0), 'For God so loved');
  eq('blank: L4 returns nothing (free recall)', m.memBuildBlankedText('For God so loved', 4), '');
  const noBlank = () => 1; // rng always >= pctBlank -> never blanks
  eq('blank: rng >= threshold leaves every word alone', m.memBuildBlankedText('For God so loved', 2, noBlank), 'For God so loved');
  const allBlank = () => 0; // rng always < pctBlank -> blanks everything eligible
  eq('blank: rng below threshold blanks the word (same length)', m.memBuildBlankedText('God', 2, allBlank), '___');
  eq('blank: L3 keeps first letter', m.memBuildBlankedText('God', 3, allBlank), 'G__');
  eq('blank: [n] markers are never blanked', m.memBuildBlankedText('[16] God', 2, allBlank), '[16] ___');

  // memMergeChunkArrays — per-chunk merge
  const ca = [{ chunkId: 'c0', updatedAt: iso(T - 10), level: 1 }, { chunkId: 'c1', updatedAt: null, level: 0 }];
  const cb = [{ chunkId: 'c0', updatedAt: iso(T - 5), level: 2 }, { chunkId: 'c2', updatedAt: iso(T), level: 3 }];
  const mergedChunks = m.memMergeChunkArrays(ca, cb);
  eq('chunk merge: newer updatedAt wins per chunk', mergedChunks.find((c) => c.chunkId === 'c0').level, 2);
  eq('chunk merge: chunk only on one side is kept (union)', [mergedChunks.find((c) => c.chunkId === 'c1').level, mergedChunks.find((c) => c.chunkId === 'c2').level], [0, 3]);

  // memMerge — full store merge no longer drops one device's chunk progress
  const itemA = Object.assign(item('same', 'John 3:16', iso(T - 1)), { chunks: [{ chunkId: 'same-c0', updatedAt: iso(T - 1), level: 1 }] });
  const itemB = Object.assign(item('same', 'John 3:16', iso(T)), { chunks: [{ chunkId: 'same-c0', updatedAt: iso(T - 20), level: 0 }] });
  // B wins on item-level updatedAt (more recent edit), but A's chunk-level review is newer and must survive.
  const mergedStore = m.memMerge({ items: [itemA] }, { items: [itemB] }, T);
  eq('merge: newer item wins flat fields but per-chunk merge keeps the more recent review', mergedStore.items[0].chunks[0].level, 1);

  fs.unlinkSync(tmp);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
