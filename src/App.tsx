import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlayerPage } from './pages/PlayerPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppView, Song, UserProfile, UserRole, ActivityLogEntry } from './types';
import {
  SAMPLE_KUCHIPUDI_SONGS,
  MOCK_TEACHER_USER,
  MOCK_STUDENT_USER,
  SAMPLE_ACTIVITY_LOGS,
} from './data/mockDanceMusic';

export const App: React.FC = () => {
  // Navigation & Authentication state (Temporary Phase 1 development state)
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [user, setUser] = useState<UserProfile | null>(null);

  // Music Library state
  const [songs, setSongs] = useState<Song[]>(SAMPLE_KUCHIPUDI_SONGS);
  const [currentSong, setCurrentSong] = useState<Song | null>(SAMPLE_KUCHIPUDI_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(SAMPLE_ACTIVITY_LOGS);

  // Network Connectivity state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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
  const handleQuickLogin = (role: UserRole) => {
    const profile = role === 'TEACHER' ? MOCK_TEACHER_USER : MOCK_STUDENT_USER;
    setUser(profile);
    setCurrentView('library');
  };

  const handleLoginSuccess = (role: UserRole, username: string) => {
    const profile: UserProfile = {
      id: role === 'TEACHER' ? 'teacher-001' : 'student-001',
      username,
      fullName: role === 'TEACHER' ? 'Guru Keerthana (Dance Teacher)' : `${username} (Student)`,
      role,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    };
    setUser(profile);
    setCurrentView('library');
  };

  const handleSignOut = () => {
    setUser(null);
    setIsPlaying(false);
    setCurrentView('welcome');
  };

  const handleTogglePlay = () => {
    if (!currentSong && songs.length > 0) {
      setCurrentSong(songs[0]);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const handlePlaySong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleNextSong = () => {
    if (!currentSong) return;
    const activeList = songs.filter((s) => !s.isDeleted);
    const currentIndex = activeList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % activeList.length;
      setCurrentSong(activeList[nextIndex]);
      setIsPlaying(true);
    }
  };

  const handlePrevSong = () => {
    if (!currentSong) return;
    const activeList = songs.filter((s) => !s.isDeleted);
    const currentIndex = activeList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
      setCurrentSong(activeList[prevIndex]);
      setIsPlaying(true);
    }
  };

  const handleToggleFavorite = (songId: string) => {
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, isFavorite: !s.isFavorite } : s))
    );
    if (currentSong?.id === songId) {
      setCurrentSong((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleAddSong = (
    newSongData: Omit<Song, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'isDownloaded' | 'isDeleted'>
  ) => {
    const newSong: Song = {
      ...newSongData,
      id: `song-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
      isDownloaded: true,
      isDeleted: false,
    };

    setSongs((prev) => [newSong, ...prev]);

    // Add activity log
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'UPLOAD',
      songId: newSong.id,
      songTitle: newSong.title,
      performedBy: user?.id || 'unknown',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: `${newSong.category} • ${newSong.ragam || 'Classical'}`,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleDeleteSong = (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;

    setSongs((prev) =>
      prev.map((s) =>
        s.id === songId
          ? { ...s, isDeleted: true, deletedAt: new Date().toISOString() }
          : s
      )
    );

    // If current song is deleted, advance or stop
    if (currentSong?.id === songId) {
      setIsPlaying(false);
    }

    // Add activity log
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'DELETE',
      songId: target.id,
      songTitle: target.title,
      performedBy: user?.id || 'unknown',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: 'Moved to Recovery Bin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleRestoreSong = (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;

    setSongs((prev) =>
      prev.map((s) =>
        s.id === songId ? { ...s, isDeleted: false, deletedAt: undefined } : s
      )
    );

    // Add activity log
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'RESTORE',
      songId: target.id,
      songTitle: target.title,
      performedBy: user?.id || 'unknown',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: 'Restored from Recovery Bin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleRenameSong = (songId: string, newTitle: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;
    const oldTitle = target.title;

    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, title: newTitle } : s))
    );

    if (currentSong?.id === songId) {
      setCurrentSong((prev) => (prev ? { ...prev, title: newTitle } : null));
    }

    // Add activity log
    const newLog: ActivityLogEntry = {
      id: `act-${Date.now()}`,
      action: 'RENAME',
      songId: target.id,
      songTitle: newTitle,
      performedBy: user?.id || 'unknown',
      performedByName: user?.fullName || 'User',
      timestamp: new Date().toISOString(),
      details: `Renamed from "${oldTitle}"`,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    if (!user) return;
    setUser({
      ...user,
      role: newRole,
      fullName: newRole === 'TEACHER' ? 'Guru Keerthana (Dance Teacher)' : `${user.username} (Student)`,
    });
  };

  const deletedSongs = songs.filter((s) => s.isDeleted);

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
        return (
          <RegisterPage
            onNavigate={setCurrentView}
          />
        );
      case 'player':
        return (
          <PlayerPage
            song={currentSong}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onNextSong={handleNextSong}
            onPrevSong={handlePrevSong}
            onToggleFavorite={handleToggleFavorite}
            onNavigate={setCurrentView}
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
            currentSong={currentSong}
            isPlaying={isPlaying}
            user={user}
            onPlaySong={handlePlaySong}
            onTogglePlay={handleTogglePlay}
            onToggleFavorite={handleToggleFavorite}
            onAddSong={handleAddSong}
            onDeleteSong={handleDeleteSong}
            onRenameSong={handleRenameSong}
          />
        );
    }
  };

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={setCurrentView}
      user={user}
      currentSong={currentSong}
      isPlaying={isPlaying}
      onTogglePlay={handleTogglePlay}
      isOnline={isOnline}
    >
      {renderViewContent()}
    </AppLayout>
  );
};
