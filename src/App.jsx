import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  loadLibrary, 
  saveLibrary, 
  loadSettings, 
  saveSettings,
  duplicateBook
} from './utils/storage';
import { 
  saveProjectToDiskFile, 
  openProjectFromDiskFile, 
  autosaveToConnectedDisk, 
  getActiveConnectedFileName 
} from './utils/fileSync';
import { audioEngine } from './utils/audioEngine';
import TopBar from './components/TopBar';
import Editor from './components/Editor';
import BottomBar from './components/BottomBar';
import ChapterDrawer from './components/ChapterDrawer';
import ChapterReviewModal from './components/ChapterReviewModal';
import SettingsModal from './components/SettingsModal';
import BookshelfModal from './components/BookshelfModal';
import NovelBibleModal from './components/NovelBibleModal';
import BookMetadataModal from './components/BookMetadataModal';
import confetti from 'canvas-confetti';
import { I18nProvider } from './utils/i18n';

export default function App() {
  const [library, setLibrary] = useState(loadLibrary);
  const [settings, setSettings] = useState(loadSettings);

  // Active book lookup
  const activeBook = (library?.books || []).find(b => b.id === library?.activeBookId) || library?.books?.[0];

  // Active chapter id state
  const [currentChapterId, setCurrentChapterId] = useState(() => {
    return activeBook?.currentChapterId || activeBook?.chapters?.[0]?.id || 'chap-1';
  });

  // Modal / Drawer open states
  const [isBookshelfOpen, setIsBookshelfOpen] = useState(false);
  const [isBibleOpen, setIsBibleOpen] = useState(false);
  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBookMetadataOpen, setIsBookMetadataOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);

  // Autosave and Disk File Sync state
  const [lastSavedTime, setLastSavedTime] = useState(new Date());
  const [connectedFileName, setConnectedFileName] = useState(getActiveConnectedFileName);
  const [saveToast, setSaveToast] = useState(null);

  // Autosave timer ref
  const autosaveTimerRef = useRef(null);

  // Active Writing & Immersive UI Auto-Hide state
  const [isWriting, setIsWriting] = useState(false);
  const writingTimerRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const isAnyModalOpen = isBookshelfOpen || isBibleOpen || isChapterDrawerOpen || isReviewModalOpen || isSettingsOpen || isBookMetadataOpen;

  const handleWritingActivity = useCallback(() => {
    if (isAnyModalOpen) return;
    setIsWriting(true);
    if (writingTimerRef.current) clearTimeout(writingTimerRef.current);
    writingTimerRef.current = setTimeout(() => {
      setIsWriting(false);
    }, 1600);
  }, [isAnyModalOpen]);

  // Window mouse movement reveals UI immediately
  useEffect(() => {
    const handleMouseMove = (e) => {
      const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
      const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
      if (dx > 4 || dy > 4) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        if (writingTimerRef.current) {
          clearTimeout(writingTimerRef.current);
        }
        setIsWriting(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (writingTimerRef.current) clearTimeout(writingTimerRef.current);
    };
  }, []);

  // Ensure UI is visible whenever any modal or drawer is active
  useEffect(() => {
    if (isAnyModalOpen) {
      if (writingTimerRef.current) clearTimeout(writingTimerRef.current);
      setIsWriting(false);
    }
  }, [isAnyModalOpen]);

  const isUIWritingHidden = (settings.autoHideUIOnType ?? true) && isWriting && !isAnyModalOpen;

  // Current active chapter object
  const currentChapter = activeBook?.chapters?.find(c => c.id === currentChapterId) || activeBook?.chapters?.[0] || {
    id: 'chap-1',
    title: 'Capitolo 1',
    content: ''
  };

  // Sync theme attribute to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'parchment');
  }, [settings.theme]);

  // Save to Disk File (Manual / Ctrl+S)
  const handleSaveToDisk = useCallback(async () => {
    if (!activeBook) return;
    setIsAutosaving(true);
    try {
      const res = await saveProjectToDiskFile(activeBook);
      if (res.success) {
        setConnectedFileName(res.fileName);
        setLastSavedTime(new Date());
        setSaveToast(`${res.isDirectDisk ? 'Salvato' : 'Scaricato'}: "${res.fileName}"`);
        setTimeout(() => setSaveToast(null), 3500);
      }
    } catch (error) {
      console.error('Errore salvataggio progetto:', error);
      setSaveToast(`Salvataggio non riuscito: ${error.message || 'errore sconosciuto'}`);
      setTimeout(() => setSaveToast(null), 5000);
    } finally {
      setIsAutosaving(false);
    }
  }, [activeBook]);

  // Autosave trigger with debounce
  const triggerAutosave = useCallback((updatedLibrary) => {
    setIsAutosaving(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      saveLibrary(updatedLibrary);
      const currBook = updatedLibrary.books.find(b => b.id === updatedLibrary.activeBookId);
      if (currBook) {
        await autosaveToConnectedDisk(currBook);
      }
      setLastSavedTime(new Date());
      setIsAutosaving(false);
    }, 600);
  }, []);

  // Configurable periodic autosave interval
  useEffect(() => {
    if (!settings.autosaveEnabled || !settings.autosaveIntervalSeconds || settings.autosaveIntervalSeconds <= 0) return;
    const intervalMs = settings.autosaveIntervalSeconds * 1000;
    const timer = setInterval(async () => {
      saveLibrary(library);
      if (activeBook) {
        await autosaveToConnectedDisk(activeBook);
      }
      setLastSavedTime(new Date());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [settings.autosaveEnabled, settings.autosaveIntervalSeconds, library, activeBook]);

  // Open .bookify or .json Project File from PC Disk
  const handleOpenProjectFromDisk = async () => {
    try {
      const res = await openProjectFromDiskFile();
      if (!res || !res.success || !res.data) return;

      const data = res.data;
      const openedFileName = res.fileName || 'progetto.bookify';

      // Case A: Single Book / Novel (.bookify)
      if (data.chapters && data.title) {
        setLibrary((prev) => {
          const existingIndex = prev.books.findIndex(b => b.id === data.id);
          let updatedBooks;
          if (existingIndex >= 0) {
            updatedBooks = prev.books.map(b => b.id === data.id ? data : b);
          } else {
            updatedBooks = [data, ...prev.books];
          }
          const updated = {
            ...prev,
            activeBookId: data.id,
            books: updatedBooks
          };
          saveLibrary(updated);
          return updated;
        });

        const nextChapId = data.currentChapterId || data.chapters[0]?.id || 'chap-1';
        setCurrentChapterId(nextChapId);
        setConnectedFileName(openedFileName);
        setSaveToast(`📖 Romanzo aperto con successo: "${data.title}" (${openedFileName})`);
        setTimeout(() => setSaveToast(null), 4000);
      }
      // Case B: Entire Library Backup (.json)
      else if (Array.isArray(data.books)) {
        handleImportLibrary(data);
        setConnectedFileName(openedFileName);
        setSaveToast(`📚 Biblioteca importata con successo da: "${openedFileName}"`);
        setTimeout(() => setSaveToast(null), 4000);
      } else {
        alert('Il file aperto non contiene una struttura di romanzo .bookify valida.');
      }
    } catch (err) {
      console.error('Errore apertura file:', err);
      alert('Impossibile aprire il file selezionato: ' + (err.message || 'formato non valido'));
    }
  };

  // Switch Active Book
  const handleSelectBook = (bookId) => {
    const targetBook = library.books.find(b => b.id === bookId);
    if (!targetBook) return;

    const nextChapId = targetBook.currentChapterId || targetBook.chapters[0]?.id || 'chap-1';
    setCurrentChapterId(nextChapId);

    setLibrary((prev) => {
      const updated = {
        ...prev,
        activeBookId: bookId
      };
      saveLibrary(updated);
      return updated;
    });
  };

  // Create Book
  const handleCreateBook = (newBook) => {
    setLibrary((prev) => {
      const updated = {
        activeBookId: newBook.id,
        books: [newBook, ...prev.books]
      };
      saveLibrary(updated);
      return updated;
    });
    setCurrentChapterId(newBook.chapters[0]?.id || 'chap-1');
  };

  // Duplicate Book
  const handleDuplicateBook = (sourceBook) => {
    const duplicated = duplicateBook(sourceBook);
    setLibrary((prev) => {
      const updated = {
        ...prev,
        books: [duplicated, ...prev.books]
      };
      saveLibrary(updated);
      return updated;
    });
  };

  // Delete Book
  const handleDeleteBook = (bookId) => {
    if (library.books.length <= 1) return;
    setLibrary((prev) => {
      const remaining = prev.books.filter(b => b.id !== bookId);
      const nextActiveId = prev.activeBookId === bookId ? remaining[0].id : prev.activeBookId;
      const updated = {
        activeBookId: nextActiveId,
        books: remaining
      };
      saveLibrary(updated);
      
      const nextBook = remaining.find(b => b.id === nextActiveId);
      if (nextBook) {
        setCurrentChapterId(nextBook.currentChapterId || nextBook.chapters[0]?.id || 'chap-1');
      }
      return updated;
    });
  };

  // Import whole library backup
  const handleImportLibrary = (newLibrary) => {
    setLibrary(newLibrary);
    saveLibrary(newLibrary);
    const active = newLibrary.books.find(b => b.id === newLibrary.activeBookId) || newLibrary.books[0];
    if (active) {
      setCurrentChapterId(active.currentChapterId || active.chapters[0]?.id || 'chap-1');
    }
  };

  // Update content of active chapter
  const handleUpdateContent = (newContent, newTitle = null) => {
    setLibrary((prevLib) => {
      const updatedBooks = prevLib.books.map((b) => {
        if (b.id === prevLib.activeBookId) {
          const updatedChapters = (b.chapters || []).map((chap) => {
            if (chap.id === currentChapterId) {
              const oldWordCount = (chap.content || '').trim().split(/\s+/).filter(Boolean).length;
              const newWordCount = (newContent || '').trim().split(/\s+/).filter(Boolean).length;

              // Milestone Celebration: reached word goal!
              if (newWordCount >= settings.wordGoal && oldWordCount < settings.wordGoal) {
                try {
                  confetti({
                    particleCount: 85,
                    spread: 75,
                    origin: { y: 0.6 },
                    colors: ['#e5a953', '#7da87b', '#38bdf8']
                  });
                } catch {}
              }

              return {
                ...chap,
                content: newContent,
                title: newTitle !== null ? newTitle : chap.title,
                updatedAt: new Date().toISOString()
              };
            }
            return chap;
          });

          return {
            ...b,
            chapters: updatedChapters,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });

      const updated = { ...prevLib, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Update Book Title
  const handleUpdateBookTitle = (newTitle) => {
    setLibrary((prev) => {
      const updatedBooks = prev.books.map(b => {
        if (b.id === prev.activeBookId) {
          return { ...b, title: newTitle, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      const updated = { ...prev, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Update Full Book Metadata (Title, Author, Genre, Synopsis, TargetWords)
  const handleUpdateBookMetadata = (updatedFields) => {
    setLibrary((prev) => {
      const updatedBooks = prev.books.map(b => {
        if (b.id === prev.activeBookId) {
          return { ...b, ...updatedFields, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      const updated = { ...prev, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Update Novel Bible (Characters, Plot Beats, Lore)
  const handleUpdateBible = (newBible) => {
    setLibrary((prev) => {
      const updatedBooks = prev.books.map(b => {
        if (b.id === prev.activeBookId) {
          return { ...b, bible: newBible, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      const updated = { ...prev, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Add Chapter to active book
  const handleAddChapter = () => {
    const newIndex = (activeBook.chapters || []).length + 1;
    const newChapId = `chap-${Date.now()}`;
    const newChap = {
      id: newChapId,
      title: `Capitolo ${newIndex}: Nuovo Capitolo`,
      order: newIndex,
      content: '',
      updatedAt: new Date().toISOString()
    };

    setLibrary((prev) => {
      const updatedBooks = prev.books.map(b => {
        if (b.id === prev.activeBookId) {
          return {
            ...b,
            chapters: [...b.chapters, newChap],
            currentChapterId: newChapId,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });
      const updated = { ...prev, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
    setCurrentChapterId(newChapId);
  };

  // Delete Chapter from active book
  const handleDeleteChapter = (chapId) => {
    if ((activeBook.chapters || []).length <= 1) return;

    setLibrary((prev) => {
      const updatedBooks = prev.books.map(b => {
        if (b.id === prev.activeBookId) {
          const remaining = b.chapters.filter(c => c.id !== chapId);
          const nextCurrentId = currentChapterId === chapId ? remaining[0].id : currentChapterId;
          setCurrentChapterId(nextCurrentId);
          return {
            ...b,
            chapters: remaining,
            currentChapterId: nextCurrentId,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });
      const updated = { ...prev, books: updatedBooks };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Append cliffhanger to active chapter
  const handleAppendCliffhanger = (cliffhangerText) => {
    if (!currentChapter) return;
    const current = currentChapter.content || '';
    const updated = current.trim() + '\n\n' + cliffhangerText;
    handleUpdateContent(updated);
  };

  // Apply fix from review modal
  const handleApplyFix = (orig, fix, start, end, targetChapterId = currentChapter?.id) => {
    if (!activeBook || !targetChapterId) return;
    if (targetChapterId === currentChapter?.id) {
      const content = currentChapter.content || '';
      if (content.slice(start, end) !== orig) return;
      handleUpdateContent(content.slice(0, start) + fix + content.slice(end));
      return;
    }

    setLibrary(previous => {
      let didUpdate = false;
      const books = previous.books.map(book => {
        if (book.id !== activeBook.id) return book;
        const chapters = (book.chapters || []).map(chapter => {
          const content = chapter.content || '';
          if (chapter.id !== targetChapterId || content.slice(start, end) !== orig) return chapter;
          didUpdate = true;
          return {
            ...chapter,
            content: content.slice(0, start) + fix + content.slice(end),
            updatedAt: new Date().toISOString()
          };
        });
        return didUpdate ? { ...book, chapters, updatedAt: new Date().toISOString() } : book;
      });
      if (!didUpdate) return previous;
      const updated = { ...previous, books };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Toggle settings
  const handleToggleSetting = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveSettings(updated);
      return updated;
    });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Dynamic Material 3 Expressive motion duration
  useEffect(() => {
    const dur = settings.enableAnimations !== false ? `${settings.animationDurationMs || 280}ms` : '0ms';
    document.documentElement.style.setProperty('--anim-duration', dur);
  }, [settings.enableAnimations, settings.animationDurationMs]);

  // Global Keyboard Shortcuts (Ctrl & Function keys)
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      // F11: Fullscreen / Zen mode
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }

      // Ctrl / Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        
        // Ctrl+S: Salva su File PC / Download
        if (key === 's') {
          e.preventDefault();
          handleSaveToDisk();
        }
        // Ctrl+O: Apri file .bookify o .json dal PC
        else if (key === 'o') {
          e.preventDefault();
          handleOpenProjectFromDisk();
        }
        // Ctrl+R: Stanza dell'Editor AI / Revisione
        else if (key === 'r') {
          e.preventDefault();
          setIsReviewModalOpen(prev => !prev);
        }
        // Ctrl+B: Bibbia del Romanzo
        else if (key === 'b') {
          e.preventDefault();
          setIsBibleOpen(prev => !prev);
        }
        // Ctrl+I: Scheda Romanzo & Metadati
        else if (key === 'i') {
          e.preventDefault();
          setIsBookMetadataOpen(prev => !prev);
        }
        // Ctrl+J / Ctrl+K: Cassetto Capitoli
        else if (key === 'j' || key === 'k') {
          e.preventDefault();
          setIsChapterDrawerOpen(prev => !prev);
        }
        // Ctrl+L: Biblioteca / Bookshelf
        else if (key === 'l') {
          e.preventDefault();
          setIsBookshelfOpen(prev => !prev);
        }
        // Ctrl+,: Impostazioni Studio
        else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(prev => !prev);
        }
      }

      // Alt shortcuts (backward compatibility)
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'b' || key === 'l') {
          e.preventDefault();
          setIsBookshelfOpen(prev => !prev);
        } else if (key === 'n') {
          e.preventDefault();
          setIsBibleOpen(prev => !prev);
        } else if (key === 'r') {
          e.preventDefault();
          setIsReviewModalOpen(prev => !prev);
        } else if (key === 'o') {
          e.preventDefault();
          setIsChapterDrawerOpen(prev => !prev);
        } else if (key === 'i') {
          e.preventDefault();
          setIsBookMetadataOpen(prev => !prev);
        } else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(prev => !prev);
        }
      }

      // Escape: Close all modals
      if (e.key === 'Escape') {
        setIsBookshelfOpen(false);
        setIsBibleOpen(false);
        setIsChapterDrawerOpen(false);
        setIsReviewModalOpen(false);
        setIsSettingsOpen(false);
        setIsBookMetadataOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [activeBook, library, handleSaveToDisk]);

  // Drag and Drop support for .bookify and .json files
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.bookify') && !file.name.endsWith('.json')) {
        alert('Trascina un file con estensione .bookify o .json');
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (parsed.chapters && parsed.title) {
          setLibrary((prev) => {
            const existingIndex = prev.books.findIndex(b => b.id === parsed.id);
            let updatedBooks;
            if (existingIndex >= 0) {
              updatedBooks = prev.books.map(b => b.id === parsed.id ? parsed : b);
            } else {
              updatedBooks = [parsed, ...prev.books];
            }
            const updated = {
              ...prev,
              activeBookId: parsed.id,
              books: updatedBooks
            };
            saveLibrary(updated);
            return updated;
          });
          const nextChapId = parsed.currentChapterId || parsed.chapters[0]?.id || 'chap-1';
          setCurrentChapterId(nextChapId);
          setConnectedFileName(file.name);
          setSaveToast(`📖 Romanzo caricato: "${parsed.title}" (${file.name})`);
          setTimeout(() => setSaveToast(null), 4000);
        } else if (Array.isArray(parsed.books)) {
          handleImportLibrary(parsed);
          setConnectedFileName(file.name);
          setSaveToast(`📚 Biblioteca caricata: "${file.name}"`);
          setTimeout(() => setSaveToast(null), 4000);
        } else {
          alert('Il file trascinato non contiene dati di progetto validi.');
        }
      } catch (err) {
        alert('Impossibile aprire il file trascinato: ' + err.message);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Update audio volume, profile, and ambient sound on settings change
  useEffect(() => {
    audioEngine.setVolume(settings.soundVolume);
    audioEngine.setEnabled(settings.soundEnabled);
    if (settings.soundProfile) {
      audioEngine.setProfile(settings.soundProfile);
    }
    if (settings.ambientTrack) {
      audioEngine.startAmbient(settings.ambientTrack);
    }
    if (settings.ambientVolume !== undefined) {
      audioEngine.setAmbientVolume(settings.ambientVolume);
    }
  }, [
    settings.soundVolume, 
    settings.soundEnabled, 
    settings.soundProfile, 
    settings.ambientTrack, 
    settings.ambientVolume
  ]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <I18nProvider
      language={settings.language || 'it'}
      onLanguageChange={(newLang) => {
        handleToggleSetting('language', newLang);
      }}
    >
      <div 
        className="bookify-app"
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
      {/* Save Toast Notification */}
      {saveToast && (
        <div 
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            top: '3.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 150,
            padding: '0.65rem 1.4rem',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: '600',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)'
          }}
        >
          {saveToast}
        </div>
      )}

      {/* Studio TopBar (Clean & Visible by default, hides gracefully while typing) */}
      <TopBar
        book={activeBook}
        currentChapter={currentChapter}
        onOpenBookshelf={() => setIsBookshelfOpen(true)}
        onOpenChapters={() => setIsChapterDrawerOpen(true)}
        onOpenBible={() => setIsBibleOpen(true)}
        onOpenReview={() => setIsReviewModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBookMetadata={() => setIsBookMetadataOpen(true)}
        settings={settings}
        onToggleSetting={handleToggleSetting}
        isAutosaving={isAutosaving}
        lastSavedTime={lastSavedTime}
        connectedFileName={connectedFileName}
        onSaveToDisk={handleSaveToDisk}
        onOpenFileFromDisk={handleOpenProjectFromDisk}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isWriting={isUIWritingHidden}
      />

      {/* Main Distraction-Free Literary Editor Area */}
      <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        <Editor
          chapter={currentChapter}
          onUpdateContent={handleUpdateContent}
          settings={settings}
          book={activeBook}
          onUpdateBible={handleUpdateBible}
          onOpenReview={() => setIsReviewModalOpen(true)}
          onOpenBible={() => setIsBibleOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSaveToDisk={handleSaveToDisk}
          onWritingActivity={handleWritingActivity}
        />
      </main>

      {/* Studio BottomBar (Clean & Visible by default, hides gracefully while typing) */}
      <BottomBar
        currentChapter={currentChapter}
        settings={settings}
        lastSavedTime={lastSavedTime}
        connectedFileName={connectedFileName}
        onSaveToDisk={handleSaveToDisk}
        onOpenFileFromDisk={handleOpenProjectFromDisk}
        onToggleFullscreen={toggleFullscreen}
        onOpenReview={() => setIsReviewModalOpen(true)}
        onOpenBible={() => setIsBibleOpen(true)}
        isWriting={isUIWritingHidden}
      />

      {/* Book Metadata & Editorial Info Modal */}
      <BookMetadataModal
        isOpen={isBookMetadataOpen}
        onClose={() => setIsBookMetadataOpen(false)}
        book={activeBook}
        onUpdateBook={handleUpdateBookMetadata}
        settings={settings}
      />

      {/* Bookshelf Modal (Multi-Book Library) */}
      <BookshelfModal
        isOpen={isBookshelfOpen}
        onClose={() => setIsBookshelfOpen(false)}
        library={library}
        settings={settings}
        onSelectBook={handleSelectBook}
        onCreateBook={handleCreateBook}
        onDuplicateBook={handleDuplicateBook}
        onDeleteBook={handleDeleteBook}
        onImportLibrary={handleImportLibrary}
        onOpenFileFromDisk={handleOpenProjectFromDisk}
      />

      {/* Novel Bible Modal (Characters, Lore, Plot Beats) */}
      <NovelBibleModal
        isOpen={isBibleOpen}
        onClose={() => setIsBibleOpen(false)}
        book={activeBook}
        settings={settings}
        onUpdateBible={handleUpdateBible}
      />

      {/* Chapters & Sessions Drawer */}
      <ChapterDrawer
        isOpen={isChapterDrawerOpen}
        onClose={() => setIsChapterDrawerOpen(false)}
        book={activeBook}
        settings={settings}
        currentChapterId={currentChapterId}
        onSelectChapter={setCurrentChapterId}
        onAddChapter={handleAddChapter}
        onDeleteChapter={handleDeleteChapter}
        onUpdateBookTitle={handleUpdateBookTitle}
      />

      {/* Bestseller Editor Room Modal */}
      <ChapterReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        chapter={currentChapter}
        book={activeBook}
        settings={settings}
        onApplyFix={handleApplyFix}
        onAppendCliffhanger={handleAppendCliffhanger}
      />

      {/* Settings Modal (Theme, Audio Akko & Ambience, AI Provider, Autosave & PC File) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        connectedFileName={connectedFileName}
        onSaveToDisk={handleSaveToDisk}
        onUpdateSettings={(updated) => {
          setSettings(updated);
          saveSettings(updated);
        }}
      />
    </div>
    </I18nProvider>
  );
}
