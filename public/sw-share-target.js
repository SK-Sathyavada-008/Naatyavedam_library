// ==============================================================================
// NAATYAVEDAM LIBRARY: SERVICE WORKER SHARE TARGET HANDLER
// Handles incoming multipart/form-data POST requests from Android Web Share Target
// ==============================================================================

const SHARED_DB_NAME = 'NaatyavedamSharedIncomingDB';
const SHARED_DB_VERSION = 1;
const SHARED_STORE_NAME = 'incomingSharedFiles';

/**
 * Open IndexedDB for temporary incoming shared files.
 * Works uniformly in both Service Worker and Window contexts.
 */
function openSharedIncomingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARED_DB_NAME, SHARED_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SHARED_STORE_NAME)) {
        db.createObjectStore(SHARED_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save incoming files into IndexedDB so the PWA can retrieve them after redirect.
 */
async function saveSharedIncomingFiles(items) {
  const db = await openSharedIncomingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARED_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SHARED_STORE_NAME);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Intercept Web Share Target POST requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const cleanPath = url.pathname.replace(/\/+$/, '');

  // Check if incoming request is a Share Target POST
  if (event.request.method === 'POST' && (cleanPath === '/share-target' || cleanPath.endsWith('/share-target'))) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const itemsToSave = [];

          // 1. Check for files under all common multipart field names
          const audioEntries = [
            ...formData.getAll('audio'),
            ...formData.getAll('audio_files'),
            ...formData.getAll('file'),
            ...formData.getAll('files'),
          ];

          // Fallback: check all formData values if sender app used arbitrary field names
          const candidates =
            audioEntries.length > 0 ? audioEntries : Array.from(formData.values());

          let fileIndex = 0;
          for (const item of candidates) {
            // Check if item is a File or Blob
            if (item && (item instanceof File || item instanceof Blob || typeof item.arrayBuffer === 'function')) {
              const fileName = item.name || `shared_audio_${Date.now()}_${fileIndex}.mp3`;
              const fileType = item.type || 'audio/mpeg';

              itemsToSave.push({
                id: `shared_${Date.now()}_${fileIndex}_${Math.random().toString(36).slice(2, 7)}`,
                blob: item,
                name: fileName,
                type: fileType,
                size: item.size || 0,
                receivedAt: new Date().toISOString(),
              });
              fileIndex++;
            }
          }

          if (itemsToSave.length > 0) {
            await saveSharedIncomingFiles(itemsToSave);
            // HTTP 303 See Other redirect with absolute URL to application
            const redirectUrl = new URL('/?incoming_share=true', self.location.origin).href;
            return Response.redirect(redirectUrl, 303);
          } else {
            console.warn('[SW Share Target] No audio files found in formData payload');
            const redirectUrl = new URL('/?incoming_share_empty=true', self.location.origin).href;
            return Response.redirect(redirectUrl, 303);
          }
        } catch (err) {
          console.error('[SW Share Target] Error handling share target POST:', err);
          const redirectUrl = new URL('/?incoming_share_error=true', self.location.origin).href;
          return Response.redirect(redirectUrl, 303);
        }
      })()
    );
  }
});
