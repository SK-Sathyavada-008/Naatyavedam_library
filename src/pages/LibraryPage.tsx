import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Play,
  Pause,
  Heart,
  Download,
  Plus,
  MoreVertical,
  CheckCircle,
  FileMusic,
  Trash2,
  Share2,
  Edit2,
  FolderDown,
} from 'lucide-react';
import { Song, DanceCategory, UserProfile } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDuration, cn } from '../utils';

export interface LibraryPageProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  user: UserProfile | null;
  onPlaySong: (song: Song) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (songId: string) => void;
  onAddSong: (newSong: Omit<Song, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'isDownloaded' | 'isDeleted'>) => void;
  onDeleteSong: (songId: string) => void;
  onRenameSong: (songId: string, newTitle: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  songs,
  currentSong,
  isPlaying,
  user,
  onPlaySong,
  onTogglePlay,
  onToggleFavorite,
  onAddSong,
  onDeleteSong,
  onRenameSong,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [filterDownloadedOnly, setFilterDownloadedOnly] = useState(false);

  // Modals & Action States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<Song | null>(null);
  const [renameSongModalOpen, setRenameSongModalOpen] = useState(false);
  const [renameTitleInput, setRenameTitleInput] = useState('');

  // Upload Form State
  const [newTitle, setNewTitle] = useState('');
  const [newRagam, setNewRagam] = useState('');
  const [newTalam, setNewTalam] = useState('Adi');
  const [newCategory, setNewCategory] = useState<DanceCategory>('Jatiswaram');
  const [newComposer, setNewComposer] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadError, setUploadError] = useState('');

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

  // Filter songs
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      if (song.isDeleted) return false;
      if (filterFavoritesOnly && !song.isFavorite) return false;
      if (filterDownloadedOnly && !song.isDownloaded) return false;
      if (selectedCategory !== 'All' && song.category !== selectedCategory) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        song.title.toLowerCase().includes(query) ||
        (song.ragam && song.ragam.toLowerCase().includes(query)) ||
        (song.talam && song.talam.toLowerCase().includes(query)) ||
        (song.composer && song.composer.toLowerCase().includes(query)) ||
        song.category.toLowerCase().includes(query)
      );
    });
  }, [songs, searchQuery, selectedCategory, filterFavoritesOnly, filterDownloadedOnly]);

  const handleOpenUpload = () => {
    setNewTitle('');
    setNewRagam('');
    setNewTalam('Adi');
    setNewCategory('Jatiswaram');
    setNewComposer('');
    setUploadedFileName('');
    setUploadError('');
    setIsUploadModalOpen(true);
  };

  const handleSimulateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      if (!newTitle) {
        // Auto-fill title from filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewTitle(cleanName);
      }
    }
  };

  const handleCreateSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setUploadError('Song title is required');
      return;
    }

    onAddSong({
      title: newTitle.trim(),
      ragam: newRagam.trim() || undefined,
      talam: newTalam.trim() || 'Adi',
      category: newCategory,
      composer: newComposer.trim() || undefined,
      duration: 240, // Simulated 4 mins
      fileSize: 5242880, // ~5MB
      fileName: uploadedFileName || `${newTitle.toLowerCase().replace(/\s+/g, '_')}.mp3`,
      mimeType: 'audio/mpeg',
      uploadedBy: user?.id || 'teacher-001',
      uploadedByName: user?.fullName || 'Teacher',
    });

    setIsUploadModalOpen(false);
  };

  const handleOpenRename = (song: Song) => {
    setSelectedSongForMenu(null);
    setRenameTitleInput(song.title);
    setRenameSongModalOpen(true);
  };

  const handleConfirmRename = () => {
    if (selectedSongForMenu && renameTitleInput.trim()) {
      onRenameSong(selectedSongForMenu.id, renameTitleInput.trim());
    }
    setRenameSongModalOpen(false);
    setSelectedSongForMenu(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full">
      {/* Search Bar & Quick Actions */}
      <div className="space-y-3 mb-4">
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

          {/* Upload Button */}
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenUpload}
            className="flex items-center gap-1.5 flex-shrink-0 px-3.5"
            title="Upload Dance Song"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>

        {/* Filter Badges & Categories Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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

          {/* Quick toggle downloaded */}
          <button
            onClick={() => setFilterDownloadedOnly(!filterDownloadedOnly)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 border transition-all duration-150',
              filterDownloadedOnly
                ? 'bg-sage-light text-sage-hover border-sage-border'
                : 'bg-canvas-card text-charcoal-muted border-border hover:border-border-strong'
            )}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Offline Ready</span>
          </button>

          <div className="w-[1px] h-5 bg-border mx-1 flex-shrink-0" />

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
      </div>

      {/* Header Info: Track count & sample mode banner */}
      <div className="flex items-center justify-between py-1 mb-2">
        <span className="text-xs font-medium text-charcoal-muted">
          Showing {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
        </span>
        <span className="text-[11px] text-sage font-medium bg-sage-light/70 px-2 py-0.5 rounded-md">
          Sample Repertoire
        </span>
      </div>

      {/* Song List */}
      <div className="space-y-2">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-16 px-4 bg-canvas-card border border-border/80 rounded-2xl my-4">
            <FileMusic className="w-12 h-12 text-charcoal-subtle mx-auto mb-3" />
            <h3 className="text-base font-semibold text-charcoal">No dance songs found</h3>
            <p className="text-sm text-charcoal-muted mt-1 max-w-xs mx-auto">
              {searchQuery
                ? `No songs matched "${searchQuery}". Try searching for a different Ragam or Talam.`
                : 'No songs in this filter category yet.'}
            </p>
            {searchQuery && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isThisPlaying = currentSong?.id === song.id && isPlaying;
            const isThisSelected = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                className={cn(
                  'group flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all duration-150',
                  isThisSelected
                    ? 'bg-sage-light/40 border-sage-border shadow-subtle'
                    : 'bg-canvas-card border-border hover:border-border-strong'
                )}
              >
                {/* Play Button & Song Info */}
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
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Title and Dance Details */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          'text-sm sm:text-base font-semibold truncate',
                          isThisSelected ? 'text-sage-hover font-bold' : 'text-charcoal'
                        )}
                      >
                        {song.title}
                      </h4>
                      {song.isDownloaded && (
                        <span title="Available Offline">
                          <CheckCircle className="w-3.5 h-3.5 text-sage flex-shrink-0" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-charcoal-muted mt-0.5 truncate">
                      <Badge variant="sage" size="sm">
                        {song.category}
                      </Badge>
                      {song.ragam && <span>• {song.ragam}</span>}
                      {song.talam && <span>({song.talam})</span>}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Duration, Favorite, More Menu */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-xs text-charcoal-muted font-medium px-1 hidden xs:inline">
                    {formatDuration(song.duration)}
                  </span>

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
                    <Heart className={cn('w-4 h-4', song.isFavorite && 'fill-current')} />
                  </button>

                  {/* Options Menu Button */}
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

      {/* Song Actions Bottom Sheet / Modal */}
      {selectedSongForMenu && (
        <Modal
          isOpen={Boolean(selectedSongForMenu)}
          onClose={() => setSelectedSongForMenu(null)}
          title={selectedSongForMenu.title}
          description={`${selectedSongForMenu.category} • ${selectedSongForMenu.ragam || 'Classical'}`}
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
              <span>Rename Composition</span>
            </button>

            <button
              onClick={() => {
                alert(`Downloaded "${selectedSongForMenu.title}" to local offline cache.`);
                setSelectedSongForMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <FolderDown className="w-4 h-4 text-charcoal-muted" />
              <span>Save for Offline Playback</span>
            </button>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: selectedSongForMenu.title,
                    text: `Kuchipudi Dance: ${selectedSongForMenu.title} (${selectedSongForMenu.ragam || 'Classical'})`,
                  }).catch(() => {});
                } else {
                  alert(`Share link copied: ${selectedSongForMenu.title}`);
                }
                setSelectedSongForMenu(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-canvas-subtle text-left text-sm font-medium text-charcoal transition-colors"
            >
              <Share2 className="w-4 h-4 text-charcoal-muted" />
              <span>Share Song</span>
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
                <span>Move to Recovery Bin</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename Song Dialog */}
      <Modal
        isOpen={renameSongModalOpen}
        onClose={() => setRenameSongModalOpen(false)}
        title="Rename Dance Composition"
      >
        <div className="space-y-4">
          <Input
            label="Composition Title"
            value={renameTitleInput}
            onChange={(e) => setRenameTitleInput(e.target.value)}
            placeholder="e.g. Kalyani Jatiswaram - Fast Tempo"
            autoFocus
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setRenameSongModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmRename}>
              Save Name
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Song Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Dance Song"
        description="Add a classical dance composition to the shared library"
      >
        <form onSubmit={handleCreateSongSubmit} className="space-y-3.5">
          {/* File Picker */}
          <div className="p-4 rounded-xl border-2 border-dashed border-border hover:border-sage bg-canvas-subtle/50 text-center cursor-pointer transition-colors">
            <label className="cursor-pointer block">
              <FileMusic className="w-8 h-8 text-sage mx-auto mb-2" />
              <span className="text-sm font-semibold text-charcoal block">
                {uploadedFileName || 'Choose MP3 or M4A audio file'}
              </span>
              <span className="text-xs text-charcoal-muted mt-1 block">
                {uploadedFileName ? 'Tap to change file' : 'Large audio files supported'}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleSimulateFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <Input
            label="Song Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Manduka Shabdam"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ragam"
              value={newRagam}
              onChange={(e) => setNewRagam(e.target.value)}
              placeholder="e.g. Mohanam"
            />
            <Input
              label="Talam"
              value={newTalam}
              onChange={(e) => setNewTalam(e.target.value)}
              placeholder="e.g. Adi or Rupaka"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal">Dance Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as DanceCategory)}
              className="w-full min-h-touch bg-canvas-card text-charcoal border border-border rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage"
            >
              <option value="Pushpanjali">Pushpanjali</option>
              <option value="Jatiswaram">Jatiswaram</option>
              <option value="Shabdam">Shabdam</option>
              <option value="Varnam">Varnam</option>
              <option value="Keerthanam">Keerthanam</option>
              <option value="Tarangam">Tarangam</option>
              <option value="Thillana">Thillana</option>
              <option value="Slokam">Slokam</option>
              <option value="Practice / Talam">Practice / Talam</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <Input
            label="Composer / Guru (Optional)"
            value={newComposer}
            onChange={(e) => setNewComposer(e.target.value)}
            placeholder="e.g. Narayana Teertha"
          />

          {uploadError && (
            <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">
              {uploadError}
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Add to Library
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
