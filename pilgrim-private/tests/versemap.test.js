#!/usr/bin/env node
// versemap.test.js — English -> Hebrew verse map (v4.44.0)
// Usage (from pilgrim-private/): node tests/versemap.test.js
// versemap.js has no imports/DOM. Also reads data/macula/01-39 to check every mapped Hebrew verse really exists.
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = path.join(os.tmpdir(), 'versemap-' + process.pid + '.mjs');
fs.copyFileSync(path.join(__dirname, '..', 'versemap.js'), tmp);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}

import(tmp).then((m) => {
  const h = (b, c, v) => m.hebrewVerses(b, c, v).verses.map((x) => x.c + ':' + x.v + (x.title ? 't' : '') + (x.partial ? 'p' : ''));
  const d = (b, c, v) => m.hebrewVerses(b, c, v).differs;
  // Unaffected verses pass straight through
  eq('Gen 1:1 identity', h(1, 1, 1), ['1:1']); eq('Gen 1:1 not different', d(1, 1, 1), false);
  eq('Ps 1:1 identity', h(19, 1, 1), ['1:1']);
  eq('Joel 2:27 identity', h(29, 2, 27), ['2:27']);
  // Chapter-boundary shifts
  eq('Gen 31:55 = Hebrew 32:1', h(1, 31, 55), ['32:1']);
  eq('Gen 32:1 = Hebrew 32:2', h(1, 32, 1), ['32:2']);
  eq('Joel 2:28 = Hebrew 3:1', h(29, 2, 28), ['3:1']);
  eq('Joel 3:1 = Hebrew 4:1', h(29, 3, 1), ['4:1']);
  eq('Mal 4:1 = Hebrew 3:19', h(39, 4, 1), ['3:19']); eq('Mal 4:6 = Hebrew 3:24', h(39, 4, 6), ['3:24']);
  // Psalm titles: the title verse rides with English verse 1
  eq('Ps 3:1 = title + Hebrew 3:2', h(19, 3, 1), ['3:1t', '3:2']);
  eq('Ps 3:2 = Hebrew 3:3', h(19, 3, 2), ['3:3']);
  eq('Ps 51:1 = title + 51:2 + 51:3', h(19, 51, 1), ['51:1t', '51:2', '51:3']);
  eq('Ps 51:2 = Hebrew 51:4', h(19, 51, 2), ['51:4']);
  eq('Ps 51:1 differs', d(19, 51, 1), true);
  // Split verses
  eq('Num 26:1 = Hebrew 25:19 + 26:1', h(4, 26, 1), ['25:19', '26:1']);
  eq('Ps 13:5 = half of Hebrew 13:6', h(19, 13, 5), ['13:6p']);
  eq('Ps 13:6 = half of Hebrew 13:6', h(19, 13, 6), ['13:6p']);
  eq('1 Sam 20:42 = Hebrew 20:42 + 21:1', h(9, 20, 42), ['20:42', '21:1']);

  // Data checks against the real word files
  const dir = path.join(__dirname, '..', '..', 'data', 'macula');
  if (fs.existsSync(dir)) {
    const have = new Set(); let n = 0, missing = [];
    for (let b = 1; b <= 39; b++) {
      const book = JSON.parse(fs.readFileSync(path.join(dir, String(b).padStart(2, '0') + '.json'), 'utf8'));
      Object.keys(book).forEach((k) => have.add(b + ':' + k));
    }
    Object.keys(m.VM_RUNS).forEach((b) => m.VM_RUNS[b].forEach((r) => {
      for (let i = 0; i < r[4]; i++) { n++; if (!have.has(b + ':' + r[2] + ':' + (r[3] + i))) missing.push(b + ' ' + r[2] + ':' + (r[3] + i)); }
    }));
    eq('every mapped Hebrew verse exists in data/macula (' + n + ' pairs)', missing.slice(0, 5), []);
    eq('pair count matches the source map', n, 1978);
    const bad = m.VM_ORPHANS.filter((o) => !have.has(o.join(':')));
    eq('every Hebrew-only verse exists (' + m.VM_ORPHANS.length + ')', bad.slice(0, 5), []);
    // Every Hebrew verse in an affected book can be reached from some English verse
    const reached = new Set();
    Object.keys(m.VM_RUNS).forEach((b) => m.VM_RUNS[b].forEach((r) => { for (let i = 0; i < r[4]; i++) reached.add(b + ':' + r[2] + ':' + (r[3] + i)); }));
    m.VM_ORPHANS.forEach((o) => { const hv = m.hebrewVerses(o[0], o[1], o[2]).verses.map((x) => o[0] + ':' + x.c + ':' + x.v); hv.forEach((k) => reached.add(k)); });
    const orphanNotReached = m.VM_ORPHANS.filter((o) => !m.hebrewVerses(o[0], o[1], o[2]).verses.some((x) => x.c === o[1] && x.v === o[2]));
    eq('every Hebrew-only verse is shown with its English verse', orphanNotReached, []);
  } else { console.log('skipped data checks: data/macula not found'); }

  fs.unlinkSync(tmp);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
