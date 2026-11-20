// Local file sync for Bookify.
//
// Every book remembers ITS OWN file on disk. Switching book in the library never
// redirects saves to another book's file (that used to overwrite manuscripts).
//
// - Tauri (desktop): files are read/written by the Rust backend; the per-book
//   link { path, fileName } is kept in localStorage.
// - Browser (dev / web preview): File System Access API handles are kept in
//   IndexedDB, keyed by book id. Falls back to a download when unsupported.
import { invoke } from '@tauri-apps/api/core';

const DB_NAME = 'bookify_fs_db';
const STORE_NAME = 'handles';
const LINKS_KEY = 'bookify_file_links_v1';

// Legacy single-file keys (pre per-book links)
const LEGACY_HANDLE_KEY = 'active_book_file_handle';
const LEGACY_TAURI_PATH = 'bookify_tauri_file_path';
const LEGACY_TAURI_NAME = 'bookify_tauri_file_name';

const handleCache = new Map();

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

// ---------------------------------------------------------------------------
// Link registry (bookId -> { path?, fileName })
// ---------------------------------------------------------------------------
function readLinks() {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeLinks(links) {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch (err) {
    console.warn('Impossibile salvare i collegamenti ai file:', err);
  }
}

function setLink(bookId, link) {
  if (!bookId) return;
  const links = readLinks();
  if (link) links[bookId] = link;
  else delete links[bookId];
  writeLinks(links);
}

export function getConnectedFileName(bookId) {
  return (bookId && readLinks()[bookId]?.fileName) || null;
}

/**
 * One-time migration from the old global "connected file" to a per-book link.
 * The old file is attributed to the book that was active at startup.
 */
export async function migrateLegacyFileLink(bookId) {
  if (!bookId) return;
  try {
    const legacyPath = localStorage.getItem(LEGACY_TAURI_PATH);
    const legacyName = localStorage.getItem(LEGACY_TAURI_NAME);
    if (legacyPath && !readLinks()[bookId]) {
      setLink(bookId, { path: legacyPath, fileName: legacyName || legacyPath.split(/[\\/]/).pop() });
    }
    localStorage.removeItem(LEGACY_TAURI_PATH);
    localStorage.removeItem(LEGACY_TAURI_NAME);

    if (!isTauriRuntime()) {
      const legacyHandle = await idbGet(LEGACY_HANDLE_KEY);
      if (legacyHandle) {
        if (!readLinks()[bookId]) {
          await idbPut(handleKey(bookId), legacyHandle);
          setLink(bookId, { fileName: legacyHandle.name });
        }
        await idbDelete(LEGACY_HANDLE_KEY);
      }
    }
  } catch (err) {
    console.warn('Migrazione collegamento file non riuscita:', err);
  }
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (browser only)
// ---------------------------------------------------------------------------
const handleKey = (bookId) => `handle:${bookId}`;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbRequest(mode, run) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = run(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve(req?.result ?? null);
    tx.onerror = () => resolve(null);
  });
}

const idbGet = (key) => idbRequest('readonly', (store) => store.get(key));
const idbPut = (key, value) => idbRequest('readwrite', (store) => store.put(value, key));
const idbDelete = (key) => idbRequest('readwrite', (store) => store.delete(key));

async function getHandle(bookId) {
  if (handleCache.has(bookId)) return handleCache.get(bookId);
  const handle = await idbGet(handleKey(bookId)).catch(() => null);
  if (handle) handleCache.set(bookId, handle);
  return handle;
}

async function writeHandle(handle, content) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export const supportsFileSystemAccess = () =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window;

function suggestedFileName(book) {
  const base = (book.title || 'Mio_Romanzo').replace(/[^a-zA-Z0-9_À-ſ-]/g, '_');
  return `${base}.bookify`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save the book to its own linked file. When the book has no file yet (or
 * `chooseNewFile` is true) the user picks where to save it, once.
 */
export async function saveProjectToDiskFile(book, { chooseNewFile = false } = {}) {
  const content = JSON.stringify(book, null, 2);
  const defaultName = suggestedFileName(book);
  const link = chooseNewFile ? null : readLinks()[book.id];

  if (isTauriRuntime()) {
    const saved = await invoke('save_bookify_file', {
      contents: content,
      defaultName,
      path: link?.path || null
    });
    if (!saved) return { success: false, cancelled: true };
    setLink(book.id, { path: saved.path, fileName: saved.fileName });
    return { success: true, fileName: saved.fileName, isDirectDisk: true };
  }

  if (!chooseNewFile) {
    const handle = await getHandle(book.id);
    if (handle) {
      try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          await writeHandle(handle, content);
          return { success: true, fileName: handle.name, isDirectDisk: true };
        }
      } catch (err) {
        console.warn('Scrittura sul file collegato non riuscita, chiedo un nuovo file:', err);
      }
    }
  }

  if (supportsFileSystemAccess()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description: 'Progetto Bookify (*.bookify)', accept: { 'application/json': ['.bookify', '.json'] } }]
      });
      await writeHandle(handle, content);
      handleCache.set(book.id, handle);
      await idbPut(handleKey(book.id), handle);
      setLink(book.id, { fileName: handle.name });
      return { success: true, fileName: handle.name, isDirectDisk: true };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      console.warn('Errore selettore file:', err);
    }
  }

  downloadBlob(content, defaultName, 'application/json;charset=utf-8');
  return { success: true, fileName: defaultName, isDirectDisk: false };
}

function parseProjectFile(contents) {
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error('il file non è un progetto Bookify valido (JSON non leggibile)');
  }
}

/**
 * Let the user pick a .bookify/.json file. Returns { data, fileName, source }
 * where `source` must be passed to `linkBookToFile` once the caller knows
 * which book id the file belongs to.
 */
export async function openProjectFromDiskFile() {
  if (isTauriRuntime()) {
    const opened = await invoke('open_bookify_file');
    if (!opened) return { success: false, cancelled: true };
    return {
      success: true,
      data: parseProjectFile(opened.contents),
      fileName: opened.fileName,
      source: { path: opened.path, fileName: opened.fileName }
    };
  }

  if (supportsFileSystemAccess()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Progetto Bookify (*.bookify, *.json)', accept: { 'application/json': ['.bookify', '.json'] } }],
        multiple: false
      });
      const file = await handle.getFile();
      return {
        success: true,
        data: parseProjectFile(await file.text()),
        fileName: handle.name,
        source: { handle, fileName: handle.name }
      };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bookify,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve({ success: false, cancelled: true });
      try {
        resolve({ success: true, data: parseProjectFile(await file.text()), fileName: file.name, source: null });
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

/** Attach an opened file to a book so later saves go back to that same file. */
export async function linkBookToFile(bookId, source) {
  if (!bookId || !source) return;
  if (source.handle) {
    handleCache.set(bookId, source.handle);
    await idbPut(handleKey(bookId), source.handle);
    setLink(bookId, { fileName: source.fileName });
  } else if (source.path) {
    setLink(bookId, { path: source.path, fileName: source.fileName });
  }
}

/** Silent autosave to the book's linked file. Never opens dialogs. */
export async function autosaveToConnectedDisk(book) {
  if (!book?.id) return false;
  const link = readLinks()[book.id];
  if (!link) return false;
  const content = JSON.stringify(book, null, 2);

  try {
    if (isTauriRuntime()) {
      if (!link.path) return false;
      await invoke('save_bookify_file', { contents: content, defaultName: link.fileName, path: link.path });
      return true;
    }
    const handle = await getHandle(book.id);
    if (!handle || (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return false;
    await writeHandle(handle, content);
    return true;
  } catch (err) {
    console.warn('Autosalvataggio su disco non riuscito:', err);
    return false;
  }
}

/** Forget the file linked to a book (e.g. when the book is deleted). */
export async function disconnectBookFile(bookId) {
  if (!bookId) return;
  setLink(bookId, null);
  handleCache.delete(bookId);
  await idbDelete(handleKey(bookId)).catch(() => {});
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
