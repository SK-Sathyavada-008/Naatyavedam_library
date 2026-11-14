import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ActivityPage } from './pages/ActivityPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { AppView, Song, UserProfile, UserRole, ActivityLogEntry } from './types';
import {
  getLocalSongs,
  getRecoveryBinSongs,
  toggleSongFavorite,
  renameSong,
  deleteLocalSong,
  restoreLocalSong,
  bulkDeleteSongs,
  bulkFavoriteSongs,
  saveSongWithBlob,
  getSongAudioBlob,
  getAppSetting,
  setAppSetting,
} from './services/db';
import {
  uploadSongToCloud,
  cloudRenameSong,
  cloudSoftDeleteSong,
  cloudRestoreSong,
  fetchSharedCloudLibrary,
  fetchCloudRecoveryBin,
  fetchSharedActivityLogs,
  recordDeviceActivity,
} from './services/cloudLibrary';
import {
  syncAll,
  downloadTrack,
  downloadTracksBatch,
  downloadEntireRepertoire,
  queueOfflineOperation,
  subscribeToSyncState,
  getSyncState,
} from './services/syncManager';
import { supabase } from './lib/supabase';
import { importAudioFiles } from './services/audioImporter';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { generateClassicalMelodyWav } from './utils/audioGenerator';
import { MOCK_TEACHER_USER, MOCK_STUDENT_USER } from './data/mockDanceMusic';
import { revalidateSession, signOutUser } from './services/auth';
import {
  getPendingSharedFiles,
  clearAllSharedFiles,
  type IncomingSharedFileRecord,
} from './services/shareTarget';
import { IncomingShareModal } from './components/pwa/IncomingShareModal';
import { InstallModal } from './components/pwa/InstallModal';
import { usePwaInstall } from './hooks/usePwaInstall';
import { extractAudioDuration } from './services/audioImporter';
import type { SyncState, DownloadBatchProgress, DanceCategory } from './types';

export const App: React.FC = () => {
  // Navigation & Authentication state
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [revocationMessage, setRevocationMessage] = useState<string | null>(null);

  // IndexedDB Data State
  const [songs, setSongs] = useState<Song[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Song[]>([]);
  const [deletedSongs, setDeletedSongs] = useState<Song[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [isDbInitialized, setIsDbInitialized] = useState<boolean>(false);

  // Import State
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);
  const [importFailures, setImportFailures] = useState<{ fileName: string; reason: string }[]>([]);

  // Connectivity & Synchronization
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [downloadBatchProgress, setDownloadBatchProgress] = useState<DownloadBatchProgress | null>(null);

  // Incoming PWA Share Target & Installation State
  const [incomingSharedFiles, setIncomingSharedFiles] = useState<IncomingSharedFileRecord[]>([]);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const pwaInstall = usePwaInstall();

  // Check for any incoming shared files from Android Share Target (e.g. WhatsApp, Files)
  const checkIncomingShares = useCallback(async () => {
    try {
      const pending = await getPendingSharedFiles();
      if (pending && pending.length > 0) {
        setIncomingSharedFiles(pending);
        if (window.location.search.includes('incoming_share')) {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
      }
    } catch (err) {
      console.warn('[PWA Share Target] Error checking incoming files:', err);
    }
  }, []);

  // Listen for app focus/visibility or initial mount to process incoming shares
  useEffect(() => {
    checkIncomingShares();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkIncomingShares();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkIncomingShares);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkIncomingShares);
    };
  }, [checkIncomingShares]);

  // Subscribe to sync state updates
  useEffect(() => {
    return subscribeToSyncState(setSyncState);
  }, []);

  // Load songs & recovery bin from IndexedDB and sync with shared cloud collection
  const refreshLibraryFromDB = useCallback(async (currentUser?: UserProfile | null) => {
    try {
      const activeUser = currentUser !== undefined ? currentUser : user;
      // 1. If online and approved user, fetch shared cloud library
      if (navigator.onLine && activeUser && activeUser.status === 'APPROVED') {
        const cloudActiveSongs = await fetchSharedCloudLibrary(activeUser);
        const cloudBinSongs = await fetchCloudRecoveryBin();
        const logs = await fetchSharedActivityLogs();
        setSongs(cloudActiveSongs);
        setDeletedSongs(cloudBinSongs);
        if (logs.length > 0) {
          setActivityLogs(logs);
        }
        await recordDeviceActivity(activeUser);
        return;
      }

      // 2. Offline / local fallback
      const activeSongs = await getLocalSongs();
      const binSongs = await getRecoveryBinSongs();
      setSongs(activeSongs);
      setDeletedSongs(binSongs);
    } catch (err) {
      console.error('Failed to load songs from IndexedDB/Cloud:', err);
      const activeSongs = await getLocalSongs();
      const binSongs = await getRecoveryBinSongs();
      setSongs(activeSongs);
      setDeletedSongs(binSongs);
    }
  }, [user]);

  // Audio Player Hook (Playing REAL audio from IndexedDB, synchronized with active filtered & sorted list)
  const currentQueue = activePlaylist.length > 0 ? activePlaylist : songs;
  const player = useAudioPlayer(currentQueue, (newSong) => {
    player.playSong(newSong);
  });

  // Revalidate live session with backend
  const checkLiveSession = useCallback(async (localUser: UserProfile | null) => {
    if (!navigator.onLine) return; // Keep offline session if device has no network

    try {
      const backendProfile = await revalidateSession();

      if (backendProfile) {
        setUser(backendProfile);
        await setAppSetting('currentUser', backendProfile);
      } else if (localUser) {
        // Session was revoked or student was removed/rejected
        console.warn('[Auth] Session revoked or invalid. Logging out.');
        setUser(null);
        await setAppSetting('currentUser', null);
        setRevocationMessage('Your account access has been revoked or your session has expired.');
        setCurrentView('login');
      }
    } catch (err) {
      console.error('[Auth] Error revalidating session:', err);
    }
  }, []);

  // Initial load from IndexedDB and persistent user session
  useEffect(() => {
    async function init() {
      // 1. Restore saved user session if exists
      const savedUser = await getAppSetting<UserProfile | null>('currentUser', null);
      if (savedUser) {
        setUser(savedUser);
        if (savedUser.status === 'APPROVED') {
          setCurrentView('library');
        }
      }

      // 2. Load songs from Dexie
      await refreshLibraryFromDB();
      setIsDbInitialized(true);

      // 3. Verify session status with Supabase backend
      await checkLiveSession(savedUser);
    }
    init();
  }, [refreshLibraryFromDB, checkLiveSession]);

  // Online / offline listeners & auto-sync when network returns or window becomes active
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      checkLiveSession(user);
      if (user && user.status === 'APPROVED') {
        await syncAll(user);
        await refreshLibraryFromDB(user);
      }
    };

    const handleOffline = () => setIsOnline(false);

    const handleVisibilityOrFocus = async () => {
      if (user && user.status === 'APPROVED' && navigator.onLine) {
        checkLiveSession(user);
        await syncAll(user);
        await refreshLibraryFromDB(user);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [user, checkLiveSession, refreshLibraryFromDB]);

  // Quick Demo / Local Login Handler
  const handleQuickLogin = async (role: UserRole) => {
    const profile = role === 'TEACHER' ? MOCK_TEACHER_USER : MOCK_STUDENT_USER;
    setUser(profile);
    await setAppSetting('currentUser', profile);
    setRevocationMessage(null);
    setCurrentView('library');
  };

  const handleLoginSuccess = async (profile: UserProfile) => {
    setUser(profile);
    await setAppSetting('currentUser', profile);
    setRevocationMessage(null);

    if (profile.status === 'APPROVED') {
      setCurrentView('library');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    await setAppSetting('currentUser', null);
    setRevocationMessage(null);
    player.pause();
    setCurrentView('welcome');
  };

  // Seed sample real playable classical audio blobs for immediate testing
  const handleLoadSampleRepertoire = async () => {
    setImportProgress({
      current: 1,
      total: 3,
      currentFileName: 'Synthesizing Kalyani Jatiswaram Practice WAV...',
    });

    try {
      // 1. Kalyani Jatiswaram (A3, C#4, E4, G#4)
      const blob1 = generateClassicalMelodyWav(16, [220, 277.18, 329.63, 415.3]);
      const song1: Song = {
        id: `sample_jati_${Date.now()}`,
        title: 'Kalyani Jatiswaram (Practice Speed)',
        originalFilename: 'kalyani_jatiswaram_practice.wav',
        fileType: 'audio/wav',
        fileSize: blob1.size,
        duration: 16,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        isFavorite: true,
        isLocalAvailable: true,
        syncStatus: 'local_only',
        ragam: 'Kalyani',
        talam: 'Rupaka',
        composer: 'Tanjore Quartet',
        category: 'Jatiswaram',
        isDeleted: false,
      };
      await saveSongWithBlob(song1, blob1);

      setImportProgress({
        current: 2,
        total: 3,
        currentFileName: 'Synthesizing Mohanam Tanpura Drone WAV...',
      });

      // 2. Mohanam Drone (A3, C#4, E4, F#4)
      const blob2 = generateClassicalMelodyWav(20, [220, 277.18, 329.63, 370]);
      const song2: Song = {
        id: `sample_drone_${Date.now() + 1}`,
        title: 'Mohanam Tanpura Drone (Sa-Pa-Sa)',
        originalFilename: 'mohanam_tanpura_drone.wav',
        fileType: 'audio/wav',
        fileSize: blob2.size,
        duration: 20,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
        isFavorite: true,
        isLocalAvailable: true,
        syncStatus: 'local_only',
        ragam: 'Mohanam',
        talam: 'Adi',
        category: 'Practice / Talam',
        isDeleted: false,
      };
      await saveSongWithBlob(song2, blob2);

      setImportProgress({
        current: 3,
        total: 3,
        currentFileName: 'Synthesizing Manduka Shabdam Chime WAV...',
      });

      // 3. Manduka Shabdam (A3, D4, E4)
      const blob3 = generateClassicalMelodyWav(14, [220, 293.66, 329.63]);
      const song3: Song = {
        id: `sample_shabdam_${Date.now() + 2}`,
        title: 'Manduka Shabdam (The Frog Legend)',
        originalFilename: 'manduka_shabdam_gajendra.wav',
        fileType: 'audio/wav',
        fileSize: blob3.size,
        duration: 14,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFavorite: false,
        isLocalAvailable: true,
        syncStatus: 'local_only',
        ragam: 'Ragamalika',
        talam: 'Misra Chapu',
        category: 'Shabdam',
        isDeleted: false,
      };
      await saveSongWithBlob(song3, blob3);

      await refreshLibraryFromDB();
    } catch (err) {
      console.error('Failed to load demo repertoire:', err);
    } finally {
      setImportProgress(null);
    }
  };

  // Import files from user's phone / computer
  const handleImportFiles = async (files: FileList | File[]) => {
    setImportFailures([]);
    const result = await importAudioFiles(files, (current, total, fileName) => {
      setImportProgress({ current, total, currentFileName: fileName });
    });

    setImportProgress(null);

    if (result.failures.length > 0) {
      setImportFailures(result.failures);
    }

    if (result.importedSongs.length > 0) {
      // 1. Process imported songs: if online, upload; if offline, queue persistent upload
      if (user && user.status === 'APPROVED') {
        if (navigator.onLine) {
          for (const s of result.importedSongs) {
            const blob = await getSongAudioBlob(s.id);
            if (blob) {
              await uploadSongToCloud(s, blob, user);
            }
          }
        } else {
          // Queue offline uploads so they automatically sync upon reconnection
          for (const s of result.importedSongs) {
            await queueOfflineOperation('UPLOAD', s.id, {
              title: s.title,
              originalFilename: s.originalFilename,
            });
          }
        }
      }

      await refreshLibraryFromDB();

      // If nothing is playing, load first imported song
      if (!player.currentSong) {
        player.playSong(result.importedSongs[0]);
      }
    }
  };

  // Confirm incoming shared audio tracks (from Android Share Target / WhatsApp)
  const handleConfirmIncomingShare = async (
    itemsWithMetadata: { file: Blob | File; title: string; category: DanceCategory }[]
  ) => {
    setImportProgress({
      current: 0,
      total: itemsWithMetadata.length,
      currentFileName: 'Importing shared audio tracks...',
    });

    try {
      for (let i = 0; i < itemsWithMetadata.length; i++) {
        const item = itemsWithMetadata[i];
        setImportProgress({
          current: i + 1,
          total: itemsWithMetadata.length,
          currentFileName: item.title,
        });

        const duration = await extractAudioDuration(item.file).catch(() => null);
        const songId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `shared_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const newSong: Song = {
          id: songId,
          title: item.title,
          originalFilename: item.file instanceof File ? item.file.name : `${item.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`,
          fileType: item.file.type || 'audio/mpeg',
          fileSize: item.file.size,
          duration: duration || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isFavorite: false,
          isLocalAvailable: true,
          syncStatus: 'local_only',
          ragam: 'Various',
          talam: 'Adi (8 beats)',
          composer: user?.fullName ? `Shared by ${user.fullName}` : 'Shared Audio',
          category: item.category,
          isDeleted: false,
          uploadedBy: user?.id,
          uploadedByName: user?.fullName || user?.username || 'member',
        };

        // 1. Save locally in IndexedDB first
        await saveSongWithBlob(newSong, item.file);

        // 2. If online and approved, upload to Supabase or queue offline operation
        if (navigator.onLine && user && user.status === 'APPROVED') {
          try {
            const uploadRes = await uploadSongToCloud(newSong, item.file, user);
            if (!uploadRes.success) {
              await queueOfflineOperation('UPLOAD', newSong.id, {
                title: newSong.title,
                category: newSong.category,
              });
            }
          } catch {
            await queueOfflineOperation('UPLOAD', newSong.id, {
              title: newSong.title,
              category: newSong.category,
            });
          }
        } else if (user && user.status === 'APPROVED') {
          await queueOfflineOperation('UPLOAD', newSong.id, {
            title: newSong.title,
            category: newSong.category,
          });
        }
      }

      // 3. Clear temporary incoming share IndexedDB store
      await clearAllSharedFiles();
      setIncomingSharedFiles([]);

      // 4. Refresh library state
      await refreshLibraryFromDB(user);
    } catch (err) {
      console.error('Failed to import shared audio tracks:', err);
    } finally {
      setImportProgress(null);
    }
  };

  const handleCancelIncomingShare = async () => {
    await clearAllSharedFiles();
    setIncomingSharedFiles([]);
  };

  // Rename song (Offline-first with cloud sync)
  const handleRenameSong = async (songId: string, newTitle: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;
    const oldTitle = target.title;

    if (navigator.onLine && user && user.status === 'APPROVED') {
      await cloudRenameSong(songId, newTitle, user);
    } else {
      await renameSong(songId, newTitle);
      if (user && user.status === 'APPROVED') {
        await queueOfflineOperation('RENAME', songId, { newTitle, oldTitle });
      }
    }
    await refreshLibraryFromDB();

    // If currently playing, update player's song reference
    if (player.currentSong?.id === songId) {
      player.playSong({ ...player.currentSong, title: newTitle });
    }
  };

  // Delete song (move to recovery bin / trash) - Allowed for both Teacher and Student
  const handleDeleteSong = async (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;

    // If playing this song, pause
    if (player.currentSong?.id === songId) {
      player.pause();
    }

    if (navigator.onLine && user && user.status === 'APPROVED') {
      await cloudSoftDeleteSong(songId, user);
    } else {
      await deleteLocalSong(songId, true);
      if (user && user.status === 'APPROVED') {
        await queueOfflineOperation('DELETE', songId, { title: target.title });
      }
    }
    await refreshLibraryFromDB();
  };

  // Restore song from recovery bin - Allowed for both Teacher and Student
  const handleRestoreSong = async (songId: string) => {
    const target = deletedSongs.find((s) => s.id === songId);
    if (!target) return;

    if (navigator.onLine && user && user.status === 'APPROVED') {
      await cloudRestoreSong(songId, user);
    } else {
      await restoreLocalSong(songId);
      if (user && user.status === 'APPROVED') {
        await queueOfflineOperation('RESTORE', songId, { title: target.title });
      }
    }
    await refreshLibraryFromDB();
  };

  // Download song from Supabase Storage for offline practice
  const handleDownloadSong = async (song: Song) => {
    await downloadTrack(song, user);
    await refreshLibraryFromDB();
  };

  // Bulk Download selected tracks
  const handleBulkDownload = async (songIds: string[]) => {
    const targetSongs = songs.filter((s) => songIds.includes(s.id) && !s.isLocalAvailable);
    if (targetSongs.length === 0) return;
    try {
      await downloadTracksBatch(targetSongs, user, (progress) => {
        setDownloadBatchProgress(progress);
      });
    } finally {
      setDownloadBatchProgress(null);
      await refreshLibraryFromDB();
    }
  };

  // Download entire repertoire for full offline capability
  const handleDownloadAll = async () => {
    try {
      await downloadEntireRepertoire(songs, user, (progress) => {
        setDownloadBatchProgress(progress);
      });
    } finally {
      setDownloadBatchProgress(null);
      await refreshLibraryFromDB();
    }
  };

  // Manual Sync trigger
  const handleManualSync = async () => {
    if (user && user.status === 'APPROVED' && navigator.onLine) {
      await syncAll(user);
      await refreshLibraryFromDB(user);
    }
  };

  // Permanent Delete Song - STRICTLY TEACHER ONLY
  const handlePermanentlyDeleteSong = async (songId: string) => {
    if (user?.role !== 'TEACHER') {
      alert('Unauthorized: Only the dance teacher can permanently delete songs from the repertoire.');
      return;
    }

    const target = deletedSongs.find((s) => s.id === songId);
    if (!target) return;

    if (player.currentSong?.id === songId) {
      player.pause();
    }

    await deleteLocalSong(songId, false);
    await refreshLibraryFromDB();
  };

  // Empty Recovery Bin - STRICTLY TEACHER ONLY
  const handleEmptyRecoveryBin = async () => {
    if (user?.role !== 'TEACHER') {
      alert('Unauthorized: Only the dance teacher can empty the recovery bin.');
      return;
    }

    const ids = deletedSongs.map((s) => s.id);
    if (ids.length === 0) return;

    await bulkDeleteSongs(ids, false);
    await refreshLibraryFromDB();
  };

  // Toggle favorite (Offline-first with cloud user_favorites sync)
  const handleToggleFavorite = async (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;
    const newStatus = !target.isFavorite;

    await toggleSongFavorite(songId);

    if (navigator.onLine && user && user.status === 'APPROVED') {
      try {
        if (newStatus) {
          await supabase.from('user_favorites').upsert({ user_id: user.id, song_id: songId });
        } else {
          await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('song_id', songId);
        }
      } catch (err) {
        console.warn('[Favorites] Cloud sync error:', err);
      }
    } else if (user && user.status === 'APPROVED') {
      await queueOfflineOperation('FAVORITE', songId, { isFavorite: newStatus });
    }

    await refreshLibraryFromDB();

    if (player.currentSong?.id === songId) {
      player.playSong({
        ...player.currentSong,
        isFavorite: newStatus,
      });
    }
  };

  // Bulk Delete (Moves to Recovery Bin)
  const handleBulkDelete = async (songIds: string[]) => {
    if (songIds.length === 0) return;
    if (player.currentSong && songIds.includes(player.currentSong.id)) {
      player.pause();
    }
    await bulkDeleteSongs(songIds, true);
    await refreshLibraryFromDB();

    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'DELETE',
      songId: songIds[0],
      songTitle: `${songIds.length} songs`,
      performedBy: user?.id || 'local',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: `Moved ${songIds.length} songs to Recovery Bin`,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Bulk Favorite / Unfavorite
  const handleBulkFavorite = async (songIds: string[], shouldFavorite: boolean) => {
    if (songIds.length === 0) return;
    await bulkFavoriteSongs(songIds, shouldFavorite);
    await refreshLibraryFromDB();
  };

  const handleRoleSwitch = async (newRole: UserRole) => {
    if (!user) return;
    const updatedUser: UserProfile = {
      ...user,
      role: newRole,
      fullName: newRole === 'TEACHER' ? 'Guru Veda' : user.username === 'sk' ? 'SK' : `${user.username} (Student)`,
    };
    setUser(updatedUser);
    await setAppSetting('currentUser', updatedUser);
  };

  if (!isDbInitialized) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-sage border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-charcoal">Loading Naatyavedam Library...</p>
        </div>
      </div>
    );
  }

  // If a logged-in user is PENDING approval, display the Pending Approval screen
  if (user && user.status === 'PENDING') {
    return (
      <PendingApprovalPage
        user={user}
        onApproved={async (updated) => {
          setUser(updated);
          await setAppSetting('currentUser', updated);
          setCurrentView('library');
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  // Render view
  const renderViewContent = () => {
    switch (currentView) {
      case 'welcome':
        return (
          <WelcomePage
            onNavigate={setCurrentView}
            onQuickLogin={handleQuickLogin}
          />
        );
      case 'login':
        return (
          <LoginPage
            onNavigate={setCurrentView}
            onLoginSuccess={handleLoginSuccess}
            revocationMessage={revocationMessage}
          />
        );
      case 'register':
        return <RegisterPage onNavigate={setCurrentView} />;
      case 'player':
        return (
          <PlayerPage
            song={player.currentSong}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            isLooping={player.isLooping}
            playbackRate={player.playbackRate}
            isLoadingAudio={player.isLoadingAudio}
            audioError={player.audioError}
            volume={player.volume}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onNextSong={player.nextSong}
            onPrevSong={player.prevSong}
            onToggleLoop={player.toggleLoop}
            onSetPlaybackRate={player.setPlaybackRate}
            onSetVolume={player.setVolume}
            onToggleFavorite={handleToggleFavorite}
            onNavigate={setCurrentView}
            onClearError={player.clearError}
          />
        );
      case 'programs':
        return (
          <ProgramsPage
            user={user}
            librarySongs={songs}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            isLoadingAudio={player.isLoadingAudio}
            onPlaySong={player.playSong}
            onTogglePlay={player.togglePlay}
            onQueueChange={setActivePlaylist}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            user={user}
            onRoleSwitch={handleRoleSwitch}
            onSignOut={handleSignOut}
            deletedSongs={deletedSongs}
            activityLogs={activityLogs}
            onRestoreSong={handleRestoreSong}
            onPermanentlyDeleteSong={handlePermanentlyDeleteSong}
            onEmptyRecoveryBin={handleEmptyRecoveryBin}
            onOpenInstall={() => setIsInstallModalOpen(true)}
            isStandalone={pwaInstall.isInstalled}
            songs={songs}
            syncState={syncState}
            onManualSync={handleManualSync}
            onNavigate={setCurrentView}
            onLibraryRestored={() => refreshLibraryFromDB(user)}
          />
        );
      case 'activity':
        return (
          <ActivityPage
            activityLogs={activityLogs}
            librarySongs={songs}
            onPlaySong={player.playSong}
            onNavigate={setCurrentView}
            onRefreshLogs={() => refreshLibraryFromDB(user)}
          />
        );
      case 'library':
      default:
        return (
          <LibraryPage
            songs={songs}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            isLoadingAudio={player.isLoadingAudio}
            user={user}
            onPlaySong={player.playSong}
            onTogglePlay={player.togglePlay}
            onToggleFavorite={handleToggleFavorite}
            onDeleteSong={handleDeleteSong}
            onRenameSong={handleRenameSong}
            onImportFiles={handleImportFiles}
            onLoadSampleRepertoire={handleLoadSampleRepertoire}
            onBulkDelete={handleBulkDelete}
            onBulkFavorite={handleBulkFavorite}
            onActiveListChange={setActivePlaylist}
            importProgress={importProgress}
            importFailures={importFailures}
            onClearImportFailures={() => setImportFailures([])}
            onDownloadSong={handleDownloadSong}
            onBulkDownload={handleBulkDownload}
            onDownloadAll={handleDownloadAll}
            downloadBatchProgress={downloadBatchProgress}
            syncState={syncState}
            onManualSync={handleManualSync}
            isOnline={isOnline}
            showInstallBanner={!pwaInstall.isInstalled && !pwaInstall.isDismissed}
            onInstallPrompt={() => setIsInstallModalOpen(true)}
            onDismissInstallBanner={pwaInstall.dismissInstall}
          />
        );
    }
  };

  return (
    <>
      <AppLayout
        currentView={currentView}
        onNavigate={setCurrentView}
        user={user}
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        isLoadingAudio={player.isLoadingAudio}
        onTogglePlay={player.togglePlay}
        isOnline={isOnline}
      >
        {renderViewContent()}
      </AppLayout>

      {/* Incoming Share Modal from Android Web Share Target */}
      {incomingSharedFiles.length > 0 && (
        <IncomingShareModal
          isOpen={incomingSharedFiles.length > 0}
          items={incomingSharedFiles}
          onConfirmImport={handleConfirmIncomingShare}
          onCancel={handleCancelIncomingShare}
        />
      )}

      {/* PWA Installation Guidance Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        canInstall={pwaInstall.canInstall}
        onPromptInstall={pwaInstall.promptInstall}
      />
    </>
  );
};
