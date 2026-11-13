import { useState, useEffect, useRef, useCallback } from 'react';
import { Song, PlayerState } from '../types';
import { getSongAudioBlob } from '../services/db';

export interface UseAudioPlayerReturn extends PlayerState {
  playSong: (song: Song) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleLoop: () => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  clearError: () => void;
}

export function useAudioPlayer(
  playlist: Song[],
  onSongChange?: (newSong: Song) => void
): UseAudioPlayerReturn {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const isLoopingRef = useRef<boolean>(false);
  isLoopingRef.current = isLooping;

  // Revoke active object URL cleanly to prevent memory leaks
  const revokeActiveUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoadingAudio(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleWaiting = () => setIsLoadingAudio(true);
    const handleCanPlay = () => setIsLoadingAudio(false);

    const handleError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      const code = audio.error ? audio.error.code : 'unknown';
      setAudioError(`Audio error occurred (code ${code}). File may be corrupted or format unsupported.`);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      revokeActiveUrl();
    };
  }, [revokeActiveUrl]);

  // Handle track ending
  const nextSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    const activeList = playlist.filter((s) => !s.isDeleted);
    const currentIndex = activeList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1 && activeList.length > 0) {
      const nextIndex = (currentIndex + 1) % activeList.length;
      const nextTrack = activeList[nextIndex];
      if (onSongChange) onSongChange(nextTrack);
    }
  }, [currentSong, playlist, onSongChange]);

  const prevSong = useCallback(() => {
    if (!currentSong || playlist.length === 0) return;
    const activeList = playlist.filter((s) => !s.isDeleted);
    const currentIndex = activeList.findIndex((s) => s.id === currentSong.id);
    if (currentIndex !== -1 && activeList.length > 0) {
      const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
      const prevTrack = activeList[prevIndex];
      if (onSongChange) onSongChange(prevTrack);
    }
  }, [currentSong, playlist, onSongChange]);

  // Hook track ended event to loop or advance
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (isLoopingRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextSong();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [nextSong]);

  // Load and play a song
  const playSong = useCallback(
    async (song: Song) => {
      const audio = audioRef.current;
      if (!audio) return;

      setAudioError(null);
      setIsLoadingAudio(true);
      setCurrentSong(song);
      setCurrentTime(0);
      setDuration(song.duration || 0);

      // Clean up previous blob URL
      revokeActiveUrl();

      try {
        // Fetch raw audio blob from IndexedDB
        const blob = await getSongAudioBlob(song.id);

        if (!blob) {
          setIsLoadingAudio(false);
          setAudioError(`Audio for "${song.title}" is missing from local storage.`);
          return;
        }

        // Create fresh object URL
        const objectUrl = URL.createObjectURL(blob);
        activeObjectUrlRef.current = objectUrl;

        audio.src = objectUrl;
        audio.playbackRate = playbackRate;
        audio.volume = volume;

        await audio.play();
        setIsPlaying(true);
        setIsLoadingAudio(false);
      } catch (err: unknown) {
        setIsLoadingAudio(false);
        setIsPlaying(false);
        if (err instanceof Error && err.name !== 'AbortError') {
          setAudioError(err.message || 'Unable to play selected audio');
        }
      }
    },
    [playbackRate, volume, revokeActiveUrl]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      if (playlist.length > 0) {
        const firstTrack = playlist.find((s) => !s.isDeleted) || playlist[0];
        playSong(firstTrack);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        setAudioError(err instanceof Error ? err.message : 'Failed to play audio');
      });
    }
  }, [currentSong, isPlaying, playlist, playSong]);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        setAudioError(err instanceof Error ? err.message : 'Failed to play audio');
      });
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const skipForward = useCallback(
    (seconds = 10) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime + seconds);
    },
    [seek]
  );

  const skipBackward = useCallback(
    (seconds = 10) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime - seconds);
    },
    [seek]
  );

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(val, 1));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const clearError = useCallback(() => {
    setAudioError(null);
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLooping,
    playbackRate,
    isLoadingAudio,
    audioError,
    playSong,
    togglePlay,
    pause,
    resume,
    seek,
    setVolume,
    setPlaybackRate,
    toggleLoop,
    skipForward,
    skipBackward,
    nextSong,
    prevSong,
    clearError,
  };
}
