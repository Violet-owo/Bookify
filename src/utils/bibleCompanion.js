// AI Novel Bible Companion Engine for Bookify
// Automatically extracts characters, settings/locations, and plot points from chapter text.

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
      if (result) return mergeWithExistingBible(result, currentBible);
    } catch (err) {
      console.warn('Gemini bible extraction error, fallback to local heuristics:', err);
    }
  } else if ((aiProvider === 'openai' && openaiApiKey) || aiProvider === 'ollama') {
    try {
      const endpoint = aiProvider === 'ollama' ? ollamaEndpoint : openaiEndpoint;
      const model = aiProvider === 'ollama' ? ollamaModel : openaiModel;
      const key = aiProvider === 'ollama' ? 'ollama' : openaiApiKey;
      const result = await extractWithOpenAICompatible({ chapterTitle, chapterContent, currentBible, endpoint, model, apiKey: key });
      if (result) return mergeWithExistingBible(result, currentBible);
    } catch (err) {
      console.warn('OpenAI/Ollama bible extraction error, fallback to local heuristics:', err);
    }
  }

  // 2. High-Precision Local Heuristic Extraction (Offline Companion)
  const localResult = extractLocalHeuristics(chapterTitle, chapterContent, currentBible);
  return mergeWithExistingBible(localResult, currentBible);
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

  // B. Detect Capitalized Character Names (e.g. "Marcus", "Elena", "Dottor...", "Padre...")
  const properNameRegex = /\b(Dottor|Dottore|Dottoressa|Padre|Ispettore|Signor|Signora|Capitano|Professore|Professor)\s+([A-ZÀ-Ù][a-zà-ù]+)\b|\b([A-ZÀ-Ù][a-zà-ù]{3,})\b/g;
  let match;
  const commonExclusions = new Set([
    'capitolo', 'questo', 'quella', 'quello', 'mentre', 'dopo', 'prima', 'quando', 'perché',
    'allora', 'invece', 'tuttavia', 'senza', 'anche', 'nessuno', 'qualcuno', 'tutti', 'ogni',
    'dietro', 'davanti', 'dentro', 'fuori', 'sopra', 'sotto', 'verso', 'fino', 'come', 'dove'
  ]);

  while ((match = properNameRegex.exec(text)) !== null) {
    const raw = match[0];
    const candidate = match[2] ? `${match[1]} ${match[2]}` : match[3];
    if (!candidate) continue;
    const lower = candidate.toLowerCase();

    if (commonExclusions.has(lower) || existingCharNames.has(lower) || lower.length < 4) continue;
    
    // Check if candidate is already in our temp array
    if (characters.some(c => c.name.toLowerCase() === lower)) continue;

    // Check sentence start: only consider if preceded by lowercase or dialogue quote
    const beforeIndex = match.index;
    const charBefore = text.slice(Math.max(0, beforeIndex - 2), beforeIndex).trim();
    const isStartOfSentence = charBefore === '.' || charBefore === '?' || charBefore === '!' || beforeIndex === 0;

    // If it has a title (Dottor, Padre, etc.) or appears after a verb
    if (match[1] || (!isStartOfSentence && !commonExclusions.has(lower))) {
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

  // C. Detect Locations / Settings from sensory and architecture markers
  const settingPatterns = [
    { regex: /\b(odore di cemento|legno e polvere|mura di pietra|cripta|chiostro|biblioteca|corridoio antico|laboratorio|vicolo buio|palazzo)\b/gi, name: 'Stanza / Edificio di Cemento e Polvere' },
    { regex: /\b(fiume|ponte|strada bagnata|vicoli di Roma|piazza deserta)\b/gi, name: 'Vicoli Notturni & Fiume' }
  ];

  settingPatterns.forEach(sp => {
    if (sp.regex.test(text) && !existingLocNames.has(sp.name.toLowerCase())) {
      locations.push({
        id: `loc-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: sp.name,
        category: 'Luogo / Ambiente',
        description: `Ambiente caratterizzato da odore di cemento, legno e polvere; atmosfera cupa, fredda e disorientante narrata in "${chapterTitle}".`
      });
    }
  });

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

  const prompt = `Sei l'assistente letterario e curatore della "Bibbia del Romanzo".
Analizza questo capitolo intitolato "${chapterTitle}" ed estrai:
1. PERSONAGGI citati o introdotti (incluso eventuale narratore in prima persona). Per ciascuno: name, role, goal, flaw, notes.
2. LUOGHI / AMBIENTAZIONI descritti (architettura, odori, atmosfera). Per ciascuno: title, category, description.
3. SNODI DI TRAMA (plot beats). Per ciascuno: title, tensionLevel ("Alta"|"Media"|"Altissima"), summary.

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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    })
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(raw);
}

/**
 * AI Extraction via OpenAI Compatible API
 */
async function extractWithOpenAICompatible({ chapterTitle, chapterContent, currentBible, endpoint, model, apiKey }) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/chat/completions`;

  const prompt = `Sei l'assistente letterario e curatore della "Bibbia del Romanzo".
Analizza questo capitolo intitolato "${chapterTitle}" ed estrai entità letterarie in formato JSON:
{
  "characters": [ { "name": "...", "role": "...", "goal": "...", "flaw": "...", "notes": "..." } ],
  "locations": [ { "title": "...", "category": "...", "description": "..." } ],
  "plotBeats": [ { "title": "...", "tensionLevel": "...", "summary": "..." } ]
}

TESTO:
${chapterContent.slice(0, 3500)}`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content.replace(/```json|```/g, '').trim());
}

/**
 * Merge extracted entities into the active Novel Bible without duplication
 */
export function mergeWithExistingBible(extracted, currentBible = {}) {
  const updatedBible = { ...currentBible };
  let newlyDiscoveredCount = 0;

  // 1. Merge Characters
  const existingChars = Array.isArray(updatedBible.characters) ? [...updatedBible.characters] : [];
  const existingCharNames = new Set(existingChars.map(c => c.name.toLowerCase().trim()));

  if (Array.isArray(extracted.characters)) {
    extracted.characters.forEach(newChar => {
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
  if (Array.isArray(extracted.locations) && extracted.locations.length > 0) {
    let currentWorld = updatedBible.worldNotes || '';
    extracted.locations.forEach(loc => {
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

  if (Array.isArray(extracted.plotBeats)) {
    extracted.plotBeats.forEach(beat => {
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
    extracted
  };
}
