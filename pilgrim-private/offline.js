// offline.js — Pilgrim Private: offline downloads store (Phase 1, v4.64.0 — Nov 2026)
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

import { parseRef, escHtml, toast, logError } from './utils.js?v=4.66.0';

/** Where the static study data lives (jsDelivr mirror of arche-suite/data/). studyTools.js reuses this as GROUND_CDN. */
export var OFFLINE_DATA_CDN = 'https://cdn.jsdelivr.net/gh/arche-epos/arche-suite@main/data/';

/**
 * Downloadable packs. `files` are paths under OFFLINE_DATA_CDN; each is stored parsed under its own path, so
 * fetchGroundData(path) can be answered from the phone. Bump `version` when the files change (Settings then offers Update).
 */
var OFFLINE_CATALOG = [
  { id: 'words-core', name: 'Word study data', about: 'Hebrew and Greek dictionaries and the word index, for Look Up Word and word lists',
    version: '1', approxMB: 4.9, license: 'Open Scriptures (CC BY-SA / public domain)',
    files: ['strongs/hebrew.json', 'strongs/greek.json', 'strongs/gloss-index.json', 'strongs/occurrence-index.json'] },
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
var GROUND_PACKS = ['words-core']; // packs consulted by offlineGroundData, in order (Phase 4 adds crossrefs and interlinear)

var DB_NAME = 'pilgrimOffline';
var DB_VERSION = 1;
var BATCH = 40;            // entries written per transaction while installing a pack
var _db = null;
var _armed = {};           // pack id -> true while its Delete button waits for a second tap
var _dl = null;            // { id, done, total } while a download runs
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
 * Downloads a catalog pack: fetches each file (no partial installs: a failure keeps nothing), then stores them all.
 * Updates the Settings section as it goes. Never throws; failures are shown on the pack row.
 * @param {string} packId - A catalog id, e.g. "words-core".
 * @returns {Promise<boolean>} true when installed.
 */
export function offlineDownloadPack(packId) {
  var def = OFFLINE_CATALOG.filter(function (c) { return c.id === packId; })[0];
  if (!def || _dl) return Promise.resolve(false);
  if (navigator.onLine === false) { _dlErr[packId] = 'You are offline. Connect to the internet to download.'; renderOfflineSection(); return Promise.resolve(false); }
  delete _dlErr[packId];
  var paths = def.kind === 'bible' ? [def.file] : def.files;
  _dl = { id: packId, done: 0, total: paths.length };
  renderOfflineSection();
  var entries = [];
  var v = '?v=' + encodeURIComponent(def.version);
  return paths.reduce(function (chain, path) {
    return chain.then(function () {
      return fetch(OFFLINE_DATA_CDN + path + v).then(function (r) {
        if (!r.ok) throw new Error('A file could not be downloaded (code ' + r.status + ').');
        return r.json();
      }).then(function (data) {
        if (def.kind === 'bible') {
          // one file holds every chapter: store one entry per "book:chapter"; refuse a file that is not a whole Bible
          var keys = Object.keys(data);
          if (keys.length < 1100) throw new Error('A file could not be downloaded (it looks incomplete).');
          keys.forEach(function (k) { entries.push([k, data[k]]); });
        } else entries.push([path, data]);
        _dl.done++; renderOfflineSection();
      });
    });
  }, Promise.resolve()).then(function () {
    return offlineInstallPack({ id: def.id, name: def.name, version: def.version, license: def.license }, entries);
  }).then(function () { toast(def.name + ' downloaded'); return true; })
    .catch(function (e) {
      logError('offlineDownloadPack', e);
      _dlErr[packId] = (e && e.name === 'QuotaExceededError') ? 'Not enough space on this device.' : (e && e.message && /^A file/.test(e.message)) ? e.message : 'Download failed. Check your connection and try again.';
      return false;
    }).then(function (ok) { _dl = null; renderOfflineSection(); return ok; });
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
    var byId = {}, total = 0, html = '', bibleHeadDone = false;
    packs.forEach(function (p) { byId[p.id] = p; total += p.size || 0; });
    var rowStart = '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">';
    OFFLINE_CATALOG.forEach(function (c) {
      if (c.kind === 'bible' && !bibleHeadDone) {
        bibleHeadDone = true;
        html += '<div style="font-size:12px;color:var(--gold);margin-top:12px;letter-spacing:.04em">BIBLE TEXT (read and pull into studies with no internet)</div>';
      }
      var p = byId[c.id], busy = _dl && _dl.id === c.id, err = _dlErr[c.id];
      var sub = busy ? (c.kind === 'bible' ? 'Downloading and saving\u2026' : 'Downloading file ' + Math.min(_dl.done + 1, _dl.total) + ' of ' + _dl.total + '\u2026')
        : p ? mb(p.size) + ' MB &middot; saved ' + escHtml(new Date(p.installedAt).toLocaleDateString()) + (p.version !== c.version ? ' &middot; <span style="color:var(--gold)">update available</span>' : '')
        : 'about ' + c.approxMB + ' MB &middot; ' + escHtml(c.about);
      html += rowStart + '<div style="flex:1;min-width:0"><div style="font-size:14px;color:var(--txt1)">' + escHtml(c.name) + '</div>'
        + '<div style="font-size:12px;color:var(--txt3)">' + sub + '</div>'
        + (err ? '<div style="font-size:12px;color:var(--crimsonbright)">' + escHtml(err) + '</div>' : '')
        + '<div style="font-size:11px;color:var(--txt4)">' + escHtml(c.license) + '</div></div>';
      if (busy) html += '<button class="btn btn-ghost" style="padding:8px 12px" disabled>Please wait</button>';
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
