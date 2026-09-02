// app.js — Pilgrim Private ES Module Entry Point
// ES Session 5 — June 2026
// Imports all modules, wires cross-module callbacks, exposes window.* bridges,
// registers the service worker, and boots the app via initPinGate().

import {
  CHANGELOG, setAppHeight, updateOffline, todayStr, logError
} from './utils.js?v=4.30.0';

import {
  wireCallbacks, loadStudies, autoSave, reportStorageSnapshot
} from './storage.js?v=4.30.0';

import {
  syncToGist, markDeleted
} from './sync.js?v=4.30.0';

import {
  loadTTSSett, initTTSVoices
} from './tts.js?v=4.30.0';

// Namespace imports give live bindings for all exports of each module
import * as Utils from './utils.js?v=4.30.0';
import * as Storage from './storage.js?v=4.30.0';
import * as TTS from './tts.js?v=4.30.0';
import * as Sync from './sync.js?v=4.30.0';
import * as StudyTools from './studyTools.js?v=4.30.0';
import * as UI from './ui.js?v=4.30.0';

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

window._aiResults   = function() { return StudyTools.aiPanelResults; };
window._aiActiveTab = function() { return StudyTools.aiActiveTab; };
window.setQConclDirty   = function(v) { UI.setQConclDirty(v); };
window.setQOutlineDirty = function(v) { UI.setQOutlineDirty(v); };

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

// ── Global error safety net (added Aug 30 2026, admin-dashboard deep-dive) ──
// logError() coverage before this was limited to explicit try/catch blocks
// scattered across ui.js/studyTools.js/sync.js/utils.js — any exception outside
// those, and any unhandled promise rejection anywhere, was invisible to both
// the local error log and the Errors admin card. These two listeners are a
// safety net UNDER the existing explicit calls, not a replacement for them —
// explicit logError() calls still carry better action labels; this just
// guarantees nothing silently escapes both.
window.addEventListener('error', function(e) {
  try { logError('Uncaught Error', (e && e.error) ? e.error : (e && e.message) || 'Unknown error'); }
  catch (err) { /* never let the safety net itself throw */ }
});
window.addEventListener('unhandledrejection', function(e) {
  try { logError('Unhandled Promise Rejection', (e && e.reason) ? e.reason : 'Unknown rejection'); }
  catch (err) { /* never let the safety net itself throw */ }
});
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
// On version bump: unregister any leftover Service Worker AND purge Cache Storage.
// Unregistering alone is not enough — a controlled page's in-flight/next-reload
// requests can still be served stale cached responses from CacheStorage even
// after unregister(), requiring a manual hard-refresh to fully clear. See
// session-handoff-aug26-2026-studies-not-loading-false-alarm.md.
(function() {
  var APP_VER = (CHANGELOG && CHANGELOG[0]) ? CHANGELOG[0].version : '0';
  if (localStorage.getItem('_sw_ver') !== APP_VER) {
    localStorage.setItem('_sw_ver', APP_VER);
    var swP = ('serviceWorker' in navigator)
      ? navigator.serviceWorker.getRegistrations().then(function(regs) {
          var found = regs.length > 0;
          regs.forEach(function(r) { r.unregister(); });
          return found;
        })
      : Promise.resolve(false);
    var cacheP = ('caches' in window)
      ? caches.keys().then(function(names) {
          var found = names.length > 0;
          return Promise.all(names.map(function(n) { return caches.delete(n); })).then(function() { return found; });
        })
      : Promise.resolve(false);
    Promise.all([swP, cacheP]).then(function(results) {
      if (results[0] || results[1]) { window.location.reload(); }
    });
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
  reportStorageSnapshot(); // current on-device resource totals — added Aug 30 2026
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
  var libVEl = document.getElementById('lib-version-display');
  if (libVEl && CHANGELOG && CHANGELOG[0]) libVEl.textContent = 'v' + CHANGELOG[0].version;
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
