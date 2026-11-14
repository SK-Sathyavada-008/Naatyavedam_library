export type UserRole = 'TEACHER' | 'STUDENT';

export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  removedAt?: string;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  username: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  resetCode?: string;
  expiresAt?: string;
  createdAt: string;
  reviewedAt?: string;
}

export type DanceCategory =
  | 'Pushpanjali'
  | 'Jatiswaram'
  | 'Shabdam'
  | 'Varnam'
  | 'Keerthanam'
  | 'Tarangam'
  | 'Thillana'
  | 'Slokam'
  | 'Practice / Talam'
  | 'Other';

export type SyncStatus =
  | 'local_only'
  | 'pending_upload'
  | 'synced'
  | 'pending_update'
  | 'pending_delete';

export interface Song {
  id: string;
  title: string;
  originalFilename: string;
  fileType: string;
  fileSize: number; // in bytes
  duration: number | null; // in seconds, when available
  createdAt: string; // ISO date added
  updatedAt: string; // ISO last modified date
  isFavorite: boolean;
  isLocalAvailable: boolean;
  syncStatus: SyncStatus;

  // Classical Dance metadata (optional/customizable)
  ragam?: string;
  talam?: string;
  composer?: string;
  category?: DanceCategory | string;

  // Deletion / Recovery bin support
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  restoredAt?: string;
  restoredBy?: string;

  // Cloud & Storage metadata
  storagePath?: string;
  bucketId?: string;

  // Legacy / download status compatibility
  isDownloaded?: boolean;
  fileName?: string;
  mimeType?: string;
  uploadedBy?: string;
  uploadedByName?: string;
}

export interface SongFileRecord {
  id: string;
  songId: string;
  bucketId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  md5Hash?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface RegistrationRequestRecord {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AudioBlobRecord {
  id: string; // songId
  songId: string;
  blob: Blob;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface FavoriteRecord {
  id: string;
  songId: string;
  createdAt: string;
}

export interface DownloadInfoRecord {
  id: string;
  songId: string;
  isDownloaded: boolean;
  downloadedAt: string;
  fileSize: number;
}

export interface PendingOperation {
  id: string;
  type: 'UPLOAD' | 'RENAME' | 'DELETE' | 'RESTORE' | 'FAVORITE';
  songId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'processing' | 'failed';
  retryCount: number;
}

export interface AppSettingRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLooping: boolean;
  playbackRate: number;
  isLoadingAudio: boolean;
  audioError: string | null;
}

export type AppView =
  | 'welcome'
  | 'login'
  | 'register'
  | 'library'
  | 'programs'
  | 'player'
  | 'settings';

export type SortOption = 'title-asc' | 'title-desc' | 'recent' | 'duration-desc' | 'duration-asc';

export interface ActivityLogEntry {
  id: string;
  action: 'UPLOAD' | 'RENAME' | 'DELETE' | 'RESTORE';
  songId: string;
  songTitle: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
  details?: string;
}

// ==============================================================================
// COLLABORATIVE PROGRAM MANAGEMENT TYPES
// ==============================================================================

export type ProgramItemSource = 'library_song' | 'program_audio';

export interface Program {
  id: string;
  title: string;
  description?: string;
  eventDate?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  itemCount?: number;
  totalDuration?: number;
}

export interface ProgramAudio {
  id: string;
  programId: string;
  displayTitle: string;
  originalFilename: string;
  storagePath: string;
  fileFormat: string;
  fileSize: number;
  duration: number | null;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
  isLocalAvailable?: boolean;
}

export interface ProgramItem {
  id: string;
  programId: string;
  sourceType: ProgramItemSource;
  songId?: string;
  programAudioId?: string;
  position: number;
  displayTitleOverride?: string;
  createdAt: string;
  updatedAt: string;

  // Resolved metadata for immediate playback & rendering
  resolvedSong?: Song;
  resolvedProgramAudio?: ProgramAudio;
}

export interface ProgramWithItems extends Program {
  items: ProgramItem[];
}

