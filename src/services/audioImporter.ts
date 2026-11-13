import type { Song, DanceCategory } from '../types/index.ts';
import { saveSongWithBlob } from './db.ts';

const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.opus', '.flac'];
const SUPPORTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
];

/**
 * Validate whether a selected File is a supported audio format.
 */
export function isSupportedAudioFile(file: File): { supported: boolean; reason?: string } {
  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidMime =
    !file.type || // some mobile file pickers don't populate MIME type
    SUPPORTED_MIME_TYPES.some((mime) => file.type.toLowerCase().includes(mime)) ||
    file.type.startsWith('audio/');

  if (!hasValidExt && !hasValidMime) {
    return {
      supported: false,
      reason: `Unsupported format (${file.name}). Please use MP3, M4A, WAV, AAC, or OGG.`,
    };
  }

  if (file.size === 0) {
    return {
      supported: false,
      reason: `File "${file.name}" is empty (0 bytes).`,
    };
  }

  return { supported: true };
}

/**
 * Extract audio duration (in seconds) in the browser safely.
 * Creates an object URL, loads metadata, and properly revokes the URL immediately.
 */
export async function extractAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    let timer: number | null = null;
    const audio = new Audio();

    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.src = '';
    };

    try {
      objectUrl = URL.createObjectURL(file);
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const dur = audio.duration;
        cleanup();
        if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
          resolve(Math.round(dur));
        } else {
          resolve(null);
        }
      };

      audio.onerror = () => {
        cleanup();
        resolve(null);
      };

      // 4-second timeout guard: do not hang if metadata cannot be parsed
      timer = window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, 4000);

      audio.src = objectUrl;
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Derive a clean display title from the original filename.
 */
export function deriveDisplayTitle(fileName: string): string {
  // Strip extension
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  // Replace underscores and dashes with spaces
  const cleanSpaces = withoutExt.replace(/[-_]+/g, ' ').trim();
  // Capitalize words
  if (!cleanSpaces) return fileName;
  return cleanSpaces
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Guess dance category from title or filename (Kuchipudi heuristics)
 */
export function guessDanceCategory(title: string): DanceCategory {
  const lower = title.toLowerCase();
  if (lower.includes('jatiswaram') || lower.includes('jati')) return 'Jatiswaram';
  if (lower.includes('shabdam') || lower.includes('sabdam')) return 'Shabdam';
  if (lower.includes('varnam')) return 'Varnam';
  if (lower.includes('tarangam') || lower.includes('tharangam')) return 'Tarangam';
  if (lower.includes('thillana') || lower.includes('tillana')) return 'Thillana';
  if (lower.includes('pushpanjali') || lower.includes('anjali')) return 'Pushpanjali';
  if (lower.includes('keerthanam') || lower.includes('kirtan')) return 'Keerthanam';
  if (lower.includes('slokam') || lower.includes('shlokam')) return 'Slokam';
  if (lower.includes('talam') || lower.includes('practice') || lower.includes('korvai'))
    return 'Practice / Talam';
  return 'Other';
}

export interface ImportResult {
  importedSongs: Song[];
  failures: { fileName: string; reason: string }[];
}

/**
 * Import single or multiple files into IndexedDB.
 * Guarantees original phone files remain 100% untouched.
 */
export async function importAudioFiles(
  files: FileList | File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<ImportResult> {
  const fileArray = Array.from(files);
  const total = fileArray.length;
  const importedSongs: Song[] = [];
  const failures: { fileName: string; reason: string }[] = [];

  for (let i = 0; i < total; i++) {
    const file = fileArray[i];

    if (onProgress) {
      onProgress(i + 1, total, file.name);
    }

    // 1. Validation
    const validation = isSupportedAudioFile(file);
    if (!validation.supported) {
      failures.push({
        fileName: file.name,
        reason: validation.reason || 'Unsupported format',
      });
      continue;
    }

    try {
      // 2. Extract duration if possible
      const duration = await extractAudioDuration(file);

      // 3. Construct Song metadata
      const songId = `song_${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      const displayTitle = deriveDisplayTitle(file.name);
      const category = guessDanceCategory(displayTitle);

      const song: Song = {
        id: songId,
        title: displayTitle,
        originalFilename: file.name,
        fileType: file.type || 'audio/mpeg',
        fileSize: file.size,
        duration: duration,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isLocalAvailable: true,
        syncStatus: 'local_only',
        category,
        isDeleted: false,
      };

      // 4. Save into IndexedDB
      await saveSongWithBlob(song, file);
      importedSongs.push(song);
    } catch (err: unknown) {
      failures.push({
        fileName: file.name,
        reason: err instanceof Error ? err.message : 'Database error while saving audio',
      });
    }
  }

  return { importedSongs, failures };
}
