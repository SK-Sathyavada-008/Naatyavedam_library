// ==============================================================================
// NAATYAVEDAM LIBRARY: INCOMING SHARE TARGET CLIENT SERVICE
// Manages retrieval and clearing of audio files delivered via Web Share Target API
// ==============================================================================

const SHARED_DB_NAME = 'NaatyavedamSharedIncomingDB';
const SHARED_DB_VERSION = 1;
const SHARED_STORE_NAME = 'incomingSharedFiles';

export interface IncomingSharedFileRecord {
  id: string;
  blob: Blob | File;
  name: string;
  type: string;
  size: number;
  receivedAt: string;
}

/**
 * Open IndexedDB shared store in Window context.
 */
function openSharedIncomingDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARED_DB_NAME, SHARED_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SHARED_STORE_NAME)) {
        db.createObjectStore(SHARED_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check and retrieve any pending incoming shared audio files.
 */
export async function getPendingSharedFiles(): Promise<IncomingSharedFileRecord[]> {
  try {
    const db = await openSharedIncomingDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHARED_STORE_NAME, 'readonly');
      const store = tx.objectStore(SHARED_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ShareTarget] Could not read pending shared files:', err);
    return [];
  }
}

/**
 * Clear specific shared file from temporary queue after import or rejection.
 */
export async function clearSharedFile(id: string): Promise<void> {
  try {
    const db = await openSharedIncomingDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHARED_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARED_STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ShareTarget] Could not delete shared file:', err);
  }
}

/**
 * Clear all temporary incoming shared records.
 */
export async function clearAllSharedFiles(): Promise<void> {
  try {
    const db = await openSharedIncomingDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SHARED_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARED_STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[ShareTarget] Could not clear shared files:', err);
  }
}

