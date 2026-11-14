import type { Song } from '../types';
import { getSongAudioBlob } from './db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Trigger browser file download as fallback when native Web Share API with files is unavailable.
 */
export function downloadAudioBlobFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Feature detection: Check whether the current browser supports sharing audio files via native share sheet.
 */
export function canShareAudioFile(file: File): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Share song audio using native Android Share Sheet (Web Share API Level 2).
 * Shares the ACTUAL audio File attachment (not just a link).
 * If file sharing is not supported by the environment, falls back to direct audio download.
 */
export async function shareSongAudio(
  song: Song,
  providedBlob?: Blob | null
): Promise<{ success: boolean; fallbackDownloaded?: boolean; error?: string }> {
  try {
    // 1. Get binary audio blob (from IndexedDB or cloud)
    let audioBlob = providedBlob;
    if (!audioBlob) {
      audioBlob = await getSongAudioBlob(song.id);
    }

    // Fallback: If not cached locally, attempt to download from Supabase Storage
    if (!audioBlob && song.storagePath && isSupabaseConfigured()) {
      const { data, error } = await supabase.storage
        .from('music-library')
        .download(song.storagePath);
      if (!error && data) {
        audioBlob = data;
      }
    }

    if (!audioBlob) {
      return {
        success: false,
        error: `Audio file for "${song.title}" is not available locally. Please download it first before sharing.`,
      };
    }

    // 2. Prepare native File object
    const cleanFilename =
      song.originalFilename ||
      `${song.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${song.fileType.includes('wav') ? 'wav' : 'mp3'}`;

    const audioFile = new File([audioBlob], cleanFilename, {
      type: song.fileType || audioBlob.type || 'audio/mpeg',
    });

    // 3. Feature detection for native file sharing
    if (canShareAudioFile(audioFile)) {
      try {
        await navigator.share({
          files: [audioFile],
          title: song.title,
          text: `Kuchipudi Dance: ${song.title} (${song.category || 'Repertoire'})`,
        });
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User dismissed the share sheet - not an error
          return { success: false, error: 'Share was dismissed.' };
        }
        // If native sharing failed unexpectedly, fall through to download fallback
        console.warn('[AudioShare] Native file share threw error, using fallback:', err);
      }
    }

    // 4. Download Fallback: Trigger browser file download
    downloadAudioBlobFallback(audioBlob, cleanFilename);
    return {
      success: true,
      fallbackDownloaded: true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown share error';
    return { success: false, error: msg };
  }
}
