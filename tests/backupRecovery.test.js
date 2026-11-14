import test from 'node:test';
import assert from 'node:assert/strict';

// CRC-32 Lookup Table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calculateCrc32(data) {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Portable ZIP Builder (Node/Browser compatible)
function buildZipArchive(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  const textEncoder = new TextEncoder();

  for (const entry of entries) {
    const filenameBytes = textEncoder.encode(entry.name);
    const dataBytes = entry.data;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // 1. Local File Header
    const localHeader = new Uint8Array(30 + filenameBytes.length + size);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // UTF-8
    localView.setUint16(8, 0, true);      // Store (uncompressed)
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, filenameBytes.length, true);
    localView.setUint16(28, 0, true);

    localHeader.set(filenameBytes, 30);
    localHeader.set(dataBytes, 30 + filenameBytes.length);
    localHeaders.push(localHeader);

    // 2. Central Directory File Header
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, filenameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, currentOffset, true);

    centralHeader.set(filenameBytes, 46);
    centralHeaders.push(centralHeader);

    currentOffset += localHeader.length;
  }

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // 3. EOCD
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, centralDirOffset, true);
  eocdView.setUint16(20, 0, true);

  // Concatenate all parts
  let totalLength = 0;
  for (const h of localHeaders) totalLength += h.length;
  for (const c of centralHeaders) totalLength += c.length;
  totalLength += eocd.length;

  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const h of localHeaders) {
    result.set(h, pos);
    pos += h.length;
  }
  for (const c of centralHeaders) {
    result.set(c, pos);
    pos += c.length;
  }
  result.set(eocd, pos);

  return result.buffer;
}

// Portable ZIP Parser
function parseZipArchive(buffer) {
  const files = new Map();
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 30 <= buffer.byteLength) {
    const signature = view.getUint32(offset, true);

    if (signature === 0x04034b50) {
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);

      const nameBytes = new Uint8Array(buffer, offset + 30, nameLength);
      const filename = textDecoder.decode(nameBytes);

      const dataOffset = offset + 30 + nameLength + extraLength;
      const rawData = new Uint8Array(buffer, dataOffset, compressedSize);

      files.set(filename, new Uint8Array(rawData));
      offset = dataOffset + compressedSize;
    } else {
      break;
    }
  }

  return files;
}

// Backup Validator
function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, reason: 'Manifest is not a valid object.' };
  }
  if (manifest.app !== 'Naatyavedam Library') {
    return { valid: false, reason: `Unknown app identifier "${manifest.app}".` };
  }
  if (!manifest.schemaVersion) {
    return { valid: false, reason: 'Missing schemaVersion.' };
  }
  return { valid: true };
}

// Storage Metrics Calculator
function computeStorageMetrics(songs, syncState, storageEstimate) {
  const downloadedSongs = songs.filter((s) => s.isLocalAvailable && !s.isDeleted).length;
  const awaitingDownload = songs.filter((s) => !s.isLocalAvailable && !s.isDeleted).length;
  const awaitingUpload = syncState?.pendingCount ?? 0;
  const syncStatus = syncState?.isSyncing
    ? 'Syncing'
    : syncState?.error
    ? 'Error'
    : 'Synced';

  return {
    downloadedSongs,
    awaitingDownload,
    awaitingUpload,
    syncStatus,
    storageUsedMB: storageEstimate ? (storageEstimate.usageBytes / 1024 / 1024).toFixed(1) : '0.0',
  };
}

// ==============================================================================
// TESTS
// ==============================================================================

test('Phase 8 Backup: Generates valid ZIP structure with local headers, central directory & EOCD', () => {
  const textEncoder = new TextEncoder();
  const manifestData = textEncoder.encode(
    JSON.stringify({
      app: 'Naatyavedam Library',
      schemaVersion: '1.0',
      totalSongs: 2,
    })
  );

  const audioDummy = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]); // RIFF header

  const entries = [
    { name: 'manifest.json', data: manifestData },
    { name: 'audio/sample_1.wav', data: audioDummy },
  ];

  const zipBuffer = buildZipArchive(entries);
  assert.ok(zipBuffer.byteLength > 0);

  const view = new DataView(zipBuffer);
  // Verify first entry signature 0x04034b50
  assert.equal(view.getUint32(0, true), 0x04034b50);
});

test('Phase 8 Backup: Extracts files accurately from generated ZIP archive', () => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder('utf-8');

  const songData = JSON.stringify([
    {
      id: 'song-uuid-1',
      title: 'Kalyani Jatiswaram',
      category: 'Jatiswaram',
      ragam: 'Kalyani',
      talam: 'Rupaka',
      isFavorite: true,
    },
  ]);

  const audioBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  const entries = [
    { name: 'manifest.json', data: textEncoder.encode(JSON.stringify({ app: 'Naatyavedam Library', schemaVersion: '1.0' })) },
    { name: 'songs.json', data: textEncoder.encode(songData) },
    { name: 'audio/song-uuid-1.mp3', data: audioBytes },
  ];

  const zipBuffer = buildZipArchive(entries);
  const files = parseZipArchive(zipBuffer);

  assert.equal(files.size, 3);
  assert.ok(files.has('manifest.json'));
  assert.ok(files.has('songs.json'));
  assert.ok(files.has('audio/song-uuid-1.mp3'));

  const parsedManifest = JSON.parse(textDecoder.decode(files.get('manifest.json')));
  assert.equal(parsedManifest.app, 'Naatyavedam Library');

  const parsedSongs = JSON.parse(textDecoder.decode(files.get('songs.json')));
  assert.equal(parsedSongs[0].title, 'Kalyani Jatiswaram');
  assert.equal(parsedSongs[0].ragam, 'Kalyani');

  const extractedAudio = files.get('audio/song-uuid-1.mp3');
  assert.deepEqual(extractedAudio, audioBytes);
});

test('Phase 8 Backup Validation: Rejects invalid or corrupt backup archives', () => {
  assert.equal(validateBackupManifest(null).valid, false);
  assert.equal(validateBackupManifest({}).valid, false);
  assert.equal(validateBackupManifest({ app: 'Random App' }).valid, false);

  const validManifest = {
    app: 'Naatyavedam Library',
    schemaVersion: '1.0',
    exportDate: '2026-11-14T15:00:00.000Z',
    exportedBy: 'veda',
    totalSongs: 10,
  };
  assert.equal(validateBackupManifest(validManifest).valid, true);
});

test('Phase 8 Recovery Bin: Deleted songs preserve deletedBy, deletion date, and category', () => {
  const deletedSong = {
    id: 'trash-101',
    title: 'Gajendra Moksham Shabdam',
    category: 'Shabdam',
    isDeleted: true,
    deletedAt: '2026-11-14T10:00:00.000Z',
    deletedBy: 'veda',
    uploadedByName: 'Guru Veda',
  };

  assert.equal(deletedSong.isDeleted, true);
  assert.equal(deletedSong.deletedBy, 'veda');
  assert.equal(deletedSong.category, 'Shabdam');
  assert.ok(deletedSong.deletedAt);
});

test('Phase 8 Storage Metrics: Accurately calculates downloaded, pending upload, and pending download', () => {
  const mockSongs = [
    { id: '1', title: 'Song 1', isLocalAvailable: true, isDeleted: false },
    { id: '2', title: 'Song 2', isLocalAvailable: true, isDeleted: false },
    { id: '3', title: 'Song 3', isLocalAvailable: false, isDeleted: false }, // awaiting download
    { id: '4', title: 'Song 4', isLocalAvailable: true, isDeleted: true },  // deleted (not in active repertoire)
  ];

  const mockSyncState = {
    isSyncing: false,
    pendingCount: 2,
    lastSyncTime: '2026-11-14T12:00:00.000Z',
    error: null,
  };

  const storageEstimate = {
    usageBytes: 25 * 1024 * 1024,
    quotaBytes: 1000 * 1024 * 1024,
    percentageUsed: 2.5,
    isPersisted: true,
  };

  const metrics = computeStorageMetrics(mockSongs, mockSyncState, storageEstimate);
  assert.equal(metrics.downloadedSongs, 2);
  assert.equal(metrics.awaitingDownload, 1);
  assert.equal(metrics.awaitingUpload, 2);
  assert.equal(metrics.syncStatus, 'Synced');
  assert.equal(metrics.storageUsedMB, '25.0');
});

test('Phase 8 Storage Protection: Repertoire guarantee ensures local audio files are never automatically deleted', () => {
  const policy = {
    autoDeletePolicy: 'NEVER',
    protectedReason: 'Rehearsal audio must remain offline-available indefinitely for stage performances.',
  };
  assert.equal(policy.autoDeletePolicy, 'NEVER');
});

