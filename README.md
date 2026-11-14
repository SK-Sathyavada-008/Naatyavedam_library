# Naatyavedam Library (నాట్యవేదం లైబ్రరీ)

> A mobile-first, offline-ready rehearsal audio player and collaborative repertoire management system engineered specifically for Indian classical dance (**Kuchipudi**) academies.

Guru Veda (Dance Teacher) and approved dance students collaboratively maintain one unified repertoire of classical dance tracks for stage shows, daily academy rehearsals, and home practice.

---

## Why Naatyavedam? (The Problem It Solves)

Generic music streaming platforms (Spotify, Apple Music, YouTube Music) and file drives (Google Drive, Dropbox) fail Indian classical dance teachers and students in real-world rehearsals:

1. **Rehearsal Tempo Without Pitch Distortion**: Dancers learn intricate *adavus*, *jatis*, and *chollukattus* at slower speeds (`0.8x` or `0.9x`) before transitioning to full stage speed (`1.0x` or `1.15x`). Standard media players shift the audio pitch, turning the singer's voice into high-pitched distortion. Naatyavedam uses high-quality Web Audio time-stretching to adjust speed while preserving musical pitch.
2. **Zero-Internet Green Rooms & Stages**: Classical dance performance halls, auditorium green rooms, and temple stages often have zero cellular connectivity. Naatyavedam stores raw binary audio tracks directly inside the device's **IndexedDB**, guaranteeing that every rehearsal track plays instantly offline with zero latency.
3. **Structured by Classical Dance Margam**: Dance music cannot be organized by pop albums or artists. Naatyavedam organizes repertoire strictly by classical performance sequence:
   * *Pushpanjali*
   * *Jatiswaram*
   * *Shabdam*
   * *Varnam*
   * *Keerthanam*
   * *Tarangam (Brass Plate Dance)*
   * *Thillana*
   * *Mangalam / Slokam*
   * *Practice Beats & Talam*
4. **Stage Programs & Repertoire Sequencing**: Assembling an *Arangetram* or Annual Day show requires sequencing 8–10 tracks, adding stage-specific edits (e.g., a 12-minute abridged Varnam), and reordering pieces without creating duplicate audio bloat in the main library.
5. **Eliminating WhatsApp Audio Chaos**: Gurus and students constantly share rehearsal snippets via WhatsApp, where files get lost in unorganized phone storage. Naatyavedam integrates directly with Android's system share sheet, allowing students to tap "Share" on any audio file in WhatsApp or Files and import it straight into the academy's library.

---

## Core Application Features

### 1. Classical Dance Audio Player
* **Pitch-Preserving Speed Changer**: Rehearse at `0.75x`, `0.85x`, `1.0x`, `1.15x`, or `1.25x` speed without changing vocal pitch.
* **A/B Repeat Looping**: Repeat difficult rhythm sequences and *theermanams* continuously until footwork is mastered.
* **Persistent Lock-Screen MediaSession**: Control playback (Play, Pause, Skip, Seek) from phone lock screens and Bluetooth stage sound systems.
* **Synchronized Queue**: Floating `MiniPlayer` and full-screen `PlayerPage` dynamically follow filtered search results and custom program sequences.

### 2. Unified Cloud Repertoire (Supabase + Dexie)
* **Single Shared Collection**: When Guru Veda or Student SK uploads a track, it synchronizes across all approved academy members.
* **Metadata Rich**: Tracks store Raagam, Taalam, Composer, Choreographer, Category, and Practice Notes.
* **Offline-First**: Every track uploaded or downloaded is cached locally in IndexedDB. Internet is only required to synchronize changes.

### 3. Collaborative Stage Programs
* **Performance Sequencing**: Group repertoire pieces into distinct programs (e.g., *"Annual Day 2027"*, *"Kuchipudi Festival Hyderabad"*).
* **Drag-and-Drop Reordering**: Rearrange stage track orders on the fly with touch drag-and-drop or Move Up / Move Down controls.
* **Stage-Specific Audio Edits**: Attach custom trimmed recordings to a program item without duplicating or altering the original library master track.
* **Program Duplication**: Clone an entire stage sequence for different batches of senior and junior students with one tap.

### 4. Android PWA & Native Sharing
* **Incoming Share (Web Share Target Level 2)**: Select an audio track in WhatsApp, Telegram, or Files by Google &rarr; tap **Share** &rarr; select **Naatyavedam Library**. The app validates the audio, guesses the Kuchipudi category, lets you edit the title, and saves it locally and to the cloud.
* **Outgoing Native Share (Web Share API Level 2)**: Tapping Share on any track opens Android's native share sheet and attaches the **actual audio binary file** (`File` object) so you can send the music directly into WhatsApp groups. Automatic download fallback is provided on desktop browsers.
* **Standalone Home Screen App**: Installable as a native app on Android Chrome with no browser address bars or tabs.

### 5. Two-Tier Role-Based Security & Recovery Bin
* **Guru (Teacher) Account**: Full administrative rights. Guru Veda initializes the school account securely via a server-side SQL function, approves new student registrations, generates 6-character password reset codes, and manages student access.
* **Dance Students**: Can register with username/password, browse the entire repertoire after teacher approval, upload music, rename tracks, soft-delete tracks to the recovery bin, and manage stage programs.
* **Shared Recovery Bin (Trash)**: To protect against accidental deletions during rehearsals, deleted songs are retained in a shared recovery bin for **30 days** showing who deleted the track and when. Any approved member can restore songs. Only the Teacher has permission to permanently purge songs.

### 6. Portable Backup & Restore System
* **Export Full Library (.zip)**: Generates a standard, portable ZIP archive containing `manifest.json`, `songs.json`, `programs.json`, and all raw audio files.
* **Zero External Dependencies**: Built with a pure-TypeScript PKZIP generator and parser (Store mode).
* **Safe Non-Destructive Restore**: Validates manifest signatures and imports songs without overwriting or corrupting existing local tracks.

### 7. Storage Management & Activity Timeline
* **Live Storage Dashboard**: View device IndexedDB storage usage, quota meter, downloaded songs count, pending upload count, and cloud sync status.
* **Protected Repertoire Guarantee**: The application architecture strictly guarantees that local audio files are never automatically deleted by the app to free space.
* **Activity Timeline**: A clean, readable chronological feed showing who uploaded, renamed, or restored songs.

---

## Technical Architecture & Core Logic

### 1. Audio Memory & Lifecycle Management
Browsers can easily leak memory when generating Blob URLs for large audio files. Naatyavedam handles this with a strict lifecycle:
```typescript
// Memory-safe URL generation with immediate cleanup
const objectUrl = URL.createObjectURL(blob);
audio.src = objectUrl;

// Cleanup previous object URLs when changing songs or unmounting
const cleanup = () => {
  if (activeUrlRef.current) {
    URL.revokeObjectURL(activeUrlRef.current);
    activeUrlRef.current = null;
  }
};
```

### 2. Offline-First Synchronization Pipeline
Every mutation follows a 6-step lifecycle:
```
[User Action] 
     ↓
1. Save locally to IndexedDB (Instant optimistic UI)
     ↓
2. Enqueue in db.pendingOperations ('UPLOAD' | 'RENAME' | 'DELETE' | 'FAVORITE')
     ↓
3. Check network status (navigator.onLine)
   ├── OFFLINE: Retain in queue; wait for 'online' or 'visibilitychange' event
   └── ONLINE: Process queue with idempotency
           ↓
4. Upload audio binary to Supabase Storage ('music-library' bucket)
           ↓
5. Upsert metadata in Supabase PostgreSQL ('songs' and 'song_files')
           ↓
6. Mark IndexedDB record as 'synced' and remove from pending queue
```

### 3. Incoming Share Target Interceptor (`sw-share-target.js`)
When an Android app shares audio files via multipart POST, standard web pages cannot receive the files directly without an active HTTP server. Naatyavedam solves this using Service Worker interception:
```javascript
// Service worker fetch listener in public/sw-share-target.js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('audio');
      // Save raw files into IndexedDB bridge: NaatyavedamSharedIncomingDB
      await saveSharedIncomingFiles(files);
      // HTTP 303 redirect brings user safely back into the PWA
      return Response.redirect('/?incoming_share=true', 303);
    });
  }
});
```

### 4. Client-Side Offline Fuzzy Search (`fuzzySearch.ts`)
Configured using Fuse.js with weighted fields and typo tolerance:
```typescript
const options = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'originalFilename', weight: 0.25 },
    { name: 'category', weight: 0.15 },
    { name: 'ragam', weight: 0.1 },
  ],
  threshold: 0.38,
  ignoreLocation: true,
  findAllMatches: true,
};
```

### 5. Pure-TypeScript PKZIP Engine (`backupService.ts`)
Rather than pulling in heavy third-party archiving dependencies, Naatyavedam implements a spec-compliant PKZIP Store-mode encoder:
* Generates **Local File Headers** (`0x04034b50`) with CRC-32 checksums and UTF-8 flags.
* Generates **Central Directory Headers** (`0x02014b50`) with relative offsets.
* Generates the **End of Central Directory Record** (`0x06054b50`).
* Produces standard `.zip` files openable natively on Windows Explorer, macOS Archive Utility, 7-Zip, and Android Files.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **UI Framework** | React 18 + TypeScript 5.6 | Component architecture with strict typing |
| **Build Tool** | Vite 5.4 | Fast HMR and optimized production bundling |
| **Styling** | Tailwind CSS | Mobile-first responsive styling and classical design tokens |
| **Icons** | Lucide React | Clean, accessible SVG iconography |
| **Local Database** | Dexie.js 4 (IndexedDB) | Reactive, client-side offline storage for audio Blobs and metadata |
| **Fuzzy Search** | Fuse.js 7 | Fast offline search with typo tolerance and token weighting |
| **Cloud Database** | Supabase PostgreSQL 15 | Relational data, Row Level Security, RPC functions |
| **Cloud Storage** | Supabase Storage | Secure cloud storage bucket for shared audio recordings |
| **Authentication** | Supabase Auth (GoTrue) | Username/password authentication mapped to internal secure domain |
| **PWA & Caching** | Workbox 7 + Vite PWA | Service worker caching, offline app shell, and installability |
| **Native APIs** | Web Share Level 2, Share Target Level 2, StorageManager | Android system share sheet, PWA share receiver, persistent storage |

---

## Local Development & Setup

### Prerequisites
* **Node.js**: v18.0+ or v20.0+
* **npm**: v9.0+

### 1. Clone & Install
```bash
git clone https://github.com/SK-Sathyavada-008/Naatyavedam_library.git
cd Naatyavedam_library
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
*(Never place your Supabase `service_role` key here. The client uses only the public publishable anon key.)*

### 3. Database Migrations
In your Supabase project dashboard, open the **SQL Editor** and run the migration scripts located in `supabase/migrations/`:
1. `20261114_phase4_auth_and_roles.sql`: Auth, profiles, roles, student approvals, password resets, activity logs.
2. `20261114_phase5_collaborative_programs.sql`: Collaborative dance stage programs, sequences, and items.
3. `20261114_phase5_shared_music_library.sql`: Songs, files, storage buckets, and RLS policies.

### 4. Initialize Teacher Account (Guru Veda)
In your Supabase SQL Editor, run:
```sql
SELECT create_initial_teacher_account('veda', 'naatyavedam', 'Guru Veda');
```
This securely creates the teacher profile with role `TEACHER` and prevents unauthorized public teacher creation.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Automated Test Suites (65 / 65 Passing)

Run the full test suite using Node's native test runner:
```bash
npm test
```

### Test Coverage Highlights:
* **Production Readiness Checklist (16 tests)**: Simulates 1 Teacher (Veda), 2 Students (SK and Priya), 2 Android Devices, 1 Newly Installed Device, offline mode, slow network latency, interrupted uploads/downloads, duplicate uploads, rename conflicts, student access revocation, password reset verification, and native file sharing.
* **Backup & Recovery (6 tests)**: ZIP local headers, central directory offsets, EOCD signatures, archive extraction, corrupt archive rejection, and storage calculation.
* **Shared Cloud Library (7 tests)**: Collaborative uploads, cross-user renames, soft-deletes, restore permissions, and teacher-only permanent deletion.
* **Offline Sync Manager (6 tests)**: Local-first persistence, offline mutation queuing, conflict handling, and non-destructive metadata sync.
* **Collaborative Programs (4 tests)**: Program creation, drag-and-drop track reordering, duplicate program cloning, and equal permissions.
* **Fuzzy Search (7 tests)**: Typo tolerance (*"Krshna"* &rarr; *"Krishna"*), partial matches, inverted token order, and filename searches.
* **Authentication & Validation (8 tests)**: Username regex validation, password strength, internal domain mapping, and role-based access control.
* **Android PWA & Sharing (6 tests)**: Web Share Target manifest configuration, Level 2 file sharing, download fallback, and standalone mode detection.

---

## Deployment Guide

### Production Build
```bash
npm run build
```
Builds the production bundle into `dist/`, including minified assets, PWA manifest (`dist/manifest.webmanifest`), and service workers (`dist/sw.js`, `dist/sw-share-target.js`).

### Deploy to Netlify / Vercel / Cloudflare Pages
1. Connect this repository: `https://github.com/SK-Sathyavada-008/Naatyavedam_library.git`.
2. Configure build settings:
   * **Build Command**: `npm run build`
   * **Publish Directory**: `dist`
3. Add Environment Variables in the hosting dashboard:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Ensure **HTTPS** is enabled (HTTPS is strictly required for Service Workers, Web Share Target, and the Web Share API).

---

## Browser Compatibility & Mobile Constraints

| Platform | Web Share Target (Incoming) | Web Share API (Outgoing Files) | PWA Installation | Offline IndexedDB |
|---|---|---|---|---|
| **Android Chrome (89+)** | **Full Support** | **Full Support** | **Full Support** | **Full Support** |
| **Android Edge / Brave** | **Full Support** | **Full Support** | **Full Support** | **Full Support** |
| **Desktop Chrome / Edge** | N/A | Fallback to Download | Full Support | Full Support |
| **iOS Safari (15+)** | Manual Picker (WebKit limitation) | Full Support | Manual "Add to Home Screen" | Full Support |

*For in-depth browser compatibility notes and mobile constraints, see [docs/browser_compatibility.md](docs/browser_compatibility.md).*

---

## License

Created for Naatyavedam Kuchipudi Dance Academy. All rights reserved.
