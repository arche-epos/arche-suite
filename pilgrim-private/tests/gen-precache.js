#!/usr/bin/env node
// tests/gen-precache.js — generates the app-shell precache list + VERSION inside sw.js (Offline Phase 5)
//
//   node tests/gen-precache.js          rewrite the VERSION and PRECACHE blocks in sw.js
//   node tests/gen-precache.js --check  exit 1 if sw.js is out of date (release-check runs this logic)
//
// The list is: index.html, manifest.json, every icons/* file, every vendor/* file (not vendor/licenses),
// and every module referenced anywhere as <name>.js?v=<version> (exact URL, so each release changes every entry).
// No build tools are added to the app: this is a release-time script only.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

/** @returns {string} CHANGELOG[0].version from utils.js */
function latestVersion() {
  const utils = fs.readFileSync(path.join(root, 'utils.js'), 'utf8');
  const start = utils.indexOf('var CHANGELOG=[');
  const m = utils.slice(start).match(/version:'([^']+)'/);
  if (start < 0 || !m) throw new Error('could not read CHANGELOG[0].version from utils.js');
  return m[1];
}

/** @returns {{version:string, list:string[]}} the version and the sorted precache list */
function compute() {
  const version = latestVersion();
  const set = new Set(['index.html', 'manifest.json']);
  const addDir = (dir) => {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) return;
    fs.readdirSync(full).forEach(f => { if (fs.statSync(path.join(full, f)).isFile()) set.add(dir + '/' + f); });
  };
  addDir('icons');
  addDir('vendor');
  const re = /([A-Za-z0-9_.\/-]+\.js)\?v=(\d+\.\d+\.\d+)/g;
  fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f) && f !== 'sw.js' && f !== 'playwright.config.js').forEach(f => {
    let text = fs.readFileSync(path.join(root, f), 'utf8');
    if (f === 'utils.js') text = text.slice(0, Math.max(0, text.indexOf('var CHANGELOG=['))); // history text mentions old ?v= strings
    for (const m of text.matchAll(re)) {
      if (m[2] !== version) continue; // release-check reports mismatched cache-busters separately
      set.add(m[1].replace(/^\.\//, '') + '?v=' + m[2]);
    }
  });
  const list = [...set].sort();
  const missing = list.filter(e => !fs.existsSync(path.join(root, e.split('?')[0])));
  if (missing.length) throw new Error('precache entries with no file: ' + missing.join(', '));
  return { version, list };
}

/** @param {string} swText @returns {string} swText with VERSION and PRECACHE regenerated */
function render(swText) {
  const { version, list } = compute();
  const vBlock = "/* VERSION:BEGIN */\nconst VERSION = '" + version + "';\n/* VERSION:END */";
  const pBlock = '/* PRECACHE:BEGIN */\nconst PRECACHE = [\n' + list.map(e => "  '" + e + "'").join(',\n') + '\n];\n/* PRECACHE:END */';
  return swText
    .replace(/\/\* VERSION:BEGIN \*\/[\s\S]*?\/\* VERSION:END \*\//, vBlock)
    .replace(/\/\* PRECACHE:BEGIN \*\/[\s\S]*?\/\* PRECACHE:END \*\//, pBlock);
}

module.exports = { compute, render, latestVersion };

if (require.main === module) {
  const swPath = path.join(root, 'sw.js');
  const cur = fs.readFileSync(swPath, 'utf8');
  const next = render(cur);
  if (process.argv.includes('--check')) {
    if (cur !== next) { console.log('FAIL sw.js VERSION/PRECACHE is out of date: run node tests/gen-precache.js'); process.exit(1); }
    console.log('sw.js precache is up to date');
  } else {
    fs.writeFileSync(swPath, next);
    const { version, list } = compute();
    console.log('sw.js updated: v' + version + ', ' + list.length + ' precache entries');
  }
}
