import React from 'react';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';
import { MiniPlayer } from '../player/MiniPlayer';
import { UserProfile, AppView, Song } from '../../types';
import { cn } from '../../utils';

export interface AppLayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: UserProfile | null;
  currentSong: Song | null;
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  onTogglePlay: () => void;
  isOnline?: boolean;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  onNavigate,
  user,
  currentSong,
  isPlaying,
  isLoadingAudio = false,
  onTogglePlay,
  isOnline = true,
  children,
}) => {
  // Hide navigation headers/bars on pure auth screens (welcome, login, register)
  const isAuthScreen = currentView === 'welcome' || currentView === 'login' || currentView === 'register';
  const isFullScreenPlayer = currentView === 'player';

  return (
    <div className="min-h-screen bg-canvas text-charcoal flex flex-col antialiased">
      {/* Top Header (visible on non-auth screens) */}
      {!isAuthScreen && !isFullScreenPlayer && (
        <TopHeader
          user={user}
          onNavigate={onNavigate}
          isOnline={isOnline}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 w-full max-w-2xl mx-auto flex flex-col',
          // Give padding at bottom if bottom nav or mini player is visible
          !isAuthScreen && !isFullScreenPlayer && 'pb-28 sm:pb-32',
          isFullScreenPlayer && 'h-screen'
        )}
      >
        {children}
      </main>

      {/* Mini Player (visible when track exists and not on player/auth view) */}
      {!isAuthScreen && !isFullScreenPlayer && currentSong && (
        <MiniPlayer
          song={currentSong}
          isPlaying={isPlaying}
          isLoadingAudio={isLoadingAudio}
          onTogglePlay={onTogglePlay}
          onExpand={() => onNavigate('player')}
        />
      )}

      {/* Bottom Navigation (visible on main app screens) */}
      {!isAuthScreen && !isFullScreenPlayer && (
        <BottomNav
          currentView={currentView}
          onNavigate={onNavigate}
          hasActiveTrack={Boolean(currentSong)}
        />
      )}
    </div>
  );
};

