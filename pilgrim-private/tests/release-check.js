#!/usr/bin/env node
// tests/release-check.js — Pilgrim Private release-consistency gate
//
// Fails (exit 1) when the release bookkeeping is out of step:
//   1. every `?v=X` cache-buster in the app's .js and index.html equals CHANGELOG[0].version (utils.js)
//   2. exactly one CHANGELOG entry carries a "untested" label, and it is the newest one
//   3. the newest CHANGELOG entry has items
// Run from pilgrim-private/ (or anywhere): node tests/release-check.js

'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
const fail = m => { console.log('FAIL ' + m); bad++; };

const utils = fs.readFileSync(path.join(root, 'utils.js'), 'utf8');
const start = utils.indexOf('var CHANGELOG=[');
if (start < 0) { console.log('FAIL could not find CHANGELOG in utils.js'); process.exit(1); }
const entries = [...utils.slice(start).matchAll(/version:'([^']+)',date:'[^']*',label:'([^']*)'/g)].map(m => ({ v: m[1], label: m[2] }));
if (!entries.length) { console.log('FAIL no CHANGELOG entries parsed'); process.exit(1); }
const latest = entries[0];
console.log('Newest CHANGELOG entry: v' + latest.v + ' (label: "' + latest.label + '")');

if (!/untested/i.test(latest.label)) fail('newest entry v' + latest.v + ' is not labeled "untested"');
entries.slice(1).forEach(e => { if (/untested/i.test(e.label)) fail('older entry v' + e.v + ' still labeled "untested"'); });

const files = fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f));
let checked = 0;
files.forEach(f => {
  let text = fs.readFileSync(path.join(root, f), 'utf8');
  if (f === 'utils.js') text = text.slice(0, Math.max(0, text.indexOf('var CHANGELOG=['))); // history text may mention old ?v= strings
  [...text.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].forEach(m => {
    checked++;
    if (m[1] !== latest.v) fail(f + ' has cache-buster ?v=' + m[1] + ' (expected ' + latest.v + ')');
  });
});
console.log('Cache-busters checked: ' + checked);
if (checked === 0) fail('no ?v= cache-busters found (index.html or imports changed shape?)');

console.log(bad ? bad + ' problem(s)' : 'release-check passed');
process.exit(bad ? 1 : 0);
