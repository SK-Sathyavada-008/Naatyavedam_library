# Naatyavedam Library (నాట్యవేదం లైబ్రరీ)

**Naatyavedam Library** is a production-quality, mobile-first Progressive Web Application (PWA) designed for an Indian classical dance (**Kuchipudi**) school. The dance teacher and approved students collaboratively maintain one shared collection of dance music for class rehearsals, performances, and personal practice.

---

## Phase 1 — Project Foundation (Completed)
- React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons.
- Custom Kuchipudi design tokens: Warm Ivory (`#FAF8F5`), Charcoal (`#1E2328`), and Muted Sage (`#5E7A68`).
- PWA setup with Workbox service worker caching and Android standalone manifest.
- 6 initial navigable application screens.

---

## Phase 2 — Local Music Library with Dexie.js (Completed)

This phase establishes the offline-first IndexedDB storage, song file importer, and real audio playback engine.

### 1. IndexedDB Architecture (Dexie.js)
Database Name: `NaatyavedamLibraryDB`
Tables:
- **`songs`**: Stores song metadata (`id`, `title`, `originalFilename`, `fileType`, `fileSize`, `duration`, `createdAt`, `updatedAt`, `isFavorite`, `isLocalAvailable`, `syncStatus`, `category`, `ragam`, `talam`, `composer`, `isDeleted`, `deletedAt`).
- **`audioBlobs`**: Stores raw binary `Blob` objects natively in IndexedDB (**never Base64**).
- **`favorites`**: Tracks favorited tracks.
- **`downloadInfo`**: Local availability and offline cache state.
- **`pendingOperations`**: Queue for future cloud synchronization actions.
- **`appSettings`**: Local key-value store for user sessions and preferences.

### 2. Audio Importer
- **Single & Multiple File Import**: Via device/phone native file picker (`<input type="file" multiple accept="audio/*" />`).
- **Supported Formats**: MP3, M4A, WAV, AAC, OGG, OPUS, FLAC.
- **Duration Extraction**: Extracted via `Audio` metadata in the browser.
- **Non-Destructive**: Original phone files remain 100% untouched; only a binary copy is stored in IndexedDB.
- **Import Progress & Error States**: Displays live importing progress and friendly error messages for unsupported or corrupted files.

### 3. Functional Audio Player
- Real audio playback powered by HTML5 Audio from IndexedDB Blobs.
- Object URL lifecycle management (`URL.createObjectURL` and `URL.revokeObjectURL`) to eliminate memory leaks.
- Play, pause, seek (scrubber), forward 10s, rewind 10s, previous track, next track.
- Rehearsal tempo cycling (`0.8x`, `0.9x`, `1.0x`, `1.1x`, `1.25x`) for Kuchipudi practice.
- Single track loop / repeat mode for continuous Korvai rehearsal.
- Graceful missing-audio and playback-error handling.
- Integrated floating `MiniPlayer` and full-screen `PlayerPage`.

### 4. Library Management
- **Rename Display Title**: Updates `title` in DB without touching `originalFilename`.
- **Delete / Recovery Bin**: Soft-deletes tracks with full restore capability.
- **Favorites**: One-tap toggle with persistence.
- **Sorting**: By Recently Added, Title (A–Z), Title (Z–A), Longest First, Shortest First.
- **Search**: Real-time filtering by title, Ragam, Talam, and category.
- **Sample Repertoire Generator**: One-click synthesis of genuine classical WAV audio blobs for testing without needing phone file transfers.

---

## Project Structure

```
Naatyavedam_library/
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png       # PWA Android icon (192px)
│   │   ├── icon-512x512.png       # PWA Android icon & maskable (512px)
│   │   └── icon.svg               # Classical Natya vector icon
│   ├── favicon.ico
│   └── apple-touch-icon.png
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx      # Responsive shell with safe-area spacing
│   │   │   ├── BottomNav.tsx      # Mobile bottom navigation bar
│   │   │   └── TopHeader.tsx      # Sticky header with connectivity indicator
│   │   ├── player/
│   │   │   └── MiniPlayer.tsx     # Floating mini audio bar
│   │   └── ui/                    # Reusable Design System primitives
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   ├── hooks/
│   │   └── useAudioPlayer.ts      # Audio engine hook with object URL cleanup
│   ├── services/
│   │   ├── db.ts                  # Dexie.js database & table operations
│   │   └── audioImporter.ts       # Audio validation, duration extraction & import
│   ├── pages/
│   │   ├── LibraryPage.tsx        # Main library with sorting, import & search
│   │   ├── LoginPage.tsx          # User sign-in
│   │   ├── PlayerPage.tsx         # Dedicated rehearsal player
│   │   ├── RegisterPage.tsx       # Student registration
│   │   ├── SettingsPage.tsx       # Account, storage & recovery bin
│   │   └── WelcomePage.tsx        # Landing screen
│   ├── styles/
│   │   └── globals.css            # Tailwind directives & mobile touch styles
│   ├── types/
│   │   └── index.ts               # Strict TypeScript domain interfaces
│   ├── utils/
│   │   ├── audioGenerator.ts      # Classical WAV synthesizer for testing
│   │   └── index.ts               # Formatting, timing & styling utilities
│   ├── App.tsx                    # Main state coordinator & router
│   ├── main.tsx                   # Entry point & PWA service worker register
│   └── vite-env.d.ts              # Vite & PWA type declarations
├── tests/
│   └── importer.test.js           # Unit tests for import & audio generation
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Running Locally & Testing

### 1. Run Unit Tests
```bash
npm test
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Build & Run Production PWA
```bash
npm run build
npm run preview
```
