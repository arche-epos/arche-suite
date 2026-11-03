// readingplan-core.js — Pilgrim Private ES Module (v4.58.0)
// Pure Reading Plans helpers: NO imports, NO DOM, NO localStorage (tests/readingplan-core.test.js runs under plain node).
// Storage + UI live in readingplan.js; the outline lives in readingplan-data.js (a plan object is passed in).
//
// Store shape (one localStorage key per user, see SK_READPLAN in utils.js):
//   { v:1, plans:{ storyflow:{ items:{ "Gen.12":{ r:1, d:<epoch ms>, u:<epoch ms> } }, opts:{ hideChron:{ v:false, u:0 } } } } }
// r: 1 checked / 0 unchecked. d: read time, set on check. u: last-changed time (merge clock).
// An unchecked record {r:0,u} is its own tombstone. Only touched items are stored.

var RP_STORE_VERSION = 1;
var RP_PLAN_ID = 'storyflow';

function rpEmptyPlanState() { return { items: {}, opts: { hideChron: { v: false, u: 0 } } }; }
function rpEmptyStore() { var p = {}; p[RP_PLAN_ID] = rpEmptyPlanState(); return { v: RP_STORE_VERSION, plans: p }; }

function _isNum(n) { return typeof n === 'number' && isFinite(n); }

function _normItem(rec) {
  if (!rec || typeof rec !== 'object') return null;
  var u = _isNum(rec.u) ? rec.u : 0;
  if (rec.r === 1 || rec.r === true) return { r: 1, d: _isNum(rec.d) ? rec.d : u, u: u };
  if (rec.r === 0 || rec.r === false) return { r: 0, u: u };
  return null;
}

function _normPlanState(raw) {
  var out = rpEmptyPlanState();
  if (!raw || typeof raw !== 'object') return out;
  if (raw.items && typeof raw.items === 'object') {
    Object.keys(raw.items).forEach(function(id) {
      var n = _normItem(raw.items[id]);
      if (n) out.items[id] = n;   // unknown ids are kept so an outline edit can never destroy marks
    });
  }
  if (raw.opts && typeof raw.opts === 'object') {
    Object.keys(raw.opts).forEach(function(k) {
      var o = raw.opts[k];
      if (o && typeof o === 'object') out.opts[k] = { v: o.v, u: _isNum(o.u) ? o.u : 0 };
    });
  }
  out.opts.hideChron = { v: !!(out.opts.hideChron && out.opts.hideChron.v), u: _isNum(out.opts.hideChron && out.opts.hideChron.u) ? out.opts.hideChron.u : 0 };
  return out;
}

/**
 * Coerces untrusted data (localStorage, backup, imported file) into a valid store. Never throws.
 * Unknown plans and unknown item ids are kept; malformed records are dropped.
 * @param {*} raw
 * @returns {{v:number,plans:Object}}
 */
function rpNormalizeStore(raw) {
  var out = rpEmptyStore();
  if (!raw || typeof raw !== 'object' || !raw.plans || typeof raw.plans !== 'object') return out;
  Object.keys(raw.plans).forEach(function(pid) { out.plans[pid] = _normPlanState(raw.plans[pid]); });
  return out;
}

/** @returns {boolean} true if the store holds anything worth writing to a backup. */
function rpStoreHasData(store) {
  var s = rpNormalizeStore(store);
  return Object.keys(s.plans).some(function(pid) {
    var p = s.plans[pid];
    return Object.keys(p.items).length > 0 || Object.keys(p.opts).some(function(k) { return p.opts[k].u > 0; });
  });
}

function _mergeItem(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.u !== b.u) return a.u > b.u ? a : b;
  return a.r >= b.r ? a : b;      // tie favors checked
}

/**
 * Merges two stores (sync / import). Per item the higher `u` wins, ties favor checked; per option the higher `u` wins.
 * @returns {{v:number,plans:Object}}
 */
function rpMerge(a, b) {
  var A = rpNormalizeStore(a), B = rpNormalizeStore(b);
  var out = rpEmptyStore();
  var pids = {};
  Object.keys(A.plans).concat(Object.keys(B.plans)).forEach(function(k) { pids[k] = true; });
  Object.keys(pids).forEach(function(pid) {
    var pa = A.plans[pid] || rpEmptyPlanState(), pb = B.plans[pid] || rpEmptyPlanState();
    var items = {};
    Object.keys(pa.items).concat(Object.keys(pb.items)).forEach(function(id) {
      if (items[id]) return;
      items[id] = _mergeItem(pa.items[id], pb.items[id]);
    });
    var opts = {};
    Object.keys(pa.opts).concat(Object.keys(pb.opts)).forEach(function(k) {
      var x = pa.opts[k], y = pb.opts[k];
      opts[k] = !x ? y : !y ? x : (y.u > x.u ? y : x);
    });
    out.plans[pid] = { items: items, opts: opts };
  });
  return out;
}

// ── Mutations (return the previous record so the UI can offer Undo) ──────────────────────

/** Checks or unchecks one item in a plan state, in place. @returns {Object|null} previous record (or null if none). */
function rpSetChecked(state, id, checked, now) {
  var prev = state.items[id] || null;
  state.items[id] = checked ? { r: 1, d: now, u: now } : { r: 0, u: now };
  return prev;
}
/** Undo of rpSetChecked: puts the previous record back but stamps a new `u` so the undo wins a later sync. */
function rpRestore(state, id, prev, now) {
  if (!prev) { state.items[id] = { r: 0, u: now }; return; }
  state.items[id] = prev.r === 1 ? { r: 1, d: prev.d, u: now } : { r: 0, u: now };
}
function rpSetHideChron(state, on, now) { state.opts.hideChron = { v: !!on, u: now }; }

// ── Derived values ────────────────────────────────────────────────────────────────────────

/** @returns {Object[]} visible items in plan order (Chronicles removed when hidden). */
function rpVisibleItems(plan, state, hideChron) {
  return hideChron ? plan.items.filter(function(it) { return !it.chron; }) : plan.items;
}
function _isChecked(state, id) { var r = state.items[id]; return !!(r && r.r === 1); }

function _pct(cw, tw) { return tw > 0 ? Math.floor(100 * cw / tw) : 0; }  // floor: nothing unchecked ever shows 100%

/**
 * Progress for the whole plan, each part and each group (visible items only).
 * Overall % is weighted so the Gospels count as their 89 chapters, not as 94 events.
 * @returns {{overall:{pct:number,checked:number,total:number},parts:Object,groups:Object}}
 */
function rpProgress(plan, state, hideChron) {
  var cwAll = 0, twAll = 0, parts = {}, groups = {};
  plan.parts.forEach(function(part) {
    var pc = 0, pt = 0, pcw = 0, ptw = 0;
    part.groups.forEach(function(g) {
      if (hideChron && g.chron) return;
      var gc = 0, gcw = 0, gtw = 0;
      // Item-level so Psalms inside the mixed Chronicles groups stay counted when Chronicles are hidden (v4.59.0)
      var vis = hideChron ? g.items.filter(function(it) { return !it.chron; }) : g.items;
      vis.forEach(function(it) {
        gtw += it.w;
        if (_isChecked(state, it.id)) { gc++; gcw += it.w; }
      });
      groups[g.id] = { checked: gc, total: vis.length, pct: _pct(gcw, gtw), done: gc === vis.length && vis.length > 0 };
      pc += gc; pt += vis.length; pcw += gcw; ptw += gtw;
    });
    parts[part.id] = { checked: pc, total: pt, pct: _pct(pcw, ptw), done: pt > 0 && pc === pt };
    cwAll += pcw; twAll += ptw;
  });
  return { overall: { pct: _pct(cwAll, twAll), checked: Object.keys(parts).reduce(function(a, k) { return a + parts[k].checked; }, 0), total: Object.keys(parts).reduce(function(a, k) { return a + parts[k].total; }, 0) }, parts: parts, groups: groups };
}

/**
 * Bookmark = the checked visible item with the highest plan-order position. Filling a gap behind it never moves it.
 * @returns {{item:Object,pos:number,d:number}|null}
 */
function rpBookmark(plan, state, hideChron) {
  var best = null;
  plan.items.forEach(function(it, pos) {
    if (hideChron && it.chron) return;
    if (_isChecked(state, it.id)) best = { item: it, pos: pos, d: state.items[it.id].d };
  });
  return best;
}

/**
 * Unchecked visible items earlier in plan order than the bookmark, grouped by group (plan order).
 * @returns {{count:number,hasEvents:boolean,groups:{group:Object,items:Object[]}[]}}
 */
function rpGaps(plan, state, hideChron) {
  var bm = rpBookmark(plan, state, hideChron);
  var out = { count: 0, hasEvents: false, groups: [] };
  if (!bm) return out;
  plan.groups.forEach(function(g) {
    if (hideChron && g.chron) return;
    var missing = g.items.filter(function(it) { return !(hideChron && it.chron) && plan.index[it.id] < bm.pos && !_isChecked(state, it.id); });
    if (missing.length) {
      out.groups.push({ group: g, items: missing });
      out.count += missing.length;
      if (missing.some(function(it) { return it.type === 'ev'; })) out.hasEvents = true;
    }
  });
  return out;
}

// ── Plan playback (v4.60.0): read / listen along the plan. Pure helpers; the session itself lives in memory in readingplan.js ──

/**
 * The readable passages of one plan item, in order. A chapter item is its own label ("Genesis 12", "Acts 18:1-17").
 * A Gospel event splits on ";" and expands comma lists, so "Matthew 26:1-5, 14-16" becomes two passages.
 * @param {Object} item
 * @returns {string[]}
 */
function rpItemPassages(item) {
  if (!item) return [];
  if (item.type !== 'ev') return [item.label];
  var out = [];
  String(item.passages || '').split(';').forEach(function(seg) {
    seg = seg.trim();
    if (!seg) return;
    var parts = seg.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var m = parts[0].match(/^(.*\s\d+):\d+/);   // "Matthew 26" so a bare "14-16" can inherit it
    out.push(parts[0]);
    for (var i = 1; i < parts.length; i++) {
      out.push(m && /^\d+(-\d+)?$/.test(parts[i]) ? m[1] + ':' + parts[i] : parts[i]);
    }
  });
  return out;
}

/**
 * Where "Continue" starts: the first unchecked item after the Last Read bookmark. With no bookmark, the first item.
 * If nothing unchecked is left after the bookmark, falls back to the first unchecked item anywhere (an earlier gap).
 * @returns {number} plan position, or -1 when every item is checked
 */
function rpContinuePos(plan, state) {
  var bm = rpBookmark(plan, state, false);
  var from = bm ? bm.pos + 1 : 0, i;
  for (i = from; i < plan.items.length; i++) if (!_isChecked(state, plan.items[i].id)) return i;
  for (i = 0; i < from && i < plan.items.length; i++) if (!_isChecked(state, plan.items[i].id)) return i;
  return -1;
}

/** @returns {number} position of the group's first unchecked item, or its first item when all are checked; -1 if unknown group. */
function rpGroupStartPos(plan, state, groupId) {
  var g = plan.groups.filter(function(x) { return x.id === groupId; })[0];
  if (!g || !g.items.length) return -1;
  for (var i = 0; i < g.items.length; i++) if (!_isChecked(state, g.items[i].id)) return plan.index[g.items[i].id];
  return plan.index[g.items[0].id];
}

/** @returns {boolean} true when the item at `pos` is the last one in its group. */
function rpIsGroupEnd(plan, pos) {
  var a = plan.items[pos], b = plan.items[pos + 1];
  return !!a && (!b || b.groupId !== a.groupId);
}

/**
 * One step of listening. Called when a passage finishes speaking naturally.
 *  - more passages left in this item  -> { action:'passage', pos, passIdx }
 *  - item finished (check = true)     -> { action:'item', pos:next, passIdx:0, check:true }
 *  - item finished at a section end with stopAtEnd -> { action:'stop', pos:next, passIdx:0, check:true }
 *  - last item of the plan            -> { action:'end', check:true }
 * Never skips an item and never changes order.
 */
function rpStep(plan, pos, passIdx, stopAtEnd) {
  var item = plan.items[pos];
  if (!item) return { action: 'end', check: false };
  if (passIdx + 1 < rpItemPassages(item).length) return { action: 'passage', pos: pos, passIdx: passIdx + 1, check: false };
  if (pos + 1 >= plan.items.length) return { action: 'end', check: true };
  if (stopAtEnd && rpIsGroupEnd(plan, pos)) return { action: 'stop', pos: pos + 1, passIdx: 0, check: true };
  return { action: 'item', pos: pos + 1, passIdx: 0, check: true };
}

export {
  RP_STORE_VERSION, RP_PLAN_ID,
  rpEmptyStore, rpEmptyPlanState, rpNormalizeStore, rpStoreHasData, rpMerge,
  rpSetChecked, rpRestore, rpSetHideChron,
  rpVisibleItems, rpProgress, rpBookmark, rpGaps,
  rpItemPassages, rpContinuePos, rpGroupStartPos, rpIsGroupEnd, rpStep
};
