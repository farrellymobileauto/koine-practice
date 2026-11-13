# Koine Practice

A personal web app for daily Koine Greek practice. It's plain HTML/CSS/JS with no build step and no framework, and it runs on a laptop or a phone.

**Built so far:** Today (dashboard), Vocab (spaced-repetition flashcards and lists), Parse (nouns & verbs, recognize & produce), Paradigms (reference tables + fill-in tests), Translate (THGNT + Septuagint), Reader, Mistake Log, Profile. See [PLAN.md](PLAN.md).

## Run it locally

```bash
npm start
```

Then open http://localhost:5173. There's nothing to install (no dependencies); it's a tiny Node server in `tools/serve.mjs` with caching turned off, so a normal refresh picks up your edits. Opening `index.html` directly won't work, because browsers block the app's modules from `file://`.

To try it on your phone over Wi-Fi, run `npm run start:lan` and open the address it prints on the phone.

## Deploy to Render (free)

1. Push this folder to a GitHub repo.
2. In Render: **New → Static Site**, pick the repo.
3. Build command: leave empty. Publish directory: `.`
4. Done. Render static sites are free, separate from your paid web service.

When you deploy changes, bump `VERSION` in `sw.js` so installed phones drop the old offline cache.
On your phone, use **Add to Home Screen** to get it as an app. It works offline.

## Sync between devices (Turso)

Profile → Sync. Create a database and a token scoped to just that database:

```bash
turso db create koine
```
```bash
turso db show koine --url
```
```bash
turso db tokens create koine
```

Paste the URL and token into Profile on each device. They're stored only in that browser (IndexedDB), never in the code, so the public site doesn't expose your database. Data is local-first: everything works offline and syncs when it can (last write wins per record).

## Files

```
index.html            app shell
css/app.css           all styles (light/dark tokens at the top)
js/app.js             router + navigation
js/db.js              IndexedDB storage, change tracking for sync
js/store.js           data model: words, lists, FSRS cards, streak, coverage, mistakes
js/greek.js           normalization, Latin→Greek typing, answer checking, morphology decoding
js/gloss.js           tap-to-gloss popover
js/sync.js            Turso HTTP sync
js/csv.js             CSV import/export (english, greek)
js/paradigms.js       paradigm tables (hand-entered, tagged by Mounce chapter)
js/morph.js           parsing engine: parse objects, valid-parse index, chapters, drill items
js/corpus.js          verses from the THGNT and the LXX in one shape; verse picker by difficulty/length/book
js/grade.js           keyword grading for translations (synonyms, learned synonyms, hint penalties)
js/views/reader.js    chapter reader with interlinear glosses
js/views/*.js         one file per screen
vendor/ts-fsrs.mjs    spaced-repetition scheduler (MIT)
data/*.json           Greek data built by tools/build_data.py (lexicon, NT text, forms index, placement test)
data/en-nt.json       BSB English for the NT        (tools/build_lxx.py)
data/lxx/             Brenton's Septuagint (Greek + English), one file per book (tools/build_lxx.py)
```

## Rebuilding the Greek data

`data/` is generated from STEPBible's open data. To rebuild it, download these three files from https://github.com/STEPBible/STEPBible-Data into `data-src/`:

- `Translators Amalgamated OT+NT/TAGNT Mat-Jhn …txt` → save as `data-src/tagnt1.txt`
- `Translators Amalgamated OT+NT/TAGNT Act-Rev …txt` → save as `data-src/tagnt2.txt`
- `Lexicons/TBESG …txt` → save as `data-src/tbesg.txt`

Then run:

```bash
python -I tools/build_data.py data-src data
```

or `npm run build:data`.

The Septuagint and English data come from `tools/build_lxx.py` (run it after `build_data.py`). It needs these files in `data-src/`:

- `grcbrent/grcbrent_vpl.txt`: Brenton's Greek Septuagint, from https://ebible.org/Scriptures/grcbrent_vpl.zip
- `brenton_vpl.txt`: `eng-Brenton_vpl.txt` from https://ebible.org/Scriptures/eng-Brenton_vpl.zip
- `swete/*.txt`: the Morpheus-analyzed Swete text from https://github.com/QuantForgeSoftware/lxx (`data/morph-morpheus/`). It's used only as a form → lemma/parsing dictionary.
- `bsb.txt` from https://bereanbible.com/bsb.txt

```bash
python -I tools/build_lxx.py data-src data
```

How it works: Brenton's Greek has no tagging, so each word is looked up by form. THGNT forms win (they're tagged in context), then the Swete/Morpheus analyses, then accent-insensitive matches. After that, a noun right after an article takes that article's case, number and gender. About 97% of words get tagged, and 27,062 of 27,102 verses are kept.

The canon follows the Catholic Old Testament. 1 Esdras, 3–4 Maccabees, the Prayer of Manasseh, Psalm 151, the Odes and the Psalms of Solomon are left out. The Profile switch hides the deuterocanonical books (Tobit, Judith, 1–2 Maccabees, Wisdom, Sirach, Baruch + Letter of Jeremiah, Susanna, Bel).

## CSV format

Two columns, `english,greek`, with an optional header row. Quote the Greek if it contains commas:

```
english,greek
word,"λόγος, -ου, ὁ"
to love,ἀγαπάω
```

Greek that matches an NT word gets linked to it (frequency, tap-to-gloss, coverage). Anything else becomes a custom word.

## Credits

- Greek NT: Tyndale House GNT readings, grammar and glosses from **STEPBible TAGNT** (Tyndale House Cambridge & STEPBible.org, CC BY 4.0). English glosses are based on the Berean Study Bible. Dictionary forms come from TBESG (Abbott-Smith). Changes: only THGNT words are kept, transliterations and versification brackets are removed, and glosses are shortened.
- Septuagint: Brenton's Greek Septuagint (1851, public domain, via eBible.org). Lemmas and parsing are computer-assigned using the THGNT tags and the Morpheus analyses from the [QuantForge LXX](https://github.com/QuantForgeSoftware/lxx) project (**CC BY-SA 4.0**). Because of that, the files in `data/lxx/` are shared under CC BY-SA 4.0.
- English: Berean Standard Bible (public domain) and Brenton's 1851 English Septuagint (public domain, via eBible.org).
- Scheduling: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT).
- Fonts: Gentium Book Plus (SIL OFL) and Inter (OFL), via Google Fonts.
