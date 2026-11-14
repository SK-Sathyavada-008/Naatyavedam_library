# Browser Compatibility and Mobile Limitations Guide

## Supported Platforms and Android Chrome Versions

| Feature | Android Chrome 89+ | Android Chrome 76–88 | Samsung Internet 14+ | iOS Safari 15+ | Desktop Chrome/Edge |
|---|---|---|---|---|---|
| **PWA App Shell & Offline IndexedDB** | Full Support | Full Support | Full Support | Full Support | Full Support |
| **Web Share API Level 2 (Files)** | Full Support | Fallback to Download | Full Support | Full Support | Fallback to Download |
| **Web Share Target API (POST files)** | Full Support | Limited (GET only) | Limited | Unsupported (OS constraint) | Unsupported |
| **PWA Installation (`beforeinstallprompt`)** | Full Support | Full Support | Full Support | Manual "Add to Home Screen" | Full Support |
| **Persistent Storage Permission** | Full Support | Full Support | Full Support | Quota-based eviction | Full Support |
| **Service Worker & Caching** | Full Support | Full Support | Full Support | Full Support | Full Support |

---

## Technical Limitations & Platform Constraints

### 1. Web Share API (Level 2 File Sharing)
- **Android Support**: Starting in Chrome 89 and Chromium-based browsers, `navigator.share({ files: [audioFile] })` opens Android's native share sheet with the raw audio binary attachment (MP3, WAV, M4A, AAC, OGG).
- **Desktop Fallback**: Desktop browsers typically support Web Share Level 1 (sharing text and URLs), but not arbitrary binary file attachments. When `navigator.canShare({ files: [audioFile] })` returns `false`, Naatyavedam Library automatically triggers an instant file download (`downloadAudioBlobFallback`) with user feedback.
- **WhatsApp Direct Sharing**: On Android, selecting WhatsApp from the share sheet directly sends the audio file to the chosen contact or dance class group without needing external cloud links.

### 2. Web Share Target API (Incoming Audio Sharing)
- **How it Works**: Declared in `manifest.webmanifest` with `POST` and `multipart/form-data`. When a student taps "Share" on an audio file in WhatsApp or Files by Google and chooses *Naatyavedam*, the service worker (`sw-share-target.js`) intercepts the POST request to `/share-target`, extracts the audio Blob into IndexedDB (`NaatyavedamSharedIncomingDB`), and issues an HTTP 303 redirect to `/?incoming_share=true`.
- **iOS Safari Limitation**: iOS WebKit does not currently support Web Share Target Level 2 for multipart POST files. On iOS devices, students can import tracks via the standard file picker or via the Backup & Restore Hub.

### 3. PWA Installation Experience
- **Android Chrome**: Listens for the `beforeinstallprompt` event. When fired, the app presents a one-tap "Install Now" modal or banner. Once installed (`display-mode: standalone`), install banners are automatically suppressed.
- **iOS Safari**: Apple does not implement `beforeinstallprompt`. Users on iOS must tap Safari's Share button and select "Add to Home Screen". The app detects `window.navigator.standalone === true` to suppress installation guidance once added.

### 4. IndexedDB Storage & Eviction Protection
- **Storage Limits**: Android Chrome allows web apps to use up to 60% of available disk space for IndexedDB.
- **Eviction Risk**: Browsers may clear standard web caches if the device runs critically low on storage (< 1 GB free).
- **Persistent Storage API**: Naatyavedam Library invokes `navigator.storage.persist()`. When granted, the browser categorizes the local dance repertoire as "Persistent Storage", preventing automated eviction during disk cleanups.
- **Repertoire Protection Guarantee**: The application architecture strictly guarantees that local audio files are never automatically deleted by the app code just to save space.

### 5. Background Synchronization
- **Background Sync API**: Supported in Chromium on Android for retrying failed requests.
- **Network Transition Listeners**: In environments where Periodic Background Sync is constrained by OS battery optimizations, the app registers active window `online`, `focus`, and `visibilitychange` listeners to immediately flush pending upload/edit queues the moment the dancer brings the app into view or reconnects to Wi-Fi.
