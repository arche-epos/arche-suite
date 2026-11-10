#!/usr/bin/env node
// tests/secret-scan.js — public-repo secret gate (run before every push to arche-suite)
//
// Scans the lines this push would ADD (committed-but-unpushed vs origin/main, plus staged and unstaged changes)
// for GitHub tokens and the proxy shared-secret header value. The repo is PUBLIC and GitHub's own scanning does
// NOT catch the proxy secret. Pass --all to scan every tracked file instead.
// Run from anywhere inside the repo: node pilgrim-private/tests/secret-scan.js [--all]
// Exit 1 on any hit. Never prints the matched secret, only file and pattern name.

'use strict';
const { execSync } = require('child_process');
const sh = c => { try { return execSync(c, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return ''; } };

const PATTERNS = [
  ['GitHub classic token (ghp_)', /ghp_[A-Za-z0-9]{20,}/],
  ['GitHub fine-grained token (github_pat_)', /github_pat_[A-Za-z0-9_]{20,}/],
  ['GitHub other token (gho_/ghs_/ghu_/ghr_)', /gh[osur]_[A-Za-z0-9]{30,}/],
  ['proxy secret assigned a value', /x-arche[-a-z]*['"]?\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
  ['proxy secret value in a header object', /['"]x-arche[-a-z]*['"]\s*:\s*['"][^'"\s]{8,}['"]/i],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const root = sh('git rev-parse --show-toplevel').trim();
let text = '';
if (process.argv.includes('--all')) {
  text = sh('git -C "' + root + '" ls-files -z').split('\0').filter(Boolean).map(f => '+++ b/' + f + '\n' + sh('git -C "' + root + '" show HEAD:"' + f + '"').split('\n').map(l => '+' + l).join('\n')).join('\n');
} else {
  const base = sh('git -C "' + root + '" rev-parse --verify -q origin/main').trim() ? 'origin/main' : 'HEAD~1';
  text = sh('git -C "' + root + '" diff ' + base + ' -U0') + '\n' + sh('git -C "' + root + '" diff --cached -U0');
}
let file = '', hits = 0;
text.split('\n').forEach(line => {
  if (line.startsWith('+++ b/')) { file = line.slice(6); return; }
  if (!line.startsWith('+') || line.startsWith('+++')) return;
  PATTERNS.forEach(([name, re]) => { if (re.test(line)) { hits++; console.log('FAIL ' + file + ': ' + name); } });
});
console.log(hits ? hits + ' possible secret(s). Remove before pushing.' : 'secret-scan passed (' + (process.argv.includes('--all') ? 'all tracked files' : 'lines to be pushed') + ')');
process.exit(hits ? 1 : 0);
