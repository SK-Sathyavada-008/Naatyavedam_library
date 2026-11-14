import React from 'react';
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
  CheckCircle,
  Disc3,
  Gauge,
  AlertCircle,
  Volume2,
  VolumeX,
  Cloud,
  Download,
} from 'lucide-react';
import { Song, AppView } from '../types';
import { Badge } from '../components/ui/Badge';
import { formatDuration, cn } from '../utils';
import { shareSongAudio } from '../services/audioShare';

export interface PlayerPageProps {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  playbackRate: number;
  isLoadingAudio?: boolean;
  audioError?: string | null;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  onToggleLoop: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSetVolume: (vol: number) => void;
  onToggleFavorite: (songId: string) => void;
  onNavigate: (view: AppView) => void;
  onClearError?: () => void;
  onDownloadSong?: (song: Song) => Promise<void>;
  onRemoveOfflineDownload?: (songId: string) => Promise<void>;
}

export const PlayerPage: React.FC<PlayerPageProps> = ({
  song,
  isPlaying,
  currentTime,
  duration,
  isLooping,
  playbackRate,
  isLoadingAudio = false,
  audioError,
  volume,
  onTogglePlay,
  onSeek,
  onNextSong,
  onPrevSong,
  onToggleLoop,
  onSetPlaybackRate,
  onSetVolume,
  onToggleFavorite,
  onNavigate,
  onClearError,
  onDownloadSong,
  onRemoveOfflineDownload,
}) => {
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

  const cycleSpeed = () => {
    const speeds = [0.8, 0.9, 1.0, 1.1, 1.25];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    onSetPlaybackRate(nextSpeed);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = Number(e.target.value);
    onSeek(newSec);
  };

  const effectiveDuration = duration || song.duration || 0;

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto w-full min-h-[calc(100vh-6rem)]">
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
            {song.category || 'Kuchipudi Repertoire'}
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
          <Heart className={cn('w-5 h-5', song.isFavorite && 'fill-current text-red-500')} />
        </button>
      </div>

      {/* Audio Error Alert if any */}
      {audioError && (
        <div className="my-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{audioError}</span>
          </div>
          {onClearError && (
            <button onClick={onClearError} className="font-bold ml-2">
              ×
            </button>
          )}
        </div>
      )}

      {/* Center Artwork / Rhythm Disc */}
      <div className="my-auto py-4 flex flex-col items-center">
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
              isPlaying && 'animate-[spin_10s_linear_infinite]'
            )}
          >
            <div className="w-4 h-4 rounded-full bg-charcoal mb-1" />
            <span className="text-[9px] font-bold text-sage uppercase tracking-wider truncate max-w-[80px]">
              {song.category || 'Natyam'}
            </span>
          </div>
        </div>

        {/* Track Details */}
        <div className="text-center mt-6 w-full px-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-charcoal truncate" title={song.title}>
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

          <p className="text-xs text-charcoal-subtle mt-1 truncate">
            {song.originalFilename}
          </p>

          {/* Offline / Cloud Status & Storage Management */}
          {song.isLocalAvailable ? (
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-sage font-medium bg-sage-light/50 px-2.5 py-0.5 rounded-full border border-sage/30">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Available Offline</span>
              </span>
              {onRemoveOfflineDownload && song.storagePath && (
                <button
                  onClick={() => {
                    if (confirm(`Remove downloaded audio for "${song.title}" from this device to free up storage?\n\n• The song remains in your library and cloud.\n• You can stream it online or re-download anytime.`)) {
                      onRemoveOfflineDownload(song.id);
                    }
                  }}
                  className="text-[11px] text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-full transition-colors font-medium"
                  title="Free device storage by removing offline file"
                >
                  Free Device Space
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-charcoal-muted font-medium bg-canvas-subtle px-2.5 py-0.5 rounded-full border border-border">
                <Cloud className="w-3.5 h-3.5 text-sage-hover" />
                <span>Streaming Online</span>
              </span>
              {onDownloadSong && song.storagePath && (
                <button
                  onClick={() => onDownloadSong(song)}
                  className="flex items-center gap-1 text-[11px] text-sage hover:text-sage-hover bg-sage-light/60 hover:bg-sage-light border border-sage-border px-2 py-0.5 rounded-full transition-colors font-semibold"
                  title="Download to IndexedDB for offline rehearsals"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Track</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Section */}
      <div className="pb-8 space-y-4">
        {/* Scrubber Progress Bar */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            step={0.5}
            value={currentTime}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-canvas-subtle rounded-lg appearance-none cursor-pointer accent-sage"
            aria-label="Seek time"
          />
          <div className="flex items-center justify-between text-xs text-charcoal-muted font-medium px-0.5">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(effectiveDuration))}</span>
          </div>
        </div>

        {/* Primary Playback Control Buttons */}
        <div className="flex items-center justify-between px-2 pt-1">
          {/* Rewind 10 seconds */}
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            aria-label="Rewind 10 seconds"
            className="w-11 h-11 rounded-full flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
            title="Rewind 10s"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Previous song */}
          <button
            onClick={onPrevSong}
            aria-label="Previous track"
            className="w-12 h-12 rounded-full flex items-center justify-center text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
            title="Previous song"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Main Play / Pause Button (large 64px) */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoadingAudio}
            className="w-16 h-16 rounded-full bg-sage text-canvas flex items-center justify-center hover:bg-sage-hover active:scale-95 transition-all shadow-card disabled:opacity-75"
          >
            {isLoadingAudio ? (
              <div className="w-6 h-6 border-3 border-canvas border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
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
            title="Next song"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Forward 10 seconds */}
          <button
            onClick={() => onSeek(Math.min(effectiveDuration, currentTime + 10))}
            aria-label="Forward 10 seconds"
            className="w-11 h-11 rounded-full flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-all active:scale-95"
            title="Forward 10s"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* Practice Tools: Tempo / Speed, Loop & Volume */}
        <div className="flex items-center justify-around pt-3 border-t border-border/80">
          {/* Tempo Speed Control for Dance Practice */}
          <button
            onClick={cycleSpeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas-card border border-border text-xs font-semibold text-charcoal hover:border-sage transition-colors"
            title="Dance rehearsal speed"
          >
            <Gauge className="w-3.5 h-3.5 text-sage" />
            <span>{playbackRate}x Tempo</span>
          </button>

          {/* Loop Mode for Jatiswaram practice */}
          <button
            onClick={onToggleLoop}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
              isLooping
                ? 'bg-sage-light text-sage-hover border-sage-border'
                : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
            )}
            title="Repeat track"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{isLooping ? 'Looping' : 'Repeat'}</span>
          </button>

          {/* Volume toggle (Mute / Unmute) */}
          <button
            onClick={() => onSetVolume(volume > 0 ? 0 : 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-colors"
            title={volume > 0 ? 'Mute' : 'Unmute'}
          >
            {volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-500" />}
          </button>

          {/* Share actual audio file */}
          <button
            onClick={async () => {
              const res = await shareSongAudio(song);
              if (res.fallbackDownloaded) {
                alert(`Direct native file sharing is not supported by your current browser. We downloaded "${song.title}" to your device instead so you can send it via WhatsApp or Files.`);
              } else if (!res.success && res.error && res.error !== 'Share was dismissed.') {
                alert(res.error);
              }
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle transition-colors"
            title="Share audio track"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
