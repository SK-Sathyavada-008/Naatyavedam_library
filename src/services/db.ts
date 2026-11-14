import Dexie, { type Table } from 'dexie';
import type {
  Song,
  AudioBlobRecord,
  FavoriteRecord,
  DownloadInfoRecord,
  PendingOperation,
  AppSettingRecord,
  SortOption,
  Program,
  ProgramItem,
  ProgramAudio,
} from '../types/index.ts';

export class NaatyavedamDB extends Dexie {
  songs!: Table<Song, string>;
  audioBlobs!: Table<AudioBlobRecord, string>;
  favorites!: Table<FavoriteRecord, string>;
  downloadInfo!: Table<DownloadInfoRecord, string>;
  pendingOperations!: Table<PendingOperation, string>;
  appSettings!: Table<AppSettingRecord, string>;
  programs!: Table<Program, string>;
  programItems!: Table<ProgramItem, string>;
  programAudio!: Table<ProgramAudio, string>;

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

    this.version(2).stores({
      programs: 'id, title, eventDate, createdBy, createdAt, updatedAt, isDeleted',
      programItems: 'id, programId, sourceType, songId, programAudioId, position, createdAt',
      programAudio: 'id, programId, displayTitle, originalFilename, uploadedBy, createdAt',
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
 * Bulk delete songs (moves to recovery bin).
 */
export async function bulkDeleteSongs(songIds: string[], softDelete = true): Promise<void> {
  const now = new Date().toISOString();
  if (softDelete) {
    await db.transaction('rw', [db.songs], async () => {
      for (const id of songIds) {
        await db.songs.update(id, {
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
        });
      }
    });
  } else {
    await db.transaction(
      'rw',
      [db.songs, db.audioBlobs, db.favorites, db.downloadInfo],
      async () => {
        for (const id of songIds) {
          await db.songs.delete(id);
          await db.audioBlobs.delete(id);
          await db.favorites.delete(id);
          await db.downloadInfo.delete(id);
        }
      }
    );
  }
}

/**
 * Bulk toggle or set favorite status for multiple songs.
 */
export async function bulkFavoriteSongs(songIds: string[], shouldFavorite: boolean): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', [db.songs, db.favorites], async () => {
    for (const id of songIds) {
      await db.songs.update(id, {
        isFavorite: shouldFavorite,
        updatedAt: now,
      });
      if (shouldFavorite) {
        await db.favorites.put({ id, songId: id, createdAt: now });
      } else {
        await db.favorites.delete(id);
      }
    }
  });
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

/**
 * ==============================================================================
 * Program Management Database Services (IndexedDB)
 * ==============================================================================
 */

/**
 * Fetch all active programs from IndexedDB.
 */
export async function getLocalPrograms(): Promise<Program[]> {
  const all = await db.programs.filter((p) => !p.isDeleted).toArray();
  return all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Save or update a program in IndexedDB.
 */
export async function saveLocalProgram(program: Program): Promise<Program> {
  const updated = {
    ...program,
    updatedAt: new Date().toISOString(),
  };
  await db.programs.put(updated);
  return updated;
}

/**
 * Soft delete a program in IndexedDB.
 */
export async function deleteLocalProgram(programId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.programs.update(programId, {
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });
}

/**
 * Fetch ordered items for a program.
 */
export async function getLocalProgramItems(programId: string): Promise<ProgramItem[]> {
  const items = await db.programItems
    .where('programId')
    .equals(programId)
    .toArray();
  return items.sort((a, b) => a.position - b.position);
}

/**
 * Add or update an item in a program.
 */
export async function saveLocalProgramItem(item: ProgramItem): Promise<ProgramItem> {
  await db.programItems.put(item);
  await db.programs.update(item.programId, {
    updatedAt: new Date().toISOString(),
  });
  return item;
}

/**
 * Remove an item from a program without touching underlying library audio.
 */
export async function deleteLocalProgramItem(itemId: string, programId: string): Promise<void> {
  await db.programItems.delete(itemId);
  // Re-index remaining positions
  const remaining = await getLocalProgramItems(programId);
  await db.transaction('rw', db.programItems, async () => {
    for (let i = 0; i < remaining.length; i++) {
      await db.programItems.update(remaining[i].id, { position: i });
    }
  });
  await db.programs.update(programId, {
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atomically reorder items in a program.
 */
export async function reorderLocalProgramItems(
  programId: string,
  orderedItemIds: string[]
): Promise<void> {
  await db.transaction('rw', [db.programItems, db.programs], async () => {
    for (let i = 0; i < orderedItemIds.length; i++) {
      await db.programItems.update(orderedItemIds[i], {
        position: i,
        updatedAt: new Date().toISOString(),
      });
    }
    await db.programs.update(programId, {
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Duplicate a program and all its ordered items.
 * Reuses references to original library songs without duplicating audio.
 */
export async function duplicateLocalProgram(
  programId: string,
  newTitle?: string,
  createdByName = 'Member'
): Promise<Program> {
  const source = await db.programs.get(programId);
  if (!source) throw new Error('Source program not found');

  const newProgramId = `prog-${Date.now()}`;
  const now = new Date().toISOString();

  const clonedProgram: Program = {
    ...source,
    id: newProgramId,
    title: newTitle || `${source.title} (Copy)`,
    createdByName,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const sourceItems = await getLocalProgramItems(programId);

  await db.transaction('rw', [db.programs, db.programItems], async () => {
    await db.programs.put(clonedProgram);
    for (const item of sourceItems) {
      const clonedItem: ProgramItem = {
        ...item,
        id: `pitem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        programId: newProgramId,
        createdAt: now,
        updatedAt: now,
      };
      await db.programItems.put(clonedItem);
    }
  });

  return clonedProgram;
}

/**
 * Save program-specific edited audio and its blob into IndexedDB.
 */
export async function saveProgramAudioBlob(
  programAudio: ProgramAudio,
  blob: Blob
): Promise<void> {
  await db.transaction('rw', [db.programAudio, db.audioBlobs], async () => {
    await db.programAudio.put(programAudio);
    const blobRecord: AudioBlobRecord = {
      id: programAudio.id,
      songId: programAudio.id,
      blob,
      mimeType: programAudio.fileFormat,
      fileSize: programAudio.fileSize,
      createdAt: programAudio.createdAt,
    };
    await db.audioBlobs.put(blobRecord);
  });
}

