# Naatyavedam Library — Classical Dance Repertoire PWA

**Naatyavedam Library** is a mobile-first Progressive Web Application (PWA) designed for an Indian classical dance (**Kuchipudi**) academy. Guru Veda (Dance Teacher) and approved dance students collaboratively maintain a shared collection of dance music for stage performances, rehearsals, and personal practice.

The app follows an **offline-first local architecture** using Dexie.js (IndexedDB) for instant offline rehearsal playback, combined with **Supabase PostgreSQL & Supabase Storage** for collaborative cloud synchronization, role-based security, and cross-device synchronization.

---

## 1. Technology Stack

- **Frontend Core**: React 18, TypeScript 5.6, Vite 5.4.
- **Styling & UI**: Tailwind CSS, Lucide Icons, custom Telugu classical palette (Warm Ivory `#FAF8F5`, Charcoal `#1E2328`, Muted Sage `#4A7C59`).
- **Offline Storage**: Dexie.js 4 (IndexedDB) with raw binary `Blob` audio storage (never Base64 strings).
- **Search**: Fuse.js client-side fuzzy search with typo tolerance and token-based highlighting.
- **Cloud Backend**: Supabase (PostgreSQL 15, Row Level Security, Supabase Auth, Supabase Storage).
- **PWA & Offline**: Workbox 7, Service Worker runtime caching, standalone orientation manifest, Web Share Target Level 2.
- **Native Sharing**: Web Share API Level 2 (audio `File` objects) with automatic download fallback.
- **Backup & Restore**: Zero-dependency pure-TypeScript PKZIP generator and parser (Store mode).
- **Testing**: Node.js native test runner (`node:test`) with 65 automated tests across 9 suites.

---

## 2. Folder Structure

```
Naatyavedam_library/
├── public/
│   ├── icons/                     # PWA Icons (192px, 512px, maskable)
│   ├── sw-share-target.js         # Service Worker Web Share Target POST interceptor
│   ├── favicon.ico
│   └── apple-touch-icon.png
├── src/
│   ├── components/
│   │   ├── layout/                # AppLayout, TopHeader, BottomNav
│   │   ├── player/                # MiniPlayer
│   │   ├── pwa/                   # IncomingShareModal, InstallModal, InstallBanner, BackupModal
│   │   └── ui/                    # Button, Input, Modal, Badge, Card, HighlightedText
│   ├── data/                      # Mock dance repertoire & fallback users
│   ├── hooks/                     # useAudioPlayer, usePwaInstall
│   ├── lib/                       # supabase.ts (Client initialization)
│   ├── pages/
│   │   ├── WelcomePage.tsx        # App entry & quick demo login
│   │   ├── LoginPage.tsx          # Username/password sign in
│   │   ├── RegisterPage.tsx       # Student registration
│   │   ├── PendingApprovalPage.tsx# Pending teacher review screen
│   │   ├── LibraryPage.tsx        # Songs, categories, search, multi-select, import
│   │   ├── PlayerPage.tsx         # Full-screen player with tempo, loop, & native share
│   │   ├── ProgramsPage.tsx       # Collaborative stage programs & track sequences
│   │   ├── ActivityPage.tsx       # Repertoire change timeline
│   │   └── SettingsPage.tsx       # Profile, teacher admin, storage, trash, backup
│   ├── services/
│   │   ├── audioImporter.ts       # Audio validation, metadata derivation, duration
│   │   ├── audioShare.ts          # Native Web Share API Level 2 file sharing
│   │   ├── auth.ts                # Supabase Auth, teacher admin, password resets
│   │   ├── backupService.ts       # Portable ZIP/JSON backup export & import
│   │   ├── cloudLibrary.ts        # Supabase PostgreSQL & Storage sync
│   │   ├── db.ts                  # Dexie IndexedDB schemas & operations
│   │   ├── fuzzySearch.ts         # Fuse.js offline fuzzy search
│   │   ├── shareTarget.ts         # IndexedDB bridge for incoming shared audio
│   │   └── syncManager.ts         # Offline-first sync manager & conflict resolution
│   ├── types/                     # TypeScript interfaces & domain types
│   ├── utils/                     # Formatting, helpers, melody synthesizer
│   ├── App.tsx                    # Root routing & state orchestration
│   └── main.tsx                   # React root entry
├── supabase/
│   └── migrations/
│       ├── 20261114_phase4_auth_and_roles.sql
│       ├── 20261114_phase5_collaborative_programs.sql
│       └── 20261114_phase5_shared_music_library.sql
├── tests/                         # 65 automated tests across 9 suites
├── docs/                          # Architecture & phase documentation
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 3. Local Setup & Installation

### Prerequisites
- Node.js 18.0+ or 20.0+
- npm 9.0+

### Clone & Install
```bash
git clone https://github.com/SK-Sathyavada-008/Naatyavedam_library.git
cd Naatyavedam_library
npm install
```

### Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Google Chrome.

### Run Automated Tests
```bash
npm test
```
Executes all 65 unit tests across the test suites.

---

## 4. Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> [!IMPORTANT]
> - Never place your Supabase `service_role` key in `.env.local` or any frontend file.
> - Only the public publishable anon key (`VITE_SUPABASE_PUBLISHABLE_KEY`) is used on the client.
> - `.env.local` is listed in `.gitignore` and must never be committed to Git.

---

## 5. Supabase Database & Storage Setup

1. In your Supabase Dashboard, open the **SQL Editor**.
2. Run the three migration scripts in order:
   - [20261114_phase4_auth_and_roles.sql](file:///c:/Keerthu/Naatyavedam_library/supabase/migrations/20261114_phase4_auth_and_roles.sql)
   - [20261114_phase5_collaborative_programs.sql](file:///c:/Keerthu/Naatyavedam_library/supabase/migrations/20261114_phase5_collaborative_programs.sql)
   - [20261114_phase5_shared_music_library.sql](file:///c:/Keerthu/Naatyavedam_library/supabase/migrations/20261114_phase5_shared_music_library.sql)
3. Ensure the storage bucket `music-library` exists and is marked **private** (the migration scripts set up RLS policies so authenticated approved members can upload and read audio objects).

---

## 6. One-Time Teacher Initialization

To bootstrap the school's initial administrator account without exposing credentials:

1. Open Supabase Dashboard &rarr; **SQL Editor**.
2. Run the initialization function:
   ```sql
   SELECT create_initial_teacher_account('veda', 'naatyavedam', 'Guru Veda');
   ```
3. The function creates the auth user `veda@naatyavedam.com`, assigns role `TEACHER`, sets status `APPROVED`, and locks down future teacher creation by public users.
4. Guru Veda can then log in with:
   - **Username**: `veda`
   - **Password**: `naatyavedam`

---

## 7. Role-Based Access Control (RBAC) & Roles

| Capability | Dance Teacher (Guru Veda) | Approved Student (e.g. SK) | Pending Student |
|---|---|---|---|
| **Browse & Play Songs** | Yes | Yes | No |
| **Offline Playback & Caching** | Yes | Yes | No |
| **Upload Repertoire Audio** | Yes | Yes | No |
| **Rename Songs** | Yes | Yes | No |
| **Move Songs to Recovery Bin (Trash)** | Yes | Yes | No |
| **Restore Songs from Recovery Bin** | Yes | Yes | No |
| **Permanently Delete Songs** | **Yes** (Teacher Only) | **No** (Strictly Denied) | No |
| **Create & Edit Programs** | Yes | Yes | No |
| **Reorder Songs in Programs** | Yes | Yes | No |
| **Approve / Reject Registrations** | **Yes** (Teacher Only) | No | No |
| **Generate Password Reset Codes** | **Yes** (Teacher Only) | No | No |
| **Revoke Student Access** | **Yes** (Teacher Only) | No | No |

---

## 8. Backup & Recovery System

- **Export**: Generates a standard, portable `.zip` archive containing:
  - `manifest.json`: Application metadata, version, export timestamp, track counts.
  - `songs.json`: Metadata for all songs (titles, categories, ragam, talam, duration, notes, favorites).
  - `programs.json`: Performance program sequences and item positions.
  - `audio/<id>.<ext>`: Actual audio binaries.
- **Import**: Select any previously exported `.zip` or `.json` file. The import pipeline validates the manifest signature, validates audio files, and restores songs and programs non-destructively without overwriting existing local data.
- **Recovery Bin**: Soft-deleted songs are safely retained for 30 days. Any approved member can restore songs at any time.

---

## 9. Mobile & Android Integration

- **Incoming Audio Sharing (Web Share Target)**:
  - Select audio files in WhatsApp or Files by Google &rarr; Tap Share &rarr; Choose *Naatyavedam Library*.
  - Handled by Service Worker multipart POST interceptor (`sw-share-target.js`).
  - Audio files are stored into IndexedDB and presented in a review modal with automatically guessed Kuchipudi categories (*Jatiswaram, Shabdam, Varnam, Tarangam, Thillana*, etc.).
- **Outgoing Audio Sharing (Web Share API Level 2)**:
  - Tapping Share on the Player or Library song menu opens Android's native share sheet and attaches the **actual audio file binary** (`File` object) to share directly into WhatsApp or Gmail.
  - Automatic download fallback if file sharing is unsupported by the browser.

---

## 10. Deployment Guide

### Build Production Bundle
```bash
npm run build
```
Generates optimized assets in `dist/` with PWA service worker (`sw.js`, `sw-share-target.js`) and manifest (`manifest.webmanifest`).

### Deploy to Netlify / Vercel / Cloudflare Pages
1. Connect repository `https://github.com/SK-Sathyavada-008/Naatyavedam_library.git`.
2. **Build Command**: `npm run build`
3. **Publish Directory**: `dist`
4. Set Environment Variables in your hosting dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Ensure HTTPS is enabled (required for Service Workers and Web Share APIs).

---

## 11. Known Limitations & Platform Quirks

- **iOS Safari**: iOS WebKit does not support Web Share Target Level 2 for multipart POST audio. On iPhones, users should import tracks via the standard file picker or the Backup & Restore Hub.
- **Desktop Browsers**: Desktop Chrome/Firefox support Web Share Level 1 (text/URL) but do not support sharing binary audio file attachments via OS share sheets. The app automatically triggers a file download fallback.
- **IndexedDB Eviction**: If a mobile phone has critically low disk space (< 1 GB free), standard browser caches may be evicted. Tapping "Protect Storage" in Settings requests persistent storage permission (`navigator.storage.persist()`) to guarantee retention.

---

## 12. Verification & Test Summary

All 65 automated tests pass across 9 test suites:
```
✔ Auth: Validation & Role Permissions (8 tests)
✔ Phase 8: Backup ZIP Builder, Parser, Validation, Storage & Recovery (6 tests)
✔ Audio Importer & Metadata Guessing (3 tests)
✔ Audio Synthesizer (RIFF WAV Blob) (1 test)
✔ Offline Synchronization & Conflict Handling (6 tests)
✔ Production Readiness Checklist: Multi-Device, Faults & RBAC (16 tests)
✔ Programs Management & Collaborative Reordering (4 tests)
✔ Fuzzy Search (7 tests)
✔ Shared Cloud Library & Storage (7 tests)
✔ Phase 7: Android Share Target, Level 2 File Share & PWA (6 tests)
✔ Supabase Client Initialization (1 test)

Total: 65 passed, 0 failed, 0 skipped
```
