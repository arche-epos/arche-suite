// memory.js — Pilgrim Private ES Module (v4.37.0)
// Scripture Memory. Stage 1: the store + the Library "Memory" tab. Stage 2 (this version):
// spaced-recall quizzes — "Test Me" (due chunks, updates schedule) and "Practice All"
// (any chunk, schedule untouched) — spec-scripture-memory-stage2-v1.md. Pure logic lives
// in memory-core.js; this module owns storage I/O, the Memory tab UI, and the quiz overlay.
//
// Storage: one per-user localStorage key, SK_MEM ('bsn_memverses_<userId>'), holding
// { items:[...], deleted:[...] }. Included in Gist sync (sync.js) and JSON backup (ui.js).
// Imports only utils.js + memory-core.js so sync.js / ui.js / studyTools.js can all import
// this module without creating a dependency cycle.

import { SK_MEM, online, escHtml, toast, logError } from './utils.js?v=4.37.0';
import {
  memEmptyStore, memNormalizeStore, memNormRefKey, memMakeItem, memMerge, memBuildVerseRef,
  memRangeLabel, memJoinVerses, memGetDueChunks, memGetAllChunks, memBuildBlankedText,
  memGradeAttempt, memNextChunkState, memLogPracticeAttempt, MEM_LEVEL_MAX
} from './memory-core.js?v=4.37.0';

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
/** Updates the "N due" badge/banner on the Memory tab (spec §4.5b, Phase A — in-app only). */
function _memRenderDueBadge() {
  var badge = document.getElementById('mem-due-badge');
  var banner = document.getElementById('mem-due-banner');
  if (!badge && !banner) return;
  var n = memGetDueChunks(memLoad().items).length;
  if (badge) badge.textContent = n > 0 ? '(' + n + ')' : '';
  if (banner) {
    banner.style.display = n > 0 ? '' : 'none';
    banner.textContent = n === 1 ? '1 verse due for review' : n + ' verses due for review';
  }
}
/** Renders the verse list (newest first) into #mem-list. */
function renderMemoryList() {
  _memRenderDueBadge();
  var el = document.getElementById('mem-list');
  if (!el) return;
  var items = memLoad().items.slice().sort(function(a, b) {
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  if (!items.length) {
    el.innerHTML = '<div class="empty"><p style="font-style:italic;font-size:13px">No verses saved yet.<br>Add one above, or load a passage in Read or in a study\'s Scripture panel and choose Save to Memory.</p></div>';
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

// ── Stage 2: "Test Me" / "Practice All" quiz overlay ─────────────────────────
// One module-level session object; null when the overlay is closed.
// { mode:'due'|'all', queue:[{itemId,chunkId,reference,chunk}], idx, answeredThisStep, results:[] }
var _memQuiz = null;

/** Fisher-Yates shuffle — UI-only randomness (ordering), not part of the pure core. */
function _memShuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * Opens the quiz overlay. mode 'due' = "Test Me" (due chunks only, grading updates the
 * schedule). mode 'all' = "Practice All" (every chunk, grading is logged but never
 * changes level/interval/nextReviewDate).
 * @param {'due'|'all'} mode
 */
function memOpenQuiz(mode) {
  var items = memLoad().items;
  var pulled = mode === 'all' ? memGetAllChunks(items) : memGetDueChunks(items);
  if (!pulled.length) {
    toast(mode === 'all' ? 'No verses saved yet to practice' : 'Nothing due right now — try Practice All');
    return;
  }
  _memQuiz = { mode: mode, queue: _memShuffle(pulled), idx: 0, answeredThisStep: false, results: [] };
  var ov = document.getElementById('mem-quiz-overlay');
  if (ov) ov.classList.add('on');
  _memRenderQuizStep();
}

/** Closes the quiz overlay and discards the in-progress session (already-graded steps were saved as they happened). */
function memCloseQuiz() {
  var ov = document.getElementById('mem-quiz-overlay');
  if (ov) ov.classList.remove('on');
  _memQuiz = null;
  renderMemoryList();
}

/** Finds+replaces one chunk on one item in the store and saves. */
function _memUpdateChunk(itemId, chunkId, updatedChunk) {
  var store = memLoad();
  var it = store.items.find(function(x) { return x.id === itemId; });
  if (!it || !Array.isArray(it.chunks)) return;
  it.chunks = it.chunks.map(function(c) { return c.chunkId === chunkId ? updatedChunk : c; });
  memSave(store);
  _memQueueSync();
}

/** Renders the current queue step: reference label, blanked prompt, and an answer box. */
function _memRenderQuizStep() {
  var body = document.getElementById('mem-quiz-body');
  var footer = document.getElementById('mem-quiz-footer');
  var progress = document.getElementById('mem-quiz-progress');
  if (!body || !footer || !_memQuiz) return;
  var step = _memQuiz.queue[_memQuiz.idx];
  var chunk = step.chunk;
  if (progress) progress.textContent = (_memQuiz.idx + 1) + ' of ' + _memQuiz.queue.length +
    (_memQuiz.mode === 'all' ? ' \u00b7 Practice' : ' \u00b7 Test Me');
  var prompt = memBuildBlankedText(chunk.text, chunk.level);
  var cueNote = chunk.level === 0 ? 'Read it aloud, then type it below from memory.'
    : chunk.level >= MEM_LEVEL_MAX ? 'No cue \u2014 type the whole thing from memory.'
    : 'Fill in the blanks from memory.';
  body.innerHTML =
    '<div style="font-family:\'EB Garamond\',serif;font-size:18px;color:var(--gold);margin-bottom:4px;">' + escHtml(step.reference) + '</div>' +
    '<div style="font-size:12px;color:var(--txt3);margin-bottom:14px;">Level ' + chunk.level + ' of ' + MEM_LEVEL_MAX + ' \u2014 ' + escHtml(cueNote) + '</div>' +
    (prompt ? '<div style="font-family:var(--font-body);font-size:15px;color:var(--txt2);line-height:1.7;background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;white-space:pre-wrap;">' + escHtml(prompt) + '</div>' : '') +
    '<textarea id="mem-quiz-input" rows="5" placeholder="Type the verse from memory\u2026" style="width:100%;box-sizing:border-box;font-family:var(--font-body);font-size:15px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg1);color:var(--txt1);resize:vertical;"></textarea>' +
    '<div id="mem-quiz-result" style="margin-top:14px;"></div>';
  footer.innerHTML = '<button class="btn btn-primary btn-full" onclick="memSubmitQuizAnswer()">Check</button>';
  var ta = document.getElementById('mem-quiz-input');
  if (ta) setTimeout(function() { ta.focus(); }, 50);
}

/** Grades the current step's typed answer, updates the chunk, and shows a diff + Next/Finish. */
function memSubmitQuizAnswer() {
  if (!_memQuiz) return;
  var step = _memQuiz.queue[_memQuiz.idx];
  var ta = document.getElementById('mem-quiz-input');
  var typed = ta ? ta.value : '';
  var grade = memGradeAttempt(step.chunk.text, typed);
  var updated = _memQuiz.mode === 'all'
    ? memLogPracticeAttempt(step.chunk, grade.pct)
    : memNextChunkState(step.chunk, grade.pct);
  _memUpdateChunk(step.itemId, step.chunkId, updated);
  step.chunk = updated;
  _memQuiz.results.push(grade.pct);

  var diffHtml = grade.words.map(function(w) {
    return w.ok ? escHtml(w.word)
      : '<span style="color:var(--crimsonbright);text-decoration:underline;">' + escHtml(w.word) + '</span>';
  }).join(' ');
  var resultEl = document.getElementById('mem-quiz-result');
  if (resultEl) {
    resultEl.innerHTML =
      '<div style="font-size:16px;font-weight:600;color:' + (grade.pct >= 100 ? 'var(--gold)' : grade.pct < 50 ? 'var(--crimsonbright)' : 'var(--txt1)') + ';margin-bottom:8px;">' + grade.pct + '% correct</div>' +
      '<div style="font-family:var(--font-body);font-size:14px;line-height:1.7;color:var(--txt2);">' + diffHtml + '</div>';
  }
  var ta2 = document.getElementById('mem-quiz-input');
  if (ta2) ta2.disabled = true;
  var isLast = _memQuiz.idx >= _memQuiz.queue.length - 1;
  var footer = document.getElementById('mem-quiz-footer');
  if (footer) {
    footer.innerHTML = isLast
      ? '<button class="btn btn-primary btn-full" onclick="memFinishQuiz()">Finish</button>'
      : '<button class="btn btn-primary btn-full" onclick="memAdvanceQuiz()">Next</button>';
  }
}

/** Advances to the next chunk in the queue. */
function memAdvanceQuiz() {
  if (!_memQuiz) return;
  _memQuiz.idx++;
  if (_memQuiz.idx >= _memQuiz.queue.length) { memFinishQuiz(); return; }
  _memRenderQuizStep();
}

/** Shows a one-line session summary, then closes on tap. */
function memFinishQuiz() {
  if (!_memQuiz) return;
  var results = _memQuiz.results;
  var avg = results.length ? Math.round(results.reduce(function(s, p) { return s + p; }, 0) / results.length) : 0;
  var body = document.getElementById('mem-quiz-body');
  var footer = document.getElementById('mem-quiz-footer');
  var progress = document.getElementById('mem-quiz-progress');
  if (progress) progress.textContent = 'Session complete';
  if (body) body.innerHTML =
    '<div style="text-align:center;padding:40px 10px;">' +
      '<div style="font-family:\'EB Garamond\',serif;font-size:22px;color:var(--gold);margin-bottom:8px;">Well done</div>' +
      '<div style="font-size:15px;color:var(--txt2);">' + results.length + ' verse' + (results.length === 1 ? '' : 's') + ' reviewed \u00b7 ' + avg + '% average</div>' +
    '</div>';
  if (footer) footer.innerHTML = '<button class="btn btn-primary btn-full" onclick="memCloseQuiz()">Done</button>';
}

export {
  memWireSync, memLoad, memSave, memExportStore, memHasData, memMergeRemote, memReplaceFromRemote,
  memAddVerse, memAddWithToast, memDelete, memDeleteBtn,
  renderMemoryList, memToggleAdd, memSaveManual,
  memBuildVerseRef, memRangeLabel, memJoinVerses,
  memOpenQuiz, memCloseQuiz, memSubmitQuizAnswer, memAdvanceQuiz, memFinishQuiz
};
