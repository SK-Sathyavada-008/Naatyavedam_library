import test from 'node:test';
import assert from 'node:assert/strict';

// Helper: UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Storage path generation function under test
function generateAudioStoragePath(songId, filename) {
  const timestamp = 1700000000000;
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `audio/${songId}/${timestamp}_${cleanName}`;
}

// Generate standard UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Simulated Shared Cloud Database with RLS simulation
class SimulatedCloudBackend {
  constructor() {
    this.profiles = new Map();
    this.songs = new Map();
    this.songFiles = new Map();
    this.storage = new Map();
    this.activityLogs = [];
  }

  addProfile(profile) {
    this.profiles.set(profile.id, profile);
  }

  // RLS check: caller must be approved
  assertApproved(caller) {
    if (!caller || caller.status !== 'APPROVED') {
      throw new Error('RLS Violation: Caller is not an approved member');
    }
  }

  // RLS check: caller must be teacher
  assertTeacher(caller) {
    if (!caller || caller.role !== 'TEACHER' || caller.status !== 'APPROVED') {
      throw new Error('RLS Violation: Operation requires TEACHER role');
    }
  }

  // Upload a song
  uploadSong(caller, songInput, audioBuffer) {
    this.assertApproved(caller);

    // Validate UUID
    assert.match(songInput.id, UUID_REGEX, 'Song ID must be a valid UUID');

    const storagePath = generateAudioStoragePath(songInput.id, songInput.originalFilename);
    this.storage.set(storagePath, audioBuffer);

    const now = new Date().toISOString();
    const song = {
      ...songInput,
      isDeleted: false,
      uploadedBy: caller.id,
      uploadedByName: caller.fullName,
      storagePath,
      createdAt: now,
      updatedAt: now,
    };
    this.songs.set(song.id, song);

    this.songFiles.set(song.id, {
      songId: song.id,
      bucketId: 'music-library',
      storagePath,
      fileName: songInput.originalFilename,
      sizeBytes: audioBuffer.length,
      uploadedBy: caller.id,
    });

    this.activityLogs.push({
      action: 'UPLOAD',
      songId: song.id,
      songTitle: song.title,
      performedBy: caller.id,
      performedByName: caller.fullName,
      timestamp: now,
    });

    return song;
  }

  // Read shared active library
  getSharedLibrary(caller) {
    this.assertApproved(caller);
    return Array.from(this.songs.values()).filter((s) => !s.isDeleted);
  }

  // Read recovery bin
  getRecoveryBin(caller) {
    this.assertApproved(caller);
    return Array.from(this.songs.values()).filter((s) => s.isDeleted);
  }

  // Download audio
  downloadAudio(caller, storagePath) {
    this.assertApproved(caller);
    const audio = this.storage.get(storagePath);
    if (!audio) throw new Error('File not found in storage');

    this.activityLogs.push({
      action: 'DOWNLOAD',
      performedBy: caller.id,
      performedByName: caller.fullName,
      timestamp: new Date().toISOString(),
    });

    return audio;
  }

  // Rename song
  renameSong(caller, songId, newTitle) {
    this.assertApproved(caller);
    const song = this.songs.get(songId);
    if (!song) throw new Error('Song not found');

    const previousTitle = song.title;
    song.title = newTitle.trim();
    song.updatedAt = new Date().toISOString();

    this.activityLogs.push({
      action: 'RENAME',
      songId,
      songTitle: song.title,
      previousValue: previousTitle,
      newValue: song.title,
      performedBy: caller.id,
      performedByName: caller.fullName,
      timestamp: song.updatedAt,
    });

    return song;
  }

  // Soft delete song
  softDeleteSong(caller, songId) {
    this.assertApproved(caller);
    const song = this.songs.get(songId);
    if (!song) throw new Error('Song not found');

    const now = new Date().toISOString();
    song.isDeleted = true;
    song.deletedAt = now;
    song.deletedBy = caller.id;
    song.updatedAt = now;

    this.activityLogs.push({
      action: 'DELETE',
      songId,
      songTitle: song.title,
      performedBy: caller.id,
      performedByName: caller.fullName,
      timestamp: now,
    });

    return song;
  }

  // Restore song
  restoreSong(caller, songId) {
    this.assertApproved(caller);
    const song = this.songs.get(songId);
    if (!song) throw new Error('Song not found');

    const now = new Date().toISOString();
    song.isDeleted = false;
    song.deletedAt = undefined;
    song.deletedBy = undefined;
    song.restoredAt = now;
    song.restoredBy = caller.id;
    song.updatedAt = now;

    this.activityLogs.push({
      action: 'RESTORE',
      songId,
      songTitle: song.title,
      performedBy: caller.id,
      performedByName: caller.fullName,
      timestamp: now,
    });

    return song;
  }

  // Permanent delete (Teacher Only)
  permanentDelete(caller, songId) {
    this.assertTeacher(caller);
    const song = this.songs.get(songId);
    if (song?.storagePath) {
      this.storage.delete(song.storagePath);
    }
    this.songFiles.delete(songId);
    this.songs.delete(songId);
  }
}

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test('Shared Library: Student A uploads a song; Student B can see and download it', () => {
  const backend = new SimulatedCloudBackend();

  const studentA = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    username: 'sk',
    fullName: 'SK',
    role: 'STUDENT',
    status: 'APPROVED',
  };

  const studentB = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    username: 'ananya',
    fullName: 'Ananya (Student B)',
    role: 'STUDENT',
    status: 'APPROVED',
  };

  backend.addProfile(studentA);
  backend.addProfile(studentB);

  // Student A uploads a song
  const songId = generateUUID();
  const rawAudio = Buffer.from('RIFF_SIMULATED_AUDIO_DATA');
  const uploaded = backend.uploadSong(
    studentA,
    {
      id: songId,
      title: 'Kalyani Jatiswaram',
      originalFilename: 'kalyani_jatiswaram.mp3',
      fileType: 'audio/mpeg',
      fileSize: rawAudio.length,
      duration: 180,
      category: 'Jatiswaram',
    },
    rawAudio
  );

  assert.equal(uploaded.title, 'Kalyani Jatiswaram');
  assert.equal(uploaded.uploadedBy, studentA.id);

  // Student B can see it in the shared library
  const libraryForB = backend.getSharedLibrary(studentB);
  assert.equal(libraryForB.length, 1);
  assert.equal(libraryForB[0].id, songId);
  assert.equal(libraryForB[0].title, 'Kalyani Jatiswaram');

  // Student B can download the cloud audio
  const downloadedAudio = backend.downloadAudio(studentB, libraryForB[0].storagePath);
  assert.deepEqual(downloadedAudio, rawAudio);
});

test('Shared Library: Student B can rename a song uploaded by Student A', () => {
  const backend = new SimulatedCloudBackend();
  const studentA = { id: 'a1', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };
  const studentB = { id: 'b1', fullName: 'Ananya', role: 'STUDENT', status: 'APPROVED' };

  backend.addProfile(studentA);
  backend.addProfile(studentB);

  const songId = generateUUID();
  backend.uploadSong(
    studentA,
    {
      id: songId,
      title: 'Krishna Shabdam',
      originalFilename: 'krishna_shabdam.wav',
      fileType: 'audio/wav',
    },
    Buffer.from('wav')
  );

  // Student B renames it
  const renamed = backend.renameSong(studentB, songId, 'Krishna Shabdam (Talam 1st Speed)');
  assert.equal(renamed.title, 'Krishna Shabdam (Talam 1st Speed)');

  // Activity log verifies rename by Student B
  const renameLog = backend.activityLogs.find((l) => l.action === 'RENAME');
  assert.ok(renameLog);
  assert.equal(renameLog.performedBy, studentB.id);
  assert.equal(renameLog.previousValue, 'Krishna Shabdam');
  assert.equal(renameLog.newValue, 'Krishna Shabdam (Talam 1st Speed)');
});

test('Shared Library: Student B can soft delete; Student A can restore it', () => {
  const backend = new SimulatedCloudBackend();
  const studentA = { id: 'a1', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };
  const studentB = { id: 'b1', fullName: 'Ananya', role: 'STUDENT', status: 'APPROVED' };

  backend.addProfile(studentA);
  backend.addProfile(studentB);

  const songId = generateUUID();
  backend.uploadSong(
    studentA,
    {
      id: songId,
      title: 'Manduka Shabdam',
      originalFilename: 'manduka.mp3',
      fileType: 'audio/mpeg',
    },
    Buffer.from('mp3')
  );

  // Student B soft-deletes the song
  backend.softDeleteSong(studentB, songId);

  // Song is removed from active library for all members
  assert.equal(backend.getSharedLibrary(studentA).length, 0);
  assert.equal(backend.getSharedLibrary(studentB).length, 0);

  // Song exists in shared Recovery Bin with deletedBy = Student B
  const bin = backend.getRecoveryBin(studentA);
  assert.equal(bin.length, 1);
  assert.equal(bin[0].id, songId);
  assert.equal(bin[0].deletedBy, studentB.id);

  // Audio file remains intact in storage (never deleted on soft-delete)
  assert.ok(backend.storage.has(bin[0].storagePath));

  // Student A restores the song
  backend.restoreSong(studentA, songId);

  // Song is active again for both students
  assert.equal(backend.getSharedLibrary(studentA).length, 1);
  assert.equal(backend.getSharedLibrary(studentB).length, 1);
  assert.equal(backend.getRecoveryBin(studentA).length, 0);
});

test('Shared Library: Duplicate uploads of same file remain separate records', () => {
  const backend = new SimulatedCloudBackend();
  const student = { id: 's1', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };
  backend.addProfile(student);

  const audioData = Buffer.from('AUDIO_FILE_BYTES');

  // First upload
  const song1Id = generateUUID();
  const song1 = backend.uploadSong(
    student,
    {
      id: song1Id,
      title: 'Mohanam Varnam',
      originalFilename: 'mohanam_varnam.mp3',
      fileType: 'audio/mpeg',
    },
    audioData
  );

  // Second upload of identical file
  const song2Id = generateUUID();
  const song2 = backend.uploadSong(
    student,
    {
      id: song2Id,
      title: 'Mohanam Varnam',
      originalFilename: 'mohanam_varnam.mp3',
      fileType: 'audio/mpeg',
    },
    audioData
  );

  assert.notEqual(song1.id, song2.id);
  assert.notEqual(song1.storagePath, song2.storagePath);
  assert.equal(backend.getSharedLibrary(student).length, 2);
});

test('Shared Library: Idempotency prevents duplicate rows when retrying the same upload', () => {
  const backend = new SimulatedCloudBackend();
  const student = { id: 's1', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };
  backend.addProfile(student);

  const fixedSongId = generateUUID();
  const audioData = Buffer.from('AUDIO_FILE_BYTES');

  // First attempt
  backend.uploadSong(
    student,
    {
      id: fixedSongId,
      title: 'Pushpanjali',
      originalFilename: 'pushpanjali.wav',
      fileType: 'audio/wav',
    },
    audioData
  );

  // Retry with same songId (simulating client retry)
  backend.uploadSong(
    student,
    {
      id: fixedSongId,
      title: 'Pushpanjali',
      originalFilename: 'pushpanjali.wav',
      fileType: 'audio/wav',
    },
    audioData
  );

  // Idempotent upsert preserves single row
  assert.equal(backend.getSharedLibrary(student).length, 1);
});

test('Shared Library: Unauthorized or Pending accounts are strictly denied access', () => {
  const backend = new SimulatedCloudBackend();
  const pendingStudent = { id: 'p1', username: 'newbie', role: 'STUDENT', status: 'PENDING' };
  const rejectedStudent = { id: 'r1', username: 'bad_actor', role: 'STUDENT', status: 'REJECTED' };
  const unauthenticated = null;

  assert.throws(() => backend.getSharedLibrary(pendingStudent), /RLS Violation/);
  assert.throws(() => backend.getSharedLibrary(rejectedStudent), /RLS Violation/);
  assert.throws(() => backend.getSharedLibrary(unauthenticated), /RLS Violation/);
});

test('Shared Library: Only Teacher (Guru Veda) can permanently delete files from database/storage', () => {
  const backend = new SimulatedCloudBackend();
  const teacher = { id: 't1', username: 'veda', fullName: 'Guru Veda', role: 'TEACHER', status: 'APPROVED' };
  const student = { id: 's1', username: 'sk', fullName: 'SK', role: 'STUDENT', status: 'APPROVED' };

  backend.addProfile(teacher);
  backend.addProfile(student);

  const songId = generateUUID();
  const song = backend.uploadSong(
    student,
    { id: songId, title: 'Slokam', originalFilename: 'slokam.mp3', fileType: 'audio/mpeg' },
    Buffer.from('mp3')
  );

  // Student attempts permanent hard-delete -> REJECTED
  assert.throws(() => backend.permanentDelete(student, songId), /Operation requires TEACHER role/);

  // Teacher performs permanent hard-delete -> SUCCESS
  backend.permanentDelete(teacher, songId);
  assert.equal(backend.songs.has(songId), false);
  assert.equal(backend.storage.has(song.storagePath), false);
});

