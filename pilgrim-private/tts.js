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
  activeRef
} from './utils.js';

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

// ── TTS state ───────────────────────────────────────────────────────────────
export var _ttsSentences = [];
export var _ttsIdx = 0;
export var _ttsActive = false;
export var _ttsPaused = false;
export var _ttsSource = '';
export var _ttsRate = 1;
export var _ttsVoice = '';
export var _ttsCharOffset = 0;

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
  var ids={ai:['listen-ai-btn','listen-ai-icon','listen-ai-label','tts-restart-ai'],fn:['listen-fn-btn','listen-fn-icon','listen-fn-label','tts-restart-fn'],concl:['listen-concl-btn','listen-concl-icon','listen-concl-label','tts-restart-concl'],outline:['listen-outline-btn','listen-outline-icon','listen-outline-label','tts-restart-outline'],scr:['listen-scr-btn','listen-scr-icon','listen-scr-label','tts-restart-scr']};
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
function ttsStop(){if(window.speechSynthesis)window.speechSynthesis.cancel();_ttsActive=false;_ttsPaused=false;_ttsIdx=0;_ttsCharOffset=0;ttsUpdateBtn(_ttsSource,'stopped');}
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
  var resumeOffset=charOffset||0;
  ttsUpdateBtn(source,'playing');
  /**
   * Speaks the next sentence in the TTS queue, advancing _ttsIdx.
   * Handles resume-mid-sentence via resumeOffset, and stops cleanly when the queue is exhausted.
   * Recursively calls itself via utt.onend to chain sentences until stopped or paused.
   */
  function speakNext(){
    if(!_ttsActive||_ttsIdx>=_ttsSentences.length){_ttsActive=false;_ttsPaused=false;_ttsCharOffset=0;ttsUpdateBtn(source,'stopped');return;}
    var sentence=_ttsSentences[_ttsIdx].trim();
    // If resuming mid-sentence, slice off already-spoken characters (tracked via onboundary)
    var spokenText=resumeOffset>0?sentence.slice(resumeOffset):sentence;
    if(!spokenText){_ttsIdx++;resumeOffset=0;speakNext();return;}
    var utt=new SpeechSynthesisUtterance(spokenText);
    utt.rate=_ttsRate||1;utt.pitch=1;
    var v=ttsGetVoice();if(v)utt.voice=v;
    // Capture resumeOffset in a closure — resumeOffset is reset to 0 after the first chunk
    var capturedOffset=resumeOffset;
    // Track word-boundary char position so a pause can resume from the exact word
    utt.onboundary=function(e){if(e.name==='word')_ttsCharOffset=capturedOffset+e.charIndex;};
    utt.onend=function(){_ttsIdx++;resumeOffset=0;_ttsCharOffset=0;speakNext();};
    utt.onerror=function(){_ttsIdx++;resumeOffset=0;_ttsCharOffset=0;speakNext();};
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
  ttsStop();var text=ttsGetText('ai');if(!text){toast('No content to read');return;}_ttsSentences=ttsSplit(text);ttsPlay('ai',0);
}
/**
 * Toggles TTS for a Field Notes panel source ('fn', 'concl', or 'outline').
 * Pause if currently playing this source, resume if paused, or start fresh from that source.
 * @param {string} source - TTS source key: 'fn' | 'concl' | 'outline'.
 */
function ttsToggleField(source){
  if(_ttsSource===source){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay(source,_ttsIdx,_ttsCharOffset);return;}}
  ttsStop();var text=ttsGetText(source);if(!text){toast('Nothing to read here');return;}_ttsSentences=ttsSplit(text);ttsPlay(source,0);
}
/**
 * Toggles TTS for the scripture panel. Pause if playing, resume if paused, or start fresh.
 * Shows a toast if no scripture text is loaded.
 */
function ttsToggleScr(){
  if(_ttsSource==='scr'){if(_ttsActive){ttsPause();return;}if(_ttsPaused){ttsPlay('scr',_ttsIdx,_ttsCharOffset);return;}}
  ttsStop();var text=ttsGetText('scr');if(!text){toast('No scripture loaded');return;}_ttsSentences=ttsSplit(text);ttsPlay('scr',0);
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
  utt.rate=_ttsRate||1;utt.pitch=1;
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
function ttsRestart(source){ttsStop();var text=ttsGetText(source);if(!text)return;_ttsSentences=ttsSplit(text);ttsPlay(source,0);}
/**
 * Loads TTS rate and voice preferences from localStorage and applies them.
 * Silently no-ops on parse failure. Calls updateTTSRateUI after loading.
 */
function loadTTSSett(){try{var s=JSON.parse(localStorage.getItem(SK_TTS_SETT));if(s){if(s.rate)_ttsRate=s.rate;if(s.voice)_ttsVoice=s.voice;}}catch(e){}updateTTSRateUI();}
/**
 * Persists the current TTS rate and voice selections to localStorage.
 */
function saveTTSSett(){localStorage.setItem(SK_TTS_SETT,JSON.stringify({rate:_ttsRate,voice:_ttsVoice}));}
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
 * Populates the TTS voice selector dropdown with available browser voices.
 * No-op if the selector element is absent or the Speech Synthesis API is unavailable.
 * Marks the default voice with a ★ symbol.
 */
function initTTSVoices(){
  var sel=document.getElementById('tts-voice-sel');
  if(!sel||!window.speechSynthesis)return;
  var voices=window.speechSynthesis.getVoices();
  if(!voices.length)return;
  sel.innerHTML='<option value="">Default</option>'+voices.map(function(v){return '<option value="'+v.name+'"'+(v.name===_ttsVoice?' selected':'')+'>'+v.name+(v.default?' ★':'')+'</option>';}).join('');
}
/**
 * Sets the TTS voice by name and persists the preference.
 * @param {string} name - The SpeechSynthesisVoice name to use.
 */
function setTTSVoice(name){_ttsVoice=name;saveTTSSett();}

// ── Named exports ────────────────────────────────────────────────────────────
export {
  ttsSplit, ttsGetText, ttsUpdateBtn, ttsGetVoice, ttsStop, ttsPause,
  ttsPlay, ttsToggleAI, ttsToggleField, ttsToggleScr, ttsTestVoice,
  ttsRestart, loadTTSSett, saveTTSSett, setTTSRate, updateTTSRateUI,
  adjustTTSRate, initTTSVoices, setTTSVoice
};
