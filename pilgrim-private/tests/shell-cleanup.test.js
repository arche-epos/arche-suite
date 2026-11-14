#!/usr/bin/env node
// tests/shell-cleanup.test.js — unit test for shell.js scoped legacy cleanup (Offline Phase 5)
// Proves: leftover Pilgrim Private workers/caches are removed; Scribe, Pilgrim Public, our own worker and
// our own pilgrim-shell-* / pilgrim-fonts caches are never touched.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const src = fs.readFileSync(path.join(__dirname, '..', 'shell.js'), 'utf8');
const tmp = path.join(os.tmpdir(), 'shell-under-test-' + process.pid + '.mjs');
fs.writeFileSync(tmp, src);
let bad = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); bad++; } else console.log('ok   ' + m); };

function reg(scope, script) {
  return { scope: 'https://archestudytools.com' + scope, active: { scriptURL: 'https://archestudytools.com' + script }, unregistered: false,
    unregister() { this.unregistered = true; return Promise.resolve(true); } };
}
(async () => {
  global.location = { href: 'https://archestudytools.com/pilgrim-private/index.html' };
  const regs = {
    ours: reg('/pilgrim-private/', '/pilgrim-private/sw.js'),
    oldPrivate: reg('/pilgrim-private/', '/pilgrim-private/old-sw.js'),
    rootLegacy: reg('/', '/sw.js'),
    scribe: reg('/scribe/', '/scribe/sw.js'),
    pub: reg('/pilgrim-public/', '/pilgrim-public/sw.js'),
  };
  const cacheNames = ['pilgrim-shell-4.69.0', 'pilgrim-fonts', 'arche-pilgrim-v1', 'arche-scribe-v1', 'arche-pilgrim-v2-maintenance', 'someone-elses'];
  const deleted = [];
  Object.defineProperty(global, 'navigator', { value: { serviceWorker: { getRegistrations: () => Promise.resolve(Object.values(regs)) } }, configurable: true });
  global.window = { caches: true };
  global.caches = { keys: () => Promise.resolve(cacheNames.slice()), delete: n => { deleted.push(n); return Promise.resolve(true); } };
  const m = await import('file://' + tmp + '?t=' + Date.now());
  const found = await m.cleanupLegacyWorkers();
  ok(found === true, 'reports that something old was found');
  ok(regs.oldPrivate.unregistered, 'unregisters a leftover Pilgrim Private worker');
  ok(regs.rootLegacy.unregistered, 'unregisters the retired shared root worker');
  ok(!regs.ours.unregistered, 'keeps our own sw.js worker');
  ok(!regs.scribe.unregistered, 'keeps Scribe worker');
  ok(!regs.pub.unregistered, 'keeps Pilgrim Public worker');
  ok(deleted.length === 1 && deleted[0] === 'arche-pilgrim-v1', 'deletes only the known legacy cache (' + deleted.join(',') + ')');
  const again = await m.cleanupLegacyWorkers.call(null);
  ok(typeof again === 'boolean', 'second run completes');
  fs.unlinkSync(tmp);
  console.log(bad ? bad + ' failed' : 'shell-cleanup passed');
  process.exit(bad ? 1 : 0);
})();
