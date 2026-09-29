#!/usr/bin/env node
// morph.test.js — Interlinear morph decoding (Bible Tools Release 3, v4.43.0)
// Usage (from pilgrim-private/): node tests/morph.test.js
// morph.js has no imports/DOM, so no browser is needed. It also reads every book file in ../../data/macula
// and fails if any real morph tag contains a code the decoder does not recognise.
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = path.join(os.tmpdir(), 'morph-' + process.pid + '.mjs');
fs.copyFileSync(path.join(__dirname, '..', 'morph.js'), tmp);

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log('FAIL: ' + name + '\n   got:  ' + g + '\n   want: ' + w); }
}

import(tmp).then((m) => {
  const d = (t, ot) => m.decodeMorph(t, !!ot).chip;
  // Greek
  eq('aorist active indicative', d('V-AAI-3S'), 'Verb: aorist active indicative, 3rd person singular');
  eq('second aorist participle', d('V-2AAP-APM'), 'Verb: second aorist active participle, accusative plural masculine');
  eq('infinitive', d('V-PAN'), 'Verb: present active infinitive');
  eq('noun', d('N-ASM'), 'Noun: accusative singular masculine');
  eq('superlative adjective', d('A-ASM-S'), 'Adjective: accusative singular masculine, superlative');
  eq('article', d('T-DSN'), 'Article: dative singular neuter');
  eq('no-dash tag', d('CONJ'), 'Conjunction');
  eq('possessive', d('S-1PASF'), 'Possessive pronoun: 1st person plural owner, accusative singular feminine');
  eq('interrogative flag', d('ADV-I'), 'Adverb: interrogative');
  // Hebrew / Aramaic
  eq('wayyiqtol with conjunction', d('HC/Vqw3ms', true), 'Conjunction + Verb: Qal consecutive imperfect, 3rd person masculine singular');
  eq('noun with article', d('HTd/Ncmsa', true), 'Definite article + Common noun: masculine singular absolute');
  eq('c = construct state, not common gender', d('HNcmpc', true), 'Common noun: masculine plural construct');
  eq('c = common gender in a person slot', d('HVNp3cp', true), 'Verb: Niphal perfect, 3rd person common gender plural');
  eq('proper name', d('HNp', true), 'Proper name');
  eq('preposition + pronoun ending', d('HR/Sp3ms', true), 'Preposition + Pronoun ending: 3rd person masculine singular');
  eq('participle takes gender/number/state', d('HVqrmsa', true), 'Verb: Qal active participle, masculine singular absolute');
  eq('infinitive construct', d('HVqc', true), 'Verb: Qal infinitive construct');
  eq('Aramaic stem names differ', d('AVqp3ms', true), 'Aramaic · Verb: Peal perfect, 3rd person masculine singular');
  eq('unknown code is shown, not hidden', m.decodeMorph('Z-XYZ', false).unknown, ['Z-XYZ']);
  // shortGloss
  eq('gloss: first clause', m.shortGloss(' (absolutely) to create; (qualified) to cut down'), 'to create');
  eq('gloss: unclosed parenthesis', m.shortGloss(' the sky (as aloft; the dual perhaps'), 'the sky');
  eq('gloss: empty', m.shortGloss(''), '');

  // Coverage: every distinct tag in all 66 book files decodes with no unrecognised code.
  const dir = path.join(__dirname, '..', '..', 'data', 'macula');
  if (fs.existsSync(dir)) {
    const seen = new Set(), bad = [];
    for (let n = 1; n <= 66; n++) {
      const book = JSON.parse(fs.readFileSync(path.join(dir, String(n).padStart(2, '0') + '.json'), 'utf8'));
      Object.keys(book).forEach((ref) => book[ref].forEach((w) => {
        const key = (n <= 39 ? 'O|' : 'N|') + w.morph;
        if (seen.has(key)) return;
        seen.add(key);
        const r = m.decodeMorph(w.morph, n <= 39);
        if (!r.chip || r.unknown.length) bad.push(key + ' => ' + r.chip);
      }));
    }
    eq('every real tag decodes (' + seen.size + ' distinct)', bad.slice(0, 10), []);
  } else { console.log('skipped coverage check: data/macula not found'); }

  fs.unlinkSync(tmp);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
