// utils.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 2: exports added
// Sections: 01, 02, 03, 07 (partial), 27 (partial), 29
// See pilgrim-es-modules-plan-v1.md for full module map

// SECTION 01 — CONFIGURATION & CONSTANTS
// App-wide URLs, storage keys, lookup tables, default data, and tool labels.
// All declarations here are set once and treated as read-only at runtime.
// ════════════════════════════════════════════════════════
var WORKER_URL='https://arche-proxy.archestudytools.workers.dev';
var ACTIVE_USER=null; // set by initPinGate()/activateUser() before any storage access
var BOLLS_TRANS={nkjv:'NKJV',net:'NET',amp:'AMP',csb:'CSB17',nlt:'NLT',msg:'MSG',nasb:'NASB',niv:'NIV2011'};
var BOLLS_BOOKS={genesis:1,gen:1,ge:1,exodus:2,exod:2,ex:2,leviticus:3,lev:3,le:3,numbers:4,num:4,nu:4,deuteronomy:5,deut:5,dt:5,joshua:6,josh:6,jos:6,judges:7,judg:7,jdg:7,ruth:8,rut:8,'1samuel':9,'1sam':9,'1sa':9,'2samuel':10,'2sam':10,'2sa':10,'1kings':11,'1kgs':11,'1ki':11,'2kings':12,'2kgs':12,'2ki':12,'1chronicles':13,'1chr':13,'1ch':13,'2chronicles':14,'2chr':14,'2ch':14,ezra:15,ezr:15,nehemiah:16,neh:16,ne:16,esther:17,esth:17,est:17,job:18,jb:18,psalms:19,psalm:19,ps:19,psa:19,proverbs:20,prov:20,pr:20,ecclesiastes:21,eccles:21,ecc:21,ec:21,'songofsolomon':22,'songofsongsofsolomon':22,'songofsolomon':22,sos:22,ss:22,isaiah:23,isa:23,jeremiah:24,jer:24,lamentations:25,lam:25,ezekiel:26,ezek:26,eze:26,daniel:27,dan:27,da:27,hosea:28,hos:28,joel:29,joe:29,amos:30,am:30,obadiah:31,obad:31,ob:31,jonah:32,jon:32,micah:33,mic:33,nahum:34,nah:34,habakkuk:35,hab:35,zephaniah:36,zeph:36,zep:36,haggai:37,hag:37,zechariah:38,zech:38,zec:38,malachi:39,mal:39,matthew:40,matt:40,mt:40,mark:41,mk:41,mr:41,luke:42,lk:42,lu:42,john:43,jn:43,joh:43,acts:44,act:44,ac:44,romans:45,rom:45,ro:45,'1corinthians':46,'1cor':46,'1co':46,'2corinthians':47,'2cor':47,'2co':47,galatians:48,gal:48,ga:48,ephesians:49,eph:49,philippians:50,phil:50,php:50,colossians:51,col:51,'1thessalonians':52,'1thess':52,'1th':52,'2thessalonians':53,'2thess':53,'2th':53,'1timothy':54,'1tim':54,'1ti':54,'2timothy':55,'2tim':55,'2ti':55,titus:56,tit:56,philemon:57,phlm:57,phm:57,hebrews:58,heb:58,james:59,jas:59,jm:59,'1peter':60,'1pet':60,'1pe':60,'2peter':61,'2pet':61,'2pe':61,'1john':62,'1jn':62,'1jo':62,'2john':63,'2jn':63,'3john':64,'3jn':64,jude:65,jud:65,revelation:66,rev:66,re:66};
/**
 * Parses a human-readable Bible reference string into a structured object.
 * Accepts book aliases, chapter, and optional verse range (e.g. "Rom 1:1-3").
 * Normalises the book name against BOLLS_BOOKS to resolve the numeric book ID.
 * @param {string} ref - Reference string to parse.
 * @returns {{book:number, chapter:number, startVerse:number|null, endVerse:number|null}|null}
 *   Parsed reference object, or null if the reference is unrecognised.
 */
function parseRef(ref){
  var m=ref.trim().match(/^(\d?\s*[a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?)?/);
  if(!m)return null;
  var bookRaw=m[1].replace(/\s+/g,'').toLowerCase();
  var bookId=BOLLS_BOOKS[bookRaw];
  if(!bookId)return null;
  return{book:bookId,chapter:parseInt(m[2]),startVerse:m[3]?parseInt(m[3]):null,endVerse:m[4]?parseInt(m[4]):null};
}
var APP_SHARE_URL='https://www.archestudytools.com/pilgrim-public/';
var SK_DIAG='bsn_diag_log';
var SK='bsn_studies_v2', SK_SETT='bsn_settings_v1', SK_TAGS='bsn_tags_v1', SK_TAGS_DEL='bsn_tags_deleted_v1';
var SK_OB='bsn_ob_done', SK_TAB_HINTS='bsn_tab_hints_shown';
var SK_UPDATE_SKIP='bsn_update_skip'; // Intentionally NOT namespaced in activateUser() — tracks which app version this browser dismissed the update banner for, not per-user study data (same treatment as bsn_active_user)
var SK_STREAK='bsn_streak', SK_TTS_SETT='bsn_tts_sett', SK_WORDS='bsn_words_global';
var SK_TOUR_STUDY_SEEN='bsn_tour_study_seen', SK_TOUR_SETTINGS_SEEN='bsn_tour_settings_seen'; // Guided Tours "seen" flags — namespaced per-user below, same as the other SK_* keys

// ════════════════════════════════════════════════════════

// SECTION 02 — APP STATE
// Runtime state: studies array, active study (cur), settings object, and UI flags.
// Initialized at startup; mutated throughout the session.
// ════════════════════════════════════════════════════════

var studies=[], cur=null, online=navigator.onLine, sett={scrMode:'auto', lastPasteTrans:'', defaultTrans:'esv', diagFeedback:false};
var _diagResults=[];
var hdrCollapsed=false, scrCollapsed=false, studyScope='passage';
var activeRefIdx=0;
var _editingTagId=null;
var _pendingDeleteId=null;
var _pendingDeleteTagId=null;
var _pendingDeleteRefIdx=null;
var _renameResId=null;
var _pendingUpdateVersion=null; // Version string detected by checkForUpdate(), set right before the update banner is shown; consumed by dismissUpdateBanner()
var TOOL_LABELS={lexical:'Word Study',grammar:'Language & Structure',historical:'Historical Context',cultural:'Cultural Context',crossrefs:'Cross-References',geography:'Places & Geography'};
var TOOL_DESCS={lexical:"Greek/Hebrew word meanings and Strong's numbers",grammar:'Verb tense, mood, sentence structure',historical:'Time period, political setting, authorship',cultural:'Customs, geography, social context',crossrefs:'Thematic, linguistic & narrative connections',geography:'Named locations, distances & terrain'};

var DEFAULT_TAGS=[
  {id:'sermon',  label:'Sermon',      color:'#7a4fa3', bg:'rgba(122,79,163,.18)'},
  {id:'devotion',label:'Devotional',  color:'#c9a84c', bg:'rgba(201,168,76,.15)'},
  {id:'group',   label:'Small Group', color:'#3a8a6e', bg:'rgba(58,138,110,.18)'},
  {id:'personal',label:'Personal',    color:'#4a7fb5', bg:'rgba(74,127,181,.18)'},
  {id:'prayer',  label:'Prayer',      color:'#8b3535', bg:'rgba(139,53,53,.22)'},
  {id:'study',   label:'Study',       color:'#5a7a3a', bg:'rgba(90,122,58,.18)'}
];
var TAGS=DEFAULT_TAGS.slice();

var TAG_PALETTE=[
  '#c9a84c','#7a4fa3','#3a8a6e','#4a7fb5','#8b3535','#5a7a3a',
  '#b05a2a','#2a7a8a','#8a2a7a','#4a5a8a','#6a3a2a','#2a5a3a'
];


// ════════════════════════════════════════════════════════

// SECTION 03 — UTILITIES
// Pure helpers with no side effects: overlay/toast notifications,
// date formatting, HTML escaping, text extraction, and DOM sizing.
// ════════════════════════════════════════════════════════

/**
 * Hides an overlay element by removing its 'on' class.
 * @param {string} id - The DOM id of the overlay element to close.
 */
function closeOverlay(id){document.getElementById(id).classList.remove('on');}
/** Timer handle used to cancel the toast auto-dismiss timeout. */
var _tt;
/**
 * Shows a standard toast notification that auto-dismisses after 2.4 seconds.
 * Resets style properties so previous toastSuccess styling does not bleed through.
 * @param {string} msg - The message text to display.
 */
function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.style.background='';el.style.color='';el.style.fontSize='';el.style.borderColor='';el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(function(){el.classList.remove('show');},2400);}
/**
 * Shows a gold-styled success toast that auto-dismisses after 2 seconds.
 * Resets all custom styles after dismiss to restore default toast appearance.
 * @param {string} msg - The message text to display.
 */
function toastSuccess(msg){var el=document.getElementById('toast');el.textContent=msg;el.style.background='var(--gold)';el.style.color='var(--bg1)';el.style.fontSize='15px';el.style.borderColor='var(--gold)';el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(function(){el.classList.remove('show');el.style.background='';el.style.color='';el.style.fontSize='';el.style.borderColor='';},2000);}
/**
 * Extracts plain text from an HTML string.
 * Inserts a space before block-level closing tags (p, div, li, br, h1-h6, td, th, tr)
 * to prevent words from running together at element boundaries.
 * @param {string} html - HTML string to convert.
 * @returns {string} Plain text content, or empty string if input is falsy.
 */
function htmlToText(html){if(!html)return '';var d=document.createElement('div');d.innerHTML=html.replace(/<\/(p|div|li|br|h[1-6]|td|th|tr)>/gi,' ');return d.textContent||d.innerText||'';}
/**
 * Syncs the --app-height CSS variable to the current window inner height.
 * Allows 100dvh-equivalent layout on browsers where vh includes the URL bar.
 */
function setAppHeight(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}
/**
 * Returns today's date as a YYYY-MM-DD string.
 * @returns {string} Today's ISO date (date portion only).
 */
function todayStr(){return new Date().toISOString().split('T')[0];}
/**
 * Toggles the offline badge visibility based on the global `online` flag.
 * Badge is shown when offline, hidden when online.
 */
function updateOffline(){document.getElementById('offbadge').classList.toggle('show',!online);}
/**
 * Returns a numeric sort index for a Bible book reference string.
 * Matches the start of the ref against BIBLE_BOOKS in canonical order.
 * @param {string} ref - A passage reference string (e.g. "Romans 1:1").
 * @returns {number} Zero-based index of the matching book, or 999 if not found.
 */
function bookOrder(ref){if(!ref)return 999;var r=ref.trim();for(var i=0;i<BIBLE_BOOKS.length;i++){if(r.toLowerCase().startsWith(BIBLE_BOOKS[i].toLowerCase()))return i;}return 999;}
/**
 * Formats a YYYY-MM-DD date string to a human-readable US locale date.
 * Uses noon local time to avoid timezone off-by-one errors near midnight.
 * @param {string} d - ISO date string (YYYY-MM-DD).
 * @returns {string} Formatted date string (e.g. "June 13, 2026"), or empty string if falsy.
 */
function fmtDate(d){if(!d)return '';return new Date(d+'T12:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
/**
 * Escapes HTML special characters in a string to prevent XSS injection.
 * Replaces &, <, >, and " with their HTML entity equivalents.
 * @param {string} s - String to escape.
 * @returns {string} HTML-safe escaped string.
 */
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/**
 * Converts a markdown string to inline-styled HTML for in-app rendering.
 * Supports: headings (# ## ###), ordered/unordered lists, bold (**text**),
 * italic (*text*), inline code (`text`), and hyperlinks ([text](url)).
 * Lists are auto-opened and closed as the parser encounters each line.
 * @param {string} md - Markdown-formatted string.
 * @returns {string} HTML string with all styles applied inline.
 */
function mdToHtml(md){
  var html='',inUl=false,inOl=false,olSeq=0;
  // Applies bold, italic, code, and hyperlink markdown to a single text line
  function inlineM(s){return s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;border-bottom:1px solid var(--golddim)">$1</a>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--goldpale)">$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/`(.*?)`/g,'<code style="background:var(--bg3);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>');}
  // Emits closing tags; resetOl=true resets the OL sequence counter (on headings/paragraphs only)
  function closeLists(resetOl){if(inUl){html+='</ul>';inUl=false;}if(inOl){html+='</ol>';inOl=false;}if(resetOl)olSeq=0;}
  String(md).split('\n').forEach(function(line){
    if(/^#{1,6}\s/.test(line)){closeLists(true); // Heading: close lists, reset OL counter, render as styled div
    html+='<div style="font-family:\'EB Garamond\',serif;font-size:16px;color:var(--gold);margin:10px 0 4px;">'+inlineM(line.replace(/^#+\s/,''))+'</div>';return;}
    if(/^\d+\.\s/.test(line)){if(!inOl){if(inUl){html+='</ul>';inUl=false;} // Ordered list: use start attr to continue count across bullet interruptions
    html+='<ol'+(olSeq>0?' start="'+(olSeq+1)+'"':'')+' style="margin:6px 0 6px 18px;color:var(--txt2);">';inOl=true;}olSeq++;html+='<li style="margin-bottom:3px;">'+inlineM(line.replace(/^\d+\.\s/,''))+'</li>';return;}
    if(/^[-*]\s/.test(line)){if(!inUl){if(inOl){html+='</ol>';inOl=false;}html+='<ul style="margin:6px 0 6px 18px;color:var(--txt2);">';inUl=true;}html+='<li style="margin-bottom:3px;">'+inlineM(line.replace(/^[-*]\s/,''))+'</li>';return;}
    closeLists(false); // Non-list line: close lists but preserve OL counter for continuation
    // Non-empty line → paragraph (resets OL counter); empty line → 6px vertical spacer
    if(line.trim()){olSeq=0;html+='<p style="margin:4px 0;color:var(--txt2);line-height:1.65;">'+inlineM(line)+'</p>';}else{html+='<div style="height:6px;"></div>';}
  });
  closeLists(true);
  return html;
}
/**
 * Sanitizes a string for safe PDF output by replacing non-ASCII characters.
 * Converts curly quotes, em/en dashes, and non-Latin code points to ASCII equivalents.
 * Strips any empty parentheses left behind by removed content.
 * @param {string} str - String to sanitize.
 * @returns {string} PDF-safe ASCII string.
 */
function pdfSafe(str){var s=String(str).replace(/\u2022/g,'-').replace(/\u2013|\u2014/g,'-').replace(/\u201c|\u201d/g,'"').replace(/\u2018|\u2019/g,"'"),out='';for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);
      // Allow: ASCII printable (32-126), extended Latin (160-255), tab/LF/CR
      if((c>=32&&c<=126)||(c>=160&&c<=255)||c===9||c===10||c===13)out+=s[i];
      else out+=' '; // Replace all other code points (smart quotes, emoji, etc.) with a space
    }return out.replace(/\(\s*\)/g,'').trim();}
/**
 * Returns the ISO date string (YYYY-MM-DD) for the day before the given date.
 * Uses noon local time to prevent timezone off-by-one errors near midnight.
 * @param {string} d - ISO date string (YYYY-MM-DD).
 * @returns {string} The previous day as a YYYY-MM-DD string.
 */
function prevDay(d){var dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()-1);return dt.toISOString().split('T')[0];}


var TEMPLATES={
  blank:{title:'',fieldNotes:'',tags:[]},
  sermon:{
    title:'',
    fieldNotes:'Speaker:\nSeries:\n\nMain Point:\n\nKey Passages:\n\nObservations:\n\nApplication:',
    tags:['sermon']
  },
  devotion:{
    title:'',
    fieldNotes:'What do I observe in this passage?\n\nWhat does this reveal about God?\n\nWhat does this reveal about me?\n\nHow should I respond today?',
    tags:['devotion']
  },
  smallgroup:{
    title:'',
    fieldNotes:'Group:\nDate:\n\nDiscussion Questions:\n1.\n2.\n3.\n\nGroup Observations:\n\nPersonal Takeaway:',
    tags:['group']
  }
};

var activeTagFilter=null;
var obStep=0;
// ── State setters (used by storage.js and other modules) ──────────────────
// ES module live bindings are read-only from importing modules.
// Setters allow cross-module writes to shared mutable state.
/** @param {Array} arr - New studies array */
function setStudies(arr){studies=arr;}
/** @param {Object|null} s - New active study (or null) */
function setCur(s){cur=s;}
/** @param {number} n - New active reference index */
function setActiveRefIdx(n){activeRefIdx=n;}
/** @param {string} s - New study scope ('passage'|'book') */
function setStudyScope(s){studyScope=s;}
/** @param {string|null} id - Study ID staged for deletion */
function setPendingDeleteId(id){_pendingDeleteId=id;}
/** @param {number|null} idx - Ref index staged for deletion */
function setPendingDeleteRefIdx(idx){_pendingDeleteRefIdx=idx;}
/** @param {Array} arr - New tags array */
function setTags(arr){TAGS=arr;}


var mfBlob=new Blob([JSON.stringify({name:'Arche - Pilgrim',short_name:'Pilgrim',start_url:'./',display:'standalone',background_color:'#0b0907',theme_color:'#0b0907',icons:[{src:'data:image/png;base64,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',sizes:'192x192',type:'image/png',purpose:'any'},{src:'data:image/png;base64,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',sizes:'512x512',type:'image/png',purpose:'any'},{src:'data:image/png;base64,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gAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAIAAMAQAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAAQAAAAAQAAEAAAAAEAABAAAAABAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAgAAAAAgAAIAAAAAIAACAAAAACAAAIGj/B1WGvSGho7cyAAAAAElFTkSuQmCC',sizes:'512x512',type:'image/png',purpose:'maskable'}]})],{type:'application/json'});
document.getElementById('pwa-manifest').href=URL.createObjectURL(mfBlob);



// ════════════════════════════════════════════════════════

// ── From SECTION 07 — STUDY DATA MODEL (pure data functions only) ──
// SECTION 07 — STUDY DATA MODEL
// Reference (passage) data shape, study migration, and multi-ref helpers.
// makeRef() defines the reference shape; migrateStudy() handles schema upgrades.
// ════════════════════════════════════════════════════════
/**
 * Creates and returns a new blank reference (passage) object with default shape.
 * Used when creating a study or adding an additional passage.
 * @param {string} [type='primary'] - Reference type: 'primary' or 'secondary'.
 * @returns {Object} A new reference object with empty deep-dive fields.
 */
function makeRef(type){return {id:'ref_'+Date.now(),reference:'',translation:sett.defaultTrans||'esv',pastedTranslation:'',scriptureText:'',type:type||'primary',deep:{lexical:'',grammar:'',historical:'',cultural:'',crossrefs:'',lexical_book:'',grammar_book:'',historical_book:'',cultural_book:'',crossrefs_book:'',studyScope:'passage'}};}
/**
 * Upgrades a study object to the current data schema in place.
 * Adds a `words` array if missing. If the study has no `refs` array (pre-multi-ref schema),
 * it migrates the flat reference fields into a single-element refs array.
 * @param {Object} s - Study object to migrate (mutated in place).
 */
function migrateStudy(s){
  if(!s.words)s.words=[]; // Schema v2+: words array added for future word study feature
  if(!s.series)s.series=''; // Schema v3+: series field added for study series grouping
  if(s.refs&&s.refs.length){
    // Already on multi-ref schema — repair defaults only
    s.refs.forEach(function(r){
      if(!r.type)r.type='primary'; // Back-fill missing type field from pre-type-toggle schema
      // studyScope 'book' is only an orphaned legacy state if NO book-scope content exists
      // across any tool. All 6 tools support both scopes — never key on one tool's field.
      if(r.deep&&r.deep.studyScope==='book'){
        var _hasBook=r.deep.lexical_book||r.deep.grammar_book||r.deep.historical_book||r.deep.cultural_book||r.deep.crossrefs_book||r.deep.geography_book;
        if(!_hasBook)r.deep.studyScope='passage';
      }
    });
    return;
  }
  // ── Pre-multi-ref migration path ─────────────────────────────────────────
  // Flatten legacy top-level reference fields into a single-entry refs array
  var ref=makeRef('primary');
  ref.reference=s.reference||'';ref.translation=s.translation||'esv';ref.pastedTranslation=s.pastedTranslation||'';ref.scriptureText=s.scriptureText||'';
  if(s.deep){
    // Copy AI tool results from the top-level deep object into the new ref
    ['lexical','grammar','historical','cultural','crossrefs','lexical_book','grammar_book','historical_book','cultural_book','crossrefs_book'].forEach(function(k){if(s.deep[k])ref.deep[k]=s.deep[k];});
    ref.deep.studyScope=s.deep.studyScope||'passage';
    // Remove migrated AI keys from top-level deep to prevent duplication
    ['lexical','grammar','historical','cultural','crossrefs','lexical_book','grammar_book','historical_book','cultural_book','crossrefs_book','studyScope'].forEach(function(k){delete s.deep[k];});
  }
  s.refs=[ref];
  // Remove top-level fields now safely stored inside refs
  delete s.reference;delete s.translation;delete s.pastedTranslation;delete s.scriptureText;
}
/**
 * Returns the currently active reference object for the open study.
 * Clamps activeRefIdx to the valid range to guard against out-of-bounds access.
 * @returns {Object|null} The active reference object, or null if no study is open.
 */
function activeRef(){if(!cur||!cur.refs||!cur.refs.length)return null;return cur.refs[Math.min(activeRefIdx,cur.refs.length-1)];}

// ── From SECTION 27 — PIN AUTH (namespace helpers only) ──
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
function migrateLegacyKey(legacyKey,namespacedKey){
  if(localStorage.getItem(namespacedKey)===null){
    var legacyVal=localStorage.getItem(legacyKey);
    if(legacyVal!==null)localStorage.setItem(namespacedKey,legacyVal);
  }
}
/**
 * Re-namespaces all 12 SK_* storage key constants with the active user's ID suffix.
 * Every existing localStorage.getItem/setItem call elsewhere in the file references
 * these constants by name, so this single function redirects all of them to the
 * correct per-user key with no other changes required anywhere else. Also runs a
 * one-time legacy migration per key (see migrateLegacyKey) so pre-v4.10.0 data stored
 * under the old un-suffixed keys survives the namespace switch instead of silently
 * appearing empty on first login.
 */
function activateUser(userId){
  ACTIVE_USER=userId;
  SK='bsn_studies_v2_'+userId;
  SK_SETT='bsn_settings_v1_'+userId;
  SK_TAGS='bsn_tags_v1_'+userId;
  SK_TAGS_DEL='bsn_tags_deleted_v1_'+userId;
  SK_OB='bsn_ob_done_'+userId;
  SK_TAB_HINTS='bsn_tab_hints_shown_'+userId;
  SK_DIAG='bsn_diag_log_'+userId;
  SK_STREAK='bsn_streak_'+userId;
  SK_TTS_SETT='bsn_tts_sett_'+userId;
  SK_WORDS='bsn_words_global_'+userId;
  SK_TOUR_STUDY_SEEN='bsn_tour_study_seen_'+userId;
  SK_TOUR_SETTINGS_SEEN='bsn_tour_settings_seen_'+userId;
  migrateLegacyKey('bsn_studies_v2',SK);
  migrateLegacyKey('bsn_settings_v1',SK_SETT);
  migrateLegacyKey('bsn_tags_v1',SK_TAGS);
  migrateLegacyKey('bsn_tags_deleted_v1',SK_TAGS_DEL);
  migrateLegacyKey('bsn_ob_done',SK_OB);
  migrateLegacyKey('bsn_tab_hints_shown',SK_TAB_HINTS);
  migrateLegacyKey('bsn_diag_log',SK_DIAG);
  migrateLegacyKey('bsn_streak',SK_STREAK);
  migrateLegacyKey('bsn_tts_sett',SK_TTS_SETT);
  migrateLegacyKey('bsn_words_global',SK_WORDS);
  migrateLegacyKey('bsn_tour_study_seen',SK_TOUR_STUDY_SEEN);
  migrateLegacyKey('bsn_tour_settings_seen',SK_TOUR_SETTINGS_SEEN);
}

// ── From SECTION 29 — CHANGELOG ──
// SECTION 29 — CHANGELOG
// Version history data array. Rendered by renderChangelog() in Settings.
// New entries: use items:[], _clSectionOpen:false, _clOpen:false.
// ════════════════════════════════════════════════════════
var CHANGELOG=[
  {
    version:'4.15.1',date:'July 20, 2026',label:'Latest',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: Notes-tab resource tile strip showed nothing at all when a study had no resources — now shows "No resources yet." (Study Tools tab\'s fuller Resources list already had correct empty-state text; only this tile strip was missing it)',
      'fix: Diagnostics → Run Tests no longer auto-opens/populates the Send Feedback form afterward — feedback form now only opens via the explicit Submit Feedback button',
      'feat: Send Feedback screenshot picker now supports multi-select — choose multiple images in one picker action (still capped at 3 total)',
      'feat: "This Passage" scope toggle in Study Tools now shows the loaded scripture reference (e.g. "This Passage: Joshua 1:8") instead of a static label, so scope is verifiable before running AI Study Tools'
    ]},
  {
    version:'4.15.0',date:'July 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'feat: feedback form now files a GitHub Issue directly instead of posting to Discord — auto-labeled by category, screenshots committed to feedback-attachments/, full diagnostic JSON embedded in the issue body',
      'feat: feedback screenshots are now resized/compressed client-side (max 1280px, JPEG) before send',
      'fix: Guided Tour B (Settings) step 9 copy was stale, still describing the feedback button as unwired — corrected now that it\'s live'
    ]},
  {
    version:'4.14.3',date:'July 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: OCR result required closing and reopening the resource modal to display — resRunOCR() only re-rendered the background tile grid, never the open detail overlay. Modal now refreshes in place the moment extraction finishes (success or error)'
    ]},
  {
    version:'4.14.2',date:'July 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: OCR extraction showed raw "<think>" reasoning block instead of extracted text, and took 1-2 minutes per scan — qwen/qwen3.6-27b is a hybrid reasoning model and defaults to thinking mode. Added reasoning_effort:\'none\' and reasoning_format:\'hidden\' to the /ocr call to force direct, fast, clean output'
    ]},
  {
    version:'4.14.1',date:'July 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: all AI Study Tools (Word Study, Language & Structure, Snapshot, Sync ping, etc.) broken — Groq deprecated llama-3.3-70b-versatile on June 17, 2026; every /groq call still referenced it and failed. Migrated all 7 text-completion calls to openai/gpt-oss-120b',
      'fix: Resource OCR/text extraction completely broken — Groq deprecated meta-llama/llama-4-scout-17b-16e-instruct same date; migrated OCR call to qwen/qwen3.6-27b (Groq\u2019s current vision-capable model). Note: this is a Groq preview model, not yet marked production-stable \u2014 revisit if Groq issues a GA vision model later'
    ]},
  {
    version:'4.14.0',date:'July 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'feat: Study Snapshot — replaced inline running label with a full progress modal listing all 6 tools and live per-tool status (pending/running/done/failed/cancelled); added a real Cancel control that aborts the in-flight AI request immediately and halts the run before the next tool',
      'fix: toast notifications rendered behind modal overlays (toast z-index:200 vs overlay z-index:500) — failure/success toasts fired but were invisible any time a modal was open, including the new Snapshot progress modal. Toast z-index raised to 600, above every overlay in the app'
    ]},
  {
    version:'4.13.6',date:'July 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: Whole Book scope broken — closeAIPanel()/switchAITab() referenced TTS state (_ttsActive, _ttsSource, ttsStop) never imported into studyTools.js, throwing ReferenceError on every scope toggle and AI tab switch. Scope toggle, tool dots, and panel state now work correctly in both scopes',
      'fix: saved Whole Book scope silently reset to This Passage on study open — migrateStudy() keyed its orphan-state check on Historical Context content only; now checks all six tools\u2019 book-scope fields before resetting'
    ]},
  {
    version:'4.13.5',date:'June 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: 3 leftover "Field Mode" strings (pre-rename terminology) replaced with "Notes tab" — Notes-tab resource caption, Study Tools empty-state message, and resInsertText() toast'
    ]},
  {
    version:'4.13.4',date:'June 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: diagnostic feedback form (item [21]) — submitFeedback() never reset pills/text/images after a successful send; form stayed fully populated post-submit, making pill selectors look stuck/broken. Now resets via diagFbReset() 2s after the success message displays, so the confirmation is still visible first'
    ]},
  {
    version:'4.13.3',date:'June 29, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: TTS restart race condition — added session counter to tts.js; stale onend/onboundary/onerror callbacks from a cancelled utterance no longer hijack the new playback session (fixes Listen/Pause button reverting incorrectly on AI, Field Notes, Conclusions, Outline, and Scripture restart)',
      'fix: AI panel _aiResults/_aiActiveTab bridges wired in app.js — silences ttsToggleAI console errors',
      'fix: deleteAIResult ReferenceError — aiActiveTab/aiPanelResults now imported into ui.js from studyTools.js',
      'fix: AI panel Share button — restored missing opening <button> tag in index.html (was breaking panel layout/DOM structure)',
      'fix: navigation auto-save — navTo() now silently saves (persist + debounced Gist sync) instead of only syncing in-memory state; switching screens via bottom nav no longer loses unsaved edits',
      'feat: debounced Gist sync — saveStudy/deleteStudy/duplicateStudy now coalesce rapid pushes into a single sync 3s after the last change, reducing redundant network calls during fast navigation',
      'fix: outline/conclusions dirty-flag reset — populateDeep() now uses setQConclDirty/setQOutlineDirty setters via window bridge instead of silently assigning undeclared module-scope names',
      'chore: removed dead duplicate aiPanelResults/aiActiveTab declaration in studyTools.js (line 697, leftover from refactor)',
      'fix: Deep Scripture collapsible always visible in Study Tools — shows clear empty-state message with direct link to Notes tab when no scripture loaded yet, instead of silently hiding the entire section and toggle',
      'fix: Copy Scripture button — copyScrip() was reading cur.scriptureText (does not exist); scripture text lives on activeRef(), button was always a silent no-op',
      'fix: Rename Resource modal rendering behind Resources modal — both shared z-index:500, later-DOM element won ties; bumped rename overlay to z-index:510',
      'fix: Resources modal close (×) button now sticky at top while scrolling long content',
      'fix: Gist pull failure (sync.js) — syncFromGist/syncToGist called window._persistDeletedTags() and window._applyTagTombstones(), which do not exist on window (these are local module-scope wrapper functions); pull silently threw and surfaced as "Pull failed"',
      'fix: Insert OCR Text into Notes (resInsertText) — referenced undeclared bare _qFN in studyTools.js (ReferenceError under strict mode); now reads window._qFN via the established cross-module bridge pattern'
    ]},
  {
    version:'4.13.2',date:'June 23, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'chore: pre-ES-module pass — JSDoc added to parseRef, speakNext, shareApp, confirmForcePull, runTest; dead openVerseModal (targeting nonexistent verse-overlay) removed from S20; openVerseModal/closeVerseModal in S22 reassigned to ui.js module map'
    ]},
  {
    version:'4.13.1',date:'June 22, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'fix: Quill dirty-flag guard — _qFNDirty/_qConclDirty/_qOutlineDirty flags now track user edits; syncFromInputs writes empty Quill state when dirty (intentional clear now persists), preserves stored content when not dirty; flags reset on populateField/populateDeep',
      'fix: DOMPurify added (v3.1.6 CDN) — AI panel content sanitized via DOMPurify.sanitize(mdToHtml(text)) before innerHTML injection; static template HTML untouched'
    ]},
  {
    version:'4.13.0',date:'June 22, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'feat: Pilgrim header — replaced Arch\u0113 \u00b7 Pilgrim branding with Joshua 1:8 cornerstone verse; mobile shows truncated quote (tappable modal for full verse); desktop sidebar shows full verse',
      'fix: mdToHtml — headings now render for up to 6 hash levels (was 3); ordered list counter no longer resets when bullet points interrupt a numbered sequence',
      'feat: Tour A — scripture changed from John 3:16 to Genesis 1:1; added nav intro step, Or Browse for It icon step, Look Up Word trigger step, and Getting to Study Tools nav step; improved Snapshot and Progress descriptions',
      'feat: Tour B — Manual JSON Backup step now includes beta build backup recommendation'
    ]},
  {version:'4.12.5',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['feat: app icon set added — browser tab favicon, iOS home screen icon, and Android install icons (including a maskable variant); italic Greek alpha (\u0391) mark rendered as self-contained vector artwork from the real glyph outline, so it never depends on a web font loading at runtime']
  },
  {
    version:'4.12.4',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: critical — the Section 01 code comment header was sitting outside the &lt;script&gt; tag instead of inside it, so the browser rendered it as literal visible text at the bottom of every screen instead of treating it as a comment; moved inside the script tag where it belongs','fix: Guided Tours — the message bubble could overlap the very card it was describing when there wasn\u2019t quite enough room on its preferred side, because the on-screen clamp could slide it back over the target; bubble placement now picks whichever side actually has room instead of a fixed top/bottom rule']
  },
  {
    version:'4.12.3',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: Guided Tours — the keyboard was still appearing partway through Tour A despite the click-through and blur fixes in v4.12.2, because focus could still land on a real input asynchronously (e.g. a moment after a step renders) in a way per-step blur() calls couldn\u2019t catch in time; added a global focusin listener that blurs any input, textarea, or contenteditable the instant it gains focus for as long as a tour is active, regardless of cause']
  },
  {
    version:'4.12.2',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: Guided Tours — the spotlight cutout was click-through by design, so a stray tap near Next/Back on a step highlighting a real input (Notes editor, lexicon search, AI tool buttons) could fall through and focus it, popping the on-screen keyboard for the rest of the tour; no tour step relies on tapping the real element underneath, so the cutout is no longer click-through']
  },
  {
    version:'4.12.1',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: Guided Tours — coach-mark spotlight/bubble were measuring a step\u2019s target position before scrollIntoView() moved the page, so the highlight and message bubble landed wherever the target used to be rather than where it actually scrolled to; now measures after the scroll completes','fix: same mispositioned spotlight could leave its (intentionally click-through) cutout sitting over a real text field from the old position, occasionally popping the on-screen keyboard mid-tour; tourRenderStep() now blurs any focused element before rendering each step as a safeguard']
  },
  {
    version:'4.12.0',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['feat: Guided Tours — a 31-step walkthrough of building a real study end-to-end (Tour A), offered at the end of first-run onboarding, and a 9-step Settings walkthrough (Tour B) that opens automatically the first time Settings is visited; both replayable any time from Settings; all demo data is tagged and auto-removed when a tour ends, is skipped, or the app is relaunched']
  },
  {
    version:'4.11.0',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['feat: Update Available banner — the app now checks for a newer live version on launch and whenever you return to the tab, with Refresh Now / Skip options; retires the old separate cache-bust version constant in favor of the changelog as the single source of truth']
  },
  {
    version:'4.10.5',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: critical — v4.10.0 namespacing left pre-existing study data orphaned under the old un-suffixed storage keys with no migration path, making studies appear to vanish on first login; activateUser() now auto-migrates all 10 SK_* legacy keys into the namespaced keys on first use per user, non-destructively (legacy keys are left in place)']
  },
  {
    version:'4.10.4',date:'June 20, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: removed stale "Gemini API key invalid or expired — generate a new key" message from text extraction error handler — OCR moved to Groq via arche-proxy long ago, no per-user key exists to regenerate']
  },
  {
    version:'4.10.3',date:'June 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['UX: + New Study FAB now only shows on the Library tab — hidden on Notes, Study Tools, Progress, and Settings since new studies can only be created from Library']
  },
  {
    version:'4.10.2',date:'June 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['FBI-2 cleanup: removed remaining "Archē proxy" reference from Study Sync status text, "Gist" from Force Restore toast, "AI-Free Zone" from Theological/Devotional Method descriptions (now "Your Notes Only" for consistency), and "OCR" acronym from error messages and Diagnostics labels (now "Text Extraction")']
  },
  {
    version:'4.10.1',date:'June 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['chore: renumbered PIN Auth section from 25.5 to clean Section 26 (shifting App Startup, Changelog, Service Worker down to 27-29); added missing PIN GATE MODAL comment header for consistency with other labeled modals']
  },
  {
    version:'4.10.0',date:'June 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['feat: PIN authentication + per-user data namespacing — 4-digit PIN gate validated via arche-proxy /auth/pin, all storage keys now namespaced per user, Gist sync uses per-user filename (Jesse keeps existing file, testers get their own), Settings \u2192 Account shows active user with Switch User option']
  },
  {
    version:'4.9.73',date:'June 18, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['fix: consolidated share-link URLs to single APP_SHARE_URL constant (was hardcoded to old gizmo5332.github.io repo path) — GitHub migration to arche-epos']
  },
  {
    version:'4.9.72',date:'June 15, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Sections 15 Lexicon & Word List (20) + 16 Resources & OCR (17) — 37 functions']
  },
  {
    version:'4.9.48',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Section 13 tail (expandCurrentTool, copyAIResult, shareAIResult) + Section 14 TTS (19 functions)']
  },
  {
    version:'4.9.47',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Section 13 Study Snapshot (8 functions — snapshotIntent, runSnapshot, showAIPanel, renderAITabs, switchAITab, renderAIPanelContent, closeAIPanel, updateExpandBtn)']
  },
  {
    version:'4.9.46',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Sections 09-12 (43 functions) — Library, Field Notes Panel, Bible API, Study Tools Panel']
  },
  {
    version:'4.9.45',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Section 07 Study Data Model (11 functions — makeRef, migrateStudy, activeRef, switchRef, addRef, moveRef, toggleRefType, removeRef, confirmRemoveRef, doRemoveRef, renderRefPills)']
  },
  {
    version:'4.9.44',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Sections 03 Utilities (13), 04 Storage (2), 05 Editor Setup (1), 06 Navigation (5) — 21 functions total']
  },
  {
    version:'4.9.43',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['docs: JSDoc Section 08 Study CRUD (openStudy, saveStudy, autoSave, deleteStudy, showDeleteModal, showDeleteById, duplicateStudy, syncFromInputs)']
  },
  {
    version:'4.9.42',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
        'Refactor: Phase 12 reorg — Lexicon & Word List (15) moved to after Text-to-Speech (14)',
        'Refactor: Phase 14 reorg — Book Picker (23) and Onboarding (24) moved to after Sync (22)',
        'Refactor: Phase 16 reorg — App Startup (26) and Changelog (27) moved to end of script, after Diagnostics (25)'
    ]
  },
  {
    version:'4.9.41',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
        'Refactor: Phase 10 reorg — Study Data Model (07) moved to after Navigation (06)',
        'Refactor: Phase 11 reorg — Study CRUD (08) and Library (09) swapped; CRUD now precedes Library',
        'Refactor: Phase 13 reorg — Settings (21) and Sync (22) moved to after Share & Deep Links (20)',
        'Refactor: Phase 15 reorg — Tags (17) moved to between Resources & OCR (16) and Export / PDF (18)'
    ]
  },
  {
    version:'4.9.40',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
        'Refactor: Phase 8 reorg — Storage (04) moved from after App Startup to after Utilities (03), before Editor Setup (05)',
        'Refactor: Phase 9 reorg — Navigation (06) moved from after Settings (21) to after Editor Setup (05), before Lexicon (15)'
    ]
  },
  {
    version:'4.9.39',date:'June 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
        'Refactor: Phase 7 reorg — 28 section banners added throughout script; SK_OB and SK_TAB_HINTS moved from Onboarding to Constants block',
        'Refactor: Phase 6 reorg — Tags block (loadTags through confirmDeleteTag) moved from post-Utilities position to after importDataFromFile in Export/Import section',
        'Refactor: Phase 4+5 reorg — Bible API (renderTransSpectrum, openTransDetail) moved next to fetchScr/getESV/getBollsBible/confirmPaste; Lexicon Zone 2 (openLexiconModal, openLexiconModalFor, closeLexiconModal, renderLexiconEntry) consolidated with Zone 1',
        'Refactor: Phase 3 reorg — Study CRUD consolidated: deleteStudy, showDeleteModal, showDeleteById, duplicateStudy, syncFromInputs moved next to openStudy/saveStudy/autoSave',
        'Refactor: Phase 2 reorg — 9 utility functions consolidated into Utilities section (htmlToText, setAppHeight, todayStr, updateOffline, bookOrder, fmtDate, escHtml, mdToHtml, pdfSafe, prevDay)',
        'Refactor: Phase 1 reorg — toast(), toastSuccess(), closeOverlay() moved to top of script (before loadTags)',
        'UX: Study Tools empty state — shows prompt + Library button when no study is open',
        'UX: Removed back button from Study Tools topbar (tab bar handles all navigation)',
        'Feature: Outline TTS — Listen/Pause/Resume/Restart buttons added to Passage/Book Outline section',
        'UX: Snapshot repeat-run protection — sub-label shows last-run time after completion; shows "All tools ready" on panel open when all 6 results exist',
        'Cleanup: Removed dead Gemini stubs (checkGeminiSetup, saveGeminiSetup, skipGeminiSetup)',
        'Cleanup: Removed WORKER_MODE constant and its dead guard in runTool',
        'Cleanup: Removed data-tip attribute from Snapshot button (no tooltip CSS/JS)',
        'Cleanup: Removed mislabeled service===gemini branch from runQuickTest'
      ]
    },
    {
      version:'4.9.32',date:'June 11, 2026',label:'',
      _clSectionOpen:false,_clOpen:false,
      items:['Fixed: Tag background rendering — hexToRgba now returns null on non-hex input instead of NaN rgba string; repairTagColor helper normalizes hex, rgb(), and invalid colors; repair runs on app load and after every Gist pull; renderTagPicker uses t.bg with safe fallback — resolves custom tags showing no background after sync']
    },{
    version:'4.9.31',date:'June 10, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
        'Style: Second readability pass — seclabel 14px, scripture bar ref 15px, Analyzing hint 14px, snapshot sub-list 14px, removed Your Notes Only badges from Outline and Conclusions',
        'Style: First readability pass — boosted contrast on secondary/hint text (--txt3, --txt4), increased font sizes on section labels, AI tool subtexts, form labels, template descriptions, disclaimers, and placeholder hints throughout',
        'New: Places & Geography AI tool — identifies all locations in a passage with ancient names, modern equivalents, distances, terrain, archaeological attestation, and certainty flags. Includes View on Map links. Scope toggle supported.',
        'Updated: Study Snapshot now includes Places & Geography for this-passage scope (6 tools total: Word Study, Language & Structure, Cross-References, Places & Geography + Historical, Cultural at book scope)',
        'Updated: Study Snapshot verbiage updated to match renamed tools throughout (snapshot button, tooltip, restore text, mobile modal)',
        'Fixed: Markdown link rendering added to mdToHtml — [text](url) now renders as clickable gold links',
        'Layout: Cross-References now shares row with Places & Geography (2x3 grid + Snapshot)'
    ]
  },{
    version:'4.9.27',date:'June 6, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Passage fetch no longer fires mid-typing on mobile — requires Book + Chapter before attempting load',
      'Fixed: Settings translation tiles now show all 14 translations (NKJV, NET, AMP, CSB, NLT, MSG, NASB, NIV added)',
      'Fixed: Default translation selector now correctly highlights all 14 options'
    ]
  },
  {
    version:'4.9.26',date:'June 1, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'New: 8 translations added via bolls.life API — NKJV, NET, AMP, CSB, NLT, MSG, NASB, NIV',
      'Added: BOLLS_TRANS map, BOLLS_BOOKS reference parser, getBollsBible() fetch function',
      'Removed: api.bible route (replaced by bolls.life — no account or key required)',
      'Updated: TRANS_AVAILABLE_IDS and translation dropdown to include all 14 translations'
    ]
  },
  {
    version:'4.9.25',date:'June 1, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: NKJV, NET, AMP, CSB, NLT, MSG now appear in translation dropdown (hardcoded option list and TRANS_AVAILABLE_IDS were not updated in v4.9.24)'
    ]
  },
  {
    version:'4.9.24',date:'June 1, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'New: NKJV, NET, AMP, CSB, NLT, MSG now available via api.bible (requires Worker API key)',
      'Added: API_BIBLE_IDS map and getApiBible() fetch function routed through arche-proxy /bible endpoint',
      'Updated: getBibleAPI() now routes api.bible translations before falling through to bible-api.com'
    ]
  },
  {
    version:'4.9.22',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Translation spectrum — Darby and WEB moved to correct word-for-word positions (were rendering rightmost due to array order)',
      'Fixed: RSV and NET philosophy corrected to "Essentially Literal" (RSV was "Word-for-Word", NET was "Functional Equivalence")',
      'Corrected spectrum order: YLT · Darby · ASV · NASB · KJV · NKJV · WEB · RSV · ESV · NET · CSB · HCSB · NIV · AMP · NLT · MSG'
    ]
  },
  {
    version:'4.9.21',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'About Translations: full spectrum bar (Word-for-Word → Thought-for-Thought) with gradient and 16 translations as tappable dots',
      'About Translations: tapping any translation opens a detail modal — full name, year, producers, purpose, philosophy, and notable facts',
      'About Translations: Available in Pilgrim badge (green) vs Reference Only for translations not in the app'
    ]
  },
  {
    version:'4.9.20',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Critical — chipBg was undefined in renderTagPicker(), causing ReferenceError that aborted populateField() on every study open and new study creation'
    ]
  },
  {
    version:'4.9.19',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Recent Activity rows now open the study on tap (onclick was missing)',
      'Fixed: Recent Activity reference now reads from refs[0].reference — was showing "No reference" on all studies'
    ]
  },
  {
    version:'4.9.18',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      '#6: Empty Library Prompt — first-time users see a centered "Start Your First Study" CTA instead of blank screen',
      '#9: Force Restore moved into collapsible Advanced sub-section in Settings (collapsed by default)',
      '#10: Save action now uses gold highlight toastSuccess for stronger visual confirmation',
      '#11: Tab descriptions shown beneath nav labels on first app launch; auto-dismiss on first tap',
      '#12: About Translations glossary added to Settings with one-line descriptions for all 6 translations'
    ]
  },
  {
    version:'4.9.17',date:'May 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'FBI-2: Renamed tabs — Field→Notes, Deep Study→Study Tools, Stats→Progress',
      'FBI-2: Renamed tools — Lexical Study→Word Study, Grammar & Syntax→Language & Structure',
      'FBI-2: Renamed sync — Push→Backup, Pull→Restore, Restore JSON→Restore Backup, Force Pull→Force Restore',
      'FBI-2: Renamed AI-Free Zone badge→Your Notes Only on Outline and Conclusions',
      'FBI-2: Removed Arché proxy from user-visible diagnostic labels',
      'Fixed: Tag visual inconsistency — user-added tags now render with same filled pill style as default tags'
    ]
  },
    {
    version:'4.9.16',date:'May 28, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Word card excerpt no longer mushes text — spaces inserted between block elements',
      'Fixed: View button now works for words saved outside a study (global words)',
      'Fixed: Lexicon word save — merges inGlobal/inStudy flags instead of replacing; re-saving a word no longer wipes its other list membership',
      'Fixed: Saving to Word List with no study open now works via standalone global store (bsn_words_global)',
      'Fixed: loadStudies() now re-syncs the cur reference — prevents stale cur after renderWordList/renderLib calls',
      'Fixed: renderWordList() now includes words saved without a study open'
    ]
  },{
    version:'4.9.14',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Multi-image picker now works on iOS — tap Add images repeatedly to accumulate up to 3 (iOS blocks multi-select natively)',
      'Images stored in JS array; each tap adds to the set without replacing previous selections'
    ]
  },{
    version:'4.9.12',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Submit Feedback button on Settings page now respects the Feedback toggle — hides when off, shows when on',
      'Fixed: Toggle updates button visibility in real time without needing to collapse/expand Diagnostics'
    ]
  },{
    version:'4.9.11',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Task 4: Replaced single screenshot input with multi-image picker (up to 3 images)',
      'Added: Thumbnail preview strip with individual remove (x) buttons before submitting',
      'Updated: submitFeedback loops all selected images as separate Discord attachments'
    ]
  },{
    version:'4.9.10',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Removed: AI Study Tools, Text Extraction (OCR), and Study Sync status rows from Settings — connection status now lives in Diagnostics with live Test buttons',
      'Settings now opens directly to Study Sync Push/Pull buttons'
    ]
  },{
    version:'4.9.9',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Added: Individual Test buttons on each Connection Status row — runs single service test inline, shows pass/fail + ms, logs to Recent Runs',
      'Added: Submit Feedback button in Diagnostics section — opens feedback form directly without requiring a full diagnostic run'
    ]
  },{
    version:'4.9.8',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Feedback form checkboxes (Need more details / Attach screenshot) were rendering as full-width text input bars — added checkbox-specific CSS reset to restore native appearance'
    ]
  },{
    version:'4.9.7',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Odd characters (盃) on Show/Hide toggles — hex vs decimal Unicode mismatch corrected',
      'Fixed: Share App URL updated to archestudytools.com/public via APP_SHARE_URL constant — one place to change going forward',
      'Cleaned: Settings footer — removed outdated version number and Chrome install instruction, version now lives in sidebar only'
    ]
  },{
    version:'4.9.6',date:'May 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fixed: Push button now shows success toast — previously only updated status indicator inside Settings (invisible when Settings closed)',
      'Added: Diagnostics section in Settings (collapsed by default) — run full system check across Worker, Groq AI, ESV API, Gist pull, Gist push/verify, TTS, and network',
      'Added: Diagnostic modal — real-time pass/fail per test with response times',
      'Added: Diagnostic log — last 20 runs stored locally, tap any entry to expand pass/fail detail',
      'Added: Feedback Submission toggle — enable to show Discord feedback form inside diagnostic modal (send diagnostic JSON + optional description + optional screenshot)'
    ]
  },{
    version:'4.9.2',date:'May 24, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Lexicon v2 — completely rebuilt: now returns structured BLB-style entry with Strong\'s badge, original word (large), transliteration, pronunciation, part of speech, root/etymology, TDNT reference, Outline of Biblical Usage, KJV Translation Count with breakdown, Strong\'s Definition text, Thayer\'s (NT) or BDB (OT) scholarly summary, and full Concordance with verse text for every occurrence',
      'Lexicon now accepts both English words/transliterations and Strong\'s numbers (G#### or H####)',
      'Lexicon max_tokens raised 700 → 3000 to support comprehensive concordance results',
      'Added: Look Up Word button in Library → Words tab — opens lexicon with Word List pre-checked',
      'Added: Look Up Word button in Field → Saved Words section — opens lexicon with Current Study pre-checked'
    ]
  },{
    version:'4.9.1',date:'May 23, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Fixed: autoSave no longer updates updatedAt — prevents stale local timestamps from winning Gist merges','Fixed: populateField uses dangerouslyPasteHTML (correct Quill load method)','Added: Force Pull button — overwrites local studies with Gist regardless of timestamps (recovery escape hatch)']
  },{
    version:'4.8.6',date:'May 14, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Fixed: pull now refreshes open study live — Field Notes, Conclusions, Outline, and refs reload automatically if a newer version exists in Gist']
  },{
    version:'4.8.5',date:'May 12, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Fixed: GitHub rate limit — auto-push cooldown increased to 5 min; rate limit detected and auto-push suppressed 15 min automatically','Fixed: push and pull no longer share a mutex — pull cannot block push','Fixed: storage full — DOCX text truncated at 30,000 chars on import','Fixed: Delete/Rename buttons now appear at top of resource modal — no scrolling required','Improved: image compression reduced from 1200px to 900px for smaller storage footprint','Improved: storage full error now describes the fix']
  },{
    version:'4.8.4',date:'May 12, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Fixed: auto-push throttled to once per 30s — prevents GitHub rate limit errors','Manual Push button always fires immediately']
  },{
    version:'4.8.3',date:'May 12, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Fixed: push and pull now use separate mutexes — pull no longer blocks push','Enhanced push error logging — full GitHub error message shown on sync failure']
  },{
    version:'4.8.2',date:'May 11, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fix — Outline and Conclusions no longer wiped by saving from Field Mode; Quill editors only overwrite stored content when they contain actual text or when Deep Study is active',
      'Fix — Quill editors now use dangerouslyPasteHTML for proper content loading on study open',
      'Lexicon Word Saver — save any looked-up word to your global Word List (Library → Words tab) or directly to the current study; view full definition, remove independently from each list',
      'Library → Words tab — browse all saved words across all studies, sorted alphabetically',
      'Saved Words section in Field Mode — words saved to a study appear below Field Notes',
      'Add Passage now auto-focuses the reference input — type immediately without a second tap',
      'Gallery picker now supports selecting multiple photos at once',
      'OCR migrated from Gemini to Groq (Llama 4 Scout vision) — re-extract any previously failed resources',
      'Fix — OCR error messages now display clearly instead of [object Object]'
    ]
  },{
    version:'4.7',date:'April 26, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Rich text editing — Field Notes, My Conclusions, and Outline now use a full rich text editor (Quill); supports bold, italic, underline, strikethrough, headings (H1–H3), bullet lists, numbered lists, indent/outdent, blockquote, and keyboard shortcuts (Ctrl+B/I/U)',
      'PDF export renders rich text — headings, bullets, numbered lists, bold, and italic all format correctly in exported PDF'
    ]
  },{
    version:'4.6',date:'April 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Fix — Deleted studies no longer reappear after Gist sync; deleted IDs are now excluded from merge-before-push'
    ]
  },{
    version:'4.5',date:'April 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Bug fixes: Closing AI panel stops TTS; runTool key guard added for consistency; Expand button always updates on panel open'
    ]
  },{
    version:'4.4',date:'April 19, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Export / Backup now opens a checklist — all studies pre-selected; deselect any to create a partial backup; tags, deletedTags, and streak always included']
  },{
    version:'4.3',date:'April 14, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'TTS: Speed control replaced with +/− stepper (0.5×–3.0×, steps of 0.5)'
    ]
  },{
    version:'4.2',date:'April 14, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'TTS: Test Voice button in Settings plays sample at current speed and voice; Scripture Listen added to scripture panel with Pause/Resume and Restart'
    ]
  },{
    version:'4.1',date:'April 14, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'TTS enhancements: Pause/Resume preserves position; ⏮ Restart button; Speed presets (0.75×–2×); Voice selector — all in Settings'
    ]
  },{
    version:'4.0',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Listen — tap to hear any AI result, Field Notes, or My Conclusions read aloud via device text-to-speech; tap again to stop; only one source plays at a time; stops automatically on screen navigation',
      'Expand — appears on Historical and Cultural panels; sends a follow-up request for additional depth appended with a divider; never replaces existing content; can expand multiple times',
      'TTS stops when switching AI tabs; speechSynthesis guard for Android and sandboxed environments'
    ]
  },{
    version:'3.9',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Study Snapshot restored — one button runs all 5 AI tools sequentially: Lexical, Grammar, Cross-References at passage scope; Historical and Cultural at whole-book scope',
      'Snapshot skips tools already populated; 2.5s gap between calls for Groq rate limit safety; live progress shown on button label',
      'Mobile confirmation modal; desktop runs directly; per-tool error handling so one failure does not abort the rest'
    ]
  },{
    version:'3.8',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Sync — Tag deletions now propagate across all devices; deleting a tag on one device removes it everywhere on next Pull',
      'Sync — Tag tombstone list included in Push, Pull, and Export backup so deletions are never lost'
    ]
  },{
    version:'3.7',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Sync — Delete now auto-pushes to Gist; deleted studies no longer reappear on other devices after Pull',
      'Sync — Duplicate now auto-pushes to Gist; duplicated studies appear on all devices immediately'
    ]
  },{
    version:'3.6',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Sync — Push now merges with Gist before writing; a device with fewer studies can never overwrite studies it does not have',
      'Sync — Tag merge on push: union of local and remote tags, local label wins on conflict',
      'Sync — After push, local state updated to merged result so all devices stay consistent'
    ]
  },{
    version:'3.5',date:'April 13, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:['Sync — Pull now fetches via GitHub raw_url, bypassing cache and truncation; all studies arrive complete on first pull',
      'Sync — Push and Pull both include streak data; streak merges by most recent lastDay across devices',
      'Export / Backup now saves complete data — studies, tags, and streak all included',
      'Restore JSON handles both legacy array format and new object format; restores tags and streak when present'
    ]
  },{
    version:'3.4',date:'April 3, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'PDF export restructured — header block shows active ref/translation/teacher + full reference list + outline + field notes',
      'Reference groups: each ref gets its own page (heading + verse + populated AI tools for that ref only)',
      'AI tools scanned and exported across all refs, not just active ref',
      'My Conclusions appended on its own page at end'
    ]
  },{
    version:'3.3',date:'March 30, 2026',label:'',
    _clSectionOpen:false,_clOpen:false,
    items:[
      'Cloudflare Worker proxy — all API calls (Groq AI, ESV Bible, GitHub Gist sync) now route through a secure server-side proxy; no API keys required on any device',
      'Study Sync fully automatic — studies push silently after every Save with no manual token or Gist ID setup needed; Pull button still available for manual sync',
      'Settings fully simplified — all API keys moved to Worker; no user-configurable keys remain; Settings now shows connection status only',
      'ESV attribution added — proper Crossway copyright notice displayed in Settings per API v3 guidelines',
      'Share app text updated — AI tools now highlighted as included with no setup required for recipients'
    ]
  },{
    version:'3.2',date:'March 28, 2026',label:'',
    items:[
      'Fixed: Outline and Conclusions data loss — redundant syncFromInputs() call removed from navTo deep branch; stale textarea content from a previously viewed study could overwrite the current study\'s outline before populateDeep() loaded correct data',
      'Fixed: My Conclusions wiped on load — syncFromInputs() now guards d-conclusions with the same deepOn||force check already applied to the outline; was unconditionally reading the empty textarea whenever Field Mode was active',
      'AI panel: Clear button deletes the stored result for the active tab, removes the ready dot, and saves',
      'Export modal: All / None quick-select links added to the AI Study Tools section header',
      'References: no limit on passages per study — previously capped at 12',
      'Fixed: viewport-fit=cover added to meta viewport — safe-area-inset values now work correctly on notched iPhones; without this env() always returned 0',
      'Fixed: --app-height CSS variable set from window.innerHeight and updated on resize/orientation change — prevents scroll lock when Android/iOS address bar appears or disappears',
      'Fixed: overscroll-behavior-y:contain on scroll containers — prevents browser toolbar toggling from interfering with in-app scrolling',
      'Study Sync — GitHub Gist: add a GitHub Personal Access Token (gist scope) in Settings to sync studies across all devices; Push/Pull buttons for manual sync; auto-pushes silently after every Save; merges by updatedAt so no work is lost',
      'References: Primary / Secondary type per passage — ★ = primary (shows on page 1 of PDF), ○ = secondary (prints as Supporting References); tap badge on any pill to toggle; new passages default to secondary',
      'PDF export: primary refs flow together after the header; secondary refs print on a dedicated Supporting References page after Field Notes',
      'PDF export section order revised — Primary reference, Outline, Field Notes, additional references, Resources, AI tools, My Conclusions',
      'PDF export hides empty sections — sections with no content are skipped entirely rather than printing blank',
      'PDF export: bullet characters (•) now render as dashes instead of disappearing',
      'PDF export: outline indentation preserved — leading spaces and tabs translate to x-offset in the rendered PDF',
      'PDF export: each section header always starts on a new page for a cleaner layout',
      'PDF export: margins tightened from 20mm to 13mm each side for more content per page'
    ]
  },{
    version:'3.1',date:'March 26, 2026',label:'',
    items:['Fixed: Orphan duplicate Study Resources modal removed — was permanently visible on iPad/Safari, blocking the FAB and swallowing taps','Fixed: Overlay backdrop now dismisses on iOS Safari tap (cursor:pointer added — required by WebKit click event model)','Fixed: FAB z-index raised from 10 to 60, safely above bottom nav bar','Fixed: FAB moved outside overflow:hidden container — iOS Safari silently drops touch events on fixed-position elements inside overflow:hidden parents','Fixed: inset:0 replaced with top/right/bottom/left longhand — inset unsupported before iOS 14.5','Fixed: 100dvh replaced with 100vh — dvh unit unsupported before iOS 15.4','Fixed: syncFromInputs gains force param — manual Save always commits outline regardless of active view; auto-save retains Deep Study guard to prevent stale textarea writes']
  },{
    version:'3.0',date:'March 25, 2026',label:'',
    items:[
      'Share Study Link strips AI results — dots show which tools were run; recipient re-runs tools fresh; URLs now short enough for SMS',
      'Share App button in Settings — native share sheet on mobile with app link and setup instructions'
    ]},
  {
    version:'2.9',date:'March 24, 2026',
    items:[
      'Resources modal added to Deep Study header — tap "Resources" for reference material',
      'How to Study the Bible — foundational scriptures, 4 method insights, Historical-Grammatical approach overview, 8 study methods',
      'How We Got the Bible — OT/NT source documents, manuscript reliability data (5,600+ NT manuscripts, 99.5% accuracy), translation philosophy spectrum'
    ]},
  {
    version:'2.8',date:'March 24, 2026',label:'',
    items:[
      'Passage/Book Outline section added to Deep Study right column — collapsible, saves with study',
      'Outline toolbar — tap I./II./III., A./B./C., 1./2./3., or • to insert prefix at cursor on current line',
      'Deep Study right column now scrolls independently on desktop — AI panel, Outline, and Conclusions all visible by scrolling',
      'Outline exports to PDF between Field Notes and AI tool results',
      'Outline included as toggle option in Export modal'
    ]},
  {
    version:'2.7',date:'March 24, 2026',label:'',
    items:[
      'AI study tools switched from Gemini to Groq (llama-3.3-70b-versatile) — free tier: 30 req/min, 14,400 req/day',
      'OCR (image text extraction) stays on Gemini Flash — better vision quality for photos',
      'Settings split into two sections: Groq key (required for AI tools) + Gemini key (optional, OCR only)',
      'First-launch setup overlay updated for Groq key',
      'Fixed: reference field pill label corruption — f-ref now writes to activeRef immediately on input',
      'Fixed: book picker now re-renders pills instantly on confirm'
    ]},
  {
    version:'2.6',date:'March 24, 2026',label:'',
    items:[
      'AI model switched from gemini-2.5-flash (preview, tight limits) to gemini-1.5-flash (15 req/min free tier)',
      'Improved error messages for expired, invalid, and rate-limited API keys — actionable links to Settings and aistudio.google.com',
      'AI tool max response tokens reduced from 8,192 to 2,048 — no quality impact, significant reduction in daily quota usage',
      'Import (JSON restore) now overwrites existing studies by ID — backup is always source of truth'
    ]},
  {
    version:'2.5',date:'March 22, 2026',label:'',
    items:['Friendly rate-limit error message — explains free tier 20 req/min cap and prompts retry instead of showing raw API error']},
  {
    version:'2.4',date:'March 22, 2026',label:'',
    items:['Reference pills update live as you type','Book picker updates active pill immediately on confirm']},
  {
    version:'2.3',date:'March 22, 2026',label:'',
    items:[
      'Passage limit raised from 4 to 12 per study for deeper cross-reference work'
    ]
  },
  {
    version:'2.2',date:'March 22, 2026',
    items:[
      'Book picker added to Field Mode — tap the book icon to select book, chapter, and verse(s) without typing',
      'Old Testament / New Testament toggle in picker for quick navigation',
      'Picking a reference auto-fills the Scripture Reference field and loads the passage',
      'Manual reference typing still available alongside the picker'
    ]
  },
  {
    version:'2.1',date:'March 22, 2026',
    items:[
      'Export / Backup now opens the native share sheet on supported devices (save to iCloud Drive, Google Drive, etc.)',
      'Falls back to direct file download on desktop browsers that do not support file sharing'
    ]
  },
  {
    version:'2.0',date:'March 22, 2026',
    items:[
      'Multiple scripture references — up to 4 passages per study',
      'Passage pill selector in Field Mode: add, switch, and remove references',
      'Passage pill selector in Deep Study: switch active passage for analysis',
      'Each passage stores its own scripture text, AI tool results, and scope setting',
      'Library cards show the primary reference with a +N badge when multiple passages exist',
      'Existing studies automatically migrated to the new format — no data lost',
      'Confirm modal shown when removing a passage that has saved content',
      'What\'s New changelog added to Settings'
    ]
  },
  {
    version:'1.6',date:'March 22, 2026',
    items:[
      'Delete button added to library cards — red Del button triggers custom confirm modal without opening the study',
      'Passage/Book scope toggle now persists per study — restored when the study is reopened',
      'All remaining native browser dialogs replaced with custom modals: Clear All Data, Delete Tag, Rename Resource',
      'Fixed: getBookFromRef now resolves multi-word book names (Song of Solomon, 1 Samuel, 2 Kings) correctly',
      'Fixed: pre-existing JS syntax error in resViewFull caused blank screen on load — identified via node --check'
    ]
  },
  {
    version:'1.5',date:'March 22, 2026',
    items:[
      'Field Notes panel in Deep Study is now collapsible — starts collapsed, shows word count in toggle bar',
      'Resource display switched from full cards to a compact 2-col thumbnail tile grid in both Field Mode and Deep Study',
      'Camera and Gallery capture buttons moved from Deep Study into Field Mode notes area',
      'Insert OCR text into Notes button added to image viewer modal',
      'Gemini API key first-launch setup overlay — shown on first open if no key is saved; skip option routes to Paste mode',
      'Settings shows live green/red indicator for API key status',
      'Fixed: display:flex hardcoded on #scr-field caused Field Mode to show simultaneously on all screens',
      'Fixed: missing display:none on desktop .scr rule caused all screens to show at once'
    ]
  },
  {
    version:'1.4',date:'March 19–21, 2026',
    items:[
      'Study tags — 6 default colored tags plus unlimited custom tags; tag picker in Field Mode header; colored dot chips on library cards',
      'Custom tag manager in Settings — create tags with name and color picker, edit or delete any tag; deletions propagate to all studies',
      'Tag filter bar in library — filter cards by any tag currently in use',
      'Study templates — new study picker offers Blank, Sermon Notes, Devotional, and Small Group starting points',
      'Onboarding flow — 3-step welcome card shown on first launch',
      'Stats dashboard — streak counter, total studies, words written, AI tools run; top books bar chart; recent activity list',
      'Library grid layout — 2-col mobile / 3-col desktop card grid with a + New Study card slot',
      'Share Study Link — encodes a study as a URL hash for sharing; image data stripped to keep URLs short',
      'Study duplication — Dup button on every library card',
      'AI panel tabs — all run tools persist as tabs and are switchable without re-running',
      'Word count live display on Field Notes textarea',
      'Scripture font size toggle (A+ / A−) in Field Mode',
      'Library search bar and sort options (Latest, Reference, Teacher, Modified)',
      'Auto-save every 30 seconds — silent, no toast',
      'Swipe gestures — horizontal swipe switches Field ↔ Deep Study on mobile',
      'Responsive desktop layout — sidebar nav at 901px+, two-column Deep Study; tablet layout at 481–900px',
      'Suite branding — sidebar ornament and Part of Arché Study Tools footer'
    ]
  },
  {
    version:'1.3',date:'March 19, 2026',
    items:[
      'App renamed to Arché · Pilgrim across all locations — title, PWA manifest, PDF footer, backup filename',
      'Auto / Paste scripture input mode toggle added to Field Mode header — mode persists across sessions',
      'Paste modal: Translation / Version field added; auto-uppercases as typed',
      'Paste modal: reference hint line shows current reference so users know what to look up',
      'Paste modal: smart focus — empty translation field gets focus first, otherwise jumps to textarea',
      'Paste modal: remembers last used translation and pre-fills it on next open',
      'Pasted translation stored on the study and shown in Deep Study header, library cards, and PDF footer',
      'Fixed: PDF export selection modal completely non-functional on Android Chrome — native checkbox inputs replaced with div + .on class toggle system throughout'
    ]
  },
  {
    version:'1.2',date:'March 18, 2026',
    items:[
      'Passage / Whole Book scope toggle added to Deep Study — analyze the current passage or the entire book',
      'Separate AI result cache per scope — passage and book results stored independently',
      'PDF export selection modal — choose which sections and AI tools to include; Select All / Clear All',
      'PDF layout engine rewritten — proper bottom-margin clearance, per-line page-break detection, section dividers',
      'Fixed: AI responses truncating mid-sentence — maxOutputTokens raised from 1800 to 8192 with explicit no-truncate prompt instruction',
      'Fixed: getBookFromRef added — was missing, caused scope toggle to fail',
      'Fixed: pdfSafe() rewritten using charCodeAt loop — regex Unicode ranges caused silent character corruption for Greek and Hebrew'
    ]
  },
  {
    version:'1.1',date:'March 18, 2026',
    items:[
      'Field Mode header made collapsible — summary pill bar shows date and reference when collapsed; collapse state preserved when switching tabs',
      'Scripture panel made collapsible with hide/show bar',
      'Delete Study button added to Field Mode topbar with confirm modal',
      'Fixed: isBook not defined error in buildPrompt — missing variable declaration added',
      'Fixed: unescaped apostrophe in Strong\'s numbers string literal caused JS syntax error',
      'Fixed: invalid Unicode regex range in pdfSafe caused silent failure — switched to charCodeAt approach'
    ]
  },
  {
    version:'1.0',date:'March 18, 2026',label:'Initial release',
    items:[
      'Complete app built from scratch as a single-file HTML PWA — installable via Chrome Add to Home Screen',
      'Field Mode — capture Date, Teacher, Scripture Reference, Translation, Title, and Notes',
      'Scripture auto-fetch via ESV API (Crossway) and bible-api.com (KJV, ASV, WEB, YLT, Darby)',
      'Paste fallback modal for offline or API-blocked scripture entry',
      'Deep Study — 5 AI tools via Gemini 2.5 Flash: Lexical Study, Grammar & Syntax, Historical Context, Cultural Context, Cross-References',
      'All AI prompts instruct Gemini to provide scholarly data only — no theological conclusions',
      'My Conclusions textarea — AI-Free Zone with gold border, fully separate from AI tools',
      'Library screen — searchable study list with FAB to create new studies',
      'Settings — Gemini API key input, ESV API status, translation list, JSON backup/restore, Clear All Data',
      'PDF export via jsPDF — gold header bar, metadata block, section dividers, page footers',
      'PWA service worker — cache-first strategy, offline badge indicator in topbar'
    ]
  }
];

var _clOpen={};
var _clSectionOpen=false;


// ── Section 07 — additional ref management functions ─────────────────────────
// switchRef, addRef, moveRef, toggleRefType, removeRef, confirmRemoveRef,
// doRemoveRef, renderRefPills were not extracted in Sessions 1–5.
// Cross-module calls use window.* bridges (same pattern as rest of extraction phase).

/**
 * Switches the active reference to the given index and re-renders the visible screen.
 * Syncs field inputs first, resets AI panel state, and refreshes ref pills.
 * @param {number} idx - Zero-based index into cur.refs to activate.
 */
function switchRef(idx){
  if(!cur||!cur.refs)return;
  if(window.syncFromInputs)window.syncFromInputs();
  setActiveRefIdx(Math.min(idx,cur.refs.length-1));
  setStudyScope((activeRef()&&activeRef().deep&&activeRef().deep.studyScope)||'passage');
  if(window.setAiPanelResults)window.setAiPanelResults({});
  if(window.setAiActiveTab)window.setAiActiveTab(null);
  var fieldOn=document.getElementById('scr-field')&&document.getElementById('scr-field').classList.contains('on');
  var deepOn=document.getElementById('scr-deep')&&document.getElementById('scr-deep').classList.contains('on');
  if(fieldOn){
    var ar=activeRef();
    document.getElementById('f-ref').value=ar?ar.reference||'':'';
    document.getElementById('f-trans').value=ar?ar.translation||'esv':'esv';
    if(window.updateBarRefLabel)window.updateBarRefLabel();
    if(ar&&ar.scriptureText){
      if(window.renderScrText)window.renderScrText(ar.scriptureText,ar.pastedTranslation||ar.translation);
      document.getElementById('scracts').style.display='flex';
    }else{
      document.getElementById('scrdisplay').innerHTML='<div class="empty" style="padding:14px 0"><p style="font-style:italic;font-size:13px">Enter a reference above to load the passage</p></div>';
      document.getElementById('scracts').style.display='none';
    }
    renderRefPills('f-ref-pills','field');
  }
  if(deepOn){if(window.populateDeep)window.populateDeep();}
}

/**
 * Appends a new secondary reference to the current study and switches to it.
 * Focuses the reference input field after a short delay.
 */
function addRef(){
  if(!cur)return;
  if(!cur.refs)cur.refs=[];
  cur.refs.push(makeRef('secondary'));
  if(window.saveStudy)window.saveStudy(true);
  switchRef(cur.refs.length-1);
  toast('New passage added');
  setTimeout(function(){var r=document.getElementById('f-ref');if(r){r.focus();r.select();}},80);
}

/**
 * Moves the active reference one position left or right within its type group.
 * Only swaps with adjacent references of the same type.
 * @param {number} dir - Direction: -1 to move left, +1 to move right.
 */
function moveRef(dir){
  if(!cur||!cur.refs||cur.refs.length<2)return;
  var idx=activeRefIdx;var type=cur.refs[idx].type;
  var target=idx+dir;
  while(target>=0&&target<cur.refs.length&&cur.refs[target].type!==type)target+=dir;
  if(target<0||target>=cur.refs.length||cur.refs[target].type!==type)return;
  var tmp=cur.refs[idx];cur.refs[idx]=cur.refs[target];cur.refs[target]=tmp;
  setActiveRefIdx(target);
  if(window.saveStudy)window.saveStudy(true);
  var fieldOn=document.getElementById('scr-field')&&document.getElementById('scr-field').classList.contains('on');
  var deepOn=document.getElementById('scr-deep')&&document.getElementById('scr-deep').classList.contains('on');
  if(fieldOn)renderRefPills('f-ref-pills','field');
  if(deepOn)renderRefPills('d-ref-pills','deep');
}

/**
 * Toggles a reference between primary and secondary type and repositions it.
 * Primary refs are grouped before secondaries.
 * @param {number} idx - Zero-based index of the reference to toggle.
 */
function toggleRefType(idx){
  if(!cur||!cur.refs||!cur.refs[idx])return;
  var newType=cur.refs[idx].type==='secondary'?'primary':'secondary';
  cur.refs[idx].type=newType;
  var ref=cur.refs.splice(idx,1)[0];
  if(newType==='primary'){
    var lastPrimary=-1;
    cur.refs.forEach(function(r,i){if(r.type==='primary')lastPrimary=i;});
    cur.refs.splice(lastPrimary+1,0,ref);setActiveRefIdx(lastPrimary+1);
  }else{
    var firstSec=cur.refs.length;
    for(var si=0;si<cur.refs.length;si++){if(cur.refs[si].type==='secondary'){firstSec=si;break;}}
    cur.refs.splice(firstSec,0,ref);setActiveRefIdx(firstSec);
  }
  if(window.saveStudy)window.saveStudy(true);
  var fieldOn=document.getElementById('scr-field')&&document.getElementById('scr-field').classList.contains('on');
  var deepOn=document.getElementById('scr-deep')&&document.getElementById('scr-deep').classList.contains('on');
  if(fieldOn)renderRefPills('f-ref-pills','field');
  if(deepOn)renderRefPills('d-ref-pills','deep');
}

/**
 * Initiates removal of a reference by index.
 * If the reference has content, shows a confirmation overlay; otherwise removes immediately.
 * Guards against removing the last remaining reference.
 * @param {number} idx - Zero-based index of the reference to remove.
 */
function removeRef(idx){
  if(!cur||!cur.refs)return;
  if(cur.refs.length<=1){toast('A study needs at least one passage');return;}
  var ref=cur.refs[idx];
  var hasContent=ref&&(ref.reference||ref.scriptureText||['lexical','grammar','historical','cultural','crossrefs','lexical_book','grammar_book','historical_book','cultural_book','crossrefs_book'].some(function(k){return ref.deep&&ref.deep[k];}));
  if(hasContent){setPendingDeleteRefIdx(idx);document.getElementById('delref-overlay').classList.add('on');}else{doRemoveRef(idx);}
}

/**
 * Confirms and executes a pending reference removal after user confirms the overlay.
 * Clears _pendingDeleteRefIdx and closes the confirmation overlay.
 */
function confirmRemoveRef(){
  if(_pendingDeleteRefIdx===null)return;
  doRemoveRef(_pendingDeleteRefIdx);
  setPendingDeleteRefIdx(null);
  closeOverlay('delref-overlay');
}

/**
 * Performs the actual removal of a reference at the given index.
 * Clamps activeRefIdx, resets AI panel state, re-renders the visible screen, and persists.
 * @param {number} idx - Zero-based index of the reference to remove from cur.refs.
 */
function doRemoveRef(idx){
  if(!cur||!cur.refs||cur.refs.length<=1)return;
  cur.refs.splice(idx,1);
  if(activeRefIdx>=cur.refs.length)setActiveRefIdx(cur.refs.length-1);
  setStudyScope((activeRef()&&activeRef().deep&&activeRef().deep.studyScope)||'passage');
  if(window.setAiPanelResults)window.setAiPanelResults({});
  if(window.setAiActiveTab)window.setAiActiveTab(null);
  var fieldOn=document.getElementById('scr-field')&&document.getElementById('scr-field').classList.contains('on');
  var deepOn=document.getElementById('scr-deep')&&document.getElementById('scr-deep').classList.contains('on');
  if(fieldOn){
    var ar=activeRef();
    document.getElementById('f-ref').value=ar?ar.reference||'':'';
    document.getElementById('f-trans').value=ar?ar.translation||'esv':'esv';
    if(window.updateBarRefLabel)window.updateBarRefLabel();
    if(ar&&ar.scriptureText){
      if(window.renderScrText)window.renderScrText(ar.scriptureText,ar.pastedTranslation||ar.translation);
      document.getElementById('scracts').style.display='flex';
    }else{
      document.getElementById('scrdisplay').innerHTML='<div class="empty" style="padding:14px 0"><p style="font-style:italic;font-size:13px">Enter a reference above to load the passage</p></div>';
      document.getElementById('scracts').style.display='none';
    }
    renderRefPills('f-ref-pills','field');
  }
  if(deepOn){if(window.populateDeep)window.populateDeep();}
  if(window.saveStudy)window.saveStudy(true);
  toast('Passage removed');
}

/**
 * Renders the reference pill tab bar into a container element.
 * In field mode, includes move arrows, type toggle, remove (×), and "Add Passage" button.
 * In deep mode, omits the × button.
 * @param {string} containerId - DOM id of the container element.
 * @param {string} mode - 'field' or 'deep', controls which controls are rendered.
 */
function renderRefPills(containerId,mode){
  var el=document.getElementById(containerId);if(!el||!cur||!cur.refs)return;
  var html='';
  cur.refs.forEach(function(ref,i){
    var isActive=(i===activeRefIdx);
    var label=ref.reference||'Passage '+(i+1);
    if(label.length>20)label=label.slice(0,18)+'\u2026';
    var showX=cur.refs.length>1&&mode==='field';
    var isPrimary=ref.type!=='secondary';
    var typeBadge='<span class="ref-pill-type" onclick="event.stopPropagation();toggleRefType('+i+')" title="'+(isPrimary?'Primary':'Secondary')+'">'+(isPrimary?'\u2605':'\u25cb')+'</span>';
    var canLeft=false,canRight=false;
    if(isActive&&cur.refs.length>1){
      for(var li=i-1;li>=0;li--){if(cur.refs[li].type===ref.type){canLeft=true;break;}}
      for(var ri=i+1;ri<cur.refs.length;ri++){if(cur.refs[ri].type===ref.type){canRight=true;break;}}
    }
    var leftArr=canLeft?'<span class="ref-pill-type" onclick="event.stopPropagation();moveRef(-1)" title="Move left">\u2039</span>':'';
    var rightArr=canRight?'<span class="ref-pill-type" onclick="event.stopPropagation();moveRef(1)" title="Move right">\u203a</span>':'';
    html+='<button class="ref-pill'+(isActive?' on':'')+(isPrimary?'':' secondary')+'" onclick="switchRef('+i+')">'+typeBadge+leftArr+escHtml(label)+rightArr+(showX?'<span class="ref-pill-x" onclick="event.stopPropagation();removeRef('+i+')">\u2715</span>':'')+'</button>';
  });
  if(mode==='field'){html+='<button class="ref-pill ref-pill-add" onclick="addRef()">+ Add Passage</button>';}
  el.innerHTML=html;
}


// ════════════════════════════════════════════════════════

// Export all public symbols for ES Module consumers
export {
  // Section 01 — constants
  WORKER_URL, ACTIVE_USER, BOLLS_TRANS, BOLLS_BOOKS, parseRef,
  APP_SHARE_URL,
  SK, SK_SETT, SK_TAGS, SK_TAGS_DEL, SK_OB, SK_TAB_HINTS,
  SK_DIAG, SK_STREAK, SK_TTS_SETT, SK_WORDS, SK_TOUR_STUDY_SEEN, SK_TOUR_SETTINGS_SEEN,
  SK_UPDATE_SKIP,
  // Section 02 — state
  studies, cur, online, sett, _diagResults, hdrCollapsed, scrCollapsed,
  // Session 2 — state setters
  setStudies, setCur, setActiveRefIdx, setStudyScope, setPendingDeleteId, setPendingDeleteRefIdx, setTags,
  studyScope, activeRefIdx, _editingTagId, _pendingDeleteId,
  _pendingDeleteTagId, _pendingDeleteRefIdx, _renameResId, _pendingUpdateVersion,
  TOOL_LABELS, TOOL_DESCS, DEFAULT_TAGS, TAGS, TAG_PALETTE,
  // Section 03 — utilities
  closeOverlay, _tt, toast, toastSuccess, htmlToText, setAppHeight,
  todayStr, updateOffline, bookOrder, fmtDate, escHtml, mdToHtml,
  pdfSafe, prevDay, TEMPLATES, activeTagFilter, obStep, mfBlob,
  // Section 07 partial — pure data model
  makeRef, migrateStudy, activeRef,
  // Section 07 — additional ref management (extracted session 6)
  switchRef, addRef, moveRef, toggleRefType,
  removeRef, confirmRemoveRef, doRemoveRef, renderRefPills,
  // Section 27 partial — namespace helpers
  migrateLegacyKey, activateUser,
  // Section 29 — changelog
  CHANGELOG
};
