// Real Local File Sync & Native Desktop Storage Engine for Bookify
// Native File System Access API with IndexedDB handle persistence,
// ensuring the user edits the SAME file on PC in-place without generating duplicates.
import { invoke } from '@tauri-apps/api/core';

const DB_NAME = 'bookify_fs_db';
const STORE_NAME = 'handles';
const KEY_ACTIVE_HANDLE = 'active_book_file_handle';
const KEY_TAURI_FILE_PATH = 'bookify_tauri_file_path';
const KEY_TAURI_FILE_NAME = 'bookify_tauri_file_name';

let activeFileHandle = null;
let activeFileName = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_TAURI_FILE_NAME) || '' : '';
let activeTauriFilePath = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_TAURI_FILE_PATH) || '' : '';

function isTauriRuntime() {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || Boolean(window.__TAURI_INTERNALS__));
}

// Initialize IndexedDB database for persisting FileSystemFileHandle across reloads
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistHandleToIDB(handle) {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, KEY_ACTIVE_HANDLE);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Failed to persist file handle in IndexedDB:', err);
  }
}

async function getPersistedHandleFromIDB() {
  try {
    const db = await openDB();
    if (!db) return null;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY_ACTIVE_HANDLE);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to retrieve file handle from IndexedDB:', err);
    return null;
  }
}

// Auto-restore persisted file handle on module load
(async () => {
  try {
    const savedHandle = await getPersistedHandleFromIDB();
    if (savedHandle) {
      activeFileHandle = savedHandle;
      activeFileName = savedHandle.name;
    }
  } catch {}
})();

/**
 * Check if the browser supports native direct File System Access API
 */
export const supportsFileSystemAccess = () => {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
};

/**
 * Save Entire Book or Project IN-PLACE to the connected file on PC.
 * If already connected, writes directly without prompting or downloading a new file!
 */
export async function saveProjectToDiskFile(bookData, preferredName = '') {
  const defaultName = preferredName || `${(bookData.title || 'Mio_Romanzo').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_')}.bookify`;
  const fileContent = JSON.stringify(bookData, null, 2);

  if (isTauriRuntime()) {
    const savedFile = await invoke('save_bookify_file', {
      contents: fileContent,
      defaultName,
      path: activeTauriFilePath || null
    });
    if (!savedFile) return { success: false, cancelled: true };
    activeTauriFilePath = savedFile.path;
    activeFileName = savedFile.fileName;
    localStorage.setItem(KEY_TAURI_FILE_PATH, activeTauriFilePath);
    localStorage.setItem(KEY_TAURI_FILE_NAME, activeFileName);
    return { success: true, fileName: activeFileName, isDirectDisk: true };
  }

  // 1. If we already have an active connected file handle on the PC, write directly to it!
  if (!activeFileHandle) {
    activeFileHandle = await getPersistedHandleFromIDB();
    if (activeFileHandle) {
      activeFileName = activeFileHandle.name;
    }
  }

  if (activeFileHandle) {
    try {
      // Query or request write permission if browser needs fresh user activation
      let perm = await activeFileHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await activeFileHandle.requestPermission({ mode: 'readwrite' });
      }

      if (perm === 'granted') {
        const writable = await activeFileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();
        return { success: true, fileName: activeFileName, isDirectDisk: true };
      }
    } catch (err) {
      console.warn('Failed to write to existing handle, will request picker:', err);
      activeFileHandle = null;
    }
  }

  // 2. If not connected yet, ask the user to pick/create the file ONCE.
  if (supportsFileSystemAccess()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'File Progetto Bookify (*.bookify)',
            accept: { 'application/json': ['.bookify', '.json'] }
          },
          {
            description: 'File Testo Semplice (*.txt)',
            accept: { 'text/plain': ['.txt'] }
          }
        ]
      });

      const writable = await handle.createWritable();
      await writable.write(fileContent);
      await writable.close();

      activeFileHandle = handle;
      activeFileName = handle.name;
      await persistHandleToIDB(handle);

      return { success: true, fileName: handle.name, isDirectDisk: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      console.warn('File picker error:', err);
    }
  }

  // 3. Fallback only if browser does not support File System Access at all
  downloadBlob(fileContent, defaultName, 'application/json;charset=utf-8');
  return { success: true, fileName: defaultName, isDirectDisk: false };
}

/**
 * Open a .bookify or .json project file from PC disk and connect it for direct in-place editing!
 */
export async function openProjectFromDiskFile() {
  if (isTauriRuntime()) {
    const openedFile = await invoke('open_bookify_file');
    if (!openedFile) return { success: false, cancelled: true };
    activeTauriFilePath = openedFile.path;
    activeFileName = openedFile.fileName;
    localStorage.setItem(KEY_TAURI_FILE_PATH, activeTauriFilePath);
    localStorage.setItem(KEY_TAURI_FILE_NAME, activeFileName);
    return { success: true, data: JSON.parse(openedFile.contents), fileName: activeFileName };
  }

  if (supportsFileSystemAccess()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'File Progetto Bookify (*.bookify, *.json)',
            accept: { 'application/json': ['.bookify', '.json'] }
          }
        ],
        multiple: false
      });

      const file = await handle.getFile();
      const content = await file.text();
      const parsed = JSON.parse(content);

      activeFileHandle = handle;
      activeFileName = handle.name;
      await persistHandleToIDB(handle);

      return { success: true, data: parsed, fileName: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      console.error('Failed to open file from disk:', err);
    }
  }

  // Fallback file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bookify,.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return resolve({ success: false });
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        resolve({ success: true, data: parsed, fileName: file.name });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    };
    input.click();
  });
}

/**
 * Perform Autosave to PC disk if a file handle is connected.
 * In-place modification only; never triggers downloads!
 */
export async function autosaveToConnectedDisk(bookData) {
  if (isTauriRuntime()) {
    if (!activeTauriFilePath) return false;
    try {
      await invoke('save_bookify_file', {
        contents: JSON.stringify(bookData, null, 2),
        defaultName: activeFileName || 'Mio_Romanzo.bookify',
        path: activeTauriFilePath
      });
      return true;
    } catch (err) {
      console.warn('Autosave to disk failed:', err);
      return false;
    }
  }

  if (!activeFileHandle) {
    activeFileHandle = await getPersistedHandleFromIDB();
  }
  if (!activeFileHandle) return false;

  try {
    const perm = await activeFileHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;

    const writable = await activeFileHandle.createWritable();
    await writable.write(JSON.stringify(bookData, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Autosave to disk failed:', err);
    return false;
  }
}

/**
 * Disconnect current file handle (to save to a different file)
 */
export async function disconnectFileHandle() {
  activeFileHandle = null;
  activeFileName = '';
  activeTauriFilePath = '';
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY_TAURI_FILE_PATH);
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY_TAURI_FILE_NAME);
  try {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(KEY_ACTIVE_HANDLE);
    }
  } catch {}
}

/**
 * Get the currently connected file name, if any
 */
export function getActiveConnectedFileName() {
  return activeFileName || null;
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
