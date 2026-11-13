import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Heart,
  Share2,
  Download,
  CheckCircle,
  Disc3,
  Gauge,
} from 'lucide-react';
import { Song, AppView } from '../types';
import { Badge } from '../components/ui/Badge';
import { formatDuration, cn } from '../utils';

export interface PlayerPageProps {
  song: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  onToggleFavorite: (songId: string) => void;
  onNavigate: (view: AppView) => void;
}

export const PlayerPage: React.FC<PlayerPageProps> = ({
  song,
  isPlaying,
  onTogglePlay,
  onNextSong,
  onPrevSong,
  onToggleFavorite,
  onNavigate,
}) => {
  const [progress, setProgress] = useState(42); // 42% for demo state
  const [isLooping, setIsLooping] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);

  if (!song) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Disc3 className="w-16 h-16 text-charcoal-subtle mb-4" />
        <h3 className="text-lg font-semibold text-charcoal">No song playing</h3>
        <p className="text-sm text-charcoal-muted mt-1 max-w-xs">
          Select any composition from your dance library to start practicing.
        </p>
        <button
          onClick={() => onNavigate('library')}
          className="mt-6 px-4 py-2.5 rounded-xl bg-sage text-canvas text-sm font-semibold hover:bg-sage-hover"
        >
          Go to Library
        </button>
      </div>
    );
  }

  const currentTime = Math.floor((song.duration * progress) / 100);

  const cycleSpeed = () => {
    const speeds = [0.8, 0.9, 1.0, 1.1, 1.25];
    const currentIndex = speeds.indexOf(speed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeed(nextSpeed);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(Number(e.target.value));
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full min-h-screen">
      {/* Top Bar with Down Chevron to Collapse */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => onNavigate('library')}
          aria-label="Back to Library"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-charcoal hover:bg-canvas-subtle active:scale-95 transition-all"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center">
          <span className="text-[11px] font-semibold tracking-wider text-sage uppercase">
            Now Practicing
          </span>
          <p className="text-xs text-charcoal-muted font-medium truncate max-w-[200px]">
            {song.category} Repertoire
          </p>
        </div>

        <button
          onClick={() => onToggleFavorite(song.id)}
          aria-label={song.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95',
            song.isFavorite ? 'text-red-500' : 'text-charcoal-subtle hover:text-charcoal'
          )}
        >
          <Heart className={cn('w-5 h-5', song.isFavorite && 'fill-current')} />
        </button>
      </div>

      {/* Center Artwork / Rhythm Disc */}
      <div className="my-auto py-6 flex flex-col items-center">
        <div
          className={cn(
            'relative w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-gradient-to-tr from-[#3D5244] to-[#5E7A68] p-4 shadow-card flex items-center justify-center transition-transform duration-500',
            isPlaying && 'shadow-modal'
          )}
        >
          {/* Subtle concentric sound grooves */}
          <div className="absolute inset-5 rounded-full border border-canvas/20 pointer-events-none" />
          <div className="absolute inset-12 rounded-full border border-canvas/15 pointer-events-none" />
          <div className="absolute inset-20 rounded-full border border-canvas/10 pointer-events-none" />

          {/* Center spindle label */}
          <div
            className={cn(
              'w-24 h-24 rounded-full bg-canvas-card border-4 border-canvas flex flex-col items-center justify-center text-center p-2 shadow-inner',
              isPlaying && 'animate-[spin_12s_linear_infinite]'
            )}
          >
            <div className="w-4 h-4 rounded-full bg-charcoal mb-1" />
            <span className="text-[9px] font-bold text-sage uppercase tracking-wider">
              {song.category}
            </span>
          </div>
        </div>

        {/* Track Details */}
        <div className="text-center mt-6 w-full px-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-charcoal truncate">
            {song.title}
          </h2>

          <div className="flex items-center justify-center gap-2 mt-2">
            {song.ragam && (
              <Badge variant="sage" size="md">
                {song.ragam}
              </Badge>
            )}
            {song.talam && (
              <span className="text-xs font-medium text-charcoal-muted">
                Talam: {song.talam}
              </span>
            )}
          </div>

          {song.composer && (
            <p className="text-xs text-charcoal-subtle mt-1">
              Composer: {song.composer}
            </p>
          )}

          {/* Offline check badge */}
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-sage font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Available Offline</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls Section */}
      <div className="pb-8 space-y-4">
        {/* Scrubber Progress Bar */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full h-1.5 bg-canvas-subtle rounded-lg appearance-none cursor-pointer accent-sage"
          />
          <div className="flex items-center justify-between text-xs text-charcoal-muted font-medium px-0.5">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(song.duration)}</span>
          </div>
        </div>

        {/* Primary Playback Control Buttons */}
        <div className="flex items-center justify-between px-2 pt-2">
          {/* Replay 10 seconds */}
          <button
            onClick={() => setProgress(Math.max(0, progress - 5))}
            aria-label="Rewind 10 seconds"
            className="w-11 h-11 rounded-full flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Previous song */}
          <button
            onClick={onPrevSong}
            aria-label="Previous track"
            className="w-12 h-12 rounded-full flex items-center justify-center text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Main Play / Pause Button (large 64px) */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-16 h-16 rounded-full bg-sage text-canvas flex items-center justify-center hover:bg-sage-hover active:scale-95 transition-all shadow-card"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next song */}
          <button
            onClick={onNextSong}
            aria-label="Next track"
            className="w-12 h-12 rounded-full flex items-center justify-center text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Forward 10 seconds */}
          <button
            onClick={() => setProgress(Math.min(100, progress + 5))}
            aria-label="Forward 10 seconds"
            className="w-11 h-11 rounded-full flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* Practice Tools: Tempo / Speed & Loop */}
        <div className="flex items-center justify-around pt-3 border-t border-border/80">
          {/* Tempo Speed Control for Dance Practice */}
          <button
            onClick={cycleSpeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas-card border border-border text-xs font-semibold text-charcoal hover:border-sage transition-colors"
            title="Dance rehearsal speed"
          >
            <Gauge className="w-3.5 h-3.5 text-sage" />
            <span>{speed}x Tempo</span>
          </button>

          {/* Loop Mode for Jatiswaram practice */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
              isLooping
                ? 'bg-sage-light text-sage-hover border-sage-border'
                : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
            )}
            title="Repeat track"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Repeat</span>
          </button>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: song.title,
                  text: `Practicing ${song.title} (${song.category})`,
                }).catch(() => {});
              } else {
                alert(`Share link for ${song.title}`);
              }
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-colors"
            title="Share track"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Download toggle */}
          <button
            onClick={() => alert(`"${song.title}" is saved for offline rehearsals.`)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sage hover:bg-canvas-subtle transition-colors"
            title="Offline saved"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
