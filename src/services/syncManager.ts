import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Song,
  UserProfile,
  PendingOperation,
  DownloadBatchProgress,
  SyncState,
} from '../types';
import {
  db,
  getSongAudioBlob,
  saveSongWithBlob,
  getPendingOperations,
  deletePendingOperation,
  savePendingOperation,
  getPendingOperationsCount,
  updateDownloadProgress,
  getAppSetting,
  setAppSetting,
} from './db';
import {
  uploadSongToCloud,
  cloudRenameSong,
  cloudSoftDeleteSong,
  cloudRestoreSong,
} from './cloudLibrary';

const STORAGE_BUCKET = 'music-library';
const CHECKPOINT_SETTING_KEY = 'lastSyncCheckpoint';

type SyncListener = (state: SyncState) => void;
const listeners: Set<SyncListener> = new Set();

let currentSyncState: SyncState = {
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  error: null,
};

function updateSyncState(partial: Partial<SyncState>) {
  currentSyncState = { ...currentSyncState, ...partial };
  for (const listener of listeners) {
    try {
      listener(currentSyncState);
    } catch (e) {
      console.error('[SyncManager] Listener error:', e);
    }
  }
}

export function subscribeToSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentSyncState);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncState(): SyncState {
  return currentSyncState;
}

/**
 * Queue an operation locally when offline or before syncing.
 */
export async function queueOfflineOperation(
  type: PendingOperation['type'],
  songId: string,
  payload: Record<string, unknown>
): Promise<PendingOperation> {
  const op: PendingOperation = {
    id: `op_${type.toLowerCase()}_${songId}_${Date.now()}`,
    type,
    songId,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  await savePendingOperation(op);
  const count = await getPendingOperationsCount();
  updateSyncState({ pendingCount: count });
  return op;
}

/**
 * Process all pending uploads in IndexedDB.
 */
export async function drainUploadQueue(user: UserProfile): Promise<number> {
  const operations = await getPendingOperations();
  const uploadOps = operations.filter((op) => op.type === 'UPLOAD');
  let successfulUploads = 0;

  for (const op of uploadOps) {
    try {
      await savePendingOperation({
        ...op,
        status: 'processing',
        lastAttempt: new Date().toISOString(),
      });

      const song = await db.songs.get(op.songId);
      if (!song) {
        // Song no longer exists locally
        await deletePendingOperation(op.id);
        continue;
      }

      const audioBlob = await getSongAudioBlob(op.songId);
      if (!audioBlob) {
        await savePendingOperation({
          ...op,
          status: 'failed',
          error: 'Local audio file missing for upload',
        });
        continue;
      }

      const result = await uploadSongToCloud(song, audioBlob, user);
      if (result.success) {
        await deletePendingOperation(op.id);
        successfulUploads++;
      } else {
        await savePendingOperation({
          ...op,
          status: 'failed',
          retryCount: (op.retryCount || 0) + 1,
          error: result.error || 'Upload failed',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown upload error';
      await savePendingOperation({
        ...op,
        status: 'failed',
        retryCount: (op.retryCount || 0) + 1,
        error: msg,
      });
    }
  }

  const remaining = await getPendingOperationsCount();
  updateSyncState({ pendingCount: remaining });
  return successfulUploads;
}

/**
 * Process pending offline mutations (rename, soft-delete, restore, favorites).
 */
export async function drainMutationQueue(user: UserProfile): Promise<number> {
  const operations = await getPendingOperations();
  const mutationOps = operations.filter((op) => op.type !== 'UPLOAD');
  let successfulMutations = 0;

  for (const op of mutationOps) {
    try {
      let success = false;

      switch (op.type) {
        case 'RENAME': {
          const newTitle = String(op.payload.newTitle || '');
          if (newTitle) {
            success = await cloudRenameSong(op.songId, newTitle, user);
          } else {
            success = true; // Drop invalid rename
          }
          break;
        }

        case 'DELETE': {
          success = await cloudSoftDeleteSong(op.songId, user);
          break;
        }

        case 'RESTORE': {
          success = await cloudRestoreSong(op.songId, user);
          break;
        }

        case 'FAVORITE': {
          const shouldFavorite = Boolean(op.payload.isFavorite);
          if (shouldFavorite) {
            const { error } = await supabase
              .from('user_favorites')
              .upsert({ user_id: user.id, song_id: op.songId });
            success = !error;
          } else {
            const { error } = await supabase
              .from('user_favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('song_id', op.songId);
            success = !error;
          }
          break;
        }

        default:
          success = true;
      }

      if (success) {
        await deletePendingOperation(op.id);
        successfulMutations++;
      } else {
        await savePendingOperation({
          ...op,
          status: 'failed',
          retryCount: (op.retryCount || 0) + 1,
        });
      }
    } catch (err) {
      console.warn(`[SyncManager] Mutation ${op.type} failed:`, err);
    }
  }

  const remaining = await getPendingOperationsCount();
  updateSyncState({ pendingCount: remaining });
  return successfulMutations;
}

/**
 * Incremental synchronization:
 * Fetches only songs modified or added since lastSyncCheckpoint.
 * Server-authoritative timestamps resolve conflicts.
 * Never deletes or overwrites existing local audio files.
 */
export async function performIncrementalSync(user: UserProfile): Promise<number> {
  if (!isSupabaseConfigured() || user.status !== 'APPROVED') {
    return 0;
  }

  const lastCheckpoint = await getAppSetting<string | null>(CHECKPOINT_SETTING_KEY, null);

  let query = supabase
    .from('songs')
    .select('*, song_files(storage_path, bucket_id)')
    .order('updated_at', { ascending: true });

  if (lastCheckpoint) {
    query = query.gt('updated_at', lastCheckpoint);
  }

  const { data: modifiedSongs, error } = await query;
  if (error || !modifiedSongs) {
    throw new Error(error?.message || 'Failed to query incremental songs');
  }

  // Fetch user favorites to restore account favorites on new device
  const { data: userFavRows } = await supabase
    .from('user_favorites')
    .select('song_id')
    .eq('user_id', user.id);

  const favoriteSongIds = new Set((userFavRows || []).map((r) => r.song_id));

  let changesApplied = 0;
  let latestTimestamp = lastCheckpoint || '';

  for (const cs of modifiedSongs) {
    if (cs.updated_at > latestTimestamp) {
      latestTimestamp = cs.updated_at;
    }

    const localSong = await db.songs.get(cs.id);
    const hasAudioBlob = Boolean(await getSongAudioBlob(cs.id));

    const files = cs.song_files as { storage_path: string; bucket_id: string }[] | undefined;
    const primaryFile = Array.isArray(files) && files.length > 0 ? files[0] : null;

    const isFav = favoriteSongIds.has(cs.id) || Boolean(cs.is_favorite);

    if (localSong) {
      // Conflict Resolution:
      // Compare server updated_at vs local updatedAt
      // Server timestamp is authoritative, but NEVER delete local audio blob!
      const serverUpdated = new Date(cs.updated_at).getTime();
      const localUpdated = new Date(localSong.updatedAt).getTime();

      if (serverUpdated >= localUpdated || !localSong.updatedAt) {
        await db.songs.update(cs.id, {
          title: cs.title,
          originalFilename: cs.original_filename,
          category: cs.category || 'Other',
          ragam: cs.ragam || undefined,
          talam: cs.talam || undefined,
          composer: cs.composer || undefined,
          duration: cs.duration !== null ? Number(cs.duration) : null,
          isFavorite: isFav,
          isDeleted: Boolean(cs.is_deleted),
          deletedAt: cs.deleted_at || undefined,
          deletedBy: cs.deleted_by || undefined,
          storagePath: primaryFile?.storage_path || localSong.storagePath,
          bucketId: primaryFile?.bucket_id || localSong.bucketId || STORAGE_BUCKET,
          updatedAt: cs.updated_at,
          // PRESERVE local audio availability
          isLocalAvailable: hasAudioBlob,
          syncStatus: 'synced',
        });
        changesApplied++;
      }
    } else {
      // New remote song added by another student/teacher
      const newSong: Song = {
        id: cs.id,
        title: cs.title,
        originalFilename: cs.original_filename,
        fileType: cs.file_type,
        fileSize: Number(cs.file_size) || 0,
        duration: cs.duration !== null ? Number(cs.duration) : null,
        createdAt: cs.created_at,
        updatedAt: cs.updated_at,
        isFavorite: isFav,
        isLocalAvailable: hasAudioBlob, // false on fresh device
        syncStatus: 'synced',
        ragam: cs.ragam || undefined,
        talam: cs.talam || undefined,
        composer: cs.composer || undefined,
        category: cs.category || 'Other',
        isDeleted: Boolean(cs.is_deleted),
        deletedAt: cs.deleted_at || undefined,
        deletedBy: cs.deleted_by || undefined,
        storagePath: primaryFile?.storage_path,
        bucketId: primaryFile?.bucket_id || STORAGE_BUCKET,
        uploadedBy: cs.uploaded_by,
        uploadedByName: cs.uploaded_by_name,
      };

      await db.songs.put(newSong);
      changesApplied++;
    }
  }

  // Update sync checkpoint
  if (latestTimestamp) {
    await setAppSetting(CHECKPOINT_SETTING_KEY, latestTimestamp);
  }

  return changesApplied;
}

/**
 * Full Sync Orchestrator:
 * 1. Drain pending upload queue.
 * 2. Drain pending mutations (renames, soft-deletions, restores).
 * 3. Perform incremental sync with Supabase.
 */
export async function syncAll(user: UserProfile | null): Promise<{
  success: boolean;
  uploadedCount: number;
  mutationsCount: number;
  changesApplied: number;
  error?: string;
}> {
  if (!user || user.status !== 'APPROVED' || !isSupabaseConfigured() || !navigator.onLine) {
    const count = await getPendingOperationsCount();
    updateSyncState({ isSyncing: false, pendingCount: count });
    return {
      success: false,
      uploadedCount: 0,
      mutationsCount: 0,
      changesApplied: 0,
      error: 'Device is offline or user not approved',
    };
  }

  updateSyncState({ isSyncing: true, error: null });

  try {
    const uploadedCount = await drainUploadQueue(user);
    const mutationsCount = await drainMutationQueue(user);
    const changesApplied = await performIncrementalSync(user);

    const now = new Date().toISOString();
    const remaining = await getPendingOperationsCount();

    updateSyncState({
      isSyncing: false,
      pendingCount: remaining,
      lastSyncTime: now,
      error: null,
    });

    return {
      success: true,
      uploadedCount,
      mutationsCount,
      changesApplied,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Sync failed';
    const remaining = await getPendingOperationsCount();

    updateSyncState({
      isSyncing: false,
      pendingCount: remaining,
      error: errorMsg,
    });

    return {
      success: false,
      uploadedCount: 0,
      mutationsCount: 0,
      changesApplied: 0,
      error: errorMsg,
    };
  }
}

/**
 * Download a single track from Supabase Storage and cache in IndexedDB.
 */
export async function downloadTrack(
  song: Song,
  user: UserProfile | null,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    await updateDownloadProgress(song.id, 'downloading', 10);
    if (onProgress) onProgress(10);

    let storagePath = song.storagePath;
    if (!storagePath) {
      const { data: fileData, error: fileError } = await supabase
        .from('song_files')
        .select('storage_path')
        .eq('song_id', song.id)
        .maybeSingle();

      if (fileError || !fileData?.storage_path) {
        await updateDownloadProgress(song.id, 'failed', 0, 'Storage path not found');
        return { success: false, error: 'Storage path not found.' };
      }
      storagePath = fileData.storage_path;
    }

    if (!storagePath) {
      await updateDownloadProgress(song.id, 'failed', 0, 'Storage path missing');
      return { success: false, error: 'Storage path is missing.' };
    }

    if (onProgress) onProgress(40);

    // Download audio blob
    const { data: blob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      const msg = downloadError?.message || 'Failed to download binary audio';
      await updateDownloadProgress(song.id, 'failed', 0, msg);
      return { success: false, error: msg };
    }

    if (onProgress) onProgress(80);

    // Save into IndexedDB audioBlobs and mark song available
    const updated: Song = {
      ...song,
      isLocalAvailable: true,
      storagePath,
      syncStatus: 'synced',
    };
    await saveSongWithBlob(updated, blob);

    await updateDownloadProgress(song.id, 'downloaded', 100);
    if (onProgress) onProgress(100);

    // Log activity
    if (user) {
      await supabase.from('activity_logs').insert({
        account_id: user.id,
        username: user.username,
        action_type: 'DOWNLOAD',
        song_id: song.id,
        song_title: song.title,
        details: { performed_by_name: user.fullName },
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Download failed';
    await updateDownloadProgress(song.id, 'failed', 0, msg);
    return { success: false, error: msg };
  }
}

/**
 * Bulk download multiple selected tracks.
 */
export async function downloadTracksBatch(
  songsToDownload: Song[],
  user: UserProfile | null,
  onBatchProgress?: (progress: DownloadBatchProgress) => void
): Promise<{ successful: number; failed: number }> {
  const total = songsToDownload.length;
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const song = songsToDownload[i];
    if (onBatchProgress) {
      onBatchProgress({
        current: i + 1,
        total,
        currentSongTitle: song.title,
        percent: Math.round(((i) / total) * 100),
      });
    }

    const res = await downloadTrack(song, user);
    if (res.success) {
      successful++;
    } else {
      failed++;
    }

    if (onBatchProgress) {
      onBatchProgress({
        current: i + 1,
        total,
        currentSongTitle: song.title,
        percent: Math.round(((i + 1) / total) * 100),
      });
    }
  }

  return { successful, failed };
}

/**
 * Download entire repertoire for full offline capability.
 */
export async function downloadEntireRepertoire(
  allSongs: Song[],
  user: UserProfile | null,
  onBatchProgress?: (progress: DownloadBatchProgress) => void
): Promise<{ successful: number; failed: number }> {
  const undownloaded = allSongs.filter(
    (s) => !s.isDeleted && !s.isLocalAvailable && s.storagePath
  );
  return await downloadTracksBatch(undownloaded, user, onBatchProgress);
}
