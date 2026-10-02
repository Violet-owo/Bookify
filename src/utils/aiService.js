import { analyzeItalianOrthography } from './italianLexicon';
import { analyzeEnglishOrthography } from './englishLexicon';

const AI_USAGE_EVENT = 'bookify-ai-usage-updated';

function getAIUsageStorageKey() {
  return `bookify_ai_usage_${new Date().toISOString().slice(0, 7)}`;
}

export function readAIUsage() {
  try {
    return JSON.parse(localStorage.getItem(getAIUsageStorageKey()) || '{"requests":0,"meteredRequests":0,"promptTokens":0,"completionTokens":0,"totalTokens":0,"providers":{}}');
  } catch {
    return { requests: 0, meteredRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, providers: {} };
  }
}

async function recordAIUsage(response, url) {
  try {
    const payload = await response.clone().json();
    const usage = payload.usage || payload.usageMetadata || {};
    const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_tokens ?? payload.prompt_eval_count ?? 0);
    const completionTokens = Number(usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_tokens ?? payload.eval_count ?? 0);
    const reportedTotal = Number(usage.total_tokens ?? usage.totalTokenCount ?? usage.total_tokens_count ?? 0);
    const totalTokens = reportedTotal || promptTokens + completionTokens;
    const host = new URL(url).hostname;
    const provider = host === 'generativelanguage.googleapis.com'
      ? 'gemini'
      : /localhost|127\.0\.0\.1/.test(host) ? 'ollama' : 'openai';
    const stats = readAIUsage();
    const providerStats = stats.providers[provider] || { requests: 0, meteredRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const metered = totalTokens > 0;
    Object.assign(providerStats, {
      requests: providerStats.requests + 1,
      meteredRequests: providerStats.meteredRequests + Number(metered),
      promptTokens: providerStats.promptTokens + promptTokens,
      completionTokens: providerStats.completionTokens + completionTokens,
      totalTokens: providerStats.totalTokens + totalTokens
    });
    Object.assign(stats, {
      requests: stats.requests + 1,
      meteredRequests: stats.meteredRequests + Number(metered),
      promptTokens: stats.promptTokens + promptTokens,
      completionTokens: stats.completionTokens + completionTokens,
      totalTokens: stats.totalTokens + totalTokens,
      providers: { ...stats.providers, [provider]: providerStats }
    });
    localStorage.setItem(getAIUsageStorageKey(), JSON.stringify(stats));
    window.dispatchEvent(new Event(AI_USAGE_EVENT));
  } catch {}
}

async function fetchWithTransientRetry(url, options, attempts = 3) {
  let response;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (2 ** attempt), 8000)));
      continue;
    }

    if (![500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) {
      if (response.ok) await recordAIUsage(response, url);
      return response;
    }
    const retryAfter = response.headers.get('Retry-After');
    const retryAfterMs = Number.isFinite(Number(retryAfter))
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter) - Date.now();
    const backoffMs = Math.min(1000 * (2 ** attempt), 8000);
    await new Promise(resolve => setTimeout(resolve, Math.max(backoffMs, retryAfterMs > 0 ? retryAfterMs : 0)));
  }
  return response;
}

export async function fetchAIWithUsage(url, options) {
  return fetchWithTransientRetry(url, options);
}

function getTemporaryServiceError(provider, status) {
  if (status === 429) {
    return `${provider} ha raggiunto un limite temporaneo di richieste (HTTP 429). Attendi prima di riprovare.`;
  }
  if ([500, 502, 503, 504].includes(status)) {
    return `${provider} momentaneamente non disponibile (HTTP ${status}) dopo più tentativi. Riprova tra poco.`;
  }
  return `${provider} ha rifiutato la richiesta (HTTP ${status}).`;
}

async function getServiceErrorMessage(response, provider) {
  try {
    const data = await response.clone().json();
    const detail = data.error?.message || data.message;
    if (detail) return `${provider} (HTTP ${response.status}): ${detail}`;
  } catch {}
  return getTemporaryServiceError(provider, response.status);
}

function getGeminiText(data) {
  return (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('')
    .trim();
}

function getGeminiOutputError(data, task) {
  const reason = data.candidates?.[0]?.finishReason;
  if (reason === 'MAX_TOKENS') {
    return `Gemini ha raggiunto il proprio massimo tecnico di output per ${task}. Il tetto applicativo è stato rimosso; il modello mantiene un limite interno alla singola risposta.`;
  }
  if (reason === 'SAFETY' || data.promptFeedback?.blockReason) {
    return `Gemini ha bloccato la risposta per i filtri di sicurezza (${reason || data.promptFeedback.blockReason}).`;
  }
  return `Gemini non ha restituito un report leggibile per ${task} (${reason || 'risposta vuota o non valida'}). Riprova l'analisi.`;
}

/**
 * 1. Live Chunk Checking (Subtle Inline Assistance)
 * Evaluates the recent paragraph against spelling, bestseller pacing & Italian narrative rules.
 */
export async function checkTextChunk({ recentText, contextWindow = '', settings = {} }) {
  if (!recentText || recentText.trim().length < 4) {
    return [];
  }

  const isEn = settings.language === 'en';
  // Compute immediate, high-accuracy orthography & typo checks according to language
  const localTypos = isEn
    ? analyzeEnglishOrthography(recentText)
    : analyzeItalianOrthography(recentText);

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  let remoteSuggestions = [];
  // Gemini API
  if (aiProvider === 'gemini' && geminiApiKey) {
    try {
      remoteSuggestions = await checkChunkWithGemini({ recentText, contextWindow, apiKey: geminiApiKey, model: geminiModel, language: settings.language });
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
      remoteSuggestions = await checkChunkWithOpenAICompatible({ recentText, contextWindow, endpoint, model, apiKey: key, language: settings.language });
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

export async function rewriteSuggestion({ sentence, context, bookContext = '', original, reason, suggestion, settings = {} }) {
  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;
  const canUseGemini = aiProvider === 'gemini' && geminiApiKey;
  const canUseCompatible = (aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama';

  if (!canUseGemini && !canUseCompatible) {
    const isActionable = suggestion && !/riscrivi|descrivi|mostra/i.test(suggestion);
    return {
      improved: isActionable && original ? sentence.replace(original, suggestion) : sentence,
      explanation: 'Configura un provider AI per generare una revisione contestuale. Puoi comunque modificare il testo proposto.',
      fallback: true
    };
  }

  const prompt = `Sei un editor letterario italiano prudente. Valuta la nota editoriale come un'ipotesi, non come un ordine: modifica la frase solo se la nota e' davvero pertinente. Correggi solo il problema individuato, con interventi minimi. Conserva significato, punto di vista, tempo verbale, voce e intenzione dell'autrice. Non aggiungere fatti, immagini, emozioni o dettagli non presenti nel contesto. Se la frase funziona gia', restituiscila invariata.

CONTESTO NARRATIVO (solo per comprendere riferimenti e continuita'):
"""${context}"""

CONTESTO DEL ROMANZO:
"""${bookContext}"""

FRASE ESATTA DA VALUTARE:
"""${sentence}"""

NOTA DELL'EDITOR:
${reason || suggestion || 'Verifica ortografia e grammatica.'}

Restituisci esclusivamente JSON: {"improved":"frase intera, anche invariata se non serve intervenire","explanation":"motivo breve e concreto"}`;

  let responseText;
  let result;
  if (canUseGemini) {
    const modelName = geminiModel || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const response = await fetchWithTransientRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: 700 }
      })
    });
    if (!response.ok) throw new Error(getTemporaryServiceError('Gemini', response.status));
    const data = await response.json();
    responseText = getGeminiText(data);
  } else {
    const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
    const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
    const response = await fetchWithTransientRetry(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key !== 'ollama' ? { Authorization: `Bearer ${key}` } : {})
      },
      body: JSON.stringify({
        model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.15,
        ...(aiProvider === 'ollama' ? { think: false } : {}),
        ...(aiProvider !== 'ollama' ? { max_tokens: 700 } : {})
      })
    });
    if (!response.ok) throw new Error(getTemporaryServiceError(aiProvider, response.status));
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (aiProvider === 'ollama') {
      const cleanedContent = content.replace(/^```(?:text|markdown)?\s*|\s*```$/gi, '').trim();
      const parsedContent = parseJsonSafe(extractJsonFromMarkdown(cleanedContent), null);
      result = parsedContent?.improved
        ? parsedContent
        : { improved: cleanedContent, explanation: '' };
    } else {
      responseText = extractJsonFromMarkdown(content);
    }
  }

  if (aiProvider !== 'ollama') result = parseJsonSafe(responseText, null);
  if (!result?.improved || typeof result.improved !== 'string') {
    throw new Error('La risposta AI non contiene una revisione valida.');
  }
  return result;
}

/**
 * 2. Full Chapter Comprehensive Review ("Stanza dell'Editor")
 * Deep literary assessment focusing on narrative pacing, Show Don't Tell, and tension.
 */
export async function reviewChapterContent({ chapterText, chapterTitle, settings, bookContext = '', strict = false }) {
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
      craft: [],
      orthography: [],
      rhythm: [],
      temporalCoherence: [],
      source: 'local',
      stylisticNotes: [{ title: 'Inizia a scrivere', note: 'Lascia scorrere la prima bozza, poi torna qui per affinare il capitolo come un vero romanzo.' }]
    };
  }

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  if (aiProvider === 'gemini' && geminiApiKey) {
    const result = await reviewWithGemini({ chapterText, chapterTitle, bookContext, apiKey: geminiApiKey, model: geminiModel });
    return { ...result, source: 'ai' };
  } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
    const endpoint = aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint;
    const model = aiProvider === 'ollama' ? ollamaModel : openaiModel;
    const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
    const result = await reviewWithOpenAICompatible({ chapterText, chapterTitle, bookContext, endpoint, model, apiKey: key });
    return { ...result, source: 'ai' };
  }

  if (strict) {
    throw new Error('Configura e verifica un provider AI nelle Impostazioni prima di analizzare il libro.');
  }

  return { ...runLocalHeuristicChapterReview(chapterText, chapterTitle), source: 'local' };
}

export function buildNovelContext(book, targetChapterId = null) {
  if (!book) return '';
  const bible = book.bible || {};
  const chapters = [...(book.chapters || [])].sort((first, second) => (first.order || 0) - (second.order || 0));
  const targetIndex = chapters.findIndex(chapter => chapter.id === targetChapterId);
  const relevantChapters = targetIndex >= 0
    ? chapters.slice(Math.max(0, targetIndex - 1), Math.min(chapters.length, targetIndex + 2))
    : chapters.slice(0, 3);
  const characters = (bible.characters || []).slice(0, 8)
    .map(character => `${character.name || 'Personaggio'}: ${character.role || ''}. ${character.goal || ''}`.slice(0, 180))
    .join('\n');
  const plotNotes = (bible.plotNotes || []).slice(0, 6)
    .map(note => `${note.title || 'Trama'}: ${note.summary || ''}`.slice(0, 180))
    .join('\n');
  const chapterMap = relevantChapters
    .map(chapter => `${chapter.title || 'Capitolo'}: ${(chapter.synopsis || 'Sinossi non disponibile.').slice(0, 180)}`)
    .join('\n');
  return [
    `Titolo: ${(book.title || 'Senza titolo').slice(0, 120)}`,
    `Genere: ${(book.genre || 'Non specificato').slice(0, 100)}`,
    `Sinossi: ${(book.synopsis || bible.synopsis || 'Non disponibile.').slice(0, 700)}`,
    `Personaggi e obiettivi:\n${characters || 'Non definiti.'}`,
    `Arco e appunti di trama:\n${plotNotes || 'Non disponibili.'}`,
    `Ambientazione: ${(bible.worldNotes || 'Non definita.').slice(0, 400)}`,
    `Ordine e sinossi dei capitoli:\n${chapterMap}`
  ].join('\n\n').slice(0, 3200);
}

export async function reviewWholeBook({ book, settings, onProgress = () => {} }) {
  const chapters = [...(book?.chapters || [])]
    .filter(chapter => (chapter.content || '').trim().length >= 25)
    .sort((first, second) => (first.order || 0) - (second.order || 0));
  if (chapters.length === 0) throw new Error('Il libro non contiene ancora capitoli sufficienti da analizzare.');

  const hasProvider = (settings.aiProvider === 'gemini' && settings.geminiApiKey)
    || (settings.aiProvider === 'openai' && settings.openaiApiKey)
    || settings.aiProvider === 'ollama';
  if (!hasProvider) throw new Error('Configura e verifica un provider AI nelle Impostazioni prima di analizzare il libro.');

  const cacheKey = `bookify_ai_review_cache_v1_${book.id}`;
  let reviewCache = {};
  try {
    reviewCache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
  } catch {}
  const results = [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    onProgress({ current: index + 1, total: chapters.length, title: chapter.title || `Capitolo ${index + 1}` });
    const bookContext = buildNovelContext(book, chapter.id);
    const fingerprint = hashReviewInput(JSON.stringify({
      version: 1,
      content: chapter.content,
      bookContext,
      provider: settings.aiProvider,
      model: settings.aiProvider === 'gemini' ? settings.geminiModel : settings.aiProvider === 'ollama' ? settings.ollamaModel : settings.openaiModel,
      endpoint: settings.aiProvider === 'ollama' ? settings.ollamaEndpoint : settings.openaiEndpoint
    }));
    const cached = reviewCache[chapter.id];
    if (cached?.fingerprint === fingerprint && cached.report) {
      results.push({ chapterId: chapter.id, title: chapter.title, report: cached.report, cached: true });
      onProgress({ current: index + 1, total: chapters.length, title: chapter.title || `Capitolo ${index + 1}`, cached: true });
      continue;
    }

    try {
      const report = await reviewChapterContent({
        chapterText: chapter.content,
        chapterTitle: chapter.title,
        settings,
        bookContext,
        strict: true
      });
      results.push({ chapterId: chapter.id, title: chapter.title, report, cached: false });
      reviewCache[chapter.id] = { fingerprint, report };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(reviewCache));
      } catch (error) {
        console.warn('Unable to cache AI book review:', error);
      }
    } catch (error) {
      const message = error.message || 'Analisi non riuscita.';
      results.push({ chapterId: chapter.id, title: chapter.title, error: message });
      if (message.includes('HTTP 429')) {
        chapters.slice(index + 1).forEach(remainingChapter => {
          results.push({
            chapterId: remainingChapter.id,
            title: remainingChapter.title,
            error: 'Analisi sospesa perché il provider ha raggiunto il limite di richieste. Riprova più tardi.'
          });
        });
        break;
      }
    }
  }

  return { bookTitle: book.title, chapters: results };
}

function hashReviewInput(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
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
      const res = await fetchWithTransientRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 1000 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = getGeminiText(data);
        const parsed = parseJsonSafe(raw, null);
        if (parsed) return parsed;
      }
    } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetchWithTransientRetry(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 1000
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
export async function enhanceParagraph({ text, mode, settings, bookContext = '', signal }) {
  if (!text || text.trim().length < 10) return text;

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;
  const canUseGemini = aiProvider === 'gemini' && geminiApiKey;
  const canUseCompatible = (aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama';
  const isOllamaRefinement = mode === 'refinement' && aiProvider === 'ollama';
  if (mode === 'refinement' && !canUseGemini && !canUseCompatible) {
    throw new Error('Configura un provider AI nelle Impostazioni per usare la Rifinitura.');
  }

  let modeInstruction = '';
  if (mode === 'refinement') {
    modeInstruction = `Esegui un line editing profondo da editor letterario e romanziere di altissimo livello. Trasforma la bozza grezza in prosa immersiva, viscerale e magnetica, non limitarti a correggere i refusi.

RITMO E STRUTTURA:
- Alterna frasi brevi e incisive a periodi più ampi. Spezza gli accumuli monotoni di coordinate e subordinate, mantenendo chiara la sequenza delle azioni.
- Varia l'attacco dei periodi: evita di iniziare frasi consecutive con lo stesso soggetto o pronome.
- RISTRUTTURAZIONE ATTIVA OBBLIGATORIA: non limitarti a correggere la grammatica lasciando invariata la struttura. Riscrivi attivamente i periodi con ritmo monotono del tipo "Io ho fatto X, poi ho visto Y"; varia gli attacchi ed evita sequenze di frasi che iniziano con "Mi...", "Presi...", "Vidi..." o forme equivalenti.
- Elimina ripetizioni immediate della stessa azione e ridondanze, senza cancellare eventi distinti o informazioni narrative.
- Sciogli ed elimina ripetizioni ravvicinate della stessa radice o dello stesso verbo (per esempio "continuavano/continuava"), mantenendo tutte le azioni e le informazioni.
- Organizza il testo in paragrafi separati da righe vuote secondo i beat della scena: azione, scoperta, reazione, cambio di luogo o momento di tensione. Non restituire un blocco unico.

LESSICO E SENSORIALITÀ:
- Sostituisci verbi generici o deboli come "vidi", "notai", "c'era" o "pareva" con formulazioni più precise e dinamiche quando il contesto lo consente.
- Rendi concrete e vivide le sensazioni fisiche ed emotive già suggerite dalla scena, senza accumulare aggettivi o introdurre nuove informazioni fattuali.
- Scrivi in italiano naturale e impeccabile. Non inserire parole o frasi in altre lingue, tranne quando sono già presenti nell'originale come testo diegetico.

PRESERVAZIONE ASSOLUTA:
- Non riassumere e non tagliare scene, azioni, descrizioni, indizi, passaggi logici o world-building. Puoi riformulare e riordinare, ma conserva ogni informazione ed evento distinto.
- Mantieni identici nomi propri, date, quantità, valute, prezzi, oggetti, elenchi e meccaniche di gioco. Non normalizzare le stranezze intenzionali.
- Conserva letteralmente testi UI, menu, schermate, messaggi, scritte spezzate o volutamente errate, compresi "Witdraw/Versamento" e "inserire impornta digitale per contin…". Non correggerli e non tradurli.
- Mantieni rigorosamente punto di vista, persona narrante, genere grammaticale e tempi verbali dell'autrice. Non aggiungere pensieri, spiegazioni morali o fatti assenti.
- Se un dettaglio potrebbe essere intenzionale, conservalo.

Restituisci tutto il testo revisionato dall'inizio fino all'ultima frase fornita dall'autrice, pronto per essere inserito. Non interromperti a metà della scena, non troncare la conclusione e non omettere la parte finale. Non riassumere.`;
  } else if (mode === 'pacingBoost') {
    modeInstruction = 'Aumenta il ritmo e la suspense: accorcia le frasi, elimina le subordinate farraginose, aumenta la tensione drammatica e il senso di urgenza.';
  } else if (mode === 'showDontTell') {
    modeInstruction = 'Applica rigorosamente il principio "Show, Don\'t Tell" (Mostra, non raccontare): elimina i verbi filtro (vide che, sentì che, sembrava, provò) e sostituiscili con reazioni fisiche, sensoriali e dettagli ambientali concreti.';
  } else if (mode === 'dialogueSharp') {
    modeInstruction = 'Rendi il dialogo più tagliente, naturale e ricco di sottotesto. Rimuovi avverbi didascalici inutili e fai emergere il conflitto.';
  } else {
    modeInstruction = 'Arricchisci la carica sensoriale (suoni, ombre, odori, freddo/caldo) mantenendo la voce dell\'autore sobria ed elegante.';
  }

  const prompt = isOllamaRefinement
    ? `RUOLO: Senior Book Editor specializzato in narrativa speculativa e weird fiction.
COMPITO: Riscrivi integralmente il testo dell'autrice elevandolo a prosa fluida, evocativa e coesa.

REGOLE TASSATIVE:
- Non inventare e non riassumere. Conserva ogni fatto e passaggio della scena, tutti i nomi propri, numeri, oggetti, dettagli di trama e world-building.
- Mantieni letteralmente i testi a schermo, le scritte spezzate o volutamente errate, il listino del totem e la valuta ibrida. Non correggerli, completarli o tradurli.
- Correggi grammatica, ortografia e concordanze. Mantieni i tempi verbali coerenti con la narrazione; quando è al passato, coniuga correttamente anche il passato remoto (per esempio "caddi", "bevvi", "raccolsi") e concorda generi e numeri (per esempio "i pesci", "gli scaffali").
- Varia gli attacchi di frase, elimina ripetizioni ravvicinate e migliora il ritmo senza cancellare azioni o dettagli. Mantieni il punto di vista e la persona narrante.
- Dividi la scena in paragrafi nei cambi di azione, scoperta o luogo.
- Scrivi esclusivamente in italiano, salvo le stringhe diegetiche già presenti nell'originale.

TESTO ORIGINALE COMPLETO:
${JSON.stringify(text)}

OUTPUT: restituisci soltanto la scena revisionata, dall'inizio alla fine del testo ricevuto. Non aggiungere note, spiegazioni, markdown, JSON, nomi di modelli, messaggi di debug o testo estraneo alla scena.`
    : mode === 'refinement'
    ? `RUOLO: Sei un editor letterario esperto e ghostwriter professionista, specializzato in narrativa d'atmosfera, immersiva e sci-fi/weird.
OBIETTIVO: Migliora stile e grammatica del testo fornito, rendendolo fluido ed efficace senza riassumere né cancellare elementi della trama o del world-building.

REGOLE:
${modeInstruction}

CONTESTO DEL ROMANZO:
${JSON.stringify(bookContext || 'Non disponibile.')}

TESTO ORIGINALE (stringa JSON da revisionare integralmente):
${JSON.stringify(text)}

Rispondi esclusivamente con JSON valido in questa forma: {"improved":"testo integrale revisionato dall'inizio alla fine, con paragrafi separati da righe vuote","explanation":"nota editoriale di una o due frasi"}. La nota deve essere breve e non va inclusa nel testo revisionato. Prima di rispondere, verifica che la revisione arrivi all'ultima frase dell'originale e che tutti i fatti, i nomi, i numeri, le stringhe UI e le azioni siano ancora presenti.`
    : `Sei un editor letterario professionista specializzato in narrativa.
Riscrivi il seguente estratto applicando questo criterio:
${modeInstruction}

ESTRATTO ORIGINALE:
"""${text}"""

Restituisci ESCLUSIVAMENTE un JSON:
{
  "improved": "testo riscritto pronto all'uso",
  "explanation": "2 frasi sintetiche su quali modifiche sono state apportate e perché elevano la narrazione."
}`;

  try {
    if (canUseGemini) {
      const modelName = geminiModel || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetchWithTransientRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: mode === 'refinement' ? 0.2 : 0.4,
            ...(mode !== 'refinement' ? { maxOutputTokens: 850 } : {})
          }
        })
      }, mode === 'refinement' ? 5 : 3);
      if (!res.ok && mode === 'refinement') throw new Error(await getServiceErrorMessage(res, 'Gemini'));
      if (res.ok) {
        const data = await res.json();
        const raw = getGeminiText(data);
        const parsed = parseJsonSafe(raw, null);
        if (parsed?.improved) return parsed;
        if (mode === 'refinement') throw new Error(getGeminiOutputError(data, 'la rifinitura'));
      }
    } else if (canUseCompatible) {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetchWithTransientRetry(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        signal,
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: mode === 'refinement' ? 0.2 : 0.4,
          ...(isOllamaRefinement ? { think: false } : {}),
          ...(mode !== 'refinement' ? { max_tokens: 850 } : {})
        })
      });
      if (!res.ok && mode === 'refinement') throw new Error(await getServiceErrorMessage(res, aiProvider));
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (isOllamaRefinement) {
          const cleanedText = (content || '').replace(/^```(?:text|markdown)?\s*|\s*```$/gi, '').trim();
          if (!cleanedText) throw new Error('Ollama non ha restituito testo per la Rifinitura.');
          return { improved: cleanedText, explanation: '' };
        }
        const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);
        if (parsed?.improved) return parsed;
        if (mode === 'refinement') throw new Error('La risposta AI della Rifinitura non contiene testo valido.');
      }
    }
  } catch (err) {
    if (mode === 'refinement') {
      if (err.name !== 'AbortError') console.warn('Chapter refinement API error', err);
      throw err;
    }
    console.warn('Enhance paragraph API error, using heuristic polish', err);
  }

  if (mode === 'refinement') throw new Error('La Rifinitura non ha prodotto una risposta valida. Riprova.');

  // Intelligent fallback heuristic rewrite tailored to mode
  if (mode === 'pacingBoost') {
    const punchy = text
      .replace(/,\s*(e poi|mentre|quando improvvisamente|a quel punto)\b/gi, '. $1')
      .replace(/\b(improvvisamente|lentamente|assolutamente|decisamente|incredibilmente)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      improved: punchy,
      explanation: 'Accorciati i periodi complessi ed eliminati avverbi lenti per dare urgenza e ritmo alla scena.'
    };
  }

  if (mode === 'dialogueSharp') {
    const sharp = text
      .replace(/\b(disse parlando|esclamò ad alta voce|chiese domandando|rispose dicendo)\b/gi, 'disse')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      improved: sharp,
      explanation: 'Semplificati i verbi di dialogo ed eliminate ridondanze descrittive.'
    };
  }

  if (mode === 'showDontTell') {
    const direct = text
      .replace(/\b(si accorse che|vide che|sentì che|notò che|avvertì che|pareva che|sembrava che)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      improved: direct,
      explanation: 'Rimossi i verbi filtro per rendere la scena viscerale e mostrata direttamente.'
    };
  }

  // sensoryRich or default
  return {
    improved: text.replace(/\b(si accorse che|vide che|sentì che|notò che)\b/gi, '').replace(/\s{2,}/g, ' ').trim(),
    explanation: 'Rimossi i filtri per avvicinare il punto di vista sensoriale agli occhi del protagonista.'
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
      const res = await fetchWithTransientRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 1300 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = getGeminiText(data);
        const parsed = parseJsonSafe(raw, null);
        if (parsed?.titles?.length) {
          const normalizedTitles = parsed.titles.map((t, idx) => {
            if (typeof t === 'string') {
              return { title: t, style: `Proposta ${idx + 1}`, reason: 'Elaborato dai temi narrativi del manoscritto.' };
            }
            return {
              title: t?.title || `Proposta ${idx + 1}`,
              style: t?.style || 'Narrativa',
              reason: t?.reason || 'Evocativo per il tono dell\'opera.'
            };
          });
          return { success: true, ...parsed, titles: normalizedTitles, wordsCount: words.length };
        }
      }
    } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
      const endpoint = (aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint).replace(/\/+$/, '');
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const res = await fetchWithTransientRetry(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key !== 'ollama' ? { 'Authorization': `Bearer ${key}` } : {})
        },
        body: JSON.stringify({
          model: (aiProvider === 'ollama' ? ollamaModel : openaiModel) || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 1300
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = parseJsonSafe(extractJsonFromMarkdown(content), null);
        if (parsed?.titles?.length) {
          const normalizedTitles = parsed.titles.map((t, idx) => {
            if (typeof t === 'string') {
              return { title: t, style: `Proposta ${idx + 1}`, reason: 'Elaborato dai temi narrativi del manoscritto.' };
            }
            return {
              title: t?.title || `Proposta ${idx + 1}`,
              style: t?.style || 'Narrativa',
              reason: t?.reason || 'Evocativo per il tono dell\'opera.'
            };
          });
          return { success: true, ...parsed, titles: normalizedTitles, wordsCount: words.length };
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

  const prompt = `Sei un assistente editoriale discreto per narrativa. Analizza il testo nel suo contesto e rispetta genere, voce, punto di vista e intenzione dell'autrice. Non imporre convenzioni da thriller o regole stilistiche universali.
Segnala solo problemi concreti e verificabili:
1. Refusi o errori grammaticali in italiano (accenti, concordanze).
2. Ambiguita' involontarie che rendono poco chiaro chi agisce o a cosa si riferisce una frase.
3. Ripetizioni involontarie o salti temporali incongruenti.
Non segnalare preferenze personali, frasi lunghe solo perche' lunghe, ne' verbi filtro senza un problema concreto. Se non trovi un problema chiaro, restituisci []. Le citazioni devono essere porzioni esatte del testo.

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

  const res = await fetchWithTransientRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 450 }
    })
  });

  if (!res.ok) throw new Error(getTemporaryServiceError('Gemini', res.status));
  const data = await res.json();
  const rawText = getGeminiText(data);
  return parseJsonSafe(rawText, []);
}

async function reviewWithGemini({ chapterText, chapterTitle, bookContext, apiKey, model }) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `Sei un editor letterario attento all'intenzione dell'autrice. Analizza il capitolo "${chapterTitle}" rispettandone genere, voce e punto di vista. Non imporre convenzioni da thriller, limiti fissi alla lunghezza delle frasi o preferenze stilistiche come fossero regole.
Segnala i problemi concreti che il testo supporta. Cita passaggi esatti e non inventare dettagli mancanti. Per ogni proposta di riscrittura, conserva significato e intenzione; se non c'e' un problema chiaro, non forzare una correzione.

CONTESTO DELL'INTERO ROMANZO:
"""${bookContext || 'Non disponibile.'}"""

TESTO DEL CAPITOLO:
"""${chapterText}"""

Ometti le categorie senza rilievi. Rispondi esclusivamente con un oggetto JSON valido, senza commenti, markdown o testo prima/dopo. Usa solo stringhe, numeri, oggetti e array JSON; non scrivere alternative con il carattere |.
{
  "pacingScore": 85,
  "pacingReview": {
    "tensionLevel": "Media",
    "pacingCritique": "Analisi del ritmo: dove il capitolo accelera e dove rischia di perdere il lettore.",
    "cliffhangerSuggestions": [
      { "type": "Rivelazione", "suggestion": "Idea concreta per chiudere con un colpo di scena", "reason": "Perché funziona" }
    ]
  },
  "showDontTell": [
    { "quote": "citazione esatta solo se il verbo filtro indebolisce davvero questa scena", "critique": "effetto concreto su chiarezza o coinvolgimento", "replacement": "alternativa facoltativa che conserva voce e fatti" }
  ],
  "craft": [
    { "quote": "citazione esatta", "category": "Scena | Personaggio | Dialogo | Punto di vista | Esposizione | Continuita", "critique": "problema narrativo concreto nel contesto", "suggestion": "intervento pratico e conservativo" }
  ],
  "orthography": [
    { "original": "refuso o errore", "fix": "correzione", "explanation": "regola o motivazione" }
  ],
  "rhythm": [
    { "quote": "citazione esatta solo se crea un problema reale di ritmo o chiarezza", "critique": "effetto concreto nel contesto, non la sola lunghezza", "suggestion": "alternativa che mantiene intenzione e voce" }
  ],
  "temporalCoherence": [
    { "passage": "salto temporale", "detectedTense": "tempo trovato", "expectedTense": "tempo coerente", "note": "spiegazione" }
  ],
  "stylisticNotes": [
    { "title": "Punto di forza o spunto narrativo", "note": "osservazione da editor professionista" }
  ]
}`;

  const res = await fetchWithTransientRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    })
  });

  if (!res.ok) throw new Error(getTemporaryServiceError('Gemini', res.status));
  const data = await res.json();
  const rawText = getGeminiText(data);
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

  throw new Error(getGeminiOutputError(data, `il capitolo "${chapterTitle}"`));
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

  const prompt = `Sei un assistente editoriale discreto per narrativa. Rispetta genere, voce, punto di vista e intenzione dell'autrice; non imporre convenzioni da thriller o regole stilistiche universali.
Segnala solo refusi, errori grammaticali, ambiguita' involontarie o salti temporali incongruenti. Non segnalare preferenze personali, frasi lunghe solo perche' lunghe, ne' verbi filtro senza un problema concreto. Se non trovi un problema chiaro, restituisci []. Le citazioni devono essere porzioni esatte del testo.
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

  const res = await fetchWithTransientRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 450
    })
  });

  if (!res.ok) throw new Error(getTemporaryServiceError('OpenAI/Ollama', res.status));
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return parseJsonSafe(extractJsonFromMarkdown(content), []);
}

async function reviewWithOpenAICompatible({ chapterText, chapterTitle, bookContext, endpoint, model, apiKey }) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const prompt = `Sei un editor letterario attento all'intenzione dell'autrice. Analizza il capitolo "${chapterTitle}" rispettandone genere, voce e punto di vista. Non imporre convenzioni da thriller, limiti fissi alla lunghezza delle frasi o preferenze stilistiche come fossero regole.
Segnala i problemi concreti supportati dal testo; cita passaggi esatti e non inventare dettagli. Non forzare una proposta di riscrittura se la frase funziona nel contesto.

CONTESTO DELL'INTERO ROMANZO:
"""${bookContext || 'Non disponibile.'}"""
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
    { "quote": "citazione esatta solo se il verbo filtro indebolisce davvero questa scena", "critique": "effetto concreto su chiarezza o coinvolgimento", "replacement": "alternativa facoltativa che conserva voce e fatti" }
  ],
  "craft": [ { "quote": "citazione esatta", "category": "Scena | Personaggio | Dialogo | Punto di vista | Esposizione | Continuita", "critique": "problema narrativo concreto nel contesto", "suggestion": "intervento pratico e conservativo" } ],
  "orthography": [ { "original": "...", "fix": "...", "explanation": "..." } ],
  "rhythm": [ { "quote": "citazione esatta", "critique": "effetto concreto nel contesto, non la sola lunghezza", "suggestion": "alternativa che mantiene intenzione e voce" } ],
  "temporalCoherence": [ { "passage": "...", "detectedTense": "...", "expectedTense": "...", "note": "..." } ],
  "stylisticNotes": [ { "title": "...", "note": "..." } ]
}

TESTO:
${chapterText}`;

  const res = await fetchWithTransientRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })
  });

  if (!res.ok) throw new Error(getTemporaryServiceError('OpenAI/Ollama', res.status));
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

  throw new Error('Il provider AI ha risposto, ma il report del capitolo non contiene JSON valido. Riprova l’analisi.');
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
export function parseJsonSafe(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const match = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        // Strip trailing commas before closing braces/brackets
        const cleaned = match[0].replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(cleaned);
      }
    } catch {
      try {
        const match = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
          // Normalize unescaped newlines within json strings
          const sanitized = match[0]
            .replace(/(?<!\\)\r?\n/g, ' ')
            .replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(sanitized);
        }
      } catch {}
    }
    return fallback;
  }
}

export function extractJsonFromMarkdown(md) {
  if (!md) return '';
  const match = md.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match ? match[1].trim() : md.trim();
}
