import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Play,
  Pause,
  Heart,
  Plus,
  MoreVertical,
  CheckCircle,
  FileMusic,
  Trash2,
  Share2,
  Edit2,
  ArrowUpDown,
  Music2,
  AlertCircle,
  Sparkles,
  CheckSquare,
  Square,
  Volume2,
  Download,
  Cloud,
  CloudDownload,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import type {
  Song,
  UserProfile,
  SortOption,
  DownloadBatchProgress,
  SyncState,
} from '../types/index.ts';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { HighlightedText } from '../components/ui/HighlightedText';
import { searchSongsFuzzy, type SearchResult } from '../services/fuzzySearch';
import { formatDuration, cn } from '../utils';

export interface LibraryPageProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  user: UserProfile | null;
  onPlaySong: (song: Song) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (songId: string) => void;
  onDeleteSong: (songId: string) => void;
  onRenameSong: (songId: string, newTitle: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
  onLoadSampleRepertoire: () => void;
  onBulkDelete?: (songIds: string[]) => void;
  onBulkFavorite?: (songIds: string[], shouldFavorite: boolean) => void;
  onActiveListChange?: (activeList: Song[]) => void;
  importProgress?: { current: number; total: number; currentFileName: string } | null;
  importFailures?: { fileName: string; reason: string }[];
  onClearImportFailures?: () => void;
  onDownloadSong?: (song: Song) => Promise<void>;
  onBulkDownload?: (songIds: string[]) => Promise<void>;
  onDownloadAll?: () => Promise<void>;
  downloadBatchProgress?: DownloadBatchProgress | null;
  syncState?: SyncState;
  onManualSync?: () => Promise<void>;
  isOnline?: boolean;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  songs,
  currentSong,
  isPlaying,
  isLoadingAudio = false,
  user: _user,
  onPlaySong,
  onTogglePlay,
  onToggleFavorite,
  onDeleteSong,
  onRenameSong,
  onImportFiles,
  onLoadSampleRepertoire,
  onBulkDelete,
  onBulkFavorite,
  onActiveListChange,
  importProgress,
  importFailures = [],
  onClearImportFailures,
  onDownloadSong,
  onBulkDownload,
  onDownloadAll,
  downloadBatchProgress,
  syncState,
  onManualSync,
  isOnline = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState<boolean>(false);

  // Modals & Action States
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<Song | null>(null);
  const [renameSongModalOpen, setRenameSongModalOpen] = useState(false);
  const [songToRename, setSongToRename] = useState<Song | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories = [
    'All',
    'Pushpanjali',
    'Jatiswaram',
    'Shabdam',
    'Varnam',
    'Keerthanam',
    'Tarangam',
    'Thillana',
    'Slokam',
  ];

  // Handle phone / browser file picker selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
      e.target.value = '';
    }
  };

  // 1. Filter out deleted songs & apply category/favorites filters
  const baseFilteredSongs = useMemo(() => {
    return songs.filter((song) => {
      if (song.isDeleted) return false;
      if (filterFavoritesOnly && !song.isFavorite) return false;
      if (selectedCategory !== 'All' && song.category !== selectedCategory) return false;
      return true;
    });
  }, [songs, filterFavoritesOnly, selectedCategory]);

  // 2. Apply Fuzzy Search using Fuse.js
  const searchResults: SearchResult[] = useMemo(() => {
    if (!searchQuery.trim()) {
      return baseFilteredSongs.map((song) => ({ song }));
    }
    return searchSongsFuzzy(baseFilteredSongs, searchQuery);
  }, [baseFilteredSongs, searchQuery]);

  // 3. Apply Sorting
  const finalSortedResults: SearchResult[] = useMemo(() => {
    const list = [...searchResults];

    // If active search query with Fuse, preserve fuzzy relevance scores unless explicitly sorted
    if (searchQuery.trim() && sortBy === 'recent') {
      return list; // Keep fuzzy ranking
    }

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.song.title.localeCompare(b.song.title);
        case 'title-desc':
          return b.song.title.localeCompare(a.song.title);
        case 'duration-desc':
          return (b.song.duration || 0) - (a.song.duration || 0);
        case 'duration-asc':
          return (a.song.duration || 0) - (b.song.duration || 0);
        case 'recent':
        default:
          return (
            new Date(b.song.createdAt).getTime() - new Date(a.song.createdAt).getTime()
          );
      }
    });
  }, [searchResults, sortBy, searchQuery]);

  // Synchronize active song list with player queue for next/prev navigation
  useEffect(() => {
    if (onActiveListChange) {
      const activeSongs = finalSortedResults.map((r) => r.song);
      onActiveListChange(activeSongs);
    }
  }, [finalSortedResults, onActiveListChange]);

  // Multi-Select Handlers
  const toggleSelectSong = (songId: string) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = finalSortedResults.map((r) => r.song.id);
    setSelectedSongIds(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedSongIds(new Set());
  };

  const handleExitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedSongIds(new Set());
  };

  const handleExecuteBulkFavorite = () => {
    if (selectedSongIds.size === 0) return;
    const ids = Array.from(selectedSongIds);
    // If all are favorites, unfavorite; otherwise favorite all
    const allAreFavorites = ids.every((id) => songs.find((s) => s.id === id)?.isFavorite);
    if (onBulkFavorite) {
      onBulkFavorite(ids, !allAreFavorites);
    }
    handleExitSelectMode();
  };

  const handleConfirmBulkDelete = () => {
    if (selectedSongIds.size === 0) return;
    const ids = Array.from(selectedSongIds);
    if (onBulkDelete) {
      onBulkDelete(ids);
    }
    setBulkDeleteModalOpen(false);
    handleExitSelectMode();
  };

  const handleExecuteBulkDownload = async () => {
    if (selectedSongIds.size === 0 || !onBulkDownload) return;
    const ids = Array.from(selectedSongIds);
    handleExitSelectMode();
    await onBulkDownload(ids);
  };

  // Undownloaded songs in shared cloud repertoire
  const undownloadedSongs = useMemo(() => {
    return songs.filter((s) => !s.isDeleted && !s.isLocalAvailable && s.storagePath);
  }, [songs]);

  const totalUndownloadedBytes = useMemo(() => {
    return undownloadedSongs.reduce((acc, s) => acc + (s.fileSize || 0), 0);
  }, [undownloadedSongs]);

  const [isDownloadAllModalOpen, setIsDownloadAllModalOpen] = useState(false);

  const handleOpenRename = (song: Song) => {
    setSelectedSongForMenu(null);
    setSongToRename(song);
    setRenameTitleInput(song.title);
    setRenameSongModalOpen(true);
  };

  const handleConfirmRename = () => {
    if (songToRename && renameTitleInput.trim()) {
      onRenameSong(songToRename.id, renameTitleInput.trim());
    }
    setRenameSongModalOpen(false);
    setSongToRename(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac"
        onChange={handleFileChange}
        className="hidden"
        id="audio-file-importer"
      />

      {/* Prominent Search Bar & Action Buttons */}
      <div className="space-y-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Prominent Search Bar */}
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search by title, ragam, filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5 text-charcoal-muted" />}
              rightIcon={
                searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-charcoal-muted hover:text-charcoal focus:outline-none"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
              className="bg-canvas-card text-base py-3 pl-12 pr-10 shadow-subtle border-border focus:border-sage"
            />
          </div>

          {/* Multi-Select Toggle Button */}
          <Button
            variant={isSelectMode ? 'primary' : 'secondary'}
            size="md"
            onClick={() => {
              if (isSelectMode) {
                handleExitSelectMode();
              } else {
                setIsSelectMode(true);
              }
            }}
            className="flex-shrink-0 px-3.5 text-xs font-semibold"
            title="Toggle multiple selection"
          >
            {isSelectMode ? 'Done' : 'Select'}
          </Button>

          {/* Add Song Button */}
          {!isSelectMode && (
            <Button
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 flex-shrink-0 px-3.5 shadow-subtle text-xs font-semibold"
              title="Import Audio Files from Device"
            >
              <Plus className="w-4 h-4" />
              <span>Add Song</span>
            </Button>
          )}
        </div>

        {/* Multi-Select Action Banner (Visible when isSelectMode is active) */}
        {isSelectMode ? (
          <div className="p-3 bg-sage-light/70 border border-sage-border rounded-xl flex items-center justify-between gap-2 shadow-subtle animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sage-hover">
                {selectedSongIds.size} of {finalSortedResults.length} selected
              </span>
              <button
                onClick={
                  selectedSongIds.size === finalSortedResults.length
                    ? handleDeselectAll
                    : handleSelectAll
                }
                className="text-xs text-charcoal-muted underline hover:text-charcoal ml-2 font-medium"
              >
                {selectedSongIds.size === finalSortedResults.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {onBulkDownload && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExecuteBulkDownload}
                  disabled={selectedSongIds.size === 0}
                  className="text-xs flex items-center gap-1 px-2.5 h-8"
                  title="Download Selected for Offline Practice"
                >
                  <Download className="w-3.5 h-3.5 text-sage" />
                  <span className="hidden xs:inline">Download</span>
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExecuteBulkFavorite}
                disabled={selectedSongIds.size === 0}
                className="text-xs flex items-center gap-1 px-2.5 h-8"
                title="Favorite Selected"
              >
                <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
                <span className="hidden xs:inline">Favorite</span>
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => setBulkDeleteModalOpen(true)}
                disabled={selectedSongIds.size === 0}
                className="text-xs flex items-center gap-1 px-2.5 h-8"
                title="Delete Selected"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Delete</span>
              </Button>

              <button
                onClick={handleExitSelectMode}
                className="p-1 text-charcoal-muted hover:text-charcoal ml-1"
                aria-label="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Simple Filter and Sort Controls */
          <div className="flex items-center justify-between gap-2">
            {/* Quick Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
              <button
                onClick={() => {
                  setFilterFavoritesOnly(false);
                  setSelectedCategory('All');
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-150',
                  !filterFavoritesOnly && selectedCategory === 'All'
                    ? 'bg-sage text-canvas border-sage'
                    : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
                )}
              >
                All Songs
              </button>

              <button
                onClick={() => setFilterFavoritesOnly(!filterFavoritesOnly)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 border transition-all duration-150',
                  filterFavoritesOnly
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
                )}
              >
                <Heart className={cn('w-3.5 h-3.5', filterFavoritesOnly && 'fill-current text-red-600')} />
                <span>Favorites</span>
              </button>

              <div className="w-[1px] h-4 bg-border mx-1 flex-shrink-0" />

              {/* Dance Categories */}
              {categories.slice(1).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setFilterFavoritesOnly(false);
                    setSelectedCategory(selectedCategory === cat ? 'All' : cat);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all duration-150',
                    selectedCategory === cat
                      ? 'bg-sage text-canvas border-sage'
                      : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-charcoal-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-xs bg-canvas-card border border-border text-charcoal rounded-lg px-2 py-1 focus:outline-none focus:border-sage"
                aria-label="Sort repertoire"
              >
                <option value="recent">Recently Added</option>
                <option value="title-asc">Title (A – Z)</option>
                <option value="title-desc">Title (Z – A)</option>
                <option value="duration-desc">Longest First</option>
                <option value="duration-asc">Shortest First</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Import Failures Alert Banner */}
      {importFailures.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Some files could not be imported:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {importFailures.map((f, i) => (
                  <li key={i}>
                    {f.fileName}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {onClearImportFailures && (
            <button
              onClick={onClearImportFailures}
              className="p-1 hover:text-red-950 font-bold"
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Network & Offline Synchronization Status Bar */}
      {!isOnline ? (
        <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-subtle">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              <strong>Offline Mode:</strong> Repertoire stored locally in IndexedDB.
              {(syncState?.pendingCount || 0) > 0 && ` (${syncState?.pendingCount} changes waiting to sync)`}
            </span>
          </div>
          <Badge variant="neutral" size="sm">Local DB</Badge>
        </div>
      ) : syncState?.isSyncing ? (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-sage-light/60 border border-sage/30 text-xs text-sage-hover flex items-center justify-between gap-2 shadow-subtle">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sage animate-spin flex-shrink-0" />
            <span>Synchronizing repertoire with cloud...</span>
          </div>
        </div>
      ) : onManualSync && (syncState?.pendingCount || 0) > 0 ? (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-sage-light/40 border border-sage/20 text-xs text-charcoal flex items-center justify-between gap-2 shadow-subtle">
          <span className="flex items-center gap-1.5 text-xs text-charcoal-muted">
            <Cloud className="w-4 h-4 text-sage" />
            <span>{syncState?.pendingCount} change(s) pending synchronization</span>
          </span>
          <Button variant="secondary" size="sm" onClick={onManualSync} className="h-7 text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-sage" />
            <span>Sync Now</span>
          </Button>
        </div>
      ) : null}

      {/* Download Entire Repertoire Banner for New Device / Cloud Tracks */}
      {isOnline && undownloadedSongs.length > 0 && onDownloadAll && (
        <div className="mb-3 p-3.5 rounded-2xl bg-canvas-card border border-sage/40 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sage-light text-sage flex items-center justify-center flex-shrink-0 mt-0.5">
              <CloudDownload className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-charcoal">
                {undownloadedSongs.length} Cloud Track{undownloadedSongs.length === 1 ? '' : 's'} Available
              </h4>
              <p className="text-[11px] text-charcoal-muted leading-tight mt-0.5">
                Download collection (~{(totalUndownloadedBytes / 1024 / 1024).toFixed(1)} MB) to practice 100% offline without internet.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsDownloadAllModalOpen(true)}
            className="self-end sm:self-auto text-xs flex items-center gap-1.5 px-3 py-1.5 h-8 flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All Offline</span>
          </Button>
        </div>
      )}

      {/* Header Info: Results count & Search Active indicator */}
      <div className="flex items-center justify-between py-1 mb-2 px-0.5">
        <span className="text-xs font-medium text-charcoal-muted">
          {searchQuery ? (
            <span>
              Found <strong>{finalSortedResults.length}</strong> matching &ldquo;{searchQuery}&rdquo;
            </span>
          ) : (
            <span>
              {finalSortedResults.length} {finalSortedResults.length === 1 ? 'song' : 'songs'} in library
            </span>
          )}
        </span>

        <span className="text-[11px] text-sage font-medium bg-sage-light/70 px-2 py-0.5 rounded-md flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Offline Fuzzy Search</span>
        </span>
      </div>

      {/* Song List or Empty / No-Results States */}
      <div className="space-y-2">
        {finalSortedResults.length === 0 ? (
          <div className="text-center py-16 px-4 bg-canvas-card border border-border/80 rounded-2xl my-2">
            {searchQuery ? (
              // Friendly No-Results State
              <div className="max-w-sm mx-auto">
                <Search className="w-12 h-12 text-charcoal-subtle mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-semibold text-charcoal">
                  No songs matching &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="text-xs text-charcoal-muted mt-1 leading-relaxed">
                  Try checking for typos or searching by dance category (e.g. <em>Jatiswaram</em> or <em>Shabdam</em>).
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                >
                  Clear Search Query
                </Button>
              </div>
            ) : songs.filter((s) => !s.isDeleted).length === 0 ? (
              // Truly empty library
              <div className="flex flex-col items-center max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-sage-light text-sage flex items-center justify-center mb-4">
                  <Music2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-charcoal">Your Dance Library is Empty</h3>
                <p className="text-sm text-charcoal-muted mt-1 leading-relaxed">
                  Import dance music from your phone to start practicing. Your original files will remain completely untouched.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Import Audio Files</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={onLoadSampleRepertoire}
                    className="flex-1 flex items-center justify-center gap-2"
                    title="Load sample Kuchipudi songs"
                  >
                    <Sparkles className="w-4 h-4 text-sage" />
                    <span>Load Demo Repertoire</span>
                  </Button>
                </div>
              </div>
            ) : (
              // Filter empty
              <div>
                <FileMusic className="w-12 h-12 text-charcoal-subtle mx-auto mb-3" />
                <h3 className="text-base font-semibold text-charcoal">No songs found</h3>
                <p className="text-sm text-charcoal-muted mt-1 max-w-xs mx-auto">
                  No compositions match the selected filter.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('All');
                    setFilterFavoritesOnly(false);
                  }}
                  className="mt-4"
                >
                  Show All Songs
                </Button>
              </div>
            )}
          </div>
        ) : (
          finalSortedResults.map(({ song, matches }) => {
            const isThisPlaying = currentSong?.id === song.id && isPlaying;
            const isThisSelected = currentSong?.id === song.id;
            const isChecked = selectedSongIds.has(song.id);

            return (
              <div
                key={song.id}
                className={cn(
                  'group flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all duration-150',
                  isChecked && 'bg-sage-light/50 border-sage',
                  !isChecked && isThisPlaying && 'bg-sage-light/40 border-sage ring-2 ring-sage/40 shadow-card',
                  !isChecked && !isThisPlaying && isThisSelected && 'bg-canvas-subtle border-border-strong',
                  !isChecked && !isThisSelected && 'bg-canvas-card border-border hover:border-border-strong'
                )}
              >
                {/* Multi-Select Checkbox OR Play Trigger */}
                {isSelectMode ? (
                  <button
                    type="button"
                    onClick={() => toggleSelectSong(song.id)}
                    className="w-10 h-10 flex items-center justify-center text-sage flex-shrink-0 mr-2 focus:outline-none"
                    aria-label={isChecked ? `Deselect ${song.title}` : `Select ${song.title}`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-6 h-6 fill-sage-light text-sage" />
                    ) : (
                      <Square className="w-6 h-6 text-charcoal-subtle" />
                    )}
                  </button>
                ) : null}

                {/* Song Row Content */}
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelectSong(song.id);
                    } else if (isThisSelected) {
                      onTogglePlay();
                    } else {
                      onPlaySong(song);
                    }
                  }}
                >
                  {/* Play Button with active audio indicator */}
                  {!isSelectMode && (
                    <button
                      type="button"
                      aria-label={isThisPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-subtle',
                        isThisPlaying
                          ? 'bg-sage text-canvas'
                          : 'bg-canvas-subtle text-charcoal group-hover:bg-sage-light group-hover:text-sage-hover'
                      )}
                    >
                      {isThisPlaying ? (
                        isLoadingAudio ? (
                          <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Pause className="w-5 h-5 fill-current" />
                        )
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>
                  )}

                  {/* Title & Dance Metadata (With Highlighted Text) */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          'text-sm sm:text-base font-semibold truncate leading-tight',
                          isThisPlaying ? 'text-sage-hover font-bold' : 'text-charcoal'
                        )}
                        title={song.title}
                      >
                        <HighlightedText
                          text={song.title}
                          fieldKey="title"
                          matches={matches}
                        />
                      </h4>

                      {/* Playing sound indicator badge */}
                      {isThisPlaying && (
                        <span className="flex items-center text-[10px] text-sage font-bold uppercase tracking-wider bg-canvas px-1.5 py-0.5 rounded-full ring-1 ring-sage/30 flex-shrink-0">
                          <Volume2 className="w-3 h-3 mr-1 animate-pulse" />
                          Playing
                        </span>
                      )}

                      {song.isLocalAvailable && !isThisPlaying && (
                        <span title="Stored locally in IndexedDB (Offline ready)">
                          <CheckCircle className="w-3.5 h-3.5 text-sage flex-shrink-0" />
                        </span>
                      )}

                      {!song.isLocalAvailable && song.storagePath && !isThisPlaying && (
                        <span title="Available in Shared Cloud Repertoire">
                          <Cloud className="w-3.5 h-3.5 text-sage-hover flex-shrink-0 opacity-80" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-charcoal-muted mt-0.5 truncate">
                      {song.category && (
                        <Badge variant="sage" size="sm">
                          {song.category}
                        </Badge>
                      )}
                      {song.ragam && <span>• {song.ragam}</span>}
                      {song.talam && <span>({song.talam})</span>}
                      {!song.ragam && !song.talam && (
                        <span className="truncate text-charcoal-subtle">
                          <HighlightedText
                            text={song.originalFilename}
                            fieldKey="originalFilename"
                            matches={matches}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Duration, Favorite control, More-options */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {song.duration !== null && (
                    <span className="text-xs text-charcoal-muted font-medium px-1 hidden xs:inline">
                      {formatDuration(song.duration)}
                    </span>
                  )}

                  {/* Favorite Toggle */}
                  <button
                    onClick={() => onToggleFavorite(song.id)}
                    aria-label={song.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                      song.isFavorite
                        ? 'text-red-500 hover:text-red-600'
                        : 'text-charcoal-subtle hover:text-charcoal hover:bg-canvas-subtle'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', song.isFavorite && 'fill-current text-red-500')} />
                  </button>

                  {/* More-options menu button */}
                  {!isSelectMode && (
                    <button
                      onClick={() => setSelectedSongForMenu(song)}
                      aria-label="Song options"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-charcoal-subtle hover:text-charcoal hover:bg-canvas-subtle transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Importing Progress Modal */}
      {importProgress && (
        <Modal
          isOpen={Boolean(importProgress)}
          onClose={() => {}}
          title="Importing Audio"
        >
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 border-3 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-semibold text-charcoal">
                Processing file {importProgress.current} of {importProgress.total}...
              </p>
              <p className="text-xs text-charcoal-muted mt-1 truncate max-w-xs mx-auto">
                {importProgress.currentFileName}
              </p>
            </div>
            <p className="text-xs text-charcoal-subtle">
              Copying audio into your device's IndexedDB. Original phone files remain untouched.
            </p>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Modal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        title="Move to Recovery Bin?"
        description={`Are you sure you want to move ${selectedSongIds.size} selected songs to the Recovery Bin?`}
      >
        <div className="pt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBulkDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmBulkDelete}>
            Move to Recovery Bin
          </Button>
        </div>
      </Modal>

      {/* More Options Modal / Bottom Sheet */}
      {selectedSongForMenu && (
        <Modal
          isOpen={Boolean(selectedSongForMenu)}
          onClose={() => setSelectedSongForMenu(null)}
          title={selectedSongForMenu.title}
          description={`Original: ${selectedSongForMenu.originalFilename}`}
        >
          <div className="space-y-1 py-1">
            <button
              onClick={() => {
                onPlaySong(selectedSongForMenu);
                setSelectedSongForMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <Play className="w-4 h-4 text-sage" />
              <span>Play Track</span>
            </button>

            {onDownloadSong && !selectedSongForMenu.isLocalAvailable && (
              <button
                onClick={async () => {
                  const song = selectedSongForMenu;
                  setSelectedSongForMenu(null);
                  await onDownloadSong(song);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
              >
                <Download className="w-4 h-4 text-sage" />
                <span>Download for Offline Practice</span>
              </button>
            )}

            <button
              onClick={() => {
                onToggleFavorite(selectedSongForMenu.id);
                setSelectedSongForMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <Heart className={cn('w-4 h-4', selectedSongForMenu.isFavorite ? 'text-red-500 fill-current' : 'text-charcoal-muted')} />
              <span>{selectedSongForMenu.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
            </button>

            <button
              onClick={() => handleOpenRename(selectedSongForMenu)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <Edit2 className="w-4 h-4 text-charcoal-muted" />
              <span>Rename Display Title</span>
            </button>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: selectedSongForMenu.title,
                      text: `Kuchipudi Dance: ${selectedSongForMenu.title}`,
                    })
                    .catch(() => {});
                } else {
                  alert(`Song title: ${selectedSongForMenu.title}`);
                }
                setSelectedSongForMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <Share2 className="w-4 h-4 text-charcoal-muted" />
              <span>Share Title</span>
            </button>

            <div className="pt-2 border-t border-border/80 mt-2">
              <button
                onClick={() => {
                  if (confirm(`Move "${selectedSongForMenu.title}" to Recovery Bin?`)) {
                    onDeleteSong(selectedSongForMenu.id);
                  }
                  setSelectedSongForMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 text-left text-sm font-medium text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Delete Local Song</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename Song Dialog */}
      <Modal
        isOpen={renameSongModalOpen}
        onClose={() => setRenameSongModalOpen(false)}
        title="Rename Display Title"
        description="Original phone filename remains untouched."
      >
        <div className="space-y-4">
          <Input
            label="Display Title"
            value={renameTitleInput}
            onChange={(e) => setRenameTitleInput(e.target.value)}
            placeholder="e.g. Kalyani Jatiswaram - Rehearsal 1"
            autoFocus
          />
          {songToRename && (
            <p className="text-xs text-charcoal-muted">
              Original file: <strong className="text-charcoal">{songToRename.originalFilename}</strong>
            </p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setRenameSongModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmRename}>
              Save Display Title
            </Button>
          </div>
        </div>
      </Modal>

      {/* Download All Repertoire Confirmation Modal */}
      <Modal
        isOpen={isDownloadAllModalOpen}
        onClose={() => setIsDownloadAllModalOpen(false)}
        title="Download Repertoire Offline?"
        description="Download classical dance recordings to this device."
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-charcoal leading-relaxed">
            This will download <strong>{undownloadedSongs.length} song{undownloadedSongs.length === 1 ? '' : 's'}</strong> (~{(totalUndownloadedBytes / 1024 / 1024).toFixed(1)} MB) into your browser's IndexedDB storage.
          </p>
          <div className="p-3 rounded-xl bg-sage-light/50 border border-sage/30 text-xs text-charcoal space-y-1">
            <div className="font-semibold text-sage-hover">Offline Practice Guarantee</div>
            <p className="text-[11px] text-charcoal-muted">
              Once downloaded, you can rehearse in dance halls and stages even with zero cellular signal or WiFi.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setIsDownloadAllModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                setIsDownloadAllModalOpen(false);
                if (onDownloadAll) {
                  await onDownloadAll();
                }
              }}
            >
              Start Download
            </Button>
          </div>
        </div>
      </Modal>

      {/* Download Batch Progress Modal */}
      {downloadBatchProgress && (
        <Modal
          isOpen={Boolean(downloadBatchProgress)}
          onClose={() => {}}
          title="Downloading Repertoire"
        >
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 border-3 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-semibold text-charcoal">
                Downloading {downloadBatchProgress.current} of {downloadBatchProgress.total}
              </p>
              <p className="text-xs text-sage-hover font-medium mt-0.5 truncate max-w-xs mx-auto">
                {downloadBatchProgress.currentSongTitle}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-border rounded-full h-2 overflow-hidden">
              <div
                className="bg-sage h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadBatchProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-charcoal-subtle">
              {downloadBatchProgress.percent}% completed. Please keep app open while downloading audio.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
