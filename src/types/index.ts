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

  // Legacy / download status compatibility
  isDownloaded?: boolean;
  fileName?: string;
  mimeType?: string;
  uploadedBy?: string;
  uploadedByName?: string;
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
