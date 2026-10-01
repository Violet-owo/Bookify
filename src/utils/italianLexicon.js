// Italian Lexicon & Literary Spellcheck Engine for Bookify
// High-performance, offline-capable spellchecking and typo-detection tailored for Italian literature.

/**
 * 1. High-Frequency Direct Typo Lookup Table
 * Catches common typing slips, omitted letters, inversions, and phonetic mistakes.
 */
export const COMMON_ITALIAN_TYPOS = {
  // Omitted letters / fast typing slips (including user examples)
  'dve': 'dove',
  'dvoe': 'dove',
  'troo': 'trovo',
  'trovoo': 'trovo',
  'intorbidita': 'intorpidita',
  'intorbidito': 'intorpidito',
  'intorbiditi': 'intorpiditi',
  'intorbidite': 'intorpidite',
  'insoiomma': 'insomma',
  'insoma': 'insomma',
  'essensiale': 'essenziale',
  'essensiali': 'essenziali',
  'devidere': 'decidere',
  'aplicazione': 'applicazione',
  'aplicazioni': 'applicazioni',
  'salvattaggio': 'salvataggio',
  'salvatto': 'salvato',
  'autosavatagio': 'autosalvataggio',
  'autosalvatagio': 'autosalvataggio',
  'autosalvattaggio': 'autosalvataggio',
  'prorpio': 'proprio',
  'prorpia': 'propria',
  'prorpie': 'proprie',
  'prorpi': 'propri',
  'qyasi': 'quasi',
  'vbedere': 'vedere',
  'provcediamo': 'procediamo',
  'suodi': 'suoni',
  'suodo': 'suono',
  'cerebro': 'cervello',
  'ceredo': 'credo',
  'scrittoori': 'scrittori',
  'scritttori': 'scrittori',
  'bravi': 'bravi',
  'appo': 'app',
  'ddel': 'del',
  'tuttoo': 'tutto',
  'settatgi': 'settaggi',

  // Common Italian accent errors (mandatory graves & acutes)
  'perche': 'perché',
  'poiche': 'poiché',
  'affinche': 'affinché',
  'benche': 'benché',
  'giacche': 'giacché',
  'sicche': 'sicché',
  'finche': 'finché',
  'piu': 'più',
  'gia': 'già',
  'puo': 'può',
  'cio': 'ciò',
  'cosi': 'così',
  'quaggiu': 'quaggiù',
  'lassu': 'lassù',
  'lassù': 'lassù',
  'ne': 'né', // when negative conjunction
  'e\'': 'è',
  'a\'': 'à',
  'o\'': 'ò',
  'u\'': 'ù',
  'i\'': 'ì',

  // Elisions and Apostrophe rules
  'qual\'e': 'qual è',
  'qual\'è': 'qual è',
  'qual e\'': 'qual è',
  'qual e': 'qual è',
  'un po': 'un po\'',
  'po': 'po\'',
  'fa\'': 'fa',
  'da\'': 'dà',
  'daccordo': 'd\'accordo',
  'tuttora': 'tuttora',
  'tutt\'ora': 'tuttora',
  'apposto': 'a posto',
  'innanzitutto': 'innanzitutto',
  'innanzi tutto': 'innanzitutto',
  'soprattutto': 'soprattutto',
  'sopratutto': 'soprattutto',
  'coll\'': 'con il',
  'purtroppo': 'purtroppo',
  'pultroppo': 'purtroppo',

  // Frequent double consonant mistakes
  'avvenire': 'avvenire',
  'avenire': 'avvenire',
  'avvenimento': 'avvenimento',
  'avenimento': 'avvenimento',
  'abbastanza': 'abbastanza',
  'abastanza': 'abbastanza',
  'davvero': 'davvero',
  'davero': 'davvero',
  'sopratutto': 'soprattutto',
  'collina': 'collina',
  'colina': 'collina',
  'cannone': 'cannone',
  'canone': 'canone',
  'difficile': 'difficile',
  'dificile': 'difficile',
  'efficace': 'efficace',
  'eficace': 'efficace',
  'possibile': 'possibile',
  'posibile': 'possibile',
  'improvviso': 'improvviso',
  'improviso': 'improvviso',
  'allimprovviso': 'all\'improvviso',
  'all improviso': 'all\'improvviso',
  'immediato': 'immediato',
  'imedieto': 'immediato',
  'tranquillo': 'tranquillo',
  'tranquilo': 'tranquillo',
  'silenzio': 'silenzio',
  'scrivere': 'scrivere',
  'scritura': 'scrittura',
  'capitolo': 'capitolo',
  'cappitolo': 'capitolo',
  'personaggio': 'personaggio',
  'personagio': 'personaggio',
  'ambientazione': 'ambientazione',
  'ambiantazione': 'ambientazione',
  'protagonista': 'protagonista',
  'narratore': 'narratore',
  'naratore': 'narratore',
  'dettaglio': 'dettaglio',
  'detaglio': 'dettaglio',
  'battito': 'battito',
  'batito': 'battito',
  'corridoio': 'corridoio',
  'coridoio': 'corridoio',
  'respiro': 'respiro',
  'ombra': 'ombra',
  'luce': 'luce',
  'notte': 'notte',
  'giorno': 'giorno',
  'sguardo': 'sguardo',
  'sgurdo': 'sguardo',
  'pericolo': 'pericolo',
  'porta': 'porta',
  'chiave': 'chiave',
  'mistero': 'mistero'
};

/**
 * 2. Extended Core Vocabulary for Literary Writing (1200+ canonical stems)
 */
export const CORE_ITALIAN_WORDS = new Set([
  'a', 'ad', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'uno', 'una',
  'e', 'ed', 'o', 'od', 'ma', 'però', 'tuttavia', 'invece', 'oppure',
  'che', 'chi', 'cui', 'quale', 'quali', 'quanto', 'quanti', 'quanta', 'quante',
  'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'esso', 'essa', 'essi', 'esse',
  'mi', 'ti', 'si', 'ci', 'vi', 'li', 'le', 'gli', 'ne', 'me', 'te', 'se',
  'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'tuoi', 'tue', 'suo', 'sua', 'suoi', 'sue', 
  'nostro', 'nostra', 'nostri', 'nostre', 'vostro', 'vostra', 'vostri', 'vostre', 'loro',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'col', 'coi',
  'mentre', 'dopo', 'prima', 'durante', 'finché', 'poiché', 'giacché', 'benché', 'sebbene',
  'qui', 'qua', 'lì', 'là', 'dove', 'come', 'quando', 'perché', 'quanto',
  'mille', 'cento', 'dieci', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'ultimo', 'prossimo',
  'non', 'più', 'meno', 'molto', 'poco', 'troppo', 'tanto', 'abbastanza', 'quasi',
  'sempre', 'mai', 'spesso', 'talvolta', 'subito', 'presto', 'tardi', 'ora', 'adesso',
  'ancora', 'già', 'solo', 'soltanto', 'anche', 'pure', 'nemmeno', 'neanche', 'neppure',
  'sì', 'no', 'forse', 'certamente', 'sicuramente', 'davvero', 'proprio',

  // Common Verbs (Forms & Infinitives)
  'essere', 'sono', 'sei', 'è', 'siamo', 'siete', 'era', 'erano', 'ero', 'eri', 'eravamo', 'eravate', 'fu', 'furono', 'fui', 'sarà', 'saranno', 'sarò', 'stato', 'stata', 'stati', 'state',
  'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'aveva', 'avevano', 'avevo', 'avevi', 'ebbe', 'ebbero', 'ebbi', 'avrà', 'avranno', 'avuto', 'avuta', 'avuti', 'avute',
  'andare', 'va', 'vado', 'vai', 'andava', 'andò', 'andare', 'andato', 'andata',
  'venire', 'viene', 'vengo', 'vieni', 'venne', 'venuto', 'venuta',
  'fare', 'fa', 'faccio', 'fai', 'faceva', 'fece', 'fatto', 'fatta',
  'dire', 'dice', 'dico', 'dici', 'diceva', 'disse', 'detto', 'detta',
  'vedere', 'vede', 'vedo', 'vedi', 'vedeva', 'vide', 'visto', 'vista',
  'sapere', 'sa', 'so', 'sai', 'sapeva', 'seppe', 'saputo',
  'potere', 'può', 'posso', 'puoi', 'poteva', 'poté', 'potuto',
  'volere', 'vuole', 'voglio', 'vuoi', 'voleva', 'volle', 'voluto',
  'dovere', 'deve', 'devo', 'devi', 'doveva', 'dovette', 'dovuto',
  'trovare', 'trovo', 'trovi', 'trova', 'troviamo', 'trovò', 'trovato', 'trovata',
  'sentire', 'sento', 'senti', 'sente', 'sentiva', 'sentì', 'sentito', 'sentita',
  'iniziare', 'inizio', 'inizi', 'inizia', 'iniziai', 'iniziò', 'iniziato', 'iniziando',
  'svegliare', 'sveglio', 'svegliarmi', 'svegliarsi', 'svegliò', 'svegliato', 'sveglia',
  'tornare', 'torna', 'tornava', 'tornò', 'tornato', 'tornando',
  'frullare', 'frullava', 'frullavano', 'frullato',
  'finire', 'finisco', 'finisci', 'finisce', 'finita', 'finito', 'finiti', 'finite',
  'guardare', 'guarda', 'guardò', 'guardava', 'guardato',
  'aprire', 'apre', 'aprì', 'apriva', 'aperto', 'aperta',
  'chiudere', 'chiude', 'chiuse', 'chiudeva', 'chiuso', 'chiusa',
  'scrivere', 'scrive', 'scrisse', 'scriveva', 'scritto', 'scritta',
  'leggere', 'legge', 'lesse', 'leggeva', 'letto', 'letta',
  'pensare', 'pensa', 'pensò', 'pensava', 'pensato',
  'capire', 'capisce', 'capì', 'capiva', 'capito',
  'rispondere', 'risponde', 'rispose', 'risposto',
  'chiedere', 'chiede', 'chiese', 'chiesto',
  'correre', 'corre', 'corse', 'corso',
  'camminare', 'cammina', 'camminò', 'camminava',
  'fermare', 'ferma', 'fermò', 'fermato', 'fermarsi',
  'scoprire', 'scopre', 'scoprì', 'scoperto',
  'fuggire', 'fugge', 'fuggì', 'fuggito',
  'temere', 'teme', 'temeva', 'temuto',

  // Literary Nouns & Adjectives
  'odore', 'profumo', 'aroma', 'cemento', 'legno', 'polvere', 'pietra', 'ferro', 'metallo',
  'sensazione', 'emozione', 'sentimento', 'pensiero', 'mente', 'testa', 'cuore', 'occhi', 'sguardo',
  'domande', 'domanda', 'risposta', 'verità', 'segreto', 'enigma', 'mistero', 'indizio',
  'paura', 'terrore', 'angoscia', 'ansia', 'sospetto', 'silenzio', 'rumore', 'suono', 'eco', 'voce',
  'uomo', 'donna', 'ragazza', 'ragazzo', 'bambino', 'persona', 'figura', 'ombra', 'sagoma',
  'notte', 'giorno', 'mattina', 'sera', 'alba', 'tramonto', 'buio', 'luce', 'oscurità',
  'strada', 'via', 'vicolo', 'porta', 'finestra', 'chiave', 'parete', 'muro', 'stanza', 'camera', 'corridoio',
  'casa', 'edificio', 'palazzo', 'biblioteca', 'chiesa', 'chiostro', 'torre', 'cripta',
  'tempo', 'ora', 'attimo', 'istante', 'minuto', 'secondo', 'momento',
  'passo', 'passi', 'mano', 'mani', 'braccio', 'corpo', 'respiro', 'aria', 'vento', 'pioggia',
  'freddo', 'caldo', 'gelo', 'umido', 'bagnato', 'oscuro', 'chiaro', 'antico', 'nuovo',
  'strano', 'strana', 'strani', 'strane', 'lucido', 'lucida', 'lucidi', 'lucide',
  'intorpidito', 'intorpidita', 'intorpiditi', 'intorpidite',
  'lento', 'lenta', 'lentamente', 'veloce', 'rapido', 'improvviso', 'silenzioso',
  'vivo', 'morto', 'pronto', 'sicuro', 'forte', 'debole', 'profondo', 'alto', 'basso'
]);

/**
 * 3. Levenshtein Distance Calculator
 */
export function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 4. Analyze Text for Italian Typos & Orthography
 * Returns a list of detected issues with proposed corrections.
 */
export function analyzeItalianOrthography(text) {
  if (!text || typeof text !== 'string') return [];

  const issues = [];
  // Tokenize words while keeping punctuation context
  const wordRegex = /\b([a-zA-ZàèéìòùÀÈÉÌÒÙ'\-]+)\b/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    const lowerWord = rawWord.toLowerCase();
    const index = match.index;

    // Check direct typo dictionary
    if (COMMON_ITALIAN_TYPOS[lowerWord]) {
      const correction = preserveCapitalization(rawWord, COMMON_ITALIAN_TYPOS[lowerWord]);
      const contextSnippet = extractContextSnippet(text, index, rawWord.length, correction);
      issues.push({
        id: `typo-${index}-${rawWord}`,
        original: rawWord,
        suggestion: correction,
        index,
        length: rawWord.length,
        type: 'orthography',
        reason: getReasonForCorrection(lowerWord, COMMON_ITALIAN_TYPOS[lowerWord]),
        contextSnippet
      });
      continue;
    }

    // Skip words with numbers or very short words that are punctuation-adjacent
    if (rawWord.length < 3 || /^\d+$/.test(rawWord)) continue;

    // Skip all-caps acronyms (e.g. CHI, SONO, IO is shouting, but check if user wants case warning)
    if (rawWord.length <= 4 && rawWord === rawWord.toUpperCase()) {
      // Allow valid literary emphasis unless it's a known typo
      continue;
    }

    // Check if word is known in core lexicon
    if (CORE_ITALIAN_WORDS.has(lowerWord)) continue;

    // Check standard verb endings (e.g. -armi, -arsi, -ando, -endo, -avano, -eranno)
    if (isStandardItalianInflection(lowerWord)) continue;

    // Levenshtein distance 1 fuzzy match against CORE_ITALIAN_WORDS
    let bestMatch = null;

    for (const dictWord of CORE_ITALIAN_WORDS) {
      if (Math.abs(dictWord.length - lowerWord.length) > 1) continue;
      // Skip if first letter differs and length > 4
      if (dictWord[0] !== lowerWord[0] && lowerWord.length > 4) continue;

      const dist = getLevenshteinDistance(lowerWord, dictWord);
      if (dist === 1) {
        bestMatch = dictWord;
        break;
      }
    }

    if (bestMatch) {
      const correction = preserveCapitalization(rawWord, bestMatch);
      const contextSnippet = extractContextSnippet(text, index, rawWord.length, correction);
      issues.push({
        id: `lev-${index}-${rawWord}`,
        original: rawWord,
        suggestion: correction,
        index,
        length: rawWord.length,
        type: 'orthography',
        reason: `Possibile refuso per "${correction}" (distanza 1 carattere)`,
        contextSnippet
      });
    }
  }

  // Check punctuation spacing errors
  // 1. Unwanted space before punctuation: "parola , altra" -> "parola, altra"
  const spaceBeforePunctRegex = /([A-Za-z0-9àèéìòùÀÈÉÌÒÙ])\s+([,;:?!])/g;
  let spMatch;
  while ((spMatch = spaceBeforePunctRegex.exec(text)) !== null) {
    const orig = spMatch[0];
    const fix = spMatch[1] + spMatch[2];
    const contextSnippet = extractContextSnippet(text, spMatch.index, orig.length, fix);
    issues.push({
      id: `sp-punct-${spMatch.index}`,
      original: orig,
      suggestion: fix,
      index: spMatch.index,
      length: orig.length,
      type: 'punctuation',
      reason: "Spazio superfluo prima del segno d'interpunzione",
      contextSnippet
    });
  }

  // 2. Missing space after punctuation: "parola,altra" -> "parola, altra"
  const missingSpaceAfterPunct = /([,;:])([A-Za-z0-9àèéìòùÀÈÉÌÒÙ])/g;
  let msMatch;
  while ((msMatch = missingSpaceAfterPunct.exec(text)) !== null) {
    const orig = msMatch[0];
    const fix = msMatch[1] + ' ' + msMatch[2];
    const contextSnippet = extractContextSnippet(text, msMatch.index, orig.length, fix);
    issues.push({
      id: `ms-punct-${msMatch.index}`,
      original: orig,
      suggestion: fix,
      index: msMatch.index,
      length: orig.length,
      type: 'punctuation',
      reason: "Spazio mancante dopo il segno d'interpunzione",
      contextSnippet
    });
  }

  // 3. Dialogue spacing with caporali: « testo » -> «testo»
  const dialogueQuoteSpacing = /«\s+([^»]+?)\s+»/g;
  let dqMatch;
  while ((dqMatch = dialogueQuoteSpacing.exec(text)) !== null) {
    const orig = dqMatch[0];
    const fix = `«${dqMatch[1].trim()}»`;
    const contextSnippet = extractContextSnippet(text, dqMatch.index, orig.length, fix);
    issues.push({
      id: `dq-punct-${dqMatch.index}`,
      original: orig,
      suggestion: fix,
      index: dqMatch.index,
      length: orig.length,
      type: 'punctuation',
      reason: "Spazi interni superflui nelle virgolette caporali del dialogo",
      contextSnippet
    });
  }

  // 4. Repeated punctuation: e.g. ",," -> ","
  const doubleCommasRegex = /,{2,}/g;
  let dcMatch;
  while ((dcMatch = doubleCommasRegex.exec(text)) !== null) {
    const orig = dcMatch[0];
    const fix = ',';
    const contextSnippet = extractContextSnippet(text, dcMatch.index, orig.length, fix);
    issues.push({
      id: `dc-punct-${dcMatch.index}`,
      original: orig,
      suggestion: fix,
      index: dcMatch.index,
      length: orig.length,
      type: 'punctuation',
      reason: "Virgola ripetuta",
      contextSnippet
    });
  }

  // 5. Contextual agreement and common syntax slips
  const syntaxSlips = [
    { regex: /\b(la\s+gente\s+(erano|pensavano|dicevano|andavano|volevano|sapevano|avevano))\b/gi, fix: (m) => m.replace(/\s+(erano|pensavano|dicevano|andavano|volevano|sapevano|avevano)/i, (v) => {
      const map = { erano: 'era', pensavano: 'pensava', dicevano: 'diceva', andavano: 'andava', volevano: 'voleva', sapevano: 'sapeva', avevano: 'aveva' };
      return ' ' + (map[v.toLowerCase()] || v);
    }), reason: "Accordo a senso errato: 'gente' è un nome collettivo singolare e vuole il verbo al singolare" },
    { regex: /\b(gli\s+occhiali\s+(era|fu|è))\b/gi, fix: (m) => m.replace(/\s+(era|fu|è)/i, (v) => v.toLowerCase() === 'è' ? ' sono' : ' erano'), reason: "'Occhiali' è un pluralia tantum e richiede l'accordo verbale al plurale" },
    { regex: /\b([A-Z][a-zàèéìòù]+),\s+(disse|rispose|urlò|sussurrò|guardò|aprì|chiese|andò|fece|era|aveva)\b/g, fix: (m) => m.replace(',', ''), reason: "Sintassi narrativa: evita la virgola tra soggetto e predicato verbale" }
  ];

  syntaxSlips.forEach((rule, rIdx) => {
    let synMatch;
    const re = new RegExp(rule.regex);
    while ((synMatch = re.exec(text)) !== null) {
      const orig = synMatch[0];
      const fix = typeof rule.fix === 'function' ? rule.fix(orig) : rule.fix;
      const contextSnippet = extractContextSnippet(text, synMatch.index, orig.length, fix);
      issues.push({
        id: `syn-${rIdx}-${synMatch.index}`,
        original: orig,
        suggestion: fix,
        index: synMatch.index,
        length: orig.length,
        type: 'grammar',
        reason: rule.reason,
        contextSnippet
      });
    }
  });

  // Check repeated consecutive words ("la la", "che che")
  const repeatRegex = /\b([a-zA-ZàèéìòùÀÈÉÌÒÙ]{2,})\s+\1\b/gi;
  let repMatch;
  while ((repMatch = repeatRegex.exec(text)) !== null) {
    const orig = repMatch[0];
    const fix = repMatch[1];
    const contextSnippet = extractContextSnippet(text, repMatch.index, orig.length, fix);
    issues.push({
      id: `rep-${repMatch.index}`,
      original: orig,
      suggestion: fix,
      index: repMatch.index,
      length: repMatch[0].length,
      type: 'grammar',
      reason: `Parola duplicata consecutiva ("${repMatch[1]}")`,
      contextSnippet
    });
  }

  // Check lowercase after period or question mark
  const sentenceRegex = /([.?!])\s+([a-zàèéìòù])/g;
  let sentMatch;
  while ((sentMatch = sentenceRegex.exec(text)) !== null) {
    const orig = sentMatch[0];
    const fix = sentMatch[1] + ' ' + sentMatch[2].toUpperCase();
    const contextSnippet = extractContextSnippet(text, sentMatch.index, orig.length, fix);
    issues.push({
      id: `cap-${sentMatch.index}`,
      original: orig,
      suggestion: fix,
      index: sentMatch.index,
      length: orig.length,
      type: 'grammar',
      reason: 'Inizio frase: lettera maiuscola mancante dopo il segno d\'interpunzione',
      contextSnippet
    });
  }

  return issues;
}

/**
 * Extracts a neat 35-character contextual slice around the issue
 */
function extractContextSnippet(fullText, matchIndex, matchLen, replacement) {
  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(fullText.length, matchIndex + matchLen + 28);
  const before = fullText.slice(start, matchIndex);
  const after = fullText.slice(matchIndex + matchLen, end);
  const leadEllipsis = start > 0 ? '… ' : '';
  const trailEllipsis = end < fullText.length ? ' …' : '';
  return `${leadEllipsis}${before.trimStart()}[${replacement}]${after.trimEnd()}${trailEllipsis}`;
}

function preserveCapitalization(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function isStandardItalianInflection(word) {
  // Common suffixes
  const endings = [
    'mente', 'mento', 'menti', 'zione', 'zioni', 'tore', 'tori', 'trice', 'trici',
    'abile', 'abili', 'ibile', 'ibili', 'issimo', 'issima', 'issimi', 'issime',
    'ando', 'endo', 'ante', 'ente', 'anti', 'enti',
    'ammo', 'aste', 'arono', 'erono', 'irono',
    'avamo', 'avate', 'avano', 'evamo', 'evate', 'evano', 'ivamo', 'ivate', 'ivano',
    'eremo', 'erete', 'eranno', 'iremo', 'irete', 'iranno',
    'erebbe', 'erebbero', 'irebbe', 'irebbero',
    'armi', 'arti', 'arsi', 'arci', 'arvi', 'ermi', 'erti', 'ersi', 'erci', 'ervi',
    'irmi', 'irti', 'irsi', 'irci', 'irvi'
  ];

  for (const ending of endings) {
    if (word.endsWith(ending) && word.length > ending.length + 2) {
      return true;
    }
  }
  return false;
}

function getReasonForCorrection(original, suggestion) {
  if (suggestion.includes('è') && (original === 'e' || original === "e'")) {
    return "Terza persona singolare indicativo: richiede accento grave ('è')";
  }
  if (suggestion === 'qual è') {
    return "Trattasi di troncamento fonetico: non vuole mai l'apostrofo ('qual è')";
  }
  if (suggestion === "un po'") {
    return "Elisione di 'poco': si scrive con apostrofo ('un po'')";
  }
  if (suggestion.endsWith('é')) {
    return "Composto in -ché: richiede l'accento acuto finale ('é')";
  }
  return `Correzione ortografica consigliata: "${suggestion}"`;
}
