// offline.js — Pilgrim Private: offline downloads store (Phase 1, v4.64.0; word data 4.65.0; Bible text 4.66.0; cross-references and interlinear 4.67.0 — Nov 2026)
// Spec: spec-offline-packs-v2.md (Project Knowledge). Phase 1 = the store, the Settings section and the lookup hook.
// No pack content ships in this phase; Bible text packs arrive in Phase 3, word-tool packs in Phase 2.
//
// Everything here lives in ONE shared IndexedDB (pilgrimOffline), NOT per user, NOT in localStorage, NOT on any study.
// The text is public data, so one copy serves every PIN user on the device. By design:
//   - studies, the data model, backups, safety copies and sync are never touched,
//   - Clear All Data does NOT delete downloads (Settings > Offline Downloads has its own Delete),
//   - the backup file never includes downloads.
//
//   packs : packId -> { id, name, version, format, size, count, installedAt, license }
//   data  : "<packId>|<key>" -> payload (Bible packs: "<bookNum>:<chapter>" -> [{verse, text}, ...])
//
// `format` is 'json' today. It exists so compressed storage can be added later without a rewrite.

import { parseRef, escHtml, toast, logError } from './utils.js?v=4.68.0';

/** Where the static study data lives (jsDelivr mirror of arche-suite/data/). studyTools.js reuses this as GROUND_CDN. */
export var OFFLINE_DATA_CDN = 'https://cdn.jsdelivr.net/gh/arche-epos/arche-suite@main/data/';

/**
 * Downloadable packs. `files` are paths under OFFLINE_DATA_CDN; each is stored parsed under its own path, so
 * fetchGroundData(path) can be answered from the phone. Bump `version` when the files change (Settings then offers Update).
 */
/** Paths "<prefix>NN.json" for Bible book numbers from..to (two digits, 01 = Genesis, 66 = Revelation). */
function bookFiles(prefix, from, to) {
  var out = [];
  for (var n = from; n <= to; n++) out.push(prefix + (n < 10 ? '0' + n : '' + n) + '.json');
  return out;
}

var OFFLINE_CATALOG = [
  { id: 'words-core', name: 'Word study data', about: 'Hebrew and Greek dictionaries and the word index, for Look Up Word and word lists',
    version: '1', approxMB: 4.9, license: 'Open Scriptures (CC BY-SA / public domain)',
    files: ['strongs/hebrew.json', 'strongs/greek.json', 'strongs/gloss-index.json', 'strongs/occurrence-index.json'] },
  // v4.67.0 study-data packs: one file per Bible book, stored under its own path (like words-core), so the existing
  // fetchGroundData(path) lookup answers from the phone. Installed file by file (see offlineInstallStreamed).
  { id: 'crossrefs', name: 'Cross-references', about: 'the top cross-references for every verse, for the Cross-References tool',
    version: '1', approxMB: 4.2, license: 'OpenBible.info Cross-References (CC BY)',
    files: bookFiles('crossrefs/', 1, 66) },
  { id: 'macula-nt', name: 'Interlinear: New Testament', about: 'Greek words, Strong\'s numbers, morphology and English glosses for Matthew to Revelation',
    version: '1', approxMB: 13.1, license: 'MACULA Greek, Biblica / Clear-Bible (CC BY 4.0)',
    files: bookFiles('macula/', 40, 66) },
  { id: 'macula-ot', name: 'Interlinear: Old Testament', about: 'Hebrew words, Strong\'s numbers, morphology and English glosses for Genesis to Malachi',
    version: '1', approxMB: 31, license: 'Open Scriptures Hebrew Bible (CC BY) with MACULA Hebrew glosses, Clear-Bible (CC BY 4.0)',
    files: bookFiles('macula/', 1, 39) },
  // v4.66.0 Bible text packs. `file` is ONE JSON under OFFLINE_DATA_CDN shaped {"<bookNum>:<chapter>": [{verse,text}]}; the
  // download splits it into one stored entry per chapter, which is what offlineBibleText() reads. Built by data/build-bibles.py.
  { id: 'bible-kjv', kind: 'bible', name: 'King James Version (KJV)', about: 'the whole Bible', file: 'bibles/kjv.json',
    version: '1', approxMB: 4.8, license: 'Public domain (1769 text). Source: scrollmapper/bible_databases' },
  { id: 'bible-asv', kind: 'bible', name: 'American Standard Version (ASV)', about: 'the whole Bible', file: 'bibles/asv.json',
    version: '1', approxMB: 4.8, license: 'Public domain (1901). Source: scrollmapper/bible_databases' },
  { id: 'bible-web', kind: 'bible', name: 'World English Bible (WEB)', about: 'the whole Bible, numbered as the WEB publishes it', file: 'bibles/web.json',
    version: '1', approxMB: 4.7, license: 'Public domain, text unaltered ("World English Bible" is a trademark of eBible.org). Source: eBible.org' },
  { id: 'bible-ylt', kind: 'bible', name: "Young's Literal Translation (YLT)", about: 'the whole Bible', file: 'bibles/ylt.json',
    version: '1', approxMB: 4.8, license: 'Public domain (1898). Source: scrollmapper/bible_databases' },
  { id: 'bible-darby', kind: 'bible', name: 'Darby Bible (Darby)', about: 'the whole Bible', file: 'bibles/darby.json',
    version: '1', approxMB: 4.8, license: 'Public domain (1890). Source: eBible.org' }
];
var GROUND_PACKS = ['words-core', 'crossrefs', 'macula-nt', 'macula-ot']; // packs consulted by offlineGroundData, in order

var DB_NAME = 'pilgrimOffline';
var DB_VERSION = 1;
var BATCH = 40;            // entries written per transaction while installing a pack
var _db = null;
var _armed = {};           // pack id -> true while its Delete button waits for a second tap
var MAX_ACTIVE = 2;        // packs downloading at the same time; the rest wait in _queue
var RETRY_TRIES = 3;       // attempts per file before a download gives up
var RETRY_PAUSE_MS = 1000; // pause before retry n is n times this
var _dls = {};             // pack id -> { done, total } while that pack is downloading
var _queue = [];           // pack ids waiting for a free slot, in tap order
var _waiters = {};         // pack id -> [resolve, ...] callers waiting for that pack's download to finish
var _dlErr = {};           // pack id -> last download error text
var _persisted = null;     // result of the last navigator.storage.persist()/persisted() check

// ════════════════════════════════════════════════════════
// DB LAYER
// ════════════════════════════════════════════════════════

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('Offline storage is not available in this browser')); return; }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      var d = req.result;
      if (!d.objectStoreNames.contains('packs')) d.createObjectStore('packs');
      if (!d.objectStoreNames.contains('data')) d.createObjectStore('data');
    };
    req.onsuccess = function () {
      _db = req.result;
      _db.onversionchange = function () { try { _db.close(); } catch (e) {} _db = null; };
      resolve(_db);
    };
    req.onerror = function () { reject(req.error || new Error('Could not open offline storage')); };
  });
}

/** Runs fn(tx) in one transaction. Resolves with fn's returned request .result (if any) when the transaction completes. */
function run(stores, mode, fn) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(stores, mode), out;
      try { out = fn(t); } catch (e) { reject(e); return; }
      t.oncomplete = function () { resolve(out && typeof out === 'object' && 'result' in out ? out.result : undefined); };
      t.onerror = t.onabort = function () { reject(t.error || new Error('Offline storage transaction failed')); };
    });
  });
}

function dataKey(packId, key) { return packId + '|' + key; }
function packRange(packId) { return IDBKeyRange.bound(packId + '|', packId + '|￿'); }

// ════════════════════════════════════════════════════════
// PACK API
// ════════════════════════════════════════════════════════

/**
 * Lists installed packs (metadata only), sorted by name. Never throws; resolves [] if storage is unavailable.
 * @returns {Promise<Array<{id:string,name:string,version:string,format:string,size:number,count:number,installedAt:number,license:string}>>}
 */
export function offlineListPacks() {
  return run(['packs'], 'readonly', function (t) { return t.objectStore('packs').getAll(); })
    .then(function (rows) { return (rows || []).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); })
    .catch(function () { return []; });
}

/**
 * Installs (or replaces) a pack. Data is written in batches; the pack's metadata is written LAST, so a pack only
 * "exists" once every entry is stored. On any failure (for example a full device) the partial data is removed and
 * the error is rethrown, leaving nothing half-installed. Asks the browser for persistent storage on first use.
 * @param {{id:string,name:string,version:string,license?:string}} meta - Pack description. id is e.g. "bible-kjv".
 * @param {Array<[string, *]>} entries - [key, payload] pairs. Payloads must be structured-cloneable (plain JSON data).
 * @param {function(number,number):void} [onProgress] - Called with (done, total) after each batch.
 * @returns {Promise<object>} The stored metadata record.
 */
export function offlineInstallPack(meta, entries, onProgress) {
  if (!meta || !meta.id || /\|/.test(meta.id)) return Promise.reject(new Error('Invalid pack id'));
  var id = meta.id, total = entries.length, size = 0;
  offlineRequestPersist();
  // Replace semantics: clear any older copy first, then write fresh.
  return offlineRemovePack(id).then(function () {
    var i = 0;
    function next() {
      if (i >= total) return Promise.resolve();
      var slice = entries.slice(i, i + BATCH);
      return run(['data'], 'readwrite', function (t) {
        var st = t.objectStore('data');
        slice.forEach(function (e) { st.put(e[1], dataKey(id, e[0])); size += JSON.stringify(e[1]).length; });
      }).then(function () { i += slice.length; if (onProgress) { try { onProgress(i, total); } catch (e) {} } return next(); });
    }
    return next();
  }).then(function () {
    var rec = { id: id, name: meta.name || id, version: String(meta.version || '1'), format: 'json', size: size, count: total, installedAt: Date.now(), license: meta.license || '' };
    return run(['packs'], 'readwrite', function (t) { t.objectStore('packs').put(rec, id); }).then(function () { return rec; });
  }).catch(function (err) {
    return offlineRemovePack(id).catch(function () {}).then(function () { throw err; });
  });
}

/**
 * Installs (or replaces) a pack one file at a time, so a large pack (the 31 MB Old Testament interlinear) never has to
 * sit in memory all at once. Same safety rules as offlineInstallPack: the old copy is cleared first, the pack's metadata
 * is written LAST (a pack only "exists" once every file is stored), and any failure removes everything written so far
 * and rethrows. Files are fetched and stored strictly in order.
 * @param {{id:string,name:string,version:string,license?:string}} meta - Pack description.
 * @param {string[]} keys - One key per file (here: the file's path under the data CDN).
 * @param {function(string):Promise<*>} load - Resolves the payload (plain JSON data) for one key; may reject.
 * @returns {Promise<object>} The stored metadata record.
 */
export function offlineInstallStreamed(meta, keys, load) {
  if (!meta || !meta.id || /\|/.test(meta.id)) return Promise.reject(new Error('Invalid pack id'));
  var id = meta.id, size = 0, i = 0;
  offlineRequestPersist();
  return offlineRemovePack(id).then(function () {
    function next() {
      if (i >= keys.length) return Promise.resolve();
      var key = keys[i];
      return Promise.resolve(load(key)).then(function (payload) {
        size += JSON.stringify(payload).length;
        return run(['data'], 'readwrite', function (t) { t.objectStore('data').put(payload, dataKey(id, key)); });
      }).then(function () { i++; return next(); });
    }
    return next();
  }).then(function () {
    var rec = { id: id, name: meta.name || id, version: String(meta.version || '1'), format: 'json', size: size, count: keys.length, installedAt: Date.now(), license: meta.license || '' };
    return run(['packs'], 'readwrite', function (t) { t.objectStore('packs').put(rec, id); }).then(function () { return rec; });
  }).catch(function (err) {
    return offlineRemovePack(id).catch(function () {}).then(function () { throw err; });
  });
}

/**
 * Removes one pack (its data and its metadata). Resolves even if the pack was not installed.
 * @param {string} packId
 * @returns {Promise<void>}
 */
export function offlineRemovePack(packId) {
  return run(['data', 'packs'], 'readwrite', function (t) {
    t.objectStore('data').delete(packRange(packId));
    t.objectStore('packs').delete(packId);
  });
}

/**
 * Removes every downloaded pack. Only ever called from the Settings "Delete all downloads" path, never from Clear All Data.
 * @returns {Promise<void>}
 */
export function offlineRemoveAll() {
  return run(['data', 'packs'], 'readwrite', function (t) { t.objectStore('data').clear(); t.objectStore('packs').clear(); });
}

/**
 * Reads one entry from a pack. Never throws: resolves null when the pack, the entry or the storage itself is missing.
 * @param {string} packId
 * @param {string} key
 * @returns {Promise<*|null>}
 */
export function offlineGet(packId, key) {
  return run(['data'], 'readonly', function (t) { return t.objectStore('data').get(dataKey(packId, key)); })
    .then(function (v) { return v === undefined ? null : v; })
    .catch(function () { return null; });
}

/**
 * Asks the browser to keep this site's storage (so a low-space phone does not silently delete downloads).
 * Safe to call repeatedly. Resolves true / false / null (unknown or unsupported).
 * @returns {Promise<boolean|null>}
 */
export function offlineRequestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted().then(function (p) { return p ? true : navigator.storage.persist(); })
      .then(function (p) { _persisted = !!p; return _persisted; }).catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}

// ════════════════════════════════════════════════════════
// LOOKUP HOOK (used by getBibleAPI in studyTools.js)
// ════════════════════════════════════════════════════════

/**
 * True when the named pack is fully installed on this phone (metadata is written last, so it only exists once complete).
 * @param {string} packId - e.g. "bible-ylt".
 * @returns {Promise<boolean>} Never rejects.
 */
export function offlineHasPack(packId) {
  return offlineListPacks().then(function (ps) { return ps.some(function (p) { return p.id === packId; }); }).catch(function () { return false; });
}

/**
 * True when a downloaded Bible pack could answer for this version (so an offline phone should still try the lookup
 * instead of refusing). ESV has no pack, so it is always false.
 * @param {string} trans - Version id from a translation picker, e.g. "kjv".
 * @returns {Promise<boolean>} Never rejects.
 */
export function offlineCanRead(trans) {
  return trans && trans !== 'esv' ? offlineHasPack('bible-' + trans) : Promise.resolve(false);
}

/**
 * Offline scripture lookup. Mirrors the text shape getBibleAPI returns ("[16] text [17] text").
 * Returns null when there is no downloaded pack, the chapter is missing, or the reference cannot be parsed, so the
 * caller can fall through to the network. Never throws. Handles a whole chapter, a verse, a range and a comma list.
 * @param {string} ref - Bible reference, e.g. "John 3:16-17".
 * @param {string} trans - Lowercase translation code, e.g. "kjv". Pack id is "bible-" + trans.
 * @returns {Promise<string|null>}
 */
export function offlineBibleText(ref, trans) {
  var p;
  try { p = parseRef(ref); } catch (e) { return Promise.resolve(null); }
  if (!p) return Promise.resolve(null);
  return offlineGet('bible-' + String(trans).toLowerCase(), p.book + ':' + p.chapter).then(function (verses) {
    if (!verses || !verses.length) return null;
    var commaMatch = ref.match(/:(\d+(?:,\d+)+)$/);
    if (commaMatch) {
      var listed = commaMatch[1].split(',').map(Number);
      verses = verses.filter(function (v) { return listed.indexOf(v.verse) >= 0; });
      verses.sort(function (a, b) { return listed.indexOf(a.verse) - listed.indexOf(b.verse); });
    } else if (p.startVerse) {
      var end = p.endVerse || p.startVerse;
      verses = verses.filter(function (v) { return v.verse >= p.startVerse && v.verse <= end; });
    }
    if (!verses.length) return null;
    // A verse this version leaves out is stored with empty text; say so instead of showing a blank
    return verses.map(function (v) { var t = String(v.text).trim(); return '[' + v.verse + '] ' + (t || '(omitted in this version)'); }).join(' ');
  });
}

/**
 * Offline study-data lookup for fetchGroundData(path). Returns the parsed file from a downloaded pack, or null
 * (no pack, file missing, storage unavailable) so the caller falls through to the network. Never throws.
 * @param {string} path - e.g. "strongs/gloss-index.json".
 * @returns {Promise<*|null>}
 */
export function offlineGroundData(path) {
  var i = 0;
  function next() {
    if (i >= GROUND_PACKS.length) return Promise.resolve(null);
    return offlineGet(GROUND_PACKS[i++], path).then(function (v) { return v === null ? next() : v; });
  }
  return next();
}

/**
 * Starts (or queues) a catalog pack download. Up to MAX_ACTIVE packs download at once; the others wait their turn.
 * Tapping a pack that is already downloading or queued does nothing new and resolves when that download ends.
 * Updates the Settings section as it goes. Never throws; failures are shown on the pack row.
 * @param {string} packId - A catalog id, e.g. "words-core".
 * @returns {Promise<boolean>} true when installed.
 */
export function offlineDownloadPack(packId) {
  var def = catalogDef(packId);
  if (!def) return Promise.resolve(false);
  if (navigator.onLine === false) { _dlErr[packId] = 'You are offline. Connect to the internet to download.'; renderOfflineSection(); return Promise.resolve(false); }
  delete _dlErr[packId];
  return new Promise(function (resolve) {
    (_waiters[packId] = _waiters[packId] || []).push(resolve);
    if (!_dls[packId] && _queue.indexOf(packId) < 0) _queue.push(packId);
    renderOfflineSection();
    pumpQueue();
  });
}

/** Catalog row for an id, or undefined. */
function catalogDef(packId) { return OFFLINE_CATALOG.filter(function (c) { return c.id === packId; })[0]; }

/** Starts queued downloads while fewer than MAX_ACTIVE are running. */
function pumpQueue() {
  while (_queue.length && Object.keys(_dls).length < MAX_ACTIVE) {
    var id = _queue.shift();
    runDownload(id); // its result goes to the waiters inside runDownload
  }
}

/**
 * Fetches one URL as JSON, retrying a refused or flaky request (403, 429, server errors, a dropped connection) with a
 * growing pause. A missing file (404) or any other client error is not retried. The final error names the file.
 * @param {string} path - File path under OFFLINE_DATA_CDN.
 * @param {string} v - Cache-buster query, e.g. "?v=1".
 * @returns {Promise<*>} Parsed JSON.
 */
function fetchWithRetry(path, v) {
  var attempt = 0;
  function go() {
    attempt++;
    return fetch(OFFLINE_DATA_CDN + path + v).then(function (r) {
      if (r.ok) return r.json();
      var err = new Error('A file could not be downloaded (code ' + r.status + ', ' + path + ').');
      err.retry = r.status === 403 || r.status === 429 || r.status >= 500;
      throw err;
    }, function () {
      var err = new Error('Download failed. Check your connection and try again.'); err.retry = true; throw err;
    }).catch(function (err) {
      if (err && err.retry && attempt < RETRY_TRIES) {
        return new Promise(function (res) { setTimeout(res, RETRY_PAUSE_MS * attempt); }).then(go);
      }
      throw err;
    });
  }
  return go();
}

/**
 * Runs one pack download to the end (the slot was already granted by pumpQueue), then wakes its waiters and the queue.
 * @param {string} packId
 * @returns {Promise<boolean>} true when installed.
 */
function runDownload(packId) {
  var def = catalogDef(packId);
  _dls[packId] = { done: 0, total: def.kind === 'bible' ? 1 : def.files.length };
  renderOfflineSection();
  var v = '?v=' + encodeURIComponent(def.version);
  var meta = { id: def.id, name: def.name, version: def.version, license: def.license };
  var done;
  if (def.kind === 'bible') {
    // one file holds every chapter: store one entry per "book:chapter"; refuse a file that is not a whole Bible
    done = fetchWithRetry(def.file, v).then(function (data) {
      var keys = Object.keys(data);
      if (keys.length < 1100) throw new Error('A file could not be downloaded (it looks incomplete).');
      _dls[packId].done++; renderOfflineSection();
      return offlineInstallPack(meta, keys.map(function (k) { return [k, data[k]]; }));
    });
  } else {
    // study data, many files: fetch and store one at a time; nothing is kept if any file fails
    done = offlineInstallStreamed(meta, def.files, function (path) {
      return fetchWithRetry(path, v).then(function (data) { _dls[packId].done++; renderOfflineSection(); return data; });
    });
  }
  return done.then(function () { toast(def.name + ' downloaded'); return true; })
    .catch(function (e) {
      logError('offlineDownloadPack', e);
      _dlErr[packId] = (e && e.name === 'QuotaExceededError') ? 'Not enough space on this device.' : (e && e.message && /^(A file|Download failed)/.test(e.message)) ? e.message : 'Download failed. Check your connection and try again.';
      return false;
    }).then(function (ok) {
      delete _dls[packId];
      var ws = _waiters[packId] || []; delete _waiters[packId];
      ws.forEach(function (w) { w(ok); });
      renderOfflineSection();
      pumpQueue();
      return ok;
    });
}

/** Click handler for the "Download all" button: queues every pack that is not saved yet (or has an update). */
export function offlineDownloadAll() {
  return offlineListPacks().then(function (packs) {
    var byId = {}; packs.forEach(function (p) { byId[p.id] = p; });
    var todo = OFFLINE_CATALOG.filter(function (c) { return !byId[c.id] || byId[c.id].version !== c.version; })
      .map(function (c) { return c.id; });
    return Promise.all(todo.map(offlineDownloadPack));
  });
}

/** Click handler for a catalog pack's Download / Update button (data-pack holds the id). */
export function offlineDownloadClick(btn) {
  var id = btn && btn.getAttribute('data-pack');
  if (id) offlineDownloadPack(id);
}

// ════════════════════════════════════════════════════════
// SETTINGS > OFFLINE DOWNLOADS
// ════════════════════════════════════════════════════════

function mb(n) { return (n / 1000000).toFixed(1); }

/**
 * Renders Settings > Offline Downloads: each downloadable pack with Download / Update / two-tap Delete, its size, any
 * error, and whether the browser has promised to keep downloads. Read-only apart from the Delete buttons. Never throws.
 */
export function renderOfflineSection() {
  var el = document.getElementById('offline-list');
  if (!el) return Promise.resolve();
  return offlineListPacks().then(function (packs) {
    var byId = {}, total = 0, html = '', lastGroup = '';
    packs.forEach(function (p) { byId[p.id] = p; total += p.size || 0; });
    var pending = OFFLINE_CATALOG.filter(function (c) { return (!byId[c.id] || byId[c.id].version !== c.version) && !_dls[c.id] && _queue.indexOf(c.id) < 0; });
    if (pending.length) {
      var pmb = pending.reduce(function (n, c) { return n + c.approxMB; }, 0);
      html += '<button class="btn btn-sec" style="width:100%;margin-top:10px" onclick="offlineDownloadAll()">Download all (' + pending.length + ' not saved yet, about ' + Math.round(pmb) + ' MB)</button>';
    }
    var rowStart = '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">';
    OFFLINE_CATALOG.forEach(function (c) {
      var group = c.kind === 'bible' ? 'bible' : 'study';
      if (group !== lastGroup) {
        lastGroup = group;
        html += '<div style="font-size:12px;color:var(--gold);margin-top:12px;letter-spacing:.04em">' + (group === 'bible'
          ? 'BIBLE TEXT (read and pull into studies with no internet)' : 'STUDY DATA (word tools, cross-references and interlinear)') + '</div>';
      }
      var p = byId[c.id], busy = !!_dls[c.id], queued = _queue.indexOf(c.id) >= 0, err = _dlErr[c.id];
      var sub = busy ? (c.kind === 'bible' ? 'Downloading and saving\u2026' : 'Downloading file ' + Math.min(_dls[c.id].done + 1, _dls[c.id].total) + ' of ' + _dls[c.id].total + '\u2026')
        : queued ? 'Waiting for another download to finish\u2026'
        : p ? mb(p.size) + ' MB &middot; saved ' + escHtml(new Date(p.installedAt).toLocaleDateString()) + (p.version !== c.version ? ' &middot; <span style="color:var(--gold)">update available</span>' : '')
        : 'about ' + c.approxMB + ' MB &middot; ' + escHtml(c.about);
      html += rowStart + '<div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--txt1)">' + escHtml(c.name) + '</div>'
        + '<div style="font-size:12px;color:var(--txt3)">' + sub + '</div>'
        + (err ? '<div style="font-size:12px;color:var(--crimsonbright)">' + escHtml(err) + '</div>' : '')
        + '<div style="font-size:11px;color:var(--txt4)">' + escHtml(c.license) + '</div></div>';
      if (busy) html += '<button class="btn btn-ghost" style="padding:8px 12px" disabled>Please wait</button>';
      else if (queued) html += '<button class="btn btn-ghost" style="padding:8px 12px" disabled>Queued</button>';
      else if (p && p.version === c.version) html += deleteButton(p.id);
      else html += '<button class="btn btn-sec" style="padding:8px 12px" data-pack="' + escHtml(c.id) + '" onclick="offlineDownloadClick(this)">' + (p ? 'Update' : 'Download') + '</button>';
      html += '</div>';
    });
    packs.forEach(function (p) {
      if (OFFLINE_CATALOG.some(function (c) { return c.id === p.id; })) return;
      html += rowStart + '<div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--txt1)">' + escHtml(p.name) + '</div>'
        + '<div style="font-size:12px;color:var(--txt3)">' + mb(p.size) + ' MB &middot; saved ' + escHtml(new Date(p.installedAt).toLocaleDateString()) + (p.license ? ' &middot; ' + escHtml(p.license) : '') + '</div></div>' + deleteButton(p.id) + '</div>';
    });
    html += '<div style="font-size:12px;color:var(--txt3);margin-top:8px">' + (total ? 'Downloads use ' + mb(total) + ' MB. ' : '') + 'Downloads are not part of backups, and Clear All Data does not remove them.</div>';
    if (total && _persisted === false) html += '<div style="font-size:12px;color:var(--gold);margin-top:4px">If this device runs low on space, it may clear these downloads. You can download them again.</div>';
    el.innerHTML = html;
  }).catch(function (e) { logError('renderOfflineSection', e); });
}

/** Two-tap Delete button markup for one pack row. */
function deleteButton(id) {
  var armed = !!_armed[id];
  return '<button class="btn ' + (armed ? 'btn-danger' : 'btn-ghost') + '" style="padding:8px 12px" data-pack="' + escHtml(id) + '" onclick="offlineDeleteClick(this)">' + (armed ? 'Tap again to delete' : 'Delete') + '</button>';
}

/**
 * Click handler for a pack's Delete button. First tap arms it ("Tap again to delete", resets after 4 seconds),
 * second tap deletes that pack only.
 * @param {HTMLElement} btn - The button; its data-pack attribute holds the pack id.
 */
export function offlineDeleteClick(btn) {
  var id = btn && btn.getAttribute('data-pack');
  if (!id) return;
  if (!_armed[id]) {
    _armed[id] = true;
    renderOfflineSection();
    setTimeout(function () { delete _armed[id]; renderOfflineSection(); }, 4000);
    return;
  }
  delete _armed[id];
  offlineRemovePack(id).then(function () { toast('Download deleted'); return renderOfflineSection(); })
    .catch(function (e) { logError('offlineDeleteClick', e); toast('Could not delete that download'); });
}
