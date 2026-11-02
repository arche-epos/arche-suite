// readingplan.js — Pilgrim Private ES Module (v4.58.0)
// Reading Plans v1 (Story Flow): check chapters off, a "Last Read" bookmark, progress bars and percentages.
// Spec: claude/spec-reading-plans-v1.md (Rev 2). Pure logic lives in readingplan-core.js, the outline in
// readingplan-data.js; this module owns storage I/O, the Progress-tab card and the full-screen plan overlay.
//
// Storage: one per-user localStorage key, SK_READPLAN ('bsn_readplan_<userId>'), holding only progress
// ({ v:1, plans:{ storyflow:{ items, opts } } }). Included in Gist sync (sync.js), JSON backup (ui.js), the
// safety copy (utils.js) and removed by Clear All through the existing per-user suffix rule.
// Imports only utils.js + core + data so sync.js / ui.js can import this module without a dependency cycle.

import { SK_READPLAN, online, escHtml, toast, logError } from './utils.js?v=4.58.4';
import {
  RP_PLAN_ID, rpEmptyStore, rpNormalizeStore, rpStoreHasData, rpMerge,
  rpSetChecked, rpRestore, rpProgress, rpBookmark, rpGaps
} from './readingplan-core.js?v=4.58.4';
import { rpBuildStoryFlow } from './readingplan-data.js?v=4.58.4';

// ── Sync trigger (wired by app.js so this module never imports sync.js) ─────
var _rpSyncFn = null;
var _rpSyncTimer = null;
/** @param {Function} fn - Called (debounced 3s) after a local change; should push to the Gist. */
function rpWireSync(fn) { _rpSyncFn = fn; }
function _rpQueueSync() {
  if (!online || !_rpSyncFn) return;
  if (_rpSyncTimer) clearTimeout(_rpSyncTimer);
  _rpSyncTimer = setTimeout(function() { _rpSyncTimer = null; _rpSyncFn(); }, 3000);
}

// ── Outline (built once; static, never stored) ──────────────────────────────
var _plan = null;
function _getPlan() { return _plan || (_plan = rpBuildStoryFlow()); }

// ── Store I/O ───────────────────────────────────────────────
/**
 * Loads the store. If the stored JSON is unparseable, the raw string is copied to
 * SK_READPLAN+'_corrupt' before an empty store is returned, so a later save can't silently
 * destroy the only copy.
 * @returns {{v:number,plans:Object}}
 */
function rpLoad() {
  var raw = null;
  try { raw = localStorage.getItem(SK_READPLAN); } catch (e) { return rpEmptyStore(); }
  if (!raw) return rpEmptyStore();
  try { return rpNormalizeStore(JSON.parse(raw)); }
  catch (e) {
    logError('Reading Plan Load (parse)', e);
    try { localStorage.setItem(SK_READPLAN + '_corrupt', raw); } catch (e2) { /* nothing more we can do */ }
    return rpEmptyStore();
  }
}
/** @returns {boolean} true if written */
function rpSave(store) {
  try { localStorage.setItem(SK_READPLAN, JSON.stringify(store)); return true; }
  catch (e) { logError('Reading Plan Save', e); toast('Could not save reading progress — storage may be full'); return false; }
}
function _planState(store) {
  if (!store.plans[RP_PLAN_ID]) store.plans[RP_PLAN_ID] = rpEmptyStore().plans[RP_PLAN_ID];
  return store.plans[RP_PLAN_ID];
}

/** Store snapshot for Gist push / JSON export. */
function rpExportStore() { return rpLoad(); }
/** @returns {boolean} true if there is anything worth writing to a backup. */
function rpHasData() { return rpStoreHasData(rpLoad()); }

/**
 * Merges a remote/imported store into the local store and saves it (Gist push/pull, JSON import).
 * @param {*} remote - Untrusted store object.
 * @returns {{v:number,plans:Object}} merged store
 */
function rpMergeRemote(remote) {
  var merged = rpMerge(rpLoad(), remote);
  rpSave(merged);
  _rpRefreshIfVisible();
  return merged;
}
/** Force-restore: replace the local store with the remote one (only called when the remote has the key). */
function rpReplaceFromRemote(remote) {
  var s = rpNormalizeStore(remote);
  rpSave(s);
  _rpRefreshIfVisible();
  return s;
}

// ── UI state (in memory only; group expand/collapse is never stored) ─────────
var _ui = { open: false, view: 'plan', parts: {}, groups: {}, about: null, bound: false };

function _fmtDate(ms) {
  var d = new Date(ms), now = new Date();
  var o = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('en-US', o);
}

/** Plain-language count line for gaps, e.g. "3 unchecked chapters before here". */
function _gapLine(gaps) {
  var word = gaps.hasEvents ? 'item' : 'chapter';
  return gaps.count + ' unchecked ' + word + (gaps.count === 1 ? '' : 's') + ' before here';
}
function _bar(pct, h) {
  return '<div class="rp-bar" style="height:' + (h || 6) + 'px"><div class="rp-bar-fill" style="width:' + pct + '%"></div></div>';
}

// ── Progress-tab card ───────────────────────────────────────
/** Renders the "Reading Plan: The Biblical Story" card into #stats-readplan (called from renderStats). */
function rpRenderCard() {
  var el = document.getElementById('stats-readplan');
  if (!el) return;
  var store = rpLoad(), st = _planState(store), plan = _getPlan();
  var hide = false;  // Chronicles always shown (v4.58.4); a stored hideChron option from older builds is ignored, not deleted
  var pr = rpProgress(plan, st, hide), bm = rpBookmark(plan, st, hide), gaps = rpGaps(plan, st, hide);
  var last = bm
    ? 'Last read: ' + escHtml(bm.item.label) + (bm.d ? ', ' + _fmtDate(bm.d) : '')
    : 'Start with Genesis 1';
  el.innerHTML =
    '<div class="seclabel">Reading Plan</div>' +
    '<div class="stat-card" style="margin-bottom:18px;padding-left:18px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">' +
        '<div style="font-family:\'EB Garamond\',serif;font-size:19px;color:var(--gold)">The Biblical Story</div>' +
        '<div style="font-family:\'EB Garamond\',serif;font-size:26px;color:var(--txt1)">' + pr.overall.pct + '<span style="font-size:15px;color:var(--txt3)">%</span></div>' +
      '</div>' +
      _bar(pr.overall.pct, 7) +
      '<div style="font-size:13px;color:var(--txt2);margin-top:9px">' + last + '</div>' +
      (gaps.count ? '<div class="rp-gapline" onclick="rpOpenPlan(\'gaps\')">' + _gapLine(gaps) + '</div>' : '') +
      '<button class="btn btn-sec btn-sm" style="margin-top:12px;width:100%" onclick="rpOpenPlan()">Open plan</button>' +
    '</div>';
}

// ── Plan overlay ────────────────────────────────────────────
function _openBookmarkSections(plan, st, hide) {
  _ui.parts = {}; _ui.groups = {};
  var bm = rpBookmark(plan, st, hide);
  if (bm) { _ui.parts[bm.item.partId] = true; _ui.groups[bm.item.groupId] = true; }
  else { _ui.parts.p1 = true; _ui.groups['g.gen-1-11'] = true; }
}

/**
 * Opens the full-screen plan.
 * @param {string} [view] - 'gaps' opens the unchecked-before-here list; anything else opens the plan.
 */
function rpOpenPlan(view) {
  var ov = document.getElementById('rp-overlay');
  if (!ov) return;
  var store = rpLoad(), st = _planState(store);
  _ui.view = view === 'gaps' ? 'gaps' : 'plan';
  _openBookmarkSections(_getPlan(), st, false);
  _ui.open = true;
  if (!_ui.bound) {
    var body = document.getElementById('rp-body');
    if (body) body.addEventListener('click', _rpBodyClick);
    _ui.bound = true;
  }
  ov.classList.add('on');
  _rpRender();
  var b = document.getElementById('rp-body'); if (b) b.scrollTop = 0;
}
/** Closes the plan and refreshes the Progress card behind it. */
function rpClosePlan() {
  var ov = document.getElementById('rp-overlay');
  if (ov) ov.classList.remove('on');
  _ui.open = false;
  _rpHideUndo();
  rpRenderCard();
}
function _rpRefreshIfVisible() {
  if (_ui.open) _rpRender();
  rpRenderCard();
}

/** Back from the gaps list to the full plan. */
function rpBackToPlan() { _ui.view = 'plan'; _rpRender(); var b = document.getElementById('rp-body'); if (b) b.scrollTop = 0; }

/** Jumps to the Last Read chip: opens its part and group, scrolls to it. */
function rpJumpLast() {
  var store = rpLoad(), st = _planState(store), plan = _getPlan(), hide = false;
  var bm = rpBookmark(plan, st, hide);
  if (!bm) { toast('Nothing checked yet — start with Genesis 1'); return; }
  _ui.view = 'plan';
  _ui.parts[bm.item.partId] = true; _ui.groups[bm.item.groupId] = true;
  _rpRender();
  var node = document.querySelector('#rp-body [data-rp-id="' + bm.item.id + '"]');
  if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center' });
}

function _rpBodyClick(ev) {
  var t = ev.target;
  while (t && t !== ev.currentTarget && !(t.getAttribute && (t.getAttribute('data-rp-about') || t.getAttribute('data-rp-id') || t.getAttribute('data-rp-part') || t.getAttribute('data-rp-group') || t.getAttribute('data-rp-goto')))) t = t.parentNode;
  if (!t || t === ev.currentTarget || !t.getAttribute) return;
  var id = t.getAttribute('data-rp-id');
  if (id) { _rpToggleItem(id); return; }
  var part = t.getAttribute('data-rp-part');
  if (t.getAttribute('data-rp-about')) { _ui.about = !_rpAboutOpen(_ui._pc); _rpRender(); return; }
  if (part) { _ui.parts[part] = !_ui.parts[part]; _rpRender(); return; }
  var grp = t.getAttribute('data-rp-group');
  if (grp) { _ui.groups[grp] = !_ui.groups[grp]; _rpRender(); return; }
  var go = t.getAttribute('data-rp-goto');
  if (go) {
    var g = _getPlan().groups.filter(function(x) { return x.id === go; })[0];
    if (!g) return;
    _ui.view = 'plan'; _ui.parts[g.partId] = true; _ui.groups[g.id] = true;
    _rpRender();
    var node = document.querySelector('#rp-body [data-rp-group="' + go + '"]');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'start' });
  }
}

function _rpToggleItem(id) {
  var plan = _getPlan();
  if (plan.index[id] === undefined) return;
  var item = plan.items[plan.index[id]];
  var store = rpLoad(), st = _planState(store), now = Date.now();
  var rec = st.items[id], wasChecked = !!(rec && rec.r === 1);
  var prev = rpSetChecked(st, id, !wasChecked, now);
  if (!rpSave(store)) return;
  _rpQueueSync();
  _rpRender();
  rpRenderCard();
  if (wasChecked) {
    _rpShowUndo('Unchecked ' + item.label, function() {
      var s2 = rpLoad(), p2 = _planState(s2);
      rpRestore(p2, id, prev, Date.now());
      if (rpSave(s2)) _rpQueueSync();
      _rpRender();
      rpRenderCard();
    });
  }
}

// ── Undo toast (own element: the shared toast has no action button) ──────────
var _undoTimer = null;
function _rpHideUndo() {
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
  var el = document.getElementById('rp-undo');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}
function _rpShowUndo(msg, onUndo) {
  _rpHideUndo();
  var el = document.createElement('div');
  el.id = 'rp-undo';
  el.className = 'rp-undo';
  var span = document.createElement('span');
  span.textContent = msg;
  var btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-sm';
  btn.textContent = 'Undo';
  btn.onclick = function() { _rpHideUndo(); onUndo(); };
  el.appendChild(span);
  el.appendChild(btn);
  document.body.appendChild(el);
  _undoTimer = setTimeout(_rpHideUndo, 6000);
}

// ── Rendering ───────────────────────────────────────────────
function _chip(it, st, bmId) {
  var on = st.items[it.id] && st.items[it.id].r === 1;
  if (it.type === 'ev') {
    return '<div class="rp-ev' + (on ? ' on' : '') + (it.id === bmId ? ' bm' : '') + '" data-rp-id="' + it.id + '">' +
      '<div class="rp-box">' + (on ? '&#10003;' : '') + '</div>' +
      '<div class="rp-ev-txt"><div class="rp-ev-title">' + escHtml(it.label) + (it.id === bmId ? ' <span class="rp-badge">Last Read</span>' : '') + '</div>' +
      '<div class="rp-ev-pass">' + escHtml(it.passages) + '</div>' +
      (it.note ? '<div class="rp-ev-note">' + escHtml(it.note) + '</div>' : '') + '</div></div>';
  }
  return '<div class="rp-chip' + (on ? ' on' : '') + (it.id === bmId ? ' bm' : '') + '" data-rp-id="' + it.id + '" title="' + escHtml(it.label) + '">' + escHtml(it.short) + '</div>';
}
function _itemsHtml(items, st, bmId) {
  var out = [], lastSub = null, evMode = items.length && items[0].type === 'ev';
  items.forEach(function(it) {
    if (it.sub && it.sub !== lastSub) { out.push('<div class="rp-sub">' + escHtml(it.sub) + '</div>'); lastSub = it.sub; }
    out.push(_chip(it, st, bmId));
  });
  return '<div class="' + (evMode ? 'rp-evlist' : 'rp-chips') + '">' + out.join('') + '</div>';
}
function _chev(open) { return '<span class="rp-chev">' + (open ? '&#9662;' : '&#9656;') + '</span>'; }
function _tick(done) { return done ? '<span class="rp-tick">&#10003;</span>' : ''; }

function _rpAboutOpen(checked) { return _ui.about === null ? checked === 0 : !!_ui.about; }  // open by default until the first chapter is checked
function _rpAboutHtml(checked, about) {
  var open = _rpAboutOpen(checked);
  return '<div class="rp-about"><div class="rp-about-head" data-rp-about="1">' + _chev(open) +
    '<span class="rp-about-title">About this plan</span></div>' +
    (open ? '<div class="rp-about-body"><div class="rp-about-name">' + escHtml(about.title) + '</div>' +
      '<div class="rp-about-by">By ' + escHtml(about.by) + ' \u00b7 ' + escHtml(about.date) + '</div>' +
      about.intro.map(function(p) { return '<p>' + escHtml(p) + '</p>'; }).join('') +
      '<ul class="rp-about-list">' + about.list.map(function(p) { return '<li>' + escHtml(p) + '</li>'; }).join('') + '</ul>' +
      about.outro.map(function(p) { return '<p>' + escHtml(p) + '</p>'; }).join('') + '</div>' : '') +
    '</div>';
}

function _rpRender() {
  var body = document.getElementById('rp-body');
  if (!body) return;
  var plan = _getPlan(), store = rpLoad(), st = _planState(store);
  var hide = false;  // Chronicles always shown (v4.58.4); a stored hideChron option from older builds is ignored, not deleted
  var pr = rpProgress(plan, st, hide), bm = rpBookmark(plan, st, hide), bmId = bm ? bm.item.id : '';
  var keepTop = body.scrollTop;

  // header
  var pctEl = document.getElementById('rp-overall'); if (pctEl) pctEl.innerHTML = pr.overall.pct + '<span style="font-size:14px;color:var(--txt3)">%</span>';
  var barEl = document.getElementById('rp-overall-bar'); if (barEl) barEl.innerHTML = _bar(pr.overall.pct, 6);
  var subEl = document.getElementById('rp-overall-sub'); if (subEl) subEl.textContent = pr.overall.checked + ' of ' + pr.overall.total + (bm ? ' · Last read: ' + bm.item.label : '');

  var html = [];
  if (_ui.view === 'gaps') {
    var gaps = rpGaps(plan, st, hide);
    html.push('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><div style="font-size:14px;color:var(--txt2)">' +
      (gaps.count ? _gapLine(gaps) : 'Nothing unchecked before your Last Read.') + '</div>' +
      '<button class="btn btn-sec btn-sm" onclick="rpBackToPlan()">Back to plan</button></div>');
    gaps.groups.forEach(function(g) {
      html.push('<div class="rp-gap-group"><div class="rp-gap-head"><span>' + escHtml(g.group.name) + '</span>' +
        '<span class="rp-link" data-rp-goto="' + g.group.id + '">Jump to group</span></div>' +
        _itemsHtml(g.items, st, bmId) + '</div>');
    });
  } else {
    _ui._pc = pr.overall.checked;
    if (plan.about) html.push(_rpAboutHtml(pr.overall.checked, plan.about));
    plan.parts.forEach(function(part) {
      var pp = pr.parts[part.id], popen = !!_ui.parts[part.id];
      html.push('<div class="rp-part"><div class="rp-part-head" data-rp-part="' + part.id + '">' + _chev(popen) +
        '<span class="rp-part-name">' + escHtml(part.name) + '</span>' + _tick(pp.done) +
        '<span class="rp-count">' + pp.checked + '/' + pp.total + '</span></div>' + _bar(pp.pct, 3));
      if (popen) {
        part.groups.forEach(function(g) {
          if (hide && g.chron) return;
          var gp = pr.groups[g.id], gopen = !!_ui.groups[g.id];
          html.push('<div class="rp-group"><div class="rp-group-head" data-rp-group="' + g.id + '">' + _chev(gopen) +
            '<span class="rp-group-name">' + escHtml(g.name) + '</span>' + _tick(gp.done) +
            '<span class="rp-count">' + gp.checked + '/' + gp.total + '</span></div>' + _bar(gp.pct, 3));
          if (gopen) html.push(_itemsHtml(g.items, st, bmId));
          html.push('</div>');
        });
      }
      html.push('</div>');
    });
  }
  body.innerHTML = html.join('');
  body.scrollTop = keepTop;
}

export {
  rpWireSync, rpLoad, rpSave, rpExportStore, rpHasData, rpMergeRemote, rpReplaceFromRemote,
  rpRenderCard, rpOpenPlan, rpClosePlan, rpBackToPlan, rpJumpLast
};
