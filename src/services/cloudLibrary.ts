import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Song, UserProfile, ActivityLogEntry, PendingOperation } from '../types';
import {
  db,
  getSongAudioBlob,
  saveSongWithBlob,
  getLocalSongs,
} from './db';

const STORAGE_BUCKET = 'music-library';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Sanitize filename for secure storage paths.
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Generate a unique, non-overwriting storage path for an audio file.
 * Format: audio/{songId}/{timestamp}_{cleanFilename}
 */
export function generateAudioStoragePath(songId: string, filename: string): string {
  const timestamp = Date.now();
  const cleanName = sanitizeFilename(filename);
  return `audio/${songId}/${timestamp}_${cleanName}`;
}

/**
 * Get or initialize persistent Device ID for device records.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('naatyavedam_device_id');
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('naatyavedam_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Record current device activity to Supabase.
 */
export async function recordDeviceActivity(user: UserProfile | null): Promise<void> {
  if (!user || !isSupabaseConfigured()) return;

  try {
    const deviceId = getDeviceId();
    const userAgent = navigator.userAgent || 'Unknown Device';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
    const deviceName = isMobile ? 'Mobile Device' : 'Desktop / Laptop';

    await supabase.rpc('record_device', {
      p_device_id: deviceId,
      p_device_name: deviceName,
      p_user_agent: userAgent,
    });
  } catch (err) {
    // Non-blocking device logging
    console.warn('[CloudLibrary] Could not record device activity:', err);
  }
}

/**
 * Upload a song and its audio blob to Supabase Storage and PostgreSQL.
 * Follows the 6-step lifecycle:
 * 1. Saved locally first (handled by caller).
 * 2. Create pending upload record.
 * 3. Upload audio to Supabase Storage.
 * 4. Save metadata in PostgreSQL.
 * 5. Mark local record as synchronized.
 * 6. Add activity log entry.
 *
 * If upload fails, preserves local copy and pending upload for retry.
 */
export async function uploadSongToCloud(
  song: Song,
  audioBlob: Blob,
  user: UserProfile
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const pendingOpId = `upload_${song.id}`;

  // 1 & 2. Create pending upload record in IndexedDB
  const pendingOp: PendingOperation = {
    id: pendingOpId,
    type: 'UPLOAD',
    songId: song.id,
    payload: {
      songId: song.id,
      title: song.title,
      filename: song.originalFilename,
    },
    createdAt: new Date().toISOString(),
    status: 'processing',
    retryCount: 0,
  };
  await db.pendingOperations.put(pendingOp);

  // Validate configuration & user status
  if (!isSupabaseConfigured()) {
    const msg = 'Supabase credentials are not configured.';
    await db.pendingOperations.update(pendingOpId, { status: 'failed' });
    return { success: false, error: msg };
  }

  if (user.status !== 'APPROVED') {
    const msg = 'User account is not approved to upload songs.';
    await db.pendingOperations.update(pendingOpId, { status: 'failed' });
    return { success: false, error: msg };
  }

  if (audioBlob.size > MAX_FILE_SIZE) {
    const msg = `Audio file exceeds maximum size of 100MB (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB).`;
    await db.pendingOperations.update(pendingOpId, { status: 'failed' });
    return { success: false, error: msg };
  }

  const storagePath = generateAudioStoragePath(song.id, song.originalFilename);

  try {
    // 3. Upload binary audio to Supabase Storage (private bucket, authenticated RLS)
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBlob, {
        contentType: song.fileType || 'audio/mpeg',
        upsert: false, // Prevent accidental overwrite
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // 4. Save song metadata in PostgreSQL `songs` table
    const { error: songError } = await supabase.from('songs').upsert(
      {
        id: song.id,
        title: song.title,
        original_filename: song.originalFilename,
        file_type: song.fileType,
        file_size: song.fileSize,
        duration: song.duration,
        ragam: song.ragam || null,
        talam: song.talam || null,
        composer: song.composer || null,
        category: song.category || 'Other',
        notes: null,
        is_favorite: song.isFavorite || false,
        is_deleted: false,
        uploaded_by: user.id,
        uploaded_by_name: user.fullName || user.username,
        created_at: song.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (songError) {
      throw new Error(`Song metadata save failed: ${songError.message}`);
    }

    // Save song file metadata in `song_files` table
    const { error: fileError } = await supabase.from('song_files').upsert(
      {
        song_id: song.id,
        bucket_id: STORAGE_BUCKET,
        storage_path: storagePath,
        file_name: song.originalFilename,
        mime_type: song.fileType,
        size_bytes: song.fileSize,
        duration_seconds: song.duration,
        uploaded_by: user.id,
        created_at: song.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'storage_path' }
    );

    if (fileError) {
      console.warn('[CloudLibrary] Note: song_files insert warning:', fileError.message);
    }

    // 5. Mark local record as synchronized
    await db.songs.update(song.id, {
      syncStatus: 'synced',
      isLocalAvailable: true,
      storagePath,
      bucketId: STORAGE_BUCKET,
      uploadedBy: user.id,
      uploadedByName: user.fullName,
    });

    // Remove pending operation on success
    await db.pendingOperations.delete(pendingOpId);

    // 6. Add activity log entry to Supabase
    await supabase.from('activity_logs').insert({
      account_id: user.id,
      username: user.username,
      action_type: 'UPLOAD',
      song_id: song.id,
      song_title: song.title,
      details: {
        performed_by_name: user.fullName,
        filename: song.originalFilename,
        category: song.category,
      },
      timestamp: new Date().toISOString(),
    });

    return { success: true, storagePath };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown upload error';
    console.error('[CloudLibrary] Upload error:', errorMsg);

    // Keep local copy & update pending record with error for retry
    await db.pendingOperations.update(pendingOpId, {
      status: 'failed',
      retryCount: (pendingOp.retryCount || 0) + 1,
      payload: { ...pendingOp.payload, error: errorMsg },
    });

    await db.songs.update(song.id, {
      syncStatus: 'pending_upload',
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Retry an existing pending upload idempotently.
 */
export async function retryPendingUpload(
  pendingOpId: string,
  user: UserProfile
): Promise<{ success: boolean; error?: string }> {
  const pendingOp = await db.pendingOperations.get(pendingOpId);
  if (!pendingOp) {
    return { success: false, error: 'Pending operation not found.' };
  }

  const song = await db.songs.get(pendingOp.songId);
  if (!song) {
    await db.pendingOperations.delete(pendingOpId);
    return { success: false, error: 'Local song not found.' };
  }

  const blob = await getSongAudioBlob(song.id);
  if (!blob) {
    await db.pendingOperations.update(pendingOpId, {
      status: 'failed',
      payload: { ...pendingOp.payload, error: 'Local audio file missing for retry.' },
    });
    return { success: false, error: 'Local audio file is missing.' };
  }

  return await uploadSongToCloud(song, blob, user);
}

/**
 * Fetch all active songs from Supabase shared library, merging with local offline availability.
 */
export async function fetchSharedCloudLibrary(
  _currentUser: UserProfile | null
): Promise<Song[]> {
  if (!isSupabaseConfigured()) {
    return await getLocalSongs('recent');
  }

  try {
    const { data: cloudSongs, error } = await supabase
      .from('songs')
      .select('*, song_files(storage_path, bucket_id)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[CloudLibrary] Could not fetch cloud songs:', error.message);
      return await getLocalSongs('recent');
    }

    if (!cloudSongs) return await getLocalSongs('recent');

    // Merge each cloud song with local IndexedDB state
    const mergedSongs: Song[] = [];

    for (const cs of cloudSongs) {
      const localBlob = await getSongAudioBlob(cs.id);
      const isLocalAvailable = Boolean(localBlob);

      const files = cs.song_files as { storage_path: string; bucket_id: string }[] | undefined;
      const primaryFile = Array.isArray(files) && files.length > 0 ? files[0] : null;

      const song: Song = {
        id: cs.id,
        title: cs.title,
        originalFilename: cs.original_filename,
        fileType: cs.file_type,
        fileSize: Number(cs.file_size) || 0,
        duration: cs.duration !== null ? Number(cs.duration) : null,
        createdAt: cs.created_at,
        updatedAt: cs.updated_at,
        isFavorite: Boolean(cs.is_favorite),
        isLocalAvailable,
        syncStatus: 'synced',
        ragam: cs.ragam || undefined,
        talam: cs.talam || undefined,
        composer: cs.composer || undefined,
        category: cs.category || 'Other',
        isDeleted: false,
        storagePath: primaryFile?.storage_path,
        bucketId: primaryFile?.bucket_id || STORAGE_BUCKET,
        uploadedBy: cs.uploaded_by,
        uploadedByName: cs.uploaded_by_name,
      };

      // Upsert into local IndexedDB for instant offline search & fast cache
      await db.songs.put(song);
      mergedSongs.push(song);
    }

    return mergedSongs;
  } catch (err) {
    console.error('[CloudLibrary] Error in fetchSharedCloudLibrary:', err);
    return await getLocalSongs('recent');
  }
}

/**
 * Fetch deleted songs in Recovery Bin from Supabase.
 */
export async function fetchCloudRecoveryBin(): Promise<Song[]> {
  if (!isSupabaseConfigured()) {
    return await db.songs.filter((s) => s.isDeleted).toArray();
  }

  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((cs) => ({
      id: cs.id,
      title: cs.title,
      originalFilename: cs.original_filename,
      fileType: cs.file_type,
      fileSize: Number(cs.file_size) || 0,
      duration: cs.duration !== null ? Number(cs.duration) : null,
      createdAt: cs.created_at,
      updatedAt: cs.updated_at,
      isFavorite: Boolean(cs.is_favorite),
      isLocalAvailable: false,
      syncStatus: 'synced',
      ragam: cs.ragam || undefined,
      talam: cs.talam || undefined,
      composer: cs.composer || undefined,
      category: cs.category || 'Other',
      isDeleted: true,
      deletedAt: cs.deleted_at,
      deletedBy: cs.deleted_by,
      uploadedBy: cs.uploaded_by,
      uploadedByName: cs.uploaded_by_name,
    }));
  } catch (err) {
    console.error('[CloudLibrary] Error fetching recovery bin:', err);
    return await db.songs.filter((s) => s.isDeleted).toArray();
  }
}

/**
 * Rename song across cloud and local storage.
 * All approved members have full permission to rename any repertoire track.
 */
export async function cloudRenameSong(
  songId: string,
  newTitle: string,
  user: UserProfile
): Promise<boolean> {
  const cleanTitle = newTitle.trim();
  if (!cleanTitle) return false;

  // 1. Update local IndexedDB
  const localSong = await db.songs.get(songId);
  const oldTitle = localSong?.title || '';
  if (localSong) {
    await db.songs.update(songId, {
      title: cleanTitle,
      updatedAt: new Date().toISOString(),
    });
  }

  if (!isSupabaseConfigured() || user.status !== 'APPROVED') {
    return true;
  }

  try {
    // 2. Call atomic rename RPC in Supabase
    const { error: rpcError } = await supabase.rpc('rename_song', {
      p_song_id: songId,
      p_new_title: cleanTitle,
    });

    if (rpcError) {
      // Fallback to direct update if RPC fails
      await supabase
        .from('songs')
        .update({ title: cleanTitle, updated_at: new Date().toISOString() })
        .eq('id', songId);

      await supabase.from('activity_logs').insert({
        account_id: user.id,
        username: user.username,
        action_type: 'RENAME',
        song_id: songId,
        song_title: cleanTitle,
        previous_value: oldTitle,
        new_value: cleanTitle,
        details: { performed_by_name: user.fullName },
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  } catch (err) {
    console.error('[CloudLibrary] Rename error:', err);
    return false;
  }
}

/**
 * Soft delete a song into the shared Recovery Bin.
 * Records who deleted it and timestamp. Does NOT delete cloud audio file.
 */
export async function cloudSoftDeleteSong(
  songId: string,
  user: UserProfile
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update local IndexedDB
  const localSong = await db.songs.get(songId);
  if (localSong) {
    await db.songs.update(songId, {
      isDeleted: true,
      deletedAt: now,
      deletedBy: user.id,
      updatedAt: now,
    });
  }

  if (!isSupabaseConfigured() || user.status !== 'APPROVED') {
    return true;
  }

  try {
    // 2. Call atomic soft delete RPC in Supabase
    const { error: rpcError } = await supabase.rpc('soft_delete_song', {
      p_song_id: songId,
    });

    if (rpcError) {
      // Fallback direct update
      await supabase
        .from('songs')
        .update({
          is_deleted: true,
          deleted_at: now,
          deleted_by: user.id,
          updated_at: now,
        })
        .eq('id', songId);

      await supabase.from('activity_logs').insert({
        account_id: user.id,
        username: user.username,
        action_type: 'DELETE',
        song_id: songId,
        song_title: localSong?.title || 'Unknown Song',
        previous_value: 'active',
        new_value: 'deleted',
        details: { performed_by_name: user.fullName },
        timestamp: now,
      });
    }

    return true;
  } catch (err) {
    console.error('[CloudLibrary] Delete error:', err);
    return false;
  }
}

/**
 * Restore a song from the shared Recovery Bin.
 * Records who restored it and timestamp.
 */
export async function cloudRestoreSong(
  songId: string,
  user: UserProfile
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update local IndexedDB
  const localSong = await db.songs.get(songId);
  if (localSong) {
    await db.songs.update(songId, {
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      restoredAt: now,
      restoredBy: user.id,
      updatedAt: now,
    });
  }

  if (!isSupabaseConfigured() || user.status !== 'APPROVED') {
    return true;
  }

  try {
    // 2. Call atomic restore RPC in Supabase
    const { error: rpcError } = await supabase.rpc('restore_song', {
      p_song_id: songId,
    });

    if (rpcError) {
      // Fallback direct update
      await supabase
        .from('songs')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          restored_at: now,
          restored_by: user.id,
          updated_at: now,
        })
        .eq('id', songId);

      await supabase.from('activity_logs').insert({
        account_id: user.id,
        username: user.username,
        action_type: 'RESTORE',
        song_id: songId,
        song_title: localSong?.title || 'Unknown Song',
        previous_value: 'deleted',
        new_value: 'active',
        details: { performed_by_name: user.fullName },
        timestamp: now,
      });
    }

    return true;
  } catch (err) {
    console.error('[CloudLibrary] Restore error:', err);
    return false;
  }
}

/**
 * Generate a short-lived signed URL for secure playback without making bucket public.
 */
export async function getSignedAudioPlaybackUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1-hour signed URL

    if (error || !data) {
      console.warn('[CloudLibrary] Signed URL error:', error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('[CloudLibrary] Error generating signed URL:', err);
    return null;
  }
}

/**
 * Download a song from Supabase Storage and cache it in IndexedDB for 100% offline playback.
 */
export async function downloadSongForOffline(
  song: Song,
  user: UserProfile | null
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    let storagePath = song.storagePath;

    // If storagePath is not directly on song, fetch from `song_files`
    if (!storagePath) {
      const { data: fileData, error: fileError } = await supabase
        .from('song_files')
        .select('storage_path')
        .eq('song_id', song.id)
        .maybeSingle();

      if (fileError || !fileData?.storage_path) {
        return { success: false, error: 'Cloud storage path not found for song.' };
      }
      storagePath = fileData.storage_path;
    }

    if (!storagePath) {
      return { success: false, error: 'Cloud storage path is missing.' };
    }

    // Download raw audio blob from Supabase Storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      return { success: false, error: downloadError?.message || 'Failed to download audio.' };
    }

    // Save to local IndexedDB
    const updatedSong: Song = {
      ...song,
      isLocalAvailable: true,
      storagePath,
    };
    await saveSongWithBlob(updatedSong, blob);

    // Log download activity
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
    const msg = err instanceof Error ? err.message : 'Unknown download error';
    return { success: false, error: msg };
  }
}

/**
 * Fetch cloud activity history logs.
 */
export async function fetchSharedActivityLogs(): Promise<ActivityLogEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error || !data) {
      console.warn('[CloudLibrary] Could not fetch activity logs:', error?.message);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      action: row.action_type as ActivityLogEntry['action'],
      songId: row.song_id || '',
      songTitle: row.song_title || 'Repertoire Song',
      performedBy: row.account_id || 'system',
      performedByName: row.details?.performed_by_name || row.username || 'Member',
      timestamp: row.timestamp,
      details:
        row.action_type === 'RENAME'
          ? `Renamed from "${row.previous_value}" to "${row.new_value}"`
          : row.action_type === 'UPLOAD'
            ? `Uploaded ${row.details?.category || 'repertoire'} audio`
            : row.action_type === 'DELETE'
              ? 'Moved track to Recovery Bin'
              : row.action_type === 'RESTORE'
                ? 'Restored track from Recovery Bin'
                : row.action_type === 'DOWNLOAD'
                  ? 'Downloaded for offline practice'
                  : `Action: ${row.action_type}`,
    }));
  } catch (err) {
    console.error('[CloudLibrary] Error in fetchSharedActivityLogs:', err);
    return [];
  }
}
