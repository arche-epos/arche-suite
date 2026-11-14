#!/usr/bin/env python3
"""Build the offline Bible text packs for Pilgrim Private (Phase 3 of the offline downloads).

Writes data/bibles/<trans>.json for kjv, asv, ylt, darby, web, plus data/bibles/manifest.json (provenance + counts).

Each pack file maps "<bookNum>:<chapter>" -> [{"verse": n, "text": "..."}], the exact shape offline.js stores and
offlineBibleText() reads. Book numbers are 1..66 in canonical order (Genesis = 1, Revelation = 66), the same numbering
parseRef() uses. A verse the translation omits (for example Matthew 17:21 in the ASV) is kept with "text": "" so the
verse numbers stay put; the reader shows "(omitted in this version)".

Sources (all public domain; see data/bibles/manifest.json for the commit each run used):
  KJV, ASV, YLT  scrollmapper/bible_databases   formats/json/<NAME>.json
  Darby          seven1m/open-bibles            eng-darby.zefania.xml   (scrollmapper's Darby has 121 verses with
                                                  words run together, so it is NOT used)
  WEB            seven1m/open-bibles            eng-web.usfx.xml        (eBible.org USFX; deuterocanon, preface and
                                                  glossary are dropped; WEB's own numbering is kept as published,
                                                  including the doxology at Romans 14:24-26, and with no Psalm titles
                                                  added: WEB keeps them outside the verse text)

Usage:
  python3 data/build-bibles.py --scrollmapper /path/to/bible_databases --openbibles /path/to/open-bibles [--out data/bibles]

The source folders are git clones (the script records `git rev-parse HEAD` for provenance). Nothing is downloaded.
Fails loudly (exit 1) if any pack is not 66 books / 31,102 verses with the KJV chapter layout. WEB is allowed
exactly one deviation from that layout: its published Romans 14 and Romans 16 verse counts.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

CANON_USFX = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR',
              'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
              'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM',
              '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
              '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV']
# USFX elements whose text is not scripture (footnotes, cross references) - dropped, their tail text is kept.
USFX_SKIP = {'f', 'fe', 'x', 'ef', 'ex', 'rq'}
# WEB is published with these chapter sizes (Majority Text placement of the Romans doxology).
WEB_ALLOWED = {(45, 14): 26, (45, 16): 25}
EXPECTED_VERSES = {'kjv': 31102, 'asv': 31102, 'ylt': 31102, 'darby': 31102, 'web': 31103}

ROOT = os.path.dirname(os.path.abspath(__file__))


def clean(text):
    """Collapse whitespace; the packs hold plain text only."""
    return re.sub(r'\s+', ' ', text or '').strip()


def read_scrollmapper(folder, name):
    """scrollmapper JSON -> {(book, chapter): [(verse, text)]}."""
    with open(os.path.join(folder, 'formats', 'json', name + '.json'), encoding='utf-8') as f:
        d = json.load(f)
    out = {}
    for bi, b in enumerate(d['books'], 1):
        for c in b['chapters']:
            out[(bi, int(c['chapter']))] = [(int(v['verse']), clean(v['text'])) for v in c['verses']]
    return out


def read_darby(folder):
    """open-bibles Zefania XML -> same shape. Verse text is the element's text with any child markup flattened."""
    root = ET.parse(os.path.join(folder, 'eng-darby.zefania.xml')).getroot()
    out = {}
    for b in root.findall('.//BIBLEBOOK'):
        bn = int(b.get('bnumber'))
        for c in b.findall('CHAPTER'):
            out[(bn, int(c.get('cnumber')))] = [(int(v.get('vnumber')), clean(''.join(v.itertext()))) for v in c.findall('VERS')]
    return out


def read_web(folder):
    """open-bibles USFX -> same shape. Walks each canon book in document order; text between <v id=n/> and the next
    <v/>, <ve/> or <c/> belongs to verse n. Footnotes and cross references are skipped."""
    root = ET.parse(os.path.join(folder, 'eng-web.usfx.xml')).getroot()
    out = {}
    for book in root.findall('book'):
        bid = book.get('id')
        if bid not in CANON_USFX:
            continue  # preface, deuterocanon, glossary
        bn = CANON_USFX.index(bid) + 1
        state = {'ch': None, 'v': None, 'buf': []}

        def close():
            if state['v'] is not None and state['ch'] is not None:
                out.setdefault((bn, state['ch']), []).append((state['v'], clean(''.join(state['buf']))))
            state['v'] = None
            state['buf'] = []

        def walk(el):
            if el.tag == 'c':
                close()
                state['ch'] = int(el.get('id'))
            elif el.tag == 'v':
                close()
                state['v'] = int(el.get('id'))
            elif el.tag == 've':
                close()
            elif el.tag in USFX_SKIP:
                pass
            else:
                if state['v'] is not None and el.text:
                    state['buf'].append(el.text)
                for ch in el:
                    walk(ch)
            if el.tail and state['v'] is not None:
                state['buf'].append(el.tail)

        walk(book)
        close()
    return out


def check(trans, data, kjv):
    """Hard structure checks. Returns the verse total; raises SystemExit on any problem."""
    problems = []
    if len({b for b, _ in data}) != 66:
        problems.append('books=%d' % len({b for b, _ in data}))
    for key, ref_verses in kjv.items():
        got = data.get(key)
        want = len(ref_verses)
        if trans == 'web' and key in WEB_ALLOWED:
            want = WEB_ALLOWED[key]
        if got is None or len(got) != want:
            problems.append('%s chapter %s: expected %d verses, got %s' % (trans, key, want, None if got is None else len(got)))
            continue
        nums = [n for n, _ in got]
        if nums != list(range(1, want + 1)):
            problems.append('%s chapter %s: verse numbers are not 1..%d' % (trans, key, want))
    extra = set(data) - set(kjv)
    if extra:
        problems.append('%s has chapters KJV lacks: %s' % (trans, sorted(extra)[:5]))
    total = sum(len(v) for v in data.values())
    if total != EXPECTED_VERSES[trans]:
        problems.append('%s verse total %d, expected %d' % (trans, total, EXPECTED_VERSES[trans]))
    if problems:
        print('FAIL ' + trans)
        for p in problems[:20]:
            print('  ' + p)
        sys.exit(1)
    return total


def git_head(folder):
    """Commit SHA of a source clone, for the provenance record."""
    return subprocess.check_output(['git', '-C', folder, 'rev-parse', 'HEAD'], text=True).strip()


def write_pack(path, data):
    """Writes {"book:chapter": [{verse, text}]} compactly, keys in canonical order."""
    obj = {}
    for (b, c) in sorted(data):
        obj['%d:%d' % (b, c)] = [{'verse': n, 'text': t} for n, t in data[(b, c)]]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scrollmapper', required=True, help='clone of scrollmapper/bible_databases')
    ap.add_argument('--openbibles', required=True, help='clone of seven1m/open-bibles')
    ap.add_argument('--out', default=os.path.join(ROOT, 'bibles'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    packs = {
        'kjv': read_scrollmapper(a.scrollmapper, 'KJV'),
        'asv': read_scrollmapper(a.scrollmapper, 'ASV'),
        'ylt': read_scrollmapper(a.scrollmapper, 'YLT'),
        'darby': read_darby(a.openbibles),
        'web': read_web(a.openbibles),
    }
    kjv = packs['kjv']
    manifest = {'sources': {'scrollmapper/bible_databases': git_head(a.scrollmapper), 'seven1m/open-bibles': git_head(a.openbibles)}, 'packs': {}}
    for trans, data in packs.items():
        total = check(trans, data, kjv)
        empty = sorted((b, c, n) for (b, c), vs in data.items() for n, t in vs if not t)
        size = write_pack(os.path.join(a.out, trans + '.json'), data)
        manifest['packs'][trans] = {'verses': total, 'emptyVerses': len(empty), 'bytes': size}
        print('%-5s %d verses, %d empty, %.2f MB' % (trans, total, len(empty), size / 1e6))
    with open(os.path.join(a.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
