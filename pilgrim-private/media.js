// media.js — Pilgrim Private: class Transcript (Pass 1) + Recording (Pass 2) storage
// Added v4.35.0 — Sep 2026. Spec: spec-transcript-recording-v2.md
//
// Everything here lives in a per-user IndexedDB (pilgrimMedia_<userId>), NOT
// localStorage and NOT on the study record. The study data model, Gist sync
// payload and PDF export are deliberately untouched.
//
//   transcripts : studyId -> { text, cues[], sourceName, addedAt }
//   recordings  : studyId -> { blob, mime, name, size, addedAt }   (Pass 2)
//   meta        : studyId -> { hasTranscript, hasRecording, recordingPosition, recordingName }
//
// `meta` is mirrored in an in-memory cache (_meta) hydrated at boot by mediaInit().

import {
  ACTIVE_USER, cur, toast, toastSuccess, escHtml, logError, closeOverlay
} from './utils.js?v=4.35.1';

var DB_VERSION = 1;
var STORES = ['transcripts', 'recordings', 'meta'];
var TR_EXTS = ['txt', 'docx', 'pdf', 'vtt', 'srt'];
var PDFJS_VER = '3.11.174';

var _db = null;
var _dbName = '';
var _meta = {};          // in-memory cache of the `meta` store
var _pdfP = null;        // lazy pdf.js load promise
var _trRec = null;       // transcript record currently shown in the Study tab
var _trOpen = false;
var _pending = null;     // { studyId, rec } waiting on the replace confirmation
var _confirmFn = null;   // action bound to the shared confirm overlay
var _searchT = null;

// ════════════════════════════════════════════════════════
// DB LAYER
// ════════════════════════════════════════════════════════

function dbName() { return 'pilgrimMedia_' + ACTIVE_USER; }

function openDB() {
  var name = dbName();
  if (_db && _dbName === name) return Promise.resolve(_db);
  if (_db) { try { _db.close(); } catch (e) {} _db = null; _meta = {}; }
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB is not available in this browser')); return; }
    var req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = function () {
      var d = req.result;
      STORES.forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
    };
    req.onsuccess = function () {
      _db = req.result; _dbName = name;
      _db.onversionchange = function () { try { _db.close(); } catch (e) {} _db = null; };
      resolve(_db);
    };
    req.onerror = function () { reject(req.error || new Error('Could not open media storage')); };
  });
}

// Runs fn(tx) in one transaction; resolves with fn's returned request .result (if any).
function run(stores, mode, fn) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(stores, mode), out;
      try { out = fn(t); } catch (e) { reject(e); return; }
      t.oncomplete = function () { resolve(out && typeof out === 'object' && 'result' in out ? out.result : undefined); };
      t.onerror = t.onabort = function () { reject(t.error || new Error('Media storage transaction failed')); };
    });
  });
}

/**
 * Opens this user's media DB and hydrates the in-memory meta cache.
 * Called from startPilgrim(). Never throws — failures are logged and the
 * transcript feature reports "storage unavailable" when used.
 */
export function mediaInit() {
  return openDB().then(function (db) {
    return new Promise(function (resolve) {
      var next = {};
      var req = db.transaction('meta', 'readonly').objectStore('meta').openCursor();
      req.onsuccess = function () {
        var c = req.result;
        if (c) { next[c.key] = c.value; c.continue(); }
        else { _meta = next; resolve(); }
      };
      req.onerror = function () { resolve(); };
    });
  }).then(function () { trRefresh(); }).catch(function (e) { logError('Media Init', e); });
}

function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
}

// Resolves true if there is room for `bytes` (+ headroom); false if storage is short.
function hasRoom(bytes) {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (est) {
        if (!est || !est.quota) return true;
        return (est.quota - (est.usage || 0)) > bytes + 1024 * 1024;
      }).catch(function () { return true; });
    }
  } catch (e) {}
  return Promise.resolve(true);
}

export function mediaHasTranscript(studyId) {
  return !!(_meta[studyId] && _meta[studyId].hasTranscript);
}

function putMetaTx(t, studyId, m) {
  if (!m.hasTranscript && !m.hasRecording) { delete _meta[studyId]; return t.objectStore('meta').delete(studyId); }
  _meta[studyId] = m; return t.objectStore('meta').put(m, studyId);
}

function blankMeta() { return { hasTranscript: false, hasRecording: false, recordingPosition: 0, recordingName: '' }; }

function saveTranscript(studyId, rec) {
  var m = Object.assign(blankMeta(), _meta[studyId] || {}, { hasTranscript: true });
  return run(['transcripts', 'meta'], 'readwrite', function (t) {
    t.objectStore('transcripts').put(rec, studyId);
    return putMetaTx(t, studyId, m);
  });
}

function getTranscript(studyId) {
  return run('transcripts', 'readonly', function (t) { return t.objectStore('transcripts').get(studyId); });
}

function deleteTranscript(studyId) {
  var m = Object.assign(blankMeta(), _meta[studyId] || {}, { hasTranscript: false });
  return run(['transcripts', 'meta'], 'readwrite', function (t) {
    t.objectStore('transcripts').delete(studyId);
    return putMetaTx(t, studyId, m);
  });
}

/**
 * Removes a study's transcript, recording and meta. Called from deleteStudy().
 * Never rejects — a media-store failure must not block deleting the study.
 */
export function mediaDeleteStudy(studyId) {
  return run(STORES, 'readwrite', function (t) {
    STORES.forEach(function (s) { t.objectStore(s).delete(studyId); });
  }).then(function () { delete _meta[studyId]; })
    .catch(function (e) { logError('Media Delete Study', e); });
}

/** Wipes this user's whole media DB contents. Called from "Clear all data". Never rejects. */
export function mediaClearAll() {
  return run(STORES, 'readwrite', function (t) {
    STORES.forEach(function (s) { t.objectStore(s).clear(); });
  }).then(function () { _meta = {}; })
    .catch(function (e) { logError('Media Clear All', e); });
}

// ════════════════════════════════════════════════════════
// BACKUP / RESTORE (transcript text only — audio is never exported)
// ════════════════════════════════════════════════════════

/**
 * Returns { <studyId>: {text,cues,sourceName,addedAt} } for the given study IDs
 * (all transcripts whose study still exists). Empty object if none / on error.
 */
export function mediaExportTranscripts(studyIds) {
  var want = {}; (studyIds || []).forEach(function (id) { want[id] = true; });
  return openDB().then(function (db) {
    return new Promise(function (resolve) {
      var out = {};
      var req = db.transaction('transcripts', 'readonly').objectStore('transcripts').openCursor();
      req.onsuccess = function () {
        var c = req.result;
        if (c) { if (want[c.key]) out[c.key] = c.value; c.continue(); }
        else resolve(out);
      };
      req.onerror = function () { resolve(out); };
    });
  }).catch(function (e) { logError('Media Export Transcripts', e); return {}; });
}

/**
 * Restores transcripts from a backup. Adds a transcript ONLY to a study that
 * exists locally and has none — never overwrites. Resolves with the number added.
 */
export function mediaImportTranscripts(map, localStudyIds) {
  var ok = {}; (localStudyIds || []).forEach(function (id) { ok[id] = true; });
  var ids = Object.keys(map || {}).filter(function (id) {
    var r = map[id];
    return ok[id] && !mediaHasTranscript(id) && r && typeof r.text === 'string' && r.text.trim();
  });
  if (!ids.length) return Promise.resolve(0);
  return run(['transcripts', 'meta'], 'readwrite', function (t) {
    ids.forEach(function (id) {
      var r = map[id];
      t.objectStore('transcripts').put({
        text: r.text,
        cues: Array.isArray(r.cues) ? r.cues : [],
        sourceName: typeof r.sourceName === 'string' ? r.sourceName : '',
        addedAt: r.addedAt || new Date().toISOString()
      }, id);
      putMetaTx(t, id, Object.assign(blankMeta(), _meta[id] || {}, { hasTranscript: true }));
    });
  }).then(function () { return ids.length; })
    .catch(function (e) { logError('Media Import Transcripts', e); return 0; });
}

// ════════════════════════════════════════════════════════
// PARSING — VTT / SRT / TXT / DOCX / PDF  ->  { text, cues }
// ════════════════════════════════════════════════════════

function tsToSec(s) {
  var m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? parseFloat('0.' + m[4]) : 0);
}

function cleanCueText(t) {
  return t
    .replace(/<v\s+([^>]+)>/gi, '$1: ')     // WebVTT voice tag -> "Speaker: "
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** Parses WebVTT or SRT text into cues: [{ t: startSec, e: endSec|null, text }]. */
export function trParseCues(raw) {
  var lines = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  var cues = [], i = 0, prev = '';
  while (i < lines.length) {
    var arrow = lines[i].indexOf('-->');
    if (arrow > -1) {
      var start = tsToSec(lines[i].slice(0, arrow));
      var end = tsToSec(lines[i].slice(arrow + 3).trim().split(/\s+/)[0]);
      var buf = []; i++;
      while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++; }
      var txt = cleanCueText(buf.join(' '));
      if (start !== null && txt && txt !== prev) { cues.push({ t: start, e: end, text: txt }); prev = txt; }
    } else i++;
  }
  return cues;
}

/** Turns cues into clean display paragraphs (no timestamps / cue numbers). */
export function trCuesToText(cues) {
  var paras = [], p = '', lastSpk = '', prevEnd = null, prevText = '';
  cues.forEach(function (c) {
    var text = c.text, newPara = false;
    var m = text.match(/^([A-Z][A-Za-z.'\-]*(?: [A-Za-z.'\-]+){0,2}):\s+(.+)$/);
    if (m) {
      if (m[1] !== lastSpk) newPara = true; else text = m[2];
      lastSpk = m[1];
    } else if (prevEnd !== null && c.t - prevEnd >= 2.5 && /[.?!"\u201d]$/.test(prevText)) newPara = true;
    else if (p.length > 700 && /[.?!]$/.test(prevText)) newPara = true;
    if (newPara && p) { paras.push(p); p = ''; }
    p = p ? p + ' ' + text : text;
    prevEnd = c.e != null ? c.e : c.t; prevText = text;
  });
  if (p) paras.push(p);
  return paras.join('\n\n');
}

function normText(t) {
  return t.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function readAs(file, kind) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error('Could not read that file')); };
    if (kind === 'buffer') r.readAsArrayBuffer(file); else r.readAsText(file);
  });
}

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfP) return _pdfP;
  var base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VER + '/';
  _pdfP = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = base + 'pdf.min.js';
    s.onload = function () {
      if (!window.pdfjsLib) { _pdfP = null; reject(new Error('PDF reader failed to load')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = function () { _pdfP = null; reject(new Error('Could not load the PDF reader — check your connection')); };
    document.head.appendChild(s);
  });
  return _pdfP;
}

// Rebuilds lines from pdf.js text items, then groups lines into paragraphs by vertical gap.
function pdfPageParas(page) {
  return page.getTextContent().then(function (tc) {
    var lines = [], line = null, lastEnd = 0;
    tc.items.forEach(function (it) {
      if (typeof it.str !== 'string') return;
      var y = it.transform[5], x = it.transform[4], h = it.height || Math.abs(it.transform[3]) || 10;
      if (!line || Math.abs(y - line.y) > h * 0.5) {
        if (line) lines.push(line);
        line = { y: y, h: h, text: '' }; lastEnd = 0;
      } else if (x - lastEnd > h * 0.2 && line.text && !/\s$/.test(line.text) && !/^\s/.test(it.str)) {
        line.text += ' ';
      }
      line.text += it.str; lastEnd = x + (it.width || 0);
    });
    if (line) lines.push(line);
    var paras = [], p = '', prev = null;
    lines.forEach(function (l) {
      var t = l.text.replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (prev && (prev.y - l.y) > Math.max(prev.h, l.h) * 1.8 && p) { paras.push(p); p = ''; }
      p = p ? p + ' ' + t : t; prev = l;
    });
    if (p) paras.push(p);
    return paras;
  });
}

function parsePdf(file) {
  return Promise.all([loadPdfJs(), readAs(file, 'buffer')]).then(function (r) {
    return r[0].getDocument({ data: r[1] }).promise;
  }).then(function (pdf) {
    var all = [], chain = Promise.resolve();
    for (var n = 1; n <= pdf.numPages; n++) {
      (function (num) {
        chain = chain.then(function () { return pdf.getPage(num); })
          .then(pdfPageParas)
          .then(function (paras) {
            // A paragraph that doesn't end a sentence continues across the page break
            if (all.length && paras.length && !/[.?!"\u201d]$/.test(all[all.length - 1])) all[all.length - 1] += ' ' + paras.shift();
            all = all.concat(paras);
          });
      })(n);
    }
    return chain.then(function () { return all.join('\n\n'); });
  }).then(function (text) {
    if (text.replace(/\s/g, '').length < 20) throw new Error('This PDF looks scanned (no selectable text) \u2014 scanned PDFs aren\u2019t supported');
    return { text: text, cues: [] };
  });
}

/** Parses a File by extension into { text, cues }. Rejects with a user-readable message. */
export function trParseFile(file, ext) {
  ext = ext || (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'vtt' || ext === 'srt') {
    return readAs(file, 'text').then(function (raw) {
      var cues = trParseCues(raw);
      if (!cues.length) throw new Error('No captions found in that file');
      return { text: trCuesToText(cues), cues: cues };
    });
  }
  if (ext === 'docx') {
    if (typeof mammoth === 'undefined') return Promise.reject(new Error('Document reader not loaded \u2014 try refreshing'));
    return readAs(file, 'buffer').then(function (buf) {
      return mammoth.extractRawText({ arrayBuffer: buf });
    }).then(function (r) { return { text: normText(r.value || ''), cues: [] }; });
  }
  if (ext === 'pdf') return parsePdf(file);
  return readAs(file, 'text').then(function (raw) { return { text: normText(raw), cues: [] }; });
}

// ════════════════════════════════════════════════════════
// UPLOAD FLOW (Add Files to Study -> Transcript)
// ════════════════════════════════════════════════════════

/** "Transcript" button in the Add Files to Study modal. */
export function trPickTranscript() {
  closeOverlay('addres-overlay');
  if (!cur) { toast('Open a study first'); return; }
  var el = document.getElementById('res-input-transcript');
  if (!el) return;
  el.value = ''; el.click();
}

/** onchange handler of #res-input-transcript. */
export function trHandleFile(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (!cur) { toast('Open a study first'); return; }
  var sid = cur.id;
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (TR_EXTS.indexOf(ext) < 0) { toast('Transcripts can be TXT, DOCX, PDF, VTT or SRT'); return; }
  toast('Reading ' + file.name + '...');
  trParseFile(file, ext).then(function (r) {
    if (!r.text || !r.text.trim()) throw new Error('No text could be found in that file');
    if (!cur || cur.id !== sid) { toast('Study changed \u2014 transcript not added'); return; }
    var rec = { text: r.text, cues: r.cues || [], sourceName: file.name, addedAt: new Date().toISOString() };
    if (mediaHasTranscript(sid)) {
      _pending = { studyId: sid, rec: rec };
      openConfirm('Replace transcript?', 'This study already has a transcript. Replace it with \u201c' + file.name + '\u201d? The old one will be removed from this device.', 'Replace', 'btn btn-primary', function () {
        var p = _pending; _pending = null;
        if (p) commitTranscript(p.studyId, p.rec);
      });
    } else commitTranscript(sid, rec);
  }).catch(function (e) {
    logError('Transcript Upload', e);
    toast(e && e.message ? e.message : 'Could not read that file');
  });
}

function commitTranscript(studyId, rec) {
  var need = rec.text.length * 2 + rec.cues.length * 80;
  return hasRoom(need).then(function (ok) {
    if (!ok) { toast('Not enough free storage on this device for this transcript'); return; }
    requestPersist();
    return saveTranscript(studyId, rec).then(function () {
      toastSuccess('\u2713 Transcript added');
      if (cur && cur.id === studyId) trRefresh();
    });
  }).catch(function (e) {
    logError('Transcript Save', e);
    toast('Could not save transcript on this device (private browsing?)');
  });
}

// ════════════════════════════════════════════════════════
// STUDY TAB — collapsed "Transcript" section
// ════════════════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

/** Shows/hides the Transcript section for the open study and resets it to collapsed. */
export function trRefresh() {
  var sec = $('transcript-section'); if (!sec) return;
  var has = !!(cur && mediaHasTranscript(cur.id));
  sec.style.display = has ? '' : 'none';
  _trRec = null; _trOpen = false;
  var body = $('tr-body'); if (body) body.style.display = 'none';
  var chev = $('tr-chev'); if (chev) chev.style.transform = '';
  var s = $('tr-search'); if (s) s.value = '';
}

/** Expands/collapses the Transcript section; loads the text lazily on first open. */
export function trToggle() {
  var body = $('tr-body'), chev = $('tr-chev');
  if (!body || !cur) return;
  if (_trOpen) { _trOpen = false; body.style.display = 'none'; if (chev) chev.style.transform = ''; return; }
  _trOpen = true; body.style.display = ''; if (chev) chev.style.transform = 'rotate(180deg)';
  if (_trRec) return;
  var sid = cur.id;
  $('tr-text').innerHTML = '<div style="color:var(--txt3);font-size:14px">Loading...</div>';
  getTranscript(sid).then(function (rec) {
    if (!cur || cur.id !== sid) return;
    if (!rec) { $('tr-text').innerHTML = '<div style="color:var(--txt3);font-size:14px">Transcript not found on this device.</div>'; return; }
    _trRec = rec; trRender('');
  }).catch(function (e) {
    logError('Transcript Load', e);
    $('tr-text').innerHTML = '<div style="color:var(--txt3);font-size:14px">Could not load the transcript.</div>';
  });
}

function highlight(text, q) {
  if (!q) return escHtml(text);
  var lower = text.toLowerCase(), out = '', pos = 0, i;
  while ((i = lower.indexOf(q, pos)) > -1) {
    out += escHtml(text.slice(pos, i)) + '<mark style="background:var(--goldpale);color:var(--bg0);border-radius:2px">' + escHtml(text.slice(i, i + q.length)) + '</mark>';
    pos = i + q.length;
  }
  return out + escHtml(text.slice(pos));
}

function trRender(q) {
  if (!_trRec) return;
  q = (q || '').trim().toLowerCase();
  var paras = _trRec.text.split(/\n{2,}/), shown = paras, hits = 0;
  if (q) {
    shown = paras.filter(function (p) {
      var l = p.toLowerCase(), i = -1, n = 0, pos = 0;
      while ((i = l.indexOf(q, pos)) > -1) { n++; pos = i + q.length; }
      hits += n; return n > 0;
    });
  }
  var words = _trRec.text.split(/\s+/).length;
  var info = $('tr-info');
  if (info) {
    var d = _trRec.addedAt ? new Date(_trRec.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    info.textContent = q
      ? (hits ? hits + ' match' + (hits === 1 ? '' : 'es') + ' in ' + shown.length + ' paragraph' + (shown.length === 1 ? '' : 's') : 'No matches')
      : (_trRec.sourceName || 'Transcript') + ' \u00b7 ' + words.toLocaleString() + ' words' + (d ? ' \u00b7 added ' + d : '');
  }
  $('tr-text').innerHTML = shown.map(function (p) {
    return '<p style="margin:0 0 12px;white-space:pre-wrap;word-wrap:break-word">' + highlight(p, q) + '</p>';
  }).join('');
}

/** oninput handler of the transcript search box (debounced). */
export function trSearch() {
  clearTimeout(_searchT);
  _searchT = setTimeout(function () { trRender($('tr-search').value); }, 150);
}

/** Copy the whole transcript to the clipboard. */
export function trCopy() {
  if (!_trRec) return;
  var text = _trRec.text;
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    toast(ok ? 'Transcript copied' : 'Copy failed');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast('Transcript copied'); }).catch(fallback);
  } else fallback();
}

/** Download the transcript text as a .txt file. */
export function trDownload() {
  if (!_trRec) return;
  var base = (_trRec.sourceName || 'transcript').replace(/\.[^.]+$/, '') || 'transcript';
  var blob = new Blob([_trRec.text], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = base + '.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

/** Replace button — opens the same file picker; the confirm step happens after the file is read. */
export function trReplace() { trPickTranscript(); }

/** Delete button — confirms, then removes this study's transcript. */
export function trDelete() {
  if (!cur) return;
  var sid = cur.id;
  openConfirm('Delete transcript?', 'This removes the transcript from this device. A JSON backup you already exported keeps its copy.', 'Delete', 'btn btn-danger', function () {
    deleteTranscript(sid).then(function () {
      toast('Transcript deleted');
      if (cur && cur.id === sid) trRefresh();
    }).catch(function (e) { logError('Transcript Delete', e); toast('Could not delete transcript'); });
  });
}

// ── shared confirm overlay (#tr-confirm-overlay) ────────────────────────────
function openConfirm(title, msg, okLabel, okClass, fn) {
  var ov = $('tr-confirm-overlay'); if (!ov) return;
  $('tr-confirm-title').textContent = title;
  $('tr-confirm-msg').textContent = msg;
  var ok = $('tr-confirm-ok'); ok.textContent = okLabel; ok.className = okClass;
  _confirmFn = fn; ov.classList.add('on');
}

export function trConfirmOk() {
  var fn = _confirmFn; _confirmFn = null;
  closeOverlay('tr-confirm-overlay');
  if (fn) fn();
}

export function trConfirmCancel() {
  _confirmFn = null; _pending = null;
  closeOverlay('tr-confirm-overlay');
}
