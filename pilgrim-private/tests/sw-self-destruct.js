/**
 * Arché · Pilgrim Private: SELF-DESTRUCT service worker (kill-switch layer 3, the last-resort backstop).
 *
 * HOW TO USE (one line): copy this file over pilgrim-private/sw.js, deploy, and every phone drops the offline app shell
 * the next time it opens Pilgrim online (browsers always re-fetch sw.js itself from the network).
 *
 * Why it exists: layers 1 and 2 (the sw-kill.json flag) run from the cached app. If a release ever cached a BROKEN app
 * that cannot even start, only a new sw.js can fix it, because the browser fetches sw.js bytes directly, bypassing the cache.
 *
 * What it does: installs and takes over at once, deletes every pilgrim-shell-* cache (never pilgrim-fonts, never another
 * app's caches), unregisters itself, and reloads open Pilgrim tabs so they load straight from the network.
 * It has no fetch handler, so the browser handles every request as if no worker existed.
 * It NEVER touches IndexedDB (offline packs, recordings), localStorage (studies, settings, backups) or other apps.
 *
 * After the fix is deployed: restore the real sw.js from git (git checkout <release commit> -- pilgrim-private/sw.js),
 * bump the version, and phones register the real worker again.
 */
'use strict';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf('pilgrim-shell-') === 0; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (clients) { clients.forEach(function (c) { try { c.navigate(c.url); } catch (err) { /* ignore */ } }); })
  );
});
