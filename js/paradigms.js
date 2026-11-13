// Paradigm tables (hand-entered; chapter numbers follow Mounce, BBG).
// Cells: one string per row, columns separated by spaces. Alternatives use "/", movable nu "(ν)".
// Every cell gets a full parse = table.parse + row.parse + col.parse ("MP" voice = middle or passive).

export const LAYOUTS = {
  case8: [
    { label: "Nom sg", parse: { case: "N", number: "S" } }, { label: "Gen sg", parse: { case: "G", number: "S" } },
    { label: "Dat sg", parse: { case: "D", number: "S" } }, { label: "Acc sg", parse: { case: "A", number: "S" } },
    { label: "Nom pl", parse: { case: "N", number: "P" } }, { label: "Gen pl", parse: { case: "G", number: "P" } },
    { label: "Dat pl", parse: { case: "D", number: "P" } }, { label: "Acc pl", parse: { case: "A", number: "P" } },
  ],
  pn6: [
    { label: "1 sg", parse: { person: "1", number: "S" } }, { label: "2 sg", parse: { person: "2", number: "S" } },
    { label: "3 sg", parse: { person: "3", number: "S" } }, { label: "1 pl", parse: { person: "1", number: "P" } },
    { label: "2 pl", parse: { person: "2", number: "P" } }, { label: "3 pl", parse: { person: "3", number: "P" } },
  ],
  imp4: [
    { label: "2 sg", parse: { person: "2", number: "S" } }, { label: "3 sg", parse: { person: "3", number: "S" } },
    { label: "2 pl", parse: { person: "2", number: "P" } }, { label: "3 pl", parse: { person: "3", number: "P" } },
  ],
};
const MFN = [{ label: "Masc", parse: { gender: "M" } }, { label: "Fem", parse: { gender: "F" } }, { label: "Neut", parse: { gender: "N" } }];
const one = (label, parse = {}) => [{ label, parse }];
const AMP = [{ label: "Active", parse: { voice: "A" } }, { label: "Middle/Passive", parse: { voice: "MP" } }];

const noun = (id, title, ch, lemma, gender, decl, cells, note) => ({
  id, title, ch, group: "Nouns", lemma, layout: "case8", parse: { pos: "noun", gender, decl }, cols: one(lemma), cells, note,
});
const adj = (id, title, ch, lemma, pos, cells, extra = {}) => ({
  id, title, ch, group: pos === "adj" ? "Adjectives" : pos === "art" ? "Article" : "Pronouns", lemma, layout: "case8", parse: { pos, ...extra }, cols: MFN, cells,
});
const fin = (id, title, ch, group, lemma, parse, cols, cells, note) => ({ id, title, ch, group, lemma, layout: "pn6", parse: { pos: "verb", ...parse }, cols, cells, note });
const ptc = (id, title, ch, parse, cells) => ({ id, title, ch, group: "Participles", lemma: "λύω", layout: "case8", parse: { pos: "verb", mood: "P", ...parse }, cols: MFN, cells });

export const PARADIGMS = [
  // ---------- Article ----------
  adj("article", "The article", 7, "ὁ", "art", [
    "ὁ ἡ τό", "τοῦ τῆς τοῦ", "τῷ τῇ τῷ", "τόν τήν τό",
    "οἱ αἱ τά", "τῶν τῶν τῶν", "τοῖς ταῖς τοῖς", "τούς τάς τά"]),

  // ---------- Nouns ----------
  noun("n2-logos", "2nd declension masculine: λόγος", 7, "λόγος", "M", 2, ["λόγος", "λόγου", "λόγῳ", "λόγον", "λόγοι", "λόγων", "λόγοις", "λόγους"]),
  noun("n2-ergon", "2nd declension neuter: ἔργον", 7, "ἔργον", "N", 2, ["ἔργον", "ἔργου", "ἔργῳ", "ἔργον", "ἔργα", "ἔργων", "ἔργοις", "ἔργα"], "Neuter: nominative and accusative are always the same."),
  noun("n1-graphe", "1st declension (η): γραφή", 7, "γραφή", "F", 1, ["γραφή", "γραφῆς", "γραφῇ", "γραφήν", "γραφαί", "γραφῶν", "γραφαῖς", "γραφάς"]),
  noun("n1-hora", "1st declension (α pure): ὥρα", 7, "ὥρα", "F", 1, ["ὥρα", "ὥρας", "ὥρᾳ", "ὥραν", "ὧραι", "ὡρῶν", "ὥραις", "ὥρας"], "Stem ends in ε, ι or ρ, so α stays through the singular."),
  noun("n1-doxa", "1st declension (α → η): δόξα", 7, "δόξα", "F", 1, ["δόξα", "δόξης", "δόξῃ", "δόξαν", "δόξαι", "δοξῶν", "δόξαις", "δόξας"]),
  noun("n1-prophetes", "1st declension masculine: προφήτης", 8, "προφήτης", "M", 1, ["προφήτης", "προφήτου", "προφήτῃ", "προφήτην", "προφῆται", "προφητῶν", "προφήταις", "προφήτας"]),
  noun("n3-sarx", "3rd declension (consonant stem): σάρξ", 11, "σάρξ", "F", 3, ["σάρξ", "σαρκός", "σαρκί", "σάρκα", "σάρκες", "σαρκῶν", "σαρξί(ν)", "σάρκας"]),
  noun("n3-onoma", "3rd declension neuter (-μα): ὄνομα", 11, "ὄνομα", "N", 3, ["ὄνομα", "ὀνόματος", "ὀνόματι", "ὄνομα", "ὀνόματα", "ὀνομάτων", "ὀνόμασι(ν)", "ὀνόματα"]),
  noun("n3-polis", "3rd declension (-ις, -εως): πόλις", 11, "πόλις", "F", 3, ["πόλις", "πόλεως", "πόλει", "πόλιν", "πόλεις", "πόλεων", "πόλεσι(ν)", "πόλεις"]),
  noun("n3-ethnos", "3rd declension neuter (-ος, -ους): ἔθνος", 11, "ἔθνος", "N", 3, ["ἔθνος", "ἔθνους", "ἔθνει", "ἔθνος", "ἔθνη", "ἐθνῶν", "ἔθνεσι(ν)", "ἔθνη"]),
  noun("n3-basileus", "3rd declension (-ευς): βασιλεύς", 11, "βασιλεύς", "M", 3, ["βασιλεύς", "βασιλέως", "βασιλεῖ", "βασιλέα", "βασιλεῖς", "βασιλέων", "βασιλεῦσι(ν)", "βασιλεῖς"]),

  // ---------- Adjectives ----------
  adj("adj-agathos", "Adjective 2-1-2 (η): ἀγαθός", 10, "ἀγαθός", "adj", [
    "ἀγαθός ἀγαθή ἀγαθόν", "ἀγαθοῦ ἀγαθῆς ἀγαθοῦ", "ἀγαθῷ ἀγαθῇ ἀγαθῷ", "ἀγαθόν ἀγαθήν ἀγαθόν",
    "ἀγαθοί ἀγαθαί ἀγαθά", "ἀγαθῶν ἀγαθῶν ἀγαθῶν", "ἀγαθοῖς ἀγαθαῖς ἀγαθοῖς", "ἀγαθούς ἀγαθάς ἀγαθά"]),
  adj("adj-dikaios", "Adjective 2-1-2 (α): δίκαιος", 10, "δίκαιος", "adj", [
    "δίκαιος δικαία δίκαιον", "δικαίου δικαίας δικαίου", "δικαίῳ δικαίᾳ δικαίῳ", "δίκαιον δικαίαν δίκαιον",
    "δίκαιοι δίκαιαι δίκαια", "δικαίων δικαίων δικαίων", "δικαίοις δικαίαις δικαίοις", "δικαίους δικαίας δίκαια"]),
  adj("adj-pas", "Adjective 3-1-3: πᾶς", 11, "πᾶς", "adj", [
    "πᾶς πᾶσα πᾶν", "παντός πάσης παντός", "παντί πάσῃ παντί", "πάντα πᾶσαν πᾶν",
    "πάντες πᾶσαι πάντα", "πάντων πασῶν πάντων", "πᾶσι(ν) πάσαις πᾶσι(ν)", "πάντας πάσας πάντα"]),

  // ---------- Pronouns ----------
  { id: "pron-ego", title: "1st person pronoun: ἐγώ", ch: 12, group: "Pronouns", lemma: "ἐγώ", layout: "case8", parse: { pos: "pron", person: "1" }, cols: one("ἐγώ"),
    cells: ["ἐγώ", "ἐμοῦ/μου", "ἐμοί/μοι", "ἐμέ/με", "ἡμεῖς", "ἡμῶν", "ἡμῖν", "ἡμᾶς"], note: "The forms without ἐ- (μου, μοι, με) are unemphatic." },
  { id: "pron-su", title: "2nd person pronoun: σύ", ch: 12, group: "Pronouns", lemma: "σύ", layout: "case8", parse: { pos: "pron", person: "2" }, cols: one("σύ"),
    cells: ["σύ", "σοῦ/σου", "σοί/σοι", "σέ/σε", "ὑμεῖς", "ὑμῶν", "ὑμῖν", "ὑμᾶς"] },
  adj("pron-autos", "αὐτός", 13, "αὐτός", "pron", [
    "αὐτός αὐτή αὐτό", "αὐτοῦ αὐτῆς αὐτοῦ", "αὐτῷ αὐτῇ αὐτῷ", "αὐτόν αὐτήν αὐτό",
    "αὐτοί αὐταί αὐτά", "αὐτῶν αὐτῶν αὐτῶν", "αὐτοῖς αὐταῖς αὐτοῖς", "αὐτούς αὐτάς αὐτά"]),
  adj("pron-houtos", "Demonstrative: οὗτος (this)", 14, "οὗτος", "pron", [
    "οὗτος αὕτη τοῦτο", "τούτου ταύτης τούτου", "τούτῳ ταύτῃ τούτῳ", "τοῦτον ταύτην τοῦτο",
    "οὗτοι αὗται ταῦτα", "τούτων τούτων τούτων", "τούτοις ταύταις τούτοις", "τούτους ταύτας ταῦτα"]),
  adj("pron-ekeinos", "Demonstrative: ἐκεῖνος (that)", 14, "ἐκεῖνος", "pron", [
    "ἐκεῖνος ἐκείνη ἐκεῖνο", "ἐκείνου ἐκείνης ἐκείνου", "ἐκείνῳ ἐκείνῃ ἐκείνῳ", "ἐκεῖνον ἐκείνην ἐκεῖνο",
    "ἐκεῖνοι ἐκεῖναι ἐκεῖνα", "ἐκείνων ἐκείνων ἐκείνων", "ἐκείνοις ἐκείναις ἐκείνοις", "ἐκείνους ἐκείνας ἐκεῖνα"]),
  adj("pron-hos", "Relative pronoun: ὅς", 15, "ὅς", "pron", [
    "ὅς ἥ ὅ", "οὗ ἧς οὗ", "ᾧ ᾗ ᾧ", "ὅν ἥν ὅ",
    "οἵ αἵ ἅ", "ὧν ὧν ὧν", "οἷς αἷς οἷς", "οὕς ἅς ἅ"]),
  adj("pron-tis", "Interrogative: τίς (who? what?)", 15, "τίς", "pron", [
    "τίς τίς τί", "τίνος τίνος τίνος", "τίνι τίνι τίνι", "τίνα τίνα τί",
    "τίνες τίνες τίνα", "τίνων τίνων τίνων", "τίσι(ν) τίσι(ν) τίσι(ν)", "τίνας τίνας τίνα"]),

  // ---------- εἰμί ----------
  fin("eimi-pres", "εἰμί: present", 9, "εἰμί", "εἰμί", { tense: "P", voice: "A", mood: "I" }, one("Present"),
    ["εἰμί", "εἶ", "ἐστί(ν)", "ἐσμέν", "ἐστέ", "εἰσί(ν)"]),
  fin("eimi-impf", "εἰμί: imperfect", 22, "εἰμί", "εἰμί", { tense: "I", voice: "A", mood: "I" }, one("Imperfect"),
    ["ἤμην", "ἦς", "ἦν", "ἦμεν/ἤμεθα", "ἦτε", "ἦσαν"]),
  fin("eimi-fut", "εἰμί: future", 20, "εἰμί", "εἰμί", { tense: "F", voice: "M", mood: "I" }, one("Future (middle)"),
    ["ἔσομαι", "ἔσῃ", "ἔσται", "ἐσόμεθα", "ἔσεσθε", "ἔσονται"]),

  // ---------- λύω: indicative ----------
  fin("lyo-pres", "Present indicative: λύω", 17, "Verbs: indicative", "λύω", { tense: "P", mood: "I" }, AMP, [
    "λύω λύομαι", "λύεις λύῃ", "λύει λύεται", "λύομεν λυόμεθα", "λύετε λύεσθε", "λύουσι(ν) λύονται"],
    "Middle and passive look the same in the present (ch. 19)."),
  fin("lyo-impf", "Imperfect indicative: λύω", 22, "Verbs: indicative", "λύω", { tense: "I", mood: "I" }, AMP, [
    "ἔλυον ἐλυόμην", "ἔλυες ἐλύου", "ἔλυε(ν) ἐλύετο", "ἐλύομεν ἐλυόμεθα", "ἐλύετε ἐλύεσθε", "ἔλυον ἐλύοντο"]),
  fin("lyo-fut", "Future indicative: λύω", 20, "Verbs: indicative", "λύω", { tense: "F", mood: "I" },
    [{ label: "Active", parse: { voice: "A" } }, { label: "Middle", parse: { voice: "M" } }, { label: "Passive", parse: { voice: "P" } }], [
    "λύσω λύσομαι λυθήσομαι", "λύσεις λύσῃ λυθήσῃ", "λύσει λύσεται λυθήσεται",
    "λύσομεν λυσόμεθα λυθησόμεθα", "λύσετε λύσεσθε λυθήσεσθε", "λύσουσι(ν) λύσονται λυθήσονται"],
    "Future passive is taught with the aorist passive (ch. 25)."),
  fin("lyo-aor", "1st aorist indicative: λύω", 24, "Verbs: indicative", "λύω", { tense: "A", mood: "I" },
    [{ label: "Active", parse: { voice: "A" } }, { label: "Middle", parse: { voice: "M" } }, { label: "Passive", parse: { voice: "P" } }], [
    "ἔλυσα ἐλυσάμην ἐλύθην", "ἔλυσας ἐλύσω ἐλύθης", "ἔλυσε(ν) ἐλύσατο ἐλύθη",
    "ἐλύσαμεν ἐλυσάμεθα ἐλύθημεν", "ἐλύσατε ἐλύσασθε ἐλύθητε", "ἔλυσαν ἐλύσαντο ἐλύθησαν"],
    "Aorist passive is ch. 25."),
  fin("aor2", "2nd aorist indicative: λαμβάνω, γίνομαι", 23, "Verbs: indicative", "λαμβάνω", { tense: "A", mood: "I" },
    [{ label: "Active (λαμβάνω)", parse: { voice: "A" }, lemma: "λαμβάνω" }, { label: "Middle (γίνομαι)", parse: { voice: "M" }, lemma: "γίνομαι" }], [
    "ἔλαβον ἐγενόμην", "ἔλαβες ἐγένου", "ἔλαβε(ν) ἐγένετο", "ἐλάβομεν ἐγενόμεθα", "ἐλάβετε ἐγένεσθε", "ἔλαβον ἐγένοντο"],
    "Same endings as the imperfect, but on the aorist stem."),
  fin("lyo-perf", "Perfect indicative: λύω", 26, "Verbs: indicative", "λύω", { tense: "R", mood: "I" }, AMP, [
    "λέλυκα λέλυμαι", "λέλυκας λέλυσαι", "λέλυκε(ν) λέλυται", "λελύκαμεν λελύμεθα", "λελύκατε λέλυσθε", "λελύκασι(ν)/λέλυκαν λέλυνται"]),

  // ---------- Contract & μι verbs ----------
  fin("contract-act", "Contract verbs: present active", 18, "Verbs: contract & μι", "ἀγαπάω", { tense: "P", voice: "A", mood: "I" },
    [{ label: "ἀγαπάω", lemma: "ἀγαπάω", parse: {} }, { label: "ποιέω", lemma: "ποιέω", parse: {} }, { label: "πληρόω", lemma: "πληρόω", parse: {} }], [
    "ἀγαπῶ ποιῶ πληρῶ", "ἀγαπᾷς ποιεῖς πληροῖς", "ἀγαπᾷ ποιεῖ πληροῖ",
    "ἀγαπῶμεν ποιοῦμεν πληροῦμεν", "ἀγαπᾶτε ποιεῖτε πληροῦτε", "ἀγαπῶσι(ν) ποιοῦσι(ν) πληροῦσι(ν)"]),
  fin("contract-mp", "Contract verbs: present middle/passive", 19, "Verbs: contract & μι", "ἀγαπάω", { tense: "P", voice: "MP", mood: "I" },
    [{ label: "ἀγαπάω", lemma: "ἀγαπάω", parse: {} }, { label: "ποιέω", lemma: "ποιέω", parse: {} }, { label: "πληρόω", lemma: "πληρόω", parse: {} }], [
    "ἀγαπῶμαι ποιοῦμαι πληροῦμαι", "ἀγαπᾷ ποιῇ πληροῖ", "ἀγαπᾶται ποιεῖται πληροῦται",
    "ἀγαπώμεθα ποιούμεθα πληρούμεθα", "ἀγαπᾶσθε ποιεῖσθε πληροῦσθε", "ἀγαπῶνται ποιοῦνται πληροῦνται"]),
  fin("mi-pres", "μι verbs: present active", 34, "Verbs: contract & μι", "δίδωμι", { tense: "P", voice: "A", mood: "I" },
    [{ label: "δίδωμι", lemma: "δίδωμι", parse: {} }, { label: "τίθημι", lemma: "τίθημι", parse: {} }, { label: "ἵστημι", lemma: "ἵστημι", parse: {} }], [
    "δίδωμι τίθημι ἵστημι", "δίδως τίθης ἵστης", "δίδωσι(ν) τίθησι(ν) ἵστησι(ν)",
    "δίδομεν τίθεμεν ἵσταμεν", "δίδοτε τίθετε ἵστατε", "διδόασι(ν) τιθέασι(ν) ἱστᾶσι(ν)"]),
  fin("mi-aor", "μι verbs: aorist active", 34, "Verbs: contract & μι", "δίδωμι", { tense: "A", voice: "A", mood: "I" },
    [{ label: "δίδωμι", lemma: "δίδωμι", parse: {} }, { label: "τίθημι", lemma: "τίθημι", parse: {} }, { label: "ἵστημι (2nd aor.)", lemma: "ἵστημι", parse: {} }], [
    "ἔδωκα ἔθηκα ἔστην", "ἔδωκας ἔθηκας ἔστης", "ἔδωκε(ν) ἔθηκε(ν) ἔστη",
    "ἐδώκαμεν ἐθήκαμεν ἔστημεν", "ἐδώκατε ἐθήκατε ἔστητε", "ἔδωκαν ἔθηκαν ἔστησαν"]),

  // ---------- Subjunctive, imperative, infinitive ----------
  fin("lyo-subj", "Subjunctive: λύω", 31, "Verbs: other moods", "λύω", { mood: "S" },
    [{ label: "Present act.", parse: { tense: "P", voice: "A" } }, { label: "Present mid/pass.", parse: { tense: "P", voice: "MP" } },
     { label: "Aorist act.", parse: { tense: "A", voice: "A" } }, { label: "Aorist pass.", parse: { tense: "A", voice: "P" } }], [
    "λύω λύωμαι λύσω λυθῶ", "λύῃς λύῃ λύσῃς λυθῇς", "λύῃ λύηται λύσῃ λυθῇ",
    "λύωμεν λυώμεθα λύσωμεν λυθῶμεν", "λύητε λύησθε λύσητε λυθῆτε", "λύωσι(ν) λύωνται λύσωσι(ν) λυθῶσι(ν)"],
    "Lengthened connecting vowel (ω/η) is the subjunctive's sign."),
  { id: "lyo-impv", title: "Imperative: λύω", ch: 33, group: "Verbs: other moods", lemma: "λύω", layout: "imp4", parse: { pos: "verb", mood: "M" },
    cols: [{ label: "Present act.", parse: { tense: "P", voice: "A" } }, { label: "Present mid/pass.", parse: { tense: "P", voice: "MP" } },
      { label: "Aorist act.", parse: { tense: "A", voice: "A" } }, { label: "Aorist mid.", parse: { tense: "A", voice: "M" } }, { label: "Aorist pass.", parse: { tense: "A", voice: "P" } }],
    cells: ["λῦε λύου λῦσον λῦσαι λύθητι", "λυέτω λυέσθω λυσάτω λυσάσθω λυθήτω", "λύετε λύεσθε λύσατε λύσασθε λύθητε", "λυέτωσαν λυέσθωσαν λυσάτωσαν λυσάσθωσαν λυθήτωσαν"] },
  { id: "lyo-inf", title: "Infinitives: λύω", ch: 32, group: "Verbs: other moods", lemma: "λύω", layout: "custom", parse: { pos: "verb", mood: "N" },
    rows: [{ label: "Present", parse: { tense: "P" } }, { label: "Future", parse: { tense: "F" } }, { label: "Aorist", parse: { tense: "A" } }, { label: "Perfect", parse: { tense: "R" } }],
    cols: [{ label: "Active", parse: { voice: "A" } }, { label: "Middle", parse: { voice: "M" } }, { label: "Passive", parse: { voice: "P" } }],
    cells: ["λύειν λύεσθαι λύεσθαι", "λύσειν λύσεσθαι λυθήσεσθαι", "λῦσαι λύσασθαι λυθῆναι", "λελυκέναι λελύσθαι λελύσθαι"] },

  // ---------- Participles ----------
  ptc("ptc-pres-act", "Present active participle: λύων", 28, { tense: "P", voice: "A" }, [
    "λύων λύουσα λῦον", "λύοντος λυούσης λύοντος", "λύοντι λυούσῃ λύοντι", "λύοντα λύουσαν λῦον",
    "λύοντες λύουσαι λύοντα", "λυόντων λυουσῶν λυόντων", "λύουσι(ν) λυούσαις λύουσι(ν)", "λύοντας λυούσας λύοντα"]),
  ptc("ptc-pres-mp", "Present middle/passive participle: λυόμενος", 28, { tense: "P", voice: "MP" }, [
    "λυόμενος λυομένη λυόμενον", "λυομένου λυομένης λυομένου", "λυομένῳ λυομένῃ λυομένῳ", "λυόμενον λυομένην λυόμενον",
    "λυόμενοι λυόμεναι λυόμενα", "λυομένων λυομένων λυομένων", "λυομένοις λυομέναις λυομένοις", "λυομένους λυομένας λυόμενα"]),
  ptc("ptc-aor-act", "Aorist active participle: λύσας", 29, { tense: "A", voice: "A" }, [
    "λύσας λύσασα λῦσαν", "λύσαντος λυσάσης λύσαντος", "λύσαντι λυσάσῃ λύσαντι", "λύσαντα λύσασαν λῦσαν",
    "λύσαντες λύσασαι λύσαντα", "λυσάντων λυσασῶν λυσάντων", "λύσασι(ν) λυσάσαις λύσασι(ν)", "λύσαντας λυσάσας λύσαντα"]),
  ptc("ptc-aor-pass", "Aorist passive participle: λυθείς", 29, { tense: "A", voice: "P" }, [
    "λυθείς λυθεῖσα λυθέν", "λυθέντος λυθείσης λυθέντος", "λυθέντι λυθείσῃ λυθέντι", "λυθέντα λυθεῖσαν λυθέν",
    "λυθέντες λυθεῖσαι λυθέντα", "λυθέντων λυθεισῶν λυθέντων", "λυθεῖσι(ν) λυθείσαις λυθεῖσι(ν)", "λυθέντας λυθείσας λυθέντα"]),
  ptc("ptc-perf-act", "Perfect active participle: λελυκώς", 30, { tense: "R", voice: "A" }, [
    "λελυκώς λελυκυῖα λελυκός", "λελυκότος λελυκυίας λελυκότος", "λελυκότι λελυκυίᾳ λελυκότι", "λελυκότα λελυκυῖαν λελυκός",
    "λελυκότες λελυκυῖαι λελυκότα", "λελυκότων λελυκυιῶν λελυκότων", "λελυκόσι(ν) λελυκυίαις λελυκόσι(ν)", "λελυκότας λελυκυίας λελυκότα"]),
];

// Pronoun subtypes (used for chapter filtering and categories).
const PTYPE = { "pron-ego": "pers", "pron-su": "pers", "pron-autos": "autos", "pron-houtos": "dem", "pron-ekeinos": "dem", "pron-hos": "rel", "pron-tis": "int" };
for (const p of PARADIGMS) if (PTYPE[p.id]) p.parse.ptype = PTYPE[p.id];
for (const id of ["aor2"]) paradigm_(id).parse.second = true;
paradigm_("mi-aor").parse.mi = true;
function paradigm_(id) { return PARADIGMS.find((p) => p.id === id); }

export const GROUPS = ["Article", "Nouns", "Adjectives", "Pronouns", "εἰμί", "Verbs: indicative", "Verbs: contract & μι", "Verbs: other moods", "Participles"];

/** Rows for a table. */
export function rowsOf(t) { return t.layout === "custom" ? t.rows : LAYOUTS[t.layout]; }

/** Each cell as { r, c, display, variants[], parses[], lemma } */
export function cellsOf(t) {
  const rows = rowsOf(t);
  const out = [];
  t.cells.forEach((line, r) => {
    const parts = line.trim().split(/\s+/);
    parts.forEach((txt, c) => {
      const col = t.cols[c] || {};
      const base = { ...t.parse, ...rows[r].parse, ...col.parse };
      const parses = base.voice === "MP" ? [{ ...base, voice: "M" }, { ...base, voice: "P" }] : [base];
      out.push({ table: t, r, c, display: txt, variants: expandVariants(txt), parses, lemma: col.lemma || t.lemma });
    });
  });
  return out;
}

/** "ἐστί(ν)" -> ["ἐστί","ἐστίν"]; "ἐμοῦ/μου" -> both */
export function expandVariants(txt) {
  const out = [];
  for (const alt of txt.split("/")) {
    if (alt.includes("(ν)")) { out.push(alt.replace("(ν)", ""), alt.replace("(ν)", "ν")); }
    else out.push(alt);
  }
  return out;
}

export const paradigm = (id) => PARADIGMS.find((p) => p.id === id);
