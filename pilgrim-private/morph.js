// ════════════════════════════════════════════════════════
// morph.js — Pilgrim Private (v4.43.0, Bible Tools Release 3: Interlinear)
// Pure functions, no DOM and no imports. Turns the morphology tags stored in
// data/macula/<book#>.json into plain English:
//   NT (books 40-66): MACULA Greek tags, Robinson-style, e.g. "V-AAI-3S", "N-ASM", "A-NSM-C".
//   OT (books 1-39):  Open Scriptures Hebrew Bible tags, e.g. "HC/Vqw3ms", "HTd/Ncmsa", "ANcmsa".
//     An OT tag starts with a language letter (H Hebrew, A Aramaic); the rest is one or more
//     segments joined by "/" (prefix parts, the word itself, pronoun suffix).
// Nothing is guessed: any code this file does not recognise is appended to the chip in
// square brackets and listed in `unknown`, so it is visible rather than silently dropped.
// Coverage was checked against every distinct tag in all 66 book files (see the release notes).
// ════════════════════════════════════════════════════════

var G_CASE = {N:'nominative',G:'genitive',D:'dative',A:'accusative',V:'vocative'};
var G_NUM = {S:'singular',P:'plural'};
var G_GEN = {M:'masculine',F:'feminine',N:'neuter'};
var G_PERSON = {'1':'1st person','2':'2nd person','3':'3rd person'};
var G_POS = {
  N:'Noun',V:'Verb',A:'Adjective',T:'Article',P:'Personal pronoun',R:'Relative pronoun',D:'Demonstrative pronoun',
  C:'Reciprocal pronoun',K:'Correlative pronoun',I:'Interrogative pronoun',X:'Indefinite pronoun',
  Q:'Correlative or interrogative pronoun',F:'Reflexive pronoun',S:'Possessive pronoun',
  ADV:'Adverb',CONJ:'Conjunction',COND:'Conditional particle',PRT:'Particle',PREP:'Preposition',
  INJ:'Interjection',HEB:'Hebrew word (transliterated)',ARAM:'Aramaic word (transliterated)'
};
var G_TENSE = {P:'present',I:'imperfect',F:'future',A:'aorist',R:'perfect',L:'pluperfect'};
var G_VOICE = {A:'active',M:'middle',P:'passive',E:'middle or passive',D:'middle deponent',N:'middle/passive deponent',O:'passive deponent',Q:'impersonal active',X:'no voice'};
var G_MOOD = {I:'indicative',S:'subjunctive',O:'optative',M:'imperative',N:'infinitive',P:'participle'};
var G_FLAG = {C:'comparative',S:'superlative',N:'negative',I:'interrogative',ATT:'Attic form',K:'crasis (joined with "and"/"also")'};
var G_INDECL = {PRI:'indeclinable proper name',LI:'indeclinable (a letter)',OI:'indeclinable',NUI:'indeclinable number'};

function _gCNG(s){
  // case + number [+ gender], e.g. "ASM", "GP", "NSF"
  var m=/^([NGDAV])([SP])([MFN])?$/.exec(s);
  if(!m)return null;
  return G_CASE[m[1]]+' '+G_NUM[m[2]]+(m[3]?' '+G_GEN[m[3]]:'');
}

/** Decodes one MACULA Greek tag. Returns {chip:string, unknown:string[]}. */
function _decodeGreek(morph){
  var parts=String(morph||'').split('-'),unknown=[];
  var pos=parts[0],label=G_POS[pos];
  if(!label){return {chip:'['+morph+']',unknown:[morph]};}
  var bits=[],flags=[];
  var rest=parts.slice(1).filter(function(p){return p!=='';});
  if(pos==='V'){
    var tvm=rest.shift()||'';
    var m=/^(2?)([PIFARL])([AMPEDNOQX])([ISOMNP])$/.exec(tvm);
    if(m){
      bits.push((m[1]?'second ':'')+G_TENSE[m[2]]+' '+G_VOICE[m[3]]+' '+G_MOOD[m[4]]);
    }else{unknown.push(tvm);bits.push('['+tvm+']');}
    rest.forEach(function(p){
      var pn=/^([123])([SP])$/.exec(p);
      if(pn){bits.push(G_PERSON[pn[1]]+' '+G_NUM[pn[2]]);return;}
      var cng=_gCNG(p);
      if(cng){bits.push(cng);return;}
      if(G_FLAG[p]){flags.push(G_FLAG[p]);return;}
      unknown.push(p);bits.push('['+p+']');
    });
  }else{
    rest.forEach(function(p){
      if(G_INDECL[p]){bits.push(G_INDECL[p]);return;}
      var cng=_gCNG(p);
      if(cng){bits.push(cng);return;}
      // personal / reflexive: person + case + number [+ gender], e.g. "1NS", "3GSM"
      var pp=/^([123])([NGDAV])([SP])([MFN])?$/.exec(p);
      if(pp){bits.push(G_PERSON[pp[1]]+' '+G_CASE[pp[2]]+' '+G_NUM[pp[3]]+(pp[4]?' '+G_GEN[pp[4]]:''));return;}
      // possessive: person + owner number + case + number + gender, e.g. "1PASF"
      var ps=/^([123])([SP])([NGDAV])([SP])([MFN])$/.exec(p);
      if(ps){bits.push(G_PERSON[ps[1]]+' '+G_NUM[ps[2]]+' owner, '+G_CASE[ps[3]]+' '+G_NUM[ps[4]]+' '+G_GEN[ps[5]]);return;}
      if(G_FLAG[p]){flags.push(G_FLAG[p]);return;}
      unknown.push(p);bits.push('['+p+']');
    });
  }
  var chip=label;
  var detail=bits.concat(flags).join(', ');
  if(detail)chip+=': '+detail;
  return {chip:chip,unknown:unknown};
}

// ── Hebrew / Aramaic (OSHB) ─────────────────────────────
var H_STEM = {q:'Qal',N:'Niphal',p:'Piel',P:'Pual',h:'Hiphil',H:'Hophal',t:'Hithpael',o:'Polel',O:'Polal',r:'Hithpolel',m:'Poel',M:'Poal',k:'Palel',K:'Pulal',Q:'Qal passive',l:'Pilpel',L:'Polpal',f:'Hithpalpel',D:'Nithpael',j:'Pealal',i:'Pilel',u:'Hothpaal',c:'Tiphil',v:'Hishtaphel',w:'Nithpalel',y:'Nithpoel',z:'Hithpoel'};
var A_STEM = {q:'Peal',Q:'Peil',u:'Hithpeel',p:'Pael',P:'Ithpaal',M:'Hithpaal',a:'Aphel',h:'Haphel',s:'Saphel',e:'Shaphel',H:'Hophal',i:'Ithpeal',t:'Hishtaphel',v:'Ishtaphal',w:'Hithaphel',o:'Polel',z:'Ithpoel',r:'Hithpolel',f:'Hithpalpel',b:'Hephal',c:'Hitpeel',m:'Poel',l:'Palpel',L:'Ithpalpel',O:'Ithpolel',G:'Ithpalel'};
var H_FORM = {p:'perfect',q:'consecutive perfect',i:'imperfect',w:'consecutive imperfect',h:'cohortative',j:'jussive',v:'imperative',r:'active participle',s:'passive participle',a:'infinitive absolute',c:'infinitive construct'};
var H_GEN = {m:'masculine',f:'feminine',c:'common gender',b:'masculine or feminine'};
var H_NUM = {s:'singular',p:'plural',d:'dual'};
var H_STATE = {a:'absolute',c:'construct',d:'with article'};
var H_PERSON = {'1':'1st person','2':'2nd person','3':'3rd person'};
var H_PART = {a:'Affirmation particle',d:'Definite article',e:'Exhortation particle',i:'Interrogative particle',j:'Interjection',m:'Demonstrative particle',n:'Negative particle',o:'Direct object marker',r:'Relative particle'};
var H_NTYPE = {c:'Common noun',g:'Gentilic noun (people or place)',p:'Proper name',x:'Noun'};
var H_ATYPE = {a:'Adjective',c:'Cardinal number',g:'Gentilic adjective',o:'Ordinal number'};
var H_PTYPE = {d:'Demonstrative pronoun',f:'Indefinite pronoun',i:'Interrogative pronoun',p:'Personal pronoun',r:'Relative pronoun'};
var H_SUFFIX = {d:'Directional “here” ending',h:'Paragogic “here” ending',n:'Paragogic “nun” ending',p:'Pronoun ending'};

/**
 * Decodes the field letters that follow a segment's type letters. `kinds` says what each
 * position means, in order: 'P' person, 'G' gender, 'N' number, 'S' state. A letter can mean
 * different things by position (c = common gender OR construct state), so meaning comes from
 * the position, never from the letter alone. 'x' means unspecified and is skipped.
 */
var H_FIELD = {P:H_PERSON,G:H_GEN,N:H_NUM,S:H_STATE};
function _hFields(chars,kinds,seg,unknown){
  var out=[];
  for(var i=0;i<chars.length;i++){
    var c=chars.charAt(i),kind=kinds[i];
    if(c==='x')continue;
    var word=kind?H_FIELD[kind][c]:null;
    if(word){out.push(word);}
    else{unknown.push(seg);out.push('['+c+']');}
  }
  return out;
}

/** Decodes one OSHB segment (language letter already removed), e.g. "Vqw3ms". */
function _hSegment(seg,isAram,unknown){
  var pos=seg.charAt(0),t=seg.slice(1);
  switch(pos){
    case 'C':return 'Conjunction';
    case 'D':return 'Adverb';
    case 'R':return t==='d'?'Preposition + article':(t===''?'Preposition':(unknown.push(seg),'Preposition ['+t+']'));
    case 'T':
      if(t==='')return 'Particle';
      return H_PART[t]||(unknown.push(seg),'Particle ['+t+']');
    case 'N':{
      var nt=H_NTYPE[t.charAt(0)]||(t?(unknown.push(seg),'Noun ['+t.charAt(0)+']'):'Noun');
      var nrest=_hFields(t.slice(1),['G','N','S'],seg,unknown);
      return nt+(nrest.length?': '+nrest.join(' '):'');
    }
    case 'A':{
      var at=H_ATYPE[t.charAt(0)]||(t?(unknown.push(seg),'Adjective ['+t.charAt(0)+']'):'Adjective');
      var arest=_hFields(t.slice(1),['G','N','S'],seg,unknown);
      return at+(arest.length?': '+arest.join(' '):'');
    }
    case 'P':{
      var pt=H_PTYPE[t.charAt(0)]||(t?(unknown.push(seg),'Pronoun ['+t.charAt(0)+']'):'Pronoun');
      var prest=_hFields(t.slice(1),['P','G','N'],seg,unknown);
      return pt+(prest.length?': '+prest.join(' '):'');
    }
    case 'S':{
      var st=H_SUFFIX[t.charAt(0)]||(unknown.push(seg),'Ending ['+t.charAt(0)+']');
      var srest=_hFields(t.slice(1),['P','G','N'],seg,unknown);
      return st+(srest.length?': '+srest.join(' '):'');
    }
    case 'V':{
      var stem=(isAram?A_STEM:H_STEM)[t.charAt(0)];
      var form=H_FORM[t.charAt(1)];
      if(!stem){unknown.push(seg);stem='['+t.charAt(0)+']';}
      if(!form){unknown.push(seg);form='['+t.charAt(1)+']';}
      var fc=t.charAt(1);
      var vrest=_hFields(t.slice(2),(fc==='r'||fc==='s')?['G','N','S']:['P','G','N'],seg,unknown);
      return 'Verb: '+stem+' '+form+(vrest.length?', '+vrest.join(' '):'');
    }
  }
  unknown.push(seg);
  return '['+seg+']';
}

function _decodeHebrew(morph){
  var s=String(morph||''),unknown=[];
  var lang=s.charAt(0);
  if(lang!=='H'&&lang!=='A'){return {chip:'['+s+']',unknown:[s]};}
  var isAram=lang==='A';
  var segs=s.slice(1).split('/').filter(function(x){return x!=='';});
  if(!segs.length){return {chip:'['+s+']',unknown:[s]};}
  var chip=segs.map(function(sg){return _hSegment(sg,isAram,unknown);}).join(' + ');
  if(isAram)chip='Aramaic · '+chip;
  return {chip:chip,unknown:unknown};
}

/**
 * Plain-English parsing chip for one word's morph tag.
 * @param {string} morph - tag from data/macula (e.g. "V-AAI-3S", "HC/Vqw3ms").
 * @param {boolean} isOT - true for books 1-39 (OSHB Hebrew/Aramaic tags), false for 40-66 (MACULA Greek).
 * @returns {{chip:string, unknown:string[]}} chip text, plus any codes not recognised.
 */
function decodeMorph(morph,isOT){
  return isOT?_decodeHebrew(morph):_decodeGreek(morph);
}

/**
 * Short English gloss from a Strong's definition (used where the source has no gloss:
 * every Hebrew word, and the few Greek words MACULA leaves blank). Takes the first clause,
 * with parentheses removed. Strong's KJV-rendering lists are alphabetical, not by frequency,
 * so they are NOT used here ("choose" would come first for bara, "angels" for Elohim).
 * @param {string} strongsDef - the entry's strongs_def text.
 * @returns {string} A short phrase, or '' if there is nothing usable.
 */
function shortGloss(strongsDef){
  var t=String(strongsDef||'').replace(/\([^)]*\)/g,' ').replace(/\(.*$/,' ').replace(/\)/g,' ').replace(/\s+/g,' ').trim();
  var cut=t.search(/[;,:]/);
  if(cut>0)t=t.slice(0,cut);
  t=t.replace(/[\s.]+$/,'').trim();
  if(t.length>60)t=t.slice(0,57).replace(/\s+\S*$/,'')+'…';
  return t;
}

export { decodeMorph, shortGloss };
