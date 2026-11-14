import React from 'react';
import { Play, Pause, Disc3, ChevronUp } from 'lucide-react';
import { Song } from '../../types';
import { cn } from '../../utils';

export interface MiniPlayerProps {
  song: Song | null;
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  onTogglePlay: () => void;
  onExpand: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  song,
  isPlaying,
  isLoadingAudio = false,
  onTogglePlay,
  onExpand,
}) => {
  if (!song) return null;

  return (
    <aside
      aria-label="Audio player mini bar"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 px-3 pb-1.5 transition-all duration-200 pointer-events-auto"
    >
      <div className="max-w-md mx-auto bg-canvas-card/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-card px-3.5 py-2.5 flex items-center justify-between gap-3">
        {/* Clickable song info to expand */}
        <div
          onClick={onExpand}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        >
          {/* Animated or static disc icon */}
          <div className="w-10 h-10 rounded-xl bg-sage-light text-sage flex items-center justify-center flex-shrink-0">
            <Disc3 className={cn('w-5 h-5', isPlaying && 'animate-[spin_4s_linear_infinite]')} />
          </div>

          <div className="min-w-0 flex-1 text-left">
            <h4 className="text-sm font-semibold text-charcoal truncate">{song.title}</h4>
            <p className="text-xs text-charcoal-muted truncate">
              {song.ragam || song.category} {song.talam ? `• ${song.talam}` : ''}
            </p>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onTogglePlay}
            disabled={isLoadingAudio}
            aria-label={isPlaying ? 'Pause song' : 'Play song'}
            className="w-10 h-10 rounded-full bg-sage text-canvas flex items-center justify-center hover:bg-sage-hover active:scale-95 transition-transform shadow-subtle focus:outline-none disabled:opacity-75"
          >
            {isLoadingAudio ? (
              <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onExpand}
            aria-label="Open full player"
            className="w-9 h-9 rounded-full text-charcoal-muted hover:text-charcoal flex items-center justify-center hover:bg-canvas-subtle transition-colors focus:outline-none"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

