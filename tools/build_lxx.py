"""
Build Septuagint + English reference data for the Translate tab and Reader.

Inputs (in data-src/):
  grcbrent/grcbrent_vpl.txt  Brenton's Greek Septuagint (public domain, eBible.org "grcbrent" VPL)
  brenton_vpl.txt            Brenton's English Septuagint (public domain, eBible.org "eng-Brenton" VPL)
  swete/*.txt                Swete LXX with Morpheus lemmas/parsing (QuantForgeSoftware/lxx, CC BY-SA 4.0),
                             used only as a form -> lemma/parsing dictionary
  bsb.txt                    Berean Standard Bible (public domain, bereanbible.com/bsb.txt)
  (plus data/nt.json and data/lexicon.json from build_data.py)

Outputs (in data/):
  en-nt.json          BSB NT text, by our NT book codes
  lxx/index.json      book list, morphology code table, LXX lemma table (with NT links/glosses)
  lxx/<Book>.json     one file per book: Greek tokens per verse + Brenton English

The Greek text is Brenton's: the edition his English translates, so the two line up verse for verse.
It has no tagging, so each word gets a lemma and parsing by looking its form up in
(1) the THGNT's contextual tags and (2) the Morpheus analyses of the same forms in Swete's text.
Lookups go by form, not context, so an ambiguous form gets its most common analysis.

Canon: books follow the Catholic Old Testament. 1 Esdras, 3-4 Maccabees, the Prayer of Manasseh,
Psalm 151, the Odes and the Psalms of Solomon are left out.

Usage: python -I tools/build_lxx.py data-src data
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

NT_BOOKS = {
    "Matthew": "Mat", "Mark": "Mrk", "Luke": "Luk", "John": "Jhn", "Acts": "Act", "Romans": "Rom", "1 Corinthians": "1Co",
    "2 Corinthians": "2Co", "Galatians": "Gal", "Ephesians": "Eph", "Philippians": "Php", "Colossians": "Col",
    "1 Thessalonians": "1Th", "2 Thessalonians": "2Th", "1 Timothy": "1Ti", "2 Timothy": "2Ti", "Titus": "Tit",
    "Philemon": "Phm", "Hebrews": "Heb", "James": "Jas", "1 Peter": "1Pe", "2 Peter": "2Pe", "1 John": "1Jn",
    "2 John": "2Jn", "3 John": "3Jn", "Jude": "Jud", "Revelation": "Rev",
}
# Brenton code -> (our id, display name). Anything not listed (1ES, PRM, 3MA, 4MA) is left out.
BOOKS = [
    ("GEN", "Gen", "Genesis"), ("EXO", "Exod", "Exodus"), ("LEV", "Lev", "Leviticus"), ("NUM", "Num", "Numbers"),
    ("DEU", "Deut", "Deuteronomy"), ("JOS", "Josh", "Joshua"), ("JDG", "Judg", "Judges"), ("RUT", "Ruth", "Ruth"),
    ("1SA", "1Kgdms", "1 Kingdoms (1 Samuel)"), ("2SA", "2Kgdms", "2 Kingdoms (2 Samuel)"), ("1KI", "3Kgdms", "3 Kingdoms (1 Kings)"),
    ("2KI", "4Kgdms", "4 Kingdoms (2 Kings)"), ("1CH", "1Chr", "1 Chronicles"), ("2CH", "2Chr", "2 Chronicles"),
    ("EZR", "2Esd", "Ezra–Nehemiah (2 Esdras)"), ("TOB", "Tob", "Tobit"), ("JDT", "Jdt", "Judith"),
    ("ESG", "Esth", "Esther (with Greek additions)"), ("1MA", "1Macc", "1 Maccabees"), ("2MA", "2Macc", "2 Maccabees"),
    ("JOB", "Job", "Job"), ("PSA", "Ps", "Psalms"), ("PRO", "Prov", "Proverbs"), ("ECC", "Eccl", "Ecclesiastes"),
    ("SOL", "Song", "Song of Songs"), ("WIS", "Wis", "Wisdom"), ("SIR", "Sir", "Sirach"), ("ISA", "Isa", "Isaiah"),
    ("JER", "Jer", "Jeremiah"), ("LAM", "Lam", "Lamentations"), ("BAR", "Bar", "Baruch"), ("EPJ", "EpJer", "Letter of Jeremiah (Baruch 6)"),
    ("EZE", "Ezek", "Ezekiel"), ("DNG", "Dan", "Daniel (with Greek additions)"), ("SUS", "Sus", "Susanna (Daniel 13)"),
    ("BEL", "Bel", "Bel and the Dragon (Daniel 14)"), ("HOS", "Hos", "Hosea"), ("JOE", "Joel", "Joel"), ("AMO", "Amos", "Amos"),
    ("OBA", "Obad", "Obadiah"), ("JON", "Jonah", "Jonah"), ("MIC", "Mic", "Micah"), ("NAH", "Nah", "Nahum"), ("HAB", "Hab", "Habakkuk"),
    ("ZEP", "Zeph", "Zephaniah"), ("HAG", "Hag", "Haggai"), ("ZEC", "Zech", "Zechariah"), ("MAL", "Mal", "Malachi"),
]
SKIP_CHAPTERS = {("PSA", 151)}  # Psalm 151 isn't in the Catholic canon

# Morpheus uses Attic lemma spellings for some Koine words, and some lemmas differ from STEPBible's.
LEMMA_ALIAS = {
    "θάλαττα": "θάλασσα", "πράττω": "πράσσω", "ἐλάττων": "ἐλάσσων", "γλῶττα": "γλῶσσα", "ἥττων": "ἥσσων",
    "εἶπον": "ἔπω", "ἐρέω": "ἔπω", "εἶδον": "εἴδω", "οἶδα": "εἴδω", "οὕτως": "οὕτω", "ἐνώπιος": "ἐνώπιον",
    "ἀπόλλυμι": "ἀπολλύω", "καταλιμπάνω": "καταλείπω", "ἀνοίγνυμι": "ἀνοίγω", "ἐθέλω": "θέλω", "ἐλεάω": "ἐλεέω",
    "ἐπιλανθάνομαι": "ἐπιλανθάνω", "σωτήριος": "σωτήριον", "Λευείτης": "Λευΐτης", "Ἰδούς": "ἰδού", "πέρα": "πέραν",
    "κύκλος": "κύκλῳ", "φάος": "φῶς", "μείς": "μήν", "σαυτοῦ": "σύ", "σεαυτοῦ": "σύ", "σός": "σύ", "ἐμός": "ἐγώ",
    "ἐμαυτοῦ": "ἐγώ", "τῆ": "ὁ", "πίμπλημι": "πλήθω", "ἐμπίπλημι": "ἐμπίμπλημι", "εἶπος": "ἔπω",
}

APOS = "’"
WORD = re.compile(r"^([̀-ͯͰ-Ͽἀ-῿’ʼ᾽᾿']+)(.*)$")


def nt_spelling(lemma):
    lemma = LEMMA_ALIAS.get(lemma, lemma)
    return lemma.replace("γιγν", "γιν").replace("Γιγν", "Γιν")


def strip(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^α-ω]", "", s.lower().replace("ς", "σ"))


def acute(s):
    return unicodedata.normalize("NFC", unicodedata.normalize("NFD", s).replace("̀", "́"))


def norm_apos(s):
    return re.sub(r"[ʼ᾽᾿'̓]$", APOS, s)


def lower1(w):
    return w[:1].lower() + w[1:]


def to_robinson(pos, code, lemma):
    """MorphGNT-style POS + 8-char parse -> Robinson-style code used by the app."""
    p, t, v, m, c, n, g = (code + "--------")[:7]
    cng = f"{c}{n}{g}" if c != "-" and n != "-" else ""
    if pos == "V-":
        tense = {"X": "R", "Y": "L"}.get(t, t)
        mood = {"D": "M", "-": "M"}.get(m, m)
        if mood == "P":
            return f"V-{tense}{v}P-{c}{n}{g}"
        if mood == "N":
            return f"V-{tense}{v}N"
        return f"V-{tense}{v}{mood}-{p}{n}"
    base = strip(lemma)
    if base in ("εγω", "συ", "ημεισ", "υμεισ"):
        person = "1" if base in ("εγω", "ημεισ") else "2"
        return f"P-{person}{c}{n}" if c != "-" else "P"
    if base == "αυτοσ" and cng:
        return f"P-{cng}"
    if base in ("ουτοσ", "εκεινοσ", "οδε") and cng:
        return f"D-{cng}"
    head = {"N-": "N", "A-": "A", "RA": "T", "RP": "P", "RR": "R", "RI": "I", "RD": "D"}.get(pos)
    if head:
        return f"{head}-{cng}" if cng else head
    return {"P-": "PREP", "C-": "CONJ", "D-": "ADV", "X-": "PRT", "I-": "INJ", "NP": "N-PRI-P"}.get(pos, "X")


def load_bsb(path):
    out = defaultdict(lambda: defaultdict(dict))
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if "\t" not in line:
            continue
        ref, text = line.split("\t", 1)
        m = re.match(r"^(.+) (\d+):(\d+)$", ref.strip())
        if not m or m.group(1) not in NT_BOOKS:
            continue
        out[NT_BOOKS[m.group(1)]][int(m.group(2))][int(m.group(3))] = text.strip()
    return out


def load_vpl(path):
    out = defaultdict(lambda: defaultdict(dict))
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        m = re.match(r"^(\w{3}) (\d+):(\d+) (.*)$", line)
        if m:
            out[m.group(1)][int(m.group(2))][int(m.group(3))] = m.group(4).strip()
    return out


def main(src, outdir):
    src, outdir = Path(src), Path(outdir)
    lxxdir = outdir / "lxx"
    lxxdir.mkdir(parents=True, exist_ok=True)
    for old in lxxdir.glob("*.json"):
        old.unlink()

    # ---------- NT English (BSB) ----------
    bsb = load_bsb(src / "bsb.txt")
    en_nt = {}
    for b, chs in bsb.items():
        n = max(chs)
        en_nt[b] = [[chs[c].get(v, "") for v in range(1, (max(chs[c]) if chs[c] else 0) + 1)] if c in chs else [] for c in range(1, n + 1)]
    (outdir / "en-nt.json").write_text(json.dumps(en_nt, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    nt = json.loads((outdir / "nt.json").read_text(encoding="utf-8"))
    ntlex = json.loads((outdir / "lexicon.json").read_text(encoding="utf-8"))
    nt_by_norm = {}
    for i, l in enumerate(ntlex):
        nt_by_norm.setdefault(strip(l["g"]), i)

    # ---------- lemma + morph tables ----------
    lex, lex_idx, morphs, morph_idx = [], {}, [], {}

    def nt_link(lemma):
        lm = nt_spelling(lemma)
        i = nt_by_norm.get(strip(lm).replace("γιγν", "γιν"), nt_by_norm.get(strip(lm), -1))
        if i >= 0 and ntlex[i].get("pn") and lemma[:1].islower():
            return -1  # NT only has a name spelled this way (e.g. Χλόη), but here it's a common word
        return i

    def lemma_id(lemma, pn=False, nti=None):
        lemma = re.sub(r"-.*$", "", lemma)
        if nti is None:
            nti = -1 if pn else nt_link(lemma)
        key = ("nt%d" % nti) if nti >= 0 else strip(lemma) + ("|pn" if pn else "")
        if key not in lex_idx:
            lex_idx[key] = len(lex)
            lex.append({"g": ntlex[nti]["g"] if nti >= 0 else lemma, "e": ntlex[nti]["e"] if nti >= 0 else "", "f": 0, "nt": nti, "pn": 1 if (pn or (nti >= 0 and ntlex[nti].get("pn"))) else 0})
        return lex_idx[key]

    def morph_id(m):
        if m not in morph_idx:
            morph_idx[m] = len(morphs)
            morphs.append(m)
        return morph_idx[m]

    # ---------- form dictionary: form -> Counter(((source, lemma, is_name), morph code)) ----------
    nt_exact, nt_loose = defaultdict(Counter), defaultdict(Counter)   # THGNT: acute-normalized (first letter lowercased) / unaccented
    sw_exact, sw_loose = defaultdict(Counter), defaultdict(Counter)   # Swete + Morpheus
    accent_votes = defaultdict(Counter)

    # (1) THGNT contextual tags, weighted higher
    for bk in nt["books"]:
        for vs in bk["c"]:
            for toks in vs:
                for t in toks:
                    m = WORD.match(unicodedata.normalize("NFC", t[0]))
                    if not m:
                        continue
                    w = acute(norm_apos(m.group(1)))
                    a = (("nt", t[1], bool(ntlex[t[1]]["pn"])), nt["m"][t[2]])
                    nt_exact[lower1(w)][a] += 1
                    nt_loose[strip(w)][a] += 1
                    if w[:1].islower():
                        accent_votes[strip(w)][w] += 3
    # (2) Swete + Morpheus analyses
    for f in sorted((src / "swete").glob("*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            c = line.split(" ")
            if len(c) != 9:
                continue
            _, pos, parse, text, word, norm, lemma, _, source = c
            if re.search(r"[A-Za-z]", word) or (source == "morpheus-proper" and word[:1].islower()):
                continue
            w = acute(norm_apos(word))
            if len(w) > 1 and w.upper() == w:
                continue  # unaccented capitals
            a = (("sw", lemma, pos == "NP" or "-" in lemma), to_robinson(pos, parse, lemma))
            sw_exact[lower1(w)][a] += 1
            sw_loose[strip(w)][a] += 1
            if w[:1].islower():
                accent_votes[strip(w)][w] += 1

    def variants(w):
        yield w
        if w.endswith("ν"):
            yield w[:-1]          # movable nu
        elif w[-1:] in "ιε":
            yield w + "ν"

    def lookup(ex, w):
        for x in variants(w):
            hit = ex.get(lower1(x))
            if hit:
                return hit
        return None

    def entry(key):
        (src_, lem, pn), code = key
        li = lemma_id(ntlex[lem]["g"], pn, lem) if src_ == "nt" else lemma_id(lem, pn)
        return li, code

    def to_entry(hits):
        """Best analysis plus the other candidates (for the agreement pass)."""
        best = entry(hits.most_common(1)[0][0])
        alts = [entry(k) for k, _ in hits.most_common(8)]
        return best[0], best[1], alts

    def common_noun(hits):
        """True when the NT uses this form as an ordinary word (so Θεὸς, Κύριος mid-verse aren't names)."""
        top = hits.most_common(1)[0]
        return not top[0][0][2] and sum(hits.values()) >= 5

    def analyse(word, initial):
        """Lemma + parsing for a word. The THGNT's tags win whenever the form occurs in the NT;
        accent-sensitive matches beat accent-insensitive ones."""
        w = acute(norm_apos(word))
        capital = w[:1].isupper()
        nt_hit = lookup(nt_exact, w)
        sw_hit = lookup(sw_exact, w)
        if capital and not initial:
            # mid-verse capital: a name, unless the NT uses it as an ordinary word (Θεός, Κύριος)
            if nt_hit and (nt_hit.most_common(1)[0][0][0][2] or common_noun(nt_hit)):
                return to_entry(nt_hit)
            if sw_hit and sw_hit.most_common(1)[0][0][0][2]:
                return to_entry(sw_hit)
            return None
        for hits in (nt_hit, sw_hit, nt_loose.get(strip(w)), sw_loose.get(strip(w))):
            if hits:
                return to_entry(hits)
        return None

    def restore_caps(word):
        votes = accent_votes.get(strip(word))
        if not votes:
            return None
        best = votes.most_common(1)[0][0]
        return best[0].upper() + best[1:]

    greek = load_vpl(src / "grcbrent" / "grcbrent_vpl.txt")
    english = load_vpl(src / "brenton_vpl.txt")

    index_books = []
    stats = Counter()
    for bcode, bid, name in BOOKS:
        chs = greek.get(bcode, {})
        if not chs:
            print("missing book", bcode)
            continue
        out_c, out_en = [], []
        kept = 0
        for ch in range(1, max(chs) + 1):
            if (bcode, ch) in SKIP_CHAPTERS:
                break
            vs = chs.get(ch, {})
            row_c, row_en = [], []
            for v in range(1, (max(vs) if vs else 0) + 1):
                text = vs.get(v)
                eng = english.get(bcode, {}).get(ch, {}).get(v, "")
                row_en.append(eng)
                if not text:
                    row_c.append(None)
                    continue
                stats["verses"] += 1
                toks, unknown = [], 0
                for wi, raw in enumerate(unicodedata.normalize("NFC", text).split()):
                    m = WORD.match(raw)
                    if not m:
                        if toks:
                            toks[-1][0] += raw  # stray punctuation
                        continue
                    word, punct = m.group(1), m.group(2)
                    disp = norm_apos(word)
                    if len(word) > 1 and word.upper() == word:
                        disp = restore_caps(word) or disp
                    a = analyse(disp, wi == 0 or (toks and re.search(r"[.;·:!]$", toks[-1][0])))
                    alts = a[2] if a else []
                    # agreement with a preceding article: τὰς ἁμαρτίας is acc. pl., not gen. sg.
                    if a and toks and morphs[toks[-1][2]].startswith("T-"):
                        cng = morphs[toks[-1][2]][2:5]
                        def agrees(code):
                            parts = code.split("-")
                            tail = parts[2] if parts[0] == "V" and len(parts) > 2 else parts[1] if len(parts) > 1 else ""
                            return tail[:3] == cng
                        if not agrees(a[1]):
                            fit = next((x for x in alts if x[0] == a[0] and agrees(x[1])), None)
                            if fit:
                                a = (fit[0], fit[1], alts)
                                stats["agreement-fixes"] += 1
                            elif re.match(r"^[NA]-[NGDA][SP]" + cng[2] + r"$", a[1]) and cng[0] in "NGDA":
                                # same gender, e.g. τὰς ἀνομίας: -ας is gen. sg. or acc. pl.; take the article's case/number
                                a = (a[0], a[1][:2] + cng, alts)
                                stats["agreement-overrides"] += 1
                    if a is None:
                        stats["untagged"] += 1
                        if disp[:1].isupper():
                            li, code = lemma_id(disp, True), "N-PRI-P"
                        else:
                            unknown += 1
                            li, code = lemma_id(disp), "X"
                    else:
                        li, code = a[0], a[1]
                    stats["tokens"] += 1
                    lex[li]["f"] += 1
                    toks.append([disp + punct, li, morph_id(code)])
                if not eng or unknown / max(1, len(toks)) > 0.25:
                    stats["drop"] += 1
                    row_c.append(None)
                    continue
                row_c.append(toks)
                kept += 1
            out_c.append(row_c)
            out_en.append(row_en)
        stats["kept"] += kept
        (lxxdir / f"{bid}.json").write_text(json.dumps({"c": out_c, "en": out_en}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index_books.append({"id": bid, "n": name, "ch": len(out_c), "kept": kept})

    (lxxdir / "index.json").write_text(json.dumps({
        "books": index_books, "m": morphs,
        "lex": [[l["g"], l["e"], l["f"], l["nt"], l["pn"]] for l in lex],
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    tok_total = sum(l["f"] for l in lex)
    glossed = sum(l["f"] for l in lex if l["e"] or l["pn"])
    print(dict(stats))
    print(f"books={len(index_books)} lemmas={len(lex)} tokens={tok_total} tagged={100 * (1 - stats['untagged'] / stats['tokens']):.1f}% glossed-or-name={100 * glossed / tok_total:.1f}%")
    print("top unglossed:", Counter({l["g"]: l["f"] for l in lex if not l["e"] and not l["pn"]}).most_common(30))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
