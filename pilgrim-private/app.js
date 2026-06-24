// app.js — Pilgrim Private ES Module Entry Point
// ES Session 5 — June 2026
// Imports all modules, wires cross-module callbacks, exposes window.* bridges,
// registers the service worker, and boots the app via initPinGate().

import {
  CHANGELOG, setAppHeight, updateOffline, todayStr
} from './utils.js';

import {
  wireCallbacks, loadStudies, autoSave
} from './storage.js';

import {
  syncToGist, markDeleted
} from './sync.js';

import {
  loadTTSSett, initTTSVoices
} from './tts.js';

// Namespace imports give live bindings for all exports of each module
import * as Utils from './utils.js';
import * as Storage from './storage.js';
import * as TTS from './tts.js';
import * as Sync from './sync.js';
import * as StudyTools from './studyTools.js';
import * as UI from './ui.js';

// ── Wire storage callbacks (breaks storage ↔ ui circular dep) ───────────────
wireCallbacks({
  populateField: UI.populateField,
  navTo:         UI.navTo,
  renderLib:     UI.renderLib,
  trackOpen:     UI.trackOpen,
  syncToGist:    syncToGist,
  markDeleted:   markDeleted,
});

// ── window.* bridges: Quill instances + dirty flags ─────────────────────────
// storage.js and tts.js read these via window.* during the extraction phase.
// Object.defineProperty with live-binding getters ensures updates from ui.js
// (e.g. _qFNDirty=true in text-change handler) are visible via window.*.
Object.defineProperty(window, '_qFN',          { configurable:true, get: () => UI._qFN });
Object.defineProperty(window, '_qConcl',       { configurable:true, get: () => UI._qConcl });
Object.defineProperty(window, '_qOutline',     { configurable:true, get: () => UI._qOutline });
Object.defineProperty(window, '_qFNDirty',     { configurable:true, get: () => UI._qFNDirty });
Object.defineProperty(window, '_qConclDirty',  { configurable:true, get: () => UI._qConclDirty });
Object.defineProperty(window, '_qOutlineDirty',{ configurable:true, get: () => UI._qOutlineDirty });

// DELETED_TAGS bridge — sync.js reads via window.DELETED_TAGS after merges.
// The live binding getter ensures sync.js always sees ui.js's current array.
// When sync.js does window.DELETED_TAGS = merged, ui.js must pick it up:
// ui.js loadDeletedTags/importDataFromFile should call setDeletedTags() instead.
// TODO (Session 6): move DELETED_TAGS + setDeletedTags to utils.js fully.
Object.defineProperty(window, 'DELETED_TAGS', {
  configurable: true,
  get: () => UI.DELETED_TAGS,
  set: (arr) => { UI.setDeletedTags(arr); } // sync.js merge → update ui.js live binding
});

// startPilgrim — called by ui.js initPinGate/submitPin via window.startPilgrim()
window.startPilgrim = startPilgrim;

// ── Global event listeners ───────────────────────────────────────────────────
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', function() { setTimeout(setAppHeight, 200); });
window.addEventListener('online',  function() { updateOffline(); });
window.addEventListener('offline', function() { updateOffline(); });
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) UI.checkForUpdate();
});
document.querySelectorAll('.overlay:not(#pin-gate-overlay)').forEach(function(o) {
  o.addEventListener('click', function(e) { if (e.target === o) o.classList.remove('on'); });
});
setInterval(autoSave, 30000);

// ── Expose functions on window.* for inline onclick= HTML handlers ───────────
// Each module's exports assigned to window so onclick="navTo(...)" etc. work.
[Utils, Storage, TTS, Sync, StudyTools, UI].forEach(function(mod) {
  Object.keys(mod).forEach(function(name) {
    if (typeof mod[name] === 'function' && window[name] === undefined) {
      window[name] = mod[name];
    }
  });
});

// ── Service Worker (Section 30) ──────────────────────────────────────────────
(function() {
  var APP_VER = (CHANGELOG && CHANGELOG[0]) ? CHANGELOG[0].version : '0';
  if (localStorage.getItem('_sw_ver') !== APP_VER) {
    localStorage.setItem('_sw_ver', APP_VER);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        var found = regs.length > 0;
        regs.forEach(function(r) { r.unregister(); });
        if (found) { window.location.reload(); }
      });
    }
  } else {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() {});
    }
  }
})();

// ── startPilgrim ─────────────────────────────────────────────────────────────
/**
 * Boots the app. Only called after a user is authenticated — either from a
 * cached session (initPinGate) or a fresh PIN entry (submitPin) in ui.js.
 * Coordinates all module init functions that require an active user namespace.
 */
function startPilgrim() {
  // Data layer — load persisted state into memory
  loadStudies();
  UI.loadTags();
  UI.loadDeletedTags();
  UI.loadSett();
  loadTTSSett();
  // Initial render
  UI.renderLib();
  updateOffline();
  document.getElementById('f-date').value = todayStr();
  setTimeout(UI.checkImportHash, 300);
  // Feature init
  UI.initSwipe();
  UI.checkOnboarding();
  UI.checkTabHints();
  setAppHeight();
  UI.initEditors();
  UI.initDiagSection();
  // TTS voices — onvoiceschanged fires async on some browsers
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function() { initTTSVoices(); };
    initTTSVoices();
  }
  // Version stamps
  var vEl = document.getElementById('nav-version-display');
  if (vEl && CHANGELOG && CHANGELOG[0]) vEl.textContent = 'v' + CHANGELOG[0].version;
  var uEl = document.getElementById('settings-user-display');
  if (uEl) {
    // ACTIVE_USER is mutated by activateUser() in utils.js before startPilgrim runs.
    // Read from the namespace import (live binding) to get the current value.
    if (Utils.ACTIVE_USER) uEl.textContent = Utils.ACTIVE_USER;
  }
  UI.checkForUpdate();
  UI.tourCleanupDemoData();
}
// Re-expose after function definition (hoisting handles the window.startPilgrim = startPilgrim above)

// ── Boot ──────────────────────────────────────────────────────────────────────
// ES modules are deferred — DOM is fully parsed before this runs. No need for
// a 'load' or 'DOMContentLoaded' listener; call initPinGate directly.
UI.initPinGate();
