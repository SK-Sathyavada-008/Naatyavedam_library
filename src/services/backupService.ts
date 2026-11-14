// ==============================================================================
// NAATYAVEDAM LIBRARY: BACKUP & RESTORE SERVICE
// Structured portable ZIP & JSON archive export/import with validation & zero external dependencies
// ==============================================================================

import { db, getSongAudioBlob, saveSongWithBlob } from './db';
import type { Song, Program, ProgramItem, UserProfile } from '../types';

// CRC-32 Lookup Table for standard ZIP files
const CRC_TABLE: Uint32Array = (() => {
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

function calculateCrc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export interface BackupManifest {
  app: 'Naatyavedam Library';
  schemaVersion: '1.0';
  exportDate: string;
  exportedBy: string;
  totalSongs: number;
  totalPrograms: number;
  totalAudioBytes: number;
  notes?: string;
}

export interface BackupProgressCallback {
  (current: number, total: number, message: string): void;
}

export interface ImportBackupResult {
  success: boolean;
  importedSongs: number;
  importedPrograms: number;
  skippedSongs: number;
  errors: string[];
  manifest?: BackupManifest;
}

// ------------------------------------------------------------------------------
// Pure TypeScript Portable ZIP Builder (Store Mode - 0% compression, 100% standard)
// ------------------------------------------------------------------------------

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function buildZipArchive(entries: ZipEntry[]): Blob {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let currentOffset = 0;

  const textEncoder = new TextEncoder();

  for (const entry of entries) {
    const filenameBytes = textEncoder.encode(entry.name);
    const dataBytes = entry.data;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // 1. Local File Header (30 bytes + filename + data)
    const localHeader = new Uint8Array(30 + filenameBytes.length + size);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true);         // Version needed to extract (2.0)
    localView.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8)
    localView.setUint16(8, 0, true);          // Compression method (0 = STORE)
    localView.setUint16(10, 0, true);         // Last mod file time
    localView.setUint16(12, 0, true);         // Last mod file date
    localView.setUint32(14, crc, true);        // CRC-32
    localView.setUint32(18, size, true);       // Compressed size
    localView.setUint32(22, size, true);       // Uncompressed size
    localView.setUint16(26, filenameBytes.length, true); // Filename length
    localView.setUint16(28, 0, true);          // Extra field length

    localHeader.set(filenameBytes, 30);
    localHeader.set(dataBytes, 30 + filenameBytes.length);
    localHeaders.push(localHeader);

    // 2. Central Directory File Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true);          // Version made by (2.0)
    centralView.setUint16(6, 20, true);          // Version needed (2.0)
    centralView.setUint16(8, 0x0800, true);      // UTF-8 flag
    centralView.setUint16(10, 0, true);          // Compression method
    centralView.setUint16(12, 0, true);          // Mod time
    centralView.setUint16(14, 0, true);          // Mod date
    centralView.setUint32(16, crc, true);         // CRC-32
    centralView.setUint32(20, size, true);        // Compressed size
    centralView.setUint32(24, size, true);        // Uncompressed size
    centralView.setUint16(28, filenameBytes.length, true); // Filename length
    centralView.setUint16(30, 0, true);          // Extra field length
    centralView.setUint16(32, 0, true);          // Comment length
    centralView.setUint16(34, 0, true);          // Disk start
    centralView.setUint16(36, 0, true);          // Internal attributes
    centralView.setUint32(38, 0, true);          // External attributes
    centralView.setUint32(42, currentOffset, true); // Local header offset

    centralHeader.set(filenameBytes, 46);
    centralHeaders.push(centralHeader);

    currentOffset += localHeader.length;
  }

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true);          // EOCD signature
  eocdView.setUint16(4, 0, true);                   // Number of this disk
  eocdView.setUint16(6, 0, true);                   // Disk with central dir
  eocdView.setUint16(8, entries.length, true);      // Total entries on disk
  eocdView.setUint16(10, entries.length, true);     // Total entries in central dir
  eocdView.setUint32(12, centralDirSize, true);     // Size of central dir
  eocdView.setUint32(16, centralDirOffset, true);   // Offset of start of central dir
  eocdView.setUint16(20, 0, true);                  // Comment length

  // Combine into single Blob
  const parts = [...localHeaders, ...centralHeaders, eocd] as unknown as BlobPart[];
  return new Blob(parts, { type: 'application/zip' });
}

// ------------------------------------------------------------------------------
// Pure TypeScript ZIP Reader / Unpacker
// ------------------------------------------------------------------------------

export async function parseZipArchive(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 30 <= buffer.byteLength) {
    const signature = view.getUint32(offset, true);

    // If local file header signature
    if (signature === 0x04034b50) {
      const compression = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);

      const nameBytes = new Uint8Array(buffer, offset + 30, nameLength);
      const filename = textDecoder.decode(nameBytes);

      const dataOffset = offset + 30 + nameLength + extraLength;
      const rawData = new Uint8Array(buffer, dataOffset, compressedSize);

      if (compression === 0) {
        // STORE mode (direct slice)
        files.set(filename, new Uint8Array(rawData));
      } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
        // Deflate mode (using native DecompressionStream if available)
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(rawData);
          writer.close();
          const decompressed = await new Response(ds.readable).arrayBuffer();
          files.set(filename, new Uint8Array(decompressed));
        } catch {
          // If browser decompression stream fails or is unsupported, keep raw data
          files.set(filename, new Uint8Array(rawData));
        }
      } else {
        files.set(filename, new Uint8Array(rawData));
      }

      offset = dataOffset + compressedSize;
    } else {
      // Central directory or end of records reached
      break;
    }
  }

  return files;
}

// ------------------------------------------------------------------------------
// Export Library Backup
// ------------------------------------------------------------------------------

export async function exportLibraryBackup(
  user: UserProfile | null,
  onProgress?: BackupProgressCallback
): Promise<{ blob: Blob; filename: string }> {
  if (onProgress) onProgress(0, 100, 'Gathering repertoire metadata...');

  // 1. Fetch songs and programs
  const songs = await db.songs.filter((s) => !s.isDeleted).toArray();
  const programs = await db.programs.filter((p) => !p.isDeleted).toArray();
  const programItems = await db.programItems.toArray();

  const entries: ZipEntry[] = [];
  const textEncoder = new TextEncoder();

  let totalAudioBytes = 0;

  // 2. Fetch and package audio binaries
  const totalSongs = songs.length;
  for (let i = 0; i < totalSongs; i++) {
    const song = songs[i];
    if (onProgress) {
      const pct = Math.round(((i + 1) / (totalSongs + 1)) * 90);
      onProgress(pct, 100, `Packaging audio: ${song.title} (${i + 1}/${totalSongs})`);
    }

    try {
      const audioBlob = await getSongAudioBlob(song.id);
      if (audioBlob) {
        const audioBuf = await audioBlob.arrayBuffer();
        const ext = song.fileType?.includes('wav')
          ? 'wav'
          : song.fileType?.includes('m4a')
          ? 'm4a'
          : song.fileType?.includes('ogg')
          ? 'ogg'
          : 'mp3';

        const archiveAudioPath = `audio/${song.id}.${ext}`;
        entries.push({
          name: archiveAudioPath,
          data: new Uint8Array(audioBuf),
        });
        totalAudioBytes += audioBuf.byteLength;
      }
    } catch (e) {
      console.warn(`[Backup] Could not read audio for song ${song.id}:`, e);
    }
  }

  // 3. Create Manifest
  const now = new Date().toISOString();
  const manifest: BackupManifest = {
    app: 'Naatyavedam Library',
    schemaVersion: '1.0',
    exportDate: now,
    exportedBy: user?.username || 'member',
    totalSongs: songs.length,
    totalPrograms: programs.length,
    totalAudioBytes,
    notes: 'Kuchipudi classical dance repertoire backup archive',
  };

  entries.push({
    name: 'manifest.json',
    data: textEncoder.encode(JSON.stringify(manifest, null, 2)),
  });

  entries.push({
    name: 'songs.json',
    data: textEncoder.encode(JSON.stringify(songs, null, 2)),
  });

  entries.push({
    name: 'programs.json',
    data: textEncoder.encode(JSON.stringify({ programs, programItems }, null, 2)),
  });

  if (onProgress) onProgress(95, 100, 'Generating portable ZIP archive...');

  const zipBlob = buildZipArchive(entries);

  if (onProgress) onProgress(100, 100, 'Backup package complete!');

  const dateStr = now.slice(0, 10);
  const filename = `naatyavedam_library_backup_${dateStr}.zip`;

  return { blob: zipBlob, filename };
}

// ------------------------------------------------------------------------------
// Import Library Backup
// ------------------------------------------------------------------------------

export async function importLibraryBackup(
  backupFile: File | Blob,
  onProgress?: BackupProgressCallback
): Promise<ImportBackupResult> {
  const result: ImportBackupResult = {
    success: false,
    importedSongs: 0,
    importedPrograms: 0,
    skippedSongs: 0,
    errors: [],
  };

  try {
    if (onProgress) onProgress(10, 100, 'Reading archive file...');
    const buffer = await backupFile.arrayBuffer();

    // Check if JSON or ZIP
    const isZip = buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, true) === 0x04034b50;

    let manifest: BackupManifest | null = null;
    let songsToImport: Song[] = [];
    let programsToImport: Program[] = [];
    let programItemsToImport: ProgramItem[] = [];
    const audioDataMap = new Map<string, Uint8Array>();

    const textDecoder = new TextDecoder('utf-8');

    if (isZip) {
      if (onProgress) onProgress(25, 100, 'Parsing ZIP contents and manifest...');
      const zipFiles = await parseZipArchive(buffer);

      // 1. Verify Manifest
      const manifestBytes = zipFiles.get('manifest.json');
      if (!manifestBytes) {
        throw new Error('Invalid backup archive: missing manifest.json');
      }

      manifest = JSON.parse(textDecoder.decode(manifestBytes)) as BackupManifest;
      if (manifest.app !== 'Naatyavedam Library') {
        throw new Error(`Unrecognized archive: application "${manifest.app}" is not supported.`);
      }

      // 2. Parse Songs
      const songsBytes = zipFiles.get('songs.json');
      if (songsBytes) {
        songsToImport = JSON.parse(textDecoder.decode(songsBytes)) as Song[];
      }

      // 3. Parse Programs
      const programsBytes = zipFiles.get('programs.json');
      if (programsBytes) {
        const progData = JSON.parse(textDecoder.decode(programsBytes));
        programsToImport = progData.programs || [];
        programItemsToImport = progData.programItems || [];
      }

      // 4. Index Audio Files
      for (const [name, data] of zipFiles.entries()) {
        if (name.startsWith('audio/')) {
          const songId = name.replace(/^audio\//, '').replace(/\.[^/.]+$/, '');
          audioDataMap.set(songId, data);
        }
      }
    } else {
      // Attempt JSON import fallback
      if (onProgress) onProgress(25, 100, 'Parsing JSON backup document...');
      const text = textDecoder.decode(buffer);
      const parsed = JSON.parse(text);

      if (parsed.app !== 'Naatyavedam Library') {
        throw new Error('Invalid backup format: Not a recognized Naatyavedam Library export.');
      }
      manifest = parsed.manifest || {
        app: 'Naatyavedam Library',
        schemaVersion: '1.0',
        exportDate: new Date().toISOString(),
        exportedBy: 'export',
        totalSongs: parsed.songs?.length || 0,
        totalPrograms: parsed.programs?.length || 0,
        totalAudioBytes: 0,
      };
      songsToImport = parsed.songs || [];
      programsToImport = parsed.programs || [];
      programItemsToImport = parsed.programItems || [];
    }

    result.manifest = manifest || undefined;

    // 5. Validate & Import Songs
    const totalSongs = songsToImport.length;
    for (let i = 0; i < totalSongs; i++) {
      const song = songsToImport[i];
      if (onProgress) {
        const pct = Math.round(30 + ((i + 1) / totalSongs) * 50);
        onProgress(pct, 100, `Importing song: "${song.title}" (${i + 1}/${totalSongs})`);
      }

      // Validation
      if (!song.title || !song.id) {
        result.errors.push(`Song entry #${i + 1} is missing required title or ID.`);
        result.skippedSongs++;
        continue;
      }

      // Check audio data
      const audioBytes = audioDataMap.get(song.id);
      let audioBlob: Blob | null = null;
      if (audioBytes && audioBytes.length > 0) {
        audioBlob = new Blob([audioBytes as unknown as BlobPart], { type: song.fileType || 'audio/mpeg' });
      }

      try {
        // Check if existing song exists locally
        const existing = await db.songs.get(song.id);
        if (existing && !audioBlob) {
          // Keep existing audio if backup doesn't have it
          await db.songs.update(song.id, {
            title: song.title,
            category: song.category,
            ragam: song.ragam,
            talam: song.talam,
            composer: song.composer,
            isFavorite: song.isFavorite,
            updatedAt: new Date().toISOString(),
          });
          result.importedSongs++;
        } else if (audioBlob) {
          await saveSongWithBlob(
            {
              ...song,
              syncStatus: 'local_only',
              isLocalAvailable: true,
            },
            audioBlob
          );
          result.importedSongs++;
        } else {
          // Metadata only
          await db.songs.put({
            ...song,
            syncStatus: 'local_only',
            isLocalAvailable: false,
          });
          result.importedSongs++;
        }
      } catch (err: unknown) {
        result.errors.push(`Failed to save "${song.title}": ${err instanceof Error ? err.message : String(err)}`);
        result.skippedSongs++;
      }
    }

    // 6. Import Programs
    if (programsToImport.length > 0) {
      if (onProgress) onProgress(85, 100, 'Importing dance performance programs...');
      for (const prog of programsToImport) {
        try {
          await db.programs.put(prog);
          result.importedPrograms++;
        } catch (err) {
          console.warn('[Backup] Error restoring program:', err);
        }
      }
      for (const item of programItemsToImport) {
        try {
          await db.programItems.put(item);
        } catch (err) {
          console.warn('[Backup] Error restoring program item:', err);
        }
      }
    }

    if (onProgress) onProgress(100, 100, 'Import completed successfully!');
    result.success = result.importedSongs > 0 || (totalSongs === 0 && result.importedPrograms > 0);
    return result;
  } catch (err: unknown) {
    result.success = false;
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }
}
