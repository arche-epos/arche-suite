// readingplan.js — Pilgrim Private ES Module (v4.58.0)
// Reading Plans v1 (Story Flow): check chapters off, a "Last Read" bookmark, progress bars and percentages.
// Spec: claude/spec-reading-plans-v1.md (Rev 2). Pure logic lives in readingplan-core.js, the outline in
// readingplan-data.js; this module owns storage I/O, the Progress-tab card and the full-screen plan overlay.
//
// Storage: one per-user localStorage key, SK_READPLAN ('bsn_readplan_<userId>'), holding only progress
// ({ v:1, plans:{ storyflow:{ items, opts } } }). Included in Gist sync (sync.js), JSON backup (ui.js), the
// safety copy (utils.js) and removed by Clear All through the existing per-user suffix rule.
// Imports only utils.js + core + data so sync.js / ui.js can import this module without a dependency cycle.

import { SK_READPLAN, online, escHtml, toast, logError } from './utils.js?v=4.60.4';
import {
  RP_PLAN_ID, rpEmptyStore, rpNormalizeStore, rpStoreHasData, rpMerge,
  rpSetChecked, rpRestore, rpProgress, rpBookmark, rpGaps,
  rpItemPassages, rpContinuePos, rpGroupStartPos, rpStep
} from './readingplan-core.js?v=4.60.4';
import { rpBuildStoryFlow } from './readingplan-data.js?v=4.60.4';

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
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn btn-primary btn-sm" style="flex:1" onclick="rpContinue(true)">&#9654; Listen</button>' +
        '<button class="btn btn-sec btn-sm" style="flex:1" onclick="rpContinue(false)">Read</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="btn btn-sec btn-sm" style="flex:1" onclick="rpOpenStart()">Choose where to start</button>' +
        '<button class="btn btn-sec btn-sm" style="flex:1" onclick="rpOpenPlan()">Open plan</button>' +
      '</div>' +
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
  while (t && t !== ev.currentTarget && !(t.getAttribute && (t.getAttribute('data-rp-about') || t.getAttribute('data-rp-id') || t.getAttribute('data-rp-part') || t.getAttribute('data-rp-group') || t.getAttribute('data-rp-goto') || t.getAttribute('data-rp-play')))) t = t.parentNode;
  if (!t || t === ev.currentTarget || !t.getAttribute) return;
  var playGrp = t.getAttribute('data-rp-play');
  if (playGrp) { rpStartGroup(playGrp, true); return; }   // group ▶ (v4.60.0): listen from this group's first unchecked item
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
function _chip(it, st, bmId, defAuthor) {
  var on = st.items[it.id] && st.items[it.id].r === 1;
  if (it.type === 'ev') {
    return '<div class="rp-ev' + (on ? ' on' : '') + (it.id === bmId ? ' bm' : '') + '" data-rp-id="' + it.id + '">' +
      '<div class="rp-box">' + (on ? '&#10003;' : '') + '</div>' +
      '<div class="rp-ev-txt"><div class="rp-ev-title">' + escHtml(it.label) + (it.id === bmId ? ' <span class="rp-badge">Last Read</span>' : '') + '</div>' +
      '<div class="rp-ev-pass">' + escHtml(it.passages) + '</div>' +
      (it.note ? '<div class="rp-ev-note">' + escHtml(it.note) + '</div>' : '') + '</div></div>';
  }
  // Psalms carry their author (v4.59.0): shown in small text under the number, except where it is the
  // group's own default (every chip in "Songs of the people" would just say Anonymous).
  var au = it.author && it.author !== defAuthor ? it.author : '';
  return '<div class="rp-chip' + (it.author ? ' rp-ps' : '') + (on ? ' on' : '') + (it.id === bmId ? ' bm' : '') + '" data-rp-id="' + it.id + '" title="' + escHtml(it.label + (it.author ? ' · ' + it.author : '')) + '">' +
    escHtml(it.short) + (au ? '<span class="rp-au">' + escHtml(au) + '</span>' : '') + '</div>';
}
function _itemsHtml(items, st, bmId, grp) {
  var out = [], lastSub = null, evMode = items.length && items[0].type === 'ev', run = null;
  var defAuthor = grp && grp.authorDefault ? grp.authorDefault : '';
  function flush() { if (run) { out.push('<div class="rp-psrow">' + run.join('') + '</div>'); run = null; } }
  items.forEach(function(it) {
    if (it.sub && it.sub !== lastSub) { flush(); out.push('<div class="rp-sub">' + escHtml(it.sub) + '</div>'); lastSub = it.sub; }
    // Psalms among chapters sit in their own row so they read as a distinct run (v4.59.0). A group that is all
    // Psalms (the two clusters) needs no row: the group itself is the container.
    if (it.author && !(grp && grp.psalms)) { (run = run || []).push(_chip(it, st, bmId, defAuthor)); }
    else { flush(); out.push(_chip(it, st, bmId, defAuthor)); }
  });
  flush();
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
        _itemsHtml(g.items, st, bmId, g.group) + '</div>');
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
            '<span class="rp-count">' + gp.checked + '/' + gp.total + '</span>' +
            '<span class="rp-play" data-rp-play="' + g.id + '" title="Listen from this group" aria-label="Listen from ' + escHtml(g.name) + '">&#9654;</span></div>' + _bar(gp.pct, 3));
          if (gopen) html.push(_itemsHtml(g.items, st, bmId, g));
          html.push('</div>');
        });
      }
      html.push('</div>');
    });
  }
  body.innerHTML = html.join('');
  body.scrollTop = keepTop;
}

// ── Plan playback (v4.60.0): read or listen along the plan, in plan order ────────────────────────
// A "plan session" lives in memory only: { pos, passIdx }. Nothing new is stored; the only writes are the
// normal item checks through the existing store path. ui.js wires the Read-tab hooks (this module never imports ui.js).
var _rd = null;          // { navRead(), load(ref) -> Promise<boolean>, play(), stop() }
var _sess = null;        // active session, or null
var _stopAtEnd = false;  // "Stop at the end of this section" (in memory; off by default)
var _repeat = 'off';     // 'off' | 'passage' | 'item' | 'section' (v4.60.1; in memory, resets when the session ends)

function rpWireRead(fns) { _rd = fns; }
function rpSessionActive() { return !!_sess; }
/** The passage the session expects to be loaded now; ui.js compares it with a typed reference to tell a user change from a plan load. */
function rpSessionRef() {
  if (!_sess) return '';
  var it = _getPlan().items[_sess.pos];
  return it ? (rpItemPassages(it)[_sess.passIdx] || '') : '';
}
function rpEndSession() { if (!_sess) return; _sess = null; _repeat = 'off'; _renderBar(); }
/** Exit button: ends the session and stops audio. The passage stays on screen. */
function rpExitPlan() { var was = !!_sess; rpEndSession(); if (was && _rd && _rd.stop) _rd.stop(); }

function _groupName(it) {
  var g = _getPlan().groups.filter(function(x) { return x.id === it.groupId; })[0];
  return g ? g.name : '';
}

/** Checks an item if it is not already checked. @returns {{prev:Object|null}|null} null when it was already checked or the save failed */
function _autoCheck(item) {
  var store = rpLoad(), st = _planState(store), rec = st.items[item.id];
  if (rec && rec.r === 1) return null;
  var prev = rpSetChecked(st, item.id, true, Date.now());
  if (!rpSave(store)) return null;
  _rpQueueSync();
  if (_ui.open) _rpRender();
  rpRenderCard();
  return { prev: prev };
}
function _undoCheck(id, prev) {
  var s2 = rpLoad(), p2 = _planState(s2);
  rpRestore(p2, id, prev, Date.now());
  if (rpSave(s2)) _rpQueueSync();
  if (_ui.open) _rpRender();
  rpRenderCard();
  _renderBar();
}
function _checkWithUndo(item, msg) {
  var r = _autoCheck(item);
  if (r) _rpShowUndo(msg, function() { _undoCheck(item.id, r.prev); });
  return !!r;
}

/** Loads the session's current passage into the Read tab, and starts the voice when `listen` is true. */
async function _loadCurrent(listen) {
  if (!_sess || !_rd) return false;
  var pos = _sess.pos, idx = _sess.passIdx, ref = rpSessionRef();
  _renderBar();
  var ok = await _rd.load(ref);
  if (!_sess || _sess.pos !== pos || _sess.passIdx !== idx) return false;   // the reader moved on while this was loading
  if (!ok) { toast('Could not load ' + ref); return false; }
  if (listen) _rd.play();
  return true;
}

/** Starts a plan session at plan position `pos` and opens the Read tab. */
async function rpStartSession(pos, listen) {
  var plan = _getPlan();
  _rpCloseStart();
  if (!_rd) return false;
  if (pos < 0 || pos >= plan.items.length) { toast('Nothing left to read in this plan'); return false; }
  if (_ui.open) rpClosePlan();
  _sess = { pos: pos, passIdx: 0 };
  _rd.navRead();
  return _loadCurrent(!!listen);
}
/** Continue: the first unchecked item after Last Read. */
function rpContinue(listen) {
  var pos = rpContinuePos(_getPlan(), _planState(rpLoad()));
  if (pos < 0) { toast('Every item in this plan is checked'); return; }
  return rpStartSession(pos, listen);
}
/** Start at a group's first unchecked item (or its first item when the group is fully checked). */
function rpStartGroup(groupId, listen) {
  var pos = rpGroupStartPos(_getPlan(), _planState(rpLoad()), groupId);
  if (pos < 0) { toast('Could not find that section'); return; }
  return rpStartSession(pos, listen);
}

/** Previous / Next item buttons. Audio keeps playing if it was playing. */
function rpPlanMove(delta) {
  if (!_sess || !_rd) return;
  var np = _sess.pos + delta;
  if (np < 0 || np >= _getPlan().items.length) return;
  var wasPlaying = _rd.isPlaying ? _rd.isPlaying() : false;
  _sess.pos = np; _sess.passIdx = 0;
  if (_rd.stop) _rd.stop();
  _loadCurrent(wasPlaying);
}
/** Mark read button (reading). Checking never happens just by opening an item. */
function rpMarkRead() {
  if (!_sess) return;
  var it = _getPlan().items[_sess.pos];
  if (!it) return;
  if (_checkWithUndo(it, 'Marked ' + it.label + ' read')) _renderBar();
  else toast('Already marked read');
}
function rpSetStopAtEnd(on) { _stopAtEnd = !!on; _renderBar(); }
function rpSetRepeat(mode) { _repeat = (mode === 'passage' || mode === 'item' || mode === 'section') ? mode : 'off'; _renderBar(); }

/**
 * Called by ui.js readAutoAdvance() when a passage finishes speaking naturally (never on skip, pause or stop).
 * Moves through the item's passages, checks the finished item, and continues along the plan,
 * or stops at the end of a section when the toggle is on. @returns {Promise<boolean>} true when a session handled it
 */
async function rpOnPassageEnd() {
  if (!_sess) return false;
  var plan = _getPlan(), it = plan.items[_sess.pos];
  var s = rpStep(plan, _sess.pos, _sess.passIdx, _stopAtEnd, _repeat);
  if (s.check && it) _checkWithUndo(it, 'Read: ' + it.label);
  if (s.action === 'end') {
    if (_rd && _rd.stop) _rd.stop();
    _sess = null; _repeat = 'off'; _renderBar();
    toast('You have reached the end of the plan');
    return true;
  }
  _sess.pos = s.pos; _sess.passIdx = s.passIdx;
  if (s.action === 'stop') {
    if (_rd && _rd.stop) _rd.stop();
    await _loadCurrent(false);
    toast('End of section. Next up: ' + plan.items[s.pos].label);
    return true;
  }
  await _loadCurrent(true);
  return true;
}

// ── Plan bar (Read tab) ────────────────────────────────────
function _renderBar() {
  var el = document.getElementById('rp-playbar');
  if (!el) return;
  if (!_sess) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var plan = _getPlan(), it = plan.items[_sess.pos];
  if (!it) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var st = _planState(rpLoad()), n = rpItemPassages(it).length;
  var read = !!(st.items[it.id] && st.items[it.id].r === 1);
  el.style.display = 'block';
  el.innerHTML =
    '<div class="rp-pb-top"><span class="rp-pb-plan">The Biblical Story</span>' +
      '<span class="rp-pb-grp">' + escHtml(_groupName(it)) + '</span></div>' +
    '<div class="rp-pb-item">' + escHtml(it.label) + (n > 1 ? ' <span class="rp-pb-pass">Passage ' + (_sess.passIdx + 1) + ' of ' + n + '</span>' : '') + '</div>' +
    '<div class="rp-pb-btns">' +
      '<button class="btn btn-sec btn-sm" onclick="rpPlanMove(-1)" aria-label="Previous item">&#8249; Prev</button>' +
      '<button class="btn ' + (read ? 'btn-sec' : 'btn-primary') + ' btn-sm" onclick="rpMarkRead()"' + (read ? ' disabled' : '') + '>' + (read ? '&#10003; Read' : 'Mark read') + '</button>' +
      '<button class="btn btn-sec btn-sm" onclick="rpPlanMove(1)" aria-label="Next item">Next &#8250;</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="rpExitPlan()">Exit</button>' +
    '</div>' +
    '<label class="rp-pb-rep">Repeat <select onchange="rpSetRepeat(this.value)" aria-label="Repeat">' +
      [['off', 'Off'], ['passage', 'This passage'], ['item', 'This item'], ['section', 'This section']].map(function(o) {
        return '<option value="' + o[0] + '"' + (_repeat === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
    '<label class="rp-pb-stop"><input type="checkbox" ' + (_stopAtEnd ? 'checked ' : '') + 'onchange="rpSetStopAtEnd(this.checked)"> Stop at the end of this section</label>';
}

// ── Start sheet: Continue, or choose a section ───────────────
function _rpCloseStart() { var o = document.getElementById('rp-start-overlay'); if (o) o.classList.remove('on'); }
function rpCloseStart() { _rpCloseStart(); }

/** Opens the "where to start" sheet (Read tab and Progress card). */
function rpOpenStart() {
  var o = document.getElementById('rp-start-overlay'), body = document.getElementById('rp-start-body');
  if (!o || !body) return;
  var plan = _getPlan(), st = _planState(rpLoad());
  var cp = rpContinuePos(plan, st), cit = cp >= 0 ? plan.items[cp] : null;
  var pr = rpProgress(plan, st, false);
  var opts = plan.parts.map(function(part) {
    return '<optgroup label="' + escHtml(part.name) + '">' + part.groups.map(function(g) {
      var gp = pr.groups[g.id];
      return '<option value="' + g.id + '"' + (cit && cit.groupId === g.id ? ' selected' : '') + '>' + escHtml(g.name) + ' (' + gp.checked + '/' + gp.total + ')</option>';
    }).join('') + '</optgroup>';
  }).join('');
  body.innerHTML =
    '<div class="rp-st-h">Continue</div>' +
    (cit
      ? '<div class="rp-st-sub">Next unchecked: <b>' + escHtml(cit.label) + '</b></div>' +
        '<div style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" style="flex:1" onclick="rpContinue(true)">&#9654; Listen</button>' +
        '<button class="btn btn-sec btn-sm" style="flex:1" onclick="rpContinue(false)">Read</button></div>'
      : '<div class="rp-st-sub">Every item in this plan is checked.</div>') +
    '<div class="rp-st-h" style="margin-top:18px">Or choose a section</div>' +
    '<div class="rp-st-sub">Starts at the first unchecked item in that section.</div>' +
    '<select id="rp-start-group" class="rp-st-sel">' + opts + '</select>' +
    '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-primary btn-sm" style="flex:1" onclick="rpStartGroup(document.getElementById(\'rp-start-group\').value,true)">&#9654; Listen</button>' +
    '<button class="btn btn-sec btn-sm" style="flex:1" onclick="rpStartGroup(document.getElementById(\'rp-start-group\').value,false)">Read</button></div>' +
    '<div style="margin-top:14px;text-align:right"><button class="btn btn-ghost btn-sm" onclick="rpCloseStart()">Cancel</button></div>';
  o.classList.add('on');
}

export {
  rpWireSync, rpLoad, rpSave, rpExportStore, rpHasData, rpMergeRemote, rpReplaceFromRemote,
  rpRenderCard, rpOpenPlan, rpClosePlan, rpBackToPlan, rpJumpLast,
  rpWireRead, rpSessionActive, rpSessionRef, rpEndSession, rpExitPlan, rpStartSession, rpContinue, rpStartGroup,
  rpPlanMove, rpMarkRead, rpSetStopAtEnd, rpSetRepeat, rpOnPassageEnd, rpOpenStart, rpCloseStart
};
