import { invoke } from '@tauri-apps/api/core';

// Storage & Document Management Engine for Bookify (Multi-Book & Novel Bible Architecture)

const STORAGE_KEY_LIBRARY = 'bookify_library_v2';
const STORAGE_KEY_SETTINGS = 'bookify_settings_v2';
const LEGACY_STORAGE_KEY_BOOK = 'bookify_book_data_v1';
const LEGACY_STORAGE_KEY_SETTINGS = 'bookify_settings_v1';
const REALTIME_PREFERENCE_KEY = 'bookify_realtime_correction_preference_v1';

export const DEFAULT_SETTINGS = {
  // Temi & Atmosfera d'Autore
  theme: 'parchment', // 'parchment' | 'serika' | 'dracula' | 'nord' | 'botanical' | 'coffee' | 'carbon' | 'matrix' | 'solarized' | 'gruvbox' | 'cyber' | 'oled'
  fontFamily: "'Lora', Georgia, serif", // Literary serif default
  fontSize: 19,
  lineHeight: 2.1,
  textAlignment: 'left', // 'left' | 'justify'
  editorWidth: 'standard', // 'compact' (700px) | 'standard' (840px) | 'wide' (980px)
  
  // Confine della Pagina, Tipografia & Focus
  pageBoundaryStyle: 'shadow', // 'none' | 'shadow' | 'border' | 'sheet' | 'vintage' | 'dotted'
  editorialIndent: true, // Rientro prima riga dei capoversi (1.8em da libro stampato)
  smartPunctuation: true, // Punteggiatura tipografica automatica («», —, …)
  lineFocusBlur: true, // Sfocatura righe non attive durante la digitazione
  lineFocusIntensity: 'medium', // 'soft' | 'medium' | 'strong'
  showLineHUD: true, // Barra / indicatore riga attuale HUD laterale
  lineHUDStyle: 'pill', // 'pill' | 'minimal' | 'bar'
  lineHUDCountMode: 'visual', // 'visual' (righe reali a schermo) | 'paragraphs' (capoversi)
  
  // Animazioni & Transizioni Fluent / Material 3
  enableAnimations: true,
  animationPreset: 'medium', // 'fast' (150ms) | 'medium' (280ms) | 'slow' (450ms) | 'custom'
  animationDurationMs: 280,
  
  typewriterMode: true,
  focusMode: false,
  autoHideUIOnType: true, // Dissolvenza automatica dell'interfaccia durante la scrittura, sempre visibile a riposo
  
  // Paesaggi Sonori & Switch Tasti
  soundEnabled: true,
  soundVolume: 0.55,
  soundProfile: 'akko', // 'akko' | 'thock' | 'hitmarker' | 'cherry_blue' | 'gateron_black' | 'holy_panda' | 'bubble_wrap' | 'model_m' | 'topre' | 'typewriter' | 'rain_keys' | 'wooden' | 'velvet'
  ambientTrack: 'none', // 'none' | 'rain' | 'fireplace' | 'alpha' | 'autumn' | 'cafe' | 'vinyl'
  ambientVolume: 0.35,

  // Configurazione AI & Editor Letterario
  aiProvider: 'claude', // 'claude' | 'gemini' | 'openai' | 'ollama'
  claudeApiKey: '',
  claudeModel: 'claude-opus-5-5', // 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
  geminiApiKey: localStorage.getItem('bookify_gemini_api_key') || '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiEndpoint: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  ollamaEndpoint: 'http://localhost:11434/v1',
  ollamaModel: 'llama3:latest',
  
  // Impostazioni Ritmo Narrativo & Companion
  chunkCheckingEnabled: false,
  narrativePacingMode: true, // Analisi ritmo incalzante, cadenza periodi e cliffhanger
  showDontTellAssistant: true, // Rileva verbi filtro passivi
  inlineTypoAlerts: true, // Rileva refusi, doppie ed errori ortografici
  autoSyncBible: true, // Auto-compila personaggi e luoghi nella Bibbia durante la scrittura
  wordGoal: 2000,

  // Salvataggio & File Locale PC
  autosaveEnabled: true,
  autosaveIntervalSeconds: 30, // 10 | 30 | 60 | 120 | 300 | 0 (disattivato)

  // Lingua dell'applicazione & AI
  language: 'it', // 'it' | 'en'
  developerPortfolioUrl: 'https://portfolio.violetvrc30.workers.dev/'
};

const DEFAULT_INITIAL_BOOK = {
  id: 'book-nebula',
  title: 'Il Codice dell\'Ombra',
  subtitle: 'Un thriller tra storia e cospirazione',
  author: 'Autore Indipendente',
  genre: 'Thriller Storico / Mistero',
  targetWords: 60000,
  coverColor: '#d35400',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  currentChapterId: 'chap-1',
  chapters: [
    {
      id: 'chap-1',
      title: 'Capitolo 1: La Cripta dei Sospesi',
      order: 1,
      synopsis: 'La fuga precipitosa sotto la pioggia e la scoperta della pergamena sigillata.',
      content: `La pioggia sferzava i gargoyle di pietra scura con la violenza di un avvertimento ignorato troppo a lungo.

Marcus sollevò il bavero del cappotto di lana bagnata, stringendosi contro l'arco d'ingresso della biblioteca pontificia. Il suo respiro formava dense volute bianche nell'aria gelida di novembre. Le campane di Santa Maria suonarono tre rintocchi sordi: le tre del mattino. L'orario stabilito.

La chiave a tre denti pesava nella sua tasca destra come un pezzo di ferro rovente. Se i custodi dell'archivio si fossero accorti del duplicato, la sua carriera sarebbe finita entro l'alba. E forse non soltanto la sua carriera.

Un cigolio metallico ruppe la quiete spettrale del chiostro.

Una sagoma avvolta in una tonaca scura emerse dal buio delle arcate, muovendosi con una fretta insolita per chi aveva passato cinquant'anni nel silenzio monastico. L'uomo teneva contro il petto una borsa di cuoio consumata. I suoi occhi cercarono disperatamente il buio prima di posarsi su Marcus.

"Non dovevi venire," mormorò il monaco, con la voce rotta dal terrore. "Hanno già aperto il terzo sigillo."

Marcus non ebbe il tempo di rispondere. Nel silenzio della notte, il rumore inequivocabile di un cane armato risuonò a meno di dieci metri dalle loro spalle.`,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'chap-2',
      title: 'Capitolo 2: Il Segreto di San Galgano',
      order: 2,
      synopsis: 'L\'inseguimento nei vicoli e la decifrazione del primo indizio nascosto.',
      content: `L'eco dello sparo cancellò ogni esitazione.

Marcus afferrò il monaco per il braccio, spingendolo nel varco umido del vicolo laterale prima che un secondo proiettile scheggiasse il travertino del colonnato. Frammenti di pietra calda gli sfiorarono la guancia sinistra.

"Corri verso il fiume!" sibilò Marcus, sentendo il battito cardiaco pulsargli violento nelle tempie.

Non c'era tempo per chiedersi chi fossero gli inseguitori o come avessero fatto a rintracciarli con tanta precisione chirurgica. Nella mano stringeva ora il cilindro di bronzo che il vecchio gli aveva passato un istante prima di inciampare: all'esterno recava incisa una sequenza di dodici lettere latine senza spazi. Un crittogramma a sostituzione mobile.

La prima regola dei maestri dell'enigma era semplice: se il nemico ti spara addosso, significa che sei esattamente dove non dovresti essere.`,
      updatedAt: new Date().toISOString(),
    }
  ],
  // Novel Bible: The secret weapon for ambitious independent authors
  bible: {
    synopsis: 'Un thriller incalzante incentrato su un antico crittogramma vaticano che minaccia di riscrivere la storia delle reliquie europee.',
    characters: [
      {
        id: 'char-1',
        name: 'Marcus Vance',
        role: 'Protagonista / Epigrafista Forense',
        goal: 'Decifrare il rotolo prima che la congregazione lo distrugga.',
        flaw: 'Ossessivo verso i dettagli storici a costo della propria incolumità.',
        notes: 'Ex docente a Bologna, memoria fotografica per simboli arcaici.'
      },
      {
        id: 'char-2',
        name: 'Padre Anselmo',
        role: 'Alleato e Mentore',
        goal: 'Proteggere il segreto dell\'archivio segreto.',
        flaw: 'Fiducia cieca nelle gerarchie ecclesiastiche fino all\'inevitabile tradimento.',
        notes: 'Custode anziano della sezione manoscritti rari.'
      }
    ],
    plotNotes: [
      {
        id: 'plot-1',
        title: 'Incidente Scatenante',
        tensionLevel: 'Alta',
        summary: 'Uccisione del custode e fuga con il crittogramma di bronzo.'
      },
      {
        id: 'plot-2',
        title: 'Punto di Non Ritorno',
        tensionLevel: 'Altissima',
        summary: 'Scoperta che il mandante è la stessa persona che aveva finanziato la spedizione.'
      }
    ],
    worldNotes: 'Roma notturna autunnale: chiostri bagnati, passaggi sotterranei lungo il Tevere, archivi polverosi e tecnologia di decrittazione moderna in contrasto con pergamene del XII secolo.'
  }
};

/**
 * Load Entire Multi-Book Library
 */
export function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIBRARY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.books) && parsed.books.length > 0) {
        return parsed;
      }
    }

    // Check legacy migration from v1 single book
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_BOOK);
    if (legacyRaw) {
      const legacyBook = JSON.parse(legacyRaw);
      if (legacyBook && legacyBook.chapters) {
        const migratedLibrary = {
          activeBookId: legacyBook.id || 'book-migrated',
          books: [
            {
              ...DEFAULT_INITIAL_BOOK,
              id: legacyBook.id || 'book-migrated',
              title: legacyBook.title || 'Il Mio Romanzo',
              chapters: legacyBook.chapters,
              currentChapterId: legacyBook.currentChapterId || legacyBook.chapters[0]?.id || 'chap-1'
            }
          ]
        };
        saveLibrary(migratedLibrary);
        return migratedLibrary;
      }
    }
  } catch (err) {
    console.warn('Failed to load library, restoring default structure', err);
  }

  const initialLib = {
    activeBookId: DEFAULT_INITIAL_BOOK.id,
    books: [DEFAULT_INITIAL_BOOK]
  };
  saveLibrary(initialLib);
  return initialLib;
}

/**
 * Save Entire Multi-Book Library
 */
export function saveLibrary(library) {
  try {
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(library));
    return true;
  } catch (err) {
    console.error('Failed to save library', err);
    return false;
  }
}

/**
 * Create a New Book inside the Library
 */
export function createNewBook(title = 'Nuovo Romanzo', genre = 'Narrativa', language = 'it') {
  const isEn = language === 'en';
  const newId = `book-${Date.now()}`;
  const firstChapId = `chap-${Date.now()}-1`;
  
  const colors = ['#e67e22', '#3498db', '#9b59b6', '#1abc9c', '#e74c3c', '#f1c40f'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const newBook = {
    id: newId,
    title,
    subtitle: '',
    author: isEn ? 'Author' : 'Autore',
    genre,
    targetWords: 50000,
    coverColor: randomColor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentChapterId: firstChapId,
    chapters: [
      {
        id: firstChapId,
        title: isEn ? 'Chapter 1: The Journey Begins' : 'Capitolo 1: Inizio del Viaggio',
        order: 1,
        synopsis: isEn
          ? 'The protagonist is introduced and the ordinary world first breaks.'
          : 'Introduzione del protagonista e primo momento di rottura dell\'ordinario.',
        content: '',
        updatedAt: new Date().toISOString(),
      }
    ],
    bible: {
      synopsis: '',
      characters: [],
      plotNotes: [],
      worldNotes: ''
    }
  };

  return newBook;
}

/**
 * Duplicate an existing book
 */
export function duplicateBook(sourceBook) {
  const newId = `book-${Date.now()}`;
  return {
    ...JSON.parse(JSON.stringify(sourceBook)),
    id: newId,
    title: `${sourceBook.title} (${typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'Copy' : 'Copia'})`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chapters: sourceBook.chapters.map((chap, i) => ({
      ...chap,
      id: `chap-${Date.now()}-${i + 1}`
    }))
  };
}

/**
 * Load Settings with Fallback & Legacy Migration
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const dedicatedKey = localStorage.getItem('bookify_gemini_api_key') || '';
    if (raw) {
      const parsed = JSON.parse(raw);
      // Bulletproof: restore API key if empty in parsed but saved in dedicated storage
      if ((!parsed.geminiApiKey || parsed.geminiApiKey.trim() === '') && dedicatedKey) {
        parsed.geminiApiKey = dedicatedKey;
      }
      // Migrate outdated/unavailable models to modern default
      if (!parsed.geminiModel || parsed.geminiModel === 'gemini-2.5-flash' || parsed.geminiModel === 'gemini-pro') {
        parsed.geminiModel = 'gemini-2.0-flash';
      }
      if (localStorage.getItem(REALTIME_PREFERENCE_KEY) !== 'true') {
        parsed.chunkCheckingEnabled = false;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_SETTINGS);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if ((!parsedLegacy.geminiApiKey || parsedLegacy.geminiApiKey.trim() === '') && dedicatedKey) {
        parsedLegacy.geminiApiKey = dedicatedKey;
      }
      if (localStorage.getItem(REALTIME_PREFERENCE_KEY) !== 'true') {
        parsedLegacy.chunkCheckingEnabled = false;
      }
      return { ...DEFAULT_SETTINGS, ...parsedLegacy };
    }
  } catch (err) {
    console.warn('Failed to load settings', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save Settings
 */
export function saveSettings(settings) {
  try {
    if (settings && typeof settings === 'object') {
      if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
        localStorage.setItem('bookify_gemini_api_key', settings.geminiApiKey.trim());
      } else {
        // The author removed the key: do not resurrect it on next launch
        localStorage.removeItem('bookify_gemini_api_key');
      }
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
      return true;
    }
  } catch (err) {
    console.error('Failed to save settings', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Exports (chapter, whole manuscript, library backup)
// On desktop they use the native "Save as" dialog; in the browser a download.
// ---------------------------------------------------------------------------
const safeFileName = (value, fallback) => (value || fallback).replace(/[^a-zA-Z0-9_À-ſ-]/g, '_');
const today = () => new Date().toISOString().slice(0, 10);

const EXPORT_LABELS = {
  it: { exportedOn: 'Esportato il', author: 'Autore', anonymous: 'Anonimo', untitled: 'Senza titolo', complete: 'Completo', backup: 'Backup_Biblioteca' },
  en: { exportedOn: 'Exported on', author: 'Author', anonymous: 'Anonymous', untitled: 'Untitled', complete: 'Complete', backup: 'Library_Backup' }
};

async function saveTextFile(content, filename, kind) {
  const filters = {
    md: { name: 'Markdown', extensions: ['md'] },
    txt: { name: 'Text', extensions: ['txt'] },
    json: { name: 'JSON', extensions: ['json'] }
  }[kind];

  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    const savedName = await invoke('export_text_file', {
      contents: content,
      defaultName: filename,
      filterName: filters.name,
      extensions: filters.extensions
    });
    return savedName ? { success: true, fileName: savedName } : { success: false, cancelled: true };
  }

  const blob = new Blob([content], { type: kind === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return { success: true, fileName: filename };
}

/** Export a single chapter as Markdown or plain text. */
export function exportChapterFile(chapter, bookTitle = 'Libro', format = 'md', language = 'it') {
  const L = EXPORT_LABELS[language] || EXPORT_LABELS.it;
  const filename = `${safeFileName(chapter.title, 'Capitolo')}_${today()}.${format}`;
  let content = chapter.content || '';
  if (format === 'md') {
    content = `# ${chapter.title || L.untitled}\n\n*${bookTitle} — ${L.exportedOn} ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'it-IT')}*\n\n---\n\n${content}`;
  }
  return saveTextFile(content, filename, format);
}

/** Export the whole manuscript as Markdown or plain text. */
export function exportCompleteBook(book, format = 'md', language = 'it') {
  const L = EXPORT_LABELS[language] || EXPORT_LABELS.it;
  const locale = language === 'en' ? 'en-US' : 'it-IT';
  const filename = `${safeFileName(book.title, 'Mio_Libro')}_${L.complete}_${today()}.${format}`;
  const chapters = [...(book.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  let fullText;
  if (format === 'md') {
    fullText = `# ${book.title}\n${book.subtitle ? `*${book.subtitle}*\n` : ''}*${L.author}: ${book.author || L.anonymous}*\n*${L.exportedOn}: ${new Date().toLocaleString(locale)}*\n\n---\n`;
    chapters.forEach((chap) => {
      fullText += `\n\n## ${chap.title}\n\n${chap.content || ''}\n\n---`;
    });
  } else {
    fullText = `${(book.title || '').toUpperCase()}\n${book.subtitle ? `${book.subtitle}\n` : ''}${L.author}: ${book.author || L.anonymous}\n\n`;
    chapters.forEach((chap) => {
      fullText += `\n\n=== ${chap.title} ===\n\n${chap.content || ''}\n`;
    });
  }
  return saveTextFile(fullText, filename, format);
}

/** Export the entire library (all books) as a JSON backup. */
export function exportProjectBackup(library, language = 'it') {
  const L = EXPORT_LABELS[language] || EXPORT_LABELS.it;
  return saveTextFile(JSON.stringify(library, null, 2), `Bookify_${L.backup}_${today()}.json`, 'json');
}
