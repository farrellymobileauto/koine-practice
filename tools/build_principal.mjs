// Builds data/principal.json: six principal parts for every NT verb (see js/principal.js).
//   node tools/build_principal.mjs
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.fetch = async (u) => ({ json: async () => JSON.parse(await readFile(path.join(ROOT, String(u)), "utf8")) });
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const D = await imp("js/data.js"); await D.loadLexicon();
const M = await imp("js/morph.js"); await M.loadForms();
const P = await imp("js/principal.js");
const out = { _skip: [] };
let n = 0;
for (const l of P.verbsWithParts(1)) {
  out[l.id] = P.principalParts(l).map((x) => (x.source === "none" ? [""] : [x.form, x.source[0]]));
  n++;
}
for (const l of D.LEX.filter((l) => l.p === "verb" && P.isAoristLemma(l))) {
  out[l.id] = P.principalParts(l).map((x) => (x.source === "none" ? [""] : [x.form, x.source[0]]));
  out._skip.push(l.id);
}
await writeFile(path.join(ROOT, "data/principal.json"), JSON.stringify(out));
console.log(`principal.json: ${n} verbs`);
