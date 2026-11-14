// shell.js — Pilgrim Private ES Module: app-shell service worker helpers (Offline Phase 5, v4.69.0)
//
// Section 1: scoped cleanup of LEGACY workers/caches. It replaces the old origin-wide purge
//   (unregister every worker + delete every cache), which also wiped Scribe's and Pilgrim Public's workers/caches.
// Section 2: registration of sw.js, kill-switch layer 1 (sw-kill.json), the Settings "Offline app" switch, and the
//   update flow (waiting worker -> banner -> SKIP_WAITING -> one reload on controllerchange).
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


// ── Section 2: registration, kill switch (layer 1), Offline app switch, update flow ─────────────────────────────

/**
 * Device-level localStorage key for the Settings "Offline app" switch. 'off' = the person turned it off; absent = on.
 * Intentionally NOT namespaced per user and NOT part of backups (same treatment as bsn_update_skip / bsn_active_user):
 * it describes this browser's service worker, not study data. It is the one new key Phase 5 adds.
 */
var SK_OFFLINE_APP = 'bsn_offline_app';

/** Last result of startShell(): 'unsupported' | 'off' | 'killed' | 'registered' | 'failed' | '' (not run yet). */
var _lastResult = '';
/** True only between "Refresh Now" posting SKIP_WAITING and the resulting controllerchange (so first-install claim never reloads). */
var _refreshing = false;
/** Guards adding the controllerchange listener more than once. */
var _watching = false;

/**
 * True unless the person switched the Offline app off in Settings.
 * @returns {boolean}
 */
function offlineAppEnabled() {
  try { return localStorage.getItem(SK_OFFLINE_APP) !== 'off'; } catch (e) { return true; }
}

/** @returns {boolean} true when this browser can run service workers */
function swSupported() { return 'serviceWorker' in navigator; }

/**
 * Deletes every pilgrim-shell-* cache. Never touches pilgrim-fonts, another app's caches, IndexedDB or localStorage.
 * @returns {Promise<boolean>} true if any cache was deleted
 */
function deleteShellCaches() {
  if (!('caches' in window)) { return Promise.resolve(false); }
  return caches.keys().then(function (names) {
    var mine = names.filter(function (n) { return n.indexOf(SHELL_PREFIX) === 0; });
    return Promise.all(mine.map(function (n) { return caches.delete(n); })).then(function () { return mine.length > 0; });
  }).catch(function () { return false; });
}

/**
 * Unregisters the worker(s) registered for THIS folder's scope (ours, plus any leftover). Other scopes are never touched.
 * @returns {Promise<boolean>} true if any registration was removed
 */
function unregisterOurScope() {
  if (!swSupported()) { return Promise.resolve(false); }
  return navigator.serviceWorker.getRegistrations().then(function (regs) {
    var mine = regs.filter(function (r) { return new URL(r.scope).pathname === APP_PATH; });
    return Promise.all(mine.map(function (r) { return r.unregister(); })).then(function () { return mine.length > 0; });
  }).catch(function () { return false; });
}

/**
 * Removes the offline app shell: unregister our worker and delete the pilgrim-shell-* caches. Used by the kill switch
 * (layer 1) and the Settings switch. Never touches IndexedDB (offline packs, recordings), localStorage (studies,
 * settings, backups) or other apps.
 * @returns {Promise<boolean>} true if anything was removed
 */
function removeShell() {
  return Promise.all([unregisterOurScope(), deleteShellCaches()]).then(function (r) { return r[0] || r[1]; });
}

/**
 * Kill-switch layer 1: reads sw-kill.json from the network (no-store, cache-busted; sw.js does not intercept it).
 * Offline, a bad answer or invalid JSON all count as "not killed", so the kill file can never lock anyone out.
 * @returns {Promise<boolean>} true only when the file says {"kill": true}
 */
function fetchKillFlag() {
  return fetch(new URL('sw-kill.json', location.href).pathname + '?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { return !!(j && j.kill === true); })
    .catch(function () { return false; });
}

/**
 * Asks a worker for its VERSION (its GET_VERSION reply arrives as a message from the worker).
 * @param {ServiceWorker} worker
 * @returns {Promise<string>} the version, or '' after 3 seconds
 */
function askVersion(worker) {
  return new Promise(function (resolve) {
    var timer;
    function onMsg(e) {
      if (e.data && e.data.type === 'VERSION') { done(e.data.version || ''); }
    }
    function done(v) {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMsg);
      resolve(v);
    }
    navigator.serviceWorker.addEventListener('message', onMsg);
    timer = setTimeout(function () { done(''); }, 3000);
    try { worker.postMessage({ type: 'GET_VERSION' }); } catch (e) { done(''); }
  });
}

/**
 * Reloads on a brand-new URL (?fresh=<timestamp>) so the worker answers network-first. Fallback for "Refresh Now"
 * when no waiting worker exists (a plain reload would serve the OLD cached shell once a worker is installed).
 */
function goFresh() {
  try {
    var u = new URL(location.href);
    u.searchParams.set('fresh', String(Date.now()));
    location.replace(u.toString());
  } catch (e) { location.reload(); }
}

/**
 * Wires update detection for a registration: a worker that installs and WAITS (or is already waiting at boot)
 * triggers onUpdateReady(version). Adds one controllerchange listener that reloads once, but only after "Refresh Now"
 * (so the first-install claim never reloads the page).
 * @param {ServiceWorkerRegistration} reg
 * @param {function(string):void} [onUpdateReady] called with the waiting worker's version ('' if unknown)
 */
function watchRegistration(reg, onUpdateReady) {
  var announce = function () {
    if (reg.waiting && onUpdateReady) { askVersion(reg.waiting).then(onUpdateReady); }
  };
  announce();
  reg.addEventListener('updatefound', function () {
    var nw = reg.installing;
    if (!nw) { return; }
    nw.addEventListener('statechange', function () {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) { announce(); }
    });
  });
  if (!_watching) {
    _watching = true;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!_refreshing) { return; }
      _refreshing = false;
      location.reload();
    });
  }
}

/**
 * Registers sw.js (scope = this folder, never served from the HTTP cache) and wires update detection.
 * @param {function(string):void} [onUpdateReady]
 * @returns {Promise<string>} 'registered' or 'failed'
 */
function registerWorker(onUpdateReady) {
  return navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(function (reg) {
    watchRegistration(reg, onUpdateReady);
    return 'registered';
  }).catch(function () { return 'failed'; });
}

/**
 * Boot entry (called by app.js after the app starts). Does nothing when the browser has no service workers or the
 * person switched the Offline app off. Otherwise: kill-switch layer 1, then register. If the kill file says kill and
 * something was removed, reloads once (the next boot finds nothing to remove, so there is no reload loop).
 * @param {function(string):void} [onUpdateReady] update-banner callback
 * @returns {Promise<string>} 'unsupported' | 'off' | 'killed' | 'registered' | 'failed'
 */
function startShell(onUpdateReady) {
  var run;
  if (!swSupported()) { run = Promise.resolve('unsupported'); }
  else if (!offlineAppEnabled()) { run = Promise.resolve('off'); }
  else {
    run = fetchKillFlag().then(function (killed) {
      if (killed) {
        return removeShell().then(function (had) { if (had) { location.reload(); } return 'killed'; });
      }
      return registerWorker(onUpdateReady);
    });
  }
  return run.then(function (r) { _lastResult = r; return r; });
}

/**
 * Settings switch. Off: remember it (device-level key), unregister our worker, delete the shell caches, stay off.
 * On: forget the key and register again (the kill flag is still honoured).
 * @param {boolean} on
 * @param {function(string):void} [onUpdateReady]
 * @returns {Promise<string>} the new startShell() result, or 'off'
 */
function setOfflineAppEnabled(on, onUpdateReady) {
  try {
    if (on) { localStorage.removeItem(SK_OFFLINE_APP); } else { localStorage.setItem(SK_OFFLINE_APP, 'off'); }
  } catch (e) { /* storage unavailable: still apply for this page */ }
  if (on) { return startShell(onUpdateReady); }
  return removeShell().then(function () { _lastResult = 'off'; return 'off'; });
}

/**
 * Status for the Settings line.
 * @returns {Promise<string>} 'unsupported' | 'off' | 'killed' | 'ready' (worker active) | 'starting'
 */
function getOfflineAppStatus() {
  if (!swSupported()) { return Promise.resolve('unsupported'); }
  if (!offlineAppEnabled()) { return Promise.resolve('off'); }
  if (_lastResult === 'killed') { return Promise.resolve('killed'); }
  return navigator.serviceWorker.getRegistrations().then(function (regs) {
    var mine = regs.filter(function (r) { return new URL(r.scope).pathname === APP_PATH && r.active; });
    return mine.length ? 'ready' : 'starting';
  }).catch(function () { return 'starting'; });
}

/**
 * Asks the browser to look for a new sw.js now (silent; offline or no worker = nothing happens). A new worker installs
 * in the background and waits; watchRegistration then raises the banner.
 * @returns {Promise<void>}
 */
function checkWorkerUpdate() {
  if (!swSupported() || !offlineAppEnabled()) { return Promise.resolve(); }
  return navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.update() : null; })
    .then(function () {}, function () {});
}

/**
 * "Refresh Now": activates a waiting worker (SKIP_WAITING); the page reloads once on controllerchange. If no worker is
 * waiting yet, asks for an update and waits up to 15 s for it to install. Resolves false when there is no worker to
 * activate, so the caller falls back to goFresh() (a plain reload would serve the OLD cached shell).
 * @returns {Promise<boolean>} true = activation requested (a reload follows), false = caller should reload fresh
 */
function applyUpdate() {
  if (!swSupported() || !offlineAppEnabled()) { return Promise.resolve(false); }
  var activate = function (w) {
    _refreshing = true;
    w.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(function () { if (_refreshing) { _refreshing = false; goFresh(); } }, 5000);
    return true;
  };
  return navigator.serviceWorker.getRegistration().then(function (reg) {
    if (!reg) { return false; }
    if (reg.waiting) { return activate(reg.waiting); }
    return reg.update().then(function () {
      if (reg.waiting) { return activate(reg.waiting); }
      var nw = reg.installing;
      if (!nw) { return false; }
      return new Promise(function (resolve) {
        var t = setTimeout(function () { resolve(false); }, 15000);
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && reg.waiting) { clearTimeout(t); resolve(activate(reg.waiting)); }
          else if (nw.state === 'redundant') { clearTimeout(t); resolve(false); }
        });
      });
    });
  }).catch(function () { return false; });
}

export {
  APP_PATH, SHELL_PREFIX, LEGACY_CACHES, SK_OFFLINE_APP, isOurWorker, isLegacyWorker, cleanupLegacyWorkers,
  offlineAppEnabled, startShell, setOfflineAppEnabled, getOfflineAppStatus, checkWorkerUpdate, applyUpdate, removeShell, goFresh
};
