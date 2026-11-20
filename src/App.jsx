import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useAnimatedVisibility } from './utils/useAnimatedVisibility';
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
  linkBookToFile,
  autosaveToConnectedDisk,
  getConnectedFileName,
  migrateLegacyFileLink,
  disconnectBookFile
} from './utils/fileSync';
import { dismissSplash, toggleAppFullscreen } from './utils/desktop';
import { audioEngine } from './utils/audioEngine';
import TopBar from './components/TopBar';
import Editor from './components/Editor';
import BottomBar from './components/BottomBar';
import Sidebar from './components/Sidebar';
import ChapterReviewModal from './components/ChapterReviewModal';
import SettingsModal from './components/SettingsModal';
import BookshelfModal from './components/BookshelfModal';
import NovelBibleModal from './components/NovelBibleModal';
import BookMetadataModal from './components/BookMetadataModal';
import { FeedbackProvider, useFeedback } from './components/Feedback';
import confetti from 'canvas-confetti';
import { FileDown } from 'lucide-react';
import { I18nProvider, useI18n } from './utils/i18n';

const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;
const now = () => new Date().toISOString();

function themeColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveSettings(next);
      return next;
    });
  }, []);

  const handleLanguageChange = useCallback((language) => {
    updateSettings((prev) => ({ ...prev, language }));
  }, [updateSettings]);

  return (
    <I18nProvider language={settings.language || 'it'} onLanguageChange={handleLanguageChange}>
      <FeedbackProvider>
        <Studio settings={settings} updateSettings={updateSettings} />
      </FeedbackProvider>
    </I18nProvider>
  );
}

function Studio({ settings, updateSettings }) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();

  const [library, setLibrary] = useState(loadLibrary);
  const libraryRef = useRef(library);
  libraryRef.current = library;

  const activeBook = (library?.books || []).find(b => b.id === library?.activeBookId) || library?.books?.[0];

  const [currentChapterId, setCurrentChapterId] = useState(
    () => activeBook?.currentChapterId || activeBook?.chapters?.[0]?.id || 'chap-1'
  );

  // Modal / drawer visibility
  const [isBookshelfOpen, setIsBookshelfOpen] = useState(false);
  const [isBibleOpen, setIsBibleOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBookMetadataOpen, setIsBookMetadataOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragHover, setIsDragHover] = useState(false);

  // Saving state
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [fileLinkVersion, setFileLinkVersion] = useState(0);
  const connectedFileName = getConnectedFileName(activeBook?.id);
  const autosaveTimerRef = useRef(null);
  const diskDirtyRef = useRef(false);
  const storageWarningShownRef = useRef(false);

  // Writing activity (immersive auto-hide)
  const [isWriting, setIsWriting] = useState(false);
  const writingTimerRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const isAnyModalOpen = isBookshelfOpen || isBibleOpen || isReviewModalOpen || isSettingsOpen || isBookMetadataOpen;

  // Sidebar: docked on wide windows, a sliding sheet on narrow ones
  const editorRef = useRef(null);
  const [isRefining, setIsRefining] = useState(false);
  const [caret, setCaret] = useState({ line: 1, total: 1 });
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);
  const isNarrow = viewportWidth < 1100;
  const sidebarPinned = settings.sidebarOpen !== false;
  const sidebarMode = isNarrow ? (sidebarSheetOpen ? 'sheet' : 'hidden') : (sidebarPinned ? 'docked' : 'hidden');
  const motionMs = settings.enableAnimations !== false ? Number(settings.animationDurationMs) || 280 : 0;
  const sheet = useAnimatedVisibility(isNarrow && sidebarSheetOpen, Math.round(motionMs * 1.4));
  const workspaceRef = useRef(null);
  const workspaceLeftRef = useRef(null);

  // FLIP: the workspace reflows once, then glides into place (GPU transform only)
  useLayoutEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    const previous = workspaceLeftRef.current;
    workspaceLeftRef.current = left;
    if (previous === null || previous === left || !motionMs) return;
    el.animate(
      [{ transform: `translateX(${previous - left}px)` }, { transform: 'translateX(0)' }],
      { duration: Math.round(motionMs * 2), easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' }
    );
  }, [sidebarPinned, isNarrow, motionMs]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isNarrow) setSidebarSheetOpen(false);
  }, [isNarrow]);

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth < 1100) setSidebarSheetOpen(open => !open);
    else updateSettings(prev => ({ ...prev, sidebarOpen: prev.sidebarOpen === false }));
  }, [updateSettings]);

  const handleCaretChange = useCallback((next) => {
    setCaret(prev => (prev.line === next.line && prev.total === next.total ? prev : next));
  }, []);

  // ---------------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    dismissSplash();
    migrateLegacyFileLink(libraryRef.current.activeBookId).then(() => setFileLinkVersion(v => v + 1));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'parchment');
    document.documentElement.lang = settings.language || 'it';
  }, [settings.theme, settings.language]);

  useEffect(() => {
    const ms = settings.enableAnimations !== false ? Number(settings.animationDurationMs) || 280 : 0;
    document.documentElement.style.setProperty('--anim-duration', `${ms}ms`);
    // Every animation in the app scales with this factor (280 ms = 1)
    document.documentElement.style.setProperty('--motion-scale', String(ms / 280));
  }, [settings.enableAnimations, settings.animationDurationMs]);

  // ---------------------------------------------------------------------------
  // Immersive UI: hide chrome while typing, reveal on mouse movement
  // ---------------------------------------------------------------------------
  const handleWritingActivity = useCallback(() => {
    if (isAnyModalOpen) return;
    setIsWriting(true);
    clearTimeout(writingTimerRef.current);
    writingTimerRef.current = setTimeout(() => setIsWriting(false), 1600);
  }, [isAnyModalOpen]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
      const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
      if (dx > 4 || dy > 4) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        clearTimeout(writingTimerRef.current);
        setIsWriting(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(writingTimerRef.current);
    };
  }, []);

  const isUIWritingHidden = (settings.autoHideUIOnType ?? true) && isWriting && !isAnyModalOpen;

  const currentChapter = activeBook?.chapters?.find(c => c.id === currentChapterId) || activeBook?.chapters?.[0] || {
    id: 'chap-1',
    title: t('app.defaultChapterTitle', { n: 1 }),
    content: ''
  };

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  const persistLocally = useCallback((lib) => {
    const ok = saveLibrary(lib);
    if (!ok && !storageWarningShownRef.current) {
      storageWarningShownRef.current = true;
      notify(t('app.storageFull'), { tone: 'error', duration: 12000 });
    }
    return ok;
  }, [notify, t]);

  /** Debounced local save after each edit; the disk file is written by the autosave interval. */
  const scheduleSave = useCallback((updatedLibrary) => {
    setIsAutosaving(true);
    diskDirtyRef.current = true;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      persistLocally(updatedLibrary);
      setLastSavedTime(new Date());
      setIsAutosaving(false);
    }, 600);
  }, [persistLocally]);

  /** Apply a change to the library, save it and schedule the autosave. */
  const commitLibrary = useCallback((updater, { immediate = false } = {}) => {
    setLibrary((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      if (immediate) {
        persistLocally(next);
        diskDirtyRef.current = true;
      } else {
        scheduleSave(next);
      }
      return next;
    });
  }, [persistLocally, scheduleSave]);

  const updateActiveBook = useCallback((mutate, options) => {
    commitLibrary((prev) => ({
      ...prev,
      books: prev.books.map((b) => (b.id === prev.activeBookId ? { ...mutate(b), updatedAt: now() } : b))
    }), options);
  }, [commitLibrary]);

  // Periodic autosave of the active book to its own file on disk
  useEffect(() => {
    if (settings.autosaveEnabled === false) return undefined;
    const seconds = Number(settings.autosaveIntervalSeconds ?? 30);
    if (!seconds || seconds <= 0) return undefined;
    const timer = setInterval(async () => {
      if (!diskDirtyRef.current) return;
      const lib = libraryRef.current;
      const book = lib.books.find(b => b.id === lib.activeBookId);
      if (!book || !getConnectedFileName(book.id)) return;
      diskDirtyRef.current = false;
      const ok = await autosaveToConnectedDisk(book);
      if (ok) setLastSavedTime(new Date());
      else diskDirtyRef.current = true;
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [settings.autosaveEnabled, settings.autosaveIntervalSeconds]);

  // Never lose the last keystrokes when the window closes
  useEffect(() => {
    const flush = () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        saveLibrary(libraryRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);

    // Desktop: also write pending changes to the linked .bookify file before closing
    let unlisten = () => {};
    let disposed = false;
    if (window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        return win.onCloseRequested(async (event) => {
          flush();
          const lib = libraryRef.current;
          const book = lib.books.find(b => b.id === lib.activeBookId);
          if (!diskDirtyRef.current || !book || !getConnectedFileName(book.id)) return;
          event.preventDefault();
          try {
            await autosaveToConnectedDisk(book);
          } finally {
            diskDirtyRef.current = false;
            await win.destroy();
          }
        });
      }).then((fn) => {
        if (disposed) fn?.();
        else if (fn) unlisten = fn;
      }).catch((err) => console.warn('Close handler not installed:', err));
    }

    return () => {
      disposed = true;
      unlisten();
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  const handleSaveToDisk = useCallback(async ({ chooseNewFile = false } = {}) => {
    const lib = libraryRef.current;
    const book = lib.books.find(b => b.id === lib.activeBookId) || lib.books[0];
    if (!book) return;
    setIsAutosaving(true);
    try {
      persistLocally(lib);
      const res = await saveProjectToDiskFile(book, { chooseNewFile });
      if (res.success) {
        diskDirtyRef.current = false;
        setFileLinkVersion(v => v + 1);
        setLastSavedTime(new Date());
        notify(t(res.isDirectDisk ? 'app.savedTo' : 'app.downloaded', { file: res.fileName }), { tone: 'success' });
      }
    } catch (error) {
      console.error('Errore salvataggio progetto:', error);
      notify(t('app.saveFailed', { error: error.message || error }), { tone: 'error' });
    } finally {
      setIsAutosaving(false);
    }
  }, [notify, persistLocally, t]);

  // ---------------------------------------------------------------------------
  // Opening files (dialog, browser drop, native drop)
  // ---------------------------------------------------------------------------
  const handleImportLibrary = useCallback((newLibrary) => {
    const books = (newLibrary.books || []).filter(b => b && Array.isArray(b.chapters));
    if (!books.length) return;
    const activeBookId = books.some(b => b.id === newLibrary.activeBookId) ? newLibrary.activeBookId : books[0].id;
    const next = { activeBookId, books };
    setLibrary(next);
    persistLocally(next);
    const active = books.find(b => b.id === activeBookId);
    setCurrentChapterId(active.currentChapterId || active.chapters[0]?.id || 'chap-1');
  }, [persistLocally]);

  const importProjectData = useCallback(async (data, fileName, source) => {
    if (data && Array.isArray(data.chapters) && data.title) {
      const book = { ...data, id: data.id || `book-${Date.now()}` };
      if (!book.chapters.length) {
        book.chapters = [{ id: `chap-${Date.now()}`, title: t('app.defaultChapterTitle', { n: 1 }), order: 1, content: '', updatedAt: now() }];
      }
      commitLibrary((prev) => {
        const exists = prev.books.some(b => b.id === book.id);
        return {
          ...prev,
          activeBookId: book.id,
          books: exists ? prev.books.map(b => (b.id === book.id ? book : b)) : [book, ...prev.books]
        };
      }, { immediate: true });
      setCurrentChapterId(book.currentChapterId && book.chapters.some(c => c.id === book.currentChapterId) ? book.currentChapterId : book.chapters[0].id);
      await linkBookToFile(book.id, source);
      setFileLinkVersion(v => v + 1);
      notify(t('app.bookOpened', { title: book.title, file: fileName }), { tone: 'success' });
      return;
    }
    if (data && Array.isArray(data.books)) {
      const ok = await confirm({
        title: t('app.restoreTitle'),
        message: t('app.restoreMessage', { incoming: data.books.length, current: libraryRef.current.books.length }),
        confirmLabel: t('app.restoreConfirm'),
        danger: true
      });
      if (!ok) return;
      handleImportLibrary(data);
      notify(t('app.libraryImported', { file: fileName }), { tone: 'success' });
      return;
    }
    notify(t('app.invalidProject'), { tone: 'error' });
  }, [commitLibrary, confirm, handleImportLibrary, notify, t]);

  const handleOpenProjectFromDisk = useCallback(async () => {
    try {
      const res = await openProjectFromDiskFile();
      if (!res?.success) return;
      await importProjectData(res.data, res.fileName || 'progetto.bookify', res.source);
    } catch (err) {
      console.error('Errore apertura file:', err);
      notify(t('app.openFailed', { error: err.message || err }), { tone: 'error' });
    }
  }, [importProjectData, notify, t]);

  // Drag & drop of .bookify / .json files (HTML5: native Tauri drop is disabled so
  // that dragging selected text inside the editor keeps working on Windows)
  useEffect(() => {
    const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const handleDragOver = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setIsDragHover(true);
    };
    const handleDragLeave = (e) => {
      if (e.relatedTarget === null) setIsDragHover(false);
    };
    const handleDrop = async (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setIsDragHover(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!/\.(bookify|json)$/i.test(file.name)) {
        notify(t('app.dropWrongType'), { tone: 'error' });
        return;
      }
      try {
        await importProjectData(JSON.parse(await file.text()), file.name, null);
      } catch (err) {
        notify(t('app.openFailed', { error: err.message || err }), { tone: 'error' });
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [importProjectData, notify, t]);

  // ---------------------------------------------------------------------------
  // Library & book operations
  // ---------------------------------------------------------------------------
  const flushPendingDiskSave = useCallback(async () => {
    const lib = libraryRef.current;
    const book = lib.books.find(b => b.id === lib.activeBookId);
    if (diskDirtyRef.current && book && settings.autosaveEnabled !== false) {
      diskDirtyRef.current = false;
      await autosaveToConnectedDisk(book);
    }
  }, [settings.autosaveEnabled]);

  const handleSelectBook = async (bookId) => {
    const targetBook = library.books.find(b => b.id === bookId);
    if (!targetBook || bookId === library.activeBookId) return;
    await flushPendingDiskSave();
    setCurrentChapterId(targetBook.currentChapterId || targetBook.chapters[0]?.id || 'chap-1');
    commitLibrary((prev) => ({ ...prev, activeBookId: bookId }), { immediate: true });
    diskDirtyRef.current = false;
  };

  const handleCreateBook = async (newBook) => {
    await flushPendingDiskSave();
    commitLibrary((prev) => ({ activeBookId: newBook.id, books: [newBook, ...prev.books] }), { immediate: true });
    diskDirtyRef.current = false;
    setCurrentChapterId(newBook.chapters[0]?.id || 'chap-1');
  };

  const handleDuplicateBook = (sourceBook) => {
    const duplicated = duplicateBook(sourceBook);
    commitLibrary((prev) => ({ ...prev, books: [duplicated, ...prev.books] }), { immediate: true });
    notify(t('app.bookDuplicated', { title: duplicated.title }), { tone: 'success' });
  };

  const handleDeleteBook = (bookId) => {
    const lib = libraryRef.current;
    if (lib.books.length <= 1) return;
    const remaining = lib.books.filter(b => b.id !== bookId);
    const nextActiveId = lib.activeBookId === bookId ? remaining[0].id : lib.activeBookId;
    if (lib.activeBookId === bookId) {
      const nextBook = remaining.find(b => b.id === nextActiveId);
      setCurrentChapterId(nextBook.currentChapterId || nextBook.chapters[0]?.id || 'chap-1');
      diskDirtyRef.current = false;
    }
    commitLibrary(() => ({ activeBookId: nextActiveId, books: remaining }), { immediate: true });
    disconnectBookFile(bookId).then(() => setFileLinkVersion(v => v + 1));
  };

  // Remember the chapter the author is on, per book
  const handleSelectChapter = (chapId) => {
    setCurrentChapterId(chapId);
    updateActiveBook((b) => ({ ...b, currentChapterId: chapId }));
  };

  const handleUpdateContent = (newContent, newTitle = null) => {
    const goal = Number(settings.wordGoal) || 0;
    if (goal > 0 && countWords(newContent) >= goal && countWords(currentChapter.content) < goal) {
      try {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 },
          colors: [themeColor('--accent-cyan', '#e5a953'), themeColor('--accent-green', '#7da87b'), themeColor('--accent-amber', '#e5a953')],
          disableForReducedMotion: true
        });
      } catch { /* decorative only */ }
      notify(t('app.goalReached', { goal: goal.toLocaleString() }), { tone: 'success' });
    }

    const chapterId = currentChapter.id;
    updateActiveBook((b) => ({
      ...b,
      chapters: (b.chapters || []).map((chap) => (chap.id === chapterId
        ? { ...chap, content: newContent, title: newTitle !== null ? newTitle : chap.title, updatedAt: now() }
        : chap))
    }));
  };

  const handleUpdateBookMetadata = (fields) => updateActiveBook((b) => ({ ...b, ...fields }));
  const handleUpdateBible = (newBible) => updateActiveBook((b) => ({ ...b, bible: newBible }));

  const handleAddChapter = () => {
    const newIndex = (activeBook.chapters || []).length + 1;
    const newChapId = `chap-${Date.now()}`;
    const newChap = {
      id: newChapId,
      title: t('app.newChapterTitle', { n: newIndex }),
      order: newIndex,
      content: '',
      updatedAt: now()
    };
    updateActiveBook((b) => ({ ...b, chapters: [...b.chapters, newChap], currentChapterId: newChapId }));
    setCurrentChapterId(newChapId);
  };

  const handleDeleteChapter = (chapId) => {
    const chapters = activeBook.chapters || [];
    if (chapters.length <= 1) return;
    const remaining = chapters.filter(c => c.id !== chapId);
    const nextCurrentId = currentChapterId === chapId ? remaining[0].id : currentChapterId;
    setCurrentChapterId(nextCurrentId);
    updateActiveBook((b) => ({
      ...b,
      chapters: b.chapters.filter(c => c.id !== chapId),
      currentChapterId: nextCurrentId
    }));
  };

  const handleAppendCliffhanger = (cliffhangerText) => {
    const current = currentChapter.content || '';
    handleUpdateContent(`${current.trimEnd()}\n\n${cliffhangerText}`);
  };

  const handleApplyFix = (orig, fix, start, end, targetChapterId = currentChapter?.id) => {
    if (!activeBook || !targetChapterId) return false;
    const chapter = activeBook.chapters.find(c => c.id === targetChapterId);
    const content = chapter?.content || '';
    if (content.slice(start, end) !== orig) return false;
    const nextContent = content.slice(0, start) + fix + content.slice(end);
    if (targetChapterId === currentChapter?.id) {
      handleUpdateContent(nextContent);
    } else {
      updateActiveBook((b) => ({
        ...b,
        chapters: b.chapters.map(c => (c.id === targetChapterId ? { ...c, content: nextContent, updatedAt: now() } : c))
      }));
    }
    return true;
  };

  const handleToggleSetting = (key, value) => updateSettings((prev) => ({ ...prev, [key]: value }));

  const toggleFullscreen = useCallback(async () => {
    try {
      setIsFullscreen(await toggleAppFullscreen());
    } catch (err) {
      console.warn('Fullscreen non disponibile:', err);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      if (!window.__TAURI_INTERNALS__) setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts
  // ---------------------------------------------------------------------------
  const shortcutHandlersRef = useRef({});
  shortcutHandlersRef.current = { handleSaveToDisk, handleOpenProjectFromDisk, toggleFullscreen, toggleSidebar, isFullscreen, isAnyModalOpen, sidebarSheetOpen };

  useEffect(() => {
    const handleGlobalKeys = (e) => {
      const h = shortcutHandlersRef.current;
      if (e.defaultPrevented) return;

      if (e.key === 'F11') {
        e.preventDefault();
        h.toggleFullscreen();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const toggles = {
          r: setIsReviewModalOpen,
          b: setIsBibleOpen,
          i: setIsBookMetadataOpen,
          l: setIsBookshelfOpen,
          ',': setIsSettingsOpen
        };
        if (key === 's' && !e.shiftKey) {
          e.preventDefault();
          h.handleSaveToDisk();
        } else if (key === 's' && e.shiftKey) {
          e.preventDefault();
          h.handleSaveToDisk({ chooseNewFile: true });
        } else if (key === 'o') {
          e.preventDefault();
          h.handleOpenProjectFromDisk();
        } else if (key === 'j' || key === 'k') {
          e.preventDefault();
          h.toggleSidebar();
        } else if (toggles[key]) {
          e.preventDefault();
          toggles[key](prev => !prev);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (h.isAnyModalOpen) {
          setIsBookshelfOpen(false);
          setIsBibleOpen(false);
          setIsReviewModalOpen(false);
          setIsSettingsOpen(false);
          setIsBookMetadataOpen(false);
        } else if (h.sidebarSheetOpen) {
          setSidebarSheetOpen(false);
        } else if (h.isFullscreen) {
          h.toggleFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Audio engine follows the settings
  useEffect(() => {
    audioEngine.setVolume(settings.soundVolume);
    audioEngine.setEnabled(settings.soundEnabled);
    if (settings.soundProfile) audioEngine.setProfile(settings.soundProfile);
    if (settings.ambientTrack) audioEngine.startAmbient(settings.ambientTrack);
    if (settings.ambientVolume !== undefined) audioEngine.setAmbientVolume(settings.ambientVolume);
  }, [settings.soundVolume, settings.soundEnabled, settings.soundProfile, settings.ambientTrack, settings.ambientVolume]);

  void fileLinkVersion; // re-render trigger when a file gets (dis)connected

  const closeSheet = () => setSidebarSheetOpen(false);
  const openFromSidebar = (open) => () => {
    closeSheet();
    open(true);
  };

  return (
    <div className={`bookify-app sidebar-${sidebarMode}`}>
      {(!isNarrow || sheet.shouldRender) && (
        <>
          {isNarrow && <div className={`sidebar-scrim ${sheet.isExiting ? 'is-exiting' : ''}`} onMouseDown={closeSheet} aria-hidden="true" />}
          <Sidebar
            mode={isNarrow ? 'sheet' : 'docked'}
            collapsed={!isNarrow && !sidebarPinned}
            exiting={isNarrow && sheet.isExiting}
            book={activeBook}
            currentChapterId={currentChapter.id}
            onSelectChapter={(id) => {
              handleSelectChapter(id);
              closeSheet();
            }}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onOpenBookshelf={openFromSidebar(setIsBookshelfOpen)}
            onOpenBible={openFromSidebar(setIsBibleOpen)}
            onOpenMetadata={openFromSidebar(setIsBookMetadataOpen)}
            onOpenReview={openFromSidebar(setIsReviewModalOpen)}
            onOpenSettings={openFromSidebar(setIsSettingsOpen)}
            onCollapse={toggleSidebar}
            isWriting={isUIWritingHidden && sidebarMode === 'docked'}
          />
        </>
      )}

      <div className="workspace" ref={workspaceRef}>
        <TopBar
          book={activeBook}
          currentChapter={currentChapter}
          sidebarVisible={sidebarMode === 'docked'}
          onToggleSidebar={toggleSidebar}
          onOpenBookshelf={() => setIsBookshelfOpen(true)}
          settings={settings}
          onToggleSetting={handleToggleSetting}
          isAutosaving={isAutosaving}
          lastSavedTime={lastSavedTime}
          connectedFileName={connectedFileName}
          onSaveToDisk={() => handleSaveToDisk()}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onFormat={() => editorRef.current?.format()}
          onRefine={() => editorRef.current?.refine()}
          isRefining={isRefining}
          isWriting={isUIWritingHidden}
        />

        <main className="bookify-main">
          <Editor
            ref={editorRef}
            chapter={currentChapter}
            onUpdateContent={handleUpdateContent}
            settings={settings}
            book={activeBook}
            onUpdateBible={handleUpdateBible}
            onWritingActivity={handleWritingActivity}
            onCursorChange={handleCaretChange}
            onRefiningChange={setIsRefining}
            isWriting={isUIWritingHidden}
          />
        </main>

        <BottomBar
          currentChapter={currentChapter}
          settings={settings}
          connectedFileName={connectedFileName}
          onSaveToDisk={() => handleSaveToDisk()}
          onToggleSound={() => handleToggleSetting('soundEnabled', settings.soundEnabled === false)}
          cursorLine={caret.line}
          totalLines={caret.total}
          isWriting={isUIWritingHidden}
        />
      </div>

      <BookMetadataModal
        isOpen={isBookMetadataOpen}
        onClose={() => setIsBookMetadataOpen(false)}
        book={activeBook}
        onUpdateBook={handleUpdateBookMetadata}
        settings={settings}
      />

      <BookshelfModal
        isOpen={isBookshelfOpen}
        onClose={() => setIsBookshelfOpen(false)}
        library={library}
        settings={settings}
        onSelectBook={handleSelectBook}
        onCreateBook={handleCreateBook}
        onDuplicateBook={handleDuplicateBook}
        onDeleteBook={handleDeleteBook}
        onOpenFileFromDisk={handleOpenProjectFromDisk}
      />

      <NovelBibleModal
        isOpen={isBibleOpen}
        onClose={() => setIsBibleOpen(false)}
        book={activeBook}
        settings={settings}
        onUpdateBible={handleUpdateBible}
      />

      <ChapterReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        chapter={currentChapter}
        book={activeBook}
        settings={settings}
        onApplyFix={handleApplyFix}
        onAppendCliffhanger={handleAppendCliffhanger}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        connectedFileName={connectedFileName}
        onSaveToDisk={() => handleSaveToDisk({ chooseNewFile: Boolean(connectedFileName) })}
        onUpdateSettings={updateSettings}
      />

      {isDragHover && (
        <div className="bk-drop-overlay" aria-hidden="true">
          <FileDown size={42} />
          <span>{t('app.dropHint')}</span>
        </div>
      )}
    </div>
  );
}
