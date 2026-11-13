import Dexie, { type Table } from 'dexie';
import type {
  Song,
  AudioBlobRecord,
  FavoriteRecord,
  DownloadInfoRecord,
  PendingOperation,
  AppSettingRecord,
  SortOption,
} from '../types/index.ts';

export class NaatyavedamDB extends Dexie {
  songs!: Table<Song, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;
  favorites!: Table<FavoriteRecord, string>;
  downloadInfo!: Table<DownloadInfoRecord, string>;
  pendingOperations!: Table<PendingOperation, string>;
  appSettings!: Table<AppSettingRecord, string>;

  constructor() {
    super('NaatyavedamLibraryDB');

    // Schema definition
    // Note: primary key is first, followed by indexed fields
    this.version(1).stores({
      songs: 'id, title, originalFilename, createdAt, updatedAt, isFavorite, isLocalAvailable, syncStatus, isDeleted',
      audioBlobs: 'id, songId, createdAt',
      favorites: 'id, songId, createdAt',
      downloadInfo: 'id, songId, isDownloaded',
      pendingOperations: 'id, songId, type, status, createdAt',
      appSettings: 'key, updatedAt',
    });
  }
}

export const db = new NaatyavedamDB();

/**
 * Service functions for Local Music Library
 */

/**
 * Store a newly imported song and its raw binary audio blob into IndexedDB.
 * Uses a single transaction to guarantee atomic consistency.
 */
export async function saveSongWithBlob(
  song: Song,
  audioBlob: Blob
): Promise<Song> {
  return await db.transaction('rw', [db.songs, db.audioBlobs, db.downloadInfo], async () => {
    // 1. Save song metadata
    await db.songs.put(song);

    // 2. Save raw audio blob (never Base64)
    const blobRecord: AudioBlobRecord = {
      id: song.id,
      songId: song.id,
      blob: audioBlob,
      mimeType: song.fileType,
      fileSize: song.fileSize,
      createdAt: song.createdAt,
    };
    await db.audioBlobs.put(blobRecord);

    // 3. Mark download info as locally available
    const downloadRecord: DownloadInfoRecord = {
      id: song.id,
      songId: song.id,
      isDownloaded: true,
      downloadedAt: song.createdAt,
      fileSize: song.fileSize,
    };
    await db.downloadInfo.put(downloadRecord);

    return song;
  });
}

/**
 * Fetch all active (non-deleted) songs from IndexedDB with optional sorting.
 */
export async function getLocalSongs(sort: SortOption = 'recent'): Promise<Song[]> {
  const allSongs = await db.songs.filter((s) => !s.isDeleted).toArray();

  switch (sort) {
    case 'title-asc':
      return allSongs.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc':
      return allSongs.sort((a, b) => b.title.localeCompare(a.title));
    case 'duration-desc':
      return allSongs.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    case 'duration-asc':
      return allSongs.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    case 'recent':
    default:
      return allSongs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

/**
 * Fetch raw audio blob for a song by songId.
 */
export async function getSongAudioBlob(songId: string): Promise<Blob | null> {
  const record = await db.audioBlobs.get(songId);
  return record ? record.blob : null;
}

/**
 * Toggle favorite status of a song in IndexedDB.
 */
export async function toggleSongFavorite(songId: string): Promise<boolean> {
  return await db.transaction('rw', [db.songs, db.favorites], async () => {
    const song = await db.songs.get(songId);
    if (!song) throw new Error(`Song ${songId} not found`);

    const newFavStatus = !song.isFavorite;
    const now = new Date().toISOString();

    await db.songs.update(songId, {
      isFavorite: newFavStatus,
      updatedAt: now,
    });

    if (newFavStatus) {
      await db.favorites.put({
        id: songId,
        songId,
        createdAt: now,
      });
    } else {
      await db.favorites.delete(songId);
    }

    return newFavStatus;
  });
}

/**
 * Rename a song's display title in IndexedDB.
 * Strictly preserves the original phone filename.
 */
export async function renameSong(songId: string, newTitle: string): Promise<void> {
  const cleanTitle = newTitle.trim();
  if (!cleanTitle) throw new Error('Song title cannot be empty');

  const now = new Date().toISOString();
  await db.songs.update(songId, {
    title: cleanTitle,
    updatedAt: now,
  });
}

/**
 * Move a song to the local recovery bin (soft delete), or permanently delete.
 */
export async function deleteLocalSong(songId: string, softDelete = true): Promise<void> {
  if (softDelete) {
    const now = new Date().toISOString();
    await db.songs.update(songId, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });
  } else {
    // Permanent deletion from all tables
    await db.transaction(
      'rw',
      [db.songs, db.audioBlobs, db.favorites, db.downloadInfo],
      async () => {
        await db.songs.delete(songId);
        await db.audioBlobs.delete(songId);
        await db.favorites.delete(songId);
        await db.downloadInfo.delete(songId);
      }
    );
  }
}

/**
 * Restore a song from the recovery bin.
 */
export async function restoreLocalSong(songId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.songs.update(songId, {
    isDeleted: false,
    deletedAt: undefined,
    updatedAt: now,
  });
}

/**
 * Get all deleted songs currently in the recovery bin.
 */
export async function getRecoveryBinSongs(): Promise<Song[]> {
  return await db.songs.filter((s) => Boolean(s.isDeleted)).toArray();
}

/**
 * App Settings Key-Value helpers
 */
export async function getAppSetting<T>(key: string, defaultValue: T): Promise<T> {
  const record = await db.appSettings.get(key);
  return record ? (record.value as T) : defaultValue;
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  await db.appSettings.put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Estimate storage usage.
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  songCount: number;
}> {
  let usage = 0;
  let quota = 0;

  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage || 0;
      quota = estimate.quota || 0;
    } catch {
      // Ignore if estimate fails
    }
  }

  const songCount = await db.songs.filter((s) => !s.isDeleted).count();
  return { usage, quota, songCount };
}
