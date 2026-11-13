# Naatyavedam Library

**Naatyavedam Library** is a production-quality, mobile-first Progressive Web Application (PWA) designed for an Indian classical dance (**Kuchipudi**) school. The dance teacher and approved students collaboratively maintain one shared collection of dance music for class rehearsals, performances, and personal practice.

---

## Phase 1 — Project Foundation (Completed)
- React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons.
- Custom Kuchipudi design tokens: Warm Ivory (`#FAF8F5`), Charcoal (`#1E2328`), and Muted Sage (`#5E7A68`).
- PWA setup with Workbox service worker caching and Android standalone manifest.
- 6 initial navigable application screens.

---

## Phase 2 — Local Music Library with Dexie.js (Completed)
- IndexedDB database (`NaatyavedamLibraryDB`) with raw binary `Blob` storage (never Base64).
- Audio file importer supporting MP3, M4A, WAV, AAC, OGG, OPUS, FLAC.
- Real HTML5 audio playback with leak-free `URL.createObjectURL` / `URL.revokeObjectURL` lifecycle management.
- Rehearsal tempo multiplier (`0.8x` to `1.25x`), seek scrubber, repeat loop, and 10s skip/rewind.

---

## Phase 3 — Search and Library Experience (Completed)

This phase introduces client-side offline fuzzy search with Fuse.js, matched-text highlighting, a multi-select mode, and synchronized player navigation.

### 1. Offline Fuzzy Search with Fuse.js
- Configured with balanced threshold (`0.38`) and weighted keys (`title: 0.5`, `originalFilename: 0.25`, `category: 0.15`, `ragam: 0.1`).
- **Typo Tolerance**: Handles missing letters and typos (e.g., searching `Krshna` matches `Krishna Shabdam`).
- **Partial Matching**: Prefix and substring matching (e.g., `Krishna Shab`, `Shab`).
- **Word Order Independence**: Multi-token algorithm supports inverted queries (e.g., `Shabdam Krishna`).
- **Original Filename Search**: Matches phone filenames (e.g. `shankarabharanam.mp3`).
- **100% Offline**: Runs purely in the browser against IndexedDB metadata without internet.

### 2. Search UI & Text Highlighting
- Prominent search bar with instant reactive filtering as the user types.
- One-tap clear search button (`X`).
- Matched text highlighting via `<HighlightedText>` with subtle sage accents.
- Friendly no-results state with one-click filter reset.

### 3. Multi-Select & Bulk Operations
- Enter multi-select mode via the **"Select"** button.
- Select individual songs or tap **"Select All"** / **"Deselect All"**.
- Contextual selection action bar:
  - **Bulk Favorite / Unfavorite**: Toggles favorite status for all selected songs.
  - **Bulk Delete**: Prompts a confirmation modal before moving selected songs to the Recovery Bin.
  - **Selected Count**: Displays exact count of active selections.
  - **Clean UI**: Disappears completely when leaving selection mode to keep everyday browsing minimal.

### 4. Player Queue Synchronization
- Next/Previous controls in both the floating `MiniPlayer` and full-screen `PlayerPage` dynamically follow the **active filtered and sorted song list**.
- Prominent playing badge and active border highlight in the library so the current track is instantly recognizable.
- Playback continues seamlessly across all screen navigations.

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
│   │       ├── HighlightedText.tsx# Fuse match highlighter
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   ├── hooks/
│   │   └── useAudioPlayer.ts      # Audio engine hook with queue synchronization
│   ├── services/
│   │   ├── db.ts                  # Dexie.js database & bulk operations
│   │   ├── fuzzySearch.ts         # Fuse.js offline fuzzy search engine
│   │   └── audioImporter.ts       # Audio validation, duration extraction & import
│   ├── pages/
│   │   ├── LibraryPage.tsx        # Main library with search, multi-select & filters
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
│   ├── importer.test.js           # Unit tests for import & audio generation
│   └── search.test.js             # Unit tests for Fuse.js fuzzy search queries
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Running Locally & Testing

### 1. Run Unit Tests (11 Tests)
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
