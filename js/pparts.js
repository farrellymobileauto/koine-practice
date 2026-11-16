// Principal parts at runtime: read from data/principal.json (built by tools/build_principal.mjs from js/principal.js).
//   1 present · 2 future · 3 aorist active · 4 perfect active · 5 perfect middle/passive · 6 aorist passive
import { LEX, LEX_BY_ID } from "./data.js";
import { normalize } from "./greek.js";

export const PART_NAMES = ["Present", "Future", "Aorist active", "Perfect active", "Perfect middle/passive", "Aorist passive"];
export const PART_SHORT = ["pres.", "fut.", "aor. act.", "perf. act.", "perf. mid/pass.", "aor. pass."];
const SOURCE = { n: "nt", c: "curated", g: "generated" };

let PP = null;
export async function loadPrincipal() {
  if (PP) return PP;
  try { PP = await (await fetch("data/principal.json")).json(); } catch { PP = {}; }
  return PP;
}
export const principalLoaded = () => !!PP;

/** Six parts for a verb: [{ form, source: "nt"|"curated"|"generated"|"none" }] or null. */
export function partsOf(lex) {
  if (!PP || !lex) return null;
  const row = PP[lex.id];
  if (!row) return null;
  return row.map(([form, src]) => ({ form: form || "—", source: form ? SOURCE[src] || "generated" : "none" }));
}

/** Verbs to drill, most frequent first (aorist-only lemmas like εἶπον are taught with λέγω). */
export function ppVerbs(minFreq = 10, maxFreq = Infinity) {
  if (!PP) return [];
  return LEX.filter((l) => l.p === "verb" && !l.pn && PP[l.id] && l.f >= minFreq && l.f < maxFreq && !(PP._skip || []).includes(l.id))
    .filter((l) => PP[l.id].slice(1).some(([f]) => f))
    .sort((a, b) => b.f - a.f);
}

/** Answer variants for a part ("ἔστησα / ἔστην" accepts either). */
export const variantsOf = (form) => String(form || "").split(" / ").map((s) => s.trim()).filter(Boolean);

// Which part a tense/voice is built on (for "which stem is this form built on?")
export function partOf(p) {
  if (p.pos !== "verb") return null;
  if (p.tense === "P" || p.tense === "I") return 0;
  if (p.tense === "F") return p.voice === "P" ? 5 : 1;
  if (p.tense === "A") return p.voice === "P" ? 5 : 2;
  if (p.tense === "R" || p.tense === "L") return p.voice === "A" ? 3 : 4;
  return null;
}

/** Which part a real NT form is built on. Uses the form's shape where the tag says "deponent"
 *  (TAGNT tags ἀπεκρίθη as middle deponent, but it's built on the aorist passive stem). */
export function partOfForm(p, form) {
  let i = partOf(p);
  if (i == null) return i;
  const k = normalize(form);
  const MIDDLE = /(σθαι|σθω|σθε|σθωσαν|ατο|αντο|αμην|αμεθα|ομην|ετο|εντο|εμην|οντο|ωμαι|ηται|ωνται|ωμεθα|αμεν[α-ως]*|ομεν[α-ως]*|σαι|σω|ου)$/;
  if (p.tense === "A" && p.voice === "P" && MIDDLE.test(k) && !/θ/.test(k)) i = 2; // ἐπηγγείλαντο (tagged middle-or-passive)
  if (p.tense === "A" && p.voice === "M" && !MIDDLE.test(k) && /θ(η|ει|εν|ε|ω)|ην$|ησαν$|ηναι$|ει[σς]$|εντ[α-ως]*$/.test(k)) i = 5;
  if (p.tense === "F" && p.voice === "P" && !/(θ|[γφβλρπ])ησ(ομαι|η|εται|ομεθα|εσθε|ονται|εσθαι|ομεν[α-ως]*)$/.test(k)) i = 1; // πεσοῦνται: future middle
  return i;
}
