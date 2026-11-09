#!/usr/bin/env node
// readingplan-library.test.js — plan library integrity + enrollment logic (spec-reading-plan-library-v1.md, v4.62.0)
// Usage (from pilgrim-private/): node tests/readingplan-library.test.js
const fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplib-'));
fs.copyFileSync(path.join(__dirname, '..', 'readingplan-data.js'), path.join(dir, 'readingplan-data.mjs'));
fs.copyFileSync(path.join(__dirname, '..', 'readingplan-core.js'), path.join(dir, 'readingplan-core.mjs'));

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}

Promise.all([import(path.join(dir, 'readingplan-data.mjs')), import(path.join(dir, 'readingplan-core.mjs'))]).then(([d, c]) => {
  const ids = d.RP_PLAN_LIST.map((p) => p.id);
  eq('ten plans in the registry', ids, ['storyflow', 'life-of-jesus', 'canon', 'nt', 'psalms-proverbs', 'acts-letters', 'ot-story', 'genesis-1-11', 'creation', 'lineage']);
  eq('unknown plan id builds nothing', d.rpBuildPlan('nope'), null);

  const P = {}; ids.forEach((id) => { P[id] = d.rpBuildPlan(id); });

  // ── v4.62.0 content plans ──
  const BK = d.RP_BOOKS.map((b) => b[1]);
  const okRef = (seg) => { const m = /^((?:[123] )?[A-Za-z]+(?: of [A-Za-z]+)?) (\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/.exec(seg.trim()); return !!m && BK.includes(m[1]); };
  ['psalms-proverbs', 'genesis-1-11', 'creation', 'lineage'].forEach((id) => {
    P[id].items.forEach((it) => {
      eq(id + ' ' + it.id + ': type ev, weight', [it.type, it.w], ['ev', d.RP_W_EV]);
      const bad = it.passages.split(';').filter((s) => !okRef(s));
      eq(id + ' ' + it.id + ': every segment is a full reference (' + it.passages + ')', bad, []);
    });
  });
  const covered = (id, book) => { const seen = {}; P[id].items.forEach((it) => it.passages.split(';').forEach((s) => { const m = /^\s*(\D+?) (\d+)(?::\d+(?:-\d+(?::\d+)?)?|-(\d+))?/.exec(s); if (m && m[1] === book) for (let n = +m[2]; n <= +(m[3] || m[2]); n++) seen[n] = (seen[n] || 0) + 1; })); return seen; };
  const ps = covered('psalms-proverbs', 'Psalms'), pr = covered('psalms-proverbs', 'Proverbs');
  eq('psalms-proverbs: Psalms 1-150 each once', Object.keys(ps).length === 150 && Object.values(ps).every((v) => v === 1), true);
  eq('psalms-proverbs: Proverbs 1-31 each once', Object.keys(pr).length === 31 && Object.values(pr).every((v) => v === 1), true);
  eq('psalms-proverbs: ids pp.1..pp.30', P['psalms-proverbs'].items.map((i) => i.id), Array.from({ length: 30 }, (_, i) => 'pp.' + (i + 1)));
  eq('psalms-proverbs: day 1 and day 30', [P['psalms-proverbs'].items[0].passages, P['psalms-proverbs'].items[29].passages], ['Psalms 1-5; Proverbs 1', 'Psalms 146-150; Proverbs 30; Proverbs 31']);
  const gn = covered('genesis-1-11', 'Genesis');
  eq('genesis-1-11: chapters 1-11 all present', Object.keys(gn).map(Number), [1,2,3,4,5,6,7,8,9,10,11]);
  eq('creation: Bible order of first books', P.creation.items.map((i) => i.passages.split(' ')[0]).slice(0, 4), ['Genesis', 'Genesis', 'Nehemiah', 'Job']);
  eq('lineage: ends with Matthew then Luke genealogy', P.lineage.items.slice(-2).map((i) => i.passages), ['Matthew 1:1-17', 'Luke 3:23-38']);
  eq('every content plan has an About with the prototype note', ['psalms-proverbs', 'genesis-1-11', 'creation', 'lineage'].every((id) => P[id].about && (P[id].about && P[id].about.note.indexOf('prototype') > 0)), true);
  eq('units on registry entries', d.RP_PLAN_LIST.filter((x) => x.unit).map((x) => x.unit), ['days', 'passages', 'readings']);
  const expect = { storyflow: 1196, 'life-of-jesus': 94, canon: 1189, nt: 260, 'acts-letters': 173, 'ot-story': 929, 'psalms-proverbs': 30, 'genesis-1-11': 11, creation: 21, lineage: 19 };
  ids.forEach((id) => {
    const p = P[id];
    eq(id + ': item count', p.items.length, expect[id]);
    eq(id + ': item ids unique', new Set(p.items.map((i) => i.id)).size, p.items.length);
    eq(id + ': index matches order', p.items.every((it, n) => p.index[it.id] === n), true);
    eq(id + ': plan id and name', [p.id, p.name], [id, d.RP_PLAN_LIST.find((x) => x.id === id).name]);
    eq(id + ': every item sits in a real group and part', p.items.every((it) => p.groups.some((g) => g.id === it.groupId && g.partId === it.partId) && p.parts.some((pt) => pt.id === it.partId)), true);
    eq(id + ': groups flat list equals parts', p.parts.reduce((a, pt) => a + pt.groups.length, 0), p.groups.length);
    eq(id + ': no empty group', p.groups.every((g) => g.items.length > 0), true);
    eq(id + ': group ids unique', new Set(p.groups.map((g) => g.id)).size, p.groups.length);
    eq(id + ': About has title, credit, intro, outro and the prototype note', !!(p.about && p.about.title && p.about.by === 'Jesse Caldwell' && p.about.intro.length && p.about.outro.length && /prototype/.test(p.about.note)), true);
    eq(id + ': every item yields at least one passage', p.items.every((it) => c.rpItemPassages(it).length > 0), true);
    if (id !== 'storyflow') eq(id + ': no group over 60 items', Math.max.apply(null, p.groups.map((g) => g.items.length)) <= 60, true);
  });
  eq('Biblical Story About carries the prototype note', /prototype/.test(P.storyflow.about.note), true);

  // Slices equal The Biblical Story's own parts, in order, same ids
  const sf = P.storyflow;
  const idsOf = (parts) => sf.items.filter((i) => parts.indexOf(i.partId) >= 0).map((i) => i.id);
  eq('life-of-jesus = Part 7', P['life-of-jesus'].items.map((i) => i.id), idsOf(['p7']));
  eq('acts-letters = Part 8', P['acts-letters'].items.map((i) => i.id), idsOf(['p8']));
  eq('ot-story = Parts 1-6', P['ot-story'].items.map((i) => i.id), idsOf(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']));
  eq('ot-story + life + acts = whole story', P['ot-story'].items.length + P['life-of-jesus'].items.length + P['acts-letters'].items.length, sf.items.length);
  eq('ot-story keeps the Psalm placement (Psalm 104 right after Genesis 2)', (() => { const x = P['ot-story'].index; return x['Ps.104'] === x['Gen.2'] + 1; })(), true);
  eq('single-part slices drop the part number', [P['life-of-jesus'].parts[0].name, P['acts-letters'].parts[0].name], ['Gospels', 'Acts and the Letters']);

  // Canon: every chapter of every book exactly once, canon order, Psalms numeric, Acts whole
  const want = []; d.RP_BOOKS.forEach((b) => { for (let n = 1; n <= b[3]; n++) want.push(b[0] + '.' + n); });
  eq('canon covers every chapter once, in canon order', P.canon.items.map((i) => i.id), want);
  eq('nt = Matthew 1 to Revelation 22', P.nt.items.map((i) => i.id), want.slice(want.indexOf('Matt.1')));
  eq('canon has no split Acts items', P.canon.items.some((i) => /^Acts\.\d+[ab]$/.test(i.id)), false);
  eq('canon parts', P.canon.parts.map((p) => p.name), ['Law', 'History', 'Wisdom and Poetry', 'Prophets', 'Gospels and Acts', 'Letters', 'Revelation']);
  eq('nt parts', P.nt.parts.map((p) => p.name), ['Gospels and Acts', 'Letters', 'Revelation']);
  eq('Psalms split in five books', P.canon.groups.filter((g) => /^Psalms /.test(g.name)).map((g) => g.name), ['Psalms 1–41', 'Psalms 42–72', 'Psalms 73–89', 'Psalms 90–106', 'Psalms 107–150']);
  eq('Isaiah split in two halves', P.canon.groups.filter((g) => /^Isaiah/.test(g.name)).map((g) => [g.name, g.items.length]), [['Isaiah 1–39', 39], ['Isaiah 40–66', 27]]);
  eq('nt weights are all chapter weight', P.nt.items.every((i) => i.w === d.RP_W_CH), true);
  eq('mixed canon groups prefix the book on chips', (() => { const g = P.canon.groups.find((x) => x.mixed); return g ? g.items[0].short.indexOf(' ') > 0 && /^[A-Za-z0-9 ]+ \d+$/.test(g.items[0].short) : 'no mixed group'; })(), true);

  // Enrollment
  const now = 1700000000000;
  const empty = c.rpEmptyPlanState();
  eq('never written = not enrolled', c.rpIsEnrolled(empty), false);
  eq('null state = not enrolled', c.rpIsEnrolled(null), false);
  const st = c.rpEmptyPlanState(); c.rpSetEnrolled(st, true, now);
  eq('Start writes enrolled', [c.rpIsEnrolled(st), st.opts.enrolled], [true, { v: true, u: now }]);
  c.rpSetEnrolled(st, false, now + 5);
  eq('Leave writes v:false', [c.rpIsEnrolled(st), st.opts.enrolled.u], [false, now + 5]);
  const withChecks = c.rpEmptyPlanState(); c.rpSetChecked(withChecks, 'Gen.1', true, now);
  eq('checks without enrolled = not enrolled (no derived enrollment)', [c.rpIsEnrolled(withChecks), c.rpHasProgress(withChecks)], [false, true]);
  c.rpSetEnrolled(withChecks, false, now + 1); c.rpSetEnrolled(withChecks, true, now + 2);
  eq('Leave then Start restores the same checks', [c.rpIsEnrolled(withChecks), withChecks.items['Gen.1'].r], [true, 1]);

  // Store: enrolled survives normalize and merge; per-plan progress is independent
  const store = c.rpEmptyStore();
  store.plans.canon = c.rpEmptyPlanState(); store.plans.nt = c.rpEmptyPlanState();
  c.rpSetEnrolled(store.plans.canon, true, now + 10); c.rpSetEnrolled(store.plans.nt, true, now + 5);
  c.rpSetChecked(store.plans.canon, 'Matt.1', true, now + 11);
  eq('normalize keeps enrolled and the other plans', (() => { const n = c.rpNormalizeStore(JSON.parse(JSON.stringify(store))); return [n.plans.canon.opts.enrolled.v, n.plans.nt.opts.enrolled.v, !!n.plans.nt.items['Matt.1']]; })(), [true, true, false]);
  eq('checking Matt.1 in canon leaves nt untouched', [!!store.plans.canon.items['Matt.1'], !!store.plans.nt.items['Matt.1']], [true, false]);
  eq('enrolled ids follow the order started, not the registry', c.rpEnrolledIds(store, ids), ['nt', 'canon']);
  eq('unenrolled plans are not listed', c.rpEnrolledIds(c.rpEmptyStore(), ids), []);
  eq('hasData is true for an enrolled-only store (rides in backups)', c.rpStoreHasData(store), true);
  eq('hasData is false for a pristine store', c.rpStoreHasData(c.rpEmptyStore()), false);
  const a = c.rpEmptyStore(), b = c.rpEmptyStore();
  a.plans.canon = c.rpEmptyPlanState(); b.plans.canon = c.rpEmptyPlanState();
  c.rpSetEnrolled(a.plans.canon, true, now); c.rpSetEnrolled(b.plans.canon, false, now + 100);
  eq('merge: later Leave wins over earlier Start', c.rpMerge(a, b).plans.canon.opts.enrolled, { v: false, u: now + 100 });
  eq('merge: later Start wins over earlier Leave', c.rpMerge(b, a).plans.canon.opts.enrolled.v, false);
  const old = JSON.parse('{"v":1,"plans":{"storyflow":{"items":{"Gen.1":{"r":1,"d":5,"u":5}},"opts":{"hideChron":{"v":false,"u":0}}}}}');
  eq('an old store with progress is NOT enrolled (hidden until Start) and keeps its checks', [c.rpIsEnrolled(c.rpNormalizeStore(old).plans.storyflow), !!c.rpNormalizeStore(old).plans.storyflow.items['Gen.1']], [false, true]);
  eq('junk enrolled value is not enrolled', c.rpIsEnrolled(c.rpNormalizeStore({ v: 1, plans: { canon: { items: {}, opts: { enrolled: { v: 'yes', u: 1 } } } } }).plans.canon), false);

  // Playback works on every plan: walk each plan start to end, every item once, in order
  ids.forEach((id) => {
    const p = P[id]; let pos = 0, pi = 0, visited = 0, ok = true, guard = 0;
    for (;;) {
      if (++guard > 20000) { ok = false; break; }
      const s = c.rpStep(p, pos, pi, false, 'off');
      if (s.check) visited++;
      if (s.action === 'end') break;
      if (s.action === 'item' && s.pos !== pos + 1) { ok = false; break; }
      pos = s.pos; pi = s.passIdx;
    }
    eq(id + ': playback walk visits every item once', [ok, visited], [true, p.items.length]);
    eq(id + ': Continue on a fresh plan starts at item 0', c.rpContinuePos(p, c.rpEmptyPlanState()), 0);
  });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
