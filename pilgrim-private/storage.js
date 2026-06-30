// storage.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 2
// Sections: 04 (localStorage R/W), 08 (Study CRUD)
// See pilgrim-es-modules-plan-v1.md for full module map

import {
  studies, setStudies,
  cur, setCur,
  online,
  SK,
  activeRefIdx, setActiveRefIdx,
  studyScope, setStudyScope,
  _pendingDeleteId, setPendingDeleteId,
  toast, toastSuccess, closeOverlay,
  migrateStudy, activeRef
} from './utils.js';

// ── Callbacks wired by app.js ──────────────────────────────────────────────
// S08 calls into ui.js and sync.js. To avoid circular imports,
// app.js injects these after all modules load. See spec §Circular dependency risk.
var _cbs = {
  populateField: null,  // ui.js — renders Field Notes tab for open study
  navTo: null,          // ui.js — single nav entry point
  renderLib: null,      // ui.js — re-renders Library screen
  trackOpen: null,      // stats section — records open for streak
  syncToGist: null,     // sync.js — pushes to GitHub Gist if online
  markDeleted: null     // sync.js — adds id to _deletedStudyIds tombstone map
};

// ── Gist sync debounce ───────────────────────────────────────────────────────
// Shared timer across saveStudy/deleteStudy/duplicateStudy — rapid-fire calls
// (e.g. quick screen navigation) coalesce into a single push 3s after the last one.
var _gistSyncTimer = null;
function _queueGistSync() {
  if (!online || !_cbs.syncToGist) return;
  if (_gistSyncTimer) clearTimeout(_gistSyncTimer);
  _gistSyncTimer = setTimeout(function() { _gistSyncTimer = null; _cbs.syncToGist(true); }, 3000);
}

/**
 * Injects UI and sync callbacks to break circular import chains.
 * Called once by app.js after all modules are loaded.
 * @param {Object} cbs - { populateField, navTo, renderLib, trackOpen, syncToGist, markDeleted }
 */
export function wireCallbacks(cbs) {
  Object.assign(_cbs, cbs);
}

// ── Quill state accessors (window.* during extraction phase) ────────────────
// _qFN, _qConcl, _qOutline and their dirty flags live in ui.js (S05).
// Using window.* here during the extraction phase; replaced with direct
// ui.js imports when app.js is finalized in Session 5.
/** @returns {Object|null} Active Field Notes Quill instance */
function _qFN() { return window._qFN || null; }
/** @returns {boolean} Whether Field Notes has unsaved edits */
function _qFNDirty() { return window._qFNDirty || false; }
/** @returns {Object|null} Active Conclusions Quill instance */
function _qConcl() { return window._qConcl || null; }
/** @returns {boolean} Whether Conclusions has unsaved edits */
function _qConclDirty() { return window._qConclDirty || false; }
/** @returns {Object|null} Active Outline Quill instance */
function _qOutline() { return window._qOutline || null; }
/** @returns {boolean} Whether Outline has unsaved edits */
function _qOutlineDirty() { return window._qOutlineDirty || false; }


// SECTION 04 — STORAGE
// localStorage read/write for the studies array. loadStudies() is the
// single read path; persist() is the single write path for study data.
// ════════════════════════════════════════════════════════

/**
 * Loads the studies array from localStorage and runs schema migration on each entry.
 * If a study is currently open (cur), re-syncs the cur reference to the freshly loaded object.
 * Falls back to an empty array on JSON parse failure.
 */
export function loadStudies() {
  try {
    var loaded = JSON.parse(localStorage.getItem(SK)) || [];
    loaded.forEach(function(s) { migrateStudy(s); });
    setStudies(loaded);
  } catch(e) { setStudies([]); }
  if (cur) {
    var _resync = studies.find(function(s) { return s.id === cur.id; });
    if (_resync) setCur(_resync);
  }
}

/**
 * Persists the studies array to localStorage under the SK key.
 * Shows a toast error message if the write fails due to storage quota.
 */
export function persist() {
  try { localStorage.setItem(SK, JSON.stringify(studies)); }
  catch(e) { toast('Storage full — remove large attachments to free space'); }
}


// SECTION 08 — STUDY CORE (CRUD)
// Create, open, save, delete, and duplicate studies. openStudy() sets the
// global cur variable. saveStudy() is the single confirmed write path.
// ════════════════════════════════════════════════════════

/**
 * Opens a study by ID, migrates its schema if needed, resets editor state,
 * and navigates to the Field Notes tab. Sets the global `cur` via setCur().
 * @param {string} id - The unique study ID (bsn_* format) from the studies array.
 */
export function openStudy(id) {
  var s = studies.find(function(s) { return s.id === id; });
  if (!s) return;
  setCur(s);
  migrateStudy(cur);
  if (!cur.deep) cur.deep = {conclusions: '', outline: ''};
  if (!cur.deep.hasOwnProperty('conclusions')) cur.deep.conclusions = '';
  if (!cur.deep.hasOwnProperty('outline')) cur.deep.outline = '';
  if (!cur.resources) cur.resources = [];
  if (!cur.tags) cur.tags = [];
  setActiveRefIdx(0);
  setStudyScope((activeRef() && activeRef().deep && activeRef().deep.studyScope) || 'passage');
  // Reset Quill editors to empty — study content populates via populateField()
  var _qO = _qOutline(); if (_qO) _qO.setText('');
  var _qC = _qConcl(); if (_qC) _qC.setText('');
  if (_cbs.trackOpen) _cbs.trackOpen(cur);
  if (_cbs.populateField) _cbs.populateField();
  if (_cbs.navTo) _cbs.navTo('field');
}

/**
 * Saves the current study to the studies array and persists to localStorage.
 * Syncs field inputs first. Triggers a Gist sync if online.
 * @param {boolean} [silent=false] - If true, suppresses the save toast notification.
 */
export function saveStudy(silent) {
  if (!cur) return;
  syncFromInputs(!silent);
  cur.updatedAt = new Date().toISOString();
  var updated = studies.slice(); // work on copy; setStudies replaces the binding
  var i = updated.findIndex(function(s) { return s.id === cur.id; });
  if (i >= 0) updated[i] = cur; else updated.unshift(cur);
  setStudies(updated);
  persist();
  if (!silent) toastSuccess('\u2713 Saved');
  _queueGistSync();
}

/**
 * Silent auto-save called on a 30-second interval. Syncs inputs without
 * triggering a toast or Gist push. No-op if no study is open.
 */
export function autoSave() {
  if (!cur) return;
  syncFromInputs(false);
  var updated = studies.slice();
  var i = updated.findIndex(function(s) { return s.id === cur.id; });
  if (i >= 0) updated[i] = cur;
  setStudies(updated);
  persist();
}

/**
 * Deletes the current study or the study staged in `_pendingDeleteId`.
 * Registers the ID with the sync tombstone map via markDeleted callback,
 * removes from the studies array, clears `cur` if it matched, and triggers a Gist sync.
 */
export function deleteStudy() {
  var id = _pendingDeleteId || (cur && cur.id);
  if (!id) return;
  // Tombstone for Gist merge conflict resolution — lives in sync.js
  if (_cbs.markDeleted) _cbs.markDeleted(id);
  setStudies(studies.filter(function(s) { return s.id !== id; }));
  persist();
  if (cur && cur.id === id) setCur(null);
  setPendingDeleteId(null);
  closeOverlay('del-overlay');
  if (_cbs.navTo) _cbs.navTo('library');
  toast('Study deleted');
  _queueGistSync();
}

/**
 * Opens the delete confirmation overlay for the currently open study.
 * Clears `_pendingDeleteId` so deleteStudy() falls back to `cur`.
 */
export function showDeleteModal() {
  setPendingDeleteId(null);
  document.getElementById('del-overlay').classList.add('on');
}

/**
 * Opens the delete confirmation overlay for a specific study by ID.
 * Sets `_pendingDeleteId` so deleteStudy() targets that study, not `cur`.
 * @param {string} id - The study ID to stage for deletion.
 */
export function showDeleteById(id) {
  setPendingDeleteId(id);
  document.getElementById('del-overlay').classList.add('on');
}

/**
 * Creates a deep copy of a study, assigns a new ID and title suffix "(Copy)",
 * prepends it to the studies array, persists, and triggers a Gist sync.
 * @param {string} id - The study ID to duplicate.
 */
export function duplicateStudy(id) {
  var s = studies.find(function(x) { return x.id === id; });
  if (!s) return;
  var copy = JSON.parse(JSON.stringify(s));
  copy.id = 'bsn_' + Date.now();
  copy.title = (copy.title || 'Untitled') + ' (Copy)';
  copy.updatedAt = new Date().toISOString();
  setStudies([copy].concat(studies));
  persist();
  if (_cbs.renderLib) _cbs.renderLib();
  toast('Study duplicated');
  _queueGistSync();
}

/**
 * Reads all active DOM input fields and writes their values back to `cur`.
 * Also reads Quill editor HTML for Field Notes, Conclusions, and Outline
 * (Conclusions and Outline only sync when their panel is active or force=true).
 * @param {boolean} [force=false] - If true, syncs Conclusions and Outline regardless of panel visibility.
 */
export function syncFromInputs(force) {
  if (!cur) return;
  cur.date    = document.getElementById('f-date').value;
  cur.teacher = document.getElementById('f-teacher').value;
  cur.series  = document.getElementById('f-series').value;
  cur.title   = document.getElementById('f-title').value;
  // Field Notes: if user edited (dirty flag set), always write even if empty
  // (intentional clear); otherwise use has-text guard to avoid overwriting stored content
  var fn = _qFN();
  if (fn) {
    if (_qFNDirty()) { cur.fieldNotes = fn.root.innerHTML; }
    else { cur.fieldNotes = fn.getText().trim() ? fn.root.innerHTML : (cur.fieldNotes || ''); }
  }
  if (cur.deep) {
    // Only sync Conclusions/Outline when their panel is visible or force=true —
    // prevents empty Quill overwriting stored content when panels haven't mounted
    var deepOn = document.getElementById('scr-deep') &&
                 document.getElementById('scr-deep').classList.contains('on');
    var qC = _qConcl();
    if (qC && (deepOn || force)) {
      if (_qConclDirty() || qC.getText().trim()) cur.deep.conclusions = qC.root.innerHTML;
    }
    var qO = _qOutline();
    if (qO && (deepOn || force)) {
      if (_qOutlineDirty() || qO.getText().trim()) cur.deep.outline = qO.root.innerHTML;
    }
  }
  var ar = activeRef();
  if (!ar) return;
  // Only read ref/translation from DOM when Field Notes is active —
  // avoids clearing values set programmatically on other screens
  var fieldOn = document.getElementById('scr-field') &&
                document.getElementById('scr-field').classList.contains('on');
  if (fieldOn) {
    ar.reference  = document.getElementById('f-ref').value;
    ar.translation = document.getElementById('f-trans').value;
  }
  // Persist current passage/book scope toggle to the ref object
  if (ar.deep) ar.deep.studyScope = studyScope;
}
