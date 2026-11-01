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
      g.items.forEach(function(it) {
        gtw += it.w;
        if (_isChecked(state, it.id)) { gc++; gcw += it.w; }
      });
      groups[g.id] = { checked: gc, total: g.items.length, pct: _pct(gcw, gtw), done: gc === g.items.length && g.items.length > 0 };
      pc += gc; pt += g.items.length; pcw += gcw; ptw += gtw;
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
    var missing = g.items.filter(function(it) { return plan.index[it.id] < bm.pos && !_isChecked(state, it.id); });
    if (missing.length) {
      out.groups.push({ group: g, items: missing });
      out.count += missing.length;
      if (missing.some(function(it) { return it.type === 'ev'; })) out.hasEvents = true;
    }
  });
  return out;
}

export {
  RP_STORE_VERSION, RP_PLAN_ID,
  rpEmptyStore, rpEmptyPlanState, rpNormalizeStore, rpStoreHasData, rpMerge,
  rpSetChecked, rpRestore, rpSetHideChron,
  rpVisibleItems, rpProgress, rpBookmark, rpGaps
};
