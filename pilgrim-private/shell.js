// shell.js — Pilgrim Private ES Module: app-shell service worker helpers (Offline Phase 5, v4.69.0)
//
// Section 1 (this chunk): scoped cleanup of LEGACY workers/caches. It replaces the old origin-wide purge
//   (unregister every worker + delete every cache), which also wiped Scribe's and Pilgrim Public's workers/caches.
// Later sections (registration, update banner, kill switch, Settings toggle) are added by the same release.
//
// Rules this file keeps: it never touches IndexedDB, localStorage studies/settings/backups, our own
// pilgrim-shell-* / pilgrim-fonts caches, or anything belonging to another app (Scribe, Pilgrim Public, Codex...).

/** Path of this app's folder, e.g. '/pilgrim-private/' (derived from the page URL so local tests at '/' also work). */
var APP_PATH = new URL('./', location.href).pathname;

/** Cache-name prefix owned by sw.js: shell caches are 'pilgrim-shell-<version>'. Never deleted by the legacy cleanup. */
var SHELL_PREFIX = 'pilgrim-shell-';

/**
 * Caches known to be left over from OLD workers that controlled Pilgrim Private pages (from git history:
 * the retired shared root sw.js used 'arche-pilgrim-v1'). Only exact names listed here are ever deleted.
 * Scribe ('arche-scribe-*') and Pilgrim Public ('arche-pilgrim-v2-*') caches are deliberately NOT listed.
 */
var LEGACY_CACHES = ['arche-pilgrim-v1'];

/**
 * True when a registration is the Pilgrim Private worker shipped by Phase 5 (this folder's sw.js).
 * @param {ServiceWorkerRegistration} reg
 * @returns {boolean}
 */
function isOurWorker(reg) {
  var w = reg.active || reg.waiting || reg.installing;
  if (!w) { return false; }
  return new URL(w.scriptURL).pathname === APP_PATH + 'sw.js' && new URL(reg.scope).pathname === APP_PATH;
}

/**
 * True when a registration is a LEFTOVER worker that could still serve stale Pilgrim Private files:
 *   (a) any worker whose scope is this folder but whose script is not our sw.js, or
 *   (b) the retired shared root worker (scope '/', script '/sw.js'), which no longer exists in the repo.
 * A worker with any other scope (/scribe/, /pilgrim-public/, ...) is never matched.
 * @param {ServiceWorkerRegistration} reg
 * @returns {boolean}
 */
function isLegacyWorker(reg) {
  if (isOurWorker(reg)) { return false; }
  var scope = new URL(reg.scope).pathname;
  var w = reg.active || reg.waiting || reg.installing;
  var script = w ? new URL(w.scriptURL).pathname : '';
  if (scope === APP_PATH) { return true; }
  return APP_PATH !== '/' && scope === '/' && script === '/sw.js';
}

/**
 * One scoped cleanup pass: unregister leftover Pilgrim Private workers and delete the known legacy caches.
 * Safe to run on every boot (nothing found = nothing changed). Used by app.js (Section 30) and by About > Force refresh.
 * @returns {Promise<boolean>} true if anything was unregistered or deleted (callers may reload once in that case)
 */
function cleanupLegacyWorkers() {
  var regP = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.getRegistrations().then(function (regs) {
        var old = regs.filter(isLegacyWorker);
        return Promise.all(old.map(function (r) { return r.unregister(); })).then(function () { return old.length > 0; });
      })
    : Promise.resolve(false);
  var cacheP = ('caches' in window)
    ? caches.keys().then(function (names) {
        var old = names.filter(function (n) { return n.indexOf(SHELL_PREFIX) !== 0 && LEGACY_CACHES.indexOf(n) !== -1; });
        return Promise.all(old.map(function (n) { return caches.delete(n); })).then(function () { return old.length > 0; });
      })
    : Promise.resolve(false);
  return Promise.all([regP, cacheP]).then(function (r) { return r[0] || r[1]; }).catch(function () { return false; });
}

export { APP_PATH, SHELL_PREFIX, LEGACY_CACHES, isOurWorker, isLegacyWorker, cleanupLegacyWorkers };
