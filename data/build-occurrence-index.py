#!/usr/bin/env python3
"""build-occurrence-index.py — regenerates data/strongs/occurrence-index.json (v4.49.5).

Every verse where each Strong's number occurs, from data/macula/ (one entry per verse). Old Testament
verse numbers in macula are the Hebrew (WLC) ones; they are converted to English (KJV) numbers with the
verse map in pilgrim-private/versemap.js, because Look Up Word shows KJV text for each reference.

Usage (from repo root):  python3 data/build-occurrence-index.py

Output {"t": ..., "o": ...}:
  t: per book (1-66), the number of verses in each English chapter. Verse index = position when every book,
     chapter and verse 1..N is counted in order (starting at 0).
  o: Strong's number -> comma-separated verse indexes, each stored as the difference from the one before
     (ascending order, so the numbers stay small).
"""
import json, re

BOOKS = "Genesis,Exodus,Leviticus,Numbers,Deuteronomy,Joshua,Judges,Ruth,1 Samuel,2 Samuel,1 Kings,2 Kings,1 Chronicles,2 Chronicles,Ezra,Nehemiah,Esther,Job,Psalms,Proverbs,Ecclesiastes,Song of Solomon,Isaiah,Jeremiah,Lamentations,Ezekiel,Daniel,Hosea,Joel,Amos,Obadiah,Jonah,Micah,Nahum,Habakkuk,Zephaniah,Haggai,Zechariah,Malachi,Matthew,Mark,Luke,John,Acts,Romans,1 Corinthians,2 Corinthians,Galatians,Ephesians,Philippians,Colossians,1 Thessalonians,2 Thessalonians,1 Timothy,2 Timothy,Titus,Philemon,Hebrews,James,1 Peter,2 Peter,1 John,2 John,3 John,Jude,Revelation".split(',')

def load_versemap(path='pilgrim-private/versemap.js'):
    s = open(path, encoding='utf-8').read()
    runs = json.loads(re.search(r'var VM_RUNS = (\{.*?\});', s, re.S).group(1))
    orph = json.loads(re.search(r'var VM_ORPHANS = (\[.*?\]);', s, re.S).group(1))
    return runs, orph

def main():
    runs, orph = load_versemap()
    # Hebrew verse -> English verse, per book (inverse of the runs in versemap.js).
    heb2eng = {}
    for b, rs in runs.items():
        for ec, ev, hc, hv, n in rs:
            for i in range(n):
                heb2eng.setdefault((int(b), hc, hv + i), (ec, ev + i))
    orphans = {tuple(o) for o in orph}   # Hebrew-only verses (Psalm titles etc.): belong with the English verse of the same number
    found = {}      # strongs -> set of (book, chapter, verse) in English numbering
    chap = {}       # (book, chapter) -> highest verse number seen
    for bi in range(1, 67):
        d = json.load(open('data/macula/%02d.json' % bi, encoding='utf-8'))
        for k, words in d.items():
            c, v = (int(x) for x in k.split(':'))
            if bi <= 39:
                c, v = heb2eng.get((bi, c, v), (c, v))
            chap[(bi, c)] = max(chap.get((bi, c), 0), v)
            for s in {w.get('strongs') for w in words if w.get('strongs')}:
                found.setdefault(s, set()).add((bi, c, v))
    # verse table: every verse 1..N of every chapter, in order
    table, start = [], {}
    idx = 0
    for bi in range(1, 67):
        chs = sorted(c for (b, c) in chap if b == bi)
        counts = []
        for c in range(1, max(chs) + 1):
            n = chap.get((bi, c), 0)
            counts.append(n)
            start[(bi, c)] = idx
            idx += n
        table.append(counts)
    out = {}
    for s, vs in found.items():
        ids = sorted(start[(b, c)] + v - 1 for (b, c, v) in vs)
        out[s] = ','.join(str(x - (ids[i - 1] if i else 0)) for i, x in enumerate(ids))
    json.dump({'t': table, 'o': out}, open('data/strongs/occurrence-index.json', 'w'), separators=(',', ':'))
    print('words', len(out), 'verses in table', idx, 'refs', sum(len(v) for v in found.values()))

if __name__ == '__main__':
    main()
