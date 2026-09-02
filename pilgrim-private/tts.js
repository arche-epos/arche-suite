// tts.js — Pilgrim Private ES Module
// Extracted from index.html (v4.13.2) — ES Session 3
// Section 14 (TTS engine only): speak, voices, rate, settings
// Note: updateExpandBtn, expandCurrentTool, copyAIResult, shareAIResult
//       remain in studyTools.js per spec boundary rule.
// See pilgrim-es-modules-plan-v1.md for full module map

import {
  SK_TTS_SETT,
  cur,
  htmlToText,
  activeRef,
  trackEvent,
  logError
} from './utils.js?v=4.30.0';

// ── Cross-module state accessors (window.* during extraction phase) ─────────
// These live in studyTools.js (_aiResults(), _aiActiveTab()) and ui.js (Quill).
// Replaced with direct imports in Session 5 when app.js wires everything.
/** @returns {Object} AI panel results keyed by tool tab */
function _aiResults() { return window._aiResults() || {}; }
/** @returns {string|null} Currently active AI tab key */
function _aiActiveTab() { return window._aiActiveTab() || null; }
/** @returns {Object|null} Field Notes Quill instance */
function _qFN() { return window._qFN || null; }
/** @returns {Object|null} Conclusions Quill instance */
function _qConcl() { return window._qConcl || null; }
/** @returns {Object|null} Outline Quill instance */
function _qOutline() { return window._qOutline || null; }
/** @returns {string[]} Currently loaded Read tab chapter, split into one chunk per verse */
function _readVerseChunks() { return (window.getReadVerseChunks && window.getReadVerseChunks()) || []; }
/** @returns {string[]} Currently loaded Scripture panel passage, split into one chunk per verse */
function _scrVerseChunks() { return (window.getScrVerseChunks && window.getScrVerseChunks()) || []; }
/** @returns {number} Chunk index Read tab playback should start from (the requested entry verse) */
function _readStartIdx() { return (window.getReadStartIdx && window.getReadStartIdx()) || 0; }
/** @returns {number} Chunk index Scripture panel playback should start from (a manually tapped verse, if any) */
function _scrStartIdx() { return (window.getScrStartIdx && window.getScrStartIdx()) || 0; }

// ── TTS state ───────────────────────────────────────────────────────────────
export var _ttsSentences = [];
export var _ttsIdx = 0;
export var _ttsActive = false;
export var _ttsPaused = false;
export var _ttsSource = '';
export var _ttsRate = 1;
export var _ttsVoice = '';
export var _ttsVolume = 1;
export var _ttsCharOffset = 0;
export var _ttsSession = 0;
export var _ttsRepeat = false;

// ── Setters for cross-module writes ─────────────────────────────────────────
export function setTtsActive(v)  { _ttsActive  = v; }
export function setTtsPaused(v)  { _ttsPaused  = v; }
export function setTtsSource(v)  { _ttsSource  = v; }


// SECTION 14 — TEXT-TO-SPEECH ENGINE
// Listen/Pause/Resume/Restart controls for AI results and Outline.
// Uses the Web Speech API with chunked utterances for long text.
// ════════════════════════════════════════════════════════

/**
 * Splits a text string into an array of sentences for chunked TTS utterances.
 * Normalises newlines to spaces before splitting on sentence-ending punctuation.
 * @param {string} text - Plain text to split.
 * @returns {string[]} Array of sentence-length chunks.
 */
function ttsSplit(text){return text.replace(/\n+/g,' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];}
/**
 * Returns the plain text for a given TTS source identifier.
 * Sources: 'ai' (active AI panel result), 'fn' (Field Notes), 'concl' (Conclusions),
 * 'outline' (Outline), 'scr' (scripture text stripped of HTML tags).
 * @param {string} source - TTS source key.
 * @returns {string} Plain text to read aloud, or empty string if unavailable.
 */
function ttsGetText(source){
  if(source==='ai'){if(!_aiActiveTab())return '';var ar=activeRef();return(_aiResults()[_aiActiveTab()]||(ar&&ar.deep&&ar.deep[_aiActiveTab()])||'');}
  if(source==='fn'){return (_qFN()&&_qFN().getText().trim())||htmlToText(cur&&cur.fieldNotes)||'';}
  if(source==='concl'){return (_qConcl()&&_qConcl().getText().trim())||htmlToText(cur&&cur.deep&&cur.deep.conclusions)||'';}
  if(source==='outline'){return (_qOutline()&&_qOutline().getText().trim())||htmlToText(cur&&cur.deep&&cur.deep.outline)||'';}
  if(source==='scr'){var ar=activeRef();var t=(ar&&ar.scriptureText)||'';return t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
  return '';
}
/**
 * Updates all TTS listen/pause/restart buttons to reflect the current playback state.
 * Resets all sources to stopped state first, then applies the new state to the active source.
 * @param {string} source - TTS source key ('ai', 'fn', 'concl', 'outline', 'scr').
 * @param {string} state - Playback state: 'playing' | 'paused' | 'stopped'.
 */
function ttsUpdateBtn(source,state){
  var ids={ai:['listen-ai-btn','listen-ai-icon','listen-ai-label','tts-restart-ai'],fn:['listen-fn-btn','listen-fn-icon','listen-fn-label','tts-restart-fn'],concl:['listen-concl-btn','listen-concl-icon','listen-concl-label','tts-restart-concl'],outline:['listen-outline-btn','listen-outline-icon','listen-outline-label','tts-restart-outline'],scr:['listen-scr-btn','listen-scr-icon','listen-scr-label','tts-restart-scr'],read:['read-playpause-btn','read-playpause-icon','','']};
  // Reset all sources to stopped state first — ensures no stale playing/paused state bleeds through
  Object.keys(ids).forEach(function(s){var parts=ids[s];var icon=document.getElementById(parts[1]);var lbl=document.getElementById(parts[2]);var rst=document.getElementById(parts[3]);if(icon)icon.innerHTML='<polygon points="5 3 19 12 5 21 5 3"/>';if(lbl)lbl.textContent='Listen';if(rst)rst.style.display='none';});
  if(state==='stopped'||!ids[source])return;
  var icon=document.getElementById(ids[source][1]);var lbl=document.getElementById(ids[source][2]);var rst=document.getElementById(ids[source][3]);
  if(state==='playing'){if(icon)icon.innerHTML='<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';if(lbl)lbl.textContent='Pause';}
  else if(state==='paused'){if(lbl)lbl.textContent='Resume';}
  if(rst)rst.style.display='flex';
}
/**
 * Returns the SpeechSynthesisVoice object for the user's selected voice (_ttsVoice).
 * Falls back to null if the Speech Synthesis API is unavailable or no voices are loaded.
 * @returns {SpeechSynthesisVoice|null} The matching voice, or null.
 */
function ttsGetVoice(){if(!window.speechSynthesis)return null;var voices=window.speechSynthesis.getVoices();if(!voices.length)return null;if(_ttsVoice){var v=voices.find(function(v){return v.name===_ttsVoice;});if(v)return v;}return null;}
/**
 * Stops TTS playback and resets all playback state (index, char offset, active/paused flags).
 * Updates buttons for the previously active source to stopped state.
 */
function ttsStop(){_ttsSession++;if(window.speechSynthesis)window.speechSynthesis.cancel();_ttsActive=false;_ttsPaused=false;_ttsIdx=0;_ttsCharOffset=0;ttsUpdateBtn(_ttsSource,'stopped');if(window.clearReadFocus)window.clearReadFocus();if(window.clearScrFocus)window.clearScrFocus();}
/**
 * Pauses TTS by cancelling the current utterance and setting _ttsPaused=true.
 * Preserves _ttsIdx and _ttsCharOffset so playback can resume mid-sentence.
 */
function ttsPause(){if(window.speechSynthesis)window.speechSynthesis.cancel();_ttsActive=false;_ttsPaused=true;ttsUpdateBtn(_ttsSource,'paused');}
/**
 * Starts TTS playback for the given source, beginning at the specified sentence index.
 * Iterates through _ttsSentences via a recursive speakNext() inner function.
 * Tracks char offset via onboundary events to enable mid-sentence resume.
 * @param {string} source - TTS source key.
 * @param {number} [fromIdx=0] - Sentence index to start from.
 * @param {number} [charOffset=0] - Character offset within the starting sentence (for resume).
 */
function ttsPlay(source,fromIdx,charOffset){
  if(!window.speechSynthesis){toast('Text-to-speech not supported in this browser');return;}
  _ttsActive=true;_ttsPaused=false;_ttsSource=source;_ttsIdx=fromIdx||0;
  _ttsSession++;var mySession=_ttsSession;
  var resumeOffset=charOffset||0;
  ttsUpdateBtn(source,'playing');
  /**
   * Speaks the next sentence in the TTS queue, advancing _ttsIdx.
   * Handles resume-mid-sentence via resumeOffset, and stops cleanly when the queue is exhausted.
   * Recursively calls itself via utt.onend to chain sentences until stopped or paused.
   */
  function speakNext(){
    if(mySession!==_ttsSession)return;
    if(!_ttsActive||_ttsIdx>=_ttsSentences.length){
      // Repeat takes priority over auto-advance: loop the currently loaded reference
      // (verse 0) rather than continuing into the next chapter. Only applies to the
      // verse-chunked sources tied to a reference box ('read', 'scr').
      if(_ttsActive&&_ttsRepeat&&_ttsIdx>=_ttsSentences.length&&(source==='read'||source==='scr')){
        _ttsIdx=0;resumeOffset=0;speakNext();return;
      }
      // Reached the end naturally (still active, not paused/stopped) while reading —
      // hand off to readAutoAdvance() to continue into the next chapter, if available.
      if(_ttsActive&&source==='read'&&_ttsIdx>=_ttsSentences.length&&window.readAutoAdvance){window.readAutoAdvance();return;}
      _ttsActive=false;_ttsPaused=false;_ttsCharOffset=0;ttsUpdateBtn(source,'stopped');return;
    }
    if(source==='read'&&window.highlightReadVerse)window.highlightReadVerse(_ttsIdx);
    if(source==='scr'&&window.highlightScrVerse)window.highlightScrVerse(_ttsIdx);
    var sentence=_ttsSentences[_ttsIdx].trim();
    // If resuming mid-sentence, slice off already-spoken characters (tracked via onboundary)
    var spokenText=resumeOffset>0?sentence.slice(resumeOffset):sentence;
    if(!spokenText){_ttsIdx++;resumeOffset=0;speakNext();return;}
    var utt=new SpeechSynthesisUtterance(spokenText);
    utt.rate=_ttsRate||1;utt.pitch=1;utt.volume=(typeof _ttsVolume==='number')?_ttsVolume:1;
    var v=ttsGetVoice();if(v)utt.voice=v;
    // Capture resumeOffset in a closure — resumeOffset is reset to 0 after the first chunk
    var capturedOffset=resumeOffset;
    // Track word-boundary char position so a pause can resume from the exact word
    utt.onboundary=function(e){if(mySession!==_ttsSession)return;if(e.name==='word')_ttsCharOffset=capturedOffset+e.charIndex;};
    utt.onend=function(){if(mySession!==_ttsSession)return;_ttsIdx++;resumeOffset=0;_ttsCharOffset=0;speakNext();};
    utt.onerror=function(){if(mySession!==_ttsSession)return;_ttsIdx++;resumeOffset=0;_ttsCharOffset=0;speakNext();};
    window.speechSynthesis.speak(utt);
    resumeOffset=0;
  }
  speakNext();
}
/**
 * Toggles TTS for the AI results panel: pause if playing, resume if paused, or start fresh.
 * Shows a toast if there is no AI content to read.
 */
function ttsToggleAI(){
  if(_ttsSource==='ai'){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay('ai',_ttsIdx,_ttsCharOffset);return;}}
  ttsStop();var text=ttsGetText('ai');if(!text){toast('No content to read');return;}_ttsSentences=ttsSplit(text);trackEvent({tts:'ai'});ttsPlay('ai',0);
}
/**
 * Toggles TTS for a Field Notes panel source ('fn', 'concl', or 'outline').
 * Pause if currently playing this source, resume if paused, or start fresh from that source.
 * @param {string} source - TTS source key: 'fn' | 'concl' | 'outline'.
 */
function ttsToggleField(source){
  if(_ttsSource===source){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay(source,_ttsIdx,_ttsCharOffset);return;}}
  ttsStop();var text=ttsGetText(source);if(!text){toast('Nothing to read here');return;}_ttsSentences=ttsSplit(text);trackEvent({tts:source});ttsPlay(source,0);
}
/**
 * Toggles TTS for the Scripture panel. Pause if playing, resume if paused, or start
 * fresh — playback is chunked one verse at a time (not sentence-split), matching
 * the Read tab, so tapping a verse number and Skip Prev/Next Verse can jump to an
 * exact verse and the karaoke-style highlight can track it. Shows a toast if no
 * scripture text is loaded.
 */
function ttsToggleScr(){
  if(_ttsSource==='scr'){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay('scr',_ttsIdx,_ttsCharOffset);return;}}
  if(!_scrVerseChunks().length){toast('No scripture loaded');return;}
  ttsPlayScrFrom(_scrStartIdx());
}
/**
 * Starts Scripture panel TTS playback fresh from a specific verse chunk index —
 * shared by ttsToggleScr() (fresh play), scrSkipVerse() (Skip Prev/Next Verse),
 * and tapping a verse number to jump-and-play. Always (re)loads the current verse
 * chunk array first, so it's safe to call even if the loaded passage changed.
 * @param {number} idx - Index into the Scripture panel's verse chunk array.
 */
function ttsPlayScrFrom(idx){
  var chunks=_scrVerseChunks();
  if(!chunks.length||idx<0||idx>=chunks.length)return;
  ttsStop();
  _ttsSentences=chunks;
  trackEvent({tts:'scr'});
  ttsPlay('scr',idx);
}
/**
 * Toggles TTS for the Read tab's loaded chapter/range. Pause if playing, resume if
 * paused, or start fresh — playback is chunked one verse at a time (not sentence-
 * split) so Skip Prev/Next Verse and the karaoke-style highlight can track a
 * specific verse index. Fresh starts begin at the requested entry verse (chapter
 * mode) or the first verse of the range (range mode) — see ttsPlayReadFrom().
 */
function ttsToggleRead(){
  if(_ttsSource==='read'){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay('read',_ttsIdx,_ttsCharOffset);return;}}
  if(!_readVerseChunks().length){toast('No chapter loaded');return;}
  ttsPlayReadFrom(_readStartIdx());
}
/**
 * Starts Read tab TTS playback fresh from a specific verse chunk index — shared by
 * ttsToggleRead() (fresh play), readSkipVerse() (Skip Prev/Next Verse), tapping a
 * verse number to jump-and-play, and readAutoAdvance() (continuing into the next
 * chapter). Always (re)loads the current verse chunk array first, so it's safe to
 * call even if the loaded chapter/range changed since the last play.
 * @param {number} idx - Index into the Read tab's verse chunk array.
 */
function ttsPlayReadFrom(idx){
  var chunks=_readVerseChunks();
  if(!chunks.length||idx<0||idx>=chunks.length)return;
  ttsStop();
  _ttsSentences=chunks;
  trackEvent({tts:'read'});
  ttsPlay('read',idx);
}
/**
 * Plays a short test utterance (John 1:1) using the current voice and rate settings.
 * Toggles the test button between "▶ Test Voice" and "■ Stop" during playback.
 */
function ttsTestVoice(){
  if(!window.speechSynthesis){toast('Text-to-speech not supported');return;}
  window.speechSynthesis.cancel();
  var btn=document.getElementById('tts-test-btn');
  var utt=new SpeechSynthesisUtterance('In the beginning was the Word, and the Word was with God, and the Word was God.');
  utt.rate=_ttsRate||1;utt.pitch=1;utt.volume=(typeof _ttsVolume==='number')?_ttsVolume:1;
  var v=ttsGetVoice();if(v)utt.voice=v;
  utt.onstart=function(){if(btn)btn.textContent='■ Stop';};
  utt.onend=function(){if(btn)btn.textContent='▶ Test Voice';};
  utt.onerror=function(){if(btn)btn.textContent='▶ Test Voice';};
  if(btn&&btn.textContent.indexOf('Stop')>=0){window.speechSynthesis.cancel();btn.textContent='▶ Test Voice';return;}
  window.speechSynthesis.speak(utt);
}
/**
 * Restarts TTS from the beginning of the given source.
 * Stops any active playback, re-fetches the text, and re-splits into sentences.
 * @param {string} source - TTS source key.
 */
function ttsRestart(source){
  if(source==='read'){ttsPlayReadFrom(0);return;}
  if(source==='scr'){ttsPlayScrFrom(0);return;}
  ttsStop();
  var text=ttsGetText(source);if(!text)return;_ttsSentences=ttsSplit(text);ttsPlay(source,0);
}
/**
 * Loads TTS rate, voice, and volume preferences from localStorage and applies them.
 * Silently no-ops on parse failure. Calls updateTTSRateUI/updateTTSVolumeUI after loading.
 */
function loadTTSSett(){try{var s=JSON.parse(localStorage.getItem(SK_TTS_SETT));if(s){if(s.rate)_ttsRate=s.rate;if(s.voice)_ttsVoice=s.voice;if(typeof s.volume==='number')_ttsVolume=s.volume;}}catch(e){logError('Load TTS Settings',e);}updateTTSRateUI();updateTTSVolumeUI();}
/**
 * Persists the current TTS rate, voice, and volume selections to localStorage.
 */
function saveTTSSett(){localStorage.setItem(SK_TTS_SETT,JSON.stringify({rate:_ttsRate,voice:_ttsVoice,volume:_ttsVolume}));}
/**
 * Sets the TTS playback rate, persists it, and refreshes the rate UI.
 * @param {number} r - Playback rate (0.5 – 3.0).
 */
function setTTSRate(r){_ttsRate=r;saveTTSSett();updateTTSRateUI();}
/**
 * Updates the rate display label and highlights the active preset rate button.
 * Preset buttons are identified by ids like 'tts-pre-1', 'tts-pre-1_5', etc.
 */
function updateTTSRateUI(){
  var el=document.getElementById('tts-rate-display');
  if(el)el.textContent=_ttsRate+'×';
  var rs=document.getElementById('read-speed-sel');
  if(rs)rs.value=String(_ttsRate); // Read tab player bar mirrors the same global rate
  var ss=document.getElementById('scr-speed-sel');
  if(ss)ss.value=String(_ttsRate); // Scripture panel mini-player mirrors the same global rate
  [0.5,1,1.5,2,2.5,3].forEach(function(r){
    var id='tts-pre-'+r.toString().replace('.','_'); // e.g. 1.5 → 'tts-pre-1_5' (period replaced to make valid DOM id)
    var btn=document.getElementById(id);
    if(btn){btn.style.color=(_ttsRate===r)?'var(--gold)':'var(--txt3)';btn.style.borderColor=(_ttsRate===r)?'var(--gold)':'var(--border)';}
  });
}
/**
 * Increments or decrements the TTS rate by the given delta, clamped to [0.5, 3.0].
 * @param {number} delta - Amount to adjust (e.g. 0.25 or -0.25).
 */
function adjustTTSRate(delta){
  // Multiply-then-round avoids floating-point drift (e.g. 1.0 + 0.25 = 1.2500000000000002 without rounding)
  var next=Math.round((_ttsRate+delta)*100)/100;
  if(next<0.5||next>3.0)return;
  _ttsRate=next;saveTTSSett();updateTTSRateUI();
}
/**
 * Populates the TTS voice selector dropdown(s) with available browser voices.
 * Populates both #tts-voice-sel (Settings) and #read-voice-sel (Read tab player
 * bar) if present — both control the same global _ttsVoice.
 * No-op if the Speech Synthesis API is unavailable or no voices are loaded yet.
 * Marks the default voice with a ★ symbol.
 */
function initTTSVoices(){
  if(!window.speechSynthesis)return;
  var voices=window.speechSynthesis.getVoices();
  if(!voices.length)return;
  var optionsHtml='<option value="">Default</option>'+voices.map(function(v){return '<option value="'+v.name+'"'+(v.name===_ttsVoice?' selected':'')+'>'+v.name+(v.default?' ★':'')+'</option>';}).join('');
  ['tts-voice-sel','read-voice-sel'].forEach(function(id){
    var sel=document.getElementById(id);
    if(sel)sel.innerHTML=optionsHtml;
  });
}
/**
 * Sets the TTS voice by name and persists the preference.
 * @param {string} name - The SpeechSynthesisVoice name to use.
 */
function setTTSVoice(name){_ttsVoice=name;saveTTSSett();}
/**
 * Sets the TTS playback volume, persists it, and refreshes the volume UI.
 * @param {number} v - Volume level (0.0 – 1.0).
 */
function setTTSVolume(v){_ttsVolume=v;saveTTSSett();updateTTSVolumeUI();}
/**
 * Syncs both volume sliders (#tts-volume-sel in Settings, #read-volume-sel in the
 * Read tab player's popout) and both percentage labels to the current _ttsVolume
 * — all controls share the same global value.
 */
function updateTTSVolumeUI(){
  var pct=Math.round((_ttsVolume||0)*100);
  var s1=document.getElementById('tts-volume-sel');if(s1)s1.value=String(_ttsVolume);
  var s2=document.getElementById('read-volume-sel');if(s2)s2.value=String(_ttsVolume);
  var d=document.getElementById('tts-volume-display');if(d)d.textContent=pct+'%';
  var d2=document.getElementById('read-volume-pct');if(d2)d2.textContent=pct+'%';
}

/**
 * Toggles Repeat mode — loops the currently loaded reference (Read tab or
 * Scripture panel) from the start once playback reaches the end, instead of
 * stopping (or, for Read, instead of auto-advancing into the next chapter).
 * Shared global flag, mirrored by both players' Repeat buttons — same pattern
 * as rate/voice/volume, which are already single shared globals across players.
 */
function toggleTTSRepeat(){_ttsRepeat=!_ttsRepeat;updateTTSRepeatUI();}
/**
 * Syncs both Repeat buttons (Read player, Scripture panel mini-player) to the
 * current _ttsRepeat state — gold/active when on, dim/default when off.
 */
function updateTTSRepeatUI(){
  ['read-repeat-btn','scr-repeat-btn'].forEach(function(id){
    var btn=document.getElementById(id);
    if(!btn)return;
    if(_ttsRepeat){btn.style.color='var(--gold)';btn.style.borderColor='var(--gold)';}
    else{btn.style.color='var(--txt3)';btn.style.borderColor='var(--border)';}
  });
}

// ── Named exports ────────────────────────────────────────────────────────────
export {
  ttsSplit, ttsGetText, ttsUpdateBtn, ttsGetVoice, ttsStop, ttsPause,
  ttsPlay, ttsToggleAI, ttsToggleField, ttsToggleScr, ttsPlayScrFrom, ttsToggleRead, ttsPlayReadFrom, ttsTestVoice,
  ttsRestart, loadTTSSett, saveTTSSett, setTTSRate, updateTTSRateUI,
  adjustTTSRate, initTTSVoices, setTTSVoice, setTTSVolume, updateTTSVolumeUI,
  toggleTTSRepeat, updateTTSRepeatUI
};
