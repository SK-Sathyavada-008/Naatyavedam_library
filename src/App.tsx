import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SettingsPage } from './pages/SettingsPage';
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
  getAppSetting,
  setAppSetting,
} from './services/db';
import { importAudioFiles } from './services/audioImporter';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { generateClassicalMelodyWav } from './utils/audioGenerator';
import { MOCK_TEACHER_USER, MOCK_STUDENT_USER } from './data/mockDanceMusic';

export const App: React.FC = () => {
  // Navigation & Authentication state
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [user, setUser] = useState<UserProfile | null>(null);

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

  // Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Load songs & recovery bin from IndexedDB
  const refreshLibraryFromDB = useCallback(async () => {
    try {
      const activeSongs = await getLocalSongs();
      const binSongs = await getRecoveryBinSongs();
      setSongs(activeSongs);
      setDeletedSongs(binSongs);
    } catch (err) {
      console.error('Failed to load songs from IndexedDB:', err);
    }
  }, []);

  // Audio Player Hook (Playing REAL audio from IndexedDB, synchronized with active filtered & sorted list)
  const currentQueue = activePlaylist.length > 0 ? activePlaylist : songs;
  const player = useAudioPlayer(currentQueue, (newSong) => {
    player.playSong(newSong);
  });

  // Initial load from IndexedDB and persistent user session
  useEffect(() => {
    async function init() {
      // 1. Restore saved user session if exists
      const savedUser = await getAppSetting<UserProfile | null>('currentUser', null);
      if (savedUser) {
        setUser(savedUser);
        setCurrentView('library');
      }

      // 2. Load songs from Dexie
      await refreshLibraryFromDB();
      setIsDbInitialized(true);
    }
    init();
  }, [refreshLibraryFromDB]);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Quick Demo / Local Login Handler
  const handleQuickLogin = async (role: UserRole) => {
    const profile = role === 'TEACHER' ? MOCK_TEACHER_USER : MOCK_STUDENT_USER;
    setUser(profile);
    await setAppSetting('currentUser', profile);
    setCurrentView('library');
  };

  const handleLoginSuccess = async (role: UserRole, username: string) => {
    const profile: UserProfile = {
      id: role === 'TEACHER' ? 'teacher-001' : 'student-001',
      username,
      fullName: role === 'TEACHER' ? 'Guru Keerthana (Dance Teacher)' : `${username} (Student)`,
      role,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    };
    setUser(profile);
    await setAppSetting('currentUser', profile);
    setCurrentView('library');
  };

  const handleSignOut = async () => {
    setUser(null);
    await setAppSetting('currentUser', null);
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
      await refreshLibraryFromDB();

      // Log import activity
      const newLogs: ActivityLogEntry[] = result.importedSongs.map((s) => ({
        id: `act-${Date.now()}-${s.id}`,
        action: 'UPLOAD',
        songId: s.id,
        songTitle: s.title,
        performedBy: user?.id || 'local',
        performedByName: user?.fullName || 'User',
        timestamp: new Date().toISOString(),
        details: `Imported "${s.originalFilename}" (${s.category})`,
      }));
      setActivityLogs((prev) => [...newLogs, ...prev]);

      // If nothing is playing, load first imported song
      if (!player.currentSong) {
        player.playSong(result.importedSongs[0]);
      }
    }
  };

  // Rename song
  const handleRenameSong = async (songId: string, newTitle: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;
    const oldTitle = target.title;

    await renameSong(songId, newTitle);
    await refreshLibraryFromDB();

    // If currently playing, update player's song reference
    if (player.currentSong?.id === songId) {
      player.playSong({ ...player.currentSong, title: newTitle });
    }

    // Log activity
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'RENAME',
      songId,
      songTitle: newTitle,
      performedBy: user?.id || 'local',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: `Renamed from "${oldTitle}"`,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Delete song (move to recovery bin)
  const handleDeleteSong = async (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;

    // If playing this song, pause
    if (player.currentSong?.id === songId) {
      player.pause();
    }

    await deleteLocalSong(songId, true);
    await refreshLibraryFromDB();

    // Log activity
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'DELETE',
      songId: target.id,
      songTitle: target.title,
      performedBy: user?.id || 'local',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: 'Moved to Recovery Bin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Restore song from recovery bin
  const handleRestoreSong = async (songId: string) => {
    const target = deletedSongs.find((s) => s.id === songId);
    if (!target) return;

    await restoreLocalSong(songId);
    await refreshLibraryFromDB();

    // Log activity
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'RESTORE',
      songId: target.id,
      songTitle: target.title,
      performedBy: user?.id || 'local',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: 'Restored from Recovery Bin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Toggle favorite
  const handleToggleFavorite = async (songId: string) => {
    await toggleSongFavorite(songId);
    await refreshLibraryFromDB();

    if (player.currentSong?.id === songId) {
      player.playSong({
        ...player.currentSong,
        isFavorite: !player.currentSong.isFavorite,
      });
    }
  };

  // Bulk Delete
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
      fullName: newRole === 'TEACHER' ? 'Guru Keerthana (Dance Teacher)' : `${user.username} (Student)`,
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
      case 'settings':
        return (
          <SettingsPage
            user={user}
            onRoleSwitch={handleRoleSwitch}
            onSignOut={handleSignOut}
            deletedSongs={deletedSongs}
            activityLogs={activityLogs}
            onRestoreSong={handleRestoreSong}
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
          />
        );
    }
  };

  return (
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
  );
};
