# Naatyavedam Library (నాట్యవేదం లైబ్రరీ)

**Naatyavedam Library** is a production-quality, mobile-first Progressive Web Application (PWA) designed for an Indian classical dance (**Kuchipudi**) school. The dance teacher and approved students collaboratively maintain one shared collection of dance music for class rehearsals, performances, and personal practice.

---

## Phase 1 — Project Foundation (Completed)

This phase establishes the foundational architecture, responsive mobile layout, custom design system, PWA configuration, and initial navigable application screens.

### Key Features Implemented:
1. **Modern PWA Architecture**:
   - Built with **React 18**, **TypeScript**, and **Vite**.
   - Fully configured PWA plugin (`vite-plugin-pwa`) with **Workbox** service worker precaching for complete offline app-shell operation.
   - Web App Manifest configured for Android (`standalone` display, portrait primary orientation, custom 192px/512px icons, theme color `#FAF8F5`).

2. **Kuchipudi Minimalist Design System**:
   - **Warm Ivory / Canvas**: `#FAF8F5`, `#F4F0E8`, `#FFFFFF`
   - **Charcoal Typography**: `#1E2328`, `#5A626A`, `#8C95A0`
   - **Muted Sage / Mint Accent**: `#5E7A68` (hover `#4C6555`, subtle badge `#EBF1ED`)
   - **Neutral Soft Borders**: `#E5E0D6`
   - **Large Touch Targets**: 48px minimum touch targets optimized for mobile use during dance rehearsals.
   - Soft rounded corners, subtle shadows, and zero visual clutter.

3. **6 Initial Navigable Screens**:
   - **Welcome / Landing Page**: Classical dance greeting, value pillars, quick demo logins for Teacher or Student.
   - **Login Page**: Clean username & password credentials form with quick-fill demo shortcuts.
   - **Registration Page**: Student registration form with approval notice and submission acknowledgement state.
   - **Main Library Page**: Authentic Kuchipudi sample repertoire (Jatiswaram, Shabdam, Varnam, Tarangam, Thillana, Keerthanam, Pushpanjali, Slokam), live category filters, search bar, favorite toggles, offline status, and music upload modal.
   - **Full Music Player Page**: Large touch controls, tempo/speed cycling (0.8x - 1.25x for rehearsals), 10s skip/rewind, loop mode, scrubber, and classical vinyl groove artwork.
   - **Account & Settings Page**: Profile card, role switcher for development evaluation, device storage stats with persistent storage request API, recovery bin view, and activity history.

4. **Floating Mini-Player Bar**:
   - Docked above the bottom navigation bar when an audio track is selected.
   - One-tap play/pause and expand-to-full-screen.

---

## Project Structure

```
Naatyavedam_library/
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png       # PWA Android icon (192px)
│   │   ├── icon-512x512.png       # PWA Android icon & maskable (512px)
│   │   └── icon.svg               # Vector icon
│   ├── favicon.ico
│   └── apple-touch-icon.png
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx      # Main responsive shell wrapper
│   │   │   ├── BottomNav.tsx      # Mobile bottom navigation bar
│   │   │   └── TopHeader.tsx      # Top bar with online/offline & role badge
│   │   ├── player/
│   │   │   └── MiniPlayer.tsx     # Floating mini audio bar
│   │   └── ui/                    # Reusable Design System components
│   │       ├── Badge.tsx          # Dance category & status pills
│   │       ├── Button.tsx         # Primary, secondary, ghost, danger buttons
│   │       ├── Card.tsx           # Subtle bordered cards
│   │       ├── Input.tsx          # Text & password inputs with icons
│   │       └── Modal.tsx          # Accessible modal dialogs & sheets
│   ├── data/
│   │   └── mockDanceMusic.ts      # Sample Kuchipudi repertoire (isolated)
│   ├── pages/
│   │   ├── LibraryPage.tsx        # Main repertoire list, search & filters
│   │   ├── LoginPage.tsx          # User sign-in
│   │   ├── PlayerPage.tsx         # Dedicated rehearsal player
│   │   ├── RegisterPage.tsx       # Student registration
│   │   ├── SettingsPage.tsx       # Account, storage & admin overview
│   │   └── WelcomePage.tsx        # Landing screen
│   ├── styles/
│   │   └── globals.css            # Tailwind directives & safe-area utilities
│   ├── types/
│   │   └── index.ts               # Shared TypeScript domain models
│   ├── utils/
│   │   └── index.ts               # Formatting, timing & styling utilities
│   ├── App.tsx                    # Top-level state coordinator & router
│   ├── main.tsx                   # React root & PWA service worker registration
│   └── vite-env.d.ts              # TypeScript environment definitions
├── index.html                     # HTML5 entry with mobile meta tags
├── package.json
├── postcss.config.js
├── tailwind.config.js             # Design tokens & color system
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts                 # Vite + PWA Workbox configuration
```

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. On Chrome DevTools, toggle Device Mode (select **Pixel 7** or **Samsung Galaxy S20**) to experience the Android-first mobile layout.

### 3. Production Build & PWA Testing
```bash
npm run build
npm run preview
```
Visit the preview URL in Chrome or an Android device on the same local network to test PWA installation and offline service worker caching.
