"""
build-hebrew-gloss.py  (Pilgrim Private v4.52.0, fix-plan Batch 3c)

Fills the empty `gloss` field of data/macula/01.json .. 39.json (Old Testament) with the English gloss from
MACULA Hebrew (Clear-Bible/macula-hebrew, WLC/lowfat/*.xml, CC BY 4.0). The Open Scriptures word list in those
files (word, lemma, strongs, morph) is NOT changed; only `gloss` is written.

Usage:
  git clone --depth 1 --filter=blob:none --sparse https://github.com/Clear-Bible/macula-hebrew /tmp/mh
  (cd /tmp/mh && git sparse-checkout set WLC/lowfat)
  python3 data/build-hebrew-gloss.py /tmp/mh/WLC/lowfat data/macula [--dry]

How a word is matched (nothing is guessed):
  * MACULA splits a Hebrew word into morphemes (prefix, stem, pronoun suffix). xml:id is
    o + book(2) + chapter(3) + verse(3) + word(3) + morpheme(1); morphemes with the same word number are one word.
  * A word of ours is paired with a MACULA word ONLY when their Hebrew consonants are identical (vowel points,
    accents and maqaf ignored). The two sources split a few words differently (for example at a maqaf), so the
    walk re-syncs: two or three MACULA words may join to match one of ours. Anything that still does not match
    keeps gloss "" (the Interlinear then shows a dash), never a neighbour's gloss.
  * The gloss is MACULA's `gloss` attribute of the word's morphemes, joined in order, with "." (MACULA's
    word joiner) turned into a space. Grammar markers such as "(et)" are kept exactly as MACULA writes them.
  * One tidy-up: when the last morpheme is a pronoun suffix and its gloss words already appear earlier in the same
    word ("your life your"), the repeated suffix is dropped ("your life").
"""
import re, sys, json, glob, collections

LOWFAT, OUT = sys.argv[1], sys.argv[2]
DRY = '--dry' in sys.argv
wre = re.compile(r'<w\b([^>]*)>([^<]*)</w>')
are = re.compile(r'([\w:]+)="([^"]*)"')
CONS = re.compile(r'[^\u05D0-\u05EA]')


def cons(t):
    """Hebrew consonants only (drops points, accents, maqaf, punctuation)."""
    return CONS.sub('', t or '')


def chapter(path):
    s = open(path, encoding='utf-8').read()
    out = collections.OrderedDict()
    for m in wre.finditer(s):
        a = dict(are.findall(m.group(1)))
        i = a.get('xml:id', '')
        if not re.fullmatch(r'o\d{12}', i):
            continue
        a['_t'] = m.group(2)
        ch, vs, wd = int(i[3:6]), int(i[6:9]), int(i[9:12])
        out.setdefault((ch, vs), collections.OrderedDict()).setdefault(wd, []).append(a)
    return out


def word_gloss(morphemes):
    parts = [(x.get('gloss', ''), x.get('morph', '')) for x in morphemes if x.get('gloss')]
    texts = [re.sub(r'\s+', ' ', g.replace('.', ' ')).strip() for g, _ in parts]
    if len(parts) > 1 and parts[-1][1].startswith('S'):
        earlier = ' '.join(texts[:-1]).lower().split()
        if all(t in earlier for t in texts[-1].lower().split()):
            texts = texts[:-1]
    return ' '.join(t for t in texts if t)


def align(ours, mac_words):
    """ours: list of our word dicts; mac_words: list of morpheme-lists. Returns a gloss string per word of ours.
    Each of our words takes the nearest unused MACULA word (within 4 places of where we expect it) whose Hebrew
    consonants are identical; MACULA sometimes lists words in a slightly different order than the text.
    Two or three adjacent MACULA words may together equal one of ours (split at a maqaf)."""
    mc = [cons(''.join(x['_t'] for x in mm)) for mm in mac_words]
    oc = [cons(w['word']) for w in ours]
    used = [False] * len(mac_words)
    res = [''] * len(ours)
    e = 0
    for i in range(len(ours)):
        if not oc[i]:
            continue
        best = None
        for d in range(0, 5):
            for j in ((e + d, e - d) if d else (e,)):
                if 0 <= j < len(mc) and not used[j] and mc[j] == oc[i]:
                    best = [j]; break
            if best:
                break
        if not best:
            for j in range(max(0, e - 2), min(len(mc), e + 5)):
                for k in (2, 3):
                    if j + k <= len(mc) and not any(used[j:j + k]) and ''.join(mc[j:j + k]) == oc[i]:
                        best = list(range(j, j + k)); break
                if best:
                    break
        if best:
            for j in best:
                used[j] = True
            res[i] = ' '.join(g for g in (word_gloss(mac_words[j]) for j in best) if g)
            e = best[-1] + 1
    return res


tot = filled = nogloss = unmatched = 0
bad_verses = 0
for bk in range(1, 40):
    mac = {}
    for p in sorted(glob.glob('%s/%02d-*-lowfat.xml' % (LOWFAT, bk))):
        mac.update(chapter(p))
    path = '%s/%02d.json' % (OUT, bk)
    data = json.load(open(path, encoding='utf-8'))
    for key, words in data.items():
        c, v = map(int, key.split(':'))
        m = mac.get((c, v))
        tot += len(words)
        if m is None:
            res = [''] * len(words)
        else:
            res = align(words, list(m.values()))
        if any(not g for g in res):
            bad_verses += 1
        for w, g in zip(words, res):
            w['gloss'] = g
            if g:
                filled += 1
            else:
                unmatched += 1
    if not DRY:
        open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
print('words', tot, 'with a gloss', filled, 'left blank', unmatched, '(%.2f%%)' % (100.0 * unmatched / tot))
print('verses with at least one blank word:', bad_verses)
