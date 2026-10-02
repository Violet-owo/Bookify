// English Lexicon & Literary Writing Assistant Engine for Bookify
// High-performance, offline-capable typo and narrative slip detection for English literature.

export const COMMON_ENGLISH_TYPOS = {
  'teh': 'the',
  'hte': 'the',
  'recieve': 'receive',
  'recieved': 'received',
  'recieving': 'receiving',
  'seperate': 'separate',
  'seperated': 'separated',
  'definately': 'definitely',
  'occured': 'occurred',
  'occuring': 'occurring',
  'untill': 'until',
  'wierd': 'weird',
  'alot': 'a lot',
  'becuase': 'because',
  'beleive': 'believe',
  'beleived': 'believed',
  'tounge': 'tongue',
  'goverment': 'government',
  'thier': 'their',
  'wich': 'which',
  'truely': 'truly',
  'comming': 'coming',
  'unforunately': 'unfortunately',
  'appologize': 'apologize',
  'neccessary': 'necessary',
  'accross': 'across',
  'writting': 'writing',
  'succesful': 'successful',
  'embarass': 'embarrass',
  'embarassed': 'embarrassed',
  'dont': "don't",
  'didnt': "didn't",
  'cant': "can't",
  'wont': "won't",
  'isnt': "isn't",
  'wasnt': "wasn't",
  'couldnt': "couldn't",
  'wouldnt': "wouldn't",
  'shouldnt': "shouldn't",
  'youre': "you're",
  'theyre': "they're"
};

export function analyzeEnglishOrthography(text) {
  if (!text || typeof text !== 'string') return [];
  const suggestions = [];

  // 1. Direct Typo Lookup
  const words = text.split(/\b/);
  words.forEach(w => {
    const clean = w.trim().toLowerCase();
    if (COMMON_ENGLISH_TYPOS[clean]) {
      const isCapital = /^[A-Z]/.test(w);
      const fix = COMMON_ENGLISH_TYPOS[clean];
      const capitalizedFix = isCapital ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix;
      suggestions.push({
        id: `en-typo-${Date.now()}-${w}`,
        original: w,
        suggestion: capitalizedFix,
        reason: `Common English typo: "${w}" should be written as "${capitalizedFix}".`,
        type: 'orthography'
      });
    }
  });

  // 2. Filter words / Show Don't Tell
  const filterPhrases = [
    { pattern: /\b(saw that|noticed that|spotted that)\b/gi, tip: 'Visual filter: remove the sensory mediator to immerse the reader directly in the scene.' },
    { pattern: /\b(felt that|felt a sense of|felt like)\b/gi, tip: 'Emotional filter: show visceral bodily reactions rather than abstract feelings.' },
    { pattern: /\b(seemed like|seemed to be|appeared to be)\b/gi, tip: 'Weakened narration: use direct, confident phrasing.' },
    { pattern: /\b(heard the sound of)\b/gi, tip: 'Sensory filter: name the sound directly (e.g. "a floorboard creaked" instead of "heard the sound of a floorboard").' }
  ];

  filterPhrases.forEach(fp => {
    let match;
    while ((match = fp.pattern.exec(text)) !== null) {
      suggestions.push({
        id: `en-sdt-${Date.now()}-${match.index}`,
        original: match[0],
        suggestion: '',
        reason: fp.tip,
        type: 'show_dont_tell'
      });
    }
  });

  // 3. Consecutive duplicates (e.g., "the the")
  const repeatMatch = text.match(/\b([a-zA-Z]+)\s+\1\b/i);
  if (repeatMatch && repeatMatch[1].length > 1) {
    suggestions.push({
      id: `en-rep-${Date.now()}`,
      original: repeatMatch[0],
      suggestion: repeatMatch[1],
      reason: `Accidental consecutive repeated word ("${repeatMatch[1]}").`,
      type: 'orthography'
    });
  }

  return suggestions;
}
