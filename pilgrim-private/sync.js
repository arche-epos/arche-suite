// sync.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 3
// Sections: 22 (Gist sync), plus gistFilename() from S27 (spec deviation)
// openVerseModal/closeVerseModal excluded per spec — those go to ui.js
// See pilgrim-es-modules-plan-v1.md for full module map

import {
  studies, setStudies,
  cur, setCur,
  online,
  SK, SK_STREAK, SK_TAGS, SK_TAGS_DEL,
  WORKER_URL, ACTIVE_USER,
  sett, TAGS, setTags,
  toast, toastSuccess,
  migrateStudy, todayStr
} from './utils.js';

import { persist } from './storage.js';

// ── Cross-module accessors (window.* during extraction phase) ───────────────
// Tags-module state and UI functions live in ui.js / tags section.
// These are replaced with direct imports when ui.js is finalized in Session 5.
function _DELETED_TAGS()         { return window.DELETED_TAGS || []; }
function _mergeDeletedTags(a,b)  { return window.mergeDeletedTags ? window.mergeDeletedTags(a,b) : a; }
function _applyTagTombstones(t,d){ return window.applyTagTombstones ? window.applyTagTombstones(t,d) : t; }
function _repairTagColor(t)      { if(window.repairTagColor) window.repairTagColor(t); }
function _persistTags()          { if(window.persistTags) window.persistTags(); }
function _persistDeletedTags()   { if(window.persistDeletedTags) window.persistDeletedTags(); }
/** @returns {Object|null} Field Notes Quill instance */
function _qFN()    { return window._qFN    || null; }
/** @returns {Object|null} Conclusions Quill instance */
function _qConcl() { return window._qConcl || null; }
/** @returns {Object|null} Outline Quill instance */
function _qOutline(){ return window._qOutline || null; }


// ── Tombstone map (in-memory, cleared on page reload) ───────────────────────
/** Study IDs deleted this session — prevents re-importing from Gist after delete. */
var _deletedStudyIds = {};

/**
 * Registers a study ID as deleted so Gist pull will not restore it.
 * Called by storage.deleteStudy() via wireCallbacks.
 * @param {string} id - Study ID to tombstone.
 */
function markDeleted(id) { _deletedStudyIds[id] = true; }


// ── S27 deviation: gistFilename lives here per spec ─────────────────────────
/**
 * Returns the Gist filename to sync to/from for the active user. Jesse keeps the
 * original filename so his existing Gist history is preserved untouched; every
 * other user gets their own file within the same Gist.
 */
function gistFilename() {
  return ACTIVE_USER === 'jesse' ? 'arche-pilgrim-studies.json' : 'arche-pilgrim-' + ACTIVE_USER + '.json';
}

var _gistPushing=false;
var _gistPulling=false;
var _lastPushTime=0;
var _rateLimitUntil=0;
var _deletedStudyIds={};
/**
 * Sets the Gist sync status dot and label to the active/connected state.
 */
function updateGistStatusDot(){
  var dot=document.getElementById('gist-status-dot');
  var txt=document.getElementById('gist-status-text');
  if(!dot||!txt)return;
  dot.style.background='var(--sagebright)';txt.textContent='Sync active';
}
/**
 * Merges local and remote study arrays using a union-by-ID strategy.
 * For duplicate IDs, the study with the more recent updatedAt timestamp wins.
 * @param {Array} local - Studies from localStorage.
 * @param {Array} remote - Studies from the Gist backup.
 * @returns {Array} Merged array of studies.
 */
function mergeStudies(local,remote){
  var merged={};
  local.forEach(function(s){merged[s.id]=s;}); // Seed map with all local studies
  remote.forEach(function(r){
    if(_deletedStudyIds[r.id])return; // Skip studies deleted this session (tombstone in memory)
    if(!merged[r.id]){merged[r.id]=r;}
    else{
      // Most-recent updatedAt wins; fall back to date if updatedAt missing; 0 if neither present
      var localTime=new Date(merged[r.id].updatedAt||merged[r.id].date||0).getTime();
      var remoteTime=new Date(r.updatedAt||r.date||0).getTime();
      if(remoteTime>localTime)merged[r.id]=r;
    }
  });
  return Object.values(merged).sort(function(a,b){return (b.updatedAt||b.date||'')>(a.updatedAt||a.date||'')?1:-1;});
}
/**
 * Updates the Gist sync status bar with a message and color.
 * @param {string} msg - Status message to display.
 * @param {string} color - CSS color value for the status indicator.
 */
function gistSetStatus(msg,color){
  var el=document.getElementById('gist-sync-status');
  if(el){el.textContent=msg;el.style.color=color||'var(--txt4)';}
}
/**
 * Tests connectivity to a given API service and updates the diagnostics panel.
 * @param {string} service - The service identifier to test (e.g. 'groq', 'esv', 'gist').
 */
async function testAPI(service){
  var resultEl=document.getElementById('test-result-'+service);
  if(!resultEl)return;
  resultEl.style.color='var(--txt3)';
  resultEl.textContent='Testing\u2026';
  try{
    if(service==='groq'){
      var r=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',max_tokens:5,messages:[{role:'user',content:'ping'}]})});
      if(r.ok){resultEl.style.color='var(--sagebright)';resultEl.textContent='\u2713 AI (Groq) is responding normally.';}
      else{resultEl.style.color='var(--crimsonbright)';resultEl.textContent='\u2717 AI error \u2014 HTTP '+r.status+'.';}
    } else if(service==='esv'){
      var r=await fetch(WORKER_URL+'/esv?q=John+1:1&include-headings=false&include-footnotes=false&include-verse-numbers=false');
      if(r.ok){resultEl.style.color='var(--sagebright)';resultEl.textContent='\u2713 ESV Bible API is responding normally.';}
      else{resultEl.style.color='var(--crimsonbright)';resultEl.textContent='\u2717 ESV error \u2014 HTTP '+r.status+'.';}
    } else if(service==='sync'){
      var r=await fetch(WORKER_URL+'/gist?cb='+Date.now());
      if(r.ok||r.status===404){resultEl.style.color='var(--sagebright)';resultEl.textContent='\u2713 Sync server is reachable.';}
      else{resultEl.style.color='var(--crimsonbright)';resultEl.textContent='\u2717 Sync error \u2014 HTTP '+r.status+'.';}
    }
  }catch(e){resultEl.style.color='var(--crimsonbright)';resultEl.textContent='\u2717 Could not reach server \u2014 check connection.';}
}
/**
 * Pushes the current studies, tags, and deleted-tag tombstones to the Gist backup.
 * Respects a rate limit and skips if a push is already in progress.
 * @param {boolean} silent - If true, suppresses the toast confirmation on success.
 */
async function syncToGist(silent){
  if(_gistPushing)return; // Prevent concurrent push
  if(silent&&Date.now()<_rateLimitUntil)return; // Suppressed after GitHub rate-limit response
  if(silent&&(Date.now()-_lastPushTime)<300000)return; // Silent pushes throttled to once per 5 min
  _gistPushing=true;
  _lastPushTime=Date.now();
  if(!silent)gistSetStatus('Pushing...','var(--txt3)');
  try{
    // Fetch-before-push: read the current Gist, merge, THEN write — prevents last-writer-wins data loss across devices
    var mergedStudies=studies;
    var mergedTags=TAGS;
    try{
      var metaRes=await fetch(WORKER_URL+'/gist?cb='+Date.now());
      if(metaRes.ok){
        var meta=await metaRes.json();
        var file=meta.files&&meta.files[gistFilename()];
        if(file&&file.raw_url){
          var rawRes=await fetch(WORKER_URL+'/gist-raw?url='+encodeURIComponent(file.raw_url));
          if(rawRes.ok){
            var remote=await rawRes.json();
            if(remote.studies&&Array.isArray(remote.studies)){
              mergedStudies=mergeStudies(studies,remote.studies);
            }
            // Tag merge: seed from remote, then local overwrites by id — local label and color always win on conflict
            if(Array.isArray(remote.tags)&&remote.tags.length){
              var tagMap={};
              remote.tags.forEach(function(t){tagMap[t.id]=t;});
              TAGS.forEach(function(t){tagMap[t.id]=t;});
              mergedTags=Object.values(tagMap);
            }
            // Apply tombstones — deleted tags are removed from merged set
            var mergedDeleted=_mergeDeletedTags(_DELETED_TAGS(),remote.deletedTags||[]);
            mergedTags=_applyTagTombstones(mergedTags,mergedDeleted);
            window.DELETED_TAGS=mergedDeleted;
            _persistDeletedTags();
          }
        }
      }
    }catch(e){/* remote fetch failed — push local only, better than nothing */}
    var streak=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
    var payload=JSON.stringify({studies:mergedStudies,tags:mergedTags,deletedTags:_DELETED_TAGS(),streak:streak},null,2);
    var body={description:'Arché · Pilgrim Studies',public:false,files:{}};body.files[gistFilename()]={content:payload};
    var res=await fetch(WORKER_URL+'/gist',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){var errBody='';try{errBody=await res.text();}catch(e){}throw new Error('Sync '+res.status+' — '+errBody.slice(0,120));}
    // Update local with merged result so all devices stay consistent
    setStudies(mergedStudies);
    setTags(mergedTags);
    persist();
    if(window.persistTags)_persistTags();
    if(!silent){gistSetStatus('Pushed — '+new Date().toLocaleTimeString(),'var(--sagebright)');toast('Pushed ✓');}
  }catch(e){
    // Detect GitHub rate limit from multiple possible error string formats across primary and secondary limits
    var isRateLimit=e.message&&(e.message.indexOf('rate limit')!==-1||e.message.indexOf('429')!==-1||e.message.indexOf('secondary rate')!==-1||e.message.indexOf('rate_limit')!==-1);
    if(isRateLimit){_rateLimitUntil=Date.now()+15*60*1000;} // Back off silent auto-push for 15 minutes
    var msg=isRateLimit?'GitHub rate limited — auto-push paused 15 min. Manual Push still works.':e.message;
    if(!silent){gistSetStatus('Push failed: '+msg,'var(--crimsonbright)');toast(msg);}
  }finally{_gistPushing=false;}
}
/**
 * Pulls data from the Gist backup and merges it with local studies and tags.
 * Uses union-merge for studies and tombstone-aware merge for tags.
 */
async function syncFromGist(){
  if(_gistPulling)return;
  _gistPulling=true;
  gistSetStatus('Pulling...','var(--txt3)');
  try{
    // Step 1 — get Gist metadata to obtain raw_url
    var res=await fetch(WORKER_URL+'/gist?cb='+Date.now());
    if(!res.ok)throw new Error('Sync '+res.status);
    var data=await res.json();
    var file=data.files&&data.files[gistFilename()];
    if(!file||!file.raw_url)throw new Error('No studies file found in Gist');
    // Step 2 — GitHub's Gist API truncates content >1MB in metadata; raw_url always returns the full file
    var rawRes=await fetch(WORKER_URL+'/gist-raw?url='+encodeURIComponent(file.raw_url));
    if(!rawRes.ok)throw new Error('Raw fetch '+rawRes.status);
    var remote=await rawRes.json();
    if(!remote.studies||!Array.isArray(remote.studies))throw new Error('Invalid Gist format');
    remote.studies.forEach(function(s){migrateStudy(s);});
    var before=studies.map(function(s){return {id:s.id,upd:s.updatedAt};}); // Snapshot before merge — reserved for future change-detection or diff display
    setStudies(mergeStudies(studies,remote.studies));
    persist();
    // Tag merge strategy: start from remote, then union in any local-only tags; tombstones applied last to remove deleted tags
    if(Array.isArray(remote.tags)&&remote.tags.length){
      var mergedTags=remote.tags.slice();
      TAGS.forEach(function(t){
        if(!mergedTags.find(function(r){return r.id===t.id;}))mergedTags.push(t);
      });
      var mergedDeleted=_mergeDeletedTags(_DELETED_TAGS(),remote.deletedTags||[]);
      setTags(_applyTagTombstones(mergedTags,mergedDeleted));
      TAGS.forEach(function(t){_repairTagColor(t);});
      window.DELETED_TAGS=mergedDeleted;
      _persistDeletedTags();
      if(window.persistTags)_persistTags();
      if(window.renderTagManager)window.renderTagManager();
      if(window.renderTagPicker)window.renderTagPicker();
    }
    // Merge streak — most recent lastDay wins; tie goes to higher count
    if(remote.streak&&remote.streak.lastDay){
      var localSk=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
      var remoteSk=remote.streak;
      var winner;
      if(!localSk.lastDay||remoteSk.lastDay>localSk.lastDay){winner=remoteSk;}
      else if(remoteSk.lastDay<localSk.lastDay){winner=localSk;}
      else{winner={lastDay:localSk.lastDay,streak:Math.max(localSk.streak||0,remoteSk.streak||0)};}
      localStorage.setItem(SK_STREAK,JSON.stringify(winner));
    }
    if(window.renderLib)window.renderLib();
    // If a study is currently open and was updated by the pull, refresh cur + Quill editors
    if(cur){
      var pulledCur=studies.find(function(s){return s.id===cur.id;});
      if(pulledCur&&pulledCur.updatedAt&&pulledCur.updatedAt>cur.updatedAt){
        setCur(pulledCur);
        if(_qFN()){if(cur.fieldNotes)_qFN().clipboard.dangerouslyPasteHTML(cur.fieldNotes);else _qFN().setText('');}
        if(_qConcl()){var _c=cur.deep&&cur.deep.conclusions?cur.deep.conclusions:'';if(_c)_qConcl().clipboard.dangerouslyPasteHTML(_c);else _qConcl().setText('');}
        if(_qOutline()){var _o=cur.deep&&cur.deep.outline?cur.deep.outline:'';if(_o)_qOutline().clipboard.dangerouslyPasteHTML(_o);else _qOutline().setText('');}
        if(window.renderRefs)window.renderRefs();
      }
    }
    // Count what actually changed
    var added=0,updated=0;
    studies.forEach(function(s){
      var was=before.find(function(b){return b.id===s.id;});
      if(!was)added++;
      else if(s.updatedAt&&was.upd&&s.updatedAt>was.upd)updated++;
    });
    var msg=added||updated?
      (added?added+' new':'')+( added&&updated?' + ':'')+( updated?updated+' updated':''):
      'Already up to date';
    gistSetStatus('Pulled — '+new Date().toLocaleTimeString(),'var(--sagebright)');
    toast('Sync complete — '+msg);
  }catch(e){
    gistSetStatus('Pull failed: '+e.message,'var(--crimsonbright)');
    toast('Sync failed: '+e.message);
  }finally{_gistPulling=false;}
}
/**
 * Shows a native confirm dialog before triggering a force pull from Gist.
 * Force pull replaces all local studies with the remote backup.
 */
/**
 * Opens the Joshua 1:8 verse modal triggered by the header tagline.
 */

function confirmForcePull(){if(confirm('Force Restore will replace ALL local studies with the backed-up version — any local-only changes will be lost. Continue?')){syncFromGistForce();}}
/**
 * Force-pulls the Gist backup and replaces all local studies without merging.
 * Updates the currently open study's Quill editors if it exists in the restored data.
 */
async function syncFromGistForce(){
  if(_gistPulling)return;
  _gistPulling=true;
  gistSetStatus('Force pulling...','var(--txt3)');
  try{
    var res=await fetch(WORKER_URL+'/gist?cb='+Date.now());
    if(!res.ok)throw new Error('Sync '+res.status);
    var data=await res.json();
    var file=data.files&&data.files[gistFilename()];
    if(!file||!file.raw_url)throw new Error('No studies file found in Gist');
    var rawRes=await fetch(WORKER_URL+'/gist-raw?url='+encodeURIComponent(file.raw_url));
    if(!rawRes.ok)throw new Error('Raw fetch '+rawRes.status);
    var remote=await rawRes.json();
    if(!remote.studies||!Array.isArray(remote.studies))throw new Error('Invalid Gist format');
    setStudies(remote.studies.map(function(s){migrateStudy(s);return s;}))
    persist();
    if(Array.isArray(remote.tags)&&remote.tags.length){setTags(remote.tags);if(window.persistTags)_persistTags();}
    if(cur){var fc=studies.find(function(s){return s.id===cur.id;});if(fc){setCur(fc);if(_qFN()){if(cur.fieldNotes)_qFN().clipboard.dangerouslyPasteHTML(cur.fieldNotes);else _qFN().setText('');}if(_qConcl()){var _c=cur.deep&&cur.deep.conclusions?cur.deep.conclusions:'';if(_c)_qConcl().clipboard.dangerouslyPasteHTML(_c);else _qConcl().setText('');}if(_qOutline()){var _o=cur.deep&&cur.deep.outline?cur.deep.outline:'';if(_o)_qOutline().clipboard.dangerouslyPasteHTML(_o);else _qOutline().setText('');}if(window.renderRefs)window.renderRefs();}}
    if(window.renderLib)window.renderLib();
    gistSetStatus('Force pulled — '+new Date().toLocaleTimeString(),'var(--sagebright)');
    toast('Force restore complete — local data replaced with backup');
  }catch(e){
    gistSetStatus('Force pull failed: '+e.message,'var(--crimsonbright)');
  }finally{_gistPulling=false;}
}

// ── Named exports ─────────────────────────────────────────────────────────
export {
  updateGistStatusDot, mergeStudies, gistSetStatus, testAPI,
  syncToGist, syncFromGist, confirmForcePull, syncFromGistForce,
  gistFilename, markDeleted
};
