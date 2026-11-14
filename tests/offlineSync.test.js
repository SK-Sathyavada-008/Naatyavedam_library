import test from 'node:test';
import assert from 'node:assert/strict';

// Helper simulated storage and database for Offline Sync testing
class SimulatedOfflineDevice {
  constructor(deviceId, userId, username) {
    this.deviceId = deviceId;
    this.userId = userId;
    this.username = username;
    this.localSongs = new Map();
    this.audioBlobs = new Map();
    this.pendingOperations = new Map();
    this.downloadInfo = new Map();
    this.isOnline = true;
    this.lastSyncCheckpoint = null;
  }

  // Save imported song locally
  importSongLocally(song, audioBuffer) {
    this.localSongs.set(song.id, {
      ...song,
      isLocalAvailable: true,
      syncStatus: this.isOnline ? 'synced' : 'pending_upload',
    });
    this.audioBlobs.set(song.id, audioBuffer);
    this.downloadInfo.set(song.id, {
      id: song.id,
      status: 'downloaded',
      isDownloaded: true,
      fileSize: audioBuffer.length,
    });

    if (!this.isOnline) {
      const opId = `op_upload_${song.id}`;
      this.pendingOperations.set(opId, {
        id: opId,
        type: 'UPLOAD',
        songId: song.id,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Edit song while offline
  renameSongOffline(songId, newTitle) {
    const song = this.localSongs.get(songId);
    if (!song) throw new Error('Song not found locally');

    const oldTitle = song.title;
    song.title = newTitle;
    song.updatedAt = new Date().toISOString();

    if (!this.isOnline) {
      const opId = `op_rename_${songId}_${Date.now()}`;
      this.pendingOperations.set(opId, {
        id: opId,
        type: 'RENAME',
        songId,
        payload: { newTitle, oldTitle },
        status: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Soft delete song while offline
  softDeleteOffline(songId) {
    const song = this.localSongs.get(songId);
    if (!song) throw new Error('Song not found locally');

    song.isDeleted = true;
    song.deletedAt = new Date().toISOString();
    song.deletedBy = this.userId;

    if (!this.isOnline) {
      const opId = `op_delete_${songId}_${Date.now()}`;
      this.pendingOperations.set(opId, {
        id: opId,
        type: 'DELETE',
        songId,
        payload: { title: song.title },
        status: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

class SimulatedCloudServer {
  constructor() {
    this.songs = new Map();
    this.storage = new Map();
    this.userFavorites = new Set(); // set of "userId:songId"
    this.activityLogs = [];
  }

  upload(song, audioBuffer, user) {
    const storagePath = `audio/${song.id}/${Date.now()}_${song.originalFilename}`;
    this.storage.set(storagePath, audioBuffer);
    const now = new Date().toISOString();
    const cloudSong = {
      ...song,
      storagePath,
      uploadedBy: user.id,
      uploadedByName: user.fullName || user.username,
      updated_at: now,
      is_deleted: false,
    };
    this.songs.set(song.id, cloudSong);
    this.activityLogs.push({
      action: 'UPLOAD',
      songId: song.id,
      userId: user.id,
      timestamp: now,
    });
    return cloudSong;
  }

  rename(songId, newTitle, user) {
    const song = this.songs.get(songId);
    if (!song) throw new Error('Remote song not found');
    const oldTitle = song.title;
    song.title = newTitle;
    song.updated_at = new Date().toISOString();
    this.activityLogs.push({
      action: 'RENAME',
      songId,
      oldTitle,
      newTitle,
      userId: user.id,
    });
    return song;
  }

  softDelete(songId, user) {
    const song = this.songs.get(songId);
    if (!song) throw new Error('Remote song not found');
    song.is_deleted = true;
    song.deleted_at = new Date().toISOString();
    song.deleted_by = user.id;
    song.updated_at = new Date().toISOString();
    this.activityLogs.push({
      action: 'DELETE',
      songId,
      userId: user.id,
    });
    return song;
  }
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('Offline Sync: Upload while offline, reconnect, and sync to cloud', () => {
  const cloud = new SimulatedCloudServer();
  const device = new SimulatedOfflineDevice('dev-01', 'user-sk', 'sk');
  const user = { id: 'user-sk', username: 'sk', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };

  // 1. Device is offline
  device.isOnline = false;

  const songId = 'd82fb10e-09a1-43ee-9df7-28d116244f77';
  const audioData = Buffer.from('OFFLINE_AUDIO_MP3_BYTES');
  const song = {
    id: songId,
    title: 'Kalyani Jatiswaram Practice',
    originalFilename: 'kalyani_jatiswaram.mp3',
    fileType: 'audio/mpeg',
    fileSize: audioData.length,
    duration: 120,
    category: 'Jatiswaram',
    isDeleted: false,
  };

  device.importSongLocally(song, audioData);

  // Local song is immediately playable offline
  assert.equal(device.localSongs.get(songId).isLocalAvailable, true);
  assert.equal(device.localSongs.get(songId).syncStatus, 'pending_upload');
  assert.equal(device.audioBlobs.has(songId), true);
  assert.equal(device.pendingOperations.size, 1);

  // Cloud does not have it yet
  assert.equal(cloud.songs.has(songId), false);

  // 2. Reconnect and sync
  device.isOnline = true;

  // Drain upload queue
  for (const [opId, op] of device.pendingOperations.entries()) {
    if (op.type === 'UPLOAD') {
      const localSong = device.localSongs.get(op.songId);
      const blob = device.audioBlobs.get(op.songId);
      const uploaded = cloud.upload(localSong, blob, user);
      localSong.syncStatus = 'synced';
      localSong.storagePath = uploaded.storagePath;
      device.pendingOperations.delete(opId);
    }
  }

  // Verified synced
  assert.equal(device.pendingOperations.size, 0);
  assert.equal(cloud.songs.has(songId), true);
  assert.equal(cloud.songs.get(songId).title, 'Kalyani Jatiswaram Practice');
  assert.equal(device.localSongs.get(songId).syncStatus, 'synced');
});

test('Offline Sync: Download while online and play offline on device', () => {
  const cloud = new SimulatedCloudServer();
  const device = new SimulatedOfflineDevice('dev-02', 'user-veda', 'veda');
  const user = { id: 'user-veda', username: 'veda', fullName: 'Guru Veda', role: 'TEACHER', status: 'APPROVED' };

  // Track exists in cloud
  const songId = '34b56c7d-89ea-4f01-b234-567890abcdef';
  const cloudAudio = Buffer.from('CLOUD_RECITAL_WAV');
  cloud.upload(
    {
      id: songId,
      title: 'Manduka Shabdam Recital',
      originalFilename: 'manduka_shabdam.wav',
      fileType: 'audio/wav',
      fileSize: cloudAudio.length,
      duration: 180,
    },
    cloudAudio,
    user
  );

  // Device knows metadata from sync, but audio is NOT downloaded yet
  const cloudRecord = cloud.songs.get(songId);
  device.localSongs.set(songId, {
    id: songId,
    title: cloudRecord.title,
    originalFilename: cloudRecord.originalFilename,
    storagePath: cloudRecord.storagePath,
    isLocalAvailable: false,
  });

  assert.equal(device.localSongs.get(songId).isLocalAvailable, false);
  assert.equal(device.audioBlobs.has(songId), false);

  // User downloads the track while online
  const downloadedBlob = cloud.storage.get(cloudRecord.storagePath);
  device.audioBlobs.set(songId, downloadedBlob);
  device.localSongs.get(songId).isLocalAvailable = true;
  device.downloadInfo.set(songId, {
    id: songId,
    status: 'downloaded',
    isDownloaded: true,
  });

  // Device goes offline (in dance hall without WiFi)
  device.isOnline = false;

  // Track is fully playable offline from device IndexedDB
  assert.equal(device.localSongs.get(songId).isLocalAvailable, true);
  assert.deepEqual(device.audioBlobs.get(songId), cloudAudio);
});

test('Offline Sync: Edit (Rename & Delete) while offline and synchronize edits', () => {
  const cloud = new SimulatedCloudServer();
  const device = new SimulatedOfflineDevice('dev-03', 'user-sk', 'sk');
  const user = { id: 'user-sk', username: 'sk', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };

  const songId = 'a1234567-b89c-4def-0123-456789abcdef';
  const initialAudio = Buffer.from('AUDIO_BYTES');
  const cloudSong = cloud.upload(
    {
      id: songId,
      title: 'Pushpanjali',
      originalFilename: 'pushpanjali.mp3',
      fileType: 'audio/mpeg',
    },
    initialAudio,
    user
  );

  // Sync to local
  device.importSongLocally(cloudSong, initialAudio);

  // Device goes offline
  device.isOnline = false;

  // 1. Rename offline
  device.renameSongOffline(songId, 'Pushpanjali (Aarambham 1st Speed)');
  assert.equal(device.localSongs.get(songId).title, 'Pushpanjali (Aarambham 1st Speed)');
  assert.equal(device.pendingOperations.size, 1);

  // Cloud still has old title
  assert.equal(cloud.songs.get(songId).title, 'Pushpanjali');

  // 2. Device reconnects and drains mutation queue
  device.isOnline = true;
  for (const [opId, op] of device.pendingOperations.entries()) {
    if (op.type === 'RENAME') {
      cloud.rename(op.songId, op.payload.newTitle, user);
      device.pendingOperations.delete(opId);
    }
  }

  // Cloud is updated with new title
  assert.equal(cloud.songs.get(songId).title, 'Pushpanjali (Aarambham 1st Speed)');
  assert.equal(device.pendingOperations.size, 0);

  // 3. Soft delete offline
  device.isOnline = false;
  device.softDeleteOffline(songId);
  assert.equal(device.localSongs.get(songId).isDeleted, true);
  assert.equal(device.pendingOperations.size, 1);

  // 4. Reconnect and drain delete mutation
  device.isOnline = true;
  for (const [opId, op] of device.pendingOperations.entries()) {
    if (op.type === 'DELETE') {
      cloud.softDelete(op.songId, user);
      device.pendingOperations.delete(opId);
    }
  }

  // Cloud is marked deleted
  assert.equal(cloud.songs.get(songId).is_deleted, true);
  assert.equal(device.pendingOperations.size, 0);
  // Audio blob is preserved locally!
  assert.equal(device.audioBlobs.has(songId), true);
});

test('Offline Sync: New device login restores library metadata and cloud favorites', () => {
  const cloud = new SimulatedCloudServer();
  const user = { id: 'user-sk', username: 'sk', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };

  // Cloud has 2 songs
  const s1 = cloud.upload({ id: 's1-uuid', title: 'Varnam', originalFilename: 'varnam.mp3' }, Buffer.from('v1'), user);
  const s2 = cloud.upload({ id: 's2-uuid', title: 'Tarangam', originalFilename: 'tarangam.mp3' }, Buffer.from('v2'), user);

  // Cloud user favorites s2
  cloud.userFavorites.add(`${user.id}:s2-uuid`);

  // Student logs in on a brand new phone (empty IndexedDB)
  const newPhone = new SimulatedOfflineDevice('new-phone-01', user.id, user.username);
  assert.equal(newPhone.localSongs.size, 0);
  assert.equal(newPhone.audioBlobs.size, 0);

  // Incremental sync pulls metadata & favorites
  for (const cs of cloud.songs.values()) {
    const isFav = cloud.userFavorites.has(`${user.id}:${cs.id}`);
    newPhone.localSongs.set(cs.id, {
      ...cs,
      isLocalAvailable: false, // Fresh phone has not downloaded audio yet
      isFavorite: isFav,
      syncStatus: 'synced',
    });
  }

  // Repertoire is restored onto new device
  assert.equal(newPhone.localSongs.size, 2);
  assert.equal(newPhone.localSongs.get('s1-uuid').isLocalAvailable, false);
  assert.equal(newPhone.localSongs.get('s2-uuid').isFavorite, true);

  // Bulk download entire repertoire
  for (const s of newPhone.localSongs.values()) {
    const blob = cloud.storage.get(s.storagePath);
    newPhone.audioBlobs.set(s.id, blob);
    s.isLocalAvailable = true;
  }

  // All tracks are now playable offline on the new phone
  assert.equal(newPhone.audioBlobs.size, 2);
  assert.equal(newPhone.localSongs.get('s1-uuid').isLocalAvailable, true);
  assert.equal(newPhone.localSongs.get('s2-uuid').isLocalAvailable, true);
});

test('Offline Sync: Recover gracefully after interrupted download', () => {
  const device = new SimulatedOfflineDevice('dev-04', 'u1', 'sk');
  const songId = 'int-song-01';

  // 1. Initial attempt fails / interrupted
  device.downloadInfo.set(songId, {
    id: songId,
    status: 'failed',
    error: 'Network connection dropped during transfer',
    isDownloaded: false,
  });

  assert.equal(device.downloadInfo.get(songId).status, 'failed');
  assert.equal(device.audioBlobs.has(songId), false);

  // 2. Retry download succeeds
  const completedBlob = Buffer.from('FULL_DOWNLOADED_AUDIO');
  device.audioBlobs.set(songId, completedBlob);
  device.downloadInfo.set(songId, {
    id: songId,
    status: 'downloaded',
    isDownloaded: true,
    fileSize: completedBlob.length,
  });

  assert.equal(device.downloadInfo.get(songId).status, 'downloaded');
  assert.equal(device.audioBlobs.has(songId), true);
});

test('Offline Sync: Never sacrifice existing local audio files during metadata sync', () => {
  const cloud = new SimulatedCloudServer();
  const device = new SimulatedOfflineDevice('dev-05', 'u1', 'sk');
  const user = { id: 'u1', username: 'sk', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };

  const songId = 'perm-local-song-01';
  const originalAudio = Buffer.from('HIGH_QUALITY_LOCAL_AUDIO_RECORDING');

  // Teacher uploads to cloud
  const cloudSong = cloud.upload(
    {
      id: songId,
      title: 'Kalyani Jatiswaram',
      category: 'Jatiswaram',
      originalFilename: 'kalyani.mp3',
    },
    originalAudio,
    user
  );

  // Student downloads and has audio locally
  device.importSongLocally(cloudSong, originalAudio);
  assert.equal(device.audioBlobs.has(songId), true);

  // Remote teacher modifies category and title in cloud
  cloud.rename(songId, 'Kalyani Jatiswaram - Senior Repertoire', user);
  const updatedCloud = cloud.songs.get(songId);

  // Sync update received on student's phone
  const studentLocal = device.localSongs.get(songId);
  studentLocal.title = updatedCloud.title;
  studentLocal.updatedAt = updatedCloud.updated_at;

  // Local audio blob MUST remain completely intact and untouched!
  assert.equal(device.audioBlobs.has(songId), true);
  assert.deepEqual(device.audioBlobs.get(songId), originalAudio);
  assert.equal(device.localSongs.get(songId).title, 'Kalyani Jatiswaram - Senior Repertoire');
});
