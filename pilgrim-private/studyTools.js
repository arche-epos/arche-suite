// studyTools.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 4
// Sections: 11 (Bible API), 12 (Study Tools Panel), 13 (Study Snapshot),
//           14-partial (expand/copy/share — spec boundary), 15 (Lexicon), 16 (Resources)
// See pilgrim-es-modules-plan-v1.md for full module map

import {
  WORKER_URL,
  BOLLS_TRANS, BOLLS_BOOKS, parseRef,
  SK_WORDS, SK_TAGS, SK_TTS_SETT, SK_SETT,
  TAGS, ACTIVE_USER, TOOL_LABELS,
  cur, studies, sett, activeRef,
  online, studyScope, setStudyScope,
  closeOverlay, escHtml, mdToHtml, htmlToText,
  toast, toastSuccess
} from './utils.js';

import { saveStudy, persist, syncFromInputs } from './storage.js';
import { syncToGist } from './sync.js';
import { _ttsActive, _ttsSource, ttsStop } from './tts.js';

// ── Cross-module accessors (window.* during extraction phase) ───────────────
// These live in ui.js. Replaced with direct imports in Session 5.
/** Re-renders the reference pill tab bar inside a given container. */
function _renderRefPills(cId,mode){ if(window.renderRefPills)window.renderRefPills(cId,mode); }
/** Updates the reference label in the top bar. */
function _updateBarRefLabel(){ if(window.updateBarRefLabel)window.updateBarRefLabel(); }
/** Recalculates and displays Field Notes word count. */
function _updateWordCount(){ if(window.updateWordCount)window.updateWordCount(); }

// DOMPurify loaded via CDN — accessible as window.DOMPurify (no import needed)

// ── studyTools state ────────────────────────────────────────────────────────
// S12 — panel toggle state
export var _fnotesOpen  = false;
// _renameResId: local to studyTools — tracks pending resource rename (resEditTitle/confirmRenameRes)
var _renameResId = null;
export var _outlineOpen = false;
export var _deepScrOpen = false;
// S13 — AI panel state
export var aiPanelResults = {};
export var aiActiveTab    = null;
var _snapshotRunning = false;
var _snapshotCancelled = false;
var _snapshotAbortController = null;
// S14-partial
var _expandRunning = false;
// S15 — Lexicon / Word List state
var libTab = 'studies';
var _lexLastResult  = null;
var _lexSaveContext = null;
var _wlCache = [];
var _swCache = [];
// S16 — Resource methods lookup (populated at bottom of section)
var RES_METHODS;

// Setters for cross-module writes
export function setAiPanelResults(obj){ aiPanelResults=obj; }
export function setAiActiveTab(k){ aiActiveTab=k; }

// SECTION 11 — BIBLE API
// Scripture fetching from ESV API, bolls.life, and bible-api.com.
// fetchScr() is the entry point; renderScrText() renders the verse output.
// ════════════════════════════════════════════════════════

/**
 * Main entry point for loading scripture into the Field Notes panel.
 * Reads the f-ref and f-trans inputs, validates the reference, then fetches from
 * the appropriate API (ESV worker, bolls.life, or bible-api.com). Renders the result
 * or shows paste fallback on error. No-op in paste-mode (delegates to openPasteModal).
 */
async function fetchScr(){
  var ar=activeRef();
  var ref=document.getElementById('f-ref').value.trim(),trans=document.getElementById('f-trans').value;
  if(!ref)return;
  // Require at least "Book Chapter" (a digit after a space) before attempting fetch
  // Prevents mobile keyboard blur mid-typing from triggering "Could not load passage"
  if(!/\s\d/.test(ref))return;
  if(ar){ar.reference=ref;ar.translation=trans;}
  _updateBarRefLabel();
  if(sett.scrMode==='paste'){openPasteModal();return;}
  var disp=document.getElementById('scrdisplay');
  disp.innerHTML='<div style="display:flex;align-items:center;gap:10px;color:var(--txt3);font-style:italic;font-size:14px;padding:8px 0"><div class="spin"></div>Loading...</div>';
  if(!online){disp.innerHTML='<div style="text-align:center;padding:16px"><p style="color:var(--txt3);font-style:italic;font-size:13px;margin-bottom:12px">Offline - paste scripture manually</p><button class="btn btn-sec btn-sm" onclick="openPasteModal()">Paste Scripture</button></div>';return;}
  try{
    var text=trans==='esv'?await getESV(ref):await getBibleAPI(ref,trans);
    if(!text)throw new Error('Empty response');
    if(ar)ar.scriptureText=text;
    renderScrText(text,trans);document.getElementById('scracts').style.display='flex';
  }catch(e){disp.innerHTML='<div style="padding:10px"><p style="color:var(--crimsonbright);font-size:13px;margin-bottom:10px">Could not load passage.</p><button class="btn btn-sec btn-sm" onclick="openPasteModal()">Paste Scripture</button></div>';}
}
/**
 * Fetches a passage from the ESV API via the arche-proxy Cloudflare Worker.
 * Requests plain text without headings, footnotes, or copyright lines.
 * @param {string} ref - A Bible reference string (e.g. "Romans 8:1-4").
 * @returns {Promise<string>} The passage text, or empty string if not found.
 */
async function getESV(ref){
  var p=new URLSearchParams({q:ref,'include-headings':'false','include-footnotes':'false','include-verse-numbers':'true','include-short-copyright':'false','include-passage-references':'false'});
  var r=await fetch(WORKER_URL+'/esv?'+p);
  if(!r.ok)throw new Error('ESV '+r.status);
  var d=await r.json();return d.passages?d.passages.join('\n\n'):'';
}
/**
 * Fetches a passage from api.bible via the arche-proxy Cloudflare Worker.
 * @param {string} ref - A Bible reference string.
 * @param {string} bibleId - The api.bible Bible ID for the desired translation.
 * @returns {Promise<string>} The passage text.
 */
async function getApiBible(ref,bibleId){
  var r=await fetch(WORKER_URL+'/bible',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:ref,bibleId:bibleId})});
  if(!r.ok)throw new Error('api.bible '+r.status);
  var d=await r.json();return d.text||'';
}
/**
 * Fetches a passage from the bolls.life API (no key required).
 * Parses the reference to extract book, chapter, and verse range or discrete list.
 * Supports comma-separated verse lists (e.g. "1 Cor 10:6,11") in addition to ranges.
 * bolls.life always returns the full chapter; results are filtered client-side.
 * @param {string} ref - A Bible reference string.
 * @param {string} trans - bolls.life translation code (e.g. "NASB").
 * @returns {Promise<string>} Verse-numbered passage text.
 */
async function getBollsBible(ref,trans){
  var p=parseRef(ref);
  if(!p)throw new Error('Could not parse reference: '+ref);
  var url='https://bolls.life/get-text/'+trans+'/'+p.book+'/'+p.chapter+'/';
  var r=await fetch(url);
  if(!r.ok)throw new Error('Bolls '+r.status);
  var verses=await r.json();
  // Comma-separated discrete verse list (e.g. "10:6,11") — parseRef only captures the first
  var commaMatch=ref.match(/:(\d+(?:,\d+)+)$/);
  if(commaMatch){
    var listed=commaMatch[1].split(',').map(Number);
    // Filter to exactly the listed verse numbers, preserving the listed order
    verses=verses.filter(function(v){return listed.indexOf(v.verse)>=0;});
    verses.sort(function(a,b){return listed.indexOf(a.verse)-listed.indexOf(b.verse);});
  } else if(p.startVerse){
    var end=p.endVerse||p.startVerse; // Single verse: end = start; range: end = parsed endVerse
    // bolls.life returns the full chapter — filter down to the requested verse range
    verses=verses.filter(function(v){return v.verse>=p.startVerse&&v.verse<=end;});
  }
  return verses.map(function(v){return '['+v.verse+'] '+v.text.replace(/<[^>]+>/g,'').trim();}).join(' ');
}
/**
 * Routes a scripture fetch to the correct backend based on translation.
 * Bolls.life translations (in BOLLS_TRANS map) go to getBollsBible();
 * all others go to bible-api.com directly.
 * Supports comma-separated verse lists for all backends (e.g. "John 1:1,14").
 * For bible-api.com, comma lists are split into individual fetches and concatenated.
 * @param {string} ref - A Bible reference string.
 * @param {string} trans - Translation code (e.g. "nkjv", "kjv").
 * @returns {Promise<string>} Verse-numbered passage text.
 */
async function getBibleAPI(ref,trans){
  if(BOLLS_TRANS[trans])return getBollsBible(ref,BOLLS_TRANS[trans]);
  // bible-api.com does not support comma-separated verse lists — split and fetch individually
  var commaMatch=ref.match(/^(.+):(\d+(?:,\d+)+)$/);
  if(commaMatch){
    var bookChap=commaMatch[1];
    var verseNums=commaMatch[2].split(',');
    var parts=[];
    for(var i=0;i<verseNums.length;i++){
      var sr=await fetch('https://bible-api.com/'+encodeURIComponent(bookChap+':'+verseNums[i].trim())+'?translation='+trans);
      if(!sr.ok)throw new Error('BibleAPI '+sr.status);
      var sd=await sr.json();if(sd.error)throw new Error(sd.error);
      if(sd.verses&&sd.verses.length)parts.push('['+sd.verses[0].verse+'] '+sd.verses[0].text.trim());
      else if(sd.text)parts.push(sd.text.trim());
    }
    return parts.join(' ');
  }
  var r=await fetch('https://bible-api.com/'+encodeURIComponent(ref)+'?translation='+trans);
  if(!r.ok)throw new Error('BibleAPI '+r.status);
  var d=await r.json();if(d.error)throw new Error(d.error);
  if(d.verses&&d.verses.length)return d.verses.map(function(v){return '['+v.verse+'] '+v.text.trim();}).join(' ');
  return d.text||'';
}
/**
 * Renders fetched scripture text into the scrdisplay element.
 * Converts [N] verse markers to superscript and double newlines to <br><br>.
 * @param {string} text - Raw verse-numbered passage text.
 * @param {string} trans - Translation code (unused in rendering; reserved for future use).
 */
function renderScrText(text,trans){var clean=text.replace(/\[(\d+)\]/g,'<sup class="vnum">$1</sup>').replace(/\n\n/g,'<br><br>');document.getElementById('scrdisplay').innerHTML='<div class="scrtext">'+clean+'</div>';}
/**
 * Copies the current study's scripture text to the clipboard.
 * No-op if no study is open or scripture text is empty.
 */
function copyScrip(){var ar=activeRef();if(ar&&ar.scriptureText)navigator.clipboard&&navigator.clipboard.writeText(ar.scriptureText.replace(/<[^>]+>/g,'')).then(function(){toast('Copied');});}
/**
 * Opens the paste scripture overlay and pre-fills the translation field.
 * Focuses the translation input if empty, otherwise focuses the text area.
 */
function openPasteModal(){
  document.getElementById('paste-input').value='';
  var ar=activeRef();
  var ref=ar&&ar.reference?ar.reference:'';
  var hint=document.getElementById('paste-ref-hint');
  if(hint)hint.textContent=ref||'';
  var transEl=document.getElementById('paste-trans');
  if(transEl){
    var prefill=sett.lastPasteTrans||(sett.scrMode==='paste'&&ar&&ar.translation&&ar.translation!=='esv'?ar.translation.toUpperCase():'');
    transEl.value=prefill||'';
  }
  document.getElementById('paste-overlay').classList.add('on');
  setTimeout(function(){var te=document.getElementById('paste-trans');if(te&&!te.value)te.focus();else{document.getElementById('paste-input').focus();}},200);
}
/**
 * Saves manually pasted scripture to the active reference and closes the overlay.
 * Persists the pasted translation label to settings as lastPasteTrans.
 * Injects a custom <option> into the translation dropdown if the label is not standard.
 */
function confirmPaste(){
  var t=document.getElementById('paste-input').value.trim();
  if(!t)return;
  var transEl=document.getElementById('paste-trans');
  var pastedTrans=(transEl&&transEl.value.trim())||'';
  if(pastedTrans){sett.lastPasteTrans=pastedTrans;localStorage.setItem(SK_SETT,JSON.stringify(sett));} // Remember last pasted label so the next paste modal pre-fills it
  var ar=activeRef();
  if(ar){
    ar.scriptureText=t;
    if(pastedTrans){ar.pastedTranslation=pastedTrans;ar.translation=pastedTrans.toLowerCase();}
  }
  renderScrText(t,pastedTrans||'manual');
  var dtrans=document.getElementById('d-trans');
  if(dtrans&&pastedTrans)dtrans.textContent=pastedTrans;
  var ftrans=document.getElementById('f-trans');
  if(ftrans&&pastedTrans){
    // Inject the pasted translation label as a custom <option> if it doesn't already exist in the dropdown
    var found=false;
    for(var i=0;i<ftrans.options.length;i++){if(ftrans.options[i].value===pastedTrans.toLowerCase()){found=true;break;}}
    // Remove any prior custom option before adding the new one to prevent duplicates
    if(!found){var opt=document.createElement('option');opt.value=pastedTrans.toLowerCase();opt.textContent=pastedTrans;opt.id='custom-trans-opt';var existing=document.getElementById('custom-trans-opt');if(existing)existing.remove();ftrans.appendChild(opt);}
    ftrans.value=pastedTrans.toLowerCase();
  }
  document.getElementById('scracts').style.display='flex';
  closeOverlay('paste-overlay');
  toast('Scripture set ('+(pastedTrans||'custom')+')');
}
/**
 * Renders the translation spectrum dot row in the Settings panel.
 * Each translation gets a gold dot if available in Pilgrim, grey if reference-only.
 */
function renderTransSpectrum(){
  var row=document.getElementById('trans-spectrum-row');if(!row)return;
  row.innerHTML=TRANS_DATA.map(function(t){
    var isAvail=TRANS_AVAILABLE_IDS.indexOf(t.abbr)>=0;
    return '<div onclick="openTransDetail(\''+t.abbr+'\')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;flex:1;min-width:0">'
      +'<div style="width:7px;height:7px;border-radius:50%;background:'+(isAvail?'var(--gold)':'var(--txt4)')+';margin-bottom:4px;flex-shrink:0"></div>'
      +'<div style="font-size:9px;color:'+(isAvail?'var(--gold)':'var(--txt4)')+';font-family:\'Crimson Pro\',serif;font-weight:'+(isAvail?'700':'400')+';text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">'+t.abbr+'</div>'
      +'</div>';
  }).join('');
}

/**
 * Opens the translation detail overlay for the given translation abbreviation.
 * Populates all detail fields (name, year, philosophy, producers, purpose, notes)
 * and styles the availability badge based on whether it is in TRANS_AVAILABLE_IDS.
 * @param {string} abbr - Translation abbreviation (e.g. "NASB", "NIV").
 */
function openTransDetail(abbr){
  var t=TRANS_DATA.find(function(x){return x.abbr===abbr;});if(!t)return;
  var isAvail=TRANS_AVAILABLE_IDS.indexOf(abbr)>=0;
  document.getElementById('tdm-abbr').textContent=t.abbr;
  document.getElementById('tdm-name').textContent=t.name;
  document.getElementById('tdm-year').textContent=t.year;
  document.getElementById('tdm-philosophy').textContent=t.philosophy;
  document.getElementById('tdm-producers').textContent=t.producers;
  document.getElementById('tdm-purpose').textContent=t.purpose;
  document.getElementById('tdm-notes').textContent=t.notes;
  var badge=document.getElementById('tdm-badge');
  badge.textContent=isAvail?'● Available in Pilgrim':'Reference Only';
  badge.style.background=isAvail?'color-mix(in srgb,var(--bg3),var(--sagebright) 25%)':'var(--bg3)';
  badge.style.color=isAvail?'var(--sagebright)':'var(--txt4)';
  badge.style.border=isAvail?'1px solid var(--sagebright)40':'1px solid var(--border)';
  document.getElementById('trans-detail-overlay').classList.add('on');
}


// ════════════════════════════════════════════════════════

// SECTION 12 — STUDY TOOLS PANEL
// AI Study Tools panel: scope toggle, tool buttons, and AI result display.
// populateDeep() populates results; buildPrompt() constructs the AI prompt.
// ════════════════════════════════════════════════════════

/**
 * Populates the Study Tools (Deep Study) screen from the current study.
 * Loads saved AI results into aiPanelResults, sets ref/trans/title/teacher labels,
 * populates Field Notes preview, syncs Quill editors, and resets scripture collapsible.
 * Shows empty state if no study is open.
 */
function populateDeep(){
  var emptyEl=document.getElementById('deep-empty');
  var colsEl=document.getElementById('deep-cols');
  if(!cur){
    if(emptyEl)emptyEl.style.display='flex';
    if(colsEl)colsEl.style.display='none';
    return;
  }
  if(emptyEl)emptyEl.style.display='none';
  if(colsEl)colsEl.style.display='';
  var ar=activeRef();
  // Load AI results for current ref into session cache
  aiPanelResults={};aiActiveTab=null;
  // Load all cached AI results (both passage and book scope) into the session cache object
  // '','_book' suffix pattern generates both 'lexical' and 'lexical_book' keys per tool
  if(ar&&ar.deep){['lexical','grammar','historical','cultural','crossrefs'].forEach(function(k){['','_book'].forEach(function(s){var ck=k+s;if(ar.deep[ck])aiPanelResults[ck]=ar.deep[ck];});});}
  document.getElementById('d-ref').textContent=(ar&&ar.reference)||'No reference';
  var dispTrans=ar?(ar.pastedTranslation||(ar.translation||'ESV')):'ESV';document.getElementById('d-trans').textContent=dispTrans.toUpperCase();
  var dSeries=document.getElementById('d-series');if(dSeries)dSeries.textContent=cur.series||'';
  document.getElementById('d-title').textContent=cur.title||'';
  document.getElementById('d-teacher').textContent=cur.teacher||'';
  var notes=cur.fieldNotes||'';
  var _notesPlain=htmlToText(notes);
  document.getElementById('d-fnotes').textContent=_notesPlain||'No field notes recorded.';
  // Word count badge
  var wc=_notesPlain.trim()?_notesPlain.trim().split(/\s+/).length:0;
  var badge=document.getElementById('fnotes-wc-badge');
  if(badge)badge.textContent=wc?'('+wc+' words)':'';
  if(_qConcl){var _cd=cur.deep?(cur.deep.conclusions||''):'';if(_cd)_qConcl.clipboard.dangerouslyPasteHTML(_cd);else _qConcl.setText('');if(window.setQConclDirty)window.setQConclDirty(false);}
  if(_qOutline){var _od=cur.deep?(cur.deep.outline||''):'';if(_od)_qOutline.clipboard.dangerouslyPasteHTML(_od);else _qOutline.setText('');if(window.setQOutlineDirty)window.setQOutlineDirty(false);}
  _outlineOpen=false;var ob=document.getElementById('outline-body');var oc=document.getElementById('outline-chev');if(ob)ob.classList.remove('open');if(oc)oc.style.transform='';
  setStudyScope((ar&&ar.deep&&ar.deep.studyScope)||'passage');
  _renderRefPills('d-ref-pills','deep');
  // Snapshot ready indicator
  var snapSub=document.getElementById('snapshot-sub');
  if(snapSub){
    var _sd=ar&&ar.deep;
    // All 6 snapshot tools must be present: lexical+grammar+crossrefs+geography (passage) + historical+cultural (book)
    var _allReady=_sd&&_sd.lexical&&_sd.grammar&&_sd.crossrefs&&_sd.geography&&_sd.historical_book&&_sd.cultural_book;
    if(_snapshotRunning){/* leave as-is */}
    else if(_allReady){snapSub.textContent='All tools ready \u2014 tap to refresh';}
    else{snapSub.textContent='Word Study \u00b7 Language & Structure \u00b7 Cross-Refs \u00b7 Places & Geography + Historical \u00b7 Cultural (book)';}
  }
  // Scripture collapsible
  var scrEl=document.getElementById('d-scrtext');
  var scrPanel=document.getElementById('deep-scr-collapsible');
  var scrLabel=document.getElementById('deep-scr-label');
  if(scrEl&&scrPanel){
    var scrText=ar&&ar.scriptureText?ar.scriptureText.replace(/<[^>]+>/g,''):'';
    if(scrText){
      scrEl.innerHTML='';
      scrEl.textContent=scrText;
      if(scrLabel)scrLabel.textContent=(ar&&ar.reference)||'Scripture';
    } else {
      // Always show the section — an empty, unexplained hidden panel reads as a missing
      // feature. Show a clear empty-state with a direct path to fix it instead.
      scrEl.innerHTML='<p style="font-style:normal;color:var(--txt3);font-size:14px;line-height:1.6;margin:0">No scripture loaded yet. <a href="#" onclick="event.preventDefault();navTo(\'field\')" style="color:var(--gold);text-decoration:underline">Add a reference in Notes</a> to see it here.</p>';
      if(scrLabel)scrLabel.textContent='Scripture';
    }
    scrPanel.style.display='';
    // Reset collapsed state each time a new study or ref is loaded — prevents stale open state
    _deepScrOpen=false;
    var sb=document.getElementById('deep-scr-body');var sc=document.getElementById('deep-scr-chev');
    if(sb)sb.classList.remove('open');if(sc)sc.style.transform='';
  }
  closeAIPanel();updateToolDots();renderResources();setScope(studyScope);
}
// _fnotesOpen declared in module header
// _outlineOpen declared in module header
// _deepScrOpen declared in module header
/**
 * Toggles the Field Notes collapsible panel in the Study Tools screen.
 * Rotates the chevron icon to reflect open/closed state.
 */
function toggleFnotes(){
  _fnotesOpen=!_fnotesOpen;
  var body=document.getElementById('fnotes-body');
  var chev=document.getElementById('fnotes-chev');
  if(body)body.classList.toggle('open',_fnotesOpen);
  if(chev)chev.style.transform=_fnotesOpen?'rotate(180deg)':'';
}
/**
 * Toggles the Scripture collapsible panel in the Study Tools screen.
 * Rotates the chevron icon to reflect open/closed state.
 */
function toggleDeepScripture(){
  _deepScrOpen=!_deepScrOpen;
  var body=document.getElementById('deep-scr-body');
  var chev=document.getElementById('deep-scr-chev');
  if(body)body.classList.toggle('open',_deepScrOpen);
  if(chev)chev.style.transform=_deepScrOpen?'rotate(180deg)':'';
}
/**
 * Toggles the Outline editor collapsible panel in the Study Tools screen.
 * Rotates the chevron icon to reflect open/closed state.
 */
function toggleOutline(){
  _outlineOpen=!_outlineOpen;
  var body=document.getElementById('outline-body');
  var chev=document.getElementById('outline-chev');
  if(body)body.classList.toggle('open',_outlineOpen);
  if(chev)chev.style.transform=_outlineOpen?'rotate(180deg)':'';
}
/**
 * Opens the Resources overlay and closes any open resource popout panel.
 */
function openResourcesModal(){
  document.getElementById('resources-overlay').classList.add('on');
  closeResPopout();
}
/**
 * Closes the resource popout panel by removing its 'on' class.
 */
function closeResPopout(){
  var p=document.getElementById('res-popout');
  if(p)p.classList.remove('on');
}
/**
 * Fetches and displays ESV text for a cross-reference in the resource popout panel.
 * Shows a spinner during load and an error message on failure.
 * Scrolls the popout into view after content is rendered.
 * @param {string} ref - A Bible reference string to fetch and display.
 */
async function showResScripture(ref){
  var panel=document.getElementById('res-popout');
  var title=document.getElementById('res-popout-title');
  var body=document.getElementById('res-popout-body');
  if(!panel||!title||!body)return;
  title.textContent=ref;
  body.innerHTML='<div style="display:flex;align-items:center;gap:10px;color:var(--txt3);font-style:italic;font-size:14px;padding:8px 0"><div class="spin"></div>Loading ESV...</div>';
  panel.classList.add('on');
  // scroll panel into view
  setTimeout(function(){panel.scrollIntoView({behavior:'smooth',block:'nearest'});},100);
  try{
    var text=await getESV(ref);
    if(!text)throw new Error('empty');
    var clean=text.replace(/\[(\d+)\]/g,'<sup style="color:var(--golddim);font-size:10px;vertical-align:super;">$1</sup>').replace(/\n\n/g,'<br><br>');
    body.innerHTML='<div style="font-family:\'EB Garamond\',serif;font-size:17px;line-height:1.9;color:var(--txt1);font-style:italic;">'+clean+'</div><div style="font-size:11px;color:var(--txt4);margin-top:10px;font-style:italic;">ESV — English Standard Version</div>';
  }catch(e){
    body.innerHTML='<div style="color:var(--txt3);font-size:14px;font-style:italic;">Could not load ESV text. Check your connection or use Paste mode.</div>';
  }
}
var RES_METHODS={
  analytical:{name:'Analytical Method',desc:'The master framework for deep Bible study.',how:'This method moves from the whole to the parts — like using a microscope. Begin by selecting the book and reading it multiple times. Diagram the book\'s structure (line or phrase diagramming). Make unaided observations asking "what does the text say?" Then draw a preliminary outline and add commentary insights. Finally write your own commentary and revise it over time. Numbers 1–5 are background work; 6–12 are interpretive work.',steps:['Select the passage or book','Read it through several times','Diagram the structure','Make unaided observations — what does the text say?','Add cross-references and commentary','Draw a preliminary outline','Write your own notes and conclusions']},
  critical:{name:'Critical Method',desc:'Identify the interpretive problems a book poses before you study it.',how:'This is one of the first steps in understanding any book of the Bible. You are not criticizing Scripture — you are identifying the challenges scholars face when interpreting it so you can work through them honestly.',steps:['List the main interpretive problems the book poses','Research the range of scholarly positions on each problem','Select the most important problem and research it deeply','Write out your own position and the reasons for it','Begin reading the book repeatedly until thoroughly acquainted with it']},
  historical:{name:'Historical Method',desc:'Understand the world behind the text.',how:'Scripture was written in specific historical, cultural, and geographical settings. This method gathers the background data that illuminates what the text meant in its original context. You are not interpreting — you are collecting facts.',steps:['Identify the author, audience, and approximate date','Research the political and social situation at the time','Note cultural practices, customs, and social norms referenced','Identify geographical places and their significance','Record historical events that provide background to the text']},
  topical:{name:'Topical Method',desc:'Trace a word, topic, or theme throughout Scripture.',how:'Select a significant topic or word from your passage. Use a concordance to trace every occurrence across Scripture. Note the various ways it is used. This method is especially useful for word studies and for understanding how a concept develops from OT to NT.',steps:['Select the topic or word to study','Use a concordance to find all occurrences in the range you are studying','Make notes on how the topic or word is used in each passage','Summarize the various usages','Apply your findings to understand the book or passage better']},
  theological:{name:'Theological Method',desc:'Identify the doctrinal content of the passage — Your Notes Only.',how:'This method develops your theological worldview. It asks: what does this passage contribute to our understanding of God, Christ, humanity, salvation, and other doctrines? All conclusions are yours — no AI. Work through the 14 theological categories and mark which ones appear.',steps:['Identify which theological categories are present (Christology, Soteriology, etc.)','Use a concordance to find other passages addressing the same doctrine','Classify your findings under the appropriate theological category','Summarize what the passage teaches about each doctrine found','Draw your own conclusions — this is entirely AI-free']},
  comparative:{name:'Comparative Method',desc:'Compare translations and parallel passages.',how:'Place multiple translations of your passage side by side and observe the differences. Look for parallel passages, rare or unique words (hapax legomena), and any ancient parallels. The goal is to collect data — not to decide which translation is best.',steps:['Compare the passage in NASB, ESV, KJV, NIV, and NLT','Note where translations differ and what Greek or Hebrew word underlies the difference','Identify any parallel passages within Scripture','Look for hapax legomena — words used only once or rarely','Note any Ancient Near Eastern or Greco-Roman parallels']},
  rhetorical:{name:'Rhetorical Method',desc:'Identify the literary and persuasive devices the author uses.',how:'Every biblical author was a skilled communicator. This method identifies the specific figures of speech and literary structures used to convey meaning. You identify and define them — you do not interpret what they mean. That belongs to you.',steps:['Read the passage looking for figures of speech (metaphor, simile, hyperbole, irony, etc.)','Look for structural devices (chiasm, parallelism, anaphora, inclusio)','Note any rhetorical appeals (ethos, pathos, logos)','For each device found: name it, quote the text, define it','Record your findings — do not yet interpret their significance']},
  devotional:{name:'Devotional Method',desc:'Personal reflection and prayer — Your Notes Only.',how:'This is the Homiletics stage — application. After all the scholarly work is done, this method brings the text home. It is entirely personal and entirely AI-free. Work through the four areas: what does this mean theologically, personally, for teaching, and for illustration?',steps:['Theological — what truth about God can I affirm right now?','Personal Devotion — what is God personally showing me in this season?','Exposition — if I were teaching this, what is the one central truth?','Illustration — what story or image makes this truth concrete?','Response — what specific change is this passage calling me to make?','Prayer — write a personal prayer in response to what God has shown you']}
};
/**
 * Displays a study method's description, overview, and step list in the resource popout.
 * Scrolls the popout into view after rendering.
 * @param {string} id - Key from RES_METHODS (e.g. "analytical", "topical", "devotional").
 */
function showResMethod(id){
  var m=RES_METHODS[id];if(!m)return;
  var panel=document.getElementById('res-popout');
  var title=document.getElementById('res-popout-title');
  var body=document.getElementById('res-popout-body');
  if(!panel||!title||!body)return;
  title.textContent=m.name;
  var stepsHtml=m.steps.map(function(s,i){return'<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);"><span style="color:var(--golddim);font-size:13px;flex-shrink:0;">'+(i+1)+'.</span><span style="font-size:14px;color:var(--txt2);line-height:1.6;">'+s+'</span></div>';}).join('');
  body.innerHTML='<div style="font-size:13px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">'+m.desc+'</div>'
    +'<div style="font-size:14px;color:var(--txt2);line-height:1.7;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">'+m.how+'</div>'
    +'<div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">How to Use It</div>'
    +stepsHtml;
  panel.classList.add('on');
  setTimeout(function(){panel.scrollIntoView({behavior:'smooth',block:'nearest'});},100);
}
/**
 * Toggles a collapsible section in the Resources overlay between open and closed.
 * Rotates the chevron element to reflect the new state.
 * @param {string} sectionId - DOM id of the collapsible content element.
 * @param {string} chevId - DOM id of the chevron icon element.
 */
function toggleResSection(sectionId,chevId){
  var s=document.getElementById(sectionId);
  var c=document.getElementById(chevId);
  if(!s)return;
  var isOpen=s.style.display!=='none';
  s.style.display=isOpen?'none':'block';
  if(c)c.style.transform=isOpen?'':'rotate(180deg)';
}
// insertOutlinePrefix removed — Quill toolbar handles formatting
/**
 * Sets the AI tool scope to 'passage' or 'book' and updates the UI accordingly.
 * Updates studyScope, the active reference's deep.studyScope, scope toggle buttons,
 * and the scope context label. Closes the AI panel and refreshes tool dot indicators.
 * @param {string} s - Scope: 'passage' | 'book'.
 */
function setScope(s){
  setStudyScope(s);
  if(activeRef()&&activeRef().deep)activeRef().deep.studyScope=s;
  document.getElementById('scope-passage').classList.toggle('on',s==='passage');
  document.getElementById('scope-book').classList.toggle('on',s==='book');
  var book=cur?getBookFromRef((activeRef()&&activeRef().reference)||''):'';
  var lbl=document.getElementById('scope-context-label');
  if(lbl)lbl.textContent=s==='book'?'the book of '+book:'this passage';
  closeAIPanel();updateToolDots();
}
/**
 * Extracts the book name from a Bible reference string.
 * Matches against BIBLE_BOOKS; handles numbered books (e.g. "1 Samuel").
 * @param {string} ref - A passage reference string (e.g. "Romans 8:1").
 * @returns {string} The canonical book name, or the first word if no match found.
 */
function getBookFromRef(ref){if(!ref)return '';var r=ref.trim().toLowerCase();for(var i=0;i<BIBLE_BOOKS.length;i++){if(r.startsWith(BIBLE_BOOKS[i].toLowerCase()))return BIBLE_BOOKS[i];}var parts=ref.trim().split(' ');
  // Numbered book (e.g. '1 Samuel', '2 Kings'): first token is a single digit
  var isNum=parts[0].length===1&&!isNaN(parseInt(parts[0]));
  if(isNum&&parts.length>=2)return parts[0]+' '+parts[1];
  return parts[0]; // Unnumbered book: return first word
}
/**
 * Refreshes the ready-dot indicators on all AI tool buttons.
 * A dot is shown when the current scope's result is already cached in the active reference.
 */
function updateToolDots(){
  var ar=activeRef();
  ['lexical','grammar','historical','cultural','crossrefs','geography'].forEach(function(k){
    var btn=document.getElementById('btn-'+k);if(!btn)return;
    // Append '_book' suffix for book-scope keys (e.g. 'historical_book'); passage scope uses bare key
    var ck=studyScope==='book'?k+'_book':k;
    var has=!!(ar&&ar.deep&&ar.deep[ck]); // !! coerces to boolean — dot presence, not content
    btn.classList.toggle('ready',has);
    var dot=btn.querySelector('.rdot');
    if(has&&!dot){var d=document.createElement('div');d.className='rdot';btn.appendChild(d);}
    else if(!has&&dot){dot.remove();}
  });
}

/**
 * Builds the full AI prompt string for a given tool, reference, and scope.
 * Applies the theological framework (Scripture as primary authority; present all major
 * scholarly positions on debated matters). Includes a CRITICAL footer blocking conclusions.
 * @param {string} tool - Tool key: 'lexical'|'grammar'|'historical'|'cultural'|'crossrefs'|'geography'.
 * @param {string} ref - The passage reference (e.g. "Romans 8:1-4").
 * @param {string} trans - Translation code (e.g. "NASB").
 * @param {string} scope - 'passage' or 'book'.
 * @returns {string} Full prompt string, or empty string if tool key is unrecognized.
 */
function buildPrompt(tool,ref,trans,scope){
  var isBook=(scope||studyScope)==='book',book=getBookFromRef(ref);
  var subject=isBook?'the book of '+book+' as a whole':ref; // Governs whether prompts say 'this passage' or 'the book of X'
  var base='You are a scholarly biblical reference tool. The student is studying '+subject+' ('+trans.toUpperCase()+' translation). Scripture is the sole and infallible Word of God — the primary authority. Where the text speaks plainly, the text takes precedence over scholarly consensus. When scholarly debate exists, present all major positions with named scholars and their evidence — never state a debated matter as settled fact.\n\n';
  // Appended to every prompt — blocks the AI from drawing theological conclusions
  var noC='\n\nCRITICAL: Provide ONLY the data requested. Do NOT draw theological conclusions, make doctrinal interpretations, or express any theological opinion. The student draws all conclusions.';
  var intro=isBook?'Provide a complete analysis of the book of '+book+'.':'Provide a complete analysis of '+ref+'.';
  var prompts={
    lexical:base+intro+' Lexical study of 6-8 key words -- do not truncate. For EACH word:\n\nWORD N: [English word]\n- Language: Greek (NT) or Hebrew (OT)\n- Transliteration: [form]\n- Strong\'s: G#### or H####\n- Primary definition: [cite BDAG for Greek or BDB for Hebrew by name]\n- Additional sources: [where Thayer, Vine\'s, or Liddell-Scott agree or differ]\n- Semantic range: [full range in biblical usage]\n- Plain reading in this text: [most natural meaning as written]\n- Disputed: [note any scholarly disagreement with sources]\n- Key occurrences: [2-3 references]\n\nComplete all words.'+noC,
    grammar:base+intro+' Complete grammar and syntax analysis -- do not truncate:\n\nSENTENCE STRUCTURE\n[Overall syntax and logical flow]\n\nVERB ANALYSIS\n[Tense, mood, voice for each significant verb — note where grammatical form directly affects meaning]\n\nNOTABLE CONSTRUCTIONS\n[Participles, infinitives, conditionals and their function]\n\nDISPUTED GRAMMATICAL READINGS\n[Where two or more valid readings exist, present each — cite Wallace, Moulton, or BDF where applicable — note which reading aligns with the plain text]\n\nCONJUNCTIONS AND PARTICLES\n[Each conjunction and its logical function]\n\nSYNTACTICAL SUMMARY\n[Additional grammatical features]\n\nComplete all sections.'+noC,
    historical:base+intro+' Complete historical background -- do not truncate:\n\nTIME PERIOD & DATING DEBATE\nPresent ALL major scholarly positions on date of composition. Name specific scholars and their primary evidence for each position. Clearly distinguish: (a) critical/liberal scholarship, (b) conservative/evangelical scholarship, (c) traditional church position. Do NOT state any debated date as settled fact. Note what the internal evidence of the text itself suggests.\n\nPOLITICAL LANDSCAPE\n[Empires, rulers, and political tensions at the time]\n\nAUTHOR BACKGROUND\nState the traditionally attributed author. Summarize evidence for and against, naming specific scholars on each side. Where the text\'s own claims about authorship are clear, state them as primary evidence.\n\nORIGINAL AUDIENCE\n[Geographic, social, and religious context of the original recipients]\n\nKEY HISTORICAL EVENTS\n[Events surrounding or referenced in the text — note what is archaeologically confirmed vs scholarly reconstruction]\n\nARCHAEOLOGICAL ATTESTATION\n[Relevant findings — note where archaeology confirms the biblical record]\n\nSCHOLARLY SOURCES\nName 4-6 specific scholars, commentaries, or reference works spanning both critical and conservative traditions.\n\nComplete all sections.'+noC,
    cultural:base+intro+' Complete cultural background -- do not truncate:\n\nCULTURAL CUSTOMS\n[For each custom: describe it, note if well-attested or debated, and cite the source]\n\nSOCIAL STRUCTURES\n[Hierarchies, conventions, honor-shame dynamics]\n\nGEOGRAPHIC SETTING\n[Location, physical description, historical and cultural significance]\n\nECONOMIC CONDITIONS\n[Trade, currency, occupations relevant to the text]\n\nRELIGIOUS AND CIVIC PRACTICES\nDistinguish: (a) practices confirmed by multiple sources, (b) known from limited sources, (c) scholarly reconstruction. Note where the text itself is the primary confirming source.\n\nCULTURAL IDIOMS\n[Expressions requiring cultural context]\n\nARCHAEOLOGICAL CONFIRMATION\n[Where physical evidence confirms the cultural picture in the text]\n\nComplete all sections.'+noC,
    crossrefs:base+intro+' Complete cross-references -- do not truncate:\n\nDIRECT SCRIPTURAL ALLUSIONS (3-4)\n[Reference] - [connection explicit in the text itself or clear authorial intent]\n\nTHEMATIC CONNECTIONS (4-5)\n[Reference] - [thematic link] - [note if universally recognized or tradition-specific]\n\nLINGUISTIC CONNECTIONS (3-4)\n[Reference] - [shared word or phrase in original language]\n\nNARRATIVE CONNECTIONS (2-3 if applicable)\n[Reference] - [narrative parallel or contrast]\n\nPROPHETIC CONNECTIONS (if applicable)\n[Reference] - [fulfillment or typological connection] - [note if widely held or debated]\n\nFor each connection note whether it is: (a) made explicit in Scripture itself, (b) widely recognized across traditions, or (c) one tradition\'s interpretive reading.\n\nComplete all sections.'+noC,
      geography:base+intro+' Identify and describe every geographical location, region, or landmark mentioned in '+subject+'. For EACH location provide ALL of the following:\n\nLOCATION: [Name as it appears in the text]\n- Ancient names: [all known names in biblical literature]\n- Modern identification: [modern country and site name]\n- 📍 [View on Map](https://maps.google.com/?q=LOCATION+NAME+COUNTRY)\n- Terrain & description: [elevation, topography, water features, notable physical characteristics]\n- Distance from Jerusalem: [in miles and km, with compass direction — or from nearest key location if not Jerusalem]\n- Archaeological attestation: [physical evidence confirming identification — clearly note if absent or limited]\n- Certainty: CONFIRMED | PROBABLE | CONTESTED\n  — If CONTESTED or PROBABLE: list each proposed identification with the specific conservative scholarly sources or works (e.g. Zondervan Atlas of the Bible, ISBE, ESV Study Bible notes, Aharoni) supporting each view. Do not present any contested identification as settled.\n\nFor the View on Map link, replace LOCATION+NAME+COUNTRY with the actual location name using + for spaces (e.g. Mount+of+Olives+Jerusalem or Antioch+Turkey).\n\nIf the passage involves travel between locations, add a JOURNEY SUMMARY section after all individual locations:\n- Route: [most attested ancient path between the points]\n- Total distance: [miles and km]\n- Terrain: [what a traveler would encounter]\n\nPresent only confirmed geographical and archaeological data. Do not infer routes or distances not supported by sources. Complete all identified locations.'+noC
  };
  return prompts[tool]||'';
}

/**
 * Maps a Gemini API error message to a user-friendly string.
 * Handles quota/rate-limit and invalid-key cases. Dead code — Gemini removed in favour of Groq.
 * @param {string} msg - Raw error message from the API.
 * @returns {string} User-facing error string.
 */
function geminiErrMsg(msg){
  if(!msg)return'Error fetching analysis. Please try again.';
  if(msg.toLowerCase().includes('quota')||msg.toLowerCase().includes('rate')||msg.toLowerCase().includes('exhausted'))
    return'Rate limit reached — please wait 1–2 minutes and try again.';
  if(msg.toLowerCase().includes('expired')||msg.toLowerCase().includes('api key')||msg.toLowerCase().includes('invalid')||msg.includes('403'))
    return'Text extraction service error — please try again in a moment.';
  return'Text Extraction Error: '+msg;
}

/**
 * Maps a Groq API error message to a user-friendly string.
 * Handles rate-limit (429) and authentication (401) cases with actionable copy.
 * @param {string} msg - Raw error message from the Groq API response.
 * @returns {string} User-facing error string.
 */
function groqErrMsg(msg){
  if(!msg)return'Error fetching analysis. Please try again.';
  if(msg.toLowerCase().includes('rate')||msg.toLowerCase().includes('quota')||msg.toLowerCase().includes('429'))
    return'Rate limit reached — the free tier allows 30 requests/min. Please wait 1–2 minutes and try again.';
  if(msg.toLowerCase().includes('expired')||msg.toLowerCase().includes('invalid')||msg.toLowerCase().includes('api key')||msg.includes('401'))
    return'AI service error — please try again in a moment or check your connection.';
  return'Error: '+msg;
}
/**
 * Runs a single AI study tool for the active reference and scope.
 * Returns cached result immediately if available. Otherwise fetches from the Groq
 * API via arche-proxy, stores the result in ar.deep[ck], saves, and shows the panel.
 * @param {string} tool - Tool key: 'lexical'|'grammar'|'historical'|'cultural'|'crossrefs'|'geography'.
 */
async function runTool(tool){
  if(!cur){toast('Open a study first');return;}
  var ar=activeRef();
  if(!ar||!ar.reference){toast('Add a scripture reference first');return;}
  var ck=studyScope==='book'?tool+'_book':tool;
  if(ar.deep&&ar.deep[ck]&&ar.deep[ck]!=='__shared__'){showAIPanel(tool,ar.deep[ck]);return;}
  if(!online){toast('AI tools require internet');return;}
  var btn=document.getElementById('btn-'+tool);btn.classList.add('busy');
  document.getElementById('aipanel-title').innerHTML=TOOL_LABELS[tool];
  document.getElementById('aipanel-content').innerHTML='<div style="display:flex;align-items:center;gap:11px;color:var(--txt3);padding:6px 0"><div class="spin"></div>Analyzing '+ar.reference+'...</div>';
  document.getElementById('aipanel').classList.add('on');
  setTimeout(function(){document.getElementById('aipanel').scrollIntoView({behavior:'smooth',block:'nearest'});},120);
  try{
    var trans=ar.pastedTranslation||ar.translation||'ESV';
    var prompt=buildPrompt(tool,ar.reference,trans,studyScope);
    var res=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:prompt}],max_tokens:2048,temperature:0.2})});
    if(!res.ok){var err=await res.json().catch(function(){return{};});throw new Error(err.error?err.error.message:'HTTP '+res.status);}
    var data=await res.json();
    var content=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content||'No response received.';
    if(!ar.deep)ar.deep={};
    ar.deep[ck]=content;saveStudy();showAIPanel(tool,content);
    btn.classList.remove('busy');btn.classList.add('ready');
    if(!btn.querySelector('.rdot')){var d=document.createElement('div');d.className='rdot';btn.appendChild(d);}
  }catch(e){
    document.getElementById('aipanel-content').innerHTML='<p style="color:var(--crimsonbright);font-size:14px;margin-bottom:8px">'+groqErrMsg(e.message)+'</p>';
    btn.classList.remove('busy');
  }
}

// ════════════════════════════════════════════════════════

// SECTION 13 — STUDY SNAPSHOT
// Runs all six AI tools in sequence for the active study.
// Results are cached and displayed in the 2×3 Snapshot grid.
// ════════════════════════════════════════════════════════
var _snapshotRunning=false;var _snapshotLastRun=null;
// Fixed ordering of all 6 snapshot tools — used by the progress modal to identify rows
var SNAPSHOT_TOOL_ORDER=['lexical','grammar','crossrefs','geography','historical','cultural'];
/**
 * Entry point for the Study Snapshot button.
 * On mobile (≤900px), opens the snapshot confirmation overlay before running.
 * On desktop, runs the snapshot immediately.
 */
function snapshotIntent(){
  if(window.innerWidth<=900){
    document.getElementById('snapshot-overlay').classList.add('on');
  } else {
    runSnapshot();
  }
}
/**
 * Resolves after `ms` milliseconds, but resolves early (within one 100ms tick) if
 * _snapshotCancelled becomes true — lets Cancel interrupt the inter-request pause
 * immediately instead of waiting out the full delay.
 * @param {number} ms - Delay duration in milliseconds.
 * @returns {Promise<void>}
 */
function snapshotDelay(ms){
  return new Promise(function(resolve){
    var elapsed=0,step=100;
    var iv=setInterval(function(){
      elapsed+=step;
      if(_snapshotCancelled||elapsed>=ms){clearInterval(iv);resolve();}
    },step);
  });
}
/**
 * Opens the Snapshot progress modal and renders one row per tool in `all`.
 * All rows start in the 'pending' state; Cancel is shown, Close is hidden.
 * @param {Array<{tool:string,scope:string}>} all - Ordered list of tool/scope items to run.
 */
function openSnapshotProgressModal(all){
  var list=document.getElementById('snap-progress-list');
  if(!list)return;
  list.innerHTML=all.map(function(item){
    var scopeLbl=item.scope==='book'?'Whole Book':'This Passage';
    return '<div class="snap-row" id="snap-row-'+item.tool+'" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">'
      +'<span class="snap-icon" id="snap-icon-'+item.tool+'" style="width:16px;text-align:center;color:var(--txt4);flex-shrink:0">&#9675;</span>'
      +'<span style="flex:1;font-size:14px;color:var(--txt2)">'+(TOOL_LABELS[item.tool]||item.tool)+' <span style="font-size:11px;color:var(--txt4)">('+scopeLbl+')</span></span>'
      +'<span class="snap-status" id="snap-status-'+item.tool+'" style="font-size:12px;color:var(--txt4)">Pending</span>'
      +'</div>';
  }).join('');
  var cancelBtn=document.getElementById('snap-cancel-btn');
  var closeBtn=document.getElementById('snap-close-btn');
  if(cancelBtn){cancelBtn.style.display='';cancelBtn.disabled=false;cancelBtn.textContent='Cancel';}
  if(closeBtn)closeBtn.style.display='none';
  var ov=document.getElementById('snapshot-progress-overlay');
  if(ov)ov.classList.add('on');
}
/**
 * Updates a single tool row's icon and status label in the Snapshot progress modal.
 * @param {string} tool - Tool key (e.g. 'lexical').
 * @param {'pending'|'running'|'done'|'failed'|'cancelled'} status - New row status.
 */
function setSnapshotRowStatus(tool,status){
  var icon=document.getElementById('snap-icon-'+tool);
  var label=document.getElementById('snap-status-'+tool);
  if(!icon||!label)return;
  var map={
    pending:{ic:'&#9675;',color:'var(--txt4)',txt:'Pending'},
    running:{ic:'<div class="spin" style="width:13px;height:13px;border-width:2px;margin:0 auto"></div>',color:'var(--gold)',txt:'Running\u2026'},
    done:{ic:'&#10003;',color:'var(--sagebright)',txt:'Done'},
    failed:{ic:'&#10005;',color:'var(--crimsonbright)',txt:'Failed'},
    cancelled:{ic:'&#8211;',color:'var(--txt4)',txt:'Cancelled'}
  };
  var m=map[status]||map.pending;
  icon.innerHTML=m.ic;icon.style.color=m.color;
  label.textContent=m.txt;label.style.color=m.color;
}
/**
 * Finalizes the Snapshot progress modal once the run loop ends.
 * Swaps Cancel for Close, and marks any rows still 'Pending' as cancelled
 * (covers tools that never started because the run was cancelled early).
 * @param {boolean} cancelled - Whether the run ended via cancellation.
 */
function finishSnapshotProgressModal(cancelled){
  var cancelBtn=document.getElementById('snap-cancel-btn');
  var closeBtn=document.getElementById('snap-close-btn');
  if(cancelBtn)cancelBtn.style.display='none';
  if(closeBtn)closeBtn.style.display='';
  if(cancelled){
    SNAPSHOT_TOOL_ORDER.forEach(function(tool){
      var label=document.getElementById('snap-status-'+tool);
      if(label&&label.textContent==='Pending')setSnapshotRowStatus(tool,'cancelled');
    });
  }
}
/**
 * Cancels an in-progress Snapshot run. Aborts the in-flight fetch immediately via
 * AbortController and sets _snapshotCancelled so the run loop exits at its next check.
 * Disables the Cancel button to prevent duplicate clicks while the run unwinds.
 */
function cancelSnapshot(){
  if(!_snapshotRunning)return;
  _snapshotCancelled=true;
  if(_snapshotAbortController){_snapshotAbortController.abort();}
  var cancelBtn=document.getElementById('snap-cancel-btn');
  if(cancelBtn){cancelBtn.disabled=true;cancelBtn.textContent='Cancelling\u2026';}
}
/**
 * Runs all six AI study tools in sequence for the active reference, driving the
 * Snapshot progress modal (per-tool status + Cancel/Close control).
 * Passage-scope tools: lexical, grammar, crossrefs, geography.
 * Book-scope tools: historical, cultural.
 * Skips any tool with a cached result. Inserts a cancellable 2.5s delay between
 * requests to avoid Groq rate limits. Sets _snapshotRunning to prevent concurrent runs.
 * Cancel aborts the in-flight fetch immediately and stops before the next tool.
 */
async function runSnapshot(){
  if(_snapshotRunning){toast('Snapshot already running');return;}
  if(!cur){toast('Open a study first');return;}
  var ar=activeRef();
  if(!ar||!ar.reference){toast('Add a scripture reference first');return;}
  if(!online){toast('AI tools require internet');return;}
  _snapshotRunning=true;
  _snapshotCancelled=false;
  var btn=document.getElementById('btn-snapshot');
  var sub=document.getElementById('snapshot-sub');
  if(btn){btn.style.opacity='.6';btn.style.pointerEvents='none';}
  var passageTools=['lexical','grammar','crossrefs','geography'];
  var bookTools=['historical','cultural'];
  var all=passageTools.map(function(t){return {tool:t,scope:'passage'};}).concat(bookTools.map(function(t){return {tool:t,scope:'book'};}));
  openSnapshotProgressModal(all);
  for(var i=0;i<all.length;i++){
    if(_snapshotCancelled)break;
    var item=all[i];
    setSnapshotRowStatus(item.tool,'running');
    // Temporarily override studyScope so buildPrompt and cache keys use the tool's required scope
    var prevScope=studyScope;
    setStudyScope(item.scope);
    var ck=item.scope==='book'?item.tool+'_book':item.tool; // Storage key matching the tool+scope combination
    // Skip if cached — but NOT if the value is '__shared__' (placeholder from an imported study that needs real data)
    if(ar.deep&&ar.deep[ck]&&ar.deep[ck]!=='__shared__'){
      setStudyScope(prevScope);
      setSnapshotRowStatus(item.tool,'done');
      await snapshotDelay(200);
      continue;
    }
    try{
      var trans=ar.pastedTranslation||ar.translation||'ESV';
      var prompt=buildPrompt(item.tool,ar.reference,trans,item.scope);
      _snapshotAbortController=new AbortController();
      var res=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:prompt}],max_tokens:2048,temperature:0.2}),signal:_snapshotAbortController.signal});
      if(!res.ok){var err=await res.json().catch(function(){return{};});throw new Error(err.error?err.error.message:'HTTP '+res.status);}
      var data=await res.json();
      var content2=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content||'';
      if(content2){if(!ar.deep)ar.deep={};ar.deep[ck]=content2;saveStudy(true);}
      var toolBtn=document.getElementById('btn-'+item.tool);
      if(toolBtn){toolBtn.classList.add('ready');if(!toolBtn.querySelector('.rdot')){var d=document.createElement('div');d.className='rdot';toolBtn.appendChild(d);}}
      showAIPanel(item.tool,content2);
      setSnapshotRowStatus(item.tool,'done');
    }catch(e){
      if(e.name==='AbortError'){
        setSnapshotRowStatus(item.tool,'cancelled');
        setStudyScope(prevScope);
        break;
      }
      setSnapshotRowStatus(item.tool,'failed');
      toast('Snapshot: '+item.tool+' failed \u2014 '+e.message);
    }
    setStudyScope(prevScope);
    if(_snapshotCancelled)break;
    // 2.5s inter-request delay to avoid hitting the Groq free-tier rate limit (30 req/min)
    if(i<all.length-1)await snapshotDelay(2500);
  }
  _snapshotRunning=false;
  _snapshotAbortController=null;
  var wasCancelled=_snapshotCancelled;
  _snapshotCancelled=false;
  finishSnapshotProgressModal(wasCancelled);
  if(btn){btn.style.opacity='';btn.style.pointerEvents='';}
  if(!wasCancelled){
    _snapshotLastRun=new Date();
    if(sub){var fmtT=_snapshotLastRun.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});sub.textContent='Last run: '+fmtT+' \u2014 tap to refresh any tool';}
    // Restore passage scope after snapshot — book-scope tools temporarily override it during the run
    if(ar&&ar.deep)ar.deep.studyScope='passage';
    setStudyScope('passage');
    persist();
    toast('Snapshot complete \u2014 all tools loaded');
  } else {
    setStudyScope('passage');
    toast('Snapshot cancelled');
  }
}
/**
 * Caches an AI result, sets it as the active tab, and renders the AI panel.
 * Scrolls the panel into view after a short delay.
 * @param {string} tool - Tool key (e.g. 'lexical', 'grammar').
 * @param {string} content - AI-generated markdown content to display.
 */
function showAIPanel(tool,content){
  var ck=studyScope==='book'?tool+'_book':tool;
  aiPanelResults[ck]=content;
  aiActiveTab=ck;
  renderAITabs();
  renderAIPanelContent(ck);
  updateExpandBtn();
  document.getElementById('aipanel').classList.add('on');
  setTimeout(function(){document.getElementById('aipanel').scrollIntoView({behavior:'smooth',block:'nearest'});},120);
}
/**
 * Renders the tab strip for the AI results panel.
 * Shows a tab for each cached result (from aiPanelResults and ar.deep).
 * The active tab is highlighted in gold; others are muted.
 */
function renderAITabs(){
  var tabs=document.getElementById('aipanel-tabs');if(!tabs)return;
  var ar=activeRef();
  var available=[];
  ['lexical','grammar','historical','cultural','crossrefs'].forEach(function(k){
    ['','_book'].forEach(function(suffix){
      var ck=k+suffix;
      if(ar&&ar.deep&&ar.deep[ck])available.push(ck);
    });
  });
  // Include session-cached results not yet written to ar.deep (e.g. tool ran but save hasn't flushed yet)
  Object.keys(aiPanelResults).forEach(function(ck){if(available.indexOf(ck)<0)available.push(ck);});
  if(!available.length){tabs.innerHTML='';return;}
  tabs.innerHTML=available.map(function(ck){
    var base=ck.replace('_book','');
    var label=(TOOL_LABELS[base]||base).replace(' Context','').replace('Language & Structure','Lang & Structure').replace('Cross-References','X-Refs').replace('Word Study','Word Study');
    var scopeTag=ck.endsWith('_book')?' <span style="font-size:9px;opacity:.7">book</span>':'';
    var isActive=ck===aiActiveTab;
    return '<button onclick="switchAITab(\''+ck+'\')" style="border:none;border-radius:50px;padding:4px 11px;font-family:\'Crimson Pro\',serif;font-size:12px;cursor:pointer;transition:all .15s;white-space:nowrap;background:'+(isActive?'var(--gold)':'var(--bg3)')+';color:'+(isActive?'var(--bg0)':'var(--txt3)')+';border:1px solid '+(isActive?'var(--gold)':'var(--border)')+'">'+label+scopeTag+'</button>';
  }).join('');
}
/**
 * Switches the AI results panel to the given result key tab.
 * Stops TTS if it is reading from the AI panel.
 * @param {string} ck - Result key (e.g. 'lexical', 'historical_book').
 */
function switchAITab(ck){
  if(_ttsActive&&_ttsSource==='ai')ttsStop();
  aiActiveTab=ck;
  renderAITabs();
  renderAIPanelContent(ck);
  updateExpandBtn();
}
/**
 * Renders the markdown content for the given result key into the AI panel body.
 * Adds a scope suffix ("— Whole Book" or "— This Passage") to the panel title.
 * @param {string} ck - Result key (e.g. 'lexical', 'cultural_book').
 */
function renderAIPanelContent(ck){
  var ar=activeRef();
  var base=ck.replace('_book','');
  var sl=ck.endsWith('_book')?' <span style="font-size:11px;color:var(--golddim)">— Whole Book</span>':' <span style="font-size:11px;color:var(--golddim)">— This Passage</span>';
  var titleEl=document.getElementById('aipanel-title');if(titleEl)titleEl.innerHTML=(TOOL_LABELS[base]||base)+sl;
  var content=aiPanelResults[ck]||(ar&&ar.deep&&ar.deep[ck])||'';
  var html=mdToHtml(content);
  var contentEl=document.getElementById('aipanel-content');if(contentEl)contentEl.innerHTML='<div>'+(typeof DOMPurify!=='undefined'?DOMPurify.sanitize(html):html)+'</div>';
}
/**
 * Closes the AI results panel and clears the active tab state.
 * Stops TTS if it is currently reading from the AI panel.
 */
function closeAIPanel(){if(window.speechSynthesis&&_ttsActive&&_ttsSource==='ai')ttsStop();document.getElementById('aipanel').classList.remove('on');aiActiveTab=null;updateExpandBtn();}

// ════════════════════════════════════════════════════════

// _expandRunning declared in module header
/**
 * Shows or hides the "Expand" button row based on whether the active AI tab
 * has an expandable result (historical or cultural, either scope).
 */
function updateExpandBtn(){var row=document.getElementById('expand-btn-row');if(!row)return;var expandable=['historical','historical_book','cultural','cultural_book'];row.style.display=(aiActiveTab&&expandable.indexOf(aiActiveTab)>=0)?'block':'none';var lbl=document.getElementById('expand-btn-label');if(lbl)lbl.textContent='Expand \u2014 more detail';}
/**
 * Appends genuinely new content to the current AI result using a follow-up Groq prompt.
 * Targets historical and cultural results only. Merges the expansion into ar.deep and
 * re-renders the panel. Guards against concurrent expand runs via _expandRunning flag.
 */
async function expandCurrentTool(){
  if(_expandRunning){toast('Expand already running');return;}
  if(!aiActiveTab)return;
  var expandable=['historical','historical_book','cultural','cultural_book'];
  if(expandable.indexOf(aiActiveTab)<0)return;
  var ar=activeRef();if(!ar)return;
  var existing=aiPanelResults[aiActiveTab]||(ar.deep&&ar.deep[aiActiveTab])||'';
  if(!existing){toast('Run the tool first');return;}
  _expandRunning=true;
  var btn=document.getElementById('btn-expand');var lbl=document.getElementById('expand-btn-label');
  btn.style.opacity='.5';btn.style.pointerEvents='none';lbl.textContent='Expanding...';
  var base=aiActiveTab.replace('_book','');
  var isHist=(base==='historical');
  var expandPrompt='The following '+(isHist?'Historical Context':'Cultural Context')+' has already been provided for '+ar.reference+':\n\n--- EXISTING CONTENT ---\n'+existing+'\n--- END EXISTING CONTENT ---\n\nYour task: provide ONLY genuinely new information not present above. Do NOT restate, rephrase, summarize, or echo anything already covered.\n\n'+(isHist?'For Historical expansion prioritize: additional named scholars and specific positions not yet mentioned; minority scholarly views; additional archaeological evidence; patristic or early church testimony on dating or authorship; any internal textual evidence not yet discussed.':'For Cultural expansion prioritize: additional customs with named primary sources; archaeological finds not yet mentioned; comparative material from surrounding cultures (Greek, Roman, Jewish); details about specific locations, social groups, or economic practices referenced in the text not yet covered.')+'\n\nScripture is the sole and infallible Word of God — the primary authority. Where the text itself speaks plainly, state that as primary evidence. When scholarly debate exists, name scholars on each side.\n\nIMPORTANT: If you have no genuinely new information to add, respond with exactly this sentence: "No additional information is available for this passage beyond what has already been provided."\n\nNew information only:';
  try{
    var res=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',messages:[{role:'user',content:expandPrompt}],max_tokens:2048,temperature:0.2})});
    if(!res.ok){var err=await res.json().catch(function(){return{};});throw new Error(err.error?err.error.message:'HTTP '+res.status);}
    var data=await res.json();
    var more=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content||'';
    if(more){var combined=existing+'\n\n---\n\n'+more;if(!ar.deep)ar.deep={};ar.deep[aiActiveTab]=combined;aiPanelResults[aiActiveTab]=combined;saveStudy(true);renderAIPanelContent(aiActiveTab);toast('Expanded');}
  }catch(e){toast('Expand failed: '+e.message);}
  btn.style.opacity='';btn.style.pointerEvents='';lbl.textContent='Expand \u2014 more detail';_expandRunning=false;
}
/**
 * Copies the active AI result to the clipboard with a header line showing tool name and reference.
 * Falls back to a prompt dialog if the Clipboard API is unavailable.
 */
function copyAIResult(){
  if(!aiActiveTab)return;
  var ar=activeRef();
  var content=aiPanelResults[aiActiveTab]||(ar&&ar.deep&&ar.deep[aiActiveTab])||'';
  if(!content){toast('No content to copy');return;}
  var base=aiActiveTab.replace('_book','');
  var header=(TOOL_LABELS[base]||base)+(aiActiveTab.endsWith('_book')?' — Whole Book':' — This Passage')+'\n'+(ar&&ar.reference?ar.reference+'\n':'')+'\n';
  if(navigator.clipboard){navigator.clipboard.writeText(header+content).then(function(){toast('Copied to clipboard');}).catch(function(){toast('Copy failed');});}
  else{toast('Copy not supported in this browser');}
}
/**
 * Shares the active AI result via the Web Share API, or falls back to clipboard copy.
 * Appends "- Arche Pilgrim" attribution to the shared text.
 */
function shareAIResult(){
  if(!aiActiveTab)return;
  var ar=activeRef();
  var content=aiPanelResults[aiActiveTab]||(ar&&ar.deep&&ar.deep[aiActiveTab])||'';
  if(!content){toast('No content to share');return;}
  var base=aiActiveTab.replace('_book','');
  var title=(TOOL_LABELS[base]||base)+' — '+(ar&&ar.reference?ar.reference:'');
  var text=title+'\n\n'+content+'\n\n- Arche Pilgrim';
  if(navigator.share){navigator.share({title:title,text:text}).catch(function(){});}
  else if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){toast('Copied to clipboard');});}
  else{window.prompt('Copy this result:',text);}
}


// ════════════════════════════════════════════════════════

// SECTION 15 — LEXICON & WORD LIST
// Word lookup (BDAG, BDB, Thayer), word save/remove, and
// word list rendering for global and study-level word lists.
// ════════════════════════════════════════════════════════
// libTab declared in module header
var _lexLastResult=null; // {query, html, reference, studyId, studyTitle}
var _lexSaveContext=null; // 'global' | 'study' | null

/**
 * Switches the Library between the Studies and Words tabs.
 * Toggles .on classes on tab buttons, shows/hides panels, and triggers renderWordList() when switching to words.
 * @param {string} tab - Tab key: 'studies' | 'words'.
 */
function switchLibTab(tab){
  libTab=tab;
  document.getElementById('lib-tab-studies').classList.toggle('on',tab==='studies');
  document.getElementById('lib-tab-words').classList.toggle('on',tab==='words');
  document.getElementById('lib-studies-panel').style.display=tab==='studies'?'':'none';
  document.getElementById('lib-words-panel').style.display=tab==='words'?'':'none';
  if(tab==='words')renderWordList();
}

// _wlCache declared in module header
// _swCache declared in module header
/**
 * Renders the global Word List: all words with inGlobal=true from every study,
 * plus words saved without a study. Sorts alphabetically. Shows empty state if none saved.
 */
function renderWordList(){
  loadStudies();
  var words=[];
  studies.forEach(function(s){
    (s.words||[]).forEach(function(w){
      if(w.inGlobal)words.push(Object.assign({},w,{_studyTitle:s.title||'Untitled',_studyId:s.id}));
    });
  });
  // Also include words saved without a study open
  try{var gw=JSON.parse(localStorage.getItem(SK_WORDS)||'[]');gw.forEach(function(w){words.push(Object.assign({},w,{_studyTitle:'(no study)',_studyId:null}));});}catch(e){}
  words.sort(function(a,b){return (a.query||'').localeCompare(b.query||'');});
  _wlCache=words;
  var el=document.getElementById('word-list');if(!el)return;
  if(!words.length){
    el.innerHTML='<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="40" height="40"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><h3>No words saved yet</h3><p>Look up a word in the Lexicon and tap Save Word</p></div>';
    return;
  }
  el.innerHTML=words.map(function(w,i){
    var excerpt=htmlToText(w.html||'').replace(/\s+/g,' ').slice(0,120).trim();
    var meta=(w.reference||'')+' — '+(w._studyTitle||'');
    return '<div class="word-card">'+
      '<div class="word-card-word">'+escHtml(w.query||'')+'</div>'+
      '<div class="word-card-excerpt">'+escHtml(excerpt)+'</div>'+
      '<div class="word-card-meta">'+escHtml(meta)+'</div>'+
      '<div class="word-card-actions">'+
        '<button class="btn btn-ghost btn-sm" data-wli="'+i+'" onclick="wlView(this)" style="font-size:11px;padding:4px 10px;min-height:28px;">View</button>'+
        '<button class="btn btn-sm" data-wli="'+i+'" onclick="wlRemove(this)" style="font-size:11px;padding:4px 10px;min-height:28px;color:var(--crimsonbright);background:none;border:1px solid var(--border);">Remove</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
/**
 * Opens the word detail overlay for a word in the global word list.
 * Reads the list index from the data-wli attribute on the clicked button.
 * @param {HTMLElement} btn - The View button element.
 */
function wlView(btn){var i=parseInt(btn.getAttribute('data-wli'));var w=_wlCache[i];if(w)showWordDetail(w._studyId,w.id);}
/**
 * Removes a word from the global word list.
 * Reads the list index from the data-wli attribute on the clicked button.
 * @param {HTMLElement} btn - The Remove button element.
 */
function wlRemove(btn){var i=parseInt(btn.getAttribute('data-wli'));var w=_wlCache[i];if(w)removeWordGlobal(w._studyId,w.id);}

/**
 * Renders the study-level word list in the Field Notes panel.
 * Shows only words with inStudy=true for the current study. Hides the section if empty.
 */
function renderStudyWords(){
  if(!cur||!cur.words){
    document.getElementById('study-words-section').style.display='none';return;
  }
  var words=(cur.words||[]).filter(function(w){return w.inStudy;});
  _swCache=words;
  var sec=document.getElementById('study-words-section');
  var list=document.getElementById('study-word-list');
  if(!words.length){sec.style.display='none';return;}
  sec.style.display='';
  list.innerHTML=words.map(function(w,i){
    var excerpt=htmlToText(w.html||'').replace(/\s+/g,' ').slice(0,100).trim();
    return '<div class="word-card">'+
      '<div class="word-card-word">'+escHtml(w.query||'')+'</div>'+
      '<div class="word-card-excerpt">'+escHtml(excerpt)+'</div>'+
      '<div class="word-card-meta">'+(w.reference?escHtml(w.reference):'')+'</div>'+
      '<div class="word-card-actions">'+
        '<button class="btn btn-ghost btn-sm" data-swi="'+i+'" onclick="swView(this)" style="font-size:11px;padding:4px 10px;min-height:28px;">View</button>'+
        '<button class="btn btn-sm" data-swi="'+i+'" onclick="swRemove(this)" style="font-size:11px;padding:4px 10px;min-height:28px;color:var(--crimsonbright);background:none;border:1px solid var(--border);">Remove</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
/**
 * Opens the word detail overlay for a word in the study-level word list.
 * @param {HTMLElement} btn - The View button element (carries data-swi attribute).
 */
function swView(btn){var i=parseInt(btn.getAttribute('data-swi'));var w=_swCache[i];if(w)showWordDetailCur(w.id);}
/**
 * Removes a word from the current study's word list.
 * @param {HTMLElement} btn - The Remove button element (carries data-swi attribute).
 */
function swRemove(btn){var i=parseInt(btn.getAttribute('data-swi'));var w=_swCache[i];if(w)removeWordStudy(w.id);}

/**
 * Opens the lexicon overlay pre-populated with a saved word's full HTML result.
 * If studyId is null, searches the standalone global store; otherwise searches the study's words.
 * @param {string|null} studyId - The study ID containing the word, or null.
 * @param {string} wordId - The word's unique id.
 */
function showWordDetail(studyId,wordId){
  if(!studyId){
    try{var gw=JSON.parse(localStorage.getItem(SK_WORDS)||'[]');var w=gw.find(function(x){return x.id===wordId;});if(w)_showWordOverlay(w);}catch(e){}
    return;
  }
  var s=studies.find(function(x){return x.id===studyId;});
  if(!s)return;
  var w=(s.words||[]).find(function(x){return x.id===wordId;});
  if(!w)return;
  _showWordOverlay(w);
}
/**
 * Opens the lexicon overlay for a saved word in the currently open study.
 * @param {string} wordId - The word's unique id in cur.words.
 */
function showWordDetailCur(wordId){
  if(!cur)return;
  var w=(cur.words||[]).find(function(x){return x.id===wordId;});
  if(!w)return;
  _showWordOverlay(w);
}
/**
 * Populates and shows the lexicon overlay with a pre-saved word's data.
 * Hides the save bar since the word is already saved.
 * @param {Object} w - Word object containing query and html fields.
 */
function _showWordOverlay(w){
  var ov=document.getElementById('lexicon-overlay');
  var inp=document.getElementById('lexicon-input');
  var res=document.getElementById('lexicon-result');
  var bar=document.getElementById('lex-save-bar');
  if(inp)inp.value=w.query||'';
  if(res)res.innerHTML=w.html||'';
  if(bar)bar.style.display='none';
  ov.classList.add('on');
}

/**
 * Opens the word save sheet overlay for the most recent lexicon result.
 * Pre-fills the word label and current study name. Restores previous checkbox state.
 */
function openLexSaveSheet(){
  if(!_lexLastResult){toast('No word to save');return;}
  document.getElementById('lex-save-word-label').textContent=_lexLastResult.query||'';
  document.getElementById('lex-save-study-name').textContent=cur?('Current: '+(cur.title||'Untitled')):'(no study open)';
  var cbG=document.getElementById('lex-cb-global');
  var cbS=document.getElementById('lex-cb-study');
  cbG.className='lex-cb'+(_lexSaveContext==='global'?' on':'');
  cbS.className='lex-cb'+(_lexSaveContext==='study'?' on':'');
  document.getElementById('lex-save-overlay').classList.add('on');
}
/**
 * Toggles the 'on' class on a lexicon save checkbox (global or study).
 * @param {string} which - 'global' or 'study'.
 */
function toggleLexCb(which){
  var el=document.getElementById('lex-cb-'+which);
  if(el)el.classList.toggle('on');
}
/**
 * Saves the last lexicon result to the global word list, study word list, or both.
 * Merges flags if the word already exists — never clears inGlobal/inStudy on re-save.
 * Persists, re-renders word lists, and triggers a Gist sync if online.
 */
function saveLexWord(){
  if(!_lexLastResult){closeOverlay('lex-save-overlay');return;}
  var toGlobal=document.getElementById('lex-cb-global').classList.contains('on');
  var toStudy=document.getElementById('lex-cb-study').classList.contains('on');
  if(!toGlobal&&!toStudy){toast('Select at least one option');return;}
  if(toStudy&&!cur){toast('Open a study first to save to it');return;}
  // Standalone global store: used when saving a word with no study open (no cur to attach to)
  if(toGlobal&&!toStudy&&!cur){
    var gWords=[];try{gWords=JSON.parse(localStorage.getItem(SK_WORDS)||'[]');}catch(e){}
    var ar2=activeRef();
    var gWord={id:String(Date.now()+Math.random()),query:_lexLastResult.query,html:_lexLastResult.html,reference:ar2?ar2.reference:'',savedAt:new Date().toISOString(),inGlobal:true,inStudy:false,_studyId:null,_studyTitle:'(no study)'};
    gWords=gWords.filter(function(w){return w.query!==gWord.query;}); // Remove prior entry for same word before re-adding
    gWords.push(gWord);
    try{localStorage.setItem(SK_WORDS,JSON.stringify(gWords));}catch(e){toast('Storage full');return;}
    closeOverlay('lex-save-overlay');
    toast('Word saved to Word List');
    return;
  }
  var ar=activeRef();
  var word={
    id:String(Date.now()+Math.random()),
    query:_lexLastResult.query,
    html:_lexLastResult.html,
    reference:ar?ar.reference:'',
    savedAt:new Date().toISOString(),
    inGlobal:toGlobal,
    inStudy:toStudy
  };
  if(!cur.words)cur.words=[];
  // Merge by query string — if the word was already saved, update its flags rather than overwriting
  // This preserves both inGlobal and inStudy if either was already set on a prior save
  var existing=cur.words.find(function(w){return w.query===word.query;});
  if(existing){
    if(toGlobal)existing.inGlobal=true;
    if(toStudy)existing.inStudy=true;
    existing.html=word.html;
    existing.savedAt=word.savedAt;
    if(!existing.reference&&word.reference)existing.reference=word.reference;
  } else {
    cur.words.push(word);
  }
  persist();
  if(toStudy)renderStudyWords();
  closeOverlay('lex-save-overlay');
  toast('Word saved'+(toGlobal&&toStudy?' to both lists':toGlobal?' to Word List':' to study'));
  if(online)setTimeout(function(){syncToGist(true);},800);
}
/**
 * Removes a word from the global word list by clearing its inGlobal flag.
 * Deletes the word object entirely if inStudy is also false.
 * @param {string} studyId - The study containing the word.
 * @param {string} wordId - The word's unique id.
 */
function removeWordGlobal(studyId,wordId){
  loadStudies();
  var s=studies.find(function(x){return x.id===studyId;});
  if(!s||!s.words)return;
  var w=s.words.find(function(x){return x.id===wordId;});
  if(!w)return;
  w.inGlobal=false;
  // Only delete the word object entirely if it's also not in the study list
  if(!w.inStudy)s.words=s.words.filter(function(x){return x.id!==wordId;});
  persist();renderWordList();toast('Removed from Word List');
  if(online)setTimeout(function(){syncToGist(true);},800);
}
/**
 * Removes a word from the current study's word list by clearing its inStudy flag.
 * Deletes the word object entirely if inGlobal is also false.
 * @param {string} wordId - The word's unique id in cur.words.
 */
function removeWordStudy(wordId){
  if(!cur||!cur.words)return;
  var w=cur.words.find(function(x){return x.id===wordId;});
  if(!w)return;
  w.inStudy=false;
  // Only delete the word object entirely if it's also not in the global list
  if(!w.inGlobal)cur.words=cur.words.filter(function(x){return x.id!==wordId;});
  persist();renderStudyWords();toast('Removed from study');
  if(online)setTimeout(function(){syncToGist(true);},800);
}

/**
 * Opens the lexicon lookup overlay in general mode (no pre-selected save context).
 * Resets _lexSaveContext to null and focuses the input after a short delay.
 */
function openLexiconModal(){var ov=document.getElementById('lexicon-overlay');ov.classList.add('on');document.getElementById('lex-save-bar').style.display='none';_lexSaveContext=null;setTimeout(function(){var inp=document.getElementById('lexicon-input');if(inp)inp.focus();},200);}
/**
 * Opens the lexicon overlay with a pre-selected save context ('global' or 'study').
 * Clears any previous result and focuses the input.
 * @param {string} context - Save context: 'global' | 'study'.
 */
function openLexiconModalFor(context){
  _lexSaveContext=context;
  var ov=document.getElementById('lexicon-overlay');
  var inp=document.getElementById('lexicon-input');
  var res=document.getElementById('lexicon-result');
  ov.classList.add('on');
  if(inp){inp.value='';inp.focus&&setTimeout(function(){inp.focus();},200);}
  if(res)res.innerHTML='';
  document.getElementById('lex-save-bar').style.display='none';
  _lexLastResult=null;
}
/**
 * Closes the lexicon lookup overlay.
 */
function closeLexiconModal(){document.getElementById('lexicon-overlay').classList.remove('on');}
/**
 * Runs a lexicon lookup for the query in the lexicon input field via the Groq API.
 * Requests a JSON response with Strong's number, definitions, scholarly entry, and concordance.
 * Renders the result with renderLexiconEntry() and stores it in _lexLastResult.
 */
async function runLexiconLookup(){
  var inp=document.getElementById('lexicon-input');
  var res=document.getElementById('lexicon-result');
  var btn=document.getElementById('lexicon-btn');
  var bar=document.getElementById('lex-save-bar');
  var query=(inp?inp.value.trim():'');if(!query)return;
  btn.disabled=true;btn.textContent='Looking up\u2026';
  res.innerHTML='<div style="display:flex;align-items:center;gap:10px;color:var(--txt3);padding:8px 0;"><div class="spin"></div>Searching lexicon\u2026</div>';
  bar.style.display='none';
  var prompt='You are a biblical lexicographer with deep knowledge of Greek NT and Hebrew OT.\nThe user has looked up: "'+query+'"\n\nIf the input is a Strong\'s number (G#### or H####), use that number. If it is an English word, transliteration, or original language word, identify the most likely Strong\'s number.\n\nReturn ONLY a valid JSON object — absolutely no markdown fences, no backticks, no preamble, no text before or after the JSON. Use this exact structure:\n\n{"strongsNumber":"G#### or H####","testament":"NT or OT","originalWord":"word in original script","transliteration":"romanized form","pronunciation":"phonetic e.g. log\'-os","partOfSpeech":"e.g. masculine noun","gender":"masculine/feminine/neuter or null","rootWord":"etymology e.g. from λέγω (G3004) or null","tdntReference":"vol:page,entry or null","primaryDefinition":"concise primary definition","usageOutline":["I. main usage","   A. sub-usage","   B. sub-usage","II. second main usage"],"kjvCount":0,"kjvTranslations":[{"word":"translation","count":0}],"strongsDefinition":"full Strong\'s Concordance definition text","scholarlyEntry":"150-200 word summary of Thayer\'s Greek Lexicon (NT) or Brown-Driver-Briggs (OT) in their scholarly style","occurrences":[{"ref":"Book Ch:v","text":"full verse text (KJV) showing the word in context"}]}\n\nFor occurrences: list ALL known occurrences up to 30. For very common words (100+ occurrences), list the 25 most theologically significant. Always include the full verse text, never just the reference.';
  try{
    var r=await fetch(WORKER_URL+'/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',max_tokens:3000,messages:[{role:'user',content:prompt}]})});
    var d=await r.json();
    if(!r.ok){res.innerHTML='<p style="color:var(--crimsonbright);font-size:13px;">'+groqErrMsg(d.error&&d.error.message?d.error.message:'HTTP '+r.status)+'</p>';return;}
    var raw=d.choices[0].message.content;
    var clean=raw.replace(/```json|```/g,'').trim();
    // Defensively extract JSON — AI occasionally wraps output in prose or residual markdown
    var firstBrace=clean.indexOf('{'),lastBrace=clean.lastIndexOf('}');
    if(firstBrace>-1&&lastBrace>-1)clean=clean.slice(firstBrace,lastBrace+1);
    var lex=JSON.parse(clean);
    var html=renderLexiconEntry(lex,query);
    res.innerHTML=html;
    _lexLastResult={query:lex.originalWord||lex.transliteration||query,html:html,reference:(activeRef()&&activeRef().reference)||''};
    bar.style.display='';
  }catch(e){
    // Distinguish parse errors (bad JSON from AI) from network/API errors
    if(e instanceof SyntaxError){
      res.innerHTML='<p style="color:var(--crimsonbright);font-size:13px;">Could not parse lexicon data — please try again.</p>';
    }else{
      res.innerHTML='<p style="color:var(--crimsonbright);font-size:13px;">'+groqErrMsg(e.message)+'</p>';
    }
    bar.style.display='none';
  }finally{btn.disabled=false;btn.textContent='Look up';}
}

/**
 * Renders a parsed lexicon data object into an HTML string for display in the overlay.
 * Sections: header, usage outline, KJV count, Strong's definition, Thayer/BDB entry, concordance.
 * @param {Object} lex - Parsed lexicon JSON from the AI response.
 * @param {string} query - The original user query string (fallback display label).
 * @returns {string} Fully-rendered HTML string.
 */
function renderLexiconEntry(lex,query){
  var h='';
  // ── Header ──
  h+='<div class="lex-header">';
  h+='<div><span class="lex-strongs-badge">'+(lex.strongsNumber||'')+'</span></div>';
  h+='<div class="lex-word">'+(lex.originalWord||query||'')+'</div>';
  if(lex.transliteration)h+='<div class="lex-translit">'+lex.transliteration+'</div>';
  if(lex.pronunciation)h+='<div class="lex-pronun">'+lex.pronunciation+'</div>';
  var metaParts=[];
  if(lex.partOfSpeech)metaParts.push(lex.partOfSpeech);
  if(lex.rootWord)metaParts.push(lex.rootWord);
  if(lex.tdntReference)metaParts.push('TDNT '+lex.tdntReference);
  if(metaParts.length)h+='<div class="lex-meta">'+metaParts.join(' &nbsp;·&nbsp; ')+'</div>';
  h+='</div>';
  // ── Usage Outline ──
  h+='<div class="lex-section">';
  h+='<div class="lex-sec-title">Outline of Biblical Usage</div>';
  if(lex.primaryDefinition)h+='<div class="lex-primary-def">'+lex.primaryDefinition+'</div>';
  if(lex.usageOutline&&lex.usageOutline.length){
    lex.usageOutline.forEach(function(line){
      var indent=line.match(/^\s+/);var spaces=indent?indent[0].length:0;
      var cls=spaces>=4?'sub2':spaces>=2?'sub':'';
      h+='<div class="lex-outline-row'+( cls?' '+cls:'')+'">'+line.trim()+'</div>';
    });
  }
  h+='</div>';
  // ── KJV Count ──
  if(lex.kjvCount){
    h+='<div class="lex-section">';
    h+='<div class="lex-sec-title">KJV Translation Count: '+lex.kjvCount+'\u00d7</div>';
    if(lex.kjvTranslations&&lex.kjvTranslations.length){
      h+='<div style="margin-top:4px">';
      lex.kjvTranslations.forEach(function(t){h+='<span class="lex-kjv-pill"><b>'+t.word+'</b> ('+t.count+'\u00d7)</span>';});
      h+='</div>';
    }
    h+='</div>';
  }
  // ── Strong's Definition ──
  if(lex.strongsDefinition){
    h+='<div class="lex-section">';
    h+='<div class="lex-sec-title">Strong\'s Definition</div>';
    h+='<div class="lex-def-text">'+lex.strongsDefinition+'</div>';
    h+='</div>';
  }
  // ── Thayer's / BDB ──
  if(lex.scholarlyEntry){
    var lexLabel=(lex.testament==='OT')?'Brown-Driver-Briggs Hebrew Lexicon':'Thayer\'s Greek Lexicon';
    h+='<div class="lex-section">';
    h+='<div class="lex-sec-title">'+lexLabel+'</div>';
    h+='<div class="lex-scholarly-text">'+lex.scholarlyEntry+'</div>';
    h+='</div>';
  }
  // ── Concordance ──
  if(lex.occurrences&&lex.occurrences.length){
    h+='<div class="lex-section">';
    h+='<div class="lex-sec-title">Concordance &mdash; '+lex.occurrences.length+' Occurrence'+(lex.occurrences.length!==1?'s':'')+'</div>';
    lex.occurrences.forEach(function(occ){
      h+='<div class="lex-occur">';
      h+='<div class="lex-occur-ref">'+occ.ref+'</div>';
      h+='<div class="lex-occur-text">'+occ.text+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }
  h+='<div class="lex-footer">Lexicon data generated by AI \u2014 verify against primary sources. All theological conclusions are yours.</div>';
  return h;
}


// ════════════════════════════════════════════════════════

// SECTION 16 — RESOURCES & OCR
// Photo capture, document upload, image compression, and OCR via Groq.
// Resources are attached to the active study and rendered in the panel.
// ════════════════════════════════════════════════════════
/**
 * Triggers the camera or gallery file input for capturing a resource image.
 * @param {string} mode - 'camera' to trigger camera capture, anything else for gallery.
 */
function resCapture(mode){if(!cur){toast('Open a study first');return;}var el=document.getElementById(mode==='camera'?'res-input-camera':'res-input-gallery');el.value='';el.click();}
/**
 * Triggers the document file input for attaching a DOCX, DOC, TXT, or MD resource.
 */
function resAddDocPrompt(){if(!cur){toast('Open a study first');return;}var el=document.getElementById('res-input-doc');el.value='';el.click();}
/**
 * Handles a document file selected via the doc file input.
 * Uses mammoth.js for DOCX/DOC; FileReader text mode for TXT/MD.
 * Truncates at 30,000 characters to prevent oversized storage entries.
 * @param {HTMLInputElement} input - The file input element.
 */
function resHandleDoc(input){
  var file=input.files[0];if(!file)return;
  var name=file.name;
  var ext=name.split('.').pop().toLowerCase();
  toast('Reading '+name+'...');
  if(ext==='docx'||ext==='doc'){
    // Use mammoth.js for DOCX
    if(typeof mammoth==='undefined'){toast('Document reader not loaded — try refreshing');return;}
    var reader=new FileReader();
    reader.onload=function(e){
      mammoth.extractRawText({arrayBuffer:e.target.result}).then(function(result){
        resAddDocResource(name,result.value||'No text could be extracted.');
      }).catch(function(err){toast('Could not read document: '+err.message);});
    };
    reader.readAsArrayBuffer(file);
  } else {
    // TXT, MD — read as plain text
    var reader=new FileReader();
    reader.onload=function(e){resAddDocResource(name,e.target.result||'');};
    reader.readAsText(file);
  }
}
/**
 * Creates a document resource object and attaches it to the current study.
 * Truncates text at 30,000 characters with a truncation notice.
 * @param {string} filename - The original document filename (used as resource title).
 * @param {string} text - Extracted plain text content from the document.
 */
function resAddDocResource(filename,text){
  if(!cur.resources)cur.resources=[];
  var maxChars=30000;
  var trimmed=text.trim();
  var truncated=trimmed.length>maxChars;
  if(truncated)trimmed=trimmed.slice(0,maxChars)+'\n\n[Document truncated — only first portion stored to save space]';
  var res={
    id:'r'+Date.now(),
    type:'doc',
    dataUrl:'',
    ocrText:trimmed,
    ocrStatus:'done',
    title:filename,
    date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
  };
  cur.resources.push(res);
  saveStudy();
  renderResources();
  toast(truncated?'Document added (large file — first portion stored)':'Document added — tap to view or insert into notes');
}
/**
 * Handles image file(s) selected via the camera/gallery file input.
 * Compresses each image before attaching it as a resource.
 * @param {HTMLInputElement} input - The file input element.
 */
function resHandleFile(input){if(!input.files||!input.files.length)return;Array.prototype.forEach.call(input.files,function(file){var reader=new FileReader();reader.onload=function(e){resCompressImage(e.target.result,function(c){resAddResource(c);});};reader.readAsDataURL(file);});}
/**
 * Compresses an image data URL to a max of 900px on either dimension at 72% JPEG quality.
 * @param {string} dataUrl - Base64 image data URL to compress.
 * @param {Function} callback - Called with the compressed data URL.
 */
function resCompressImage(dataUrl,callback){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas'),MAX=900,w=img.width,h=img.height;
    // Scale down proportionally — clamp the longest dimension to MAX, preserve aspect ratio
    if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
    if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);callback(canvas.toDataURL('image/jpeg',0.72));};img.src=dataUrl;}
/**
 * Creates an image resource object, attaches it to the study, saves, and triggers OCR.
 * @param {string} dataUrl - Compressed base64 JPEG data URL.
 */
function resAddResource(dataUrl){if(!cur.resources)cur.resources=[];var res={id:'r'+Date.now(),dataUrl:dataUrl,ocrText:'',ocrStatus:'pending',title:'Resource '+(cur.resources.length+1),date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};cur.resources.push(res);saveStudy();renderResources();resRunOCR(res.id);}
/**
 * Runs OCR on a resource image via the arche-proxy /ocr endpoint (Llama 4 Scout).
 * Updates the resource's ocrText and ocrStatus, saves, and re-renders resources.
 * @param {string} id - Resource id within cur.resources.
 */
async function resRunOCR(id){
  if(!cur||!cur.resources)return;
  var res=cur.resources.find(function(r){return r.id===id;});if(!res)return;

  if(!online){res.ocrStatus='error';res.ocrText='Offline - reconnect to extract text.';renderResources();return;}
  res.ocrStatus='running';renderResources();
  try{
    // Data URL format: 'data:image/jpeg;base64,<b64>' — split to extract mime type and raw b64
    var b64=res.dataUrl.split(',')[1],mimeType=res.dataUrl.split(';')[0].split(':')[1];
    var body={model:'qwen/qwen3.6-27b',max_tokens:4096,messages:[{role:'user',content:[{type:'text',text:'Extract ALL text from this image exactly as it appears. Preserve line breaks, headings, bullet points, and numbered lists. Output raw extracted text only.'},{type:'image_url',image_url:{url:'data:'+mimeType+';base64,'+b64}}]}]};
    var resp=await fetch(WORKER_URL+'/ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok){var err=await resp.json().catch(function(){return{};});var msg=(err.error&&err.error.message)||err.message||('HTTP '+resp.status);throw new Error(msg);}
    var data=await resp.json();
    var text=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
    res.ocrText=text||'No text could be extracted.';res.ocrStatus='done';
    saveStudy();renderResources();toast('Text extracted');
  }catch(e){res.ocrStatus='error';res.ocrText='Text extraction error: '+e.message;saveStudy();renderResources();}
}
/**
 * Permanently removes a resource from the current study by id.
 * @param {string} id - Resource id to remove.
 */
function resDeleteResource(id){if(!cur||!cur.resources)return;cur.resources=cur.resources.filter(function(r){return r.id!==id;});saveStudy();renderResources();toast('Resource removed');}
/**
 * Resets a resource's OCR status to pending and re-runs OCR.
 * @param {string} id - Resource id to retry.
 */
function resRetryOCR(id){if(!cur||!cur.resources)return;var res=cur.resources.find(function(r){return r.id===id;});if(res){res.ocrStatus='pending';res.ocrText='';}renderResources();resRunOCR(id);}
/**
 * Toggles the expanded/collapsed state of an OCR text block.
 * Updates the toggle button label between "Show more" and "Show less".
 * @param {string} id - Resource id.
 */
function resToggleText(id){var el=document.getElementById('res-ocr-'+id);if(!el)return;el.classList.toggle('collapsed');var btn=document.getElementById('res-toggle-'+id);if(btn)btn.textContent=el.classList.contains('collapsed')?'Show more':'Show less';}
/**
 * Opens the resource detail overlay showing the full image or document text for a resource.
 * @param {string} id - Resource id to display.
 */
function resViewFull(id){
  if(!cur||!cur.resources)return;
  var res=cur.resources.find(function(r){return r.id===id;});if(!res)return;
  var isDoc=res.type==='doc';
  var ob='';
  if(res.ocrStatus==='running')ob='<div style="display:flex;align-items:center;gap:9px;padding:8px 0;color:var(--txt3);font-size:13px;font-style:italic"><div class="spin"></div>Extracting...</div>';
  else if(res.ocrStatus==='done'&&res.ocrText)ob='<div style="font-size:14px;color:var(--txt2);line-height:1.7;white-space:pre-wrap;margin-bottom:12px">'+escHtml(res.ocrText)+'</div><button class="res-insert-btn" onclick="resInsertText(\''+id+'\');closeOverlay(\'res-view-overlay\')">&#43; Insert into Notes</button>';
  else if(res.ocrStatus==='error')ob='<div style="color:var(--crimsonbright);font-size:13px;margin-bottom:10px">'+escHtml(res.ocrText)+'</div>';
  else ob='<div style="color:var(--txt4);font-size:12px;font-style:italic">Extracting text...</div>';
  var ov=document.getElementById('res-view-overlay');
  if(!ov){ov=document.createElement('div');ov.id='res-view-overlay';ov.className='overlay';ov.innerHTML='<div class="modal" style="max-width:520px"></div>';ov.addEventListener('click',function(e){if(e.target===ov)ov.classList.remove('on');});document.body.appendChild(ov);}
  var imgHtml=isDoc
    ?'<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg3);border-radius:var(--r);margin-bottom:14px"><svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="font-size:13px;color:var(--txt3)">Document</span></div>'
    :'<img src="'+res.dataUrl+'" style="width:100%;max-height:240px;object-fit:contain;border-radius:var(--r);margin-bottom:14px;background:var(--bg3);display:block">';
  var reExtractBtn=isDoc?'':'<button class="btn btn-ghost btn-sm" onclick="resRetryOCR(\''+id+'\')" style="font-size:12px">Re-extract</button>';
  var topBar='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)"><button class="btn btn-ghost btn-sm" onclick="resEditTitle(\''+id+'\')" style="font-size:12px">Rename</button>'+reExtractBtn+'<button class="btn btn-danger btn-sm" onclick="resDeleteResource(\''+id+'\');closeOverlay(\'res-view-overlay\')" style="font-size:12px">&#128465; Delete</button><button class="btn btn-sec btn-sm" onclick="closeOverlay(\'res-view-overlay\')" style="font-size:12px;margin-left:auto">Close</button></div>';
  ov.querySelector('.modal').innerHTML=imgHtml+'<div style="font-family:\'EB Garamond\',serif;font-size:18px;color:var(--txt1);margin-bottom:4px">'+escHtml(res.title)+'</div><div style="font-size:11px;color:var(--txt4);margin-bottom:12px">'+res.date+'</div>'+topBar+'<div class="seclabel">'+(isDoc?'Document Content':'Extracted Text')+'</div>'+ob;
  ov.classList.add('on');
}
/**
 * Opens the rename overlay pre-filled with the current resource title.
 * @param {string} id - Resource id to rename.
 */
function resEditTitle(id){if(!cur||!cur.resources)return;var res=cur.resources.find(function(r){return r.id===id;});if(!res)return;_renameResId=id;document.getElementById('rename-res-input').value=res.title;document.getElementById('rename-res-overlay').classList.add('on');setTimeout(function(){var inp=document.getElementById('rename-res-input');if(inp){inp.focus();inp.select();}},200);}
/**
 * Confirms renaming the pending resource (stored in _renameResId) with the input value.
 * Saves the study and re-renders resources after the rename.
 */
function confirmRenameRes(){if(!_renameResId||!cur||!cur.resources)return;var res=cur.resources.find(function(r){return r.id===_renameResId;});if(res){var t=document.getElementById('rename-res-input').value.trim();if(t){res.title=t;saveStudy();renderResources();}}  _renameResId=null;closeOverlay('rename-res-overlay');}
/**
 * Renders the full resources panel: all image and document resources attached to the current study.
 * Shows an empty state with action buttons if no resources exist.
 */
function renderResources(){
  var list=document.getElementById('res-list'),status=document.getElementById('res-status');
  if(!list)return;
  if(!cur||!cur.resources||!cur.resources.length){list.innerHTML='<p style="font-size:12px;color:var(--txt4);font-style:italic">No resources yet. Add photos or documents in the Notes tab.</p>';if(status)status.textContent='';renderFieldTiles();return;}
  if(status)status.textContent=cur.resources.length+' resource'+(cur.resources.length!==1?'s':'');
  list.innerHTML='<div class="res-tile-grid">'+cur.resources.map(function(r){
    var badge=r.ocrStatus==='done'&&r.ocrText?'<div class="res-tile-badge" title="Text ready"></div>':'';
    if(r.type==='doc'){
      return '<div class="res-tile" onclick="resViewFull(\''+r.id+'\')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px;min-height:80px;">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" width="24" height="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
        badge+
        '<div class="res-tile-label" style="text-align:center;margin-top:4px">'+escHtml(r.title)+'</div>'+
      '</div>';
    }
    return '<div class="res-tile" onclick="resViewFull(\''+r.id+'\')">'+
      '<img src="'+r.dataUrl+'" alt="'+escHtml(r.title)+'">'+
      badge+
      '<div class="res-tile-label">'+escHtml(r.title)+'</div>'+
    '</div>';
  }).join('')+'</div>';
  renderFieldTiles();
}
/**
 * Renders the action tile grid in the Field Notes panel (Lexicon, Resources, Snapshot, etc.).
 */
function renderFieldTiles(){
  var el=document.getElementById('field-res-tiles');if(!el)return;
  if(!cur||!cur.resources||!cur.resources.length){el.innerHTML='';return;}
  el.innerHTML='<div class="res-tile-grid">'+cur.resources.map(function(r){
    var badge=r.ocrStatus==='done'&&r.ocrText?'<div class="res-tile-badge" title="Text ready"></div>':'';
    if(r.type==='doc'){
      return '<div class="res-tile" onclick="resViewFull(\''+r.id+'\')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px;min-height:80px;">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" width="24" height="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
        badge+
        '<div class="res-tile-label" style="text-align:center;margin-top:4px">'+escHtml(r.title)+'</div>'+
      '</div>';
    }
    return '<div class="res-tile" onclick="resViewFull(\''+r.id+'\')">'+
      '<img src="'+r.dataUrl+'" alt="'+escHtml(r.title)+'">'+
      badge+
      '<div class="res-tile-label">'+escHtml(r.title)+'</div>'+
    '</div>';
  }).join('')+'</div>';
}
/**
 * Inserts a resource's OCR text into the Field Notes Quill editor at the cursor position.
 * @param {string} id - Resource id whose ocrText to insert.
 */
function resInsertText(id){
  var res=cur&&cur.resources&&cur.resources.find(function(r){return r.id===id;});
  if(!res||!res.ocrText){toast('No extracted text to insert');return;}
  var fn=window._qFN;
  if(!fn){toast('Switch to the Notes tab to insert text');return;}
  var idx=fn.getLength();
  fn.insertText(idx>1?idx-1:0,'\n['+res.title+']\n'+res.ocrText);
  if(cur)cur.fieldNotes=fn.root.innerHTML;
  _updateWordCount();
  toast('Text inserted into notes');
}


// ════════════════════════════════════════════════════════

// ── Named exports ─────────────────────────────────────────────────────────
// State setters and all public functions
export {
  // S11 — Bible API
  fetchScr, getESV, getApiBible, getBollsBible, getBibleAPI, renderScrText,
  copyScrip, openPasteModal, confirmPaste, renderTransSpectrum, openTransDetail,
  // S12 — Study Tools Panel
  populateDeep, toggleFnotes, toggleDeepScripture, toggleOutline,
  openResourcesModal, closeResPopout, showResScripture, showResMethod,
  toggleResSection, setScope, getBookFromRef, updateToolDots,
  buildPrompt, geminiErrMsg, groqErrMsg, runTool,
  // S13 — Study Snapshot + AI Panel
  snapshotIntent, runSnapshot, cancelSnapshot, showAIPanel, renderAITabs,
  switchAITab, renderAIPanelContent, closeAIPanel,
  // S14-partial — Expand / Copy / Share
  updateExpandBtn, expandCurrentTool, copyAIResult, shareAIResult,
  // S15 — Lexicon & Word List
  libTab, switchLibTab, renderWordList, wlView, wlRemove,
  renderStudyWords, swView, swRemove,
  showWordDetail, showWordDetailCur, _showWordOverlay,
  openLexSaveSheet, toggleLexCb, saveLexWord,
  removeWordGlobal, removeWordStudy,
  openLexiconModal, openLexiconModalFor, closeLexiconModal,
  runLexiconLookup, renderLexiconEntry,
  // S16 — Resources & OCR
  resCapture, resAddDocPrompt, resHandleDoc, resAddDocResource,
  resHandleFile, resCompressImage, resAddResource, resRunOCR,
  resDeleteResource, resRetryOCR, resToggleText, resViewFull,
  resEditTitle, confirmRenameRes, renderResources, renderFieldTiles, resInsertText
};