# Phase 7 — Android Sharing and PWA Integration Documentation

## Overview
Phase 7 integrates mobile-first Android sharing capabilities into **Naatyavedam Library** (PWA for Kuchipudi classical dance repertoire). It allows dance teachers and students to exchange rehearsal audio tracks directly between native Android apps (WhatsApp, Files by Google, Telegram) and Naatyavedam Library.

---

## 1. Incoming Audio Sharing (Web Share Target API)

### How It Works:
1. **Manifest Configuration** (`vite.config.ts`):
   - `share_target` declared with `action: "/share-target"`, `method: "POST"`, and `enctype: "multipart/form-data"`.
   - File parameter `audio` accepting: `audio/*`, `.mp3`, `.m4a`, `.wav`, `.aac`, `.ogg`, `.opus`, `.flac`.
2. **Service Worker Interceptor** (`public/sw-share-target.js`):
   - Intercepts incoming `POST /share-target` requests.
   - Extracts all shared audio files from the multipart payload (using `formData.getAll('audio')` with fallback to all form values).
   - Stores the raw audio `Blob`/`File` objects into a dedicated IndexedDB store (`NaatyavedamSharedIncomingDB.incomingSharedFiles`).
   - Responds with `Response.redirect('/?incoming_share=true', 303)` to return user cleanly into the PWA.
3. **PWA Incoming Share Review Modal** (`IncomingShareModal.tsx`):
   - When the app regains focus or navigates with `?incoming_share=true`, it loads the pending files.
   - Automatically derives a clean display title and guesses the Kuchipudi dance category (e.g., *Jatiswaram, Shabdam, Varnam, Tarangam, Thillana*).
   - Validates audio file types and sizes.
   - Allows students and teachers to review or customize title and category before saving.
   - Saves locally into IndexedDB and automatically queues/uploads to Supabase cloud storage.

---

## 2. Outgoing Audio Sharing (Web Share API Level 2)

### How It Works:
1. **Native File Sharing** (`src/services/audioShare.ts`):
   - Shares the **actual audio file binary attachment** (`File` object) using `navigator.share({ files: [audioFile], title, text })`.
   - Opens Android's native system share sheet where users can choose WhatsApp, Google Drive, Gmail, or nearby share.
2. **Feature Detection (`canShareAudioFile`)**:
   - Uses `navigator.canShare({ files: [file] })` to verify that the active browser and OS support sharing file attachments.
3. **Automatic Fallback**:
   - If file sharing is not supported by the environment (e.g., desktop browsers or unsupported web views), the app automatically triggers an audio file download (`downloadAudioBlobFallback`) with user notification so rehearsals are never disrupted.

---

## 3. Standard Android File Picker

- Direct import button in Library view uses `<input type="file" multiple accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac" />`.
- Supports selecting one or multiple tracks directly from Android's built-in file picker, Google Drive, or SD card storage.

---

## 4. PWA Installation Experience

- **Standalone Mode Detection**:
  - Uses `window.matchMedia('(display-mode: standalone)').matches` and `navigator.standalone`.
  - When the app is already installed and running as a standalone app on the phone, all installation prompts and banners are automatically hidden.
- **Chrome Installation Guidance** (`InstallModal.tsx`):
  - Provides clear instructions: Open in Google Chrome &rarr; Tap `⋮` &rarr; Tap "Install app" / "Add to Home screen".
  - If the browser fires `beforeinstallprompt`, the "Install Now" button triggers native one-tap installation directly.
- **Settings Hub & Banner**:
  - Unobtrusive install banner on the Library page with "Install on Phone" and "Not now" options.
  - Dedicated "Android & PWA Setup" card in `SettingsPage.tsx` reporting whether running in Standalone Mode or Browser Tab.

---

## 5. Android Quirks & Browser Compatibility

| Platform / Browser | Incoming Web Share Target | Outgoing Audio File Sharing | Installation Prompt (`beforeinstallprompt`) |
|-------------------|--------------------------|----------------------------|---------------------------------------------|
| **Android Chrome (v76+)** | Full Support (POST multipart) | Full Support (`navigator.share({ files })`) | Full Support |
| **Android Edge / Brave** | Full Support | Full Support | Full Support |
| **WhatsApp for Android** | Can share audio to installed PWA | Target receives shared audio attachment | N/A |
| **Files by Google** | Can share audio to installed PWA | Target receives shared audio attachment | N/A |
| **Desktop Chrome** | N/A | URL/Text only (falls back to file download) | Full Support |
| **iOS Safari** | Limited (GET only) | Audio file sharing supported (iOS 15+) | Manual "Add to Home Screen" |

---

## 6. Verification & Test Results
- **Unit Tests**: `node --test tests/sharing.test.js` &rarr; **6 / 6 passing**.
- **Full Suite**: `node --test tests/*.test.js` &rarr; **43 / 43 passing** across auth, importer, offline sync, programs, search, shared library, and sharing.
- **Production Build**: `npm run build` &rarr; **Clean build with PWA Service Worker and manifest generation**.

