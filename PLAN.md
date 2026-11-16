# Roadmap

## Phase 1: done (this build)

- **Today:** daily goal, one-tap "today's practice", streak with freezes, heatmap, NT coverage meter, weak spots, weekly stats, verse of the day (THGNT, chosen by your known vocab, tap-to-gloss hints, keyword grading).
- **Vocab:** FSRS spaced repetition (or cram mode), Greek→English and English→Greek (typed, accent-insensitive), built-in frequency lists, automatic lists ("words I keep looking up / missing"), your own lists, CSV import/export (`english,greek`), editing words.
- **Mistake Log:** every miss from vocab, verse of the day and placement; filter, delete one, delete selected, delete all, review the words.
- **Profile:** name, Mounce chapter and placement test, daily goal, new words per day, review direction, target recall, Latin→Greek typing, theme, Turso sync, backup/restore, erase.
- Works offline (PWA) and installs to a phone home screen.

## Phase 2: done

- **Paradigms tab:** 40 tables tagged by Mounce chapter: the article; 1st, 2nd and 3rd declension nouns; adjectives (2-1-2, 3-1-3); personal, αὐτός, demonstrative, relative and interrogative pronouns; εἰμί; λύω in every indicative tense; 2nd aorist; contract verbs; μι verbs; subjunctive, imperative and infinitives; five participles. Each has a view mode and fill-in tests (all blanks or a random half), with misses logged.
- **Parse tab:**
  - *Nouns & pronouns:* case, number, gender (person for ἐγώ/σύ), optional declension.
  - *Verbs (simplified):* tense, voice, mood, then person and number, or case, number and gender for participles. No lexical form.
  - *Recognize* (pick the parsing) and *Produce* (type the form for a given lemma and parsing).
  - *Sources:* paradigm forms, real THGNT forms (17,748 distinct forms), or both.
  - *Filters:* "grammar covered up to Mounce ch. N", noun types, tenses, moods, session length.
  - *Every valid parsing counts:* the answer index merges every parse a form has in the NT and the paradigms, plus rules for forms that are always identical (neuter nom/acc; masc/neut gen/dat; middle/passive in present, imperfect and perfect; present 2nd plural indicative/imperative). There's an "I was actually right" override.
  - A "See paradigm" popup after each answer.
- **Today:** a "Parse 10 forms" button. Weak spots now include parsing and paradigm categories with a Drill button.
- **Profile:** 8 accent colors, each with a light and dark version.

Phase 2 follow-ups worth considering: 2-2 adjectives (αἰώνιος), more 3rd declension models (πατήρ, χάρις), liquid futures and aorists, pluperfect, optative, and principal parts.

## Phase 3: done

- **Translate tab:** pick from the NT, the Septuagint or both, any book, by difficulty (share of non-name words you know: easy 90%+, medium 75–90%, hard) and length, or "Surprise me". Name-heavy verses are skipped.
- **Data:** THGNT with BSB English. The Swete LXX comes from QuantForge (CC BY-SA, computer-generated parsing) with Brenton's English. About 16,200 clean verses after filtering, and 95% of LXX words carry a gloss via the NT lexicon.
- **Keyword grading v2:** contextual glosses, lexicon glosses, about 200 synonym groups, function-word handling. Names and unglossed LXX words aren't scored. **"I had it"** teaches the app your word for a lemma, and it syncs.
- **Helpers:** tap-to-gloss (−5 each), show parsing (−10), show lexical forms (−10). Tap-to-gloss on Septuagint words labels the parsing as computer-generated.
- **Afterward:** the reference translation, Redo later, Next verse, and "Looks wrong?" (flags a verse so it never comes up again).
- **History** of every attempt with scores (synced). Mistakes go to the Mistake Log.
- **Verse of the day** runs on the same engine. Profile setting: NT, Septuagint or either.

Phase 3 follow-ups worth considering: glosses for LXX-only words (e.g. from a public-domain LXX lexicon), clause-level partial credit, NT-attested parsings for LXX forms, and a per-book progress view.

## Phase 4: done

- **Reader:** whole chapters of the THGNT or the Septuagint, with tap-to-gloss everywhere. Interlinear glosses can be off, shown only for words you don't know, or shown for all words. There's an English switch, and each verse number opens a menu (show English, translate this verse). Previous/next chapter buttons, and it remembers where you left off. Words you look up feed "Words I keep looking up".
- **Apocrypha switch** (Profile → Practice): hides the 13 deuterocanonical books from Translate, Reader and the verse of the day.
- **Today extras:** parsing accuracy by category (last 30 days, with the weakest category called out), coverage by NT book (each links into the Reader), and a Mounce progress bar.
- **Tap-to-gloss → paradigm:** any parsed word has a "See paradigm" button that opens the matching table.
- **Accessibility:** skip link, focus moves to the page on navigation, `aria-current` in the nav, live-region verdicts, reduced-motion support, and labelled switches and progress bars.

## Septuagint upgrade: done

- Switched the Greek text from Swete (OCR transcription) to **Brenton's Greek**, the edition his English translates. The two now line up verse for verse. 27,062 verses are usable, up from 16,209.
- Words are tagged by form lookup (THGNT first, then the Morpheus analyses), with an article-agreement pass that fixed about 5,600 case/number/gender choices. About 97% of words are tagged and 95% have a gloss or are names.
- **Catholic canon only:** 1 Esdras, 3–4 Maccabees, the Prayer of Manasseh and Psalm 151 are removed. The Apocrypha switch covers the remaining deuterocanonical books.
- Still computer-assigned: some ambiguous forms get the wrong parsing or lemma (e.g. ὑστερήσει → ὑστέρημα), and about 5% of words (LXX-only vocabulary) have no gloss.

## Lexicon, verb generator, parsing audit: done

- **Lexicon tab:** search Greek, Latin transliteration or English. Each entry shows the dictionary form, gloss, gender/declension, NT and LXX counts, the full Abbott-Smith definition (NT references link into the Reader), and every form of the word in the NT with its parsing.
- **Parse → "All verbs, every form":** 361 regular verbs used 10+ times, about 40,000 forms built from each verb's NT stems.
  - Checks: every NT form of a tense/voice block must be reproduced exactly, or that block is dropped. All 320 verb cells of the hand-checked paradigm tables match. In a hold-out test, 99.2% of hidden NT forms were predicted exactly; the misses are NT spelling and stem variants (ἔσθω, ἀποκτέννω, ἡρπάγη/ἡρπάσθη) or tagging noise.
  - Rules handled: contraction (-άω/-έω/-όω, incl. deponents), liquid futures, 1st/2nd aorists, Koine mixed endings (ἦλθαν, εὑράμενος, -οσαν, βούλει, καυχᾶσαι), compound-verb augments, -ηθι/-ητι, movable ν, iota subscripts, deponents (no invented actives).
  - Left out on purpose: μι verbs, athematic -μαι verbs, root aorists (ἔγνων, ἔβην), ζάω/χράομαι, ἀπόλλυμι, ἀνοίγω, the non-indicative aorist of φέρω compounds.
  - Forms not found in the NT are shown without accents.
- **Parsing filter audit:** 2,475 tense/mood/chapter combinations on paradigm + real forms (1.25M checks) and 1,800 on generated forms (6.2M checks), with 0 forms or prompts outside the selection.

## Paradigms in the Lexicon: done

- Each Lexicon entry has a **Paradigms** section. Verbs get tables for every indicative tense, the subjunctive, imperative, infinitives and every participle. Nouns, adjectives and pronouns get a full case table. NT forms show in normal type (most common spelling first), and generated forms show in grey, unaccented. 1st/2nd-declension nouns and 2-1-2 / 2-2 adjectives are filled in only when the pattern reproduces every NT form of the word. Third-declension words and μι verbs show their NT forms only.
- Data fixes found along the way: forms that differ only by an iota subscript are no longer merged (ἡμέρα nominative vs ἡμέρᾳ dative, which also affected Parse), and each word's headword is now its most common dictionary form (ἐγώ, not κἀγώ).

## Principal parts: done

- New **Principal parts** page (More → Principal parts): pick core verbs (50+), 25–49×, 10–24×, or the verbs in your own lists.
  - **Flashcards**: lexical form → one part (λύω → aorist active), on the normal spaced-repetition schedule. The parts also show up as lists in Vocab ("Principal parts: core verbs", "…25–49 times", "Principal parts of my verbs").
  - **All six**: type every part of a verb at once; each part updates its flashcard and misses go to the Mistake Log.
  - **Stem spotting**: a real NT form (παραδόντος); pick which of the six stems it's built on, optionally with the lexical form.
  - A reference table of every verb's parts.
- Lexicon verb entries show the six parts with a "Learn these parts" button.
- Where the parts come from: the verb's own NT 1st-singular form when the NT has it; a hand-checked table for about 90 irregular verbs (εἰμί, λέγω/εἶπον, ὁράω/εἶδον, ἔρχομαι and compounds, μι verbs…); otherwise the form is rebuilt from the verb's other NT forms of that stem (ἠργάσατο → ἠργασάμην, ἡτοιμασμένος → ἡτοίμασμαι), with the augment and recessive accent added by rule (the accent rule reproduces all 373 regular NT 1st-singular forms). A part is shown as "—" only when the NT never uses that stem. Parts not in the NT in that exact form are marked in italics.

## Ideas parked for later

- Principal parts drill (ἔρχομαι → ἐλεύσομαι, ἦλθον, ἐλήλυθα…)
- Morphology "why" hints that color-code the augment, tense formative and ending
- Timed parsing sprints
- Sharing lists with friends via a link
