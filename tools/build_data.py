"""
Build the app's JSON data from STEPBible open data (CC BY 4.0).

Inputs (download from https://github.com/STEPBible/STEPBible-Data):
  - TAGNT Mat-Jhn ... .txt   (Translators Amalgamated OT+NT folder)
  - TAGNT Act-Rev ... .txt
  - TBESG ... .txt           (Lexicons folder)

Usage:
  python -I tools/build_data.py <folder with tagnt1.txt, tagnt2.txt, tbesg.txt> <output data folder>

What it produces (data/):
  lexicon.json    every lemma in the THGNT text, sorted by NT frequency
  nt.json         THGNT text, verse by verse, each word linked to lemma + morphology + gloss
  placement.json  real forms grouped by Mounce chapter topic, for the placement test

Changes made to the source data (as the licence asks us to note):
  - only words present in the Tyndale House GNT edition ("Tyn") are kept, using the
    Tyn spelling when TAGNT records a Tyn spelling variant
  - transliterations, paragraph marks and versification brackets are removed
  - glosses are shortened to the first sense
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

BOOKS = [
    ("Mat", "Matthew"), ("Mrk", "Mark"), ("Luk", "Luke"), ("Jhn", "John"), ("Act", "Acts"),
    ("Rom", "Romans"), ("1Co", "1 Corinthians"), ("2Co", "2 Corinthians"), ("Gal", "Galatians"),
    ("Eph", "Ephesians"), ("Php", "Philippians"), ("Col", "Colossians"), ("1Th", "1 Thessalonians"),
    ("2Th", "2 Thessalonians"), ("1Ti", "1 Timothy"), ("2Ti", "2 Timothy"), ("Tit", "Titus"),
    ("Phm", "Philemon"), ("Heb", "Hebrews"), ("Jas", "James"), ("1Pe", "1 Peter"), ("2Pe", "2 Peter"),
    ("1Jn", "1 John"), ("2Jn", "2 John"), ("3Jn", "3 John"), ("Jud", "Jude"), ("Rev", "Revelation"),
]
BOOK_IDX = {b: i for i, (b, _) in enumerate(BOOKS)}

REF_RE = re.compile(r"^([1-3A-Z][A-Za-z]{2})\.(\d+)\.(\d+)")
GREEK_CHARS = re.compile(r"[Ͱ-Ͽἀ-῿]")


def strip_marks(s):
    """Lowercase, remove accents/breathings/iota subscripts, normalize final sigma."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("ς", "σ")
    return re.sub(r"[^α-ω]", "", s)


def acute(s):
    """Turn a final grave accent into an acute (dictionary-style display)."""
    return unicodedata.normalize("NFC", unicodedata.normalize("NFD", s).replace("̀", "́"))


def clean_word(s):
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)  # drop "(translit)"
    return s.replace("¶", "").strip()


def split_punct(word):
    m = re.match(r"^(.*?)([.,;·:!?·;\]\[—–]*)$", word)
    return m.group(1), m.group(2)


def short_gloss(g):
    g = g.split(":")[0].strip()
    return g


def parse_tbesg(path):
    lex = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        cols = line.split("\t")
        if len(cols) < 8 or not re.match(r"^G\d{4}", cols[0]):
            continue
        key = cols[0].strip()
        if key in lex:
            continue
        defn = cols[7]
        head = ""
        m = re.match(r"\s*<b>[^<]*</b>((?:\s*,\s*-?[Ͱ-Ͽἀ-῿]+\.?)+)", defn)
        if m:
            head = re.sub(r"\s+", " ", m.group(1)).strip()
            head = head.lstrip(",").strip()
        lex[key] = {"lemma": cols[3].strip(), "morph": cols[5].strip(), "gloss": short_gloss(cols[6]), "head": head}
    return lex


def tyn_spelling(base, variants):
    """Return the THGNT (Tyn) spelling if a spelling variant lists Tyn."""
    if "Tyn" not in variants:
        return base
    for seg in variants.split(";"):
        if ":" not in seg:
            continue
        eds, form = seg.split(":", 1)
        eds = [e.strip().lstrip("+") for e in eds.split("+")]
        if "Tyn" in eds:
            form = form.strip()
            if form and GREEK_CHARS.search(form):
                _, punct = split_punct(base)
                core, _ = split_punct(form)
                return core + punct
    return base


def pos_of(code):
    head = code.split("-")[0]
    return {
        "N": "noun", "V": "verb", "A": "adjective", "T": "article", "P": "pronoun", "R": "pronoun",
        "C": "pronoun", "D": "pronoun", "K": "pronoun", "I": "pronoun", "X": "pronoun", "Q": "pronoun",
        "F": "pronoun", "S": "pronoun", "PREP": "preposition", "CONJ": "conjunction", "COND": "conjunction",
        "ADV": "adverb", "PRT": "particle", "INJ": "interjection", "ARAM": "foreign", "HEB": "foreign",
    }.get(head, "other")


def main(src, out):
    src, out = Path(src), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    tbesg = parse_tbesg(src / "tbesg.txt")

    verses = []  # (bookIdx, ch, vs, [ (surface, strong, morph, gloss, lemma, lemmaGloss) ])
    vindex = {}
    for fname in ("tagnt1.txt", "tagnt2.txt"):
        for line in (src / fname).read_text(encoding="utf-8").splitlines():
            cols = line.split("\t")
            if len(cols) < 6 or "#" not in cols[0] or "=" not in cols[0]:
                continue
            m = REF_RE.match(cols[0])
            if not m or not re.search(r"#\d+=", cols[0]):
                continue
            if "Tyn" not in cols[5].split("+") and not re.search(r"(^|\+)Tyn(\+|$|[»«])", cols[5]):
                continue
            b, c, v = m.group(1), int(m.group(2)), int(m.group(3))
            if b not in BOOK_IDX:
                continue
            word = tyn_spelling(clean_word(cols[1]), cols[7] if len(cols) > 7 else "")
            strong, _, morph = cols[3].partition("=")
            strong = strong.strip()
            # joined words like "H1732|G1138«G1138" -> last G number
            gs = re.findall(r"G\d{4}[A-Z]?", strong)
            strong = gs[-1] if gs else strong
            lemma, _, lgloss = cols[4].partition("=")
            gloss = re.sub(r"[\[\]<>]", "", cols[2]).strip()
            key = (BOOK_IDX[b], c, v)
            if key not in vindex:
                vindex[key] = len(verses)
                verses.append((key, []))
            verses[vindex[key]][1].append((word, strong, morph.strip(), gloss, lemma.split(",")[0].strip(), lgloss.strip()))

    verses.sort(key=lambda x: x[0])

    # ---- lexicon
    freq = Counter()
    lemma_info = {}
    proper = Counter()
    morph_by_lemma = defaultdict(Counter)
    gen_forms = defaultdict(Counter)
    for _, toks in verses:
        for (w, s, mo, g, lem, lg) in toks:
            freq[s] += 1
            morph_by_lemma[s][mo] += 1
            if re.search(r"-(P|L|PG|LG|T)$", mo) and not mo.endswith("-T"):
                proper[s] += 1
            if s not in lemma_info:
                lemma_info[s] = (lem, lg)
            if re.match(r"^N-GS[MFN]", mo):
                gen_forms[s][acute(split_punct(w)[0])] += 1
    lex_ids = sorted(freq, key=lambda s: (-freq[s], s))
    lex_index = {s: i for i, s in enumerate(lex_ids)}
    lexicon = []
    ARTICLE = {"M": "ὁ", "F": "ἡ", "N": "τό"}
    for s in lex_ids:
        lem, lg = lemma_info[s]
        t = tbesg.get(s) or tbesg.get(re.sub(r"[A-Z]$", "", s)) or {}
        common = morph_by_lemma[s].most_common(1)[0][0]
        pos = pos_of(common)
        gender = ""
        head = t.get("head", "")
        if pos == "noun":
            gm = Counter()
            for mo, n in morph_by_lemma[s].items():
                p = mo.split("-")
                if len(p) > 1 and len(p[1]) >= 3:
                    gm[p[1][2]] += n
            if gm:
                gender = gm.most_common(1)[0][0]
            # noun heads should look like "-ου, ὁ"; rebuild from the text when the lexicon gives an adjective-style head
            if not re.search(r"(^|, )(ὁ|ἡ|τό)( |,|$)", head) and gender in ARTICLE:
                gen = gen_forms[s].most_common(1)[0][0] if gen_forms[s] else ""
                head = (gen + ", " if gen else "") + ARTICLE[gender]
        elif pos == "verb":
            head = ""
        decl = 0
        if pos == "noun":
            gen = strip_marks(head.split(",")[0]) if head else ""
            lm = strip_marks(lem or "")
            if lm.endswith("ον") or (lm.endswith("οσ") and gender in ("M", "F")):
                decl = 2
            elif lm.endswith("οσ") and gender == "N":
                decl = 3
            elif lm.endswith("μα"):
                decl = 3
            elif (lm.endswith(("α", "η")) and gen.endswith(("ασ", "ησ"))) or (lm.endswith(("ησ", "ασ")) and gen.endswith("ου")):
                decl = 1
            elif gen:
                decl = 3
        lexicon.append({
            "id": s,
            "g": lem or t.get("lemma", ""),
            "e": short_gloss(lg) if lg else t.get("gloss", ""),
            "p": pos,
            "f": freq[s],
            "h": head,
            "x": gender,
            "pn": 1 if proper[s] > freq[s] / 2 else 0,
            **({"d": decl} if decl else {}),
        })

    # ---- text with string tables
    morphs, glosses = [], []
    mi, gi = {}, {}

    def idx(table, index, val):
        if val not in index:
            index[val] = len(table)
            table.append(val)
        return index[val]

    books = [{"b": b, "n": n, "c": []} for b, n in BOOKS]
    for (bi, c, v), toks in verses:
        chs = books[bi]["c"]
        while len(chs) < c:
            chs.append([])
        vs = chs[c - 1]
        while len(vs) < v:
            vs.append([])
        vs[v - 1] = [[w, lex_index[s], idx(morphs, mi, mo), idx(glosses, gi, g)] for (w, s, mo, g, _, _) in toks]

    (out / "lexicon.json").write_text(json.dumps(lexicon, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "nt.json").write_text(json.dumps({"m": morphs, "g": glosses, "books": books}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- every distinct inflected form: [form, lemmaIndex, [morph codes], count, first ref]
    fidx = {}
    flist = []
    for (bi, c, v), toks in verses:
        for (w, s, mo, g, _, _) in toks:
            core = acute(split_punct(w)[0])
            if not core or not GREEK_CHARS.search(core):
                continue
            key = (strip_marks(core), s)
            if key not in fidx:
                # keep lowercase unless it's a name
                disp = core if lexicon[lex_index[s]]["pn"] else core[0].lower() + core[1:]
                fidx[key] = len(flist)
                flist.append([disp, lex_index[s], [], 0, f"{BOOKS[bi][0]}.{c}.{v}"])
            e = flist[fidx[key]]
            if mo not in e[2]:
                e[2].append(mo)
            e[3] += 1
    (out / "forms.json").write_text(json.dumps(flist, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- placement test items: real forms per Mounce chapter topic
    forms = defaultdict(set)  # (normalized surface, strong) -> set of morph codes
    examples = defaultdict(list)
    for (bi, c, v), toks in verses:
        for (w, s, mo, g, _, _) in toks:
            core, _ = split_punct(w)
            k = (strip_marks(core), s)
            forms[k].add(mo)
            if len(examples[k]) < 1:
                examples[k].append((core, f"{BOOKS[bi][0]}.{c}.{v}"))

    def case_of(mo):
        p = mo.split("-")
        return p[1][0] if len(p) > 1 and p[1] and p[1][0] in "NGDAV" else None

    def tense_of(mo):
        p = mo.split("-")
        if p[0] != "V" or len(p) < 2:
            return None
        t = p[1].lstrip("2")
        return t[0] if t else None

    def mood_of(mo):
        p = mo.split("-")
        if p[0] != "V" or len(p) < 2:
            return None
        return p[1].lstrip("2")[2:3] or None

    def voice_of(mo):
        p = mo.split("-")
        if p[0] != "V" or len(p) < 2:
            return None
        v = p[1].lstrip("2")[1:2]
        return {"A": "A", "M": "M", "P": "P", "E": "MP", "D": "M", "O": "P", "N": "MP"}.get(v)

    def pn_of(mo):
        p = mo.split("-")
        if p[0] == "V" and len(p) > 2 and len(p[2]) == 2:
            return p[2]
        if p[0] == "P" and len(p) > 1 and p[1][:1] in "12":
            return p[1][0] + p[1][-1]
        return None

    CASES = ["N", "G", "D", "A"]
    topics = [
        (7, "Nominative & accusative", "case", CASES, lambda mo: re.match(r"^N-[NA][SP][MFN]$", mo)),
        (8, "Genitive & dative", "case", CASES, lambda mo: re.match(r"^N-[GD][SP][MFN]$", mo)),
        (10, "Adjectives", "case", CASES, lambda mo: re.match(r"^A-[NGDA][SP][MFN]$", mo)),
        (11, "Third declension", "case", CASES, None),  # filled specially below
        (12, "1st & 2nd person pronouns", "pn", ["1S", "1P", "2S", "2P"], lambda mo: re.match(r"^P-[12][NGDA][SP]$", mo)),
        (13, "αὐτός", "case", CASES, lambda mo: re.match(r"^P-[NGDA][SP][MFN]$", mo)),
        (14, "Demonstratives", "case", CASES, lambda mo: re.match(r"^D-[NGDA][SP][MFN]$", mo)),
        (15, "Relative pronoun", "case", CASES, lambda mo: re.match(r"^R-[NGDA][SP][MFN]$", mo)),
        (17, "Present active indicative", "pn", ["1S", "2S", "3S", "1P", "2P", "3P"], lambda mo: re.match(r"^V-PAI-[123][SP]$", mo)),
        (19, "Present middle/passive", "voice", ["A", "MP"], lambda mo: re.match(r"^V-P[AEN]I-[123][SP]$", mo)),
        (20, "Future", "tense", ["P", "F", "I", "A"], lambda mo: re.match(r"^V-F[AMD]I-", mo)),
        (22, "Imperfect", "tense", ["P", "F", "I", "A"], lambda mo: re.match(r"^V-I[AENM]I-", mo)),
        (23, "Second aorist", "tense", ["P", "F", "I", "A"], lambda mo: re.match(r"^V-2A[AMD]I-", mo)),
        (24, "First aorist", "tense", ["P", "F", "I", "A"], lambda mo: re.match(r"^V-A[AMD]I-", mo)),
        (25, "Aorist & future passive", "voice", ["A", "M", "P"], lambda mo: re.match(r"^V-2?[AF][PO]I-", mo)),
        (26, "Perfect", "tense", ["P", "I", "A", "R"], lambda mo: re.match(r"^V-2?R[AMPEN]I-", mo)),
        (28, "Participles", "mood", ["I", "P", "S", "N", "M"], lambda mo: re.match(r"^V-2?[PA][AMPEDON]P-", mo)),
        (31, "Subjunctive", "mood", ["I", "P", "S", "N", "M"], lambda mo: re.match(r"^V-2?[PA][AMPEDON]S-", mo)),
        (32, "Infinitive", "mood", ["I", "P", "S", "N", "M"], lambda mo: re.match(r"^V-2?[PA][AMPEDON]N$", mo)),
        (33, "Imperative", "mood", ["I", "P", "S", "N", "M"], lambda mo: re.match(r"^V-2?[PA][AMPEDON]M-", mo)),
    ]
    third_decl = {s for s in lex_ids if lexicon[lex_index[s]]["p"] == "noun" and re.match(r"^-(ος|ως|τος|ματος|εως|ους|ακος|ικος|ος|νος|ντος|ρος|δος|θος|ιδος|αιδος|ωνος|ηνος|ητος|ατος|υος|ενος|ορος|ερος)\b", lexicon[lex_index[s]]["h"]) and not lexicon[lex_index[s]]["h"].startswith("-ου")}
    getdim = {"case": case_of, "tense": tense_of, "mood": mood_of, "voice": voice_of, "pn": pn_of}

    out_topics = []
    for ch, title, dim, options, flt in topics:
        items = []
        for (norm, s), mos in forms.items():
            if lexicon[lex_index[s]]["pn"]:
                continue
            if ch == 11:
                ok = s in third_decl and any(re.match(r"^N-[NGDA][SP][MFN]$", mo) for mo in mos)
            else:
                ok = any(flt(mo) for mo in mos)
            if not ok:
                continue
            vals = {getdim[dim](mo) for mo in mos} - {None}
            if not vals or not vals <= set(options) or len(vals) == len(options):
                continue
            surface, ref = examples[(norm, s)][0]
            items.append({"f": surface, "a": sorted(vals), "l": lex_index[s], "r": ref, "fr": freq[s]})
        # prefer forms of common words
        items.sort(key=lambda x: -x["fr"])
        per_lemma = Counter()
        picked = []
        for it in items:
            if per_lemma[it["l"]] < (12 if ch in (12, 13, 14, 15) else 3):
                per_lemma[it["l"]] += 1
                picked.append(it)
        items = picked[:40]
        for it in items:
            del it["fr"]
        out_topics.append({"ch": ch, "t": title, "d": dim, "o": options, "i": items})
    (out / "placement.json").write_text(json.dumps(out_topics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    total = sum(freq.values())
    print(f"verses={len(verses)} tokens={total} lemmas={len(lexicon)} morphs={len(morphs)} glosses={len(glosses)}")
    for t in out_topics:
        print(t["ch"], t["t"], len(t["i"]))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1], sys.argv[2])
