// memory-core.js — Pilgrim Private ES Module (v4.36.0)
// Pure Scripture Memory helpers: NO imports, NO DOM, NO localStorage.
// Kept dependency-free on purpose so tests/memory-core.test.js can run under plain node.
// Storage + UI live in memory.js; sync/backup wiring lives in sync.js and ui.js.
//
// Store shape (one localStorage key per user, see SK_MEM in utils.js):
//   { items: [ MemoryVerse ], deleted: [ { id, at } ] }
// MemoryVerse:
//   { id, reference, translation, text, source('read'|'study'|'manual'),
//     createdAt, updatedAt (ISO strings),
//     interval, easeFactor, nextReviewDate, reviewHistory }   <- last four are inert until Stage 2
// `deleted` holds tombstones so a delete on one device survives merge with another device.

var TOMBSTONE_TTL_MS = 180 * 24 * 3600 * 1000; // tombstones older than this are pruned on merge

function memEmptyStore() { return { items: [], deleted: [] }; }

/**
 * Coerces untrusted data (localStorage, Gist, imported file) into a valid store.
 * Drops malformed records but keeps unknown extra fields on valid ones so a newer
 * app version's data is never stripped by an older version passing it through.
 * @param {*} raw
 * @returns {{items:Object[],deleted:{id:string,at:string}[]}}
 */
function memNormalizeStore(raw) {
  var out = memEmptyStore();
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.items)) {
    raw.items.forEach(function(it) {
      if (!it || typeof it.id !== 'string' || !it.id) return;
      if (typeof it.reference !== 'string' || !it.reference.trim()) return;
      if (typeof it.text !== 'string' || !it.text.trim()) return;
      var c = Object.assign({}, it);
      c.reference = it.reference.trim();
      c.text = it.text.trim();
      c.translation = typeof it.translation === 'string' ? it.translation : '';
      c.source = typeof it.source === 'string' ? it.source : 'manual';
      c.createdAt = typeof it.createdAt === 'string' ? it.createdAt : '';
      c.updatedAt = typeof it.updatedAt === 'string' ? it.updatedAt : c.createdAt;
      c.interval = typeof it.interval === 'number' ? it.interval : 0;
      c.easeFactor = typeof it.easeFactor === 'number' ? it.easeFactor : 2.5;
      c.nextReviewDate = typeof it.nextReviewDate === 'string' ? it.nextReviewDate : null;
      c.reviewHistory = Array.isArray(it.reviewHistory) ? it.reviewHistory : [];
      out.items.push(c);
    });
  }
  if (Array.isArray(raw.deleted)) {
    raw.deleted.forEach(function(d) {
      if (d && typeof d.id === 'string' && d.id) {
        out.deleted.push({ id: d.id, at: typeof d.at === 'string' ? d.at : '' });
      }
    });
  }
  return out;
}

/** Normalized duplicate-detection key: reference + translation, case/space/dot-insensitive. */
function memNormRefKey(reference, translation) {
  var r = String(reference || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return r + '|' + String(translation || '').toLowerCase().trim();
}

/**
 * Builds a new MemoryVerse record with Stage 2 scheduling fields at inert defaults.
 * @param {{reference:string,translation:string,text:string,source:string}} v
 * @param {string} id
 * @param {string} nowISO
 */
function memMakeItem(v, id, nowISO) {
  return {
    id: id,
    reference: String(v.reference || '').trim(),
    translation: String(v.translation || '').trim(),
    text: String(v.text || '').trim(),
    source: v.source || 'manual',
    createdAt: nowISO,
    updatedAt: nowISO,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: null,
    reviewHistory: []
  };
}

/**
 * Merges two stores (local + remote/imported). Pure — inputs are not mutated.
 *  - Tombstones are unioned (latest `at` per id); a tombstoned id never survives.
 *  - Same id on both sides: newer updatedAt wins; ties keep `a` (local).
 *  - Same verse saved separately on two devices (same reference+translation, different ids)
 *    collapses to one: most review history, then earliest createdAt, then smallest id wins;
 *    the loser gets a tombstone so it disappears everywhere.
 *  - Tombstones older than TOMBSTONE_TTL_MS are pruned.
 * @param {*} a - local store
 * @param {*} b - remote/imported store
 * @param {number} [nowMs] - injectable clock for tests
 * @returns {{items:Object[],deleted:{id:string,at:string}[]}}
 */
function memMerge(a, b, nowMs) {
  a = memNormalizeStore(a);
  b = memNormalizeStore(b);
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  var nowISO = new Date(now).toISOString();

  var tomb = {};
  a.deleted.concat(b.deleted).forEach(function(d) {
    if (!(d.id in tomb) || d.at > tomb[d.id]) tomb[d.id] = d.at;
  });

  var byId = {};
  a.items.concat(b.items).forEach(function(it) {
    if (it.id in tomb) return;
    var ex = byId[it.id];
    if (!ex || (it.updatedAt || '') > (ex.updatedAt || '')) byId[it.id] = it;
  });

  var byKey = {};
  Object.keys(byId).forEach(function(id) {
    var it = byId[id];
    var k = memNormRefKey(it.reference, it.translation);
    var ex = byKey[k];
    if (!ex) { byKey[k] = it; return; }
    var winner = ex, loser = it;
    var exH = (ex.reviewHistory || []).length, itH = (it.reviewHistory || []).length;
    if (itH > exH ||
        (itH === exH && ((it.createdAt || '') < (ex.createdAt || '') ||
        ((it.createdAt || '') === (ex.createdAt || '') && it.id < ex.id)))) {
      winner = it; loser = ex;
    }
    byKey[k] = winner;
    tomb[loser.id] = nowISO;
    delete byId[loser.id];
  });

  var deleted = [];
  Object.keys(tomb).forEach(function(id) {
    var t = Date.parse(tomb[id]);
    if (!isNaN(t) && now - t > TOMBSTONE_TTL_MS) return; // stale — prune
    deleted.push({ id: id, at: tomb[id] });
  });

  return { items: Object.keys(byId).map(function(id) { return byId[id]; }), deleted: deleted };
}

/**
 * Builds a full "Book Chapter:Verse" reference for one verse of a loaded passage.
 * The passage reference may be a chapter ("John 3"), a range ("John 3:16-18") or a
 * cross-chapter range ("John 3:35-4:2"); the chapter is tracked by watching for the
 * verse number dropping. Multi-passage refs ("John 3:16; Rom 8:1") can't be resolved
 * reliably, so they fall back to "<ref> v.<n>".
 * @param {string} refStr - The reference the passage was loaded with.
 * @param {{num:string,text:string}[]} verses - Parsed verses of the loaded passage.
 * @param {number} idx - Index of the chosen verse in `verses`.
 * @returns {string}
 */
function memBuildVerseRef(refStr, verses, idx) {
  refStr = String(refStr || '').trim();
  var v = verses && verses[idx];
  if (!v) return refStr;
  var m = refStr.indexOf(';') === -1 && refStr.indexOf(',') === -1
    ? refStr.match(/^(.+?)\s+(\d+)(?::\d+)?/) : null;
  if (!m) return refStr + ' v.' + v.num;
  var chapter = parseInt(m[2], 10);
  for (var i = 1; i <= idx; i++) {
    if (parseInt(verses[i].num, 10) < parseInt(verses[i - 1].num, 10)) chapter++;
  }
  return m[1] + ' ' + chapter + ':' + v.num;
}

export {
  TOMBSTONE_TTL_MS,
  memEmptyStore, memNormalizeStore, memNormRefKey, memMakeItem, memMerge, memBuildVerseRef
};
