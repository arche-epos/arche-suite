// ui.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 5
// Sections: 05, 06, 09, 10, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27-partial, 28-partial
// See pilgrim-es-modules-plan-v1.md for full module map

import {
  // Section 01 — constants
  WORKER_URL, APP_SHARE_URL, DISCORD_WEBHOOK_URL, BOLLS_TRANS, BOLLS_BOOKS, parseRef,
  SK, SK_SETT, SK_TAGS, SK_TAGS_DEL, SK_OB, SK_TAB_HINTS,
  SK_DIAG, SK_STREAK, SK_TTS_SETT, SK_WORDS, SK_UPDATE_SKIP,
  SK_TOUR_STUDY_SEEN, SK_TOUR_SETTINGS_SEEN,
  // Section 02 — state
  studies, cur, sett, online, TAGS, ACTIVE_USER,
  studyScope, activeRefIdx, _pendingDeleteId, _pendingDeleteRefIdx, _renameResId,
  // Section 02 — setters
  setStudies, setCur, setActiveRefIdx, setStudyScope,
  setPendingDeleteId, setPendingDeleteRefIdx, setTags,
  // Section 03 — utilities
  toast, toastSuccess, closeOverlay, escHtml, mdToHtml, htmlToText,
  fmtDate, todayStr, pdfSafe, setAppHeight, updateOffline, bookOrder,
  mfBlob, prevDay,
  // Section 07 — data model
  makeRef, migrateStudy, activeRef, TEMPLATES, TAG_PALETTE, DEFAULT_TAGS,
  TOOL_LABELS, TOOL_DESCS,
  // Section 27 — namespace helpers (defined in utils.js)
  migrateLegacyKey, activateUser,
  // Section 29 — changelog
  CHANGELOG
} from './utils.js';

import {
  wireCallbacks, loadStudies, persist, openStudy, saveStudy, autoSave,
  deleteStudy, showDeleteModal, showDeleteById, duplicateStudy, syncFromInputs
} from './storage.js';

import {
  ttsStop, ttsPlay, ttsToggleAI, ttsToggleField, ttsToggleScr,
  loadTTSSett, initTTSVoices, ttsRestart, setTTSVoice,
  setTTSRate, adjustTTSRate, updateTTSRateUI, ttsTestVoice, saveTTSSett, ttsPause
} from './tts.js';

import {
  syncToGist, syncFromGist, syncFromGistForce, confirmForcePull,
  gistSetStatus, markDeleted, gistFilename, updateGistStatusDot
} from './sync.js';

import {
  fetchScr, getESV, getApiBible, getBollsBible, getBibleAPI, renderScrText,
  copyScrip, openPasteModal, confirmPaste, renderTransSpectrum, openTransDetail,
  populateDeep, toggleFnotes, toggleDeepScripture, toggleOutline,
  openResourcesModal, closeResPopout, showResScripture, showResMethod,
  toggleResSection, setScope, getBookFromRef, updateToolDots, buildPrompt, runTool,
  snapshotIntent, runSnapshot, showAIPanel, renderAITabs,
  switchAITab, renderAIPanelContent, closeAIPanel,
  updateExpandBtn, expandCurrentTool, copyAIResult, shareAIResult,
  switchLibTab, renderWordList, wlView, wlRemove, renderStudyWords, swView, swRemove, libTab,
  showWordDetail, showWordDetailCur, _showWordOverlay,
  openLexSaveSheet, toggleLexCb, saveLexWord, removeWordGlobal, removeWordStudy,
  openLexiconModal, openLexiconModalFor, closeLexiconModal, runLexiconLookup, renderLexiconEntry,
  resCapture, resAddDocPrompt, resHandleDoc, resAddDocResource,
  resHandleFile, resCompressImage, resAddResource, resRunOCR,
  resDeleteResource, resRetryOCR, resToggleText, resViewFull,
  resEditTitle, confirmRenameRes, renderResources, renderFieldTiles, resInsertText
} from './studyTools.js';

// ── Module-local state (only used within ui.js) ─────────────────────────────
// These were global vars in the monolith; narrowed to module scope here since
// no other module reads or writes them.
var activeTagFilter = null;    // Library tag filter state (setTagFilter / renderLib)
var _editingTagId   = null;    // Tag manager: which tag is being edited
var _pendingDeleteTagId = null; // Tag deletion confirm state
var obStep          = 0;       // Onboarding step index
var _diagResults    = [];      // Diagnostic run results (runDiagnostics / submitFeedback)
var hdrCollapsed    = false;   // Field Notes header collapsed state
var scrCollapsed    = false;   // Scripture panel collapsed state
var _pendingUpdateVersion = null; // checkForUpdate: version string for dismissUpdateBanner
// Changelog section toggle state (S26 — renderChangelog, clSectionToggle, clToggle)
var _clOpen = {};            // map of changelog entry index → bool (open/closed)
var _clSectionOpen = false;  // changelog section collapsed state
// DELETED_TAGS: tombstone list for deleted tags.
// sync.js accesses via window.DELETED_TAGS bridge in app.js (see defineProperty there).
// setDeletedTags() is called by the window.DELETED_TAGS setter in app.js when
// sync.js replaces the array after a merge — keeps the live binding current.
var DELETED_TAGS = [];
/** Replaces the DELETED_TAGS array (called by app.js window.DELETED_TAGS setter). */
function setDeletedTags(arr) { DELETED_TAGS = arr; }

// SECTION 05 — EDITOR SETUP
// Quill rich-text editor initialization for Field Notes,
// Conclusions, and Outline panels. Called once on app load.
// ════════════════════════════════════════════════════════
var _qFN=null,_qConcl=null,_qOutline=null;
var _qFNDirty=false,_qConclDirty=false,_qOutlineDirty=false; // Dirty flags: true when user has edited since last populate/sync
var _qlToolbar=[
  ['bold','italic','underline','strike'],
  [{'header':[1,2,3,false]}],
  [{'list':'ordered'},{'list':'bullet'}],
  [{'indent':'-1'},{'indent':'+1'}],
  ['blockquote'],
  ['clean']
];
/**
 * Initializes all three Quill rich-text editors: Field Notes, Conclusions, and Outline.
 * No-ops if the Quill library has not loaded. Attaches a text-change listener on the
 * Field Notes editor to update the word count display on each keystroke.
 */
function initEditors(){
  if(typeof Quill==='undefined')return;
  _qFN=new Quill('#f-notes-editor',{theme:'snow',placeholder:'What stands out in this passage?\nQuestions that arise...\nKey words, phrases, patterns...\nPersonal reflections...',modules:{toolbar:_qlToolbar}});
  _qFN.on('text-change',function(){updateWordCount();_qFNDirty=true;});
  _qConcl=new Quill('#d-conclusions-editor',{theme:'snow',placeholder:'This space belongs entirely to you.\n\nRecord your own theological conclusions, personal insights, and application.',modules:{toolbar:_qlToolbar}});
  _qConcl.on('text-change',function(){_qConclDirty=true;});
  _qOutline=new Quill('#d-outline-editor',{theme:'snow',placeholder:'Write out the structural outline of this passage or book.\n\ne.g.\nI. Main Point (v.1-4)\n   A. Sub-point\nII. Main Point (v.5-8)',modules:{toolbar:_qlToolbar}});
  _qOutline.on('text-change',function(){_qOutlineDirty=true;});
}



// ════════════════════════════════════════════════════════

// SECTION 06 — NAVIGATION
// Tab and panel navigation. navTo() is the single entry point for moving
// between Library, Field Notes, and Study Tools. Handles new study flow.
// ════════════════════════════════════════════════════════

/**
 * Navigates to a top-level app screen by id.
 * Cancels active TTS, syncs the current study, swaps .on classes on screens and
 * nav buttons, then calls the render function appropriate for the target screen.
 * @param {string} id - Screen id: 'library' | 'deep' | 'field' | 'stats' | 'settings'.
 */
function navTo(id){
  dismissTabHints();
  // Cancel any active TTS before navigating — avoids audio continuing on new screen
  if(window.speechSynthesis)window.speechSynthesis.cancel();
  if(window.setTtsActive)window.setTtsActive(false);if(window.setTtsPaused)window.setTtsPaused(false);
  if(cur)syncFromInputs(); // Flush any unsaved form state before leaving the current screen
  document.querySelectorAll('.scr').forEach(function(s){s.classList.remove('on');});
  document.querySelectorAll('.navbtn').forEach(function(b){b.classList.remove('on');});
  document.getElementById('scr-'+id).classList.add('on');
  document.getElementById('nav-'+id).classList.add('on');
  var fabBtn=document.querySelector('.fab');if(fabBtn)fabBtn.style.display=(id==='library')?'':'none';
  if(id==='library')renderLib();
  if(id==='deep'){
    // Collapse the field notes flyout when entering Study Tools
    if(window.setFnotesOpen)window.setFnotesOpen(false);var fb=document.getElementById('fnotes-body');if(fb)fb.classList.remove('open');var fc=document.getElementById('fnotes-chev');if(fc)fc.style.transform=''; // Reset chevron to point-down (closed) state
    populateDeep();}
  if(id==='field'&&cur)populateField();
  if(id==='stats')renderStats();
  if(id==='settings'){renderTagManager();renderChangelog();renderTransSpectrum();if(!localStorage.getItem(SK_TOUR_SETTINGS_SEEN))setTimeout(function(){startTour('settings');},300);}
}
/**
 * Saves the current study and navigates to the Library screen.
 */
function saveAndGoLib(){saveStudy();navTo('library');}
/**
 * Navigates to the Field Notes screen.
 */
function goField(){navTo('field');}

/**
 * Opens the template selection overlay after a 50ms delay.
 * The short delay allows any active overlay to finish closing before the new one opens.
 */
function newStudy(){setTimeout(function(){document.getElementById('tpl-overlay').classList.add('on');},50);}
/**
 * Creates a new study from the given template key and navigates to Field Notes.
 * Resets Outline and Conclusions editors to empty. Tracks the new study as opened.
 * @param {string} tplKey - Template key: 'blank' | 'sermon' | 'devotion' | 'smallgroup'.
 */
function createFromTemplate(tplKey){
  closeOverlay('tpl-overlay');
  var tpl=TEMPLATES[tplKey]||TEMPLATES.blank;
  setCur({id:'bsn_'+Date.now(),date:todayStr(),title:tpl.title||'',series:'',teacher:'',fieldNotes:tpl.fieldNotes||'',tags:(tpl.tags||[]).slice(),resources:[],refs:[makeRef()],deep:{conclusions:'',outline:''}});
  setActiveRefIdx(0);setStudyScope('passage');
  // Reset Quill editors to empty — template content lives in fieldNotes, not the rich editors
  if(_qOutline)_qOutline.setText('');
  if(_qConcl)_qConcl.setText('');
  trackOpen(cur);
  populateField();navTo('field');
}


// ════════════════════════════════════════════════════════

// SECTION 09 — LIBRARY
// Study list rendering, sorting, and filtering. renderLib() rebuilds the card list.
// Supports a primary sort (date, ref, teacher, series, modified) and a secondary
// sub-filter dropdown that auto-populates from real study data for ref/teacher/series modes.
// Entry point for opening, duplicating, and deleting studies from the list.
// ════════════════════════════════════════════════════════

/**
 * Rebuilds the Library screen: secondary sub-filter bar, tag filter bar, study cards, and empty states.
 * Reloads studies from localStorage, applies search query, active tag filter, and active sub-filter,
 * then sorts by the current primary sort option (date, ref, teacher, series, or modified).
 * Sub-filter bar appears for ref/teacher/series sorts and auto-populates unique values from study data.
 * Series field included in search matching and shown on cards when present.
 * In 'words' tab mode, delegates entirely to renderWordList().
 */
function renderLib(){
  if(libTab==='words'){renderWordList();return;}
  loadStudies();
  var q=(document.getElementById('lib-search').value||'').toLowerCase();
  var sortBy=(document.getElementById('lib-sort')&&document.getElementById('lib-sort').value)||'date';

  // ── Secondary filter bar ──────────────────────────────────────────────────────────────────────────
  // Visible for ref/teacher/series sorts; hidden for date/modified
  var subBar=document.getElementById('lib-subfilter-bar');
  var subEl=document.getElementById('lib-sub-filter');
  var subLabel=document.getElementById('lib-sub-label');
  var hasSub=(sortBy==='ref'||sortBy==='teacher'||sortBy==='series');
  if(subBar)subBar.style.display=hasSub?'flex':'none';
  var activeSub='';
  if(hasSub&&subEl){
    // Collect unique non-empty values for the active dimension across all studies
    var subVals=[];
    studies.forEach(function(s){
      var v='';
      if(sortBy==='ref'){var r0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';var bm=r0.match(/^(.*?)\s+\d/);v=bm?bm[1].trim():r0;}
      else if(sortBy==='teacher'){v=s.teacher||'';}
      else if(sortBy==='series'){v=s.series||'';}
      if(v&&subVals.indexOf(v)<0)subVals.push(v);
    });
    // Bible books in canonical order; others alphabetically
    if(sortBy==='ref'){subVals.sort(function(a,b){return bookOrder(a)-bookOrder(b);});}
    else{subVals.sort(function(a,b){return a.localeCompare(b);});}
    // Rebuild options, restoring selection if still valid
    var prevVal=subEl.value;
    subEl.innerHTML='<option value="">All</option>'+subVals.map(function(v){return '<option value="'+escHtml(v)+'">'+escHtml(v)+'</option>';}).join('');
    if(prevVal&&subVals.indexOf(prevVal)>=0)subEl.value=prevVal;
    activeSub=subEl.value;
    var labels={ref:'Book:',teacher:'Teacher:',series:'Series:'};
    if(subLabel)subLabel.textContent=labels[sortBy]||'Filter:';
  }

  // Build tag filter bar only from tags that appear on at least one study — avoids orphan filter buttons
  var usedTagIds={};studies.forEach(function(s){(s.tags||[]).forEach(function(t){usedTagIds[t]=true;});});
  var filterBar=document.getElementById('tag-filter-bar');
  if(filterBar){
    var usedTags=TAGS.filter(function(t){return usedTagIds[t.id];});
    if(usedTags.length){
      filterBar.innerHTML='<button class="tag-filter-btn'+(activeTagFilter===null?' on':'')+'" onclick="setTagFilter(null)">All</button>'+
        usedTags.map(function(t){return '<button class="tag-filter-btn'+(activeTagFilter===t.id?' on':'')+'" onclick="setTagFilter(\''+t.id+'\')" style="'+(activeTagFilter===t.id?'border-color:'+t.color+';color:'+t.color:'')+'"><span class="tag-dot" style="background:'+t.color+'"></span>'+t.label+'</button>';}).join('');
    } else {filterBar.innerHTML='';}
  }

  var el=document.getElementById('lib-list');
  var f=studies.filter(function(s){
    var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';
    // Search includes series field
    var matchQ=!q||(s.title||'').toLowerCase().includes(q)||ref0.toLowerCase().includes(q)||(s.teacher||'').toLowerCase().includes(q)||(s.series||'').toLowerCase().includes(q);
    var matchTag=activeTagFilter===null||((s.tags||[]).indexOf(activeTagFilter)>=0);
    // Secondary filter: exact match on selected sub-value
    var matchSub=true;
    if(hasSub&&activeSub){
      if(sortBy==='ref'){var r0b=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';var bm=r0b.match(/^(.*?)\s+\d/);matchSub=(bm?bm[1].trim():r0b)===activeSub;}
      else if(sortBy==='teacher'){matchSub=(s.teacher||'')===activeSub;}
      else if(sortBy==='series'){matchSub=(s.series||'')===activeSub;}
    }
    return matchQ&&matchTag&&matchSub;
  });
  f=f.slice().sort(function(a,b){
    var ra0=(a.refs&&a.refs[0]&&a.refs[0].reference)||a.reference||'';
    var rb0=(b.refs&&b.refs[0]&&b.refs[0].reference)||b.reference||'';
    // Canonical Bible order via bookOrder(); string tiebreak for multiple passages in the same book
    if(sortBy==='ref'){var ra=bookOrder(ra0),rb=bookOrder(rb0);return ra-rb||(ra0>rb0?1:-1);}
    if(sortBy==='teacher'){return (a.teacher||'').localeCompare(b.teacher||'');}
    if(sortBy==='series'){return (a.series||'').localeCompare(b.series||'')||(a.date||'').localeCompare(b.date||'');}
    if(sortBy==='modified'){return (b.updatedAt||b.date||'')>(a.updatedAt||a.date||'')?1:-1;}
    return (b.date||'')>(a.date||'')?1:-1;
  });
  if(!f.length){
    if(!q&&activeTagFilter===null&&!activeSub&&studies.length===0){
      el.innerHTML='<div class="empty" style="grid-column:1/-1;padding:60px 24px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><h3 style="font-size:22px;margin-bottom:6px">Start Your First Study</h3><p style="margin-bottom:20px">Capture notes, look up words, and use AI tools — all in one place.</p><button class="btn btn-primary" onclick="newStudy()" style="margin:0 auto;display:block;padding:11px 28px;font-size:15px">+ New Study</button></div>';
    } else {
      el.innerHTML='<div class="empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><h3>No results</h3><p>Try different keywords or tags</p></div>';
    }
    return;
  }
  var newCard='<div class="studycard-new" onclick="newStudy()"><div class="studycard-new-icon">+</div><div class="studycard-new-label">New Study</div></div>';
  el.innerHTML=newCard+f.map(function(s){
    var tagChips=(s.tags||[]).map(function(tid){var t=tagById(tid);if(!t)return '';return '<span style="display:inline-flex;align-items:center;gap:3px;border-radius:50px;padding:2px 7px;font-size:10px;font-weight:600;background:'+(t.bg||(t.color?hexToRgba(t.color,.18):'transparent'))+';color:'+t.color+';border:1px solid '+t.color+'40"><span style="width:5px;height:5px;border-radius:50%;background:'+t.color+';flex-shrink:0;display:inline-block"></span>'+t.label+'</span>';}).join('');
    var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';
    var trans0=(s.refs&&s.refs[0]&&(s.refs[0].pastedTranslation||s.refs[0].translation))||(s.pastedTranslation||s.translation||'ESV');
    var extraRefs=(s.refs&&s.refs.length>1)?'<span class="ttag" style="margin-left:4px">+'+( s.refs.length-1)+'</span>':''; // e.g. "+2" badge for multi-passage studies
    return '<div class="studycard" onclick="openStudy(\''+s.id+'\')">'+
      '<div class="sc-date">'+fmtDate(s.date)+'</div>'+
      (s.series?'<div style="font-size:10px;color:var(--txt4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:1px">'+escHtml(s.series)+'</div>':'')+
      '<div class="sc-title">'+(s.title||'Untitled Study')+'</div>'+
      '<div class="sc-ref">'+(ref0||'No reference')+' <span class="ttag">'+trans0.toUpperCase()+'</span>'+extraRefs+'</div>'+
      (s.teacher?'<div class="sc-teacher">'+escHtml(s.teacher)+'</div>':'')+
      (tagChips?'<div class="sc-tags" style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">'+tagChips+'</div>':'')+
      '<div class="sc-card-actions">'+
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();shareStudyLinkById(\''+s.id+'\')" style="font-size:10px;padding:4px 8px;min-height:30px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();duplicateStudy(\''+s.id+'\')" style="font-size:10px;padding:4px 8px;min-height:30px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Duplicate</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showDeleteById(\''+s.id+'\')" style="font-size:10px;padding:4px 8px;min-height:30px;color:var(--crimsonbright);border-color:transparent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
/**
 * Sets the active tag filter and re-renders the Library.
 * Pass null to clear the filter and show all studies.
 * @param {string|null} id - Tag id to filter by, or null for "All".
 */
function setTagFilter(id){activeTagFilter=id;renderLib();}
/**
 * Called when the primary sort dropdown changes.
 * Resets the secondary sub-filter to "All" so switching sort modes starts fresh.
 */
function setLibSort(){var sub=document.getElementById('lib-sub-filter');if(sub)sub.value='';renderLib();}
var BIBLE_BOOKS=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
window.BIBLE_BOOKS=BIBLE_BOOKS;


// ════════════════════════════════════════════════════════

// SECTION 10 — FIELD NOTES PANEL
// Field Notes panel population, tag picker, header/scripture toggle.
// populateField() is called every time a study is opened or switched.
// ════════════════════════════════════════════════════════

/**
 * Populates all Field Notes panel inputs from the current study (cur).
 * Handles header/scripture collapse state, Quill editor content, tag picker,
 * scripture display, ref pills, and bar label. No-op if no study is open.
 */
function populateField(){
  if(!cur)return;
  if(!cur.tags)cur.tags=[];
  var ar=activeRef();
  // Treat as new if no field notes and no scripture — expand header and reset scope so nothing looks pre-collapsed
  var isNew=!cur.fieldNotes&&!(ar&&ar.scriptureText);
  if(isNew){hdrCollapsed=false;scrCollapsed=false;setStudyScope('passage');}
  var body=document.getElementById('hdrfields-body'),summary=document.getElementById('hdr-summary'),panel=document.getElementById('scrpanel'),chev=document.getElementById('hdr-chevron'),barchev=document.getElementById('bar-scrchev'),barlbl=document.getElementById('bar-scrchev-lbl');
  if(hdrCollapsed){if(body)body.style.display='none';if(summary)summary.classList.add('show');if(chev)chev.textContent='v';}
  else{if(body)body.style.display='';if(summary)summary.classList.remove('show');if(chev)chev.textContent='^';}
  if(scrCollapsed){if(panel)panel.classList.add('collapsed');if(barchev)barchev.textContent='v';if(barlbl)barlbl.textContent='SHOW';}
  else{if(panel)panel.classList.remove('collapsed');if(barchev)barchev.textContent='^';if(barlbl)barlbl.textContent='HIDE';}
  document.getElementById('f-date').value=cur.date||'';
  document.getElementById('f-teacher').value=cur.teacher||'';
  document.getElementById('f-series').value=cur.series||'';
  document.getElementById('f-ref').value=ar?ar.reference||'':'';
  document.getElementById('f-trans').value=ar?ar.translation||'esv':'esv';
  document.getElementById('f-title').value=cur.title||'';
  // dangerouslyPasteHTML preserves formatting (bold, lists, headings); setText('') would strip it
  if(_qFN){if(cur.fieldNotes)_qFN.clipboard.dangerouslyPasteHTML(cur.fieldNotes);else _qFN.setText('');_qFNDirty=false;}
  renderStudyWords();
  renderTagPicker();
  updateScrModeUI();
  renderFieldTiles();
  renderRefPills('f-ref-pills','field');
  updateBarRefLabel();
  if(ar&&ar.scriptureText){renderScrText(ar.scriptureText,ar.pastedTranslation||ar.translation);document.getElementById('scracts').style.display='flex';}
  else{document.getElementById('scrdisplay').innerHTML='<div class="empty" style="padding:14px 0"><p style="font-style:italic;font-size:13px">Enter a reference above to load the passage</p></div>';document.getElementById('scracts').style.display='none';}
}

/**
 * Renders tag chip buttons in the Field Notes tag picker.
 * Each chip reflects the selected state of the tag against cur.tags.
 */
function renderTagPicker(){
  var el=document.getElementById('f-tags-picker');if(!el||!cur)return;
  el.innerHTML=TAGS.map(function(t){
    var sel=(cur.tags||[]).indexOf(t.id)>=0;
    var bg=t.bg||hexToRgba(t.color,.18)||'rgba(150,150,150,.18)';
    return '<span class="tag-chip'+(sel?' selected':'')+'" onclick="toggleTag(\''+t.id+'\')" style="background:'+bg+';color:'+t.color+';border-color:'+(sel?t.color:t.color+'40')+'"><span class="tag-dot" style="background:'+t.color+'"></span>'+t.label+'</span>';
  }).join('');
}
/**
 * Toggles a tag on or off for the current study and re-renders the tag picker.
 * @param {string} id - The tag id to toggle in cur.tags.
 */
function toggleTag(id){
  if(!cur)return;if(!cur.tags)cur.tags=[];
  var i=cur.tags.indexOf(id);
  if(i>=0)cur.tags.splice(i,1);else cur.tags.push(id);
  renderTagPicker();
}

/**
 * Toggles the study header fields (date, teacher, title) between expanded and collapsed.
 * When collapsed, shows a summary pill row with date and reference. Updates chevron icons.
 */
function toggleHeader(){
  hdrCollapsed=!hdrCollapsed;
  var body=document.getElementById('hdrfields-body'),summary=document.getElementById('hdr-summary'),chev=document.getElementById('hdr-chevron');
  if(hdrCollapsed){body.style.display='none';summary.classList.add('show');var d=document.getElementById('f-date').value,r=document.getElementById('f-ref').value;document.getElementById('hdr-pill-date').textContent=d?fmtDate(d):'Today';document.getElementById('hdr-pill-ref').textContent=r||'No reference';if(chev)chev.textContent='v';document.getElementById('hdr-chevron-sum').textContent='v';}
  else{body.style.display='';summary.classList.remove('show');if(chev)chev.textContent='^';}
}
/**
 * Toggles the scripture panel between visible and collapsed states.
 * Updates the bar chevron icon and SHOW/HIDE label accordingly.
 */
function toggleScripture(){
  scrCollapsed=!scrCollapsed;
  var panel=document.getElementById('scrpanel'),chev=document.getElementById('bar-scrchev'),lbl=document.getElementById('bar-scrchev-lbl');
  if(scrCollapsed){panel.classList.add('collapsed');if(chev)chev.textContent='v';if(lbl)lbl.textContent='SHOW';}
  else{panel.classList.remove('collapsed');if(chev)chev.textContent='^';if(lbl)lbl.textContent='HIDE';}
}
/**
 * Updates the sticky bar reference label from the current f-ref input value.
 * Falls back to "Scripture" if the field is empty.
 */
function updateBarRefLabel(){var ref=document.getElementById('f-ref')?document.getElementById('f-ref').value:'';var el=document.getElementById('bar-ref-label');if(el)el.textContent=ref?ref:'Scripture';}


// ════════════════════════════════════════════════════════

// SECTION 17 — TAGS
// Tag CRUD, color management, swatch picker, and tombstone sync.
// Tags are stored in localStorage and merged on Gist pull.
// ════════════════════════════════════════════════════════

/**
 * Loads tags from localStorage into TAGS. Falls back to DEFAULT_TAGS if none saved.
 * Runs a color repair migration pass on every loaded tag; persists if any were repaired.
 */
function loadTags(){
  try{
    var saved=JSON.parse(localStorage.getItem(SK_TAGS));
    if(Array.isArray(saved)&&saved.length){setTags(saved);}
    else{setTags(DEFAULT_TAGS.slice());}
  }catch(e){setTags(DEFAULT_TAGS.slice());}
  // Migrate: repair any tag with missing, NaN, or non-hex color/bg value
  var dirty=false;
  TAGS.forEach(function(t){
    var prev=t.bg;
    repairTagColor(t);
    if(t.bg!==prev)dirty=true;
  });
  if(dirty)persistTags();
}
/** Writes the TAGS array to localStorage. */
function persistTags(){localStorage.setItem(SK_TAGS,JSON.stringify(TAGS));}
var DELETED_TAGS=[];
/** Loads the DELETED_TAGS tombstone list from localStorage. */
function loadDeletedTags(){try{DELETED_TAGS=JSON.parse(localStorage.getItem(SK_TAGS_DEL))||[];}catch(e){DELETED_TAGS=[];}}
/** Writes the DELETED_TAGS tombstone list to localStorage. */
function persistDeletedTags(){localStorage.setItem(SK_TAGS_DEL,JSON.stringify(DELETED_TAGS));}
/**
 * Merges two deleted-tags arrays by keeping the most recent deletedAt timestamp per ID.
 * @param {Array} local - Tombstones from the local device.
 * @param {Array} remote - Tombstones from the Gist remote.
 * @returns {Array} Merged tombstone array with one entry per tag ID.
 */
function mergeDeletedTags(local,remote){
  // Seed the map from local tombstones keyed by tag ID
  var map={};local.forEach(function(d){map[d.id]=d;});
  // Remote wins if it carries a later deletedAt for the same tag ID
  remote.forEach(function(d){if(!map[d.id]||d.deletedAt>map[d.id].deletedAt)map[d.id]=d;});
  return Object.values(map);
}
/**
 * Filters a tags array by removing any tag that appears in the deleted tombstone list.
 * @param {Array} tags - The full TAGS array to filter.
 * @param {Array} deleted - DELETED_TAGS tombstone array.
 * @returns {Array} Tags with tombstoned entries removed.
 */
function applyTagTombstones(tags,deleted){
  // Build a lookup set of tombstoned IDs for O(1) filter membership checks
  var delIds={};deleted.forEach(function(d){delIds[d.id]=true;});
  return tags.filter(function(t){return !delIds[t.id];});
}
/**
 * Looks up a tag object by its ID.
 * @param {string} id - The tag ID to find.
 * @returns {Object|null} The matching tag object, or null if not found.
 */
function tagById(id){return TAGS.find(function(t){return t.id===id;})||null;}

/**
 * Renders the tag manager list UI inside #tagmgr-list.
 * Displays an empty-state message when no tags exist.
 */
function renderTagManager(){
  var el=document.getElementById('tagmgr-list');if(!el)return;
  // Empty state: show prompt message if no tags exist
  if(!TAGS.length){el.innerHTML='<p style="font-size:13px;color:var(--txt4);font-style:italic">No tags. Add one below.</p>';return;}
  // Map each tag to a row: color swatch + label + Edit/Delete actions
  el.innerHTML=TAGS.map(function(t){
    return '<div class="tagmgr-row">'+
      '<span class="tagmgr-swatch" style="background:'+t.color+'"></span>'+
      '<span class="tagmgr-label">'+escHtml(t.label)+'</span>'+
      '<div class="tagmgr-actions">'+
        '<button class="tagmgr-btn" onclick="openEditTagModal(\''+t.id+'\')">Edit</button>'+
        '<button class="tagmgr-btn danger" onclick="deleteTag(\''+t.id+'\')">Delete</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

/**
 * Opens the tag creation modal, resetting all fields to defaults.
 */
function openNewTagModal(){
  _editingTagId=null;
  document.getElementById('tag-modal-title').textContent='New Tag';
  document.getElementById('tag-name-input').value='';
  renderColorSwatches(TAG_PALETTE[0]);
  document.getElementById('tag-overlay').classList.add('on');
  setTimeout(function(){document.getElementById('tag-name-input').focus();},200);
}
/**
 * Opens the tag edit modal pre-populated with the given tag's current values.
 * @param {string} id - The ID of the tag to edit.
 */
function openEditTagModal(id){
  var t=tagById(id);if(!t)return;
  _editingTagId=id;
  document.getElementById('tag-modal-title').textContent='Edit Tag';
  document.getElementById('tag-name-input').value=t.label;
  renderColorSwatches(t.color);
  document.getElementById('tag-overlay').classList.add('on');
  setTimeout(function(){document.getElementById('tag-name-input').focus();},200);
}
var _selectedSwatchColor=TAG_PALETTE[0];
/**
 * Renders the color swatch picker inside #color-swatches.
 * @param {string} selected - Hex color string of the currently selected swatch.
 */
function renderColorSwatches(selected){
  _selectedSwatchColor=selected||TAG_PALETTE[0];
  var el=document.getElementById('color-swatches');if(!el)return;
  el.innerHTML=TAG_PALETTE.map(function(c){
    return '<div class="color-swatch'+(c===selected?' on':'')+'" style="background:'+c+'" onclick="selectSwatch(this,\''+c+'\')"></div>';
  }).join('');
}
/**
 * Marks the clicked swatch as selected and updates _selectedSwatchColor.
 * @param {HTMLElement} el - The swatch element that was clicked.
 * @param {string} color - The hex color value of the clicked swatch.
 */
function selectSwatch(el,color){
  document.querySelectorAll('.color-swatch').forEach(function(s){s.classList.remove('on');});
  el.classList.add('on');
  _selectedSwatchColor=color;
}
/**
 * Returns the currently selected swatch color, falling back to the first palette entry.
 * @returns {string} Hex color string.
 */
function getSelectedSwatchColor(){
  return _selectedSwatchColor||TAG_PALETTE[0];
}
/**
 * Converts a 6-digit hex color and alpha value to an rgba() string.
 * @param {string} hex - Hex color string (e.g. '#3a86ff').
 * @param {number} a - Alpha value between 0 and 1.
 * @returns {string|null} rgba string, or null if the hex value is invalid.
 */
function hexToRgba(hex,a){
  if(!hex||typeof hex!=='string'||!/^#[0-9a-fA-F]{6}$/.test(hex))return null;
  // Extract R, G, B channels from successive 2-digit hex pairs
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
/**
 * Normalizes a tag's color and bg fields to valid hex + rgba format.
 * Handles legacy rgb() color values and falls back to the first palette color.
 * @param {Object} t - Tag object to repair in place.
 */
function repairTagColor(t){
  // Path 1: valid 6-digit hex — compute 18% alpha bg and return
  if(t.color&&/^#[0-9a-fA-F]{6}$/.test(t.color)){t.bg=hexToRgba(t.color,.18);return;}
  // Path 2: legacy rgb() string — extract channels and rebuild as rgba
  var m=t.color&&t.color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if(m){t.bg='rgba('+m[1]+','+m[2]+','+m[3]+',.18)';return;}
  // Path 3: unrecognized format — reset to first palette color
  t.color=TAG_PALETTE[0];t.bg=hexToRgba(TAG_PALETTE[0],.18);
}
/**
 * Saves the tag modal form — creates a new tag or updates the tag being edited.
 * Validates name input, persists to localStorage, and re-renders all tag UI.
 */
function saveTag(){
  var name=document.getElementById('tag-name-input').value.trim();
  if(!name){toast('Please enter a tag name');return;}
  var color=getSelectedSwatchColor();
  // Compute 18% alpha background from the selected swatch color
  var bg=hexToRgba(color,.18);
  if(_editingTagId){
    // Edit mode: mutate the existing tag object in place
    var t=tagById(_editingTagId);
    if(t){t.label=name;t.color=color;t.bg=bg;}
  } else {
    // Create mode: assign a timestamp-based ID and push a new tag
    var newId='tag_'+Date.now();
    TAGS.push({id:newId,label:name,color:color,bg:bg});
  }
  persistTags();
  closeOverlay('tag-overlay');
  renderTagManager();
  renderTagPicker();
  renderLib();
  toast(_editingTagId?'Tag updated':'Tag created');
}
/**
 * Opens the tag delete confirmation modal for the given tag ID.
 * @param {string} id - The ID of the tag to delete.
 */
function deleteTag(id){_pendingDeleteTagId=id;document.getElementById('deltag-overlay').classList.add('on');}
/**
 * Confirms tag deletion: removes from TAGS, pushes a tombstone to DELETED_TAGS,
 * strips the tag from all studies, persists all changes, and triggers a Gist sync.
 */
function confirmDeleteTag(){
  if(!_pendingDeleteTagId)return;
  var id=_pendingDeleteTagId;
  // Clear the pending ID immediately to prevent double-fire
  _pendingDeleteTagId=null;
  // Remove the tag from the live TAGS array
  setTags(TAGS.filter(function(t){return t.id!==id;}));
  // Push a tombstone so other devices know this deletion was intentional
  DELETED_TAGS.push({id:id,deletedAt:new Date().toISOString()});
  persistDeletedTags();
  // Strip this tag ID from every study's tags array
  studies.forEach(function(s){if(s.tags)s.tags=s.tags.filter(function(tid){return tid!==id;});});
  // Also strip from the currently open study if one is loaded
  if(cur&&cur.tags)cur.tags=cur.tags.filter(function(tid){return tid!==id;});
  persist();persistTags();
  closeOverlay('deltag-overlay');
  renderTagManager();renderTagPicker();renderLib();
  toast('Tag deleted');
  // 800ms debounce lets localStorage writes settle before the Gist push
  if(online){setTimeout(function(){syncToGist(true);},800);}
}

var _importPending=null;


// ════════════════════════════════════════════════════════

// SECTION 18 — EXPORT / PDF
// PDF generation, export modal, field/section selection, and download.
// Uses jsPDF to build multi-section study export documents.
// ════════════════════════════════════════════════════════
/**
 * Opens the export modal and populates the AI tools list based on the current study.
 * Only shows tool entries that have at least one passage or book result saved.
 */
function openExportModal(){
  if(!cur){toast('No study to export');return;}syncFromInputs(true);
  var allRefs=cur.refs&&cur.refs.length?cur.refs:[];
  var list=document.getElementById('exp-tools-list');list.innerHTML='';
  // Only render a tool row if at least one ref has a result saved for it
  ['lexical','grammar','historical','cultural','crossrefs'].forEach(function(k){
    var hp=allRefs.some(function(r){return !!(r.deep&&r.deep[k]);});
    var hb=allRefs.some(function(r){return !!(r.deep&&r.deep[k+'_book']);});
    if(!hp&&!hb)return;
    var div=document.createElement('div');
    div.style.cssText='background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:11px 12px;margin-bottom:8px';
    div.innerHTML='<div style="font-size:14px;color:var(--txt1);font-family:Crimson Pro,serif;font-weight:500;margin-bottom:5px">'+TOOL_LABELS[k]+'</div><div style="font-size:11px;color:var(--txt3);margin-bottom:8px">'+TOOL_DESCS[k]+'</div><div class="exp-scope-pills">'+(hp?'<div class="exp-pill on" id="exp-'+k+'-passage" onclick="expToggle(this)"><div class="exp-pill-dot"></div><span>This Passage</span></div>':'')+(hb?'<div class="exp-pill on" id="exp-'+k+'-book" onclick="expToggle(this)"><div class="exp-pill-dot"></div><span>Whole Book</span></div>':'')+'</div>';
    list.appendChild(div);
  });
  if(!list.children.length)list.innerHTML='<p style="font-size:13px;color:var(--txt3);font-style:italic;padding:8px 0">No AI tools have been run yet.</p>';
  document.getElementById('export-overlay').classList.add('on');
}
/**
 * Toggles the selected state of an export pill or row.
 * @param {HTMLElement} el - The pill or row element to toggle.
 */
function expToggle(el){el.classList.toggle('on');}
/**
 * Selects or deselects all export rows and tool pills in the export overlay.
 * @param {boolean} val - True to select all; false to deselect all.
 */
function expSelectAll(val){document.querySelectorAll('#export-overlay .exp-row, #export-overlay .exp-pill').forEach(function(el){if(val)el.classList.add('on');else el.classList.remove('on');});}
/**
 * Selects or deselects only the AI tool scope pills within the export overlay.
 * @param {boolean} val - True to select all tools; false to deselect all.
 */
function expSelectAllTools(val){document.querySelectorAll('#exp-tools-list .exp-pill').forEach(function(el){if(val)el.classList.add('on');else el.classList.remove('on');});}
/**
 * Returns whether a given export option element is currently toggled on.
 * @param {string} id - The element ID to check.
 * @returns {boolean} True if the element exists and has the 'on' class.
 */
function expIsOn(id){var el=document.getElementById(id);return el&&el.classList.contains('on');}
/**
 * Deletes the currently active AI tool result from the study and clears its panel UI.
 * Saves the study, closes the AI panel, and updates tool dot indicators.
 */
function deleteAIResult(){
  if(!aiActiveTab)return;
  var ar=activeRef();
  if(ar&&ar.deep&&ar.deep.hasOwnProperty(aiActiveTab)){delete ar.deep[aiActiveTab];}
  delete aiPanelResults[aiActiveTab];
  // Strip _book suffix so passage and book tabs both resolve to the same toolbar button
  var btn=document.getElementById('btn-'+aiActiveTab.replace('_book',''));
  if(btn){btn.classList.remove('ready');var dot=btn.querySelector('.rdot');if(dot)dot.remove();}
  saveStudy(true);
  closeAIPanel();
  updateToolDots();
  toast('AI result cleared');
}
/**
 * Reads the export modal selections and calls exportPDF with the resulting options object.
 * Closes the export overlay before generating the PDF.
 */
function runExport(){
  closeOverlay('export-overlay');
  // Build opts from current pill toggle states; each AI tool has passage + book sub-flags
  var opts={scripture:expIsOn('exp-scripture'),fieldNotes:expIsOn('exp-fieldnotes'),outline:expIsOn('exp-outline'),resources:expIsOn('exp-resources'),conclusions:expIsOn('exp-conclusions'),tools:{}};
  ['lexical','grammar','historical','cultural','crossrefs'].forEach(function(k){opts.tools[k]={passage:expIsOn('exp-'+k+'-passage'),book:expIsOn('exp-'+k+'-book')};});
  exportPDF(opts);
}


/**
 * Builds and downloads a multi-section jsPDF document for the current study.
 * Renders header, metadata, outline, field notes, resources, AI tool results,
 * conclusions, and per-page footers based on the opts selections.
 * @param {Object} opts - Export options: which sections and AI tools to include.
 */
async function exportPDF(opts){
  if(!cur){toast('No study to export');return;}syncFromInputs(true);
  var ar=activeRef();
  if(!opts)opts={scripture:true,fieldNotes:true,outline:true,resources:true,conclusions:true,tools:{lexical:{passage:true,book:true},grammar:{passage:true,book:true},historical:{passage:true,book:true},cultural:{passage:true,book:true},crossrefs:{passage:true,book:true}}};
  toast('Generating PDF...');
  try{
    var jsPDF=window.jspdf.jsPDF;
    var doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    var pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();
    var mgL=13,mgR=13,mgT=15,mgB=28,footH=22,cw=pw-mgL-mgR,y=mgT;
    // pt → mm line-height: sz × 0.3528 mm/pt × 1.55 leading multiplier
    var lh=function(sz){return sz*0.3528*1.55;};
    // Needs-page: adds a new page if remaining space < 'need' mm (default 10)
    var np=function(need){need=need||10;if(y+need>ph-mgB-footH){doc.addPage();y=mgT;}};
    // Force page-break: unconditional new page and y cursor reset
    var pb=function(){doc.addPage();y=mgT;};
    // Text renderer: word-wraps str into the content column with indentation and gap spacing
    var txt=function(str,sz,style,rgb,gap){
      if(!str)return;doc.setFontSize(sz);doc.setFont('helvetica',style||'normal');doc.setTextColor.apply(doc,rgb||[30,25,15]);
      var lhv=lh(sz);
      String(str).split('\n').forEach(function(para){
        var m=para.match(/^([ \t]*)/);
        var spaces=m?(m[1].replace(/\t/g,'    ').length):0;
        var indMm=Math.min(spaces,24)*1.5;
        var content=para.replace(/^[ \t]+/,'');
        if(!content){np(lhv+1);y+=lhv;return;}
        doc.splitTextToSize(content,cw-indMm).forEach(function(line){np(lhv+1);doc.text(line,mgL+indMm,y);y+=lhv;});
      });
      y+=(gap!==undefined?gap:2);
    };
    // HTML renderer: walks Quill output and dispatches h1-h3/blockquote/ul/ol/p to txt()
    var htmlTxt=function(html,defaultSz,defaultRgb){
      if(!html)return;
      var _div=document.createElement('div');_div.innerHTML=html;
      _div.childNodes.forEach(function(node){
        if(node.nodeType===3){var t=node.textContent.trim();if(t)txt(pdfSafe(t),defaultSz||10,'normal',defaultRgb||[30,25,15]);return;}
        if(!node.tagName)return;
        var tag=node.tagName.toLowerCase();
        if(tag==='h1'){txt(pdfSafe(node.textContent),16,'bold',defaultRgb||[30,25,15]);}
        else if(tag==='h2'){txt(pdfSafe(node.textContent),14,'bold',defaultRgb||[30,25,15]);}
        else if(tag==='h3'){txt(pdfSafe(node.textContent),12,'bold',defaultRgb||[30,25,15]);}
        else if(tag==='blockquote'){txt(pdfSafe(node.textContent),10,'italic',[50,40,25]);}
        else if(tag==='ul'){
          node.querySelectorAll('li').forEach(function(li){
            var depth=0;var m=(li.className||'').match(/ql-indent-(\d)/);if(m)depth=parseInt(m[1]);
            var pad='';for(var _i=0;_i<(depth+1)*2;_i++)pad+=' ';
            txt(pdfSafe(pad+'\u2022 '+li.textContent.trim()),defaultSz||10,'normal',defaultRgb||[30,25,15]);
          });
        }
        else if(tag==='ol'){
          var _n=0;
          node.querySelectorAll('li').forEach(function(li){
            _n++;var depth=0;var m=(li.className||'').match(/ql-indent-(\d)/);if(m)depth=parseInt(m[1]);
            var pad='';for(var _i=0;_i<depth*2;_i++)pad+=' ';
            txt(pdfSafe(pad+_n+'. '+li.textContent.trim()),defaultSz||10,'normal',defaultRgb||[30,25,15]);
          });
        }
        else if(tag==='p'){
          var t=node.textContent.trim();if(!t){y+=lh(defaultSz||10)*0.4;return;}
          var hasBold=!!node.querySelector('strong,b');
          var hasItalic=!!node.querySelector('em,i');
          var style=(hasBold&&hasItalic)?'bolditalic':hasBold?'bold':hasItalic?'italic':'normal';
          txt(pdfSafe(t),defaultSz||10,style,defaultRgb||[30,25,15]);
        }
        else{var t=node.textContent.trim();if(t)txt(pdfSafe(t),defaultSz||10,'normal',defaultRgb||[30,25,15]);}
      });
    };
    // AI sub-section rule: requires 35mm clearance, thin gold line, small uppercase label
    var softsection=function(title){np(35);y+=3;doc.setFillColor(140,105,30);doc.rect(mgL,y-1,cw,0.5,'F');y+=4;doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(90,65,20);doc.text(pdfSafe(title.toUpperCase()),mgL,y);y+=5;};
    // Major section rule: requires 22mm clearance, gold line, bold uppercase label
    var section=function(title){np(22);y+=4;doc.setFillColor(140,105,30);doc.rect(mgL,y-1,cw,0.5,'F');y+=5;doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(90,65,20);doc.text(pdfSafe(title.toUpperCase()),mgL,y);y+=6;};
    // ── HEADER ───────────────────────────────────────────────────────
    doc.setFillColor(245,240,225);doc.rect(0,0,pw,36,'F');doc.setFillColor(140,105,30);doc.rect(0,34,pw,0.6,'F');
    doc.setFontSize(18);doc.setFont('helvetica','bold');doc.setTextColor(120,85,15);
    if(cur.series){doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(140,105,30);doc.text(pdfSafe(cur.series.toUpperCase()),mgL,9);doc.setFontSize(18);doc.setFont('helvetica','bold');doc.setTextColor(120,85,15);}
    doc.text(doc.splitTextToSize(pdfSafe(cur.title||'Arche Pilgrim Study'),cw),mgL,14);y=44;
    var activeRefText=ar&&ar.reference?ar.reference:(cur.refs&&cur.refs[0]&&cur.refs[0].reference)||'';
    var trans0=ar?(ar.pastedTranslation||ar.translation||'ESV').toUpperCase():'ESV';
    var meta=[['Date',fmtDate(cur.date)],['Reference',activeRefText],['Translation',trans0],['Teacher',cur.teacher]].filter(function(m){return m[1];});
    meta.forEach(function(m){np(7);doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.setTextColor(60,45,20);doc.text(m[0]+':',mgL,y);doc.setFont('helvetica','normal');doc.setTextColor(30,25,15);doc.text(pdfSafe(String(m[1])),mgL+44,y);y+=6;});y+=6;
    // ── REFERENCE LIST ────────────────────────────────────────────────
    var allRefs=cur.refs&&cur.refs.length?cur.refs:[];
    if(allRefs.length){
      section('References in This Study');
      allRefs.forEach(function(r,i){
        np(lh(10)+2);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(45,35,18);
        doc.text(pdfSafe((i+1)+'.  '+(r.reference||'Untitled')),mgL+4,y);y+=lh(10)+1;
      });
      y+=4;
    }
    // ── OUTLINE (header block) ────────────────────────────────────────
    var outln=(_qOutline&&_qOutline.root.innerHTML)||( cur.deep&&cur.deep.outline)||'';
    if(opts.outline&&outln.replace(/<[^>]*>/g,'').trim()){section('Passage / Book Outline');htmlTxt(outln,10,[30,25,15]);}
    // ── FIELD NOTES ───────────────────────────────────────────────────
    if(opts.fieldNotes&&cur.fieldNotes&&cur.fieldNotes.replace(/<[^>]*>/g,'').trim()){section('Field Notes & Observations');htmlTxt(cur.fieldNotes,10,[30,25,15]);}
    // ── RESOURCES ─────────────────────────────────────────────────────
    if(opts.resources&&cur.resources&&cur.resources.length){var hasOcr=cur.resources.some(function(r){return r.ocrStatus==='done'&&r.ocrText;});if(hasOcr){section('Resources & Documents');cur.resources.forEach(function(r){if(r.ocrStatus!=='done'||!r.ocrText)return;np(14);doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(90,65,20);doc.text(pdfSafe(r.title+' - '+r.date),mgL,y);y+=6;txt(pdfSafe(r.ocrText),9,'normal',[35,28,18]);y+=2;});}}
    // ── PAGE BREAK — into reference groups ───────────────────────────
    pb();
    // ── REFERENCE GROUPS ─────────────────────────────────────────────
    allRefs.forEach(function(r,i){
      if(i>0)pb();
      // Ref heading
      np(14);doc.setFontSize(15);doc.setFont('helvetica','bold');doc.setTextColor(120,85,15);
      doc.text(pdfSafe(r.reference||'Passage'),mgL,y);y+=lh(15)+2;
      // Full verse text
      if(r.scriptureText){txt(pdfSafe(r.scriptureText.replace(/<[^>]+>/g,'').replace(/\n\n/g,'\n')),10,'italic',[45,35,20],1);}
      // Populated AI tools for this ref only
      ['lexical','grammar','historical','cultural','crossrefs'].forEach(function(k){
        var cp=r.deep&&r.deep[k];
        var cb=r.deep&&r.deep[k+'_book'];
        if(cp&&opts.tools[k]&&opts.tools[k].passage){softsection(TOOL_LABELS[k]+' \u2013 Passage');txt(pdfSafe(cp.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/^#+\s/gm,'')),9,'normal',[35,28,18]);}
        if(cb&&opts.tools[k]&&opts.tools[k].book){softsection(TOOL_LABELS[k]+' \u2013 Whole Book');txt(pdfSafe(cb.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/^#+\s/gm,'')),9,'normal',[35,28,18]);}
      });
    });
    // ── MY CONCLUSIONS ────────────────────────────────────────────────
    var concl=(_qConcl&&_qConcl.root.innerHTML)||(cur.deep&&cur.deep.conclusions)||'';
    if(opts.conclusions&&concl.replace(/<[^>]*>/g,'').trim()){pb();section('My Conclusions');htmlTxt(concl,10,[30,25,15]);}
    // ── FOOTERS ───────────────────────────────────────────────────────
    var total=doc.internal.getNumberOfPages();
    for(var i=1;i<=total;i++){doc.setPage(i);doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.setTextColor(100,95,90);var footY=ph-26;doc.setFillColor(140,105,30);doc.rect(mgL,footY-4,cw,0.4,'F');doc.text('Arch\xe9 Pilgrim  \u2014  '+(activeRefText||'')+' \u2014 Page '+i+' of '+total,mgL,footY);}
    var fname=pdfSafe((cur.title||'study').replace(/[^a-z0-9]/gi,'_'))+'_'+(cur.date||'undated')+'.pdf';
    if(navigator.share&&/Mobi|Android/i.test(navigator.userAgent)){try{var blob=doc.output('blob'),file=new File([blob],fname,{type:'application/pdf'});await navigator.share({files:[file],title:cur.title||'Arche Pilgrim Study'});toast('PDF shared');return;}catch(e){}}
    doc.save(fname);toast('PDF downloaded');
  }catch(e){toast('PDF error: '+e.message);console.error(e);}
}

// ── SWIPE GESTURES ───────────────────────────────────────────────
/**
 * Attaches horizontal swipe gesture listeners to the main content area.
 * Swipe left navigates to the AI deep-dive panel; swipe right returns to field notes.
 */
function initSwipe(){
  var el=document.getElementById('desktop-main');
  if(!el)return;
  var sx=0,sy=0,threshold=60;
  el.addEventListener('touchstart',function(e){var t=e.touches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
  el.addEventListener('touchend',function(e){
    var t=e.changedTouches[0];
    var dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.5)return;
    var fieldOn=document.getElementById('scr-field').classList.contains('on');
    var deepOn=document.getElementById('scr-deep').classList.contains('on');
    if(dx<0&&fieldOn){if(cur){syncFromInputs();populateDeep();}navTo('deep');}
    else if(dx>0&&deepOn){navTo('field');}
  },{passive:true});
}


// ════════════════════════════════════════════════════════

// SECTION 19 — BACKUP & IMPORT
// Full data export to JSON, import from file, and clear-all data.
// Export includes studies, tags, and streak. Import merges by study ID.
// ════════════════════════════════════════════════════════

/** Triggers the hidden file input to open a file picker for JSON backup import. */
function importDataPrompt(){document.getElementById('import-file-input').click();}
/**
 * Reads a selected JSON backup file and merges studies, tags, and streak into the app.
 * Supports both legacy array format and the current object format {studies, tags, streak}.
 * Merges by study ID (updates existing; adds new). Uses tombstone merge for tags.
 * @param {HTMLInputElement} input - The file input element containing the selected file.
 */
function importDataFromFile(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var payload=JSON.parse(e.target.result);
      // Support legacy array format and new object format {studies,tags,streak}
      var imported=Array.isArray(payload)?payload:(Array.isArray(payload.studies)?payload.studies:[]);
      if(!imported.length&&Array.isArray(payload))throw new Error('Invalid format');
      var added=0;
      imported.forEach(function(s){
        if(!s.id)return;
        migrateStudy(s);
        // Upsert: replace in-place if ID already exists, otherwise prepend as new
        var exists=studies.findIndex(function(x){return x.id===s.id;});
        if(exists>=0)studies[exists]=s;else{studies.unshift(s);added++;}
      });
      persist();
      // Restore tags if present
      if(!Array.isArray(payload)&&Array.isArray(payload.tags)&&payload.tags.length){
        var mergedTags=payload.tags.slice();
        TAGS.forEach(function(t){
          if(!mergedTags.find(function(r){return r.id===t.id;}))mergedTags.push(t);
        });
        var mergedDeleted=mergeDeletedTags(DELETED_TAGS,payload.deletedTags||[]);
        setTags(applyTagTombstones(mergedTags,mergedDeleted));
        DELETED_TAGS=mergedDeleted;
        persistDeletedTags();
        persistTags();
        renderTagManager();
        renderTagPicker();
      }
      // Restore streak — most recent lastDay wins; tie goes to higher count
      if(!Array.isArray(payload)&&payload.streak&&payload.streak.lastDay){
        var localSk=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
        var fileSk=payload.streak;
        var winner;
        if(!localSk.lastDay||fileSk.lastDay>localSk.lastDay){winner=fileSk;}
        else if(fileSk.lastDay<localSk.lastDay){winner=localSk;}
        else{winner={lastDay:localSk.lastDay,streak:Math.max(localSk.streak||0,fileSk.streak||0)};}
        localStorage.setItem(SK_STREAK,JSON.stringify(winner));
      }
      renderLib();
      toast('Imported '+imported.length+' studies ('+(added)+' new)');
    }catch(err){toast('Import failed: '+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}


// ════════════════════════════════════════════════════════

// SECTION 20 — SHARE & DEEP LINKS
// Share app via Web Share API; share individual studies via encoded URL hash.
// checkImportHash() handles incoming shared study links on app load.
// ════════════════════════════════════════════════════════

/**
 * Shares the Pilgrim app via the Web Share API, or falls back to clipboard copy.
 */
/**
 * Opens the Joshua 1:8 cornerstone verse modal.
 */
function openVerseModal(){var o=document.getElementById('verse-modal');if(o)o.classList.add('on');}
/**
 * Closes the Joshua 1:8 verse modal.
 */
function closeVerseModal(){var o=document.getElementById('verse-modal');if(o)o.classList.remove('on');}
function shareApp(){
  // Three-tier fallback: native share API → clipboard write → manual copy modal
  var url=APP_SHARE_URL;
  var text='I\'ve been using Arché · Pilgrim for Bible study and thought you\'d love it. It\'s free, works right in your browser — no install needed, and includes AI-powered study tools.\n\nOpen the app here: '+url;
  if(navigator.share){navigator.share({title:'Arché · Pilgrim',text:text,url:url}).catch(function(){});
  }else if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){toast('Invite copied to clipboard!');}).catch(function(){promptCopyFallback(text);});
  }else{promptCopyFallback(text);}
}
/**
 * Shares a deep link for the currently open study.
 * Syncs form inputs before encoding to ensure the latest data is included.
 */
function shareStudyLink(){if(!cur){toast('No study open');return;}syncFromInputs(true);shareStudyLinkById(cur.id);}
/**
 * Encodes a study as a base64 URL hash and shares or copies the resulting deep link.
 * AI tool results are stubbed as '__shared__' and scripture text is stripped before encoding.
 * @param {string} id - The ID of the study to share.
 */
function shareStudyLinkById(id){
  var s=studies.find(function(x){return x.id===id;});if(!s){toast('Study not found');return;}
  var AI_KEYS=['lexical','grammar','historical','cultural','crossrefs','lexical_book','grammar_book','historical_book','cultural_book','crossrefs_book'];
  var copy=JSON.parse(JSON.stringify(s));
  if(copy.resources)copy.resources=copy.resources.map(function(r){return Object.assign({},r,{dataUrl:'',ocrStatus:r.ocrStatus==='done'?'done':'pending'});});
  // Stub AI results as '__shared__' and strip scripture text — keeps the URL short
  if(copy.refs)copy.refs=copy.refs.map(function(ref){var r=Object.assign({},ref);r.scriptureText='';if(r.deep){r.deep=Object.assign({},r.deep);AI_KEYS.forEach(function(k){if(r.deep[k])r.deep[k]='__shared__';});}return r;});
  try{
    var json=JSON.stringify(copy);
    // encodeURIComponent handles non-ASCII; unescape converts to Latin-1 for btoa
    var encoded=btoa(unescape(encodeURIComponent(json)));
    var base=APP_SHARE_URL;
    var url=base+'#study='+encoded;
    var title=s.title||'Bible Study';
    var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||'';
    var shareText='Check out this study'+(ref0?' on '+ref0:'')+' from Arché · Pilgrim:';
    // 1. Native share sheet — best on iOS and Android, handles URL cleanly
    if(navigator.share){
      navigator.share({title:title,text:shareText,url:url}).catch(function(e){
        if(e.name!=='AbortError'){
          // share failed for non-cancel reason — fall to clipboard
          _copyUrlToClipboard(url);
        }
      });
      return;
    }
    // 2. Clipboard — works on PC and Android Chrome
    _copyUrlToClipboard(url);
  }catch(e){toast('Could not generate link: '+e.message);}
}
/**
 * Copies a URL to the clipboard, falling back to the copy-link modal if unavailable.
 * @param {string} url - The URL string to copy.
 */
function _copyUrlToClipboard(url){
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(function(){toast('Link copied to clipboard!');}).catch(function(){promptCopyFallback(url);});
  } else {promptCopyFallback(url);}
}
/**
 * Opens the copy-link overlay and pre-fills the textarea for manual clipboard copy.
 * Used as a fallback when the Clipboard API is unavailable.
 * @param {string} url - The URL or text to display in the copy modal.
 */
function promptCopyFallback(url){
  var ta=document.getElementById('copylink-textarea');
  if(ta){ta.value=url;}
  document.getElementById('copylink-overlay').classList.add('on');
  setTimeout(function(){if(ta){ta.focus();ta.select();}},200);
}
/**
 * Copies the URL from the copy-link modal textarea to the clipboard and closes the overlay.
 */
function copyLinkFromModal(){
  var ta=document.getElementById('copylink-textarea');
  if(!ta)return;
  if(navigator.clipboard){
    navigator.clipboard.writeText(ta.value).then(function(){toast('Link copied!');closeOverlay('copylink-overlay');}).catch(function(){ta.select();toast('Select all and copy manually');});
  } else {ta.select();toast('Select all and copy manually');}
}
/**
 * Checks the URL hash on app load for an incoming shared study deep link.
 * If found, decodes the base64 payload and opens the import confirmation overlay.
 */
function checkImportHash(){
  try{
    var hash=window.location.hash;
    if(!hash||!hash.startsWith('#study='))return;
    var encoded=hash.slice(7);
    // Reverse of the share encode: atob → escape → decodeURIComponent handles non-ASCII
    var json=decodeURIComponent(escape(atob(encoded)));
    var s=JSON.parse(json);
    if(!s||!s.id)return;
    _importPending=s;
    var preview=document.getElementById('import-preview');
    if(preview){var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';preview.innerHTML='<strong style="color:var(--txt1);font-family:\'EB Garamond\',serif;font-size:16px">'+(s.title||'Untitled Study')+'</strong><br><span style="color:var(--gold);font-size:13px">'+(ref0||'No reference')+'</span>'+(s.teacher?'<br><span style="font-size:12px;color:var(--txt3)">'+escHtml(s.teacher)+'</span>':'')+'<br><span style="font-size:11px;color:var(--txt4)">'+fmtDate(s.date)+'</span>';}
    document.getElementById('import-overlay').classList.add('on');
  }catch(e){/* malformed hash — silently ignore */}
}
/**
 * Confirms and saves the pending shared study import from _importPending.
 * Adds or replaces the study, persists, re-renders the library, and clears the URL hash.
 * Auto-fetches missing scripture for shared studies when online.
 */
function confirmImportLink(){
  if(!_importPending)return;
  var s=_importPending;_importPending=null;
  var exists=studies.findIndex(function(x){return x.id===s.id;});
  if(exists>=0)studies[exists]=s;else studies.unshift(s);
  persist();renderLib();closeOverlay('import-overlay');window.location.hash='';
  var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';
  toast('Study imported: '+(s.title||ref0||'Untitled'));

  // Auto-fetch missing scripture for all refs (shared studies have scriptureText stripped)
  if(online&&sett.scrMode!=='paste'){setTimeout(function(){fetchAllMissingScripture(s);},600);}
}
/**
 * Fetches scripture text for all refs in a study that are missing it.
 * Used after importing a shared study where scripture was stripped before encoding.
 * @param {Object} s - The study object whose refs need scripture populated.
 */
async function fetchAllMissingScripture(s){
  if(!s||!s.refs||!s.refs.length)return;
  var fetched=0;
  for(var i=0;i<s.refs.length;i++){
    var r=s.refs[i];
    if(!r.reference||r.scriptureText)continue; // no ref string, or scripture already populated
    if(r.pastedTranslation)continue; // pasted text has no API ref — can't auto-fetch
    try{
      var trans=r.translation||'esv';
      var text=trans==='esv'?await getESV(r.reference):await getBibleAPI(r.reference,trans);
      if(text){r.scriptureText=text;fetched++;}
    }catch(e){/* silently skip failed refs */}
  }
  if(fetched>0){
    // Update in studies array and persist
    var idx=studies.findIndex(function(x){return x.id===s.id;});
    if(idx>=0)studies[idx]=s;
    persist();
    toast('Scripture loaded for '+fetched+' passage'+(fetched!==1?'s':''));
  }
}
/** Opens the clear-all confirmation overlay. */
function clearAll(){document.getElementById('clearall-overlay').classList.add('on');}
/** Confirms clear-all: wipes the studies array, clears cur, persists, and re-renders. */
function confirmClearAll(){setStudies([]);setCur(null);persist();renderLib();closeOverlay('clearall-overlay');toast('All data cleared');}

// ════════════════════════════════════════════════════════

// SECTION 21 — SETTINGS
// User settings read/write, scripture mode, and default translation.
// loadSett() initializes from localStorage; saveSettings() persists.
// ════════════════════════════════════════════════════════

/**
 * Loads user settings from localStorage into the sett object.
 * Applies defaults for scrMode, defaultTrans, and diagFeedback if missing, then updates UI.
 */
function loadSett(){try{var s=JSON.parse(localStorage.getItem(SK_SETT));if(s)Object.assign(sett,s);
  // Apply defaults for any settings key absent from the stored object
  if(!sett.scrMode)sett.scrMode='auto';if(!sett.defaultTrans)sett.defaultTrans='esv';if(typeof sett.diagFeedback==='undefined')sett.diagFeedback=false;updateScrModeUI();updateDefaultTransUI();}catch(e){}}
/**
 * Sets the scripture fetch mode ('auto' or 'paste'), persists it, and updates the UI.
 * If switching to 'paste' with an open study, opens the paste modal.
 * If switching to 'auto', re-fetches scripture for the current study.
 * @param {string} mode - The scripture mode to set: 'auto' or 'paste'.
 */
function setScrMode(mode){
  sett.scrMode=mode;
  localStorage.setItem(SK_SETT,JSON.stringify(sett));
  updateScrModeUI();
  // Side-effects: paste mode opens the paste modal; auto mode re-fetches scripture
  if(mode==='paste'&&cur&&cur.reference){openPasteModal();}
  else if(mode==='auto'&&cur&&cur.reference){fetchScr();}
}
/**
 * Sets the default Bible translation, persists settings, and updates the translation UI.
 * @param {string} val - Translation abbreviation (e.g. 'esv', 'nasb', 'nkjv').
 */
function setDefaultTrans(val){
  sett.defaultTrans=val;
  localStorage.setItem(SK_SETT,JSON.stringify(sett));
  updateDefaultTransUI();
  toast((val.charAt(0).toUpperCase()+val.slice(1))+' set as default translation');
}
/**
 * Highlights the active default translation tile in the settings panel.
 * Iterates all known translation IDs and toggles the 'trans-default' class.
 */
function updateDefaultTransUI(){
  var def=sett.defaultTrans||'esv';
  ['esv','kjv','nasb','nkjv','niv','nlt','csb','net','amp','msg','asv','web','ylt','darby'].forEach(function(t){
    var el=document.getElementById('trans-tile-'+t);
    if(el){if(t===def)el.classList.add('trans-default');else el.classList.remove('trans-default');}
  });
}
/**
 * Updates the visual state of the Auto / Paste scripture mode toggle buttons.
 * The active mode button gets the gold fill; the inactive button is unstyled.
 */
function updateScrModeUI(){
  var isAuto=sett.scrMode!=='paste';
  var btnAuto=document.getElementById('scr-mode-auto'),btnPaste=document.getElementById('scr-mode-paste');
  if(!btnAuto||!btnPaste)return;
  // Active button: gold fill / dark text. Inactive: unstyled / muted text.
  if(isAuto){
    btnAuto.style.background='var(--gold)';btnAuto.style.color='var(--bg0)';btnAuto.style.fontWeight='600';
    btnPaste.style.background='none';btnPaste.style.color='var(--txt3)';btnPaste.style.fontWeight='400';
  } else {
    btnPaste.style.background='var(--gold)';btnPaste.style.color='var(--bg0)';btnPaste.style.fontWeight='600';
    btnAuto.style.background='none';btnAuto.style.color='var(--txt3)';btnAuto.style.fontWeight='400';
  }
}
/** Persists the current sett object to localStorage and shows a confirmation toast. */
function saveSettings(){localStorage.setItem(SK_SETT,JSON.stringify(sett));toast('Settings saved');}

// ── TRANSLATION SPECTRUM ─────────────────────────────────────────
var TRANS_DATA=[
  {abbr:'YLT',name:"Young's Literal Translation",year:1862,available:true,philosophy:'Strictly Word-for-Word',producers:'Robert Young, Scottish theologian and lexicographer, working alone.',purpose:'Designed for serious scholars who wanted to study the Bible\'s original structure without knowing Hebrew or Greek. Extremely literal — even at the cost of natural English.',notes:'Young also produced Young\'s Analytical Concordance. The YLT renders Hebrew imperfect tense as present tense throughout, which is unusual and often jarring but theologically intentional.'},
  {abbr:'Darby',name:'Darby Bible',year:1890,available:true,philosophy:'Word-for-Word',producers:'John Nelson Darby, founder of the Plymouth Brethren movement, working largely alone.',purpose:'Produced for serious students of prophecy and dispensational theology. Darby wanted a translation stripped of ecclesiastical tradition and rendered with maximum precision.',notes:'Darby\'s translation work was influential in shaping dispensationalism and the modern understanding of the Rapture. His Greek and Hebrew scholarship was respected even by critics. Widely used in Brethren assemblies worldwide.'},
  {abbr:'ASV',name:'American Standard Version',year:1901,available:true,philosophy:'Word-for-Word',producers:'A large committee of American and British scholars, revising the 1881 Revised Version for American audiences.',purpose:'Built for scholarly accuracy and study. Aimed to correct perceived weaknesses of the KJV while retaining a formal, reverent tone.',notes:'Often called "the Rock of Biblical Honesty" for its precision. Became the base text for many later translations including the NASB and RSV. Uses "Jehovah" for the divine name.'},
  {abbr:'NASB',name:'New American Standard Bible',year:1971,available:true,philosophy:'Word-for-Word',producers:'The Lockman Foundation, a team of 58 evangelical scholars.',purpose:'Created to update the ASV with modern scholarship while maintaining strict word-for-word accuracy. Widely regarded as one of the most literal modern translations available.',notes:'Updated in 1995 and again in 2020 (NASB 2020). Preferred by many pastors and seminarians for verse-by-verse study. Known for its use of italics to indicate words added for English clarity.'},
  {abbr:'KJV',name:'King James Version',year:1611,available:true,philosophy:'Word-for-Word',producers:'47 Church of England scholars working in six committees, commissioned by King James I.',purpose:'Produced to be the authoritative English Bible for the Anglican Church, replacing earlier competing translations. Intended to be read aloud in public worship.',notes:'The most printed book in history. Its literary influence on English is unmatched — hundreds of common phrases originate in the KJV. Based on the Textus Receptus Greek text and Masoretic Hebrew text.'},
  {abbr:'NKJV',name:'New King James Version',year:1982,available:true,philosophy:'Word-for-Word',producers:'130 scholars commissioned by Thomas Nelson Publishers.',purpose:'Modernized the KJV\'s archaic language while preserving its literary style, theological tradition, and Textus Receptus base text. Aimed at KJV readers wanting updated readability.',notes:'Retains the traditional verse structure and style that KJV readers love while removing "thee," "thou," and archaic verb forms. Footnotes compare manuscript differences with other textual traditions.'},
  {abbr:'WEB',name:'World English Bible',year:2000,available:true,philosophy:'Word-for-Word',producers:'Michael Paul Johnson and a team of volunteers, revising the ASV.',purpose:'Created specifically to be a public domain modern English Bible — free to use, print, and distribute with no copyright restrictions anywhere in the world.',notes:'One of the few modern translations in the public domain. Based on the ASV but updates archaic language. Uses "Yahweh" for the divine name. Widely used in Bible software, apps, and international distribution where licensing is a barrier.'},
  {abbr:'RSV',name:'Revised Standard Version',year:1952,available:false,philosophy:'Essentially Literal',producers:'National Council of Churches — a large committee of Protestant scholars.',purpose:'An official revision of the ASV intended to be suitable for both private reading and public worship. Aimed at a broad Protestant audience.',notes:'Controversial in some evangelical circles for rendering Isaiah 7:14 as "young woman" rather than "virgin." Served as the base for the NRSV and ESV. Widely used in mainline Protestant and Catholic contexts.'},
  {abbr:'ESV',name:'English Standard Version',year:2001,available:true,philosophy:'Essentially Literal',producers:'Crossway — over 100 evangelical scholars led by J.I. Packer as general editor, revising the RSV.',purpose:'Created for evangelical Christians who wanted a rigorous, essentially literal translation rooted in Reformed theological tradition. Designed for both personal study and corporate worship.',notes:'Quickly became one of the most widely adopted modern translations in evangelical churches. Updated in 2007, 2011, and 2016. The 2016 revision was made permanent after controversy over changes to gender language.'},
  {abbr:'NET',name:'New English Translation',year:2005,available:true,philosophy:'Essentially Literal',producers:'Biblical Studies Press — a team of 25+ evangelical scholars.',purpose:'Designed as a digital-first translation built around transparency. The NET Bible is famous for its 60,000+ translator notes explaining every significant decision.',notes:'Freely available online under a generous license. The translator notes make it uniquely educational — readers can see exactly why a word was translated a particular way. Popular in academic and online study contexts.'},
  {abbr:'CSB',name:'Christian Standard Bible',year:2017,available:true,philosophy:'Optimal Equivalence',producers:'Holman Bible Publishers — over 100 scholars from 17 denominations.',purpose:'Aimed at the center of the spectrum — accurate enough for study, readable enough for everyday use. Replaces the HCSB with improved consistency and a wider ecumenical team.',notes:'Uses "Messiah" instead of "Christ" in the OT and "LORD" in all caps for the divine name. Designed to be the primary translation for LifeWay and Southern Baptist resources.'},
  {abbr:'HCSB',name:'Holman Christian Standard Bible',year:2004,available:false,philosophy:'Optimal Equivalence',producers:'Holman Bible Publishers with 90 scholars from 17 denominations.',purpose:'Sought a middle path between formal and dynamic equivalence. Introduced the term "Optimal Equivalence" to describe its philosophy.',notes:'Predecessor to the CSB (2017). Notable for rendering the divine name as "Yahweh" in the OT where contextually significant — a choice that influenced later translations.'},
  {abbr:'NIV',name:'New International Version',year:1978,available:true,philosophy:'Thought-for-Thought',producers:'Biblica (International Bible Society) — over 100 scholars from English-speaking countries.',purpose:'Created to be the most readable and broadly accessible modern translation for everyday Christians. Prioritizes natural English over structural similarity to the original.',notes:'The world\'s best-selling modern Bible translation. Updated in 1984, 2011. The 2011 revision introduced gender-inclusive language which was controversial in some evangelical circles. Excellent for devotional reading and new believers.'},
  {abbr:'AMP',name:'Amplified Bible',year:1965,available:true,philosophy:'Expanded / Thought-for-Thought',producers:'The Lockman Foundation, working from the ASV base text.',purpose:'Designed to "amplify" the text by including multiple English words to capture the range of meaning in a single original-language term. Intended to give readers a richer sense of the original without knowing Greek or Hebrew.',notes:'Brackets and parentheses contain alternate readings or explanatory additions. Updated in 2015. Particularly popular in Charismatic and Word of Faith circles for its expansive, layered readings.'},
  {abbr:'NLT',name:'New Living Translation',year:1996,available:true,philosophy:'Thought-for-Thought',producers:'Tyndale House Publishers — over 90 scholars revising The Living Bible paraphrase.',purpose:'Moved from a paraphrase to a full translation, aimed at making Scripture immediately understandable for modern readers, especially those new to the Bible or with limited reading backgrounds.',notes:'A revision of Kenneth Taylor\'s The Living Bible (1971). The NLT 2nd edition (2004) significantly improved accuracy. Widely used in children\'s ministry, devotionals, and outreach contexts.'},
  {abbr:'MSG',name:'The Message',year:2002,available:true,philosophy:'Paraphrase',producers:'Eugene H. Peterson, a pastor and scholar, working alone over 10 years.',purpose:'Written to recapture the original impact of Scripture — the surprise, challenge, and freshness it would have had for its first hearers. Aimed at people who have become numb to traditional Bible language.',notes:'Not a translation in the technical sense but a paraphrase — Peterson rendered meaning rather than words. Controversial in study contexts but widely appreciated for devotional and pastoral use. Peterson also wrote "A Long Obedience in the Same Direction."'}
];
window.TRANS_DATA=TRANS_DATA;
var TRANS_AVAILABLE_IDS=['YLT','ASV','KJV','ESV','Darby','WEB','NKJV','NET','AMP','CSB','NLT','MSG','NASB','NIV'];
window.TRANS_AVAILABLE_IDS=TRANS_AVAILABLE_IDS;


// ════════════════════════════════════════════════════════

// SECTION 23 — BOOK PICKER
// Three-stage passage picker: Testament → Book → Chapter.
// bpOpen() launches; bpConfirm() resolves to the f-ref input.
// ════════════════════════════════════════════════════════
var BP_BOOKS={
  OT:[
    {n:'Genesis',c:50},{n:'Exodus',c:40},{n:'Leviticus',c:27},{n:'Numbers',c:36},{n:'Deuteronomy',c:34},
    {n:'Joshua',c:24},{n:'Judges',c:21},{n:'Ruth',c:4},{n:'1 Samuel',c:31},{n:'2 Samuel',c:24},
    {n:'1 Kings',c:22},{n:'2 Kings',c:25},{n:'1 Chronicles',c:29},{n:'2 Chronicles',c:36},
    {n:'Ezra',c:10},{n:'Nehemiah',c:13},{n:'Esther',c:10},{n:'Job',c:42},{n:'Psalms',c:150},
    {n:'Proverbs',c:31},{n:'Ecclesiastes',c:12},{n:'Song of Solomon',c:8},{n:'Isaiah',c:66},
    {n:'Jeremiah',c:52},{n:'Lamentations',c:5},{n:'Ezekiel',c:48},{n:'Daniel',c:12},{n:'Hosea',c:14},
    {n:'Joel',c:3},{n:'Amos',c:9},{n:'Obadiah',c:1},{n:'Jonah',c:4},{n:'Micah',c:7},
    {n:'Nahum',c:3},{n:'Habakkuk',c:3},{n:'Zephaniah',c:3},{n:'Haggai',c:2},{n:'Zechariah',c:14},
    {n:'Malachi',c:4}
  ],
  NT:[
    {n:'Matthew',c:28},{n:'Mark',c:16},{n:'Luke',c:24},{n:'John',c:21},{n:'Acts',c:28},
    {n:'Romans',c:16},{n:'1 Corinthians',c:16},{n:'2 Corinthians',c:13},{n:'Galatians',c:6},
    {n:'Ephesians',c:6},{n:'Philippians',c:4},{n:'Colossians',c:4},{n:'1 Thessalonians',c:5},
    {n:'2 Thessalonians',c:3},{n:'1 Timothy',c:6},{n:'2 Timothy',c:4},{n:'Titus',c:3},
    {n:'Philemon',c:1},{n:'Hebrews',c:13},{n:'James',c:5},{n:'1 Peter',c:5},{n:'2 Peter',c:3},
    {n:'1 John',c:5},{n:'2 John',c:1},{n:'3 John',c:1},{n:'Jude',c:1},{n:'Revelation',c:22}
  ]
};
var _bpTestament='OT',_bpBook=null,_bpChapter=null;
/**
 * Opens the book picker overlay, resets selection state, and displays Stage 1 (Book).
 */
function bpOpen(){
  _bpBook=null;_bpChapter=null;
  bpSetTestament(_bpTestament);
  bpGoStage(1);
  document.getElementById('bp-overlay').classList.add('on');
}
/** Closes the book picker overlay. */
function bpClose(){document.getElementById('bp-overlay').classList.remove('on');}
/**
 * Sets the active testament (OT/NT), highlights the tab, and renders the book grid.
 * @param {string} t - Testament identifier: 'OT' or 'NT'.
 */
function bpSetTestament(t){
  _bpTestament=t;
  document.getElementById('bp-ot-btn').classList.toggle('on',t==='OT');
  document.getElementById('bp-nt-btn').classList.toggle('on',t==='NT');
  var books=BP_BOOKS[t];
  // Escape single quotes in book names so they survive the inline onclick attribute
  document.getElementById('bp-book-grid').innerHTML=books.map(function(b){
    return '<button class="bp-pill" onclick="bpPickBook(\''+b.n.replace(/'/g,'\\\'')+'\')">'+b.n+'</button>';
  }).join('');
}
/**
 * Selects a book, builds the chapter grid, and advances to Stage 2.
 * @param {string} name - The canonical book name (e.g. 'John', '1 Corinthians').
 */
function bpPickBook(name){
  _bpBook=name;
  var book=BP_BOOKS[_bpTestament].find(function(b){return b.n===name;});
  document.getElementById('bp-hdr-title').textContent=name;
  var chs=[];for(var i=1;i<=book.c;i++)chs.push(i);
  document.getElementById('bp-ch-grid').innerHTML=chs.map(function(n){
    return '<button class="bp-ch-pill" onclick="bpPickChapter('+n+')">'+n+'</button>';
  }).join('');
  bpGoStage(2);
}
/**
 * Selects a chapter, updates the preview label, and advances to Stage 3 (verse input).
 * @param {number} n - The chapter number selected.
 */
function bpPickChapter(n){
  _bpChapter=n;
  document.getElementById('bp-hdr-title').textContent=_bpBook+' '+n;
  document.getElementById('bp-sel-preview').textContent=_bpBook+' '+n+':';
  document.getElementById('bp-verse-input').value='';
  bpGoStage(3);
  setTimeout(function(){document.getElementById('bp-verse-input').focus();},350);
}
/**
 * Updates the selection preview label in Stage 3 as the user types a verse range.
 */
function bpUpdatePreview(){
  var v=document.getElementById('bp-verse-input').value.trim();
  document.getElementById('bp-sel-preview').textContent=_bpBook+' '+_bpChapter+(v?':'+v:'');
}
/**
 * Confirms the book-picker selection, writes the reference to #f-ref,
 * updates the active ref object, re-renders pills, and triggers scripture fetch.
 */
function bpConfirm(){
  var v=document.getElementById('bp-verse-input').value.trim();
  if(!v){toast('Please enter a verse or range');return;}
  var ref=_bpBook+' '+_bpChapter+':'+v;
  var fref=document.getElementById('f-ref');
  if(fref){fref.value=ref;var ar=activeRef();if(ar)ar.reference=ref;}
  // Re-render pills, update the bar ref label, then fetch scripture for the new reference
  renderRefPills('f-ref-pills','field');updateBarRefLabel();
  bpClose();
  fetchScr();
}
/**
 * Navigates back one stage in the book picker (Stage 3 → 2 → 1).
 */
function bpBack(){
  // Stage 3 → 2: restore book title; Stage 2 → 1: restore default header
  if(document.getElementById('bp-stage3').classList.contains('on')){bpGoStage(2);document.getElementById('bp-hdr-title').textContent=_bpBook;}
  else if(document.getElementById('bp-stage2').classList.contains('on')){bpGoStage(1);document.getElementById('bp-hdr-title').textContent='Choose Book';}
}
/**
 * Shows the given stage panel and hides the others; toggles the back button visibility.
 * @param {number} n - Stage number to display (1 = book, 2 = chapter, 3 = verse).
 */
function bpGoStage(n){
  // Toggle each stage panel; hide the back button on Stage 1 (no previous stage)
  [1,2,3].forEach(function(i){document.getElementById('bp-stage'+i).classList.toggle('on',i===n);});
  document.getElementById('bp-back-btn').style.display=n===1?'none':'flex';
}
// ── END BOOK PICKER ───────────────────────────────────────────
/**
 * Opens the export backup modal and renders a checkbox list of all studies.
 * Pre-selects all studies and initializes the selection count display.
 */
async function openExportBackupModal(){
  if(!studies.length){toast('No studies to export');return;}
  var list=document.getElementById('export-study-list');
  // Render a checkbox row per study, all pre-checked; count is updated after render
  list.innerHTML=studies.map(function(s,i){
    var ref=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';
    var lbl=escHtml(s.title||(ref?'Untitled — '+ref:'Untitled'));
    return '<label style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:9px 12px;cursor:pointer">'+
      '<input type="checkbox" class="export-study-cb" data-idx="'+i+'" checked onclick="updateExportSelCount()" style="margin-top:3px;flex-shrink:0">'+
      '<div><div style="font-size:13px;color:var(--txt1);line-height:1.3">'+lbl+'</div>'+
      (ref?'<div style="font-size:11px;color:var(--gold);margin-top:2px">'+escHtml(ref)+'</div>':'')+
      '<div style="font-size:11px;color:var(--txt4);margin-top:1px">'+fmtDate(s.date)+'</div></div></label>';
  }).join('');
  updateExportSelCount();
  document.getElementById('export-backup-overlay').classList.add('on');
}
/**
 * Updates the selection count label, confirm button state, and select-all button
 * text in the export backup modal based on the current checkbox states.
 */
function updateExportSelCount(){
  var cbs=document.querySelectorAll('.export-study-cb');
  var checked=0;cbs.forEach(function(c){if(c.checked)checked++;});
  var lbl=document.getElementById('export-sel-count');
  var btn=document.getElementById('export-confirm-btn');
  var sall=document.getElementById('export-selall-btn');
  if(lbl)lbl.textContent=checked===cbs.length?'All selected':checked+' of '+cbs.length+' selected';
  if(btn)btn.disabled=checked===0;
  if(sall)sall.textContent=checked===cbs.length?'Deselect All':'Select All';
}
/**
 * Toggles all study checkboxes in the export backup modal between selected and deselected.
 */
function toggleExportSelectAll(){
  var cbs=document.querySelectorAll('.export-study-cb');
  // If every checkbox is already on, this becomes a deselect-all; otherwise select-all
  var allChecked=Array.from(cbs).every(function(c){return c.checked;});
  cbs.forEach(function(c){c.checked=!allChecked;});
  updateExportSelCount();
}
/**
 * Reads checked studies from the export modal and downloads (or shares) them as a JSON backup.
 * Uses the Web Share API on capable devices; falls back to anchor download.
 */
function confirmExport(){
  var cbs=document.querySelectorAll('.export-study-cb');
  var selected=[];
  cbs.forEach(function(c){if(c.checked)selected.push(studies[parseInt(c.dataset.idx)]);});
  if(!selected.length){toast('Select at least one study');return;}
  var streak=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
  var isAll=selected.length===studies.length;
  var payload={studies:selected,tags:TAGS,deletedTags:DELETED_TAGS,streak:streak};
  var fname=isAll?'arche-pilgrim-backup.json':'arche-pilgrim-backup-'+selected.length+'-studies.json';
  var json=JSON.stringify(payload,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var file=new File([blob],fname,{type:'application/json'});
  closeOverlay('export-backup-overlay');
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    // AbortError = user cancelled share sheet; only fall to download on real failures
    try{navigator.share({files:[file],title:'Arché · Pilgrim Backup'}).then(function(){toast('Backup shared');}).catch(function(e){if(e.name!=='AbortError'){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fname;a.click();URL.revokeObjectURL(url);toast('Backup downloaded');}});return;}
    catch(e){/* fall through */}
  }
  // Anchor download fallback: create an object URL, trigger click, revoke immediately
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fname;a.click();URL.revokeObjectURL(url);
  toast(isAll?'Full backup downloaded':'Backup of '+selected.length+' studies downloaded');
}
/**
 * Exports all studies, tags, deleted-tag tombstones, and streak as a JSON backup file.
 * Uses the Web Share API on capable devices; falls back to anchor download.
 */
async function exportData(){
  var streak=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
  var json=JSON.stringify({studies:studies,tags:TAGS,deletedTags:DELETED_TAGS,streak:streak},null,2);
  var blob=new Blob([json],{type:'application/json'});
  var fname='arche-pilgrim-backup.json';
  var file=new File([blob],fname,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'Arché · Pilgrim Backup'});toast('Backup shared');return;}
    catch(e){if(e.name==='AbortError')return; // user dismissed share sheet — do nothing
    /* fall through */}
  }
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fname;a.click();URL.revokeObjectURL(url);toast('Backup downloaded');
}


// ════════════════════════════════════════════════════════

// SECTION 24 — ONBOARDING
// First-run walkthrough (5 steps) and tab hint animations.
// Gated by SK_OB and SK_TAB_HINTS localStorage flags.
// ════════════════════════════════════════════════════════
/**
 * Shows the navigation tab hint animations if the user has not yet dismissed them.
 */
function checkTabHints(){
  if(!localStorage.getItem(SK_TAB_HINTS)){
    document.querySelector('nav').classList.add('tab-hints-on');
  }
}
/**
 * Dismisses the navigation tab hints, removes the CSS class, and marks them as seen.
 */
function dismissTabHints(){
  if(document.querySelector('nav').classList.contains('tab-hints-on')){
    document.querySelector('nav').classList.remove('tab-hints-on');
    localStorage.setItem(SK_TAB_HINTS,'1');
  }
}
/**
 * Shows the onboarding overlay on first run: no prior flag, no studies, and no shared link hash.
 */
function checkOnboarding(){
  // Three-gate: no prior flag AND no studies AND no incoming shared link
  if(!localStorage.getItem(SK_OB)&&studies.length===0&&!window.location.hash.startsWith('#study=')){
    obStep=0;renderObStep();
    document.getElementById('ob-overlay').classList.add('on');
  }
}
/**
 * Renders the current onboarding step by toggling step and dot visibility.
 * Updates the Next button label to "Get Started" on the final step.
 */
function renderObStep(){
  // Toggle each step panel and its dot indicator; only the current step gets 'on'
  for(var i=0;i<3;i++){
    document.getElementById('ob-step-'+i).classList.toggle('on',i===obStep);
    document.getElementById('ob-dot-'+i).classList.toggle('on',i===obStep);
  }
  var btn=document.getElementById('ob-next-btn');
  if(btn)btn.textContent=obStep===2?'Get Started':'Next';
}
/**
 * Advances to the next onboarding step, or completes onboarding on the final step.
 */
function obNext(){
  if(obStep<2){obStep++;renderObStep();}
  else{showTourOffer();}
}
/**
 * Replaces the final onboarding step's Next/Skip row with a one-time offer
 * to start Tour A immediately, instead of closing onboarding straight away.
 */
function showTourOffer(){
  var s2=document.getElementById('ob-step-2');if(s2)s2.classList.remove('on');
  var offer=document.getElementById('ob-offer');if(offer)offer.classList.add('on');
  var dots=document.getElementById('ob-dots');if(dots)dots.style.display='none';
  var actions=document.getElementById('ob-actions');if(actions)actions.style.display='none';
  var offerActions=document.getElementById('ob-offer-actions');if(offerActions)offerActions.style.display='flex';
}
/**
 * Skips or completes onboarding: sets the SK_OB flag and hides the overlay.
 */
function skipOnboarding(){
  localStorage.setItem(SK_OB,'1');
  document.getElementById('ob-overlay').classList.remove('on');
}

// ── TRACK OPENS (for streak) ─────────────────────────────────────
/**
 * Records a study open event for daily streak tracking.
 * Increments the streak if the last open was yesterday; resets it otherwise.
 * @param {Object} s - The study object being opened.
 */
function trackOpen(s){
  if(!s)return;
  s.lastOpened=new Date().toISOString().split('T')[0];
  // Update streak tracking key
  var today=todayStr();
  var sk=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
  // Three cases: same day (no-op), consecutive day (increment), gap (reset to 1)
  if(sk.lastDay===today){/* already tracked today */}
  else if(sk.lastDay===prevDay(today)){sk.streak=(sk.streak||0)+1;sk.lastDay=today;}
  else{sk.streak=1;sk.lastDay=today;}
  localStorage.setItem(SK_STREAK,JSON.stringify(sk));
}

// ── STATS ────────────────────────────────────────────────────────
/**
 * Renders the Stats page: study count, word count, AI run count, streak,
 * most-studied books with progress bars, and recent activity list.
 */
function renderStats(){
  // Reload studies from localStorage so stats reflect any changes since last render
  loadStudies();
  var sk=JSON.parse(localStorage.getItem(SK_STREAK)||'{"lastDay":"","streak":0}');
  var today=todayStr();
  // Streak expires if lastDay wasn't today or yesterday
  var streakVal=sk.streak||0;
  if(sk.lastDay&&sk.lastDay!==today&&sk.lastDay!==prevDay(today))streakVal=0;

  var totalWords=studies.reduce(function(a,s){var w=(s.fieldNotes||'').trim().split(/\s+/).filter(function(x){return x.length>0;});return a+(s.fieldNotes&&s.fieldNotes.trim()?w.length:0);},0);

  // Most studied book — count all refs across all studies
  var bookCounts={};
  studies.forEach(function(s){
    var refs=s.refs&&s.refs.length?s.refs:[{reference:s.reference||''}];
    refs.forEach(function(r){var b=getBookFromRef(r.reference||'');if(b)bookCounts[b]=(bookCounts[b]||0)+1;});
  });
  var topBook=Object.keys(bookCounts).sort(function(a,b){return bookCounts[b]-bookCounts[a];})[0]||'—';

  // AI tools run — count across all refs in all studies
  var aiRuns=studies.reduce(function(a,s){
    var refs=s.refs&&s.refs.length?s.refs:[s.deep||{}];
    return a+refs.reduce(function(b,r){var d=r.deep||r;return b+['lexical','grammar','historical','cultural','crossrefs'].filter(function(k){return d[k];}).length;},0);
  },0);

  document.getElementById('stats-grid').innerHTML=
    statCard(streakVal,'Day Streak','🔥','Keep going!')+
    statCard(studies.length,'Total Studies','','Across all time')+
    statCard(totalWords.toLocaleString(),'Words Written','','In field notes')+
    statCard(aiRuns,'AI Tools Run','','Across all studies');

  // Most studied books
  var sortedBooks=Object.keys(bookCounts).sort(function(a,b){return bookCounts[b]-bookCounts[a];}).slice(0,6);
  var booksEl=document.getElementById('stats-books');
  if(sortedBooks.length){
    booksEl.innerHTML=sortedBooks.map(function(b){
      var pct=Math.round((bookCounts[b]/studies.length)*100);
      return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:14px;color:var(--txt2);font-family:\'EB Garamond\',serif">'+b+'</span><span style="font-size:12px;color:var(--txt3)">'+bookCounts[b]+' '+(bookCounts[b]===1?'study':'studies')+'</span></div><div style="height:5px;background:var(--bg3);border-radius:50px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--gold),var(--golddim));border-radius:50px;transition:width .5s ease"></div></div></div>';
    }).join('');
  } else {booksEl.innerHTML='<p style="font-size:13px;color:var(--txt4);font-style:italic">No studies yet.</p>';}

  // Recent activity — last 7 studies
  var recent=studies.slice().sort(function(a,b){return (b.lastOpened||b.date||'')>(a.lastOpened||a.date||'')?1:-1;}).slice(0,7);
  var recentEl=document.getElementById('stats-recent');
  if(recent.length){
    recentEl.innerHTML=recent.map(function(s){
      var ref0=(s.refs&&s.refs[0]&&s.refs[0].reference)||s.reference||'';
      return '<div onclick="openStudy(\''+s.id+'\')" style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer"><div style="width:3px;align-self:stretch;background:linear-gradient(180deg,var(--gold),var(--golddim));border-radius:2px;flex-shrink:0"></div><div style="flex:1;min-width:0"><div style="font-family:\'EB Garamond\',serif;font-size:15px;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(s.title||'Untitled Study')+'</div><div style="font-size:11px;color:var(--gold)">'+(ref0||'No reference')+'</div></div><div style="font-size:10px;color:var(--txt4);flex-shrink:0">'+fmtDate(s.lastOpened||s.date||'')+'</div></div>';
    }).join('');
  } else {recentEl.innerHTML='<p style="font-size:13px;color:var(--txt4);font-style:italic">No activity yet.</p>';}
}
/**
 * Returns the HTML string for a single stat card widget.
 * @param {string|number} val - The primary display value.
 * @param {string} label - The label shown below the value.
 * @param {string} icon - Optional emoji icon shown above the value.
 * @param {string} sub - Optional subtext shown at the bottom of the card.
 * @returns {string} HTML string for the stat card.
 */
function statCard(val,label,icon,sub){
  return '<div class="stat-card">'+(icon?'<div class="streak-flame">'+icon+'</div>':'')+
    '<div class="stat-val">'+val+'</div>'+
    '<div class="stat-label">'+label+'</div>'+
    (sub?'<div class="stat-sub">'+sub+'</div>':'')+
    '</div>';
}


// ════════════════════════════════════════════════════════

// SECTION 25 — GUIDED TOURS
// Coach-mark engine (dimmed spotlight + message bubble + Next/Back/Skip +
// progress dots) shared by Tour A ("Create Your First Study") and Tour B
// ("Settings Walkthrough"). Tour A drives real navTo() calls and builds its
// main demo study entirely in `cur` — never persisted, never saved through
// saveStudy()/addRef() (which would trigger a Gist cloud sync) — plus a
// small set of tagged (_tourDemo:true) seed studies and one saved demo word
// for the Progress-tab preview. Everything is auto-removed on tour end,
// skip, or next app launch (see tourCleanupDemoData, the crash-safety net
// called from startPilgrim in Section 28).
// ════════════════════════════════════════════════════════

var _tourActive=null; // null | 'study' | 'settings'
var _tourStep=0;
var _tourSteps=[];

/**
 * Global safety net: blurs any input/textarea/contenteditable the instant it
 * gains focus while a tour is active, regardless of what caused the focus
 * (click-through, a production function's own deferred .focus() call, Quill
 * internals, etc.). Per-step blur() calls in tourRenderStep() couldn't catch
 * focus that happens asynchronously mid-step, so this listens for the actual
 * focus event itself instead of guessing when to check. Capture phase so it
 * fires before the element has a chance to keep focus or show the keyboard.
 */
document.addEventListener('focusin',function(e){
  if(!_tourActive)return;
  var t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))t.blur();
},true);

/**
 * Computes the union bounding rect of every element matched by a selector
 * (comma-separated selectors let one step spotlight several controls at
 * once, e.g. both Library tabs). Skips zero-size matches so a hidden
 * element can't collapse the union to nothing.
 * @param {string} sel - CSS selector, or falsy for "no target" (centered step).
 * @returns {{top:number,left:number,width:number,height:number}|null}
 */
function tourTargetRect(sel){
  if(!sel)return null;
  var els=document.querySelectorAll(sel);
  if(!els.length)return null;
  var top=Infinity,left=Infinity,right=-Infinity,bottom=-Infinity,found=false;
  els.forEach(function(el){
    var r=el.getBoundingClientRect();
    if(r.width===0&&r.height===0)return;
    found=true;
    top=Math.min(top,r.top);left=Math.min(left,r.left);
    right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);
  });
  if(!found)return null;
  return {top:top,left:left,width:right-left,height:bottom-top};
}
/**
 * Positions the spotlight cutout over a target rect using the box-shadow
 * trick (transparent box, oversized box-shadow dims everything outside it).
 * With no rect, collapses to a zero-size point at viewport center so the
 * same box-shadow uniformly dims the whole screen for centered steps.
 * @param {Object|null} rect - Rect from tourTargetRect(), or null.
 */
function tourPositionSpotlight(rect){
  var sp=document.getElementById('tour-spotlight');if(!sp)return;
  var pad=6;
  if(rect){
    sp.style.top=(rect.top-pad)+'px';sp.style.left=(rect.left-pad)+'px';
    sp.style.width=(rect.width+pad*2)+'px';sp.style.height=(rect.height+pad*2)+'px';
  }else{
    sp.style.top='50%';sp.style.left='50%';sp.style.width='0px';sp.style.height='0px';
  }
}
/**
 * Positions the message bubble near a target rect — on whichever side (below
 * or above) actually has room for it, falling back to whichever side has
 * more space if neither fully fits, so the edge-clamp below can't slide the
 * bubble back over the target it's describing. With no rect, centers the
 * bubble in the viewport.
 * @param {Object|null} rect - Rect from tourTargetRect(), or null.
 */
function tourPositionBubble(rect){
  var b=document.getElementById('tour-bubble');if(!b)return;
  var vw=window.innerWidth,vh=window.innerHeight;
  var bw=b.offsetWidth||300,bh=b.offsetHeight||180;
  if(!rect){
    b.style.top=Math.max(16,(vh/2-bh/2))+'px';
    b.style.left=Math.max(16,(vw/2-bw/2))+'px';
    return;
  }
  var spaceBelow=vh-rect.top-rect.height,spaceAbove=rect.top;
  var top=(spaceBelow>=bh+18||spaceBelow>=spaceAbove)?(rect.top+rect.height+18):(rect.top-bh-18);
  top=Math.max(16,Math.min(top,vh-bh-16));
  var left=Math.max(16,Math.min(rect.left,vw-bw-16));
  b.style.top=top+'px';b.style.left=left+'px';
}
/**
 * Starts a guided tour by name. Resets step state, backs up the real streak
 * value (Tour A only — see tourCleanupDemoData for why this needs to happen
 * up front rather than lazily), shows the overlay, and renders the first step.
 * @param {string} name - 'study' for Tour A, 'settings' for Tour B.
 */
function startTour(name){
  _tourActive=name;
  _tourSteps=(name==='study')?TOUR_A_STEPS:TOUR_B_STEPS;
  _tourStep=0;
  if(name==='study'){
    var backupKey=SK_STREAK+'_tourbak';
    if(localStorage.getItem(backupKey)===null){
      var existing=localStorage.getItem(SK_STREAK);
      localStorage.setItem(backupKey,existing===null?'__none__':existing);
    }
  }
  document.getElementById('tour-overlay').classList.add('on');
  tourRenderStep();
}
/**
 * Renders the current tour step: navigates screens if the step specifies
 * one, runs the step's before() setup (field pre-fills, modal opens, demo
 * data), updates the bubble text and dots, then — after blurring any
 * focused element so the on-screen keyboard can't intercept the step —
 * scrolls the target into view and positions the spotlight and bubble
 * against its post-scroll position once the DOM has settled.
 */
function tourRenderStep(){
  var step=_tourSteps[_tourStep];
  if(!step){endTour();return;}
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  var changedScreen=!!step.screen&&!document.getElementById('scr-'+step.screen).classList.contains('on');
  if(step.screen)navTo(step.screen);
  if(step.before)step.before();
  document.getElementById('tour-bubble-title').textContent=step.title;
  document.getElementById('tour-bubble-body').textContent=step.body;
  tourRenderDots();
  document.getElementById('tour-back-btn').style.visibility=(_tourStep===0)?'hidden':'visible';
  document.getElementById('tour-next-btn').textContent=(_tourStep===_tourSteps.length-1)?'Done':'Next';
  setTimeout(function(){
    var targetEl=step.target?document.querySelector(step.target):null;
    if(targetEl&&targetEl.scrollIntoView)targetEl.scrollIntoView({block:'center'});
    var rect=tourTargetRect(step.target);
    tourPositionSpotlight(rect);
    tourPositionBubble(rect);
  },changedScreen?90:20);
}
/** Advances to the next tour step, or ends the tour if already on the last step. */
function tourNext(){if(_tourStep>=_tourSteps.length-1){endTour();return;}_tourStep++;tourRenderStep();}
/** Returns to the previous tour step. No-ops on the first step. */
function tourBack(){if(_tourStep<=0)return;_tourStep--;tourRenderStep();}
/** Jumps directly to a step via its progress dot. */
function tourJump(i){_tourStep=i;tourRenderStep();}
/** Skip button handler — ends the tour immediately from any step. */
function skipTour(){endTour();}
/**
 * Ends the active tour: hides the overlay, closes any modal a step may have
 * left open, marks the appropriate "seen" flag so it doesn't auto-offer
 * again, and — for Tour A — clears the in-memory demo study and runs the
 * full demo-data cleanup (safe no-op for anything that was never created).
 */
function endTour(){
  document.getElementById('tour-overlay').classList.remove('on');
  ['tpl-overlay','bp-overlay','lexicon-overlay'].forEach(function(id){var ov=document.getElementById(id);if(ov)ov.classList.remove('on');});
  if(_tourActive==='study'){
    localStorage.setItem(SK_TOUR_STUDY_SEEN,'1');
    setCur(null);setActiveRefIdx(0);
    tourCleanupDemoData();
    navTo('library');
  }
  if(_tourActive==='settings'){
    localStorage.setItem(SK_TOUR_SETTINGS_SEEN,'1');
  }
  _tourActive=null;_tourSteps=[];_tourStep=0;
}
/** Renders the clickable progress dots for the active tour's step list. */
function tourRenderDots(){
  var d=document.getElementById('tour-dots');if(!d)return;
  d.innerHTML=_tourSteps.map(function(s,i){return '<span class="tour-dot'+(i===_tourStep?' on':'')+'" onclick="tourJump('+i+')"></span>';}).join('');
}
window.addEventListener('resize',function(){
  if(!_tourActive)return;
  var step=_tourSteps[_tourStep];if(!step)return;
  var rect=tourTargetRect(step.target);
  tourPositionSpotlight(rect);tourPositionBubble(rect);
});

// ── TOUR A DEMO DATA ─────────────────────────────────────────────────────
/**
 * Returns a YYYY-MM-DD date string N days before today, for backdating the
 * Progress-tab seed studies so they look like real recent activity.
 * @param {number} daysAgo - Number of days before today.
 */
function tourOffsetDate(daysAgo){var dt=new Date();dt.setDate(dt.getDate()-daysAgo);return dt.toISOString().split('T')[0];}
/**
 * Saves a canned "Archē" word-study result to the global Word List, tagged
 * _tourDemo:true. Uses fixed demo content rather than a live Groq lookup so
 * the tour is instant, free, and works offline. Replaces any prior demo
 * entry first so re-running the tour can't stack duplicates.
 */
function tourSaveDemoWord(){
  var gWords=[];try{gWords=JSON.parse(localStorage.getItem(SK_WORDS)||'[]');}catch(e){}
  gWords=gWords.filter(function(w){return !w._tourDemo;});
  gWords.push({id:'tourdemo_word',query:"Archē",html:'<p><strong>Arch\u0113 (\u1f00\u03c1\u03c7\u03ae)</strong> \u2014 Greek for "beginning" or "origin." Strong\u2019s G746.</p><p>Used in John 1:1, "In the beginning was the Word," and Genesis 1:1 (LXX). Carries a double sense: a starting point in time, and a governing first principle.</p>',reference:'John 1:1',savedAt:new Date().toISOString(),inGlobal:true,inStudy:false,_studyId:null,_studyTitle:'(no study)',_tourDemo:true});
  try{localStorage.setItem(SK_WORDS,JSON.stringify(gWords));}catch(e){}
}
/**
 * Seeds five tagged demo studies across different books, dates, and AI tool
 * usage so the Progress tab shows what a populated account actually looks
 * like, then sets a 6-day streak. The real streak value was already backed
 * up by startTour() before any of this ran, and is restored by
 * tourCleanupDemoData(). Called lazily, right before the Progress step is
 * shown, and guarded so re-entering that step twice in one run of the tour
 * doesn't seed duplicates.
 */
function tourSeedProgressData(){
  if(studies.some(function(s){return s._tourDemo;}))return;
  var teacherName=(cur&&cur.teacher)||'Jesse';
  var defs=[
    {title:'Genesis 1 — Creation',ref:'Genesis 1:1-5',days:6,tools:['historical','lexical']},
    {title:'Romans 8 — No Condemnation',ref:'Romans 8:1-4',days:5,tools:['grammar','crossrefs']},
    {title:'Psalm 23 — The Shepherd',ref:'Psalm 23:1-6',days:4,tools:['cultural']},
    {title:'Ephesians 2 — By Grace',ref:'Ephesians 2:8-10',days:2,tools:['lexical','crossrefs','grammar']},
    {title:'James 1 — Trials',ref:'James 1:2-4',days:1,tools:['historical','geography']}
  ];
  defs.forEach(function(d){
    var r=makeRef('primary');r.reference=d.ref;
    d.tools.forEach(function(t){r.deep[t]='Demo content for the Progress tab preview.';});
    var dateStr=tourOffsetDate(d.days);
    studies.push({id:'bsn_tourdemo_'+d.title.replace(/[^a-z0-9]/gi,'').toLowerCase(),date:dateStr,title:d.title,series:'',teacher:teacherName,fieldNotes:'',tags:[],resources:[],refs:[r],deep:{conclusions:'',outline:''},words:[],_tourDemo:true,lastOpened:dateStr});
  });
  persist();
  localStorage.setItem(SK_STREAK,JSON.stringify({lastDay:todayStr(),streak:6}));
}
/**
 * Removes everything Tour A may have created: tagged studies, the tagged
 * demo word, and restores the real streak value from its backup if one is
 * pending. Subtractive only — filters by the _tourDemo flag, never targets
 * IDs directly, so it cannot touch real data even if called repeatedly.
 * Called on normal tour end/skip AND unconditionally on every app boot (see
 * startPilgrim, Section 28) as a safety net in case the browser closed
 * mid-tour before cleanup could run normally.
 */
function tourCleanupDemoData(){
  var before=studies.length;
  setStudies(studies.filter(function(s){return !s._tourDemo;}));
  if(studies.length!==before)persist();
  try{
    var gw=JSON.parse(localStorage.getItem(SK_WORDS)||'[]');
    var kept=gw.filter(function(w){return !w._tourDemo;});
    if(kept.length!==gw.length)localStorage.setItem(SK_WORDS,JSON.stringify(kept));
  }catch(e){}
  var backupKey=SK_STREAK+'_tourbak';
  var backup=localStorage.getItem(backupKey);
  if(backup!==null){
    if(backup==='__none__')localStorage.removeItem(SK_STREAK);else localStorage.setItem(SK_STREAK,backup);
    localStorage.removeItem(backupKey);
  }
}

// ── TOUR A — "CREATE YOUR FIRST STUDY" ───────────────────────────────────
var TOUR_A_STEPS=[
  {screen:'library',target:'.botnav',title:'Getting Around',body:'On mobile the navigation bar runs along the bottom of the screen. On desktop it becomes a sidebar on the left. Tap any section — Library, Notes, Study Tools, Progress, or Settings — to switch screens.'},
  {screen:'library',target:'#lib-tab-studies,#lib-tab-words',title:'Studies & Words',body:"The Studies tab holds every Bible study you create. The Words tab holds every word you've looked up and saved, across all of your studies."},
  {screen:'library',target:'#lib-sort',title:'Sorting Your Library',body:'Sort by Date, Modified, Reference, Teacher, or Series. Choosing Reference, Teacher, or Series reveals a sub-filter bar so you can narrow things down further.'},
  {screen:'library',target:'.fab',title:'Start a New Study',body:'Tap here any time to start a new study. This button only appears on the Library tab.'},
  {screen:'library',before:function(){var ov=document.getElementById('tpl-overlay');if(ov)ov.classList.add('on');},target:'.tpl-card[onclick*="blank"]',title:'Choose a Template',body:"Pick Blank to start from scratch, or choose a guided template like Sermon or Devotion. We'll use Blank for this walkthrough."},
  {before:function(){var ov=document.getElementById('tpl-overlay');if(ov)ov.classList.remove('on');createFromTemplate('blank');cur._tourDemo=true;},target:null,title:'Your New Study',body:"This is the Notes screen — where you'll build out a study from start to finish. Let's fill it in together."},
  {screen:'field',target:'#f-date',title:'Date',body:"Today's date is filled in automatically — you can change it any time."},
  {screen:'field',before:function(){cur.teacher='Jesse';populateField();},target:'#f-teacher',title:'Teacher / Preacher',body:"Add who taught or preached this study. We've filled in an example name."},
  {screen:'field',before:function(){cur.series="How to Use Archē";populateField();},target:'#f-series',title:'Series',body:'Group related studies under a series name — handy for a sermon series or a class.'},
  {screen:'field',before:function(){cur.title='First-Time Study';populateField();},target:'#f-title',title:'Title',body:'Give your study a specific title.'},
  {screen:'field',before:function(){cur.tags=['study'];renderTagPicker();},target:'#f-tags-picker',title:'Tags',body:'Tag a study to filter and sort by it later in the Library. We selected "Study" as an example — tap any tag to toggle it.'},
  {screen:'field',before:function(){var ar=activeRef();if(ar)ar.reference='Genesis 1:1';var inp=document.getElementById('f-ref');if(inp)inp.value='Genesis 1:1';renderRefPills('f-ref-pills','field');fetchScr();},target:'#f-ref',title:'Scripture Reference',body:'Type a reference like "Genesis 1:1" directly — we\u2019ve filled it in for you.'},
  {screen:'field',target:'.bp-open-btn',title:'Or Browse for It',body:'Prefer not to type? Tap this book icon to open the Reference Picker — browse by Testament, Book, Chapter, and Verse, then tap Load Scripture.'},
  {screen:'field',before:function(){bpOpen();},target:'#bp-overlay',title:'Reference Picker',body:'Choose Old or New Testament → Book → Chapter → Verse — the reference fills in automatically. Tap Load Scripture to pull the passage.'},
  {screen:'field',before:function(){closeOverlay('bp-overlay');var r=makeRef('secondary');r.reference='Romans 8:28';cur.refs.push(r);switchRef(cur.refs.length-1);fetchScr();},target:'.ref-pill-add',title:'Add Another Passage',body:"Tap + Add Passage to study multiple passages in one study. We've added a second one — Romans 8:28 — to show how it works."},
  {screen:'field',before:function(){switchRef(0);},target:'#scrpanel',title:'Read the Passage',body:'This is where the loaded scripture text appears for you to read.'},
  {screen:'field',before:function(){if(typeof _qFN!=='undefined'&&_qFN){_qFN.clipboard.dangerouslyPasteHTML('<p>In the beginning — God\u2019s first act was creation. Who is the subject? God. What did He do? Created. Why does that matter?</p>');updateWordCount();}},target:'#f-notes-editor',title:'Observations & Notes',body:'A full rich-text editor: bold, italic, underline, strikethrough, lists, indent, blockquote, and a clear-format eraser. We filled in a quick example note.'},
  {screen:'field',target:'#listen-fn-btn',title:'Listen',body:'Tap Listen to have your notes read aloud — handy for review or while your hands are busy.'},
  {screen:'field',target:'#field-lookupword-btn',title:'Look Up a Word',body:'Tap ✦ Look Up Word to search any Greek or Hebrew term. Results include Strong’s number, definition, transliteration, KJV usage, and scholarly notes. Save to this study or your Words library.'},
  {screen:'field',before:function(){var ov=document.getElementById('lexicon-overlay');if(ov)ov.classList.add('on');var sb=document.getElementById('lex-save-bar');if(sb)sb.style.display='none';var inp=document.getElementById('lexicon-input');if(inp)inp.value="Archē";var res=document.getElementById('lexicon-result');if(res)res.innerHTML='<p><strong>Arch\u0113 (\u1f00\u03c1\u03c7\u03ae)</strong> \u2014 Greek for "beginning" or "origin." Strong\u2019s G746.</p><p>Used in John 1:1 and Genesis 1:1 (LXX). A starting point in time, and a governing first principle.</p>';tourSaveDemoWord();},target:'#lexicon-overlay',title:'Word Lookup Result',body:'Results include Strong’s number, pronunciation, definitions, scholarly notes, and usage across Scripture. Save a word to this study, or to the global Word List for later.'},
  {before:function(){var ov=document.getElementById('lexicon-overlay');if(ov)ov.classList.remove('on');},target:'#nav-deep',title:'Getting to Study Tools',body:'Tap the Study Tools tab any time to dig deeper. On mobile it’s in the top navigation bar; on a computer it’s in the left panel.'},
  {screen:'deep',target:null,title:'Study Tools',body:'The same Genesis 1:1 passage and your notes are already here — Study Tools is where you dig deeper with AI-assisted research.'},
  {screen:'deep',target:'#btn-lexical',title:TOOL_LABELS.lexical,body:TOOL_DESCS.lexical},
  {screen:'deep',target:'#btn-grammar',title:TOOL_LABELS.grammar,body:TOOL_DESCS.grammar},
  {screen:'deep',target:'#btn-historical',title:TOOL_LABELS.historical,body:TOOL_DESCS.historical},
  {screen:'deep',target:'#btn-cultural',title:TOOL_LABELS.cultural,body:TOOL_DESCS.cultural},
  {screen:'deep',target:'#btn-crossrefs',title:TOOL_LABELS.crossrefs,body:TOOL_DESCS.crossrefs},
  {screen:'deep',target:'#btn-geography',title:TOOL_LABELS.geography,body:TOOL_DESCS.geography},
  {screen:'deep',target:'#scope-passage,#scope-book',title:'This Passage vs. Whole Book',body:'Toggle the scope before running a tool — This Passage studies just the loaded verses; Whole Book studies the entire book they belong to.'},
  {screen:'deep',target:'#btn-snapshot',title:'Study Snapshot',body:'Runs all six tools at once — four analyze this specific passage (Word Study, Language & Structure, Cross-References, and Places & Geography) and two study the entire book (Historical Context and Cultural Context).'},
  {screen:'deep',target:'#outline-collapsible',title:'Passage / Book Outline',body:'Write a structural outline of the passage or book here — your own organization, not AI-generated.'},
  {screen:'deep',target:'#d-conclusions-editor',title:'My Conclusions',body:'This space is entirely yours — no AI involved. Record your own theological conclusions, insights, and application.'},
  {screen:'deep',target:'[onclick*="openExportModal"]',title:'Export Study to PDF',body:'Export the whole study — scripture, notes, outline, resources, conclusions, and any AI tool results — to a shareable PDF.'},
  {screen:'deep',target:'[onclick*="shareStudyLink"]',title:'Share Study Link',body:'You can also share a study as a link — useful for sending a single study to someone without exporting a file.'},
  {screen:'stats',before:function(){tourSeedProgressData();},target:'#stats-grid',title:'Progress',body:"Here’s your full Progress view — current streak, total studies, words written, and AI tools run; your most-studied books as a bar chart; and your seven most recently opened studies. Everything seeded for this tour disappears the moment it ends."}
];

// ── TOUR B — "SETTINGS WALKTHROUGH" ──────────────────────────────────────
var TOUR_B_STEPS=[
  {target:'#settings-sec-sync',title:'Study Sync',body:'Studies sync automatically after every save. Use Restore or Backup here any time to manually pull or push.'},
  {target:'#settings-sec-tts',title:'Text-to-Speech',body:'Pick a voice and adjust the reading speed, then tap Test Voice to preview it.'},
  {target:'#settings-sec-trans',title:'Available Translations',body:'Tap any translation to set it as your default — it will be pre-selected whenever you start a new study or add a passage.'},
  {target:'#settings-sec-about-trans',title:'About Translations',body:'Tap any translation here for full detail — history, translation philosophy, producers, and intended audience — arranged from most literal to most interpretive.'},
  {target:'#settings-sec-tags',title:'Tags',body:'Add, edit, or remove the tags you use to organize studies. Deleting a tag removes it from any existing studies too.'},
  {target:'#settings-sec-share',title:'Share Archē · Pilgrim',body:'Sharing sends the Public version link, not this Private tester build — your tester access is PIN-gated and limited to the approved list only.'},
  {target:'#settings-sec-backup',title:'Manual JSON Backup',body:'Your data syncs automatically, but since Pilgrim is in active beta development we recommend downloading a manual backup every so often — just in case. Tap Download Backup to save a copy to your device any time.'},
  {target:'#settings-sec-changelog',title:'What\u2019s New',body:'The full history of changes to Arch\u0113 \u00b7 Pilgrim, newest first — tap to expand.'},
  {target:'#diag-settings-section',title:'Diagnostics',body:"Connection test buttons for AI tools, text extraction, sync, and the ESV API. The feedback button isn't wired up yet — reach out to Jesse directly with feedback for now."}
];

// ════════════════════════════════════════════════════════

// SECTION 26 — DIAGNOSTICS & FEEDBACK
// Diagnostics test panel, feedback form, diagnostic log, and pill selectors.
// runQuickTest() tests all connected services; initDiagSection() initializes.
// ════════════════════════════════════════════════════════

/**
 * Toggles the changelog section body collapsed/expanded and updates the toggle button label.
 */
function clSectionToggle(){
  _clSectionOpen=!_clSectionOpen;
  var body=document.getElementById('cl-body');
  var btn=document.getElementById('cl-section-btn');
  if(body){body.style.maxHeight=_clSectionOpen?body.scrollHeight+'px':'0';}
  if(btn)btn.textContent=_clSectionOpen?'Hide ⌄':'Show ⌄';
}

/* ── DIAGNOSTICS ── */
var _diagSectionOpen=false;
/**
 * Toggles the diagnostics section body and renders the diagnostic log when opened.
 */
function toggleDiagSection(){
  _diagSectionOpen=!_diagSectionOpen;
  var body=document.getElementById('diag-section-body');
  var btn=document.getElementById('diag-section-btn');
  if(body)body.style.display=_diagSectionOpen?'block':'none';
  if(btn)btn.textContent=_diagSectionOpen?'Hide ⌄':'Show ⌄';
  if(_diagSectionOpen)renderDiagLog();
}
/**
 * Toggles the diagFeedback preference, persists it to settings, and updates the toggle UI.
 */
function toggleDiagFeedback(){
  sett.diagFeedback=!sett.diagFeedback;
  localStorage.setItem(SK_SETT,JSON.stringify(sett));
  updateDiagFeedbackToggleUI();
}
/**
 * Updates the feedback toggle switch visual state and controls submit button visibility.
 */
function updateDiagFeedbackToggleUI(){
  var tog=document.getElementById('diag-feedback-toggle');
  var knob=document.getElementById('diag-feedback-knob');
  var sbtn=document.getElementById('diag-submit-feedback-btn');
  if(tog)tog.style.background=sett.diagFeedback?'var(--gold)':'var(--border)';
  if(knob)knob.style.left=sett.diagFeedback?'21px':'3px';
  if(sbtn)sbtn.style.display=sett.diagFeedback?'':'none';
}
/**
 * Opens the diagnostics modal and resets it to its initial ready state.
 */
function openDiagModal(){
  var overlay=document.getElementById('diag-overlay');
  if(overlay)overlay.style.display='flex';
  document.getElementById('diag-test-list').innerHTML='<div style="font-size:13px;color:var(--txt4);text-align:center;padding:20px 0">Tap <em>Run Tests</em> to begin.</div>';
  document.getElementById('diag-modal-status').textContent='Ready to run';
  document.getElementById('diag-run-btn').disabled=false;
  document.getElementById('diag-run-btn').textContent='Run Tests';
  var fb=document.getElementById('diag-feedback-form');
  if(fb)fb.style.display='none';
  _diagResults=[];
}
/**
 * Closes the diagnostics modal and re-renders the diagnostic log.
 */
function closeDiagModal(){
  var overlay=document.getElementById('diag-overlay');
  if(overlay)overlay.style.display='none';
  renderDiagLog();
}
/**
 * Returns the HTML string for a diagnostics test row in the running/waiting state.
 * @param {string} id - Unique test identifier used for DOM targeting.
 * @param {string} name - Display name of the test.
 * @returns {string} HTML string for the row.
 */
function diagRow(id,name){
  return '<div class="diag-test-row diag-running" id="drow-'+id+'"><div class="diag-icon">&#8987;</div><div><div class="diag-name">'+name+'</div><div class="diag-detail" id="ddetail-'+id+'">Waiting...</div></div></div>';
}
/**
 * Updates a diagnostics row with a new status icon and detail text.
 * @param {string} id - Test identifier matching the row created by diagRow().
 * @param {string} status - Status class: 'pass', 'fail', 'running', or 'skip'.
 * @param {string} detail - Detail message to display below the test name.
 */
function diagUpdate(id,status,detail){
  var row=document.getElementById('drow-'+id);
  var det=document.getElementById('ddetail-'+id);
  if(!row)return;
  row.className='diag-test-row diag-'+status;
  if(det)det.textContent=detail;
  var icon=row.querySelector('.diag-icon');
  // ✓ pass | ✗ fail | ⧖ running | — skip
  if(icon)icon.textContent=status==='pass'?'\u2713':status==='fail'?'\u2717':status==='running'?'\u29d6':'\u2014';
}
/**
 * Runs a quick connectivity test for a single named service and updates the status dot.
 * @param {string} service - The service to test (e.g. 'groq', 'esv', 'gist').
 */
async function runQuickTest(service){
  // Dispatch table: maps service key → label + async test function
  var serviceMap={
    groq:{label:'AI Study Tools',fn:async function(){var r=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:5,messages:[{role:'user',content:'ping'}]})});return{pass:r.ok,detail:r.ok?'Groq responded normally':'HTTP '+r.status};}},
    // TODO: OCR test currently points to /groq (placeholder); should target its own endpoint
    ocr:{label:'Text Extraction',fn:async function(){var r=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:5,messages:[{role:'user',content:'ping'}]})});return{pass:r.ok,detail:r.ok?'Text extraction endpoint responded normally':'HTTP '+r.status};}},
    sync:{label:'Study Sync',fn:async function(){var r=await fetch(WORKER_URL+'/gist?cb='+Date.now()+'&ping=1');return{pass:r.ok||r.status===404||r.status===401,detail:'HTTP '+r.status+(r.ok?' — Sync reachable':'')};}},
    esv:{label:'ESV Bible API',fn:async function(){var r=await fetch(WORKER_URL+'/esv?q=John+1:1&include-headings=false&include-footnotes=false&include-verse-numbers=false');return{pass:r.ok,detail:r.ok?'ESV API responded normally':'HTTP '+r.status};}}
  };
  var s=serviceMap[service];if(!s)return;
  var btn=document.getElementById('qbtn-'+service);
  var dot=document.getElementById('qdot-'+service);
  var res=document.getElementById('qres-'+service);
  if(btn){btn.disabled=true;btn.textContent='...';}
  if(dot)dot.style.background='var(--txt4)';
  if(res){res.style.display='block';res.style.color='var(--txt4)';res.textContent='Testing\u2026';}
  var t0=Date.now();
  try{
    var result=await s.fn();
    var ms=Date.now()-t0;
    var pass=result.pass;
    if(dot)dot.style.background=pass?'var(--sagebright)':'var(--crimsonbright)';
    if(res){res.style.color=pass?'var(--sagebright)':'var(--crimsonbright)';res.textContent=(pass?'\u2713 ':'\u2717 ')+result.detail+' ('+ms+'ms)';}
    if(btn){btn.disabled=false;btn.textContent='Test';}
    // Log to Recent Runs
    var log=loadDiagLog();
    log.unshift({id:'quick-'+Date.now(),ts:new Date().toISOString(),results:[{name:'Quick Test \u2014 '+s.label,status:pass?'pass':'fail',detail:result.detail,ms:ms}],summary:{pass:pass?1:0,fail:pass?0:1}});
    // Cap log at 20 entries to avoid localStorage bloat
    if(log.length>20)log=log.slice(0,20);
    saveDiagLog(log);
    renderDiagLog();
  }catch(e){
    if(dot)dot.style.background='var(--crimsonbright)';
    if(res){res.style.color='var(--crimsonbright)';res.textContent='\u2717 Error: '+e.message;}
    if(btn){btn.disabled=false;btn.textContent='Test';}
  }
}
/**
 * Opens the feedback form section directly without requiring a full diagnostics run.
 */
function openFeedbackDirect(){
  var overlay=document.getElementById('diag-overlay');
  if(overlay)overlay.style.display='flex';
  document.getElementById('diag-test-list').innerHTML='<div style="font-size:13px;color:var(--txt4);text-align:center;padding:20px 0">Tap <em>Run Tests</em> to run a full diagnostic.</div>';
  document.getElementById('diag-modal-status').textContent='Feedback mode';
  document.getElementById('diag-run-btn').disabled=false;
  document.getElementById('diag-run-btn').textContent='Run Tests';
  _diagResults=[];
  var fb=document.getElementById('diag-feedback-form');
  if(fb){fb.style.display='block';}
  diagFbReset();
}
/**
 * Runs the full diagnostics suite, tests all services, saves results to the log,
 * and enables the feedback form for submission.
 */
async function runDiagnostics(){
  var btn=document.getElementById('diag-run-btn');
  if(btn){btn.disabled=true;btn.textContent='Running...';}
  document.getElementById('diag-modal-status').textContent='Running tests\u2026';
  var tests=[
    {id:'worker',name:'Worker Reachability'},
    {id:'groq',name:'Groq AI'},
    {id:'esv',name:'ESV Bible API'},
    {id:'gist_pull',name:'Gist Pull'},
    {id:'gist_push',name:'Gist Diagnostic Push'},
    {id:'gist_verify',name:'Gist Diagnostic Verify'},
    {id:'tts',name:'Text-to-Speech'},
    {id:'network',name:'Network Status'}
  ];
  document.getElementById('diag-test-list').innerHTML=tests.map(function(t){return diagRow(t.id,t.name);}).join('');
  _diagResults=[];
  // runId written to Gist and read back in gist_verify to confirm round-trip integrity
  var runId='diag-'+Date.now();
  var allPass=true;
  /**
   * Runs a single named diagnostic test, records timing and pass/fail status, and updates the UI row.
   * @param {string} id - DOM id of the diagnostic row to update.
   * @param {Function} fn - Async test function; must return {pass:boolean, detail:string}.
   */
  async function runTest(id,fn){
    diagUpdate(id,'running','Testing\u2026');
    var t0=Date.now();
    try{
      var result=await fn();
      var ms=Date.now()-t0;
      diagUpdate(id,result.pass?'pass':'fail',result.detail+(result.pass?' ('+ms+'ms)':''));
      _diagResults.push({name:tests.find(function(t){return t.id===id;}).name,status:result.pass?'pass':'fail',detail:result.detail,ms:ms});
      if(!result.pass)allPass=false;
    }catch(e){
      diagUpdate(id,'fail','Error: '+e.message);
      _diagResults.push({name:tests.find(function(t){return t.id===id;}).name,status:'fail',detail:'Error: '+e.message,ms:Date.now()-t0});
      allPass=false;
    }
  }
  await runTest('network',async function(){
    var on=navigator.onLine;
    return {pass:on,detail:on?'Online':'Offline — no network connection'};
  });
  await runTest('worker',async function(){
    var r=await fetch(WORKER_URL+'/gist?cb='+Date.now()+'&ping=1');
    return {pass:r.ok||r.status===404||r.status===401,detail:'HTTP '+r.status};
  });
  await runTest('groq',async function(){
    var r=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:5,messages:[{role:'user',content:'ping'}]})});
    return {pass:r.ok,detail:r.ok?'Groq responded normally':'HTTP '+r.status};
  });
  await runTest('esv',async function(){
    var r=await fetch(WORKER_URL+'/esv?q=John+1:1&include-headings=false&include-footnotes=false&include-verse-numbers=false');
    return {pass:r.ok,detail:r.ok?'ESV API responded normally':'HTTP '+r.status};
  });
  var diagTs=Date.now();
  await runTest('gist_pull',async function(){
    var r=await fetch(WORKER_URL+'/gist?cb='+Date.now());
    if(!r.ok)return{pass:false,detail:'HTTP '+r.status};
    var meta=await r.json();
    return{pass:true,detail:'Gist metadata fetched — '+(Object.keys(meta.files||{}).length)+' file(s)'};
  });
  await runTest('gist_push',async function(){
    var payload=JSON.stringify({diagnostic:true,ts:diagTs,id:runId});
    var body={description:'Arché Diagnostic',public:false,files:{'arche-pilgrim-diagnostic.json':{content:payload}}};
    var r=await fetch(WORKER_URL+'/gist',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return{pass:r.ok,detail:r.ok?'Diagnostic file written to Gist':'HTTP '+r.status};
  });
  await runTest('gist_verify',async function(){
    // 1.2s settle: Gist CDN propagation can lag behind the write
    await new Promise(function(res){setTimeout(res,1200);});
    var metaR=await fetch(WORKER_URL+'/gist?cb='+Date.now());
    if(!metaR.ok)return{pass:false,detail:'Could not fetch Gist metadata'};
    var meta=await metaR.json();
    var file=meta.files&&meta.files['arche-pilgrim-diagnostic.json'];
    if(!file||!file.raw_url)return{pass:false,detail:'Diagnostic file not found in Gist'};
    var rawR=await fetch(WORKER_URL+'/gist-raw?url='+encodeURIComponent(file.raw_url));
    if(!rawR.ok)return{pass:false,detail:'Could not fetch diagnostic file content'};
    var data=await rawR.json();
    var match=data.id===runId;
    return{pass:match,detail:match?'Push verified — data round-tripped correctly':'ID mismatch — data may be stale'};
  });
  await runTest('tts',async function(){
    var avail=!!(window.speechSynthesis);
    if(!avail)return{pass:false,detail:'speechSynthesis not available on this device'};
    var voices=window.speechSynthesis.getVoices();
    return{pass:true,detail:'Available — '+voices.length+' voice(s) loaded'};
  });
  var passCount=_diagResults.filter(function(r){return r.status==='pass';}).length;
  var failCount=_diagResults.filter(function(r){return r.status==='fail';}).length;
  var summary=passCount+' passed, '+failCount+' failed';
  document.getElementById('diag-modal-status').textContent='Complete — '+summary;
  if(btn){btn.disabled=false;btn.textContent='Run Again';}
  // Save to log
  var log=loadDiagLog();
  log.unshift({id:runId,ts:new Date().toISOString(),results:_diagResults,summary:{pass:passCount,fail:failCount}});
  // Cap log at 20 entries
  if(log.length>20)log=log.slice(0,20);
  saveDiagLog(log);
  // Show feedback form if enabled
  var fb=document.getElementById('diag-feedback-form');
  if(fb)fb.style.display=sett.diagFeedback?'block':'none';
  if(sett.diagFeedback){diagFbReset();}
}
/**
 * Loads the diagnostic history log from localStorage.
 * @returns {Array} Array of diagnostic log entry objects.
 */
function loadDiagLog(){try{return JSON.parse(localStorage.getItem(SK_DIAG)||'[]');}catch(e){return [];}}
/**
 * Saves the diagnostic log array to localStorage.
 * @param {Array} log - The full log array to persist.
 */
function saveDiagLog(log){localStorage.setItem(SK_DIAG,JSON.stringify(log));}
/**
 * Renders the diagnostic history log into the diagnostics panel.
 * Shows the most recent entries first with toggle support.
 */
function renderDiagLog(){
  var el=document.getElementById('diag-log-list');if(!el)return;
  var log=loadDiagLog();
  if(!log.length){el.innerHTML='<div style="font-size:12px;color:var(--txt4)">No diagnostics run yet.</div>';return;}
  el.innerHTML=log.map(function(entry,i){
    var d=new Date(entry.ts);
    var dateStr=d.toLocaleDateString()+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    var allPass=entry.summary.fail===0;
    var badge=allPass?'<span class="diag-log-badge diag-log-pass">'+entry.summary.pass+' passed</span>':'<span class="diag-log-badge diag-log-fail">'+entry.summary.fail+' failed</span>';
    var detail=entry.results.map(function(r){
      var icon=r.status==='pass'?'\u2713':'\u2717';
      var col=r.status==='pass'?'var(--sagebright)':'var(--crimsonbright)';
      return '<div style="display:flex;gap:8px;font-size:11px;padding:3px 0"><span style="color:'+col+';flex-shrink:0">'+icon+'</span><span style="color:var(--txt2);flex:1">'+r.name+'</span><span style="color:var(--txt4)">'+r.ms+'ms</span></div>';
    }).join('');
    return '<div class="diag-log-entry" onclick="diagToggleEntry(this,\''+i+'\')"><div class="diag-log-hdr"><span class="diag-log-ts">'+dateStr+'</span>'+badge+'</div><div class="diag-log-detail" id="diag-log-det-'+i+'">'+detail+'</div></div>';
  }).join('');
}
/**
 * Toggles a diagnostic log entry open or closed.
 * @param {HTMLElement} el - The toggle trigger element.
 * @param {number} i - The index of the log entry to toggle.
 */
function diagToggleEntry(el,i){
  var det=document.getElementById('diag-log-det-'+i);
  if(det)det.classList.toggle('open');
}
/**
 * Selects a feedback pill in the given group and deselects all others in that group.
 * @param {string} groupId - The pill group container element ID.
 * @param {HTMLElement} btn - The pill button that was clicked.
 */
function diagPillSelect(groupId,btn){
  var group=document.getElementById(groupId);
  if(!group)return;
  // Deselect all sibling pills before activating the clicked one
  group.querySelectorAll('.diag-pill').forEach(function(p){p.classList.remove('active');});
  btn.classList.add('active');
  // Clear error state on parent group
  var grpEl=group.closest('.diag-fb-group');
  if(grpEl)grpEl.classList.remove('error');
}
/**
 * Returns the currently selected pill value for the given feedback group.
 * @param {string} groupId - The pill group container element ID.
 * @returns {string|null} The data-value of the selected pill, or null if none selected.
 */
function diagGetPill(groupId){
  var group=document.getElementById(groupId);
  if(!group)return'';
  var active=group.querySelector('.diag-pill.active');
  return active?active.textContent:'';
}
/**
 * Clears the error highlight on the description field when the user starts typing.
 */
function diagFbInput(){
  var ta=document.getElementById('diag-fb-text');
  var counter=document.getElementById('diag-fb-counter');
  var extended=document.getElementById('diag-fb-extended').checked;
  if(counter&&!extended)counter.textContent=ta.value.length.toLocaleString()+' / 2,000';
  var grp=document.getElementById('fbg-desc');
  if(grp&&ta.value.trim())grp.classList.remove('error');
}
/**
 * Toggles the extended description checkbox and updates the description field placeholder.
 */
function diagFbToggleExtended(){
  var ext=document.getElementById('diag-fb-extended').checked;
  var ta=document.getElementById('diag-fb-text');
  var counter=document.getElementById('diag-fb-counter');
  if(ext){ta.maxLength=999999;if(counter)counter.textContent='';}
  else{ta.maxLength=2000;if(ta.value.length>2000)ta.value=ta.value.slice(0,2000);if(counter)counter.textContent=ta.value.length+' / 2,000';}
}
var _fbImages=[];
/**
 * Triggers the image picker input for attaching screenshots to feedback (max 3 images).
 */
function diagFbPickImage(){
  if(_fbImages.length>=3)return;
  // Create a temporary hidden file input, trigger it, and clean up after selection
  var tmp=document.createElement('input');
  tmp.type='file';
  tmp.accept='image/*';
  tmp.style.display='none';
  tmp.onchange=function(){
    if(tmp.files&&tmp.files.length){
      // Push files into _fbImages up to the 3-image cap
      Array.from(tmp.files).forEach(function(f){
        if(_fbImages.length<3)_fbImages.push(f);
      });
      diagFbRenderThumbs();
    }
    // Remove the temporary input immediately — it has served its purpose
    document.body.removeChild(tmp);
  };
  document.body.appendChild(tmp);
  tmp.click();
}
/**
 * Renders thumbnail previews for all currently attached feedback images.
 */
function diagFbRenderThumbs(){
  var thumbsEl=document.getElementById('diag-fb-thumbs');
  var label=document.getElementById('diag-fb-img-label');
  if(!thumbsEl)return;
  if(!_fbImages.length){thumbsEl.innerHTML='';thumbsEl.style.display='none';if(label)label.style.display='flex';return;}
  thumbsEl.innerHTML='';
  thumbsEl.style.display='flex';
  _fbImages.forEach(function(f,i){
    // Object URL is revoked implicitly when the wrap div is garbage collected
    var url=URL.createObjectURL(f);
    var wrap=document.createElement('div');
    wrap.style.cssText='position:relative;width:70px;height:70px;border-radius:6px;overflow:hidden;border:1px solid var(--borderlit)';
    var img=document.createElement('img');
    img.src=url;img.style.cssText='width:100%;height:100%;object-fit:cover';
    var rm=document.createElement('button');
    rm.textContent='\u00d7';
    rm.style.cssText='position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:none;font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0';
    rm.onclick=function(){diagFbRemoveImage(i);};
    wrap.appendChild(img);wrap.appendChild(rm);
    thumbsEl.appendChild(wrap);
  });
  if(label)label.style.display=_fbImages.length<3?'flex':'none';
}
/**
 * Removes the image at the given index from the feedback attachment list and re-renders thumbnails.
 * @param {number} idx - Index of the image to remove from _fbImages.
 */
function diagFbRemoveImage(idx){
  _fbImages.splice(idx,1);
  diagFbRenderThumbs();
}
/**
 * Resets the feedback form: clears all pill selections, text fields, images, and error states.
 */
function diagFbReset(){
  ['fb-device','fb-os','fb-browser','fb-category','fb-when','fb-freq'].forEach(function(id){
    var g=document.getElementById(id);
    if(g)g.querySelectorAll('.diag-pill').forEach(function(p){p.classList.remove('active');});
  });
  ['fbg-device','fbg-os','fbg-browser','fbg-category','fbg-desc'].forEach(function(id){
    var g=document.getElementById(id);
    if(g)g.classList.remove('error');
  });
  document.getElementById('diag-fb-text').value='';
  document.getElementById('diag-fb-counter').textContent='0 / 2,000';
  document.getElementById('diag-fb-extended').checked=false;
  _fbImages=[];
  diagFbRenderThumbs();
  document.getElementById('diag-send-status').textContent='';
  document.getElementById('diag-fb-text').maxLength=2000;
}
/**
 * Validates and submits the feedback form to the Discord webhook.
 * Attaches a diagnostic JSON file, optional extended description, and up to 3 screenshots.
 */
async function submitFeedback(){
  var btn=document.getElementById('diag-send-btn');
  var statusEl=document.getElementById('diag-send-status');
  // Validate required fields
  var device=diagGetPill('fb-device');
  var os=diagGetPill('fb-os');
  var browser=diagGetPill('fb-browser');
  var category=diagGetPill('fb-category');
  var desc=document.getElementById('diag-fb-text').value.trim();
  var valid=true;
  if(!device){document.getElementById('fbg-device').classList.add('error');valid=false;}
  if(!os){document.getElementById('fbg-os').classList.add('error');valid=false;}
  if(!browser){document.getElementById('fbg-browser').classList.add('error');valid=false;}
  if(!category){document.getElementById('fbg-category').classList.add('error');valid=false;}
  if(!desc){document.getElementById('fbg-desc').classList.add('error');valid=false;}
  if(!valid){statusEl.style.color='var(--crimsonbright)';statusEl.textContent='Please complete all required fields.';return;}
  if(DISCORD_WEBHOOK_URL==='YOUR_DISCORD_WEBHOOK_URL_HERE'){statusEl.style.color='var(--crimsonbright)';statusEl.textContent='Discord webhook not configured.';return;}
  var extended=document.getElementById('diag-fb-extended').checked;
  var imageFiles=_fbImages.slice(0,3);
  btn.disabled=true;
  statusEl.style.color='var(--txt3)';
  statusEl.textContent='Sending\u2026';
  try{
    var passCount=_diagResults.filter(function(r){return r.status==='pass';}).length;
    var failCount=_diagResults.filter(function(r){return r.status==='fail';}).length;
    var appVersion=window.CHANGELOG&&window.CHANGELOG[0]?window.CHANGELOG[0].version:'unknown';
    // Try to get version from CHANGELOG var
    try{appVersion=CHANGELOG[0].version;}catch(e){}
    var systemInfo={
      appVersion:appVersion,
      device:device,os:os,browser:browser,
      userAgent:navigator.userAgent,
      screen:window.innerWidth+'x'+window.innerHeight,
      pixelRatio:window.devicePixelRatio||1,
      online:navigator.onLine,
      language:navigator.language,
      ts:new Date().toISOString()
    };
    var diagJson=JSON.stringify({
      systemInfo:systemInfo,
      category:category,
      when:diagGetPill('fb-when')||'not specified',
      frequency:diagGetPill('fb-freq')||'not specified',
      diagnosticSummary:{pass:passCount,fail:failCount},
      diagnosticResults:_diagResults
    },null,2);
    var msgContent='**\ud83d\udd0d Pilgrim Feedback — v'+systemInfo.appVersion+'**\n'+
      '**'+new Date().toLocaleString()+'**\n'+
      '**Device:** '+device+' · '+os+' · '+browser+'\n'+
      '**Category:** '+category+'\n'+
      '**Diagnostics:** '+passCount+' passed, '+failCount+' failed'+
      (extended?'\n**Description:** *(see attachment)*':'\n**Description:** '+desc);
    var form=new FormData();
    form.append('payload_json',JSON.stringify({content:msgContent}));
    form.append('files[0]',new Blob([diagJson],{type:'application/json'}),'diagnostic-'+Date.now()+'.json');
    var fileIdx=1;
    // Extended mode: send long description as a .txt attachment rather than inline message
    if(extended)form.append('files['+(fileIdx++)+']',new Blob([desc],{type:'text/plain'}),'description-'+Date.now()+'.txt');
    imageFiles.forEach(function(f,i){form.append('files['+(fileIdx++)+']',f,'screenshot-'+(i+1)+'-'+Date.now()+'.'+f.name.split('.').pop());});
    var r=await fetch(DISCORD_WEBHOOK_URL,{method:'POST',body:form});
    // Discord webhooks return 204 No Content on success
    if(r.ok||r.status===204){statusEl.style.color='var(--sagebright)';statusEl.textContent='\u2713 Feedback sent!';}
    else{throw new Error('HTTP '+r.status);}
  }catch(e){statusEl.style.color='var(--crimsonbright)';statusEl.textContent='Failed: '+e.message;}
  finally{btn.disabled=false;}
}
/* show feedback toggle row only in private (diagFeedback toggle exists) */
/**
 * Initializes the diagnostics section UI: shows the feedback toggle row and syncs its state.
 */
function initDiagSection(){
  var row=document.getElementById('diag-feedback-toggle-row');
  if(row)row.style.display='block';
  updateDiagFeedbackToggleUI();
}
/**
 * Renders the CHANGELOG array into the changelog list in the settings panel.
 * Respects per-entry open/closed state from the _clOpen map.
 */
function renderChangelog(){
  var el=document.getElementById('changelog-list');if(!el)return;
  el.innerHTML=CHANGELOG.map(function(v,i){
    // Default to closed; _clOpen tracks which entries the user has manually toggled
    var isOpen=_clOpen.hasOwnProperty(i)?_clOpen[i]:false;
    return '<div class="cl-version">'+
      '<div class="cl-version-hdr" onclick="clToggle('+i+')">'+
        '<span class="cl-version-num">v'+v.version+'</span>'+
        '<span class="cl-version-date">'+v.date+'</span>'+
        (v.label?'<span class="cl-version-badge">'+v.label+'</span>':'')+
        '<span class="cl-chev'+(isOpen?' open':'')+'">&#8964;</span>'+
      '</div>'+
      '<div class="cl-items'+(isOpen?' open':'')+'">'+
        v.items.map(function(item){return '<div class="cl-item">'+escHtml(item)+'</div>';}).join('')+
      '</div>'+
    '</div>';
  }).join('');
  // Sync the section body max-height after render so CSS transition plays correctly
  var body=document.getElementById('cl-body');
  if(body){body.style.maxHeight=_clSectionOpen?body.scrollHeight+'px':'0';}
}
/**
 * Toggles a single changelog version entry open or closed and re-renders the list.
 * @param {number} i - Index of the changelog entry in the CHANGELOG array.
 */
function clToggle(i){
  _clOpen[i]=!(_clOpen.hasOwnProperty(i)?_clOpen[i]:false);
  renderChangelog();
}


// ════════════════════════════════════════════════════════

// SECTION 27 — PIN AUTH & MULTI-USER NAMESPACE
// 4-digit PIN gate, validated against PILGRIM_USERS KV via /auth/pin.
// activateUser() re-namespaces all SK_* storage keys per user so every
// existing localStorage call elsewhere in the file needs zero changes.
// ════════════════════════════════════════════════════════

/**
 * One-time legacy-data migration helper. If the per-user namespaced key has never
 * been written yet but a pre-v4.10.0 (un-suffixed) legacy key holds data, copies the
 * legacy value into the namespaced key. Non-destructive — the legacy key is left in
 * place untouched. No-ops for new testers who never had pre-namespace data, since
 * their legacy keys never existed in the first place.
 * @param {string} legacyKey - The original, pre-namespacing storage key.
 * @param {string} namespacedKey - The per-user namespaced key to migrate into.
 */

function initPinGate(){
  var cached=localStorage.getItem('bsn_active_user');
  if(cached){
    activateUser(cached);
    window.startPilgrim();
  }else{
    var ov=document.getElementById('pin-gate-overlay');
    if(ov)ov.classList.add('on');
  }
}
/**
 * Validates the entered PIN against the Worker's /auth/pin route. On success, caches
 * the returned userId, activates that user's namespace, hides the gate, and boots
 * the app. On failure, shows an inline error and lets the user retry.
 */
async function submitPin(){
  var input=document.getElementById('pin-input');
  var pin=((input&&input.value)||'').trim();
  var errEl=document.getElementById('pin-error');
  if(errEl)errEl.textContent='';
  if(pin.length!==4){if(errEl)errEl.textContent='Enter a 4-digit PIN';return;}
  var btn=document.getElementById('pin-submit-btn');
  if(btn)btn.disabled=true;
  try{
    var res=await fetch(WORKER_URL+'/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin})});
    var data=await res.json();
    if(!res.ok||!data.userId){
      if(errEl)errEl.textContent='Incorrect PIN — try again';
      if(input){input.value='';input.focus();}
      return;
    }
    localStorage.setItem('bsn_active_user',data.userId);
    activateUser(data.userId);
    var ov=document.getElementById('pin-gate-overlay');
    if(ov)ov.classList.remove('on');
    window.startPilgrim();
  }catch(e){
    if(errEl)errEl.textContent='Connection error — check your internet and try again';
  }finally{
    if(btn)btn.disabled=false;
  }
}
/**
 * Logs out the active user — clears the cached session flag and reloads the page so
 * initPinGate() shows the PIN gate fresh on next load.
 */
function switchUser(){
  localStorage.removeItem('bsn_active_user');
  location.reload();
}

// ════════════════════════════════════════════════════════

// SECTION 28 — APP STARTUP
// Boots the app after PIN auth succeeds: initializes studies, tags, settings,
// editors, and listeners. resize and orientationchange listeners also live here.
// ════════════════════════════════════════════════════════

/**
 * Boots the app proper. Only ever called after a user is authenticated — either from
 * a cached session (initPinGate) or a fresh PIN entry (submitPin). Body is identical
 * to the original unconditional window.load handler; it's just deferred now.
 */

// WORD COUNT & FONT SIZE
var notesFontLarge=false;
/**
 * Updates the word count display in the field notes header using the current Quill editor content.
 */
function updateWordCount(){
  var el=document.getElementById('notes-wc');if(!el)return;
  // getText().trim() strips trailing newline Quill always appends; split filters empty tokens
  var text=_qFN?_qFN.getText().trim():'';
  var words=text?text.split(/\s+/).filter(function(w){return w.length>0;}):[]; 
  el.textContent=words.length+' words';
}
/**
 * Toggles the field notes editor between normal and large font size.
 * Updates the toggle button label and color to reflect the current state.
 */
function toggleNotesFontSize(){
  notesFontLarge=!notesFontLarge;
  var editor=_qFN&&_qFN.root;var btn=document.getElementById('notes-font-btn');
  if(editor){if(notesFontLarge)editor.classList.add('notes-font-lg');else editor.classList.remove('notes-font-lg');}
  // A- = currently large (tap to shrink), A+ = currently normal (tap to grow)
  if(btn){btn.textContent=notesFontLarge?'A-':'A+';btn.style.color=notesFontLarge?'var(--gold)':'var(--txt3)';}
}

// ── UPDATE AVAILABLE BANNER ────────────────────────────────────────────
// Cache-busted re-fetch of this same index.html to detect a newer deployed
// version. Checked on app boot (startPilgrim) and tab-focus-regain (listener
// above). Replaces the old standalone APP_VER constant in Section 30 as the
// single source of truth for "what version is actually live."
/**
 * Re-fetches index.html with a cache-busting query param, extracts the first
 * CHANGELOG entry's version string via regex (cheaper and safer than eval'ing
 * the fetched HTML), and compares it to the version running in memory. Shows
 * the update banner if a newer version is live and the user hasn't already
 * skipped that exact version. Fails silently on network errors (e.g. offline)
 * — no banner, no error shown to the user.
 */
function checkForUpdate(){
  fetch('./index.html?t='+Date.now(),{cache:'no-store'})
    .then(function(r){return r.text();})
    .then(function(html){
      var m=html.match(/CHANGELOG\s*=\s*\[\s*\{\s*version\s*:\s*'([^']+)'/);
      if(!m)return;
      var latest=m[1];
      var current=(window.CHANGELOG&&CHANGELOG[0])?CHANGELOG[0].version:'';
      if(latest===current)return; // already on the latest version
      if(localStorage.getItem(SK_UPDATE_SKIP)===latest)return; // user already skipped this exact version
      _pendingUpdateVersion=latest;
      var b=document.getElementById('update-banner');
      if(b)b.classList.add('on');
    })
    .catch(function(){/* offline or fetch failed — fail silently, never block the app */});
}
/**
 * "Refresh Now" handler — reloads the page to load the newer version detected
 * by checkForUpdate().
 */
function refreshForUpdate(){window.location.reload();}
/**
 * "Skip" handler — dismisses the banner for the specific version that was
 * detected. Stored un-namespaced (device-level, not per-user) since this is
 * browser cache state, not study data. The banner reappears automatically the
 * moment a genuinely newer version ships, since the comparison is always
 * against the latest fetched version, not "any skip ever."
 */
function dismissUpdateBanner(){
  if(_pendingUpdateVersion)localStorage.setItem(SK_UPDATE_SKIP,_pendingUpdateVersion);
  var b=document.getElementById('update-banner');
  if(b)b.classList.remove('on');
}

// ════════════════════════════════════════════════════════

// ── Export block ────────────────────────────────────────────────────────────
export {
  // S05 — Editor Setup: Quill instances + dirty flags (read by storage.js, tts.js via window.*)
  _qFN, _qConcl, _qOutline,
  _qFNDirty, _qConclDirty, _qOutlineDirty,
  initEditors,
  // S06 — Navigation
  navTo, saveAndGoLib, goField, newStudy, createFromTemplate,
  // S09 — Library
  renderLib, setTagFilter, setLibSort,
  // S10 — Field Notes Panel
  populateField, renderTagPicker, toggleTag, toggleHeader, toggleScripture, updateBarRefLabel,
  // S17 — Tags
  loadTags, persistTags, loadDeletedTags, persistDeletedTags,
  DELETED_TAGS, setDeletedTags, mergeDeletedTags, applyTagTombstones, tagById,
  renderTagManager, openNewTagModal, openEditTagModal,
  renderColorSwatches, selectSwatch, getSelectedSwatchColor, hexToRgba,
  repairTagColor, saveTag, deleteTag, confirmDeleteTag,
  // S18 — Export / PDF
  openExportModal, expToggle, expSelectAll, expSelectAllTools, expIsOn,
  deleteAIResult, runExport, exportPDF, initSwipe,
  // S19 — Backup & Import
  importDataPrompt, importDataFromFile, openVerseModal,
  // S20 — Share & Deep Links
  shareApp, shareStudyLink, shareStudyLinkById,
  copyLinkFromModal, promptCopyFallback, checkImportHash, confirmImportLink,
  fetchAllMissingScripture, clearAll, confirmClearAll,
  // S21 — Settings
  loadSett, setScrMode, setDefaultTrans, updateDefaultTransUI, updateScrModeUI,
  saveSettings,
  // S23 — Book Picker
  bpOpen, bpClose, bpSetTestament, bpPickBook, bpPickChapter, bpUpdatePreview,
  bpConfirm, bpBack, bpGoStage,
  // S24 — Onboarding
  openExportBackupModal, updateExportSelCount, toggleExportSelectAll, confirmExport,
  exportData, checkTabHints, dismissTabHints, checkOnboarding, renderObStep,
  obNext, showTourOffer, skipOnboarding, trackOpen, renderStats,
  // S25 — Guided Tours
  startTour, tourNext, tourBack, tourJump, skipTour, endTour,
  tourOffsetDate, tourSaveDemoWord, tourSeedProgressData, tourCleanupDemoData,
  TOUR_A_STEPS, TOUR_B_STEPS,
  // S26 — Diagnostics & Feedback
  _clOpen, _clSectionOpen, clSectionToggle, toggleDiagSection, toggleDiagFeedback,
  updateDiagFeedbackToggleUI, openDiagModal, closeDiagModal,
  runQuickTest, openFeedbackDirect, runDiagnostics,
  loadDiagLog, saveDiagLog, renderDiagLog, diagToggleEntry,
  diagPillSelect, diagGetPill, diagFbInput, diagFbToggleExtended,
  diagFbPickImage, diagFbRenderThumbs, diagFbRemoveImage, diagFbReset,
  submitFeedback, initDiagSection, renderChangelog, clToggle,
  // S27-partial — PIN Auth UI
  initPinGate, submitPin, switchUser,
  // S28-partial — Startup helpers
  updateWordCount, toggleNotesFontSize, checkForUpdate,
  refreshForUpdate, dismissUpdateBanner,
};
