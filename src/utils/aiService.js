import { analyzeItalianOrthography } from './italianLexicon';

/**
 * 1. Live Chunk Checking (Subtle Inline Assistance)
 * Evaluates the recent paragraph against spelling, bestseller pacing & Italian narrative rules.
 */
export async function checkTextChunk({ recentText, contextWindow = '', settings = {} }) {
  if (!recentText || recentText.trim().length < 4) {
    return [];
  }

  // Always compute immediate, high-accuracy Italian orthography & typo checks
  const localTypos = analyzeItalianOrthography(recentText);

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  let remoteSuggestions = [];
  // Gemini API
  if (aiProvider === 'gemini' && geminiApiKey) {
    try {
      remoteSuggestions = await checkChunkWithGemini({ recentText, contextWindow, apiKey: geminiApiKey, model: geminiModel });
    } catch (err) {
      console.warn('Gemini chunk check failed, using local companion:', err);
    }
  } 
  // OpenAI / Ollama API
  else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
    try {
      const endpoint = aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint;
      const model = aiProvider === 'ollama' ? ollamaModel : openaiModel;
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      remoteSuggestions = await checkChunkWithOpenAICompatible({ recentText, contextWindow, endpoint, model, apiKey: key });
    } catch (err) {
      console.warn('OpenAI/Ollama chunk check failed, using local companion:', err);
    }
  }

  // Merge local typos and stylistic advice without duplicates
  const merged = [...localTypos];
  if (Array.isArray(remoteSuggestions)) {
    remoteSuggestions.forEach(rem => {
      if (!merged.some(m => m.original === rem.original)) {
        merged.push(rem);
      }
    });
  }

  // Also include "Show Don't Tell" and repetition rules
  const stylistic = runLocalHeuristicChunkCheck(recentText, contextWindow);
  stylistic.forEach(st => {
    if (!merged.some(m => m.original === st.original)) {
      merged.push(st);
    }
  });

  return merged;
}

/**
 * 2. Full Chapter Comprehensive Review ("Stanza dell'Editor")
 * Deep literary assessment focusing on narrative pacing, Show Don't Tell, and tension.
 */
export async function reviewChapterContent({ chapterText, chapterTitle, settings }) {
  if (!chapterText || chapterText.trim().length < 25) {
    return {
      stats: { wordCount: 0, readingTimeMin: 0, sentenceCount: 0, avgWordsPerSentence: 0 },
      pacingScore: 50,
      pacingReview: {
        tensionLevel: 'Bozza Iniziale',
        pacingCritique: 'Scrivi almeno due o tre paragrafi per consentire un\'analisi del ritmo e della suspense.',
        cliffhangerSuggestions: []
      },
      showDontTell: [],
      orthography: [],
      rhythm: [],
      temporalCoherence: [],
      stylisticNotes: [{ title: 'Inizia a scrivere', note: 'Lascia scorrere la prima bozza, poi torna qui per affinare il capitolo come un vero romanzo.' }]
    };
  }

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  if (aiProvider === 'gemini' && geminiApiKey) {
    try {
      return await reviewWithGemini({ chapterText, chapterTitle, apiKey: geminiApiKey, model: geminiModel });
    } catch (err) {
      console.warn('Gemini review failed, using local bestseller engine:', err);
    }
  } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
    try {
      const endpoint = aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint;
      const model = aiProvider === 'ollama' ? ollamaModel : openaiModel;
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      return await reviewWithOpenAICompatible({ chapterText, chapterTitle, endpoint, model, apiKey: key });
    } catch (err) {
      console.warn('OpenAI/Ollama review failed, using local bestseller engine:', err);
    }
  }

  return runLocalHeuristicChapterReview(chapterText, chapterTitle);
}

/**
 * 3. Suspense & Cliffhanger Generator
 * Proposes 3 high-octane cliffhanger endings for the current chapter
 */
export async function generateCliffhangerIdeas({ chapterText, chapterTitle, settings }) {
  const endingSnippet = chapterText.slice(-1200);
  const prompt = `Sei un maestro del thriller letterario e della narrativa d'alta tensione.
Analizza il finale di questo capitolo ("${chapterTitle}"):
"""
${endingSnippet}
"""
Genera ESATTAMENTE 3 proposte di CLIFFHANGER adrenalinici per chiudere il capitolo in modo da costringere il lettore a voltare subito pagina:
1. Un cliffhanger basato su una RIVELAZIONE INASPETTATA o indizio decifrato all'ultimo secondo.
2. Un cliffhanger basato su un PERICOLO FISICO IMMEDIATO o un rumore/presenza minacciosa.
3. Un cliffhanger basato su una DOMANDA DRAMMATICA o tradimento improvviso.

Rispondi SOLO in formato JSON:
[
  { "type": "Rivelazione / Enigma", "text": "Frase/paragrafo da posizionare a fine capitolo", "explanation": "Perché funziona sul lettore" },
  { "type": "Pericolo Imminente", "text": "Frase/paragrafo da posizionare a fine capitolo", "explanation": "Perché crea urgenza" },
  { "type": "Colpo di Scena / Dilemma", "text": "Frase/paragrafo da posizionare a fine capitolo", "explanation": "Perché alza la posta in gioco" }
]`;

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  try {
    if (aiProvider === 'gemini' && geminiApiKey) {
      const modelName = geminiModel || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = parseJsonSafe(raw, null);
        if (parsed) return parsed;
      }
    } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);
        if (parsed) return parsed;
      }
    }
  } catch (err) {
    console.warn('Cliffhanger generation API error, using heuristic suggestions', err);
  }

  // Local fallback cliffhangers
  return [
    {
      type: "Rivelazione / Enigma",
      text: "Marcus accostò la lente all'iscrizione. Non era una data, ma una coordinata geografica. E portava esattamente dove nessuno avrebbe mai dovuto scavare.",
      explanation: "Apre un 'curiosity gap': il lettore deve sapere cosa si trova in quel punto."
    },
    {
      type: "Pericolo Imminente",
      text: "Un colpo secco risuonò alle sue spalle. Il lucchetto della porta blindata era appena caduto sul pavimento di marmo.",
      explanation: "Minaccia fisica immediata: chi c'è dietro quella porta?"
    },
    {
      type: "Colpo di Scena / Dilemma",
      text: "Il display del telefono si illuminò. Il messaggio conteneva una sola riga: «Non fidarti di chi ti ha dato quella chiave».",
      explanation: "Ribalta le certezze del protagonista e semina il sospetto su un alleato."
    }
  ];
}

/**
 * 4. Paragraph Quick Enhancer
 * Takes a selected paragraph and rewrites it in specific bestselling styles:
 * 'pacingBoost' | 'showDontTell' | 'dialogueSharp' | 'sensoryRich'
 */
export async function enhanceParagraph({ text, mode, settings }) {
  if (!text || text.trim().length < 10) return text;

  let modeInstruction = '';
  if (mode === 'pacingBoost') {
    modeInstruction = 'Aumenta il ritmo e la suspense: accorcia le frasi, elimina le subordinate farraginose, aumenta la tensione drammatica e il senso di urgenza.';
  } else if (mode === 'showDontTell') {
    modeInstruction = 'Applica rigorosamente il principio "Show, Don\'t Tell" (Mostra, non raccontare): elimina i verbi filtro (vide che, sentì che, sembrava, provò) e sostituiscili con reazioni fisiche, sensoriali e dettagli ambientali concreti.';
  } else if (mode === 'dialogueSharp') {
    modeInstruction = 'Rendi il dialogo più tagliente, naturale e ricco di sottotesto. Rimuovi avverbi didascalici inutili e fai emergere il conflitto.';
  } else {
    modeInstruction = 'Arricchisci la carica sensoriale (suoni, ombre, odori, freddo/caldo) mantenendo la voce dell\'autore sobria ed elegante.';
  }

  const prompt = `Sei un editor letterario professionista specializzato in bestseller di narrativa.
Riscrivi il seguente estratto applicando questo criterio:
${modeInstruction}

ESTRATTO ORIGINALE:
"""${text}"""

Restituisci ESCLUSIVAMENTE un JSON:
{
  "improved": "testo riscritto pronto all'uso",
  "explanation": "2 frasi sintetiche su quali modifiche sono state apportate e perché elevano la narrazione."
}`;

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  try {
    if (aiProvider === 'gemini' && geminiApiKey) {
      const modelName = geminiModel || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = parseJsonSafe(raw, null);
        if (parsed?.improved) return parsed;
      }
    } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);
        if (parsed?.improved) return parsed;
      }
    }
  } catch (err) {
    console.warn('Enhance paragraph API error, using heuristic polish', err);
  }

  // Fallback heuristic rewrite
  return {
    improved: text.replace(/\b(si accorse che|vide che|sentì che|notò che)\b/gi, '').trim(),
    explanation: 'Rimossi i verbi filtro per rendere la narrazione più immediata e vicina agli occhi del protagonista.'
  };
}

/**
 * 5. Novel Metadata & Story Synthesis Generator
 * Generates Title suggestions, Tagline, Synopsis, and Genre based on written chapters.
 * STRICT REQUIREMENT: Only available if user has written at least 150 words in the manuscript.
 */
export async function suggestBookMetadata({ book, settings = {} }) {
  const chapters = book?.chapters || [];
  const fullText = chapters.map(c => `${c.title || 'Capitolo'}:\n${c.content || ''}`).join('\n\n');
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  const minRequired = 150;

  if (words.length < minRequired) {
    return {
      success: false,
      reason: 'insufficient_text',
      wordsCount: words.length,
      minWordsRequired: minRequired,
      message: `Scrivi almeno ${minRequired} parole nel manoscritto (attuali: ${words.length}) per consentire all'AI di comprendere la trama, i personaggi e il tono della storia.`
    };
  }

  const excerpt = fullText.slice(0, 4500); // Send generous excerpt for high accuracy
  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  const prompt = `Sei un Senior Literary Editor e Book Marketer di prestigio internazionale.
Analizza questo estratto iniziale del romanzo intitolato provvisoriamente "${book.title || 'Senza Titolo'}":

ESTRATTO DEL MANOSCRITTO:
"""${excerpt}"""

In base alla trama, ai personaggi incontrati, all'atmosfera e al conflitto drammatico emerso, genera:
1. 3 proposte di TITOLI originali, magnetici ed evocativi per questo romanzo (con una breve motivazione di marketing editoriale).
2. Una TAGLINE di copertina ad alto impatto (una frase breve che riassume il dilemma o la posta in gioco).
3. Una SINOSSI / PREMESSA accattivante di circa 2-3 paragrafi (chi è il protagonista, quale mistero/evento scatena la storia, qual è la minaccia o posta in gioco).
4. Il GENERE LETTERARIO più appropriato tra: 'Thriller / Suspense', 'Giallo / Noir / Poliziesco', 'Fantascienza (Sci-Fi) / Distopico', 'Fantasy / High Fantasy', 'Romanzo Storico', 'Narrativa Contemporanea', 'Horror / Gotico / Psicologico', 'Romance / Drammatico', 'Avventura / Azione'.
5. NOTE DI STILE NARRATIVO (guida per lo stile della voce narrante).

Rispondi ESCLUSIVAMENTE in formato JSON con questo schema:
{
  "titles": [
    { "title": "Titolo 1", "style": "Tensione & Mistero", "reason": "Spiega perché cattura il lettore" },
    { "title": "Titolo 2", "style": "Impatto Commerciale", "reason": "Spiega il richiamo" },
    { "title": "Titolo 3", "style": "Letterario & Evocativo", "reason": "Spiega la metafora" }
  ],
  "tagline": "Frase ad effetto da retro di copertina",
  "synopsis": "Testo completo della sinossi...",
  "suggestedGenre": "Genere scelto tra quelli indicati",
  "styleNotes": "Note stilistiche sulla voce del romanzo (es. ritmo rapido, contrasti sensoriali)",
  "themes": ["Tema 1", "Tema 2", "Tema 3"]
}`;

  try {
    if (aiProvider === 'gemini' && geminiApiKey) {
      const modelName = geminiModel || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = parseJsonSafe(raw, null);
        if (parsed?.titles?.length) {
          return { success: true, ...parsed, wordsCount: words.length };
        }
      }
    } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);
        if (parsed?.titles?.length) {
          return { success: true, ...parsed, wordsCount: words.length };
        }
      }
    }
  } catch (err) {
    console.warn('Metadata AI generation failed, falling back to local synthesis engine:', err);
  }

  // Smart Heuristic Story Extractor (Offline & Zero-Config)
  return runLocalHeuristicMetadataSynthesis(fullText, words.length, book?.title);
}

/**
 * Intelligent local storyline synthesizer that scans real nouns, characters, and keywords
 * from the manuscript text to generate contextual title, tagline, and synopsis proposals.
 */
function runLocalHeuristicMetadataSynthesis(fullText, wordsCount, currentTitle) {
  // Extract potential character names (Capitalized words in middle of sentences)
  const candidateNames = [];
  const sentences = fullText.split(/[.!?]+/).filter(Boolean);
  const stopWords = new Set(['Il', 'La', 'Lo', 'I', 'Gli', 'Le', 'Un', 'Uno', 'Una', 'Non', 'Ma', 'E', 'O', 'Se', 'Quando', 'Mentre', 'Dopo', 'Prima', 'Come', 'Dove', 'Che', 'Poi', 'In', 'Su', 'Con', 'Per', 'Tra', 'Fra', 'A', 'Da']);

  sentences.forEach(s => {
    const tokens = s.trim().split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const w = tokens[i].replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ]/g, '');
      if (w.length > 2 && /^[A-Z]/.test(w) && !stopWords.has(w)) {
        candidateNames.push(w);
      }
    }
  });

  // Frequency count of candidate names
  const nameCounts = {};
  candidateNames.forEach(n => { nameCounts[n] = (nameCounts[n] || 0) + 1; });
  const sortedNames = Object.keys(nameCounts).sort((a, b) => nameCounts[b] - nameCounts[a]);
  const mainCharacter = sortedNames[0] || 'Il Protagonista';
  const secondaryCharacter = sortedNames[1] || 'una misteriosa figura';

  // Detect predominant atmosphere
  const lower = fullText.toLowerCase();
  let genre = 'Thriller / Suspense';
  let title1 = `L'Ombra di ${mainCharacter}`;
  let title2 = `Il Patto Sepolto`;
  let title3 = `L'Ultima Rivelazione`;
  let tagline = `Una verità che doveva rimanere sepolta. Un conto alla rovescia che non concede scampo.`;

  if (lower.includes('magia') || lower.includes('spada') || lower.includes('regno') || lower.includes('drago') || lower.includes('incantesimo')) {
    genre = 'Fantasy / High Fantasy';
    title1 = `Le Cronache di ${mainCharacter}`;
    title2 = `Il Sangue dell'Antico Regno`;
    title3 = `La Fiamma Perduta`;
    tagline = `Un potere creduto estinto sta per ridestarsi dal buio.`;
  } else if (lower.includes('astronave') || lower.includes('pianeta') || lower.includes('galassia') || lower.includes('intelligenza artificiale') || lower.includes('cyborg')) {
    genre = 'Fantascienza (Sci-Fi) / Distopico';
    title1 = `Protocollo ${mainCharacter}`;
    title2 = `L'Ultima Colonia`;
    title3 = `Oltre l'Orizzonte degli Eventi`;
    tagline = `Nel silenzio dello spazio, la verità ha un prezzo incalcolabile.`;
  } else if (lower.includes('commissario') || lower.includes('ispettore') || lower.includes('delitto') || lower.includes('cadavere') || lower.includes('indagine')) {
    genre = 'Giallo / Noir / Poliziesco';
    title1 = `Il Silenzio dei Colpevoli`;
    title2 = `L'Enigma di ${mainCharacter}`;
    title3 = `Notte Senza Confini`;
    tagline = `Ogni indizio racconta una menzogna, tranne l'ultimo.`;
  } else if (lower.includes('antico') || lower.includes('secolo') || lower.includes('manoscritto') || lower.includes('chiesa') || lower.includes('re')) {
    genre = 'Romanzo Storico';
    title1 = `Il Segreto del Manoscritto`;
    title2 = `L'Eredità di ${mainCharacter}`;
    title3 = `Nel Nome dell'Imperatore`;
    tagline = `Tra i corridoi del potere e i templi dimenticati, la storia sta per essere riscritta.`;
  }

  // Create an engaging synopsis based on actual first paragraphs
  const firstParagraphs = fullText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 40);
  const hookSummary = firstParagraphs[0] ? firstParagraphs[0].slice(0, 220) + '...' : `La vita di ${mainCharacter} viene sconvolta da una scoperta che mette in discussione ogni certezza.`;

  const synopsis = `${hookSummary}

Quando gli eventi precipitano e il passato torna a bussare con prepotenza, ${mainCharacter} si ritrova al centro di un intrigo ben più grande di quanto immaginasse. Al suo fianco, la presenza ambigua di ${secondaryCharacter} solleva nuovi interrogativi: alleanza sincera o inganno fatale?

In una corsa contro il tempo dove ogni secondo conta, ${mainCharacter} dovrà affrontare le proprie paure più recondite per svelare l'enigma prima che sia troppo tardi. Una storia di tensione, coraggio e scelte irrevocabili.`;

  return {
    success: true,
    wordsCount,
    titles: [
      { title: title1, style: 'Tensione & Protagonista', reason: `Mette al centro ${mainCharacter} creando immediata curiosità emotiva.` },
      { title: title2, style: 'Commerciale & Diretto', reason: 'Titolo forte e percussivo, ideale per la copertina di un bestseller contemporaneo.' },
      { title: title3, style: 'Simbolico & Suggestivo', reason: 'Allude alla posta in gioco e al climax drammatico della narrazione.' }
    ],
    tagline,
    synopsis,
    suggestedGenre: genre,
    styleNotes: 'Voce narrativa incalzante con ritmo cinematografico. Alternanza sapiente tra introspezione sensoriale e scene di movimento serrato.',
    themes: ['Mistero & Verità', 'Lealtà e Tradimento', 'Corsa contro il tempo']
  };
}

/* ====================================================================
   GEMINI API IMPLEMENTATION
   ==================================================================== */
async function checkChunkWithGemini({ recentText, contextWindow, apiKey, model }) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `Sei l'assistente editoriale discreto di uno scrittore di narrativa e romanzi d'intrattenimento di alta qualità (thriller, mystery, narrativa).
Analizza il seguente testo recente nel suo contesto narrativo.
Segnala solo:
1. Refusi o errori grammaticali in italiano (accenti, concordanze).
2. Verbi filtro deboli ("Mostra, non raccontare" - es. "sentì che", "vide che").
3. Frasi involontariamente ripetitive o salti temporali incongruenti.

CONTESTO RECENTE:
"""${contextWindow.slice(-1800)}"""

TESTO DA REVISIONARE:
"""${recentText}"""

Rispondi ESCLUSIVAMENTE in formato JSON aderente a questo schema:
[
  {
    "original": "porzione esatta di testo da correggere o migliorare",
    "suggestion": "testo sostitutivo più incisivo",
    "reason": "breve spiegazione focalizzata sulla tecnica narrativa",
    "type": "orthography" | "show_dont_tell" | "pacing" | "tense"
  }
]
Se il testo è ottimo e fluido, restituisci []`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    })
  });

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseJsonSafe(rawText, []);
}

async function reviewWithGemini({ chapterText, chapterTitle, apiKey, model }) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `Sei un Senior Literary Editor specializzato in bestseller di narrativa, thriller e narrativa di genere ad alto ritmo.
Esegui la revisione editoriale approfondita del capitolo "${chapterTitle}".

TESTO DEL CAPITOLO:
"""${chapterText}"""

Rispondi ESCLUSIVAMENTE in formato JSON con la seguente struttura:
{
  "pacingScore": 85, // punteggio da 1 a 100 sulla tensione e tenuta della lettura
  "pacingReview": {
    "tensionLevel": "Alta" | "Media" | "Bassa" | "Calante",
    "pacingCritique": "Analisi del ritmo: dove il capitolo accelera e dove rischia di perdere il lettore.",
    "cliffhangerSuggestions": [
      { "type": "Rivelazione", "suggestion": "Idea concreta per chiudere con un colpo di scena", "reason": "Perché funziona" }
    ]
  },
  "showDontTell": [
    { "quote": "passaggio con verbo filtro o astrazione", "critique": "perché è un 'tell' debole", "replacement": "come renderlo sensoriale ed evocativo" }
  ],
  "orthography": [
    { "original": "refuso o errore", "fix": "correzione", "explanation": "regola o motivazione" }
  ],
  "rhythm": [
    { "quote": "frase appesantita o prolissa", "critique": "perché frena la lettura", "suggestion": "versione più asciutta e ritmata" }
  ],
  "temporalCoherence": [
    { "passage": "salto temporale", "detectedTense": "tempo trovato", "expectedTense": "tempo coerente", "note": "spiegazione" }
  ],
  "stylisticNotes": [
    { "title": "Punto di forza o spunto narrativo", "note": "osservazione da editor professionista" }
  ]
}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    })
  });

  if (!res.ok) throw new Error(`Gemini review error ${res.status}`);
  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseJsonSafe(rawText, null);
  
  if (parsed) {
    const words = chapterText.trim().split(/\s+/).filter(Boolean);
    const sentences = chapterText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return {
      stats: {
        wordCount: words.length,
        readingTimeMin: Math.ceil(words.length / 220),
        sentenceCount: sentences.length,
        avgWordsPerSentence: sentences.length > 0 ? (words.length / sentences.length).toFixed(1) : 0
      },
      ...parsed
    };
  }

  return runLocalHeuristicChapterReview(chapterText, chapterTitle);
}

/* ====================================================================
   OPENAI / OLLAMA API IMPLEMENTATION
   ==================================================================== */
async function checkChunkWithOpenAICompatible({ recentText, contextWindow, endpoint, model, apiKey }) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const prompt = `Sei un assistente editoriale per scrittori di romanzi.
Analizza il seguente testo recente (stile thriller/narrativa avvincente).
Segnala refusi, frasi deboli con verbi filtro (Mostra, non raccontare) o salti temporali.
Rispondi SOLO in formato JSON:
[
  {
    "original": "testo esatto da correggere",
    "suggestion": "correzione o riscrittura più incisiva",
    "reason": "motivazione narrativa",
    "type": "orthography" | "show_dont_tell" | "pacing" | "tense"
  }
]
Se è privo di difetti, restituisci []

CONTESTO:
${contextWindow.slice(-1500)}

TESTO RECENTE:
${recentText}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });

  if (!res.ok) throw new Error(`OpenAI/Ollama error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return parseJsonSafe(extractJsonFromMarkdown(content), []);
}

async function reviewWithOpenAICompatible({ chapterText, chapterTitle, endpoint, model, apiKey }) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const prompt = `Sei un Senior Editor di romanzi bestseller e narrativa ad alto coinvolgimento narrativo.
Revisiona il capitolo intitolato "${chapterTitle}".
Rispondi ESCLUSIVAMENTE in JSON:
{
  "pacingScore": 82,
  "pacingReview": {
    "tensionLevel": "Alta",
    "pacingCritique": "Critica del ritmo e tenuta della suspense.",
    "cliffhangerSuggestions": [
      { "type": "Gancio finale", "suggestion": "Idea cliffhanger", "reason": "Motivazione" }
    ]
  },
  "showDontTell": [
    { "quote": "frase con verbo filtro", "critique": "motivo", "replacement": "riscrittura sensoriale" }
  ],
  "orthography": [ { "original": "...", "fix": "...", "explanation": "..." } ],
  "rhythm": [ { "quote": "...", "critique": "...", "suggestion": "..." } ],
  "temporalCoherence": [ { "passage": "...", "detectedTense": "...", "expectedTense": "...", "note": "..." } ],
  "stylisticNotes": [ { "title": "...", "note": "..." } ]
}

TESTO:
${chapterText}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  if (!res.ok) throw new Error(`OpenAI/Ollama error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);

  if (parsed) {
    const words = chapterText.trim().split(/\s+/).filter(Boolean);
    const sentences = chapterText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return {
      stats: {
        wordCount: words.length,
        readingTimeMin: Math.ceil(words.length / 220),
        sentenceCount: sentences.length,
        avgWordsPerSentence: sentences.length > 0 ? (words.length / sentences.length).toFixed(1) : 0
      },
      ...parsed
    };
  }

  return runLocalHeuristicChapterReview(chapterText, chapterTitle);
}

/* ====================================================================
   SMART LOCAL HEURISTIC BESTSELLER ENGINE (Zero Config & Offline)
   ==================================================================== */
function runLocalHeuristicChunkCheck(recentText, contextWindow) {
  const suggestions = [];
  const text = recentText;

  // 1. Italian Typos, Accents and Grammar
  const typoRules = [
    { regex: /\b(perche|poiche|affinche|benche|giacche)\b/gi, fix: (m) => m.toLowerCase().replace(/e$/, 'é'), reason: 'Accento acuto mancante sulla finale (é)' },
    { regex: /\b(qual'\s*e|qual\s*e'|qual\s+e)\b/gi, fix: () => 'qual è', reason: "Trattasi di troncamento: si scrive 'qual è' senza apostrofo" },
    { regex: /\b(un\s+po\b)(?!')/gi, fix: () => "un po'", reason: "Si scrive 'un po'' con l'apostrofo per elisione di 'poco'" },
    { regex: /\b(daccordo)\b/gi, fix: () => "d'accordo", reason: "Grafia corretta: d'accordo" },
    { regex: /\b(fa'\b)/gi, fix: () => "fa", reason: "La terza persona indicativo 'fa' non vuole l'apostrofo" },
    { regex: /\b(da'\b)/gi, fix: () => "dà", reason: "Terza persona indicativo vuole accento grave 'dà'" },
    { regex: /\b(ha\s+andato|ha\s+venuto|ha\s+partito)\b/gi, fix: (m) => m.replace(/^ha\s+/i, 'è '), reason: 'Ausiliare errato per verbo intransitivo (usare "essere")' }
  ];

  typoRules.forEach(rule => {
    let match;
    const re = new RegExp(rule.regex);
    while ((match = re.exec(text)) !== null) {
      suggestions.push({
        id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        original: match[0],
        suggestion: typeof rule.fix === 'function' ? rule.fix(match[0]) : rule.fix,
        reason: rule.reason,
        type: 'orthography'
      });
    }
  });

  // 2. "Show, Don't Tell" Detector (Filter Verbs in Narrative)
  const filterVerbs = [
    { regex: /\b(vide che|notò che|si accorse che|si rese conto che)\b/gi, advice: 'Elimina il filtro visivo: descrivi direttamente ciò che accade per immergere il lettore.', type: 'show_dont_tell' },
    { regex: /\b(sentì che|avvertì una sensazione di|provò una sensazione di)\b/gi, advice: 'Mostra la reazione corporea viscerale (brivido, muscoli tesi, respiro bloccato) anziché descrivere il sentimento astratto.', type: 'show_dont_tell' },
    { regex: /\b(sembrava essere|pareva essere)\b/gi, advice: 'La prosa dei bestseller è assertiva e sicura. Rimuovi le attenuazioni dubitative.', type: 'show_dont_tell' }
  ];

  filterVerbs.forEach(fv => {
    let match;
    const re = new RegExp(fv.regex);
    if ((match = re.exec(text)) !== null) {
      suggestions.push({
        id: `sug-sdt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        original: match[0],
        suggestion: 'Riscrivi descrivendo l\'azione',
        reason: fv.advice,
        type: 'show_dont_tell'
      });
    }
  });

  // 3. Consecutive duplicates
  const repeatMatch = text.match(/\b([a-zA-Zàèéìòù]+)\s+\1\b/i);
  if (repeatMatch && repeatMatch[1].length > 1) {
    suggestions.push({
      id: `sug-rep-${Date.now()}`,
      original: repeatMatch[0],
      suggestion: repeatMatch[1],
      reason: `Parola duplicata consecutiva ("${repeatMatch[1]}").`,
      type: 'orthography'
    });
  }

  return suggestions;
}

function runLocalHeuristicChapterReview(chapterText, chapterTitle) {
  const words = chapterText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = chapterText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWords = sentences.length > 0 ? (wordCount / sentences.length) : 0;

  // 1. Show Don't Tell Scan
  const showDontTell = [];
  const filterPhrases = [
    { pattern: /\b(vide che|notò che|si accorse che)[^.!?]{5,60}/gi, tip: 'Filtro visivo debole: fai vedere direttamente l\'evento senza anteporre la mediazione dello sguardo del personaggio.' },
    { pattern: /\b(sentì che|provò una forte|avvertì un senso di)[^.!?]{5,60}/gi, tip: 'Filtro emotivo astratto: sostituiscilo con una contrazione muscolare, un battito cardiaco o un dettaglio sensoriale esterno.' },
    { pattern: /\b(sembrava che|pareva che)[^.!?]{5,60}/gi, tip: 'Indebolisce l\'impatto della narrazione: usa affermazioni dirette e incisive.' }
  ];

  filterPhrases.forEach(fp => {
    const matches = chapterText.match(fp.pattern) || [];
    matches.slice(0, 3).forEach(m => {
      showDontTell.push({
        quote: m.trim(),
        critique: fp.tip,
        replacement: 'Mostra la reazione fisica o l\'ambiente'
      });
    });
  });

  // 2. Rhythm & Sentence Pacing Analysis
  const rhythm = [];
  let longSentenceCount = 0;
  sentences.forEach(s => {
    const sWords = s.trim().split(/\s+/).filter(Boolean);
    if (sWords.length > 36) {
      longSentenceCount++;
      if (rhythm.length < 4) {
        rhythm.push({
          quote: s.trim().slice(0, 95) + '...',
          critique: `Frase di ben ${sWords.length} parole. Nei momenti di tensione narrativa o thriller, si raccomandano periodi di massimo 12-18 parole.`,
          suggestion: 'Spezza il periodo con uno o due punti fermi per creare un ritmo staccato e incalzante.'
        });
      }
    }
  });

  // Pacing Score (1-100)
  // Higher if good variety of short sentences, lower if too many 35+ word sentences
  let pacingScore = 88;
  if (avgWords > 25) pacingScore -= 18;
  if (longSentenceCount > 4) pacingScore -= 14;
  if (wordCount < 150) pacingScore -= 15;
  pacingScore = Math.max(35, Math.min(98, pacingScore));

  // 3. Cliffhanger Analysis (Ending sentences of chapter)
  const lastSentences = sentences.slice(-3).join('. ').trim();
  const hasQuestionEnding = /\?$/.test(lastSentences);
  const hasShortShockEnding = sentences.length > 0 && sentences[sentences.length - 1].trim().split(/\s+/).length < 14;

  const pacingReview = {
    tensionLevel: pacingScore > 80 ? 'Elevata & Coinvolgente' : pacingScore > 65 ? 'Moderata' : 'Rallentata da periodi estesi',
    pacingCritique: avgWords < 18 
      ? `Ottimo ritmo incalzante con una media di ${avgWords.toFixed(1)} parole per frase. Il lettore viene trascinato pagina dopo pagina.`
      : `Il ritmo medio (${avgWords.toFixed(1)} parole per periodo) è descrittivo e riflessivo. Nei momenti chiave accorcia i periodi per aumentare il battito del lettore.`,
    cliffhangerSuggestions: [
      {
        type: 'Colpo di Scena Finale',
        suggestion: hasShortShockEnding 
          ? 'Il finale del capitolo ha già una chiusura secca. Assicurati che contenga una minaccia imminente o un nuovo interrogativo.'
          : 'Chiudi l\'ultima riga con un evento inatteso (un rumore anomalo, una rivelazione shock, un messaggio inatteso).',
        reason: 'Costringe il lettore ad aprire il capitolo successivo senza interrompere la sessione.'
      }
    ]
  };

  // 4. Orthography & Typos
  const orthography = [];
  const detectedTypos = analyzeItalianOrthography(chapterText);
  detectedTypos.slice(0, 15).forEach(item => {
    orthography.push({
      original: item.original,
      fix: item.suggestion,
      explanation: item.reason
    });
  });

  // 5. Stylistic notes
  const stylisticNotes = [
    {
      title: 'Tensione Drammatica e Ganci',
      note: hasQuestionEnding 
        ? 'Ottimo uso del punto interrogativo finale: lascia aperta una questione cruciale che sostiene l\'arco narrativo.'
        : 'Per rendere il capitolo imperdibile, verifica che il protagonista abbia dovuto compiere una scelta difficile o abbia scoperto una verità scomoda.'
    },
    {
      title: 'Architettura delle Scene',
      note: `Con ${wordCount} parole e ${sentences.length} periodi, la struttura del capitolo è compatta e risponde ai canoni della narrativa contemporanea ad alto scorrimento.`
    }
  ];

  return {
    stats: {
      wordCount,
      readingTimeMin: Math.ceil(wordCount / 220),
      sentenceCount: sentences.length,
      avgWordsPerSentence: avgWords.toFixed(1)
    },
    pacingScore,
    pacingReview,
    showDontTell,
    orthography,
    rhythm,
    temporalCoherence: [],
    stylisticNotes
  };
}

/* Helpers */
function parseJsonSafe(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const match = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return fallback;
  }
}

function extractJsonFromMarkdown(md) {
  if (!md) return '';
  const match = md.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : md;
}
