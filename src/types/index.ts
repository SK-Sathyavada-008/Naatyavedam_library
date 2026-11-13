export type UserRole = 'TEACHER' | 'STUDENT';

export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
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

export interface Song {
  id: string;
  title: string;
  ragam?: string;
  talam?: string;
  composer?: string;
  category: DanceCategory;
  duration: number; // in seconds
  fileSize: number; // in bytes
  fileName: string;
  mimeType: string;
  audioUrl?: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isDownloaded: boolean;
  isDeleted: boolean;
  deletedAt?: string;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLooping: boolean;
  playbackRate: number;
}

export type AppView =
  | 'welcome'
  | 'login'
  | 'register'
  | 'library'
  | 'player'
  | 'settings';

export type NavigationTab = 'library' | 'favorites' | 'player' | 'settings';

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
