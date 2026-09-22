// memory-core.js — Pilgrim Private ES Module (v4.37.0)
// Pure Scripture Memory helpers: NO imports, NO DOM, NO localStorage.
// Kept dependency-free on purpose so tests/memory-core.test.js can run under plain node.
// Storage + UI live in memory.js; sync/backup wiring lives in sync.js and ui.js.
//
// Store shape (one localStorage key per user, see SK_MEM in utils.js):
//   { items: [ MemoryVerse ], deleted: [ { id, at } ] }
// MemoryVerse:
//   { id, reference, translation, text, source('read'|'study'|'manual'),
//     createdAt, updatedAt (ISO strings),
//     level, interval, easeFactor, nextReviewDate, reviewHistory,  <- Stage 1 flat fields.
//                                                                     INERT as of Stage 2 — kept
//                                                                     only so an item created
//                                                                     before v4.37.0 still displays;
//                                                                     never written to going forward.
//     chunks: [ MemoryChunk ] }                                   <- Stage 2: real scheduling state
// MemoryChunk (Stage 2 — spec-scripture-memory-stage2-v1.md §1.1):
//   { chunkId, verseStart, verseEnd, text, level, interval, holdCount, easeFactor,
//     nextReviewDate, reviewHistory, updatedAt }
//   `text` and `updatedAt` are implementation additions beyond the confirmed spec shape:
//   `text` is this chunk's own slice (needed to quiz it independently of its siblings),
//   `updatedAt` is needed for the per-chunk merge rule (spec §7) to have something to compare.
//   `holdCount` is the internal counter behind the hold-twice-then-drop rule (spec §3).
// `deleted` holds tombstones so a delete on one device survives merge with another device.

var TOMBSTONE_TTL_MS = 180 * 24 * 3600 * 1000; // tombstones older than this are pruned on merge

// ── Stage 2 tunable constants (spec §1.1, §3, §4) ────────────────────────────
var MEM_CHUNK_SIZE = 4;                            // verses per chunk when splitting a passage
var MEM_INTERVAL_LADDER = [1, 2, 4, 7, 14, 30, 60]; // days; index = chunk.interval
var MEM_LEVEL_MAX = 4;                              // L0 (full text) .. L4 (free recall)

function memEmptyStore() { return { items: [], deleted: [] }; }

/**
 * Coerces untrusted data (localStorage, Gist, imported file) into a valid store.
 * Drops malformed records but keeps unknown extra fields on valid ones so a newer
 * app version's data is never stripped by an older version passing it through.
 * Also builds/normalizes each item's `chunks` array (Stage 2 migration — spec §1.3).
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
      // Stage 1 flat fields — inert, kept only for backward display compat (see header comment).
      c.level = typeof it.level === 'number' ? it.level : 0;
      c.interval = typeof it.interval === 'number' ? it.interval : 0;
      c.easeFactor = typeof it.easeFactor === 'number' ? it.easeFactor : 2.5;
      c.nextReviewDate = typeof it.nextReviewDate === 'string' ? it.nextReviewDate : null;
      c.reviewHistory = Array.isArray(it.reviewHistory) ? it.reviewHistory : [];
      // Stage 2 chunks — migrate if missing, else normalize what's stored.
      if (Array.isArray(it.chunks) && it.chunks.length) {
        c.chunks = it.chunks.map(function(ch, idx) { return memNormalizeChunk(ch, c.id + '-c' + idx); });
      } else {
        c.chunks = memMakeChunks(c.text, c.id);
        if (c.chunks.length === 1) {
          // Single-chunk item: seed chunk 0 from the item's own Stage 1 progress so
          // migration doesn't reset a verse someone was already reviewing.
          c.chunks[0].level = c.level;
          c.chunks[0].interval = c.interval;
          c.chunks[0].easeFactor = c.easeFactor;
          c.chunks[0].nextReviewDate = c.nextReviewDate;
          c.chunks[0].reviewHistory = c.reviewHistory.slice();
          c.chunks[0].updatedAt = c.updatedAt || null;
        }
        // Multi-chunk split (a passage that didn't have chunks yet): fresh defaults per
        // chunk — a single flat history can't be honestly divided across chunks (spec §1.3).
      }
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
 * Builds a new MemoryVerse record with Stage 1 fields inert and Stage 2 chunks built fresh.
 * @param {{reference:string,translation:string,text:string,source:string}} v
 * @param {string} id
 * @param {string} nowISO
 */
function memMakeItem(v, id, nowISO) {
  var text = String(v.text || '').trim();
  return {
    id: id,
    reference: String(v.reference || '').trim(),
    translation: String(v.translation || '').trim(),
    text: text,
    source: v.source || 'manual',
    createdAt: nowISO,
    updatedAt: nowISO,
    level: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: null,
    reviewHistory: [],
    chunks: memMakeChunks(text, id)
  };
}

// ── Stage 2: chunking (spec §1.1) ─────────────────────────────────────────────

/**
 * Splits saved memory text into its constituent verses. Text with "[n] " markers
 * (memJoinVerses' multi-verse output) splits on those; text with no markers (a
 * single-verse save) is treated as one verse with `num: null`.
 * @param {string} text
 * @returns {{num:string|null,text:string}[]}
 */
function memParseVerseTexts(text) {
  var str = String(text || '');
  var re = /\[(\d+)\]\s*/g;
  var hits = [];
  var m;
  while ((m = re.exec(str))) hits.push({ num: m[1], contentStart: re.lastIndex, markerStart: m.index });
  if (!hits.length) {
    var trimmed = str.trim();
    return trimmed ? [{ num: null, text: trimmed }] : [];
  }
  var verses = [];
  for (var i = 0; i < hits.length; i++) {
    var start = hits[i].contentStart;
    var end = i + 1 < hits.length ? hits[i + 1].markerStart : str.length;
    verses.push({ num: hits[i].num, text: str.slice(start, end).trim() });
  }
  return verses;
}

/**
 * Splits an item's saved text into MEM_CHUNK_SIZE-verse quiz chunks. A bare single verse
 * (no [n] markers) is always exactly one chunk regardless of chunkSize.
 * @param {string} text
 * @param {string} itemId
 * @param {number} [chunkSize]
 * @returns {Object[]} fresh MemoryChunk records (level 0, interval 0, never reviewed)
 */
function memMakeChunks(text, itemId, chunkSize) {
  chunkSize = typeof chunkSize === 'number' && chunkSize > 0 ? chunkSize : MEM_CHUNK_SIZE;
  var verses = memParseVerseTexts(text);
  if (!verses.length) return [];
  var chunks = [];
  for (var i = 0; i < verses.length; i += chunkSize) {
    var slice = verses.slice(i, i + chunkSize);
    var chunkText = (slice.length === 1 && slice[0].num === null)
      ? slice[0].text
      : slice.map(function(v) { return v.num !== null ? '[' + v.num + '] ' + v.text : v.text; }).join(' ');
    chunks.push({
      chunkId: itemId + '-c' + chunks.length,
      verseStart: slice[0].num !== null ? parseInt(slice[0].num, 10) : null,
      verseEnd: slice[slice.length - 1].num !== null ? parseInt(slice[slice.length - 1].num, 10) : null,
      text: chunkText,
      level: 0,
      interval: 0,
      holdCount: 0,
      easeFactor: 2.5,
      nextReviewDate: null,
      reviewHistory: [],
      updatedAt: null
    });
  }
  return chunks;
}

/**
 * Coerces one stored/loaded chunk record into a valid MemoryChunk, defaulting anything
 * missing/malformed. Keeps unknown extra fields (same forward-compat rule as items).
 * @param {*} raw
 * @param {string} fallbackId - used if raw has no usable chunkId
 * @returns {Object}
 */
function memNormalizeChunk(raw, fallbackId) {
  var c = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
  c.chunkId = typeof c.chunkId === 'string' && c.chunkId ? c.chunkId : fallbackId;
  c.verseStart = typeof c.verseStart === 'number' ? c.verseStart : null;
  c.verseEnd = typeof c.verseEnd === 'number' ? c.verseEnd : null;
  c.text = typeof c.text === 'string' ? c.text : '';
  c.level = typeof c.level === 'number' ? Math.max(0, Math.min(MEM_LEVEL_MAX, c.level)) : 0;
  c.interval = typeof c.interval === 'number' ? Math.max(0, Math.min(MEM_INTERVAL_LADDER.length - 1, c.interval)) : 0;
  c.holdCount = typeof c.holdCount === 'number' ? c.holdCount : 0;
  c.easeFactor = typeof c.easeFactor === 'number' ? c.easeFactor : 2.5;
  c.nextReviewDate = typeof c.nextReviewDate === 'string' ? c.nextReviewDate : null;
  c.reviewHistory = Array.isArray(c.reviewHistory) ? c.reviewHistory : [];
  c.updatedAt = typeof c.updatedAt === 'string' ? c.updatedAt : null;
  return c;
}

// ── Stage 2: grading (spec §2) ────────────────────────────────────────────────

/** Lowercases, strips [n] markers and punctuation (keeps internal apostrophes), splits to words. */
function _memGradeWords(text) {
  return String(text || '')
    .replace(/\[\d+\]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Longest-common-subsequence alignment between two word arrays.
 * @returns {{length:number, matchedMask:boolean[]}} matchedMask is over `a` (the target).
 */
function _memLCS(a, b) {
  var n = a.length, m = b.length;
  var dp = [];
  for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
  for (i = 1; i <= n; i++) {
    for (var j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  var mask = new Array(n).fill(false);
  i = n; var j2 = m;
  while (i > 0 && j2 > 0) {
    if (a[i - 1] === b[j2 - 1]) { mask[i - 1] = true; i--; j2--; }
    else if (dp[i - 1][j2] >= dp[i][j2 - 1]) i--;
    else j2--;
  }
  return { length: dp[n][m], matchedMask: mask };
}

/**
 * Grades a typed recall attempt against a chunk's stored text.
 * Case-insensitive; ignores punctuation and [n] markers; compared as a word sequence via
 * LCS so one missed word doesn't zero the rest.
 * @param {string} storedText - the chunk's own text (chunk.text)
 * @param {string} typedText - what the user typed
 * @returns {{pct:number, total:number, matched:number, words:{word:string,ok:boolean}[]}}
 *   `words` is the target word sequence in order, each flagged matched/missed — enough to
 *   render a positional diff (a repeated word can be right in one spot and missed in another).
 */
function memGradeAttempt(storedText, typedText) {
  var target = _memGradeWords(storedText);
  var typed = _memGradeWords(typedText);
  if (!target.length) return { pct: 0, total: 0, matched: 0, words: [] };
  if (!typed.length) {
    return { pct: 0, total: target.length, matched: 0, words: target.map(function(w) { return { word: w, ok: false }; }) };
  }
  var r = _memLCS(target, typed);
  var pct = Math.round((r.length / target.length) * 100);
  var words = target.map(function(w, idx) { return { word: w, ok: r.matchedMask[idx] }; });
  return { pct: pct, total: target.length, matched: r.length, words: words };
}

// ── Stage 2: interval / level scheduling (spec §3) ────────────────────────────

/**
 * Advances one chunk's schedule after a graded ("Test Me") attempt. Pure — does not
 * mutate `chunk`. See spec §3 for the rule table (100/hold/<50/0) and the hold-twice
 * rule: two consecutive holds at the same interval, then the third hold drops one step
 * instead of holding again.
 * @param {Object} chunk
 * @param {number} pct - 0-100
 * @param {number} [nowMs] - injectable clock for tests
 * @returns {Object} the updated chunk (new object)
 */
function memNextChunkState(chunk, pct, nowMs) {
  var ladder = MEM_INTERVAL_LADDER;
  var maxIdx = ladder.length - 1;
  var out = Object.assign({}, chunk);
  var holdCount = typeof chunk.holdCount === 'number' ? chunk.holdCount : 0;
  var level = typeof chunk.level === 'number' ? chunk.level : 0;
  var interval = typeof chunk.interval === 'number' ? chunk.interval : 0;
  var intervalBeforeDays = ladder[Math.min(Math.max(interval, 0), maxIdx)];

  var newInterval = interval, newLevel = level, newHold = 0;
  if (pct >= 100) {
    newInterval = Math.min(interval + 1, maxIdx);
    newLevel = Math.min(level + 1, MEM_LEVEL_MAX);
  } else if (pct === 0) {
    newInterval = 0;
    newLevel = Math.max(level - 1, 0);
  } else if (pct < 50) {
    newInterval = Math.max(interval - 1, 0);
    newLevel = Math.max(level - 1, 0);
  } else if (pct === 50 || pct < 100) {
    if (holdCount >= 2) {
      newInterval = Math.max(interval - 1, 0); // third consecutive hold -> drop one step
      newLevel = level;
      newHold = 0;
    } else {
      newInterval = interval;
      newLevel = level;
      newHold = holdCount + 1;
    }
  }

  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  var nowISO = new Date(now).toISOString();
  var intervalAfterDays = ladder[Math.min(Math.max(newInterval, 0), maxIdx)];

  out.level = newLevel;
  out.interval = newInterval;
  out.holdCount = newHold;
  out.nextReviewDate = new Date(now + intervalAfterDays * 24 * 3600 * 1000).toISOString();
  out.updatedAt = nowISO;
  out.reviewHistory = (chunk.reviewHistory || []).concat([{
    at: nowISO, pct: pct, level: newLevel, intervalBefore: intervalBeforeDays, intervalAfter: intervalAfterDays
  }]);
  return out;
}

/**
 * Logs a "Practice All" attempt WITHOUT touching the chunk's schedule (spec §5.2) —
 * level, interval and nextReviewDate are unchanged; only reviewHistory gets an entry
 * flagged practiceOnly so it's visible in history without feeding the state machine.
 * @param {Object} chunk
 * @param {number} pct
 * @param {number} [nowMs]
 * @returns {Object} the updated chunk (new object)
 */
function memLogPracticeAttempt(chunk, pct, nowMs) {
  var out = Object.assign({}, chunk);
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  var nowISO = new Date(now).toISOString();
  var ladder = MEM_INTERVAL_LADDER;
  var days = ladder[Math.min(Math.max(chunk.interval || 0, 0), ladder.length - 1)];
  out.updatedAt = nowISO;
  out.reviewHistory = (chunk.reviewHistory || []).concat([{
    at: nowISO, pct: pct, level: chunk.level || 0, intervalBefore: days, intervalAfter: days, practiceOnly: true
  }]);
  return out;
}

/**
 * Flattens every item's chunks that are due (nextReviewDate null or <= now).
 * @param {Object[]} items
 * @param {number} [nowMs]
 * @returns {{itemId:string, chunkId:string, reference:string, chunk:Object}[]}
 */
function memGetDueChunks(items, nowMs) {
  var now = typeof nowMs === 'number' ? nowMs : Date.now();
  var due = [];
  (items || []).forEach(function(item) {
    (item.chunks || []).forEach(function(chunk) {
      var t = chunk.nextReviewDate ? Date.parse(chunk.nextReviewDate) : NaN;
      var isDue = !chunk.nextReviewDate || isNaN(t) || t <= now;
      if (isDue) due.push({ itemId: item.id, chunkId: chunk.chunkId, reference: item.reference, chunk: chunk });
    });
  });
  return due;
}

/**
 * Flattens every item's chunks regardless of due status (for "Practice All" — spec §5.2).
 * @param {Object[]} items
 * @returns {{itemId:string, chunkId:string, reference:string, chunk:Object}[]}
 */
function memGetAllChunks(items) {
  var all = [];
  (items || []).forEach(function(item) {
    (item.chunks || []).forEach(function(chunk) {
      all.push({ itemId: item.id, chunkId: chunk.chunkId, reference: item.reference, chunk: chunk });
    });
  });
  return all;
}

/**
 * Builds the display text for a quiz prompt at a given cue-removal level (spec §4).
 * L0 = full text. L1/L2/L3 blank ~25/50/75% of words (L3 keeps first letters). L4 = ''
 * (free recall — no cue at all). [n] verse markers are never blanked.
 * @param {string} text
 * @param {number} level - 0-4
 * @param {Function} [rng] - injectable RNG for tests; defaults to Math.random
 * @returns {string}
 */
function memBuildBlankedText(text, level, rng) {
  rng = typeof rng === 'function' ? rng : Math.random;
  if (level <= 0) return String(text || '');
  if (level >= MEM_LEVEL_MAX) return '';
  var pctBlank = level === 1 ? 0.25 : level === 2 ? 0.5 : 0.75;
  var tokens = String(text || '').split(/(\s+)/);
  return tokens.map(function(tok) {
    if (!tok || /^\s+$/.test(tok) || /^\[\d+\]$/.test(tok)) return tok;
    if (rng() >= pctBlank) return tok;
    return level === 3 ? tok.charAt(0) + new Array(tok.length).join('_') : new Array(tok.length + 1).join('_');
  }).join('');
}

/**
 * Merges two chunk arrays for the same item by chunkId. Newer `updatedAt` wins per
 * chunk (a chunk never reviewed has `updatedAt: null`, treated as oldest); chunkIds
 * present on only one side are kept as-is (union). Pure.
 * @param {Object[]} ca
 * @param {Object[]} cb
 * @returns {Object[]} sorted by chunkId for stable output
 */
function memMergeChunkArrays(ca, cb) {
  var byId = {};
  (ca || []).forEach(function(c) { byId[c.chunkId] = c; });
  (cb || []).forEach(function(c) {
    var ex = byId[c.chunkId];
    if (!ex) { byId[c.chunkId] = c; return; }
    if ((c.updatedAt || '') > (ex.updatedAt || '')) byId[c.chunkId] = c;
  });
  return Object.keys(byId).sort().map(function(k) { return byId[k]; });
}

/** Combined review-attempt count (flat legacy + all chunks) — used to break ties in dedupe merge. */
function _memHistoryCount(it) {
  var flat = (it.reviewHistory || []).length;
  var chunkSum = (it.chunks || []).reduce(function(s, c) { return s + (c.reviewHistory || []).length; }, 0);
  return flat + chunkSum;
}

/**
 * Merges two stores (local + remote/imported). Pure — inputs are not mutated.
 *  - Tombstones are unioned (latest `at` per id); a tombstoned id never survives.
 *  - Same id on both sides: chunks are merged per-chunk first (memMergeChunkArrays), then
 *    flat fields pick newer updatedAt wins (ties keep `a`/local) and carry the merged chunks.
 *  - Same verse saved separately on two devices (same reference+translation, different ids)
 *    collapses to one: most total review history (flat + chunks), then earliest createdAt,
 *    then smallest id wins; the loser gets a tombstone so it disappears everywhere.
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

  var aById = {}, bById = {};
  a.items.forEach(function(it) { if (!(it.id in tomb)) aById[it.id] = it; });
  b.items.forEach(function(it) { if (!(it.id in tomb)) bById[it.id] = it; });

  var allIds = {};
  Object.keys(aById).forEach(function(id) { allIds[id] = 1; });
  Object.keys(bById).forEach(function(id) { allIds[id] = 1; });

  var byId = {};
  Object.keys(allIds).forEach(function(id) {
    var A = aById[id], B = bById[id];
    var winner;
    if (A && B) {
      winner = Object.assign({}, ((B.updatedAt || '') > (A.updatedAt || '')) ? B : A);
      winner.chunks = memMergeChunkArrays(A.chunks, B.chunks);
    } else {
      winner = Object.assign({}, A || B);
    }
    byId[id] = winner;
  });

  var byKey = {};
  Object.keys(byId).forEach(function(id) {
    var it = byId[id];
    var k = memNormRefKey(it.reference, it.translation);
    var ex = byKey[k];
    if (!ex) { byKey[k] = it; return; }
    var winner = ex, loser = it;
    var exH = _memHistoryCount(ex), itH = _memHistoryCount(it);
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

/**
 * Joins a firstRef/lastRef pair ("Romans 8:28", "Romans 8:30") into one passage label.
 * Same book+chapter -> "Romans 8:28-30"; different chapter/book -> "John 3:35 - John 4:2".
 * Falls back to "first - last" if either side isn't in "Book C:V" form.
 * @param {string} firstRef
 * @param {string} lastRef
 * @returns {string}
 */
function memRangeLabel(firstRef, lastRef) {
  var a = String(firstRef || '').trim(), b = String(lastRef || '').trim();
  if (!a || a === b) return a || b;
  var ma = a.match(/^(.+?)\s+(\d+):(\d+)$/), mb = b.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (ma && mb && ma[1] === mb[1] && ma[2] === mb[2]) return a + '-' + mb[3];
  return a + ' - ' + b;
}

/**
 * Builds the saved memory text for a loaded passage. One verse -> plain text; two or more ->
 * "[16] text [17] text ..." so verse boundaries stay visible. Whitespace is collapsed.
 * @param {{num:string,text:string}[]} verses
 * @returns {string}
 */
function memJoinVerses(verses) {
  var vs = verses || [];
  var clean = function(t) { return String(t || '').replace(/\s+/g, ' ').trim(); };
  if (vs.length === 1) return clean(vs[0].text);
  return vs.map(function(v) { return '[' + v.num + '] ' + clean(v.text); }).join(' ');
}

export {
  TOMBSTONE_TTL_MS, MEM_CHUNK_SIZE, MEM_INTERVAL_LADDER, MEM_LEVEL_MAX,
  memEmptyStore, memNormalizeStore, memNormRefKey, memMakeItem, memMerge, memBuildVerseRef,
  memRangeLabel, memJoinVerses,
  memParseVerseTexts, memMakeChunks, memNormalizeChunk, memGradeAttempt,
  memNextChunkState, memLogPracticeAttempt, memGetDueChunks, memGetAllChunks,
  memBuildBlankedText, memMergeChunkArrays
};
