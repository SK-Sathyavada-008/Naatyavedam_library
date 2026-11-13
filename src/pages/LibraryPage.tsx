import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { Song, UserProfile, SortOption } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
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
  importProgress?: { current: number; total: number; currentFileName: string } | null;
  importFailures?: { fileName: string; reason: string }[];
  onClearImportFailures?: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  songs,
  currentSong,
  isPlaying,
  isLoadingAudio = false,
  onPlaySong,
  onTogglePlay,
  onToggleFavorite,
  onDeleteSong,
  onRenameSong,
  onImportFiles,
  onLoadSampleRepertoire,
  importProgress,
  importFailures = [],
  onClearImportFailures,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

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
      // Reset input value so same files can be re-selected if desired
      e.target.value = '';
    }
  };

  // Filter & Sort songs
  const filteredAndSortedSongs = useMemo(() => {
    const list = songs.filter((song) => {
      if (song.isDeleted) return false;
      if (filterFavoritesOnly && !song.isFavorite) return false;
      if (selectedCategory !== 'All' && song.category !== selectedCategory) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        song.title.toLowerCase().includes(query) ||
        song.originalFilename.toLowerCase().includes(query) ||
        (song.ragam && song.ragam.toLowerCase().includes(query)) ||
        (song.talam && song.talam.toLowerCase().includes(query)) ||
        (song.composer && song.composer.toLowerCase().includes(query)) ||
        (song.category && song.category.toLowerCase().includes(query))
      );
    });

    // Apply sorting
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'duration-desc':
          return (b.duration || 0) - (a.duration || 0);
        case 'duration-asc':
          return (a.duration || 0) - (b.duration || 0);
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [songs, searchQuery, selectedCategory, filterFavoritesOnly, sortBy]);

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
      {/* Hidden file input supporting single & multiple audio files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.flac"
        onChange={handleFileChange}
        className="hidden"
        id="audio-file-importer"
      />

      {/* Top Search & Add Song Button */}
      <div className="space-y-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search by title, ragam, talam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              rightIcon={
                searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:text-charcoal"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
              className="bg-canvas-card"
            />
          </div>

          {/* Add Song Button */}
          <Button
            variant="primary"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 flex-shrink-0 px-3.5 shadow-subtle"
            title="Import Audio Files from Device"
          >
            <Plus className="w-4 h-4" />
            <span>Add Song</span>
          </Button>
        </div>

        {/* Filters & Sorting Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Filter Chips Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
            {/* Quick toggle favorites */}
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
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
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

          {/* Sort Dropdown */}
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

      {/* Header Info: Track count */}
      <div className="flex items-center justify-between py-1 mb-2 px-0.5">
        <span className="text-xs font-medium text-charcoal-muted">
          {filteredAndSortedSongs.length} {filteredAndSortedSongs.length === 1 ? 'song' : 'songs'} in local library
        </span>
        <span className="text-[11px] text-sage font-medium bg-sage-light/70 px-2 py-0.5 rounded-md flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>IndexedDB Local Storage</span>
        </span>
      </div>

      {/* Song List or Empty State */}
      <div className="space-y-2">
        {filteredAndSortedSongs.length === 0 ? (
          <div className="text-center py-16 px-4 bg-canvas-card border border-border/80 rounded-2xl my-2">
            {songs.filter((s) => !s.isDeleted).length === 0 ? (
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
              // Filter/Search empty
              <div>
                <FileMusic className="w-12 h-12 text-charcoal-subtle mx-auto mb-3" />
                <h3 className="text-base font-semibold text-charcoal">No matching songs</h3>
                <p className="text-sm text-charcoal-muted mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? `No songs matched "${searchQuery}".`
                    : 'No songs found with current category and filters.'}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setFilterFavoritesOnly(false);
                  }}
                  className="mt-4"
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          filteredAndSortedSongs.map((song) => {
            const isThisPlaying = currentSong?.id === song.id && isPlaying;
            const isThisSelected = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                className={cn(
                  'group flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all duration-150',
                  isThisSelected
                    ? 'bg-sage-light/40 border-sage-border shadow-subtle ring-1 ring-sage/30'
                    : 'bg-canvas-card border-border hover:border-border-strong'
                )}
              >
                {/* Play Button & Song Info (Easy Scanning) */}
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (isThisSelected) {
                      onTogglePlay();
                    } else {
                      onPlaySong(song);
                    }
                  }}
                >
                  {/* Play/Pause round trigger */}
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

                  {/* Title prioritized for easy scanning */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          'text-sm sm:text-base font-semibold truncate leading-tight',
                          isThisSelected ? 'text-sage-hover font-bold' : 'text-charcoal'
                        )}
                        title={song.title}
                      >
                        {song.title}
                      </h4>
                      {song.isLocalAvailable && (
                        <span title="Stored locally in IndexedDB">
                          <CheckCircle className="w-3.5 h-3.5 text-sage flex-shrink-0" />
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
                        <span className="truncate text-charcoal-subtle">{song.originalFilename}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Optional Duration, Favorite control, More-options menu */}
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
                  <button
                    onClick={() => setSelectedSongForMenu(song)}
                    aria-label="Song options"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-charcoal-subtle hover:text-charcoal hover:bg-canvas-subtle transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
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
    </div>
  );
};
