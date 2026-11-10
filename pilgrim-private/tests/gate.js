#!/usr/bin/env node
// tests/gate.js — one-command pre-push gate for Pilgrim Private
//
// Runs, in order: node --check on every module, bridge-check, the node unit tests, release-check, secret-scan,
// then the headless Playwright specs (boot, layout, batch10, datasafety, regress). Stops at the first failing step and exits 1.
// smoke.spec.js is NOT run (it needs a real PIN and the live Worker).
//
// From pilgrim-private/:   node tests/gate.js
// Playwright step needs @playwright/test reachable (NODE_PATH) and, in Claude's sandbox, PW_CHROMIUM; it starts and
// stops its own static server on port 8765 (override with GATE_PORT). Use --no-browser to skip it.

'use strict';
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const port = process.env.GATE_PORT || '8765';
const noBrowser = process.argv.includes('--no-browser');
let step = 0;

function run(label, cmd, args, opts) {
  step++;
  const r = spawnSync(cmd, args, Object.assign({ cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }, opts || {}));
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  console.log((ok ? 'PASS ' : 'FAIL ') + step + '. ' + label + (ok ? '' : ' (exit ' + r.status + ')'));
  if (!ok) { console.log(out.split('\n').slice(-25).join('\n')); process.exit(1); }
  return out;
}

// 1. syntax of every module
fs.readdirSync(root).filter(f => /\.js$/.test(f)).forEach(f => run('node --check ' + f, 'node', ['--check', f]));
// 2. bridge, unit tests, release bookkeeping, secrets
run('bridge-check', 'node', ['tests/bridge-check.js']);
fs.readdirSync(path.join(root, 'tests')).filter(f => /\.test\.js$/.test(f)).forEach(f => {
  const out = run('unit: ' + f, 'node', ['tests/' + f]);
  const m = out.match(/(\d+) passed, (\d+) failed/); if (m) console.log('     ' + m[0]);
});
run('release-check', 'node', ['tests/release-check.js']);
run('secret-scan', 'node', ['tests/secret-scan.js']);

if (noBrowser) { console.log('Browser specs skipped (--no-browser). GATE PASSED (static only).'); process.exit(0); }

// 3. headless Playwright specs against a throwaway static server
const server = spawn('python3', ['-m', 'http.server', port], { cwd: root, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch (e) {} };
process.on('exit', stop);
spawnSync('sleep', ['2']);
const env = Object.assign({}, process.env, { PILGRIM_BASE_URL: 'http://127.0.0.1:' + port });
const bin = fs.existsSync('/tmp/pwt/node_modules/.bin/playwright') ? '/tmp/pwt/node_modules/.bin/playwright' : 'npx';
const args = (bin === 'npx' ? ['playwright'] : []).concat(['test', 'tests/boot.spec.js', 'tests/layout.spec.js', 'tests/batch10.spec.js', 'tests/datasafety.spec.js', 'tests/regress.spec.js']);
if (fs.existsSync('/tmp/pwt/node_modules')) env.NODE_PATH = '/tmp/pwt/node_modules' + (env.NODE_PATH ? path.delimiter + env.NODE_PATH : '');
if (!env.PW_CHROMIUM && fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')) env.PW_CHROMIUM = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const out = run('Playwright: boot + layout + batch10 + datasafety + regress', bin, args, { env });
const summary = out.split('\n').filter(l => /passed|skipped|failed/.test(l)).join(' | ');
console.log('     ' + summary);
fs.rmSync(path.join(root, 'test-results'), { recursive: true, force: true });
console.log('GATE PASSED');
process.exit(0);
