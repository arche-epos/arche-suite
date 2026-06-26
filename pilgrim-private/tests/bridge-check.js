#!/usr/bin/env node
// bridge-check.js — Pilgrim Private ES Modules Bridge Coverage Checker
// Usage: node tests/bridge-check.js
// Run from: pilgrim-private/ directory
//
// What it checks:
//   1. Parses index.html — extracts every function name called from inline handlers
//   2. Parses each module file — extracts all exported names
//   3. Simulates the app.js window bridge loop (exported = bridged)
//   4. Diffs required vs bridged — reports any gaps
//
// A gap means: the function is called via onclick/onX in HTML but is not
// exported from its module, so app.js never assigns it to window.*.
// This is exactly the class of bug that broke closeVerseModal.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

const HTML_FILE = path.join(ROOT, 'index.html');

const MODULES = [
  { file: 'utils.js',      name: 'Utils'      },
  { file: 'storage.js',    name: 'Storage'    },
  { file: 'tts.js',        name: 'TTS'        },
  { file: 'sync.js',       name: 'Sync'       },
  { file: 'studyTools.js', name: 'StudyTools' },
  { file: 'ui.js',         name: 'UI'         },
];

// Native JS/DOM names that appear in inline handlers but are NOT module
// functions — filtering these prevents false positives.
const NATIVE_NAMES = new Set([
  'getElementById', 'querySelector', 'querySelectorAll',
  'addEventListener', 'removeEventListener', 'stopPropagation', 'preventDefault',
  'select', 'focus', 'blur', 'click', 'submit', 'reset',
  'getAttribute', 'setAttribute', 'removeAttribute',
  'classList', 'style', 'dataset',
  'var', 'if', 'else', 'return', 'typeof', 'instanceof',
  'function', 'new', 'delete', 'void', 'throw', 'try', 'catch',
  'document', 'window', 'event', 'this', 'self',
  'Object', 'Array', 'Math', 'JSON', 'String', 'Number', 'Boolean', 'Date',
  'Promise', 'Set', 'Map', 'Symbol', 'Error',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'alert', 'confirm', 'prompt', 'console',
  'fetch', 'XMLHttpRequest', 'FormData', 'FileReader',
  'toUpperCase', 'toLowerCase', 'trim', 'split', 'join', 'slice',
  'replace', 'match', 'indexOf', 'includes', 'startsWith', 'endsWith',
  'push', 'pop', 'shift', 'unshift', 'splice', 'filter', 'map', 'find',
  'forEach', 'reduce', 'some', 'every', 'sort', 'reverse',
  'toString', 'valueOf', 'hasOwnProperty', 'keys', 'values', 'entries',
  'assign', 'freeze', 'create', 'defineProperty',
  'parse', 'stringify',
  'floor', 'ceil', 'round', 'abs', 'max', 'min', 'random', 'sqrt', 'pow',
  'log', 'warn', 'error', 'info', 'debug',
  'rotate', // CSS transform via style — not a module fn
]);

// Manual window.* bridges in app.js beyond the export loop.
// These are bridged even if not exported from a module.
const MANUAL_BRIDGES = new Set([
  'startPilgrim',
]);

// ── Step 1: Extract required function names from index.html ─────────────────

/**
 * Reads index.html and returns every unique function name called from
 * inline event handlers (onclick, onchange, oninput, etc.).
 * @returns {Set<string>}
 */
function extractRequiredNames(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const required = new Set();

  // Match all on* attribute values: onclick="...", onchange="...", etc.
  const handlerPattern = /\bon\w+="([^"]*)"/g;
  let handlerMatch;

  while ((handlerMatch = handlerPattern.exec(html)) !== null) {
    const handlerBody = handlerMatch[1];

    // Extract all identifiers that are followed by '(' — these are function calls.
    // Covers: fn(), obj.fn() (skip obj.fn — not a window.* call), fn(arg1, arg2)
    const callPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g;
    let callMatch;

    while ((callMatch = callPattern.exec(handlerBody)) !== null) {
      const name = callMatch[1];
      if (!NATIVE_NAMES.has(name)) {
        required.add(name);
      }
    }
  }

  return required;
}

// ── Step 2: Extract exported names from each module ─────────────────────────

/**
 * Parses a JS module file and returns all names in its export block.
 * Handles both named export blocks:  export { a, b, c };
 * and inline export declarations:    export function foo() {}
 *                                    export var bar = ...;
 *                                    export const baz = ...;
 * @param {string} filePath
 * @returns {{ names: Set<string>, source: string }}
 */
function extractExportedNames(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const names = new Set();

  // Named export block: export { a, b, c, d };
  // Handles multi-line blocks with comments
  const blockPattern = /export\s*\{([^}]+)\}/g;
  let blockMatch;
  while ((blockMatch = blockPattern.exec(src)) !== null) {
    const block = blockMatch[1];
    // Strip // comments from each line, then extract identifiers
    const cleaned = block.replace(/\/\/[^\n]*/g, '');
    const identPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    let identMatch;
    while ((identMatch = identPattern.exec(cleaned)) !== null) {
      const name = identMatch[1];
      // Skip aliased exports like: export { foo as bar } — we want the external name
      // The pattern "name as alias" — skip 'as' keyword
      if (name !== 'as') names.add(name);
    }
  }

  // Inline export declarations:
  //   export function foo() {}
  //   export var foo = ...
  //   export const foo = ...
  //   export let foo = ...
  const inlinePattern = /^export\s+(?:function|var|const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
  let inlineMatch;
  while ((inlineMatch = inlinePattern.exec(src)) !== null) {
    names.add(inlineMatch[1]);
  }

  return { names, source: path.basename(filePath) };
}

// ── Step 3: Build bridged set ────────────────────────────────────────────────

/**
 * Simulates the app.js bridge loop — any function exported from any module
 * is assigned to window.* (first-writer wins, but we just care about coverage).
 * Also includes manual window.* bridges defined directly in app.js.
 * @param {Array<{names: Set<string>, source: string}>} moduleExports
 * @returns {Map<string, string>} name → source module
 */
function buildBridgedMap(moduleExports) {
  const bridged = new Map();

  // Manual bridges first (they're set before the loop in app.js)
  MANUAL_BRIDGES.forEach(function(name) {
    bridged.set(name, 'app.js (manual)');
  });

  // Loop mirrors: [Utils, Storage, TTS, Sync, StudyTools, UI].forEach(...)
  moduleExports.forEach(function(mod) {
    mod.names.forEach(function(name) {
      if (!bridged.has(name)) {
        bridged.set(name, mod.source);
      }
    });
  });

  return bridged;
}

// ── Step 4: Report ───────────────────────────────────────────────────────────

function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Pilgrim Private — ES Modules Bridge Coverage Check');
  console.log('══════════════════════════════════════════════════════\n');

  // Verify files exist
  if (!fs.existsSync(HTML_FILE)) {
    console.error('❌  index.html not found at:', HTML_FILE);
    console.error('    Run from the pilgrim-private/ directory.');
    process.exit(1);
  }

  // Step 1 — HTML required names
  const required = extractRequiredNames(HTML_FILE);
  console.log(`📄  index.html   — ${required.size} unique function calls found in inline handlers\n`);

  // Step 2 — Module exports
  const moduleExports = [];
  MODULES.forEach(function(mod) {
    const filePath = path.join(ROOT, mod.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️   ${mod.file} not found — skipping`);
      return;
    }
    const result = extractExportedNames(filePath);
    moduleExports.push(result);
    console.log(`📦  ${mod.file.padEnd(16)} — ${result.names.size} exported names`);
  });

  // Step 3 — Bridged map
  const bridged = buildBridgedMap(moduleExports);
  console.log(`\n🌉  Total bridged to window.*: ${bridged.size}\n`);

  // Step 4 — Diff
  const gaps = [];
  required.forEach(function(name) {
    if (!bridged.has(name)) {
      gaps.push(name);
    }
  });

  if (gaps.length === 0) {
    console.log('✅  All inline handler functions are bridged to window.*\n');
  } else {
    console.log(`❌  ${gaps.length} gap(s) found — these functions are called in HTML but not exported:\n`);
    gaps.sort().forEach(function(name) {
      console.log(`    ✗  ${name}`);
    });
    console.log('');
  }

  // Bonus: report functions bridged but never called from HTML
  // (not errors — may be called from JS — but useful to know about)
  const uncalled = [];
  bridged.forEach(function(source, name) {
    if (!required.has(name)) {
      uncalled.push({ name, source });
    }
  });

  if (uncalled.length > 0) {
    console.log(`ℹ️   ${uncalled.length} bridged function(s) have no inline HTML handler (called from JS only — not errors):`);
    // Only show these in verbose mode to keep default output clean
    if (process.argv.includes('--verbose')) {
      uncalled.sort(function(a,b) { return a.name.localeCompare(b.name); })
               .forEach(function(item) {
        console.log(`    ·  ${item.name.padEnd(30)} (${item.source})`);
      });
    } else {
      console.log('    Run with --verbose to list them.\n');
    }
  }

  console.log('══════════════════════════════════════════════════════\n');

  // Exit code — CI-friendly
  process.exit(gaps.length > 0 ? 1 : 0);
}

run();
