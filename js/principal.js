// Computes principal parts (build time: tools/build_principal.mjs writes data/principal.json).
// Principal parts: the six stems every Greek verb's tenses are built on.
//   1 present · 2 future · 3 aorist active · 4 perfect active · 5 perfect middle/passive · 6 aorist passive
// Sources, in order: the verb's own NT form (1st sg); a curated entry for irregular verbs; the generator.
// Generated parts get their accent by the recessive rule (see accentRecessive) and are marked "not in the NT".
import { LEX, findLemma } from "./data.js";
import { normalize, formKey } from "./greek.js";
import * as M from "./morph.js";
import { formsByParse, parseKey, withBreathing } from "./generate.js";
import { PART_NAMES, partOf, partOfForm, variantsOf } from "./pparts.js";
export { PART_NAMES, partOf, partOfForm, variantsOf };



// Irregular verbs whose parts can't be read off regular patterns. "—" = the verb has no such part.
// Standard first-year (Mounce-style) principal parts; every entry is checked against the NT's own forms.
const CURATED = {
  "εἰμί": ["εἰμί", "ἔσομαι", "—", "—", "—", "—"],
  "δίδωμι": ["δίδωμι", "δώσω", "ἔδωκα", "δέδωκα", "δέδομαι", "ἐδόθην"],
  "παραδίδωμι": ["παραδίδωμι", "παραδώσω", "παρέδωκα", "παραδέδωκα", "παραδέδομαι", "παρεδόθην"],
  "ἀποδίδωμι": ["ἀποδίδωμι", "ἀποδώσω", "ἀπέδωκα", "—", "—", "ἀπεδόθην"],
  "τίθημι": ["τίθημι", "θήσω", "ἔθηκα", "τέθεικα", "τέθειμαι", "ἐτέθην"],
  "παρατίθημι": ["παρατίθημι", "παραθήσω", "παρέθηκα", "—", "—", "—"],
  "προστίθημι": ["προστίθημι", "—", "προσέθηκα", "—", "—", "προσετέθην"],
  "καθίστημι": ["καθίστημι", "καταστήσω", "κατέστησα", "—", "—", "κατεστάθην"],
  "ἐξίστημι": ["ἐξίστημι", "—", "ἐξέστησα / ἐξέστην", "ἐξέστακα", "—", "—"],
  "ἐφίστημι": ["ἐφίστημι", "—", "ἐπέστην", "ἐφέστηκα", "—", "—"],
  "ἀνθίστημι": ["ἀνθίστημι", "—", "ἀντέστην", "ἀνθέστηκα", "—", "—"],
  "συνίστημι": ["συνίστημι", "—", "συνέστησα", "συνέστηκα", "—", "—"],
  "ἀφίστημι": ["ἀφίστημι", "ἀποστήσομαι", "ἀπέστησα / ἀπέστην", "—", "—", "—"],
  "συμφέρω": ["συμφέρω", "—", "συνήνεγκα", "—", "—", "—"],
  "ἀναφέρω": ["ἀναφέρω", "—", "ἀνήνεγκα", "—", "—", "—"],
  "διαφέρω": ["διαφέρω", "—", "διήνεγκα", "—", "—", "—"],
  "κατεσθίω": ["κατεσθίω", "καταφάγομαι", "κατέφαγον", "—", "—", "—"],
  "ἐπιτίθημι": ["ἐπιτίθημι", "ἐπιθήσω", "ἐπέθηκα", "—", "—", "—"],
  "ἵστημι": ["ἵστημι", "στήσω", "ἔστησα / ἔστην", "ἕστηκα", "—", "ἐστάθην"],
  "ἀνίστημι": ["ἀνίστημι", "ἀναστήσω", "ἀνέστησα / ἀνέστην", "—", "—", "—"],
  "παρίστημι": ["παρίστημι", "παραστήσω", "παρέστησα / παρέστην", "παρέστηκα", "—", "—"],
  "ἀφίημι": ["ἀφίημι", "ἀφήσω", "ἀφῆκα", "—", "ἀφέωμαι", "ἀφέθην"],
  "δείκνυμι": ["δείκνυμι", "δείξω", "ἔδειξα", "δέδειχα", "δέδειγμαι", "ἐδείχθην"],
  "ἀπολλύω": ["ἀπόλλυμι", "ἀπολέσω / ἀπολῶ", "ἀπώλεσα", "ἀπόλωλα", "—", "—"],
  "γινώσκω": ["γινώσκω", "γνώσομαι", "ἔγνων", "ἔγνωκα", "ἔγνωσμαι", "ἐγνώσθην"],
  "ἐπιγινώσκω": ["ἐπιγινώσκω", "ἐπιγνώσομαι", "ἐπέγνων", "ἐπέγνωκα", "—", "ἐπεγνώσθην"],
  "ἀναγινώσκω": ["ἀναγινώσκω", "—", "ἀνέγνων", "—", "—", "ἀνεγνώσθην"],
  "ἀναβαίνω": ["ἀναβαίνω", "ἀναβήσομαι", "ἀνέβην", "ἀναβέβηκα", "—", "—"],
  "καταβαίνω": ["καταβαίνω", "καταβήσομαι", "κατέβην", "καταβέβηκα", "—", "—"],
  "ἐμβαίνω": ["ἐμβαίνω", "—", "ἐνέβην", "—", "—", "—"],
  "ἔρχομαι": ["ἔρχομαι", "ἐλεύσομαι", "ἦλθον", "ἐλήλυθα", "—", "—"],
  "ἐξέρχομαι": ["ἐξέρχομαι", "ἐξελεύσομαι", "ἐξῆλθον", "ἐξελήλυθα", "—", "—"],
  "εἰσέρχομαι": ["εἰσέρχομαι", "εἰσελεύσομαι", "εἰσῆλθον", "εἰσελήλυθα", "—", "—"],
  "ἀπέρχομαι": ["ἀπέρχομαι", "ἀπελεύσομαι", "ἀπῆλθον", "ἀπελήλυθα", "—", "—"],
  "προσέρχομαι": ["προσέρχομαι", "—", "προσῆλθον", "προσελήλυθα", "—", "—"],
  "διέρχομαι": ["διέρχομαι", "διελεύσομαι", "διῆλθον", "διελήλυθα", "—", "—"],
  "παρέρχομαι": ["παρέρχομαι", "παρελεύσομαι", "παρῆλθον", "παρελήλυθα", "—", "—"],
  "συνέρχομαι": ["συνέρχομαι", "—", "συνῆλθον", "συνελήλυθα", "—", "—"],
  "λέγω": ["λέγω", "ἐρῶ", "εἶπον", "εἴρηκα", "εἴρημαι", "ἐρρέθην"],
  "εἶπον": ["λέγω", "ἐρῶ", "εἶπον", "εἴρηκα", "εἴρημαι", "ἐρρέθην"],
  "ὁράω": ["ὁράω", "ὄψομαι", "εἶδον", "ἑώρακα", "—", "ὤφθην"],
  "εἶδον": ["ὁράω", "ὄψομαι", "εἶδον", "ἑώρακα", "—", "ὤφθην"],
  "οἶδα": ["οἶδα", "εἰδήσω", "—", "—", "—", "—"],
  "ἐσθίω": ["ἐσθίω", "φάγομαι", "ἔφαγον", "—", "—", "—"],
  "πίνω": ["πίνω", "πίομαι", "ἔπιον", "πέπωκα", "—", "—"],
  "φέρω": ["φέρω", "οἴσω", "ἤνεγκα", "—", "—", "ἠνέχθην"],
  "προσφέρω": ["προσφέρω", "—", "προσήνεγκα", "προσενήνοχα", "—", "προσηνέχθην"],
  "λαμβάνω": ["λαμβάνω", "λήμψομαι", "ἔλαβον", "εἴληφα", "—", "ἐλήμφθην"],
  "παραλαμβάνω": ["παραλαμβάνω", "παραλήμψομαι", "παρέλαβον", "—", "—", "παρελήμφθην"],
  "βάλλω": ["βάλλω", "βαλῶ", "ἔβαλον", "βέβληκα", "βέβλημαι", "ἐβλήθην"],
  "ἐκβάλλω": ["ἐκβάλλω", "ἐκβαλῶ", "ἐξέβαλον", "—", "—", "ἐξεβλήθην"],
  "ἀποστέλλω": ["ἀποστέλλω", "ἀποστελῶ", "ἀπέστειλα", "ἀπέσταλκα", "ἀπέσταλμαι", "ἀπεστάλην"],
  "ἐγείρω": ["ἐγείρω", "ἐγερῶ", "ἤγειρα", "—", "ἐγήγερμαι", "ἠγέρθην"],
  "ἀποκτείνω": ["ἀποκτείνω", "ἀποκτενῶ", "ἀπέκτεινα", "—", "—", "ἀπεκτάνθην"],
  "μένω": ["μένω", "μενῶ", "ἔμεινα", "μεμένηκα", "—", "—"],
  "κρίνω": ["κρίνω", "κρινῶ", "ἔκρινα", "κέκρικα", "κέκριμαι", "ἐκρίθην"],
  "αἴρω": ["αἴρω", "ἀρῶ", "ἦρα", "ἦρκα", "ἦρμαι", "ἤρθην"],
  "ἀποθνῄσκω": ["ἀποθνῄσκω", "ἀποθανοῦμαι", "ἀπέθανον", "—", "—", "—"],
  "πίπτω": ["πίπτω", "πεσοῦμαι", "ἔπεσον / ἔπεσα", "πέπτωκα", "—", "—"],
  "φεύγω": ["φεύγω", "φεύξομαι", "ἔφυγον", "—", "—", "—"],
  "ἄγω": ["ἄγω", "ἄξω", "ἤγαγον", "—", "ἦγμαι", "ἤχθην"],
  "ἔχω": ["ἔχω", "ἕξω", "ἔσχον", "ἔσχηκα", "—", "—"],
  "γίνομαι": ["γίνομαι", "γενήσομαι", "ἐγενόμην", "γέγονα", "γεγένημαι", "ἐγενήθην"],
  "πάσχω": ["πάσχω", "—", "ἔπαθον", "πέπονθα", "—", "—"],
  "εὑρίσκω": ["εὑρίσκω", "εὑρήσω", "εὗρον", "εὕρηκα", "—", "εὑρέθην"],
  "ἀκούω": ["ἀκούω", "ἀκούσω", "ἤκουσα", "ἀκήκοα", "—", "ἠκούσθην"],
  "ἀνοίγω": ["ἀνοίγω", "ἀνοίξω", "ἤνοιξα / ἀνέῳξα", "ἀνέῳγα", "ἀνέῳγμαι", "ἠνοίχθην / ἀνεῴχθην"],
  "δύναμαι": ["δύναμαι", "δυνήσομαι", "—", "—", "—", "ἠδυνήθην"],
  "σῴζω": ["σῴζω", "σώσω", "ἔσωσα", "σέσωκα", "σέσῳσμαι", "ἐσώθην"],
  "ζάω": ["ζάω", "ζήσω", "ἔζησα", "—", "—", "—"],
  "πείθω": ["πείθω", "πείσω", "ἔπεισα", "πέποιθα", "πέπεισμαι", "ἐπείσθην"],
  "γράφω": ["γράφω", "γράψω", "ἔγραψα", "γέγραφα", "γέγραμμαι", "ἐγράφην"],
  "κάθημαι": ["κάθημαι", "καθήσομαι", "—", "—", "—", "—"],
  "καθίζω": ["καθίζω", "καθίσω", "ἐκάθισα", "κεκάθικα", "—", "—"],
  "κεῖμαι": ["κεῖμαι", "—", "—", "—", "—", "—"],
  "φοβέομαι": ["φοβέομαι", "—", "—", "—", "—", "ἐφοβήθην"],
  "ἀποκρίνομαι": ["ἀποκρίνομαι", "—", "ἀπεκρινάμην", "—", "—", "ἀπεκρίθην"],
  "πορεύομαι": ["πορεύομαι", "πορεύσομαι", "—", "—", "πεπόρευμαι", "ἐπορεύθην"],
  "ἀσπάζομαι": ["ἀσπάζομαι", "—", "ἠσπασάμην", "—", "—", "—"],
  "δέχομαι": ["δέχομαι", "δέξομαι", "ἐδεξάμην", "—", "δέδεγμαι", "ἐδέχθην"],
  "προσεύχομαι": ["προσεύχομαι", "προσεύξομαι", "προσηυξάμην", "—", "—", "—"],
  "βούλομαι": ["βούλομαι", "—", "—", "—", "—", "ἐβουλήθην"],
  "θέλω": ["θέλω", "θελήσω", "ἠθέλησα", "—", "—", "—"],
  "μέλλω": ["μέλλω", "μελλήσω", "—", "—", "—", "—"],
  "δεῖ": ["δεῖ", "—", "—", "—", "—", "—"],
  "ἀπαγγέλλω": ["ἀπαγγέλλω", "ἀπαγγελῶ", "ἀπήγγειλα", "—", "—", "ἀπηγγέλην"],
  "ἐπαγγέλλομαι": ["ἐπαγγέλλομαι", "—", "ἐπηγγειλάμην", "—", "ἐπήγγελμαι", "—"],
  "εὐχαριστέω": ["εὐχαριστέω", "—", "εὐχαρίστησα / ηὐχαρίστησα", "—", "—", "εὐχαριστήθην"],
  "φαίνω": ["φαίνω", "φανοῦμαι", "ἔφανα", "—", "—", "ἐφάνην"],
  "κράζω": ["κράζω", "κράξω", "ἔκραξα / ἐκέκραξα", "κέκραγα", "—", "—"],
  "ἐργάζομαι": ["ἐργάζομαι", "—", "ἠργασάμην / εἰργασάμην", "—", "εἴργασμαι", "—"],
  "τελέω": ["τελέω", "τελέσω", "ἐτέλεσα", "τετέλεκα", "τετέλεσμαι", "ἐτελέσθην"],
  "καλέω": ["καλέω", "καλέσω", "ἐκάλεσα", "κέκληκα", "κέκλημαι", "ἐκλήθην"],
  "παρακαλέω": ["παρακαλέω", "—", "παρεκάλεσα", "—", "παρακέκλημαι", "παρεκλήθην"],
};

const NONE = "—";

/** Recessive accent for a principal part (finite verb forms). Compound augments block the accent (ἀπῆλθον). */
export function accentRecessive(form, prefixLen = 0) {
  const base = form.normalize("NFD");
  // syllable nuclei: [start index in base, isLong]
  const letters = [...base];
  const nuclei = [];
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    if (!/[αεηιουω]/.test(ch)) continue;
    let j = i + 1;
    while (j < letters.length && /[̀-ͯ]/.test(letters[j])) j++;
    const next = letters[j];
    const diph = next && /[ιυ]/.test(next) && /[αεοηυ]/.test(ch) && !(ch === "υ" && next === "υ") && !letters.slice(i + 1, j).includes("̈");
    const end = diph ? j : i;
    let k = end + 1;
    while (k < letters.length && /[̀-ͯ]/.test(letters[k])) k++;
    const long = diph || ch === "η" || ch === "ω" || letters.slice(i + 1, k).includes("ͅ");
    nuclei.push({ at: end, long, start: i, chars: diph ? ch + next : ch });
    i = k - 1;
  }
  if (!nuclei.length) return form;
  const n = nuclei.length;
  const last = nuclei[n - 1];
  // final -αι and -οι count as short in verb forms
  const ultLong = last.long && !/^(αι|οι)$/.test(last.chars) || false;
  let pos = ultLong ? n - 2 : n - 3;
  if (pos < 0) pos = Math.max(0, n - 2 < 0 ? 0 : n - 2);
  if (n === 1) pos = 0;
  // accent can't go back past a compound's augment
  const prefixNuclei = nuclei.filter((x) => x.start < prefixLen).length;
  if (pos < prefixNuclei) pos = Math.min(prefixNuclei, n - 1);
  // circumflex: long penult with short ultima
  const circ = pos === n - 2 && nuclei[pos].long && !ultLong && !/[ιυα]$/.test(nuclei[pos].chars.length === 1 ? nuclei[pos].chars.replace(/[ιυα]/, "x") : "");
  const mark = circ ? "͂" : "́";
  const at = nuclei[pos].at;
  let out = letters.slice(0, at + 1).join("");
  let rest = letters.slice(at + 1);
  // keep breathing/iota subscript marks right after the vowel, then add the accent
  let m = 0;
  while (m < rest.length && /[̀-ͯ]/.test(rest[m])) m++;
  out += rest.slice(0, m).join("") + mark + rest.slice(m).join("");
  return out.normalize("NFC");
}

const PREFIXES = ["ἀνα", "ἀντι", "ἀπο", "δια", "εἰσ", "ἐκ", "ἐξ", "ἐν", "ἐμ", "ἐπι", "κατα", "μετα", "παρα", "περι", "προσ", "προ", "συν", "συμ", "ὑπερ", "ὑπο"];
export function compoundPrefixFor(form, lemma) {
  // how much of the augmented form is the prepositional prefix (ἀπ-ῆλθον, προσ-ῆλθον, ἐξ-έβαλον, ἀφ-εῖλον)
  const nf = normalize(form);
  const sp = splitPrefix(normalize(lemma));
  if (!sp) return 0;
  let base = sp.np;
  if (/[αοι]$/.test(base) && !/^(περι|προ)$/.test(base)) base = base.slice(0, -1);
  const cands = [base, base === "εκ" ? "εξ" : null, sp.sf, sp.np, base.replace(/π$/, "φ").replace(/τ$/, "θ"), sp.np.replace(/ν$/, "μ")].filter(Boolean).sort((x, y) => y.length - x.length);
  const hit = cands.find((c) => nf.startsWith(c) && nf.length > c.length + 2);
  return hit ? hit.length : 0;
}

const FIRST_SG = (tense, voice) => ({ pos: "verb", tense, voice, mood: "I", person: "1", number: "S" });
const ACC = /[\u0301\u0300\u0342]/g;
// ἀφῆκά (accent thrown back from an enclitic) -> ἀφῆκα
function dropEnclitic(form) {
  const d = form.normalize("NFD");
  const marks = [...d.matchAll(ACC)];
  if (marks.length < 2) return form;
  const last = marks[marks.length - 1].index;
  return (d.slice(0, last) + d.slice(last + 1)).normalize("NFC");
}
// πάρειμι, ἄπειμι, σύνειμι: present and future only, like εἰμί
function eimiCompound(lex) {
  const pre = lex.g.normalize("NFC").slice(0, -4);
  return [lex.g, pre + "έσομαι", NONE, NONE, NONE, NONE].map((f, i) => (i === 1 ? f.normalize("NFD").replace(/[́̀͂]/g, "").normalize("NFC").replace(/εσομαι$/, "έσομαι") : f));
}
const curatedFor = (lex) => CURATED_BY_KEY.get(formKey(lex.g)) || null;
const CURATED_ALIAS = { "ἀποκρίνω": "ἀποκρίνομαι", "φοβέω": "φοβέομαι", "πορεύω": "πορεύομαι", "ἀποθνήσκω": "ἀποθνῄσκω", "δεικνύω": "δείκνυμι", "φαγεῖν": "ἐσθίω", "ἀσπάζομαι": "ἀσπάζομαι" };
const CURATED_BY_KEY = new Map();
for (const [k, v] of Object.entries(CURATED)) CURATED_BY_KEY.set(formKey(k), v);
for (const [a, k] of Object.entries(CURATED_ALIAS)) CURATED_BY_KEY.set(formKey(a), CURATED[k]);


let cache = new Map();
let byLemma = null;
/** NT forms of one lemma (indexed once). */
export function formsOf(lex) {
  if (!byLemma) {
    byLemma = new Map();
    for (const row of M.rawForms() || []) { if (!byLemma.has(row[1])) byLemma.set(row[1], []); byLemma.get(row[1]).push(row); }
  }
  return byLemma.get(lex.i) || [];
}
/**
 * Principal parts for a verb lexicon entry.
 * Returns [{ form, source: "nt"|"curated"|"generated"|"none", accentByRule }] × 6
 */
export function principalParts(lex) {
  if (cache.has(lex.id)) return cache.get(lex.id);
  const parts = Array.from({ length: 6 }, () => ({ form: NONE, source: "none" }));
  const nt = new Map(); // parseKey -> most common NT spelling (1st sg indicative)
  const attested = Array.from({ length: 6 }, () => new Set()); // part -> "tense+voice" seen in the NT
  let firstAorist = false;
  const seenForms = Array.from({ length: 6 }, () => []);
  let impfKey = null;
  for (const [form, li, codes, count] of formsOf(lex)) {
    for (const p of codes.flatMap((c) => M.codeToParses(c, lex))) {
      if (p.tense === "I" && p.mood === "I" && !impfKey) impfKey = normalize(form);
      const part = partOfForm(p, form);
      if (part == null) continue;
      const voice = part === 5 && p.tense === "A" ? "P" : part === 1 || part === 2 ? (p.voice === "A" ? "A" : "M") : p.voice;
      attested[part].add(p.tense + voice);
      seenForms[part].push({ k: normalize(dropEnclitic(form)), p: { ...p, voice }, count });
      if (p.tense === "A" && voice === "A" && (/(ας|αμεν|ατε|αι)$/.test(normalize(form)) && "IN".includes(p.mood) || /[ξψ]εν?$/.test(normalize(form)) && p.mood === "I" || /(ας|ασα|αντ[α-ως]*)$/.test(normalize(form)) && p.mood === "P")) firstAorist = true;
      if (p.mood !== "I" || p.person !== "1" || p.number !== "S") continue;
      if (part === 2 && voice === "M" && !/μην$/.test(normalize(form))) continue;
      const k = parseKey({ ...p, voice });
      const f = dropEnclitic(form);
      if (!nt.has(k) || nt.get(k).count < count) nt.set(k, { form: f, count });
    }
  }
  // μένω is tagged both present and future (μενῶ): a future spelled like the present isn't the future
  const fut = nt.get(parseKey(FIRST_SG("F", "A")));
  if (fut && fut.form.normalize("NFC") === lex.g.normalize("NFC")) nt.delete(parseKey(FIRST_SG("F", "A")));

  const curated = curatedFor(lex) || (/ειμι$/.test(normalize(lex.g)) ? eimiCompound(lex) : null);
  const gen = formsByParse(lex.g);
  const wanted = [
    [["P", "A"], ["P", "M"]], [["F", "A"], ["F", "M"]], [["A", "A"], ["A", "M"]],
    [["R", "A"]], [["R", "M"], ["R", "P"]], [["A", "P"], ["F", "P"]],
  ];
  parts.forEach((part, i) => {
    if (curated) {
      part.form = curated[i];
      part.source = curated[i] === NONE ? "none" : "curated";
      // use the NT's exact spelling (accent codepoints, movable letters) where it has the same form
      for (const [t, v] of wanted[i]) {
        const hit = nt.get(parseKey(FIRST_SG(t, v)));
        if (hit && part.form !== NONE) part.form = variantsOf(part.form).map((f) => (f.normalize("NFC") === hit.form.normalize("NFC") ? hit.form : f)).join(" / ");
      }
      return;
    }
    if (i === 0) { part.form = lex.g; part.source = "nt"; return; }
    for (const [t, v] of wanted[i]) {
      if (t === "F" && i === 5) continue;
      const hit = nt.get(parseKey(FIRST_SG(t, v)));
      if (hit) { part.form = hit.form; part.source = "nt"; return; }
    }
    if (!gen) return;
    for (const [t, v] of wanted[i]) {
      if (!attested[i].has(t + (i === 5 ? "P" : v)) && !(i === 4 && attested[4].size)) continue; // the NT has no such stem
      const g = gen.get(parseKey(FIRST_SG(t, v === "P" && i === 5 && t === "F" ? "P" : v)));
      if (!g || !g.length) continue;
      let f = g[0].form;
      if (t === "F" && i === 5) continue; // future passive alone doesn't give the aorist passive's 1st sg
      if (i === 2 && v === "A" && firstAorist && /ον$/.test(normalize(f))) { // ὑπέταξεν is tagged "2nd aorist" but ὑπέταξας shows it's 1st
        const alt = g.find((x) => /α$/.test(normalize(x.form)));
        f = alt ? alt.form : f.normalize("NFD").replace(/ον$/, "α").normalize("NFC");
      }
      if (i === 2 && v === "A" && /([σξψ]|ει[λρν])ον$/.test(normalize(f))) { const alt = g.find((x) => /α$/.test(normalize(x.form))); if (alt) f = alt.form; }
      const hasAccent = ACC.test(f.normalize("NFD")); ACC.lastIndex = 0;
      part.form = hasAccent ? f : accentRecessive(f, (t === "A" || t === "I") ? compoundPrefixFor(f, lex.g) : 0);
      part.source = "generated";
      part.accentByRule = !hasAccent;
      return;
    }
  });
  // still missing but the NT has the stem: rebuild the 1st sg from the verb's own NT forms
  parts.forEach((part, i) => {
    if (curated || part.source !== "none" || !attested[i].size) return;
    const f = deriveFirstSg(i, seenForms[i], firstAorist, normalize(lex.g), impfKey);
    if (!f) return;
    const contracted = /ῶ$|οῦμαι$/.test(f);
    const acc = contracted ? f : accentRecessive(f, (i === 2 || i === 5) ? compoundPrefixFor(f, lex.g) : 0);
    part.form = /^ερρ/.test(f) ? acc.normalize("NFD").replace(/^ε/, "ἐ").normalize("NFC") : withBreathing(acc, lex.g);
    part.source = "generated";
    part.accentByRule = true;
  });
  // liquid and -ιζω futures contract: μενῶ, κρινῶ, ἐλπιῶ (circumflex on the ending)
  if (parts[1].source === "generated" && /ω$/.test(normalize(parts[1].form)) && !/[σξψ]ω$/.test(normalize(parts[1].form))) {
    parts[1].form = parts[1].form.normalize("NFD").replace(ACC, "").replace(/ω$/, "ῶ").normalize("NFC");
  }
  parts.attested = attested.map((x) => x.size > 0);
  cache.set(lex.id, parts);
  return parts;
}

// sigmatic and liquid aorists are 1st aorists: ἧξα, ἐξαπέστειλα (never -ξον, -ειλον)
const fixAorist = (k, part) => (part === 2 && !/πεσον$/.test(k) ? k.replace(/([σξψ]|ει[λρν]|η[ρν]|α[νρ])ον$/, "$1α") : k);
// ending swaps that turn another NT form into the 1st sg of the same stem: [part, tense, voice, moods, from, to]
const DERIVE = [
  [1, "F", "A", "I", /σ(ει|εις|ομεν|ετε|ουσιν|ουσι)$/, "σω"], [1, "F", "A", "I", /([ξψ])(ει|εις|ομεν|ετε|ουσιν|ουσι)$/, "$1ω"],
  [1, "F", "A", "I", /(ει|εις|ουμεν|ειτε|ουσιν|ουσι)$/, "ῶ"], [1, "F", "A", "N", /σειν$/, "σω"], [1, "F", "A", "P", /σ(ων|ουσα|οντ[α-ως]*)$/, "σω"],
  [1, "F", "M", "I", /(σ|ξ|ψ)(εται|ονται|ομεθα|εσθε|ῃ)$/, "$1ομαι"], [1, "F", "M", "I", /(ειται|ουνται)$/, "οῦμαι"],
  [2, "A", "M", "I", /(ατο|αντο|αμεθα|ασθε|ω)$/, "αμην"], [2, "A", "M", "I", /(ετο|οντο|ομεθα|εσθε|ου)$/, "ομην"],
  [2, "A", "A", "I", /(εν|ε|ας|αμεν|ατε|αν)$/, "α"], [2, "A", "A", "I", /(ες|ομεν|ετε|ον)$/, "ον"],
  [3, "R", "A", "I", /(εν|ε|ας|αμεν|ατε|ασιν|ασι|αν)$/, "α"], [3, "R", "A", "P", /(ως|υια|ος|οτ[α-ως]*|υι[α-ως]*)$/, "α"], [3, "R", "A", "N", /εναι$/, "α"],
  [4, "R", "M", "P", /μμεν[α-ως]*$/, "μμαι"], [4, "R", "P", "P", /μμεν[α-ως]*$/, "μμαι"], [4, "R", "M", "P", /γμεν[α-ως]*$/, "γμαι"], [4, "R", "P", "P", /γμεν[α-ως]*$/, "γμαι"],
  [4, "R", "M", "P", /μεν[α-ως]*$/, "μαι"], [4, "R", "P", "P", /μεν[α-ως]*$/, "μαι"],
  [4, "R", "M", "I", /σται$/, "σμαι"], [4, "R", "P", "I", /σται$/, "σμαι"], [4, "R", "M", "I", /πται$/, "μμαι"], [4, "R", "P", "I", /πται$/, "μμαι"],
  [4, "R", "M", "I", /[κχ]ται$/, "γμαι"], [4, "R", "P", "I", /[κχ]ται$/, "γμαι"], [4, "R", "M", "I", /(ται|νται|σαι|μεθα|σθε)$/, "μαι"], [4, "R", "P", "I", /(ται|νται|σαι|μεθα|σθε)$/, "μαι"],
  [5, "A", "P", "I", /(η|ης|ημεν|ητε|ησαν)$/, "ην"],
  // forms without the augment: rebuild the stem, then augment it
  [2, "A", "M", "N", /ασθαι$/, "αμην", 1], [2, "A", "M", "N", /εσθαι$/, "ομην", 1],
  [2, "A", "M", "P", /αμεν[α-ως]*$/, "αμην", 1], [2, "A", "M", "P", /ομεν[α-ως]*$/, "ομην", 1],
  [2, "A", "M", "S", /(ωμαι|η|ηται|ωμεθα|ησθε|ωνται)$/, "αμην", 1], [2, "A", "M", "M", /(ασθω|ασθε|ασθωσαν|αι)$/, "αμην", 1],
  [2, "A", "A", "N", /αι$/, "α", 1], [2, "A", "A", "N", /ειν$/, "ον", 1],
  [2, "A", "A", "P", /(ας|ασα|αντ[α-ως]*|ασ[α-ως]*)$/, "α", 1], [2, "A", "A", "P", /(ων|ουσα|οντ[α-ως]*|ουσ[α-ως]*)$/, "ον", 1],
  [2, "A", "A", "S", /(ω|ης|η|ωμεν|ητε|ωσιν|ωσι)$/, "α", 1], [2, "A", "A", "S", /(ω|ης|η|ωμεν|ητε|ωσιν|ωσι)$/, "ον", 1],
  [2, "A", "A", "M", /(ατω|ατε|ατωσαν)$/, "α", 1], [2, "A", "A", "M", /(ετω|ετε)$/, "ον", 1],
  [5, "A", "P", "N", /ηναι$/, "ην", 1], [5, "A", "P", "P", /(εις|εισα|εν|εντ[α-ως]*|εισ[α-ως]*)$/, "ην", 1],
  [5, "A", "P", "S", /(ω|ης|η|ωμεν|ητε|ωσιν|ωσι)$/, "ην", 1], [5, "A", "P", "M", /(ητι|ηθι|ητω|ητε|ητωσαν)$/, "ην", 1],
  [5, "F", "P", "I", /(?<=θ|[γφβλρπ])ησ(ομαι|ῃ|η|εται|ομεθα|εσθε|ονται)$/, "ην", 1],
];

const VERB_KEYS = new Set(LEX.filter((l) => l.p === "verb").map((l) => normalize(l.g)));
/** Split a compound into prefix + verb (κατ|έχω, συλ|λαμβάνω); null for simple verbs (διώκω isn't δι|ώκω). */
function splitPrefix(lemmaKey) {
  for (const p of PREFIXES) {
    const np = normalize(p);
    const el = /[αοι]$/.test(np) && !/^(περι|προ)$/.test(np) ? np.slice(0, -1) : null;
    const surfaces = new Set([np, el, el && el.replace(/π$/, "φ").replace(/τ$/, "θ"), np.replace(/ν$/, "μ"), np.replace(/ν$/, "λ"), np.replace(/ν$/, "γ"), np.replace(/ν$/, "σ"), np.replace(/κ$/, "ξ")].filter(Boolean));
    for (const sf of surfaces) {
      if (!lemmaKey.startsWith(sf)) continue;
      const rest = lemmaKey.slice(sf.length);
      if (rest.length < 3) continue;
      if (sf !== np && sf.length < np.length && /[αοι]$/.test(np) && !/^[αεηιουω]/.test(rest)) continue; // elision only before a vowel (μετρέω isn't μετ-ρέω)
      const known = VERB_KEYS.has(rest) || PREFIXES.some((q) => { const nq = normalize(q); return nq !== np && [nq, nq.slice(0, -1)].some((x) => VERB_KEYS.has(x + rest)); });
      if (known) return { np, sf };
    }
  }
  return null;
}
const AUG_VOWEL = [["αι", "ῃ"], ["αυ", "ηυ"], ["ευ", "ευ"], ["οι", "ῳ"], ["ει", "ει"], ["α", "η"], ["ε", "η"], ["ο", "ω"], ["ι", "ι"], ["υ", "υ"], ["η", "η"], ["ω", "ω"]];
function augmentWord(k) {
  if (k.startsWith("ρ")) return "ερρ" + k.slice(1);
  for (const [a, b] of AUG_VOWEL) if (k.startsWith(a)) return b + k.slice(a.length);
  return "ε" + k;
}
/** Add the augment to an unaugmented aorist form, inside any prefix (κατα-σχον -> κατ-έσχον). */
function augment(k, lemmaKey) {
  const sp = splitPrefix(lemmaKey);
  if (sp) {
    const surf = [sp.np, sp.np.slice(0, -1), sp.np.slice(0, -1).replace(/π$/, "φ").replace(/τ$/, "θ"), sp.np.replace(/ν$/, "μ"), sp.np.replace(/ν$/, "λ"), sp.np.replace(/ν$/, "γ"), sp.np.replace(/ν$/, "σ"), sp.np.replace(/κ$/, "ξ"), sp.sf].sort((a, b) => b.length - a.length).find((x) => x && k.startsWith(x));
    if (surf) {
      let base = sp.np;
      if (/[αοι]$/.test(base) && !/^(περι|προ)$/.test(base)) base = base.slice(0, -1);
      if (base === "εκ") base = "εξ";
      if (sp.sf !== sp.np && /[φθ]$/.test(sp.sf)) base = sp.sf; // ἀφ-, καθ- keep the rough consonant: ἀφ-ῃρέθην
      return base + augmentWord(k.slice(surf.length));
    }
  }
  return augmentWord(k);
}
function deriveFirstSg(part, forms, firstAorist, lemmaKey, impf) {
  const aug = (k) => {
    const a = augment(k, lemmaKey);
    // κατηγορέω: the NT imperfect κατηγόρουν shows the verb takes no augment of its own
    const stem = lemmaKey.replace(/(εομαι|αομαι|ομαι|εω|αω|οω|ω)$/, "");
    if (impf && stem.length >= 4 && impf.startsWith(stem)) return k;
    return a;
  };
  const sorted = [...forms].sort((a, b) => b.count - a.count);
  for (const [pt, t, v, moods, from, to, augFlag] of DERIVE) {
    if (pt !== part) continue;
    if (pt === 2 && v === "A" && (to === "α") !== firstAorist) continue;
    for (const { k, p } of sorted) {
      if (p.tense !== t || p.voice !== v || !moods.includes(p.mood)) continue;
      if (p.mood === "I" && p.person === "1" && p.number === "S") continue;
      if (from.test(k)) return fixAorist(augFlag ? aug(k.replace(from, to)) : k.replace(from, to), pt);
    }
  }
  return null;
}

/** Verbs whose parts are worth drilling, most frequent first (aorist-only lemmas like εἶπον go with λέγω). */
const NOT_A_PRESENT = new Set(["εἶπον", "εἶδον", "φαγεῖν", "δεῖ", "ἔξεστι"].map(formKey));
export const isAoristLemma = (lex) => NOT_A_PRESENT.has(formKey(lex.g));
export function verbsWithParts(minFreq = 10) {
  return LEX.filter((l) => l.p === "verb" && !l.pn && l.f >= minFreq && !NOT_A_PRESENT.has(formKey(l.g)))
    .sort((a, b) => b.f - a.f);
}


export { findLemma };
