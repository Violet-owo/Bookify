// AI Novel Bible Companion Engine for Bookify
// Automatically extracts characters, settings/locations, and plot points from chapter text.
import { fetchAIWithUsage } from './aiService';

/**
 * Auto-extract entities from current chapter text
 */
export async function extractBibleEntities({ chapterTitle, chapterContent, currentBible = {}, settings = {} }) {
  if (!chapterContent || chapterContent.trim().length < 40) {
    return { characters: [], locations: [], plotBeats: [], newlyDiscoveredCount: 0 };
  }

  const { aiProvider, geminiApiKey, geminiModel, openaiApiKey, openaiEndpoint, openaiModel, ollamaEndpoint, ollamaModel } = settings;

  // 1. Try remote AI if available
  if (aiProvider === 'gemini' && geminiApiKey) {
    try {
      const result = await extractWithGemini({ chapterTitle, chapterContent, currentBible, apiKey: geminiApiKey, model: geminiModel });
      if (result) return mergeWithExistingBible(result, currentBible, chapterContent);
    } catch (err) {
      console.warn('Gemini Bible extraction failed; preserving current Bible:', err);
      return { updatedBible: currentBible, newlyDiscoveredCount: 0, extracted: { characters: [], locations: [], plotBeats: [] }, error: err.message };
    }
  } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
    try {
      const endpoint = aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint;
      const model = aiProvider === 'ollama' ? ollamaModel : openaiModel;
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const result = await extractWithOpenAICompatible({ chapterTitle, chapterContent, currentBible, endpoint, model, apiKey: key });
      if (result) return mergeWithExistingBible(result, currentBible, chapterContent);
    } catch (err) {
      console.warn('OpenAI/Ollama Bible extraction failed; preserving current Bible:', err);
      return { updatedBible: currentBible, newlyDiscoveredCount: 0, extracted: { characters: [], locations: [], plotBeats: [] }, error: err.message };
    }
  }

  // 2. High-Precision Local Heuristic Extraction (Offline Companion)
  const localResult = extractLocalHeuristics(chapterTitle, chapterContent, currentBible);
  return mergeWithExistingBible(localResult, currentBible, chapterContent);
}

/**
 * Local Heuristic Extractor for Italian Narrative
 */
function extractLocalHeuristics(chapterTitle, text, currentBible) {
  const characters = [];
  const locations = [];
  const plotBeats = [];

  const existingCharNames = new Set((currentBible.characters || []).map(c => c.name.toLowerCase()));
  const existingLocNames = new Set((currentBible.worldNotes || '').toLowerCase());

  // A. Check for First-Person Narrator Protagonist
  const isFirstPerson = /\b(iniziai|svegliarmi|tornava lucida la mia|mia testa|mi trovo|sono finita|CHI SONO IO|sentii|corsi|vidi)\b/i.test(text);
  if (isFirstPerson && !existingCharNames.has('protagonista (narratore)') && !existingCharNames.has('narratore')) {
    const isFemale = /\b(intorbidita|intorpidita|finita|svegliata|sola|sicura|stanca)\b/i.test(text);
    characters.push({
      id: `char-auto-${Date.now()}-protagonist`,
      name: isFemale ? 'Protagonista (Narratrice)' : 'Protagonista (Narratore)',
      role: 'Protagonista Principale',
      goal: 'Comprendere la propria identità e la ragione della propria presenza nel luogo del risveglio.',
      flaw: 'Amnesia e disorientamento iniziale.',
      notes: isFemale 
        ? 'Narrazione in prima persona. Si risveglia intorpidita, circondata da odore di cemento e polvere, interrogandosi su "CHI SONO IO?".'
        : 'Narrazione in prima persona. Si risveglia disorientato con perdita temporanea di memoria.'
    });
  }

  // B. Detect full names first, then avoid re-adding their individual parts.
  const fullNameRegex = /\b([A-ZÀ-Þ][a-zà-ÿ'-]{2,}(?:\s+[A-ZÀ-Þ][a-zà-ÿ'-]{2,}){1,2})\b/g;
  let fullNameMatch;
  while ((fullNameMatch = fullNameRegex.exec(text)) !== null) {
    const candidate = fullNameMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (commonLocationOrSentenceWord(firstWord)) continue;
    if (!characters.some(character => character.name.toLowerCase() === candidate.toLowerCase())) {
      characters.push({
        id: `char-auto-${Date.now()}-${candidate.toLowerCase().replace(/\s+/g, '-')}`,
        name: candidate,
        role: 'Personaggio citato',
        goal: '',
        flaw: '',
        notes: `Nome completo citato nel capitolo "${chapterTitle}".`
      });
    }
  }

  // Detect titled or single-word character mentions conservatively.
  const properNameRegex = /\b(Dottor|Dottore|Dottoressa|Padre|Ispettore|Signor|Signora|Capitano|Professore|Professor)\s+([A-ZÀ-Ù][a-zà-ù]+)\b|\b([A-ZÀ-Ù][a-zà-ù]{3,})\b/g;
  let match;

  while ((match = properNameRegex.exec(text)) !== null) {
    const candidate = match[2] ? `${match[1]} ${match[2]}` : match[3];
    if (!candidate) continue;
    const lower = candidate.toLowerCase();

    if (commonLocationOrSentenceWord(lower) || existingCharNames.has(lower) || lower.length < 4) continue;
    
    // Check if candidate is already in our temp array
    if (characters.some(c => c.name.toLowerCase() === lower || c.name.toLowerCase().split(/\s+/).includes(lower))) continue;

    // Check sentence start: only consider if preceded by lowercase or dialogue quote
    const beforeIndex = match.index;
    const charBefore = text.slice(Math.max(0, beforeIndex - 2), beforeIndex).trim();
    const isStartOfSentence = charBefore === '.' || charBefore === '?' || charBefore === '!' || beforeIndex === 0;

    // If it has a title (Dottor, Padre, etc.) or appears after a verb
    if (match[1] || !isStartOfSentence) {
      characters.push({
        id: `char-auto-${Date.now()}-${lower}`,
        name: candidate,
        role: 'Personaggio Secondario / Chiave',
        goal: 'Rivelare o celare informazioni cruciali per il protagonista.',
        flaw: 'Indefinito nella bozza iniziale.',
        notes: `Rilevato nel testo di "${chapterTitle}".`
      });
      existingCharNames.add(lower);
    }
  }

  // C. Detect only named places introduced with an explicit location cue.
  const namedLocationRegex = /\b(?:città|cittadina|villaggio|paese|isola)\s+(?:(?:di|chiamata|detta)\s+)?([A-ZÀ-Þ][\p{L}'’-]{2,})\b/gu;
  let locationMatch;
  while ((locationMatch = namedLocationRegex.exec(text)) !== null) {
    const name = locationMatch[1].trim();
    if (existingLocNames.has(name.toLowerCase())) continue;
    locations.push({
      id: `loc-auto-${Date.now()}-${name.toLowerCase()}`,
      title: name,
      category: 'Città o luogo nominato',
      description: `Luogo nominato esplicitamente nel capitolo "${chapterTitle}".`
    });
    existingLocNames.add(name.toLowerCase());
  }

  // D. Detect Plot Beats (Major Turning Points & Dramatic Questions)
  const questionMatches = text.match(/([A-ZÀ-Ù][^.!?]*\?)/g) || [];
  const dramaticQuestions = questionMatches.filter(q => /\b(chi sono|dove mi trovo|come sono|perché|chi c'è)\b/i.test(q));

  if (dramaticQuestions.length > 0) {
    plotBeats.push({
      id: `plot-auto-${Date.now()}`,
      title: `Incidente: ${chapterTitle}`,
      tensionLevel: 'Alta',
      summary: `La protagonista riprende coscienza in una situazione sconosciuta senza memoria: "${dramaticQuestions[0].trim()}"`
    });
  }

  return { characters, locations, plotBeats };
}

/**
 * AI Extraction via Gemini API
 */
async function extractWithGemini({ chapterTitle, chapterContent, currentBible, apiKey, model }) {
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const knownCharacters = (currentBible.characters || []).map(character => character.name).filter(Boolean);
  const knownLocations = [...(currentBible.worldNotes || '').matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);

  const prompt = `Sei un curatore prudente della Bibbia del Romanzo. Estrai solo entità esplicitamente presenti nel capitolo, senza dedurle da parole maiuscole, oggetti o descrizioni generiche.
PERSONAGGI: una voce per persona e sempre il nome completo. Non dividere nome e cognome in personaggi distinti; unisci le varianti chiaramente riferite alla stessa persona. Se un nome è già nella Bibbia, riusa esattamente la forma canonica.
LUOGHI: inserisci solo luoghi con un nome proprio esplicitamente citato (per esempio una città chiamata KAVALA). Non trasformare una stanza, un odore, un edificio generico o una parola a inizio frase in un luogo distinto. Riusa la forma canonica già presente.
SNODI DI TRAMA: solo eventi narrativi effettivi, non domande retoriche o dettagli d'ambiente.

PERSONAGGI CANONICI ESISTENTI: ${JSON.stringify(knownCharacters)}
LUOGHI CANONICI ESISTENTI: ${JSON.stringify(knownLocations)}

Analizza il capitolo "${chapterTitle}". Per ogni personaggio: name, role, goal, flaw, notes. Per ogni luogo: title, category, description. Per ogni snodo: title, tensionLevel, summary. Se un'entità non è certa o non è nominata nel testo, omettila.

TESTO DEL CAPITOLO:
"""
${chapterContent.slice(0, 3500)}
"""

Rispondi ESCLUSIVAMENTE in formato JSON con la seguente struttura:
{
  "characters": [ { "name": "...", "role": "...", "goal": "...", "flaw": "...", "notes": "..." } ],
  "locations": [ { "title": "...", "category": "...", "description": "..." } ],
  "plotBeats": [ { "title": "...", "tensionLevel": "...", "summary": "..." } ]
}`;

  const res = await fetchAIWithUsage(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 800 }
    })
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .replace(/^```(?:json)?\s*|\s*```$/gi, '')
    .trim();
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.characters) || !Array.isArray(parsed.locations)) {
    throw new Error('Gemini ha restituito una Bibbia non valida.');
  }
  return parsed;
}

/**
 * AI Extraction via OpenAI Compatible API
 */
async function extractWithOpenAICompatible({ chapterTitle, chapterContent, currentBible, endpoint, model, apiKey }) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/chat/completions`;
  const knownCharacters = (currentBible.characters || []).map(character => character.name).filter(Boolean);
  const knownLocations = [...(currentBible.worldNotes || '').matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);

  const prompt = `Sei un curatore prudente della Bibbia del Romanzo. Estrai solo entità esplicitamente presenti nel capitolo, senza dedurle da parole maiuscole, oggetti o descrizioni generiche.
PERSONAGGI: una voce per persona e sempre il nome completo. Non dividere nome e cognome in personaggi distinti; unisci le varianti chiaramente riferite alla stessa persona. Se un nome è già nella Bibbia, riusa esattamente la forma canonica.
LUOGHI: inserisci solo luoghi con un nome proprio esplicitamente citato. Non trasformare una stanza, un odore, un edificio generico o una parola a inizio frase in un luogo distinto. Riusa la forma canonica già presente.
SNODI DI TRAMA: solo eventi narrativi effettivi, non domande retoriche o dettagli d'ambiente.
PERSONAGGI CANONICI ESISTENTI: ${JSON.stringify(knownCharacters)}
LUOGHI CANONICI ESISTENTI: ${JSON.stringify(knownLocations)}
Analizza "${chapterTitle}" e restituisci soltanto JSON valido:
{
  "characters": [ { "name": "...", "role": "...", "goal": "...", "flaw": "...", "notes": "..." } ],
  "locations": [ { "title": "...", "category": "...", "description": "..." } ],
  "plotBeats": [ { "title": "...", "tensionLevel": "...", "summary": "..." } ]
}

TESTO:
${chapterContent.slice(0, 3500)}`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetchAIWithUsage(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800
    })
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
  if (!parsed || !Array.isArray(parsed.characters) || !Array.isArray(parsed.locations)) {
    throw new Error('Il provider AI ha restituito una Bibbia non valida.');
  }
  return parsed;
}

/**
 * Merge extracted entities into the active Novel Bible without duplication
 */
export function mergeWithExistingBible(extracted, currentBible = {}, chapterContent = '') {
  const normalized = normalizeExtractedEntities(extracted, chapterContent, currentBible);
  const updatedBible = { ...currentBible };
  let newlyDiscoveredCount = 0;

  // 1. Merge Characters
  const canonicalNewNames = (normalized.characters || []).map(character => character.name.toLowerCase().split(/\s+/));
  const existingChars = (Array.isArray(updatedBible.characters) ? [...updatedBible.characters] : []).filter(character => {
    if (!character.isAiAutoExtracted || !chapterContent) return true;
    const existingName = (character.name || '').toLowerCase().trim();
    if (existingName.includes(' ')) return true;
    return !canonicalNewNames.some(tokens => tokens.length > 1 && tokens.includes(existingName) && findMention(chapterContent, tokens.join(' ')));
  });
  const existingCharNames = new Set(existingChars.map(c => c.name.toLowerCase().trim()));

  if (Array.isArray(normalized.characters)) {
    normalized.characters.forEach(newChar => {
      const cleanName = (newChar.name || '').trim();
      if (cleanName && !existingCharNames.has(cleanName.toLowerCase())) {
        existingChars.push({
          id: newChar.id || `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          role: newChar.role || 'Personaggio Rilevato',
          goal: newChar.goal || '',
          flaw: newChar.flaw || '',
          notes: newChar.notes || '',
          isAiAutoExtracted: true
        });
        existingCharNames.add(cleanName.toLowerCase());
        newlyDiscoveredCount++;
      }
    });
  }
  updatedBible.characters = existingChars;

  // 2. Merge Locations into worldNotes
  if (Array.isArray(normalized.locations) && normalized.locations.length > 0) {
    let currentWorld = updatedBible.worldNotes || '';
    normalized.locations.forEach(loc => {
      if (!currentWorld.toLowerCase().includes(loc.title.toLowerCase())) {
        currentWorld += (currentWorld ? '\n\n' : '') + `• [${loc.title}]: ${loc.description}`;
        newlyDiscoveredCount++;
      }
    });
    updatedBible.worldNotes = currentWorld;
  }

  // 3. Merge Plot Beats
  const existingPlots = Array.isArray(updatedBible.plotNotes) ? [...updatedBible.plotNotes] : [];
  const existingPlotTitles = new Set(existingPlots.map(p => (p.title || p.summary || '').toLowerCase()));

  if (Array.isArray(normalized.plotBeats)) {
    normalized.plotBeats.forEach(beat => {
      const beatTitle = (beat.title || beat.summary || '').toLowerCase();
      if (beatTitle && !existingPlotTitles.has(beatTitle)) {
        existingPlots.push({
          id: beat.id || `plot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: beat.title || 'Nuovo Snodo Narrativo',
          tensionLevel: beat.tensionLevel || 'Media',
          summary: beat.summary || '',
          isAiAutoExtracted: true
        });
        existingPlotTitles.add(beatTitle);
        newlyDiscoveredCount++;
      }
    });
  }
  updatedBible.plotNotes = existingPlots;

  return {
    updatedBible,
    newlyDiscoveredCount,
    extracted: normalized
  };
}

function normalizeExtractedEntities(extracted = {}, chapterContent = '', currentBible = {}) {
  const sourceCharacters = (extracted.characters || [])
    .map(character => ({ ...character, name: findMention(chapterContent, character.name || '') }))
    .filter(character => character.name && !commonLocationOrSentenceWord(character.name.toLowerCase()));
  const mergedCharacters = [];
  const consumed = new Set();

  for (let firstIndex = 0; firstIndex < sourceCharacters.length; firstIndex += 1) {
    const first = sourceCharacters[firstIndex];
    if (first.name.includes(' ')) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < sourceCharacters.length; secondIndex += 1) {
      const second = sourceCharacters[secondIndex];
      if (second.name.includes(' ')) continue;
      const fullName = findMention(chapterContent, `${first.name} ${second.name}`)
        || findMention(chapterContent, `${second.name} ${first.name}`);
      if (!fullName) continue;

      mergedCharacters.push({
        ...first,
        name: fullName,
        role: first.role || second.role,
        goal: first.goal || second.goal,
        flaw: first.flaw || second.flaw,
        notes: [first.notes, second.notes].filter(Boolean).join(' ')
      });
      consumed.add(firstIndex);
      consumed.add(secondIndex);
      break;
    }
  }

  const fullNameCandidates = [
    ...(currentBible.characters || []).map(character => character.name || ''),
    ...sourceCharacters.filter(character => character.name.includes(' ')).map(character => character.name),
    ...mergedCharacters.map(character => character.name)
  ];
  sourceCharacters.forEach((character, index) => {
    if (consumed.has(index)) return;
    const nameParts = character.name.toLowerCase().split(/\s+/);
    if (nameParts.length === 1 && fullNameCandidates.some(fullName => {
      const fullParts = fullName.toLowerCase().split(/\s+/);
      return fullParts.length > 1 && fullParts.includes(nameParts[0]) && findMention(chapterContent, fullName);
    })) return;
    mergedCharacters.push(character);
  });

  const uniqueCharacters = [];
  const seenCharacters = new Set();
  mergedCharacters.forEach(character => {
    const key = character.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenCharacters.has(key)) return;
    seenCharacters.add(key);
    uniqueCharacters.push(character);
  });

  const locations = [];
  const seenLocations = new Set();
  (extracted.locations || []).forEach(location => {
    const title = findMention(chapterContent, location.title || '');
    const key = title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!title || seenLocations.has(key) || commonLocationOrSentenceWord(key)) return;
    seenLocations.add(key);
    locations.push({ ...location, title });
  });

  return {
    characters: uniqueCharacters,
    locations,
    plotBeats: Array.isArray(extracted.plotBeats) ? extracted.plotBeats : []
  };
}

function findMention(text, phrase) {
  if (!text || !phrase) return '';
  const escaped = phrase.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = text.match(new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu'));
  return match?.[2] || '';
}

function commonLocationOrSentenceWord(word) {
  return new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'nel', 'nella',
    'questo', 'questa', 'quello', 'quella', 'quando', 'mentre', 'dopo', 'prima', 'allora', 'senza',
    'anche', 'tutti', 'ogni', 'città', 'paese', 'villaggio', 'isola', 'stanza', 'corridoio', 'biblioteca'
  ]).has(word);
}
