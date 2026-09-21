// memory.js — Pilgrim Private ES Module (v4.36.0)
// Scripture Memory, Stage 1: the store + the Library "Memory" tab. No review mechanics yet
// (Stage 2 — see verse-memory-spec-v1.md). Pure logic lives in memory-core.js.
//
// Storage: one per-user localStorage key, SK_MEM ('bsn_memverses_<userId>'), holding
// { items:[...], deleted:[...] }. Included in Gist sync (sync.js) and JSON backup (ui.js).
// Imports only utils.js + memory-core.js so sync.js / ui.js / studyTools.js can all import
// this module without creating a dependency cycle.

import { SK_MEM, online, escHtml, toast, logError } from './utils.js?v=4.36.0';
import {
  memEmptyStore, memNormalizeStore, memNormRefKey, memMakeItem, memMerge, memBuildVerseRef
} from './memory-core.js?v=4.36.0';

// ── Sync trigger (wired by app.js so this module never imports sync.js) ─────
var _memSyncFn = null;
var _memSyncTimer = null;
/** @param {Function} fn - Called (debounced 3s) after a local change; should push to the Gist. */
function memWireSync(fn) { _memSyncFn = fn; }
function _memQueueSync() {
  if (!online || !_memSyncFn) return;
  if (_memSyncTimer) clearTimeout(_memSyncTimer);
  _memSyncTimer = setTimeout(function() { _memSyncTimer = null; _memSyncFn(); }, 3000);
}

// ── Store I/O ───────────────────────────────────────────────
/**
 * Loads the store. If the stored JSON is unparseable, the raw string is copied to
 * SK_MEM+'_corrupt' before an empty store is returned, so a later save can't silently
 * destroy the only copy.
 * @returns {{items:Object[],deleted:Object[]}}
 */
function memLoad() {
  var raw = null;
  try { raw = localStorage.getItem(SK_MEM); } catch (e) { return memEmptyStore(); }
  if (!raw) return memEmptyStore();
  try { return memNormalizeStore(JSON.parse(raw)); }
  catch (e) {
    logError('Memory Load (parse)', e);
    try { localStorage.setItem(SK_MEM + '_corrupt', raw); } catch (e2) { /* nothing more we can do */ }
    return memEmptyStore();
  }
}
/** @returns {boolean} true if written */
function memSave(store) {
  try { localStorage.setItem(SK_MEM, JSON.stringify(store)); return true; }
  catch (e) { logError('Memory Save', e); toast('Could not save to Memory — storage may be full'); return false; }
}
function _memNewId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'mv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Store snapshot for Gist push / JSON export. */
function memExportStore() { return memLoad(); }
/** @returns {boolean} true if there is anything worth writing to a backup. */
function memHasData() { var s = memLoad(); return s.items.length > 0 || s.deleted.length > 0; }

/**
 * Merges a remote/imported store into the local store and saves it (Gist push/pull, JSON import).
 * @param {*} remote - Untrusted store object.
 * @returns {{items:Object[],deleted:Object[]}} merged store
 */
function memMergeRemote(remote) {
  var merged = memMerge(memLoad(), remote);
  memSave(merged);
  _memRefreshIfVisible();
  return merged;
}
/** Force-restore: replace the local store with the remote one (only called when the remote has the key). */
function memReplaceFromRemote(remote) {
  var s = memNormalizeStore(remote);
  memSave(s);
  _memRefreshIfVisible();
  return s;
}

// ── Add / delete ────────────────────────────────────────────
/**
 * Saves one verse to the Memory store. Duplicate = same reference + translation.
 * @param {{reference:string,translation:string,text:string,source:string}} v
 * @returns {'added'|'duplicate'|'invalid'|'failed'}
 */
function memAddVerse(v) {
  if (!v || !String(v.reference || '').trim() || !String(v.text || '').trim()) return 'invalid';
  var store = memLoad();
  var key = memNormRefKey(v.reference, v.translation);
  var dup = store.items.some(function(it) { return memNormRefKey(it.reference, it.translation) === key; });
  if (dup) return 'duplicate';
  store.items.push(memMakeItem(v, _memNewId(), new Date().toISOString()));
  if (!memSave(store)) return 'failed';
  _memRefreshIfVisible();
  _memQueueSync();
  return 'added';
}
/** Shared toast wording for every "Save to Memory" entry point. */
function memAddWithToast(v) {
  var r = memAddVerse(v);
  if (r === 'added') toast('Saved to Memory: ' + v.reference);
  else if (r === 'duplicate') toast(v.reference + ' is already in Memory');
  else if (r === 'invalid') toast('Nothing to save — reference and text are required');
  return r;
}
/** Deletes a verse (after confirm) and records a tombstone so the delete syncs across devices. */
function memDelete(id) {
  var store = memLoad();
  var it = store.items.find(function(x) { return x.id === id; });
  if (!it) return;
  if (!confirm('Remove ' + it.reference + ' from Memory?')) return;
  store.items = store.items.filter(function(x) { return x.id !== id; });
  store.deleted.push({ id: id, at: new Date().toISOString() });
  if (!memSave(store)) return;
  renderMemoryList();
  _memQueueSync();
  toast('Removed from Memory');
}

// ── Library "Memory" tab UI ─────────────────────────────────
function _memRefreshIfVisible() {
  var panel = document.getElementById('lib-memory-panel');
  if (panel && panel.style.display !== 'none') renderMemoryList();
}
/** Renders the verse list (newest first) into #mem-list. */
function renderMemoryList() {
  var el = document.getElementById('mem-list');
  if (!el) return;
  var items = memLoad().items.slice().sort(function(a, b) {
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  if (!items.length) {
    el.innerHTML = '<div class="empty"><p style="font-style:italic;font-size:13px">No verses saved yet.<br>Add one above, or tap a verse number in Read or in a study\'s Scripture panel, then choose Save to Memory.</p></div>';
    return;
  }
  el.innerHTML = items.map(function(it) {
    var trans = it.translation ? ' \u00b7 ' + escHtml(it.translation.toUpperCase()) : '';
    var when = it.createdAt ? new Date(it.createdAt).toLocaleDateString() : '';
    return '<div class="word-card">' +
      '<div class="word-card-word">' + escHtml(it.reference) + trans + '</div>' +
      '<div style="font-family:var(--font-body);font-size:calc(14px * var(--content-scale));color:var(--txt2);line-height:1.55;margin:4px 0 6px;">' + escHtml(it.text) + '</div>' +
      '<div class="word-card-meta">' + escHtml(when) + '</div>' +
      '<div class="word-card-actions">' +
        '<button class="btn btn-sm" data-mvid="' + escHtml(it.id) + '" onclick="memDeleteBtn(this)" style="font-size:11px;padding:4px 10px;min-height:28px;color:var(--crimsonbright);background:none;border:1px solid var(--border);">Remove</button>' +
      '</div>' +
    '</div>';
  }).join('');
}
function memDeleteBtn(btn) { memDelete(btn.getAttribute('data-mvid')); }

/** Shows/hides the manual-entry form. */
function memToggleAdd() {
  var f = document.getElementById('mem-add-form');
  if (!f) return;
  var open = f.style.display === 'none';
  f.style.display = open ? '' : 'none';
  if (open) { var r = document.getElementById('mem-in-ref'); if (r) r.focus(); }
}
/** Saves the manual-entry form. Keeps the form open on error/duplicate so nothing typed is lost. */
function memSaveManual() {
  var ref = document.getElementById('mem-in-ref').value.trim();
  var trans = document.getElementById('mem-in-trans').value;
  var text = document.getElementById('mem-in-text').value.trim();
  if (!ref) { toast('Enter a reference'); return; }
  if (!text) { toast('Enter the verse text'); return; }
  var r = memAddWithToast({ reference: ref, translation: trans, text: text, source: 'manual' });
  if (r === 'added') {
    document.getElementById('mem-in-ref').value = '';
    document.getElementById('mem-in-text').value = '';
    memToggleAdd();
  }
}

export {
  memWireSync, memLoad, memSave, memExportStore, memHasData, memMergeRemote, memReplaceFromRemote,
  memAddVerse, memAddWithToast, memDelete, memDeleteBtn,
  renderMemoryList, memToggleAdd, memSaveManual,
  memBuildVerseRef
};
