// Generate every form of a verb from its stems, for parsing practice beyond the forms the NT happens to use.
//
// How it stays trustworthy: each verb's stems come from forms that occur in the NT, and every tense/voice
// block is checked by regenerating the NT's own forms of that block. A block that doesn't reproduce what
// the NT actually has (irregular verbs, consonant-stem perfects, etc.) is left out instead of guessed.
// Generated forms that don't occur in the NT are shown without accents.
import { LEX } from "./data.js";
import { normalize, fixSigma, formKey } from "./greek.js";
import * as M from "./morph.js";

const PN = [["1", "S"], ["2", "S"], ["3", "S"], ["1", "P"], ["2", "P"], ["3", "P"]];
const IMP = [["2", "S"], ["3", "S"], ["2", "P"], ["3", "P"]];
const CASES = [["N", "S"], ["G", "S"], ["D", "S"], ["A", "S"], ["N", "P"], ["G", "P"], ["D", "P"], ["A", "P"]];

// endings: "a|b" = alternatives (movable ν); ῃ marks an iota-subscript eta (matters for contraction)
const fin = (list) => list.map((e, i) => ({ person: PN[i][0], number: PN[i][1], e }));
const imp = (list) => list.map((e, i) => ({ person: IMP[i][0], number: IMP[i][1], e }));
const ptc = (m, f, n) => ["M", "F", "N"].flatMap((g, gi) => [m, f, n][gi].map((e, ci) => ({ case: CASES[ci][0], number: CASES[ci][1], gender: g, e })));
const ONT = ptc(["ων", "οντος", "οντι", "οντα", "οντες", "οντων", "ουσι|ουσιν", "οντας"], ["ουσα", "ουσης", "ουσῃ", "ουσαν", "ουσαι", "ουσων", "ουσαις", "ουσας"], ["ον", "οντος", "οντι", "ον", "οντα", "οντων", "ουσι|ουσιν", "οντα"]);
const ANT = ptc(["ας", "αντος", "αντι", "αντα", "αντες", "αντων", "ασι|ασιν", "αντας"], ["ασα", "ασης", "ασῃ", "ασαν", "ασαι", "ασων", "ασαις", "ασας"], ["αν", "αντος", "αντι", "αν", "αντα", "αντων", "ασι|ασιν", "αντα"]);
const ENT = ptc(["εις", "εντος", "εντι", "εντα", "εντες", "εντων", "εισι|εισιν", "εντας"], ["εισα", "εισης", "εισῃ", "εισαν", "εισαι", "εισων", "εισαις", "εισας"], ["εν", "εντος", "εντι", "εν", "εντα", "εντων", "εισι|εισιν", "εντα"]);
const OT = ptc(["ως", "οτος", "οτι", "οτα", "οτες", "οτων", "οσι|οσιν", "οτας"], ["υια", "υιας", "υιᾳ", "υιαν", "υιαι", "υιων", "υιαις", "υιας"], ["ος", "οτος", "οτι", "ος", "οτα", "οτων", "οσι|οσιν", "οτα"]);
const MENOS = (v) => ptc(
  [`${v}μενος`, `${v}μενου`, `${v}μενῳ`, `${v}μενον`, `${v}μενοι`, `${v}μενων`, `${v}μενοις`, `${v}μενους`],
  [`${v}μενη`, `${v}μενης`, `${v}μενῃ`, `${v}μενην`, `${v}μεναι`, `${v}μενων`, `${v}μεναις`, `${v}μενας`],
  [`${v}μενον`, `${v}μενου`, `${v}μενῳ`, `${v}μενον`, `${v}μενα`, `${v}μενων`, `${v}μενοις`, `${v}μενα`]);

const P_A_I = fin(["ω", "εις", "ει", "ομεν", "ετε", "ουσι|ουσιν"]);
const P_MP_I = fin(["ομαι", "ῃ|ει|@σαι", "εται", "ομεθα", "εσθε", "ονται"]); // βούλει; καυχᾶσαι (α-contracts only)
const P_A_S = fin(["ω", "ῃς", "ῃ", "ωμεν", "ητε", "ωσι|ωσιν"]);
const P_MP_S = fin(["ωμαι", "ῃ", "ηται", "ωμεθα", "ησθε", "ωνται"]);
const THEM_A_M = imp(["ε", "ετω", "ετε", "ετωσαν"]);
const THEM_MP_M = imp(["ου", "εσθω", "εσθε", "εσθωσαν"]);
const IMPF_A = fin(["ον", "ες", "ε|εν", "ομεν", "ετε", "ον|αν|οσαν"]); // Koine εἶχαν, ἐδολιοῦσαν
const IMPF_MP = fin(["ομην", "ου", "ετο", "ομεθα", "εσθε", "οντο"]);

/**
 * Blocks: which stem they use, their fixed parse, and their cells.
 * stem keys: pres, impf (augmented present), fut, aorI (augmented aorist), aor (unaugmented), apI, ap, fp, ra, rm
 */
const BLOCKS = [
  // present system
  { stem: "pres", p: { tense: "P", voice: "A", mood: "I" }, cells: P_A_I },
  { stem: "pres", p: { tense: "P", voice: "MP", mood: "I" }, cells: P_MP_I },
  { stem: "pres", p: { tense: "P", voice: "A", mood: "S" }, cells: P_A_S },
  { stem: "pres", p: { tense: "P", voice: "MP", mood: "S" }, cells: P_MP_S },
  { stem: "pres", p: { tense: "P", voice: "A", mood: "M" }, cells: THEM_A_M },
  { stem: "pres", p: { tense: "P", voice: "MP", mood: "M" }, cells: THEM_MP_M },
  { stem: "pres", p: { tense: "P", voice: "A", mood: "N" }, cells: [{ e: "ειν" }] },
  { stem: "pres", p: { tense: "P", voice: "MP", mood: "N" }, cells: [{ e: "εσθαι" }] },
  { stem: "pres", p: { tense: "P", voice: "A", mood: "P" }, cells: ONT },
  { stem: "pres", p: { tense: "P", voice: "MP", mood: "P" }, cells: MENOS("ο") },
  { stem: "impf", p: { tense: "I", voice: "A", mood: "I" }, cells: IMPF_A },
  { stem: "impf", p: { tense: "I", voice: "MP", mood: "I" }, cells: IMPF_MP },
  // future
  { stem: "fut", p: { tense: "F", voice: "A", mood: "I" }, cells: P_A_I },
  { stem: "fut", p: { tense: "F", voice: "M", mood: "I" }, cells: P_MP_I },
  { stem: "fut", p: { tense: "F", voice: "A", mood: "N" }, cells: [{ e: "ειν" }] },
  // first aorist
  { stem: "aorI", kind: 1, p: { tense: "A", voice: "A", mood: "I" }, cells: fin(["α", "ας", "ε|εν", "αμεν", "ατε", "αν"]) },
  { stem: "aorI", kind: 1, p: { tense: "A", voice: "M", mood: "I" }, cells: fin(["αμην", "ω", "ατο", "αμεθα", "ασθε", "αντο"]) },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "A", mood: "S" }, cells: P_A_S },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "M", mood: "S" }, cells: P_MP_S },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "A", mood: "M" }, cells: imp(["ον", "ατω", "ατε", "ατωσαν"]) },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "M", mood: "M" }, cells: imp(["αι", "ασθω", "ασθε", "ασθωσαν"]) },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "A", mood: "N" }, cells: [{ e: "αι" }] },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "M", mood: "N" }, cells: [{ e: "ασθαι" }] },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "A", mood: "P" }, cells: ANT },
  { stem: "aor", kind: 1, p: { tense: "A", voice: "M", mood: "P" }, cells: MENOS("α") },
  // second aorist
  // Koine often gives 2nd aorists 1st-aorist endings (ἦλθαν, εἴπατε): accepted as alternates
  { stem: "aorI", kind: 2, p: { tense: "A", voice: "A", mood: "I", second: true }, cells: fin(["ον|α", "ες|ας", "ε|εν", "ομεν|αμεν", "ετε|ατε", "ον|αν|οσαν"]) },
  { stem: "aorI", kind: 2, p: { tense: "A", voice: "M", mood: "I", second: true }, cells: fin(["ομην|αμην", "ου|ω", "ετο|ατο", "ομεθα|αμεθα", "εσθε|ασθε", "οντο|αντο"]) },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "A", mood: "S", second: true }, cells: P_A_S },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "M", mood: "S", second: true }, cells: P_MP_S },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "A", mood: "M", second: true }, cells: imp(["ε", "ετω|ατω", "ετε|ατε", "ετωσαν|ατωσαν"]) },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "M", mood: "M", second: true }, cells: THEM_MP_M },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "A", mood: "N", second: true }, cells: [{ e: "ειν" }] },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "M", mood: "N", second: true }, cells: [{ e: "εσθαι" }] },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "A", mood: "P", second: true }, cells: ONT },
  { stem: "aor", kind: 2, p: { tense: "A", voice: "M", mood: "P", second: true }, cells: MENOS("ο").map((c) => ({ ...c, e: c.e + "|" + c.e.replace(/^ο/, "α") })) },
  // aorist & future passive (stem ends before -η-: ελυθ / λυθ)
  { stem: "apI", p: { tense: "A", voice: "P", mood: "I" }, cells: fin(["ην", "ης", "η", "ημεν", "ητε", "ησαν"]) },
  { stem: "ap", p: { tense: "A", voice: "P", mood: "S" }, cells: fin(["ω", "ῃς", "ῃ", "ωμεν", "ητε", "ωσι|ωσιν"]) },
  { stem: "ap", p: { tense: "A", voice: "P", mood: "M" }, cells: imp(["ητι|ηθι", "ητω", "ητε", "ητωσαν"]) },
  { stem: "ap", p: { tense: "A", voice: "P", mood: "N" }, cells: [{ e: "ηναι" }] },
  { stem: "ap", p: { tense: "A", voice: "P", mood: "P" }, cells: ENT },
  { stem: "fp", p: { tense: "F", voice: "P", mood: "I" }, cells: fin(["ησομαι", "ησῃ", "ησεται", "ησομεθα", "ησεσθε", "ησονται"]) },
  // perfect
  { stem: "ra", p: { tense: "R", voice: "A", mood: "I" }, cells: fin(["α", "ας", "ε|εν", "αμεν", "ατε", "ασι|ασιν|αν"]) },
  { stem: "ra", p: { tense: "R", voice: "A", mood: "N" }, cells: [{ e: "εναι" }] },
  { stem: "ra", p: { tense: "R", voice: "A", mood: "P" }, cells: OT },
  { stem: "rm", p: { tense: "R", voice: "MP", mood: "I" }, cells: fin(["μαι", "σαι", "ται", "μεθα", "σθε", "νται"]) },
  { stem: "rm", p: { tense: "R", voice: "MP", mood: "N" }, cells: [{ e: "σθαι" }] },
  { stem: "rm", p: { tense: "R", voice: "MP", mood: "P" }, cells: MENOS("") },
];

// ---------- contraction (present system of -άω/-έω/-όω verbs), on unaccented strings ----------
const CONTRACT = {
  ε: [["ει", "ει"], ["ου", "ου"], ["οι", "οι"], ["ε", "ει"], ["ῃ", "ῃ"], ["η", "η"], ["ο", "ου"], ["ω", "ω"]],
  α: [["ει", "ᾳ"], ["ου", "ω"], ["οι", "ῳ"], ["ε", "α"], ["ῃ", "ᾳ"], ["η", "α"], ["ο", "ω"], ["ω", "ω"]],
  ο: [["ει", "οι"], ["ου", "ου"], ["οι", "οι"], ["ε", "ου"], ["ῃ", "οι"], ["η", "ω"], ["ο", "ου"], ["ω", "ω"]],
};
function join(stem, ending, contractVowel) {
  if (ending === "@σαι") return contractVowel === "α" && stem.endsWith("α") ? stem + "σαι" : null;
  if (!contractVowel || !stem.endsWith(contractVowel)) return stem + ending;
  const base = stem.slice(0, -1);
  if (ending.startsWith("α")) return null; // the Koine -αν alternate doesn't apply to contract verbs
  if (ending === "ειν") return base + { ε: "ειν", α: "αν", ο: "ουν" }[contractVowel];
  for (const [pre, out] of CONTRACT[contractVowel]) if (ending.startsWith(pre)) return base + out + ending.slice(pre.length);
  return stem + ending;
}

const n = (s) => formKey(s); // iota subscript kept distinct (ἀγαπᾷ vs ἀγάπα)
const variants = (e) => e.split("|");

/** Build every cell of a block from a stem: [{ parse(s), forms[] (normalized) }] */
function buildBlock(block, stem, cv) {
  return block.cells.map((c) => {
    let e = c.e;
    if (e === "ητι|ηθι") e = stem.endsWith("θ") ? "ητι" : "ηθι"; // λύθητι, but γράφηθι
    const base = { pos: "verb", ...block.p, ...(c.person ? { person: c.person, number: c.number } : {}), ...(c.case ? { case: c.case, number: c.number, gender: c.gender } : {}) };
    const parses = base.voice === "MP" ? [{ ...base, voice: "M" }, { ...base, voice: "P" }] : [base];
    const raw = variants(e).map((x) => join(stem, x, cv)).filter(Boolean); // keeps iota subscripts (λυῃ, ἀγαπᾳ)
    return { parses, forms: raw.map(n), raw };
  });
}

/** Stem candidates from an attested form for a given cell ending. */
function stemsFrom(form, ending, cv) {
  const out = [];
  for (const e of variants(ending)) {
    const ne = n(e);
    if (!cv) { if (form.endsWith(ne) && form.length > ne.length) out.push(form.slice(0, -ne.length)); continue; }
    for (let k = 1; k < form.length; k++) { const s = form.slice(0, k) + cv; if (n(join(s, e, cv)) === form) out.push(s); }
  }
  return out;
}

const pkey = (p) => M.keyOf(p, ["tense", "voice", "mood", "person", "number", "case", "gender"]);

/** Generate a verb's forms. Returns Map(normalized form -> { parses[], display }) or null. */
export function generateVerb(lex, exclude = null) {
  const lemma = lex.g;
  const nl = n(lemma);
  // Only regular thematic verbs (-ω / -ομαι). Left out: μι verbs, athematic -μαι verbs (δύναμαι, κάθημαι,
  // κεῖμαι), non-verb lemmas (φαγεῖν, δεῖ), η-contracts (ζάω, χράομαι), and ἀπόλλυμι (filed as ἀπολλύω).
  if (!/(ω|ομαι)$/.test(nl) || /μι$/.test(nl)) return null;
  if (/ζαω$|χραω$|χραομαι$|απολλυω$|ολλυω$|ανοιγω$/.test(nl)) return null;
  // φέρω and compounds mix ἤνεγκα with ἐνεγκεῖν; their non-indicative aorist isn't generated
  const pherw = /φερω$/.test(nl);
  // compound verbs augment after the prefix (κατῴκησεν, μετενόησαν), so augments are never guessed for them
  const compound = /^(δια|κατα|κατ|καθ|μετα|μετ|μεθ|παρα|παρ|περι|προ|συν|συμ|συγ|συλ|συσ|συ)/.test(nl);
  // root (athematic) aorists: ἔγνων, ἔβην, ἔφυν, ἔδυν — their aorist active isn't thematic
  const rootAorist = /γινωσκω$|βαινω$|φυω$|δυω$|δυνω$/.test(nl);
  const cvMatch = nl.match(/([αεο])(ω|ομαι)$/); // contract verbs, incl. deponents like παραιτέομαι
  const cv = cvMatch ? cvMatch[1] : null;
  const rows = (M.rawForms() || []).filter((f) => f[1] === lex.i);
  if (!rows.length) return null;
  // attested (normalized form, parse) pairs, plus accented spellings
  const attested = [];
  const spelling = new Map();
  for (const [form, , codes] of rows) {
    const nf = n(form);
    if (exclude && exclude.has(nf)) continue; // (hold-out testing)
    if (!spelling.has(nf)) spelling.set(nf, form);
    for (const p of codes.flatMap((c) => M.codeToParses(c, lex))) attested.push({ f: nf, p });
  }
  const attestedVoice = (pred) => attested.some((a) => pred(a.p));

  // find each stem by voting over the attested forms that use it
  const stems = {};
  const kinds = {};
  const blockMatches = (block, p) => block.p.tense === p.tense && block.p.mood === p.mood && (block.p.voice === p.voice || (block.p.voice === "MP" && p.voice !== "A")) && (block.kind ? (block.kind === 2) === !!p.second : true);
  for (const stemKey of ["pres", "impf", "fut", "aorI", "aor", "apI", "ap", "fp", "ra", "rm"]) {
    const votes = new Map();
    for (const block of BLOCKS.filter((b) => b.stem === stemKey)) {
      const useCv = (stemKey === "pres" || stemKey === "impf") ? cv : null;
      for (const a of attested) {
        if (!blockMatches(block, a.p)) continue;
        const cell = block.cells.find((c) => (c.person ? c.person === a.p.person && c.number === a.p.number : c.case ? c.case === a.p.case && c.number === a.p.number && c.gender === a.p.gender : true));
        if (!cell) continue;
        for (const s of stemsFrom(a.f, cell.e, useCv)) { const k = s + "|" + (block.kind || 0); votes.set(k, (votes.get(k) || 0) + 1); }
      }
    }
    const best = [...votes.entries()].sort((x, y) => y[1] - x[1])[0];
    if (best) { const [s, kind] = best[0].split("|"); stems[stemKey] = s; kinds[stemKey] = +kind; }
  }
  // an unaugmented aorist stem can come from the augmented one for simple ε- augments (ελυσ -> λυσ)
  const lemFirst = n(lemma)[0];
  for (const [aug, plain] of compound ? [] : [["aorI", "aor"], ["apI", "ap"]]) {
    if (!stems[plain] && stems[aug] && stems[aug][0] === "ε" && stems[aug][1] === lemFirst && !"αεηιουω".includes(lemFirst)) { stems[plain] = stems[aug].slice(1); kinds[plain] = kinds[aug]; }
    if (!stems[aug] && stems[plain] && !"αεηιουω".includes(stems[plain][0]) && stems[plain][0] === lemFirst) { stems[aug] = "ε" + stems[plain]; kinds[aug] = kinds[plain]; }
  }
  // liquid futures (μενῶ, κρινῶ) contract like -έω verbs
  const cvFor = { pres: cv, impf: cv };
  if (stems.fut && !/[σξψ]$/.test(stems.fut)) { stems.fut += "ε"; cvFor.fut = "ε"; }
  // consonant-stem perfect middles assimilate (γέγραμμαι); too irregular to generate
  if (stems.rm && !/[αεηιουω]$/.test(stems.rm)) delete stems.rm;
  // future passive from the aorist passive stem
  if (!stems.fp && stems.ap && attestedVoice((p) => p.tense === "F" && p.voice === "P")) stems.fp = stems.ap;

  // generate, then validate each block against the NT
  const out = new Map();
  const byParse = new Map(); // parse key -> all spellings of that cell (movable ν)
  const rawOf = new Map();   // normalized -> generated spelling with iota subscripts
  const addForm = (f, parses, cellForms, raw) => {
    if (raw && !rawOf.has(f)) rawOf.set(f, raw);
    if (!out.has(f)) out.set(f, { parses: [], display: spelling.get(f) || null });
    out.get(f).parses.push(...parses);
    for (const p of parses) byParse.set(pkey(p), cellForms);
  };
  const PAIR = { aor: "aorI", aorI: "aor", ap: "apI", apI: "ap", fp: "ap", impf: "pres", pres: "impf" };
  const usable = (block) => {
    if (stems[block.stem] == null) return false;
    if (block.kind && kinds[block.stem] !== block.kind) return false;
    if (rootAorist && block.p.tense === "A" && block.p.voice === "A") return false;
    if (pherw && block.stem === "aor") return false;
    // 1st vs 2nd aorist must match what the NT shows for this voice (ἀπώλεσα but ἀπωλόμην)
    if (block.kind) {
      const same = attested.filter((a) => a.p.tense === "A" && a.p.voice === block.p.voice);
      if (same.length && same.some((a) => !!a.p.second !== (block.kind === 2))) return false;
    }
    // only voices the verb really uses in this tense (no active forms for deponents)
    return attestedVoice((p) => p.tense === block.p.tense && (block.p.voice === "A" ? p.voice === "A" : block.p.voice === "P" ? p.voice === "P" : p.voice !== "A"));
  };
  // pass 1: check every block that has NT forms; a stem is confirmed when one of its blocks reproduces them
  const built = new Map(), failed = new Set(), confirmed = new Set();
  for (const block of BLOCKS) {
    if (!usable(block)) continue;
    const cells = buildBlock(block, stems[block.stem], cvFor[block.stem] || null);
    built.set(block, cells);
    const mine = attested.filter((a) => blockMatches(block, a.p));
    if (!mine.length) continue;
    let hit = 0;
    for (const a of mine) {
      const cell = cells.find((c) => c.parses.some((p) => pkey(p) === pkey(a.p)));
      if (cell && cell.forms.includes(a.f)) hit++;
    }
    // every NT form of the block must come out exactly; otherwise the verb is irregular here
    if (hit === mine.length) confirmed.add(block.stem); else failed.add(block);
  }
  // pass 2: keep blocks that passed, and unattested blocks whose stem (or its paired stem) is confirmed
  for (const [block, cells] of built) {
    if (failed.has(block)) continue;
    const hasOwn = attested.some((a) => blockMatches(block, a.p));
    if (!hasOwn && !confirmed.has(block.stem) && !confirmed.has(PAIR[block.stem])) continue;
    for (const c of cells) c.forms.forEach((f, i) => addForm(f, c.parses, c.forms, c.raw[i]));
  }
  return out.size ? { forms: out, byParse, spelling, rawOf } : null;
}

/** Breathing for a generated (unaccented) form, copied from the lemma. */
/** Present-system forms keep any iota subscript the lemma has in its stem (σῴζω -> σῳζομεν). */
function lemmaSubscripts(form, lemma) {
  const lem = lemma.normalize("NFD");
  let base = "", subs = new Set();
  for (const ch of lem) {
    if (ch === "ͅ") subs.add(base.length - 1);
    else if (/[α-ως]/.test(ch)) base += ch;
  }
  if (!subs.size) return form;
  const b = base.replace(/ς/g, "σ");
  const stemLen = b.length - 1; // lemma minus final ω
  if (!form.startsWith(b.slice(0, stemLen))) return form;
  let out = "";
  [...form].forEach((ch, i) => { out += ch + (subs.has(i) && i < stemLen ? "ͅ" : ""); });
  return out.normalize("NFC");
}

function withBreathing(form, lemma) {
  // stems keep iota subscripts as "j" (see formKey); turn them back into ᾳ ῃ ῳ
  form = fixSigma(form.replace(/αj/g, "ᾳ").replace(/ηj/g, "ῃ").replace(/ωj/g, "ῳ").replace(/j/g, ""));
  if (!/^[αεηιουωρ]/.test(form)) return form;
  const rough = lemma.normalize("NFD").slice(0, 3).includes("̔");
  const mark = rough ? "̔" : "̓";
  if (form[0] === "ρ") return rough ? "ῥ" + form.slice(1) : form;
  const diph = /^(αι|ει|οι|υι|αυ|ευ|ου|ηυ)/.test(form);
  const i = diph ? 1 : 0;
  return (form.slice(0, i + 1) + mark + form.slice(i + 1)).normalize("NFC");
}

let cache = null;
/** Drill items for every verb used 10+ times in the NT (or one lemma). */
let allItems = null;
export function generatedItems(onlyLemma = null) {
  if (!onlyLemma && allItems) return allItems;
  if (!cache) {
    cache = new Map();
    for (const l of LEX) {
      if (l.p !== "verb" || l.pn || l.f < 10) continue;
      const g = generateVerb(l);
      if (g) cache.set(l.g, { lex: l, ...g });
    }
  }
  const items = [];
  for (const [lemma, { lex, forms, byParse, spelling, rawOf }] of cache) {
    if (onlyLemma && n(lemma) !== n(onlyLemma)) continue;
    const show = (f) => spelling.get(f) || withBreathing(rawOf.get(f) || f, lemma);
    for (const [f, info] of forms) {
      const display = show(f);
      // valid readings: everything generated for this spelling, plus anything the NT tags it as
      const parses = M.expandAmbiguity([...info.parses, ...M.validParses(display, lemma)]);
      for (const target of info.parses) {
        const answers = (byParse.get(pkey(target)) || [f]).map(show);
        items.push({ form: display, lemma, lex, parses, target, source: "generated", accents: !!info.display, answers });
      }
    }
  }
  if (!onlyLemma) allItems = items;
  return items;
}

/** Stats for the UI. */
export function generatedStats() {
  generatedItems();
  let forms = 0;
  for (const v of cache.values()) forms += v.forms.size;
  return { verbs: cache.size, forms };
}

/**
 * Accuracy check: hide one real NT form at a time, regenerate the verb, and see whether the hidden
 * form comes back with the right parsing (and whether anything else was generated for that parsing).
 */
export function holdOutTest(max = 2000) {
  let tested = 0, right = 0, wrong = 0, notGenerated = 0, spellingVariants = 0;
  const errors = [];
  const verbs = LEX.filter((l) => l.p === "verb" && !l.pn && l.f >= 10);
  outer: for (const l of verbs) {
    const rows = (M.rawForms() || []).filter((f) => f[1] === l.i);
    for (const [form, , codes] of rows) {
      if (tested >= max) break outer;
      const nf = n(form);
      const g = generateVerb(l, new Set([nf]));
      if (!g) continue;
      for (const p of codes.flatMap((c) => M.codeToParses(c, l))) {
        const cell = g.byParse.get(pkey(p));
        if (!cell) { notGenerated++; continue; }
        tested++;
        const loose = (x) => x.replace(/ει/g, "ι").replace(/ηυ/g, "ευ");
        if (cell.includes(nf)) right++;
        else if (cell.some((c) => loose(c) === loose(nf))) { right++; spellingVariants++; }
        else { wrong++; if (errors.length < 60) errors.push(`${l.g}: ${M.describe(p)} — NT ${form}, generated ${cell.join("/")}`); }
      }
    }
  }
  return { tested, right, wrong, spellingVariants, accuracy: tested ? +(100 * right / tested).toFixed(2) : 0, notGenerated, errors };
}

/**
 * All generated forms of one verb, keyed by parsing (for the Lexicon's paradigm tables).
 * Returns Map(parseKey -> [display forms]) or null if the verb isn't generated.
 */
export function formsByParse(lemma) {
  generatedItems();
  const entry = [...cache.entries()].find(([g]) => n(g) === n(lemma));
  if (!entry) return null;
  const [g, { byParse, spelling, rawOf }] = entry;
  const show = (f) => spelling.get(f) || withBreathing(rawOf.get(f) || f, g);
  const out = new Map();
  for (const [k, forms] of byParse) out.set(k, forms.slice(0, 1).map((f) => ({ form: show(f), attested: false })));
  return out;
}

export const parseKey = pkey;
export { withBreathing };
