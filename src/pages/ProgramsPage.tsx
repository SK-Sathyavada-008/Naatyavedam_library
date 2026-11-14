import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CalendarRange,
  Plus,
  Search,
  Sparkles,
  Music2,
  Play,
  Pause,
  Copy,
  Clock,
  ArrowLeft,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Upload,
  Volume2,
  Check,
} from 'lucide-react';
import { Program, ProgramItem, Song, UserProfile } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDate, formatDuration, cn } from '../utils';
import {
  getLocalPrograms,
  saveLocalProgram,
  deleteLocalProgram,
  duplicateLocalProgram,
  getLocalProgramItems,
  saveLocalProgramItem,
  deleteLocalProgramItem,
  reorderLocalProgramItems,
  saveSongWithBlob,
} from '../services/db';

export interface ProgramsPageProps {
  user: UserProfile | null;
  librarySongs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  onPlaySong: (song: Song) => void;
  onTogglePlay: () => void;
  onQueueChange?: (queue: Song[]) => void;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({
  user,
  librarySongs,
  currentSong,
  isPlaying,
  isLoadingAudio = false,
  onPlaySong,
  onTogglePlay,
  onQueueChange,
}) => {
  // Navigation: Program list vs Selected program detail
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [addSongTab, setAddSongTab] = useState<'library' | 'upload'>('library');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Form State
  const [programTitle, setProgramTitle] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programEventDate, setProgramEventDate] = useState('');

  // Custom Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load programs from IndexedDB
  const refreshPrograms = useCallback(async () => {
    try {
      let progs = await getLocalPrograms();

      // Seed initial sample program if none exist yet
      if (progs.length === 0) {
        const seedProg: Program = {
          id: `prog-annual-day-2027`,
          title: 'Annual Day 2027 Recital',
          description: 'Senior students Kuchipudi recital sequence: Jatiswaram, Shabdam, and Tarangam finale.',
          eventDate: '2027-02-20',
          createdBy: user?.id || 'teacher-001',
          createdByName: user?.fullName || 'Guru Veda',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        };
        await saveLocalProgram(seedProg);

        // Attach library songs if available
        if (librarySongs.length > 0) {
          const sampleSongs = librarySongs.slice(0, 3);
          for (let i = 0; i < sampleSongs.length; i++) {
            await saveLocalProgramItem({
              id: `pitem-seed-${i}`,
              programId: seedProg.id,
              sourceType: 'library_song',
              songId: sampleSongs[i].id,
              position: i,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
        progs = await getLocalPrograms();
      }

      setPrograms(progs);
    } catch (err) {
      console.error('Failed to load programs from DB:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, librarySongs]);

  // Load items for the selected program
  const refreshProgramItems = useCallback(async (progId: string) => {
    try {
      const items = await getLocalProgramItems(progId);
      setProgramItems(items);
    } catch (err) {
      console.error('Failed to load program items:', err);
    }
  }, []);

  useEffect(() => {
    refreshPrograms();
  }, [refreshPrograms]);

  useEffect(() => {
    if (selectedProgram) {
      refreshProgramItems(selectedProgram.id);
    }
  }, [selectedProgram, refreshProgramItems]);

  // Resolve Song metadata for each program item
  const resolvedProgramSongs: { item: ProgramItem; song: Song }[] = programItems
    .map((item) => {
      const matched = librarySongs.find((s) => s.id === item.songId);
      if (matched) {
        return {
          item,
          song: {
            ...matched,
            title: item.displayTitleOverride || matched.title,
          },
        };
      }
      return null;
    })
    .filter((entry): entry is { item: ProgramItem; song: Song } => entry !== null);

  // Synchronize player queue with program sequence when selected
  const syncProgramQueue = useCallback(
    (customItems = resolvedProgramSongs) => {
      if (onQueueChange) {
        const queue = customItems.map((entry) => entry.song);
        onQueueChange(queue);
      }
    },
    [resolvedProgramSongs, onQueueChange]
  );

  // Handler: Play specific song inside program
  const handlePlayProgramSong = (song: Song) => {
    syncProgramQueue();
    if (currentSong?.id === song.id) {
      onTogglePlay();
    } else {
      onPlaySong(song);
    }
  };

  // Handler: Play entire program from the beginning (#1)
  const handlePlayProgramFromStart = () => {
    if (resolvedProgramSongs.length === 0) return;
    syncProgramQueue();
    onPlaySong(resolvedProgramSongs[0].song);
  };

  // Create Program
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programTitle.trim()) return;

    const newProg: Program = {
      id: `prog-${Date.now()}`,
      title: programTitle.trim(),
      description: programDescription.trim() || undefined,
      eventDate: programEventDate || undefined,
      createdBy: user?.id || 'local',
      createdByName: user?.fullName || 'Member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };

    await saveLocalProgram(newProg);
    await refreshPrograms();
    setIsCreateModalOpen(false);
    setProgramTitle('');
    setProgramDescription('');
    setProgramEventDate('');
    // Open the newly created program directly
    setSelectedProgram(newProg);
  };

  // Edit Program
  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram || !programTitle.trim()) return;

    const updated: Program = {
      ...selectedProgram,
      title: programTitle.trim(),
      description: programDescription.trim() || undefined,
      eventDate: programEventDate || undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveLocalProgram(updated);
    setSelectedProgram(updated);
    await refreshPrograms();
    setIsEditModalOpen(false);
  };

  // Duplicate Program
  const handleDuplicate = async (prog: Program, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cloned = await duplicateLocalProgram(prog.id, `${prog.title} (Copy)`, user?.fullName || 'Member');
    await refreshPrograms();
    setSelectedProgram(cloned);
  };

  // Delete Program
  const handleDeleteProgram = async (progId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Move this dance program to recovery bin? Original music library songs will remain untouched.')) {
      return;
    }

    await deleteLocalProgram(progId);
    await refreshPrograms();
    if (selectedProgram?.id === progId) {
      setSelectedProgram(null);
    }
  };

  // Add Song from Library to Program
  const handleAddSongFromLibrary = async (song: Song) => {
    if (!selectedProgram) return;

    const newItem: ProgramItem = {
      id: `pitem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      programId: selectedProgram.id,
      sourceType: 'library_song',
      songId: song.id,
      position: programItems.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveLocalProgramItem(newItem);
    await refreshProgramItems(selectedProgram.id);
  };

  // Upload custom performance cut directly to program
  const handleUploadPerformanceCut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram || !uploadFile) return;

    const cutTitle = uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, '');
    const newSongId = `custom_cut_${Date.now()}`;

    // 1. Create a Song record for this edited audio
    const newSong: Song = {
      id: newSongId,
      title: `${cutTitle} (${selectedProgram.title} Cut)`,
      originalFilename: uploadFile.name,
      fileType: uploadFile.type || 'audio/mpeg',
      fileSize: uploadFile.size,
      duration: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
      isLocalAvailable: true,
      syncStatus: 'local_only',
      category: 'Performance Cut',
      isDeleted: false,
    };

    // Save audio blob into IndexedDB
    await saveSongWithBlob(newSong, uploadFile);

    // 2. Add as program item
    const newItem: ProgramItem = {
      id: `pitem-${Date.now()}`,
      programId: selectedProgram.id,
      sourceType: 'program_audio',
      songId: newSongId,
      position: programItems.length,
      displayTitleOverride: cutTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveLocalProgramItem(newItem);
    await refreshProgramItems(selectedProgram.id);

    setIsAddSongModalOpen(false);
    setUploadTitle('');
    setUploadFile(null);
  };

  // Remove Song from Program
  const handleRemoveItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProgram) return;

    await deleteLocalProgramItem(itemId, selectedProgram.id);
    await refreshProgramItems(selectedProgram.id);
  };

  // Move Song Up/Down (Touch & mobile friendly)
  const handleMoveItem = async (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProgram) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= programItems.length) return;

    const reordered = [...programItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const reorderedIds = reordered.map((item) => item.id);
    await reorderLocalProgramItems(selectedProgram.id, reorderedIds);
    await refreshProgramItems(selectedProgram.id);
  };

  // Drag and Drop Handlers (HTML5)
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !selectedProgram) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...programItems];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDraggedIndex(null);
    setDragOverIndex(null);

    const reorderedIds = reordered.map((item) => item.id);
    await reorderLocalProgramItems(selectedProgram.id, reorderedIds);
    await refreshProgramItems(selectedProgram.id);
  };

  // Filtered library songs for "Add Song" picker
  const filteredLibraryPickerSongs = librarySongs.filter(
    (s) =>
      !s.isDeleted &&
      (s.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
        s.category?.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
        s.ragam?.toLowerCase().includes(librarySearchQuery.toLowerCase()))
  );

  // Compute total duration of program
  const totalProgramDuration = resolvedProgramSongs.reduce(
    (acc, cur) => acc + (cur.song.duration || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sage border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-charcoal-muted">Loading Programs...</span>
        </div>
      </div>
    );
  }

  // ==============================================================================
  // VIEW 2: PROGRAM DETAIL & SEQUENCE VIEW
  // ==============================================================================
  if (selectedProgram) {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-6 w-full space-y-4">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedProgram(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-muted hover:text-charcoal transition-colors py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Programs</span>
          </button>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setProgramTitle(selectedProgram.title);
                setProgramDescription(selectedProgram.description || '');
                setProgramEventDate(selectedProgram.eventDate || '');
                setIsEditModalOpen(true);
              }}
              className="text-xs h-8 px-2 text-charcoal-muted hover:text-charcoal"
              title="Edit Program Details"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => handleDuplicate(selectedProgram, e)}
              className="text-xs h-8 px-2 text-charcoal-muted hover:text-charcoal"
              title="Duplicate Program"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => handleDeleteProgram(selectedProgram.id, e)}
              className="text-xs h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              title="Delete Program"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Program Summary Card */}
        <Card className="p-4 sm:p-5 space-y-3 bg-canvas-card border-border shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-charcoal">
                  {selectedProgram.title}
                </h2>
                {selectedProgram.eventDate && (
                  <Badge variant="sage" size="sm">
                    {formatDate(selectedProgram.eventDate)}
                  </Badge>
                )}
              </div>

              {selectedProgram.description && (
                <p className="text-xs text-charcoal-muted mt-1 leading-relaxed">
                  {selectedProgram.description}
                </p>
              )}
            </div>

            {/* Program Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setLibrarySearchQuery('');
                  setAddSongTab('library');
                  setIsAddSongModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-4 h-4 text-sage" />
                <span>Add Songs</span>
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handlePlayProgramFromStart}
                disabled={resolvedProgramSongs.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold shadow-subtle"
                title="Play program from beginning"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play All</span>
              </Button>
            </div>
          </div>

          {/* Sequence Statistics Bar */}
          <div className="pt-2 border-t border-border/70 flex items-center justify-between text-xs text-charcoal-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-charcoal">
                <Music2 className="w-3.5 h-3.5 text-sage" />
                <span>{resolvedProgramSongs.length} items in sequence</span>
              </span>

              {totalProgramDuration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-charcoal-subtle" />
                  <span>{formatDuration(totalProgramDuration)} total</span>
                </span>
              )}
            </div>

            <span className="text-[11px] text-sage font-medium bg-sage-light/60 px-2 py-0.5 rounded-md">
              Drag handle or arrows to reorder
            </span>
          </div>
        </Card>

        {/* Ordered Rehearsal Songs List */}
        <div className="space-y-2">
          {resolvedProgramSongs.length === 0 ? (
            <div className="text-center py-16 px-4 bg-canvas-card border border-dashed border-border rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-sage-light text-sage flex items-center justify-center mx-auto mb-3">
                <Music2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-charcoal">No Songs in This Program</h3>
              <p className="text-xs text-charcoal-muted mt-1 max-w-sm mx-auto leading-relaxed">
                Add songs from your school music repository or upload custom performance cuts.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setLibrarySearchQuery('');
                  setAddSongTab('library');
                  setIsAddSongModalOpen(true);
                }}
                className="mt-4 text-xs font-semibold"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>Add Songs from Library</span>
              </Button>
            </div>
          ) : (
            resolvedProgramSongs.map(({ item, song }, index) => {
              const isThisPlaying = currentSong?.id === song.id && isPlaying;
              const isThisSelected = currentSong?.id === song.id;
              const isDragged = draggedIndex === index;
              const isOver = dragOverIndex === index;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    'group flex items-center justify-between p-3 rounded-xl border transition-all duration-150',
                    isDragged && 'opacity-40 border-dashed border-sage bg-canvas-subtle',
                    isOver && 'border-sage border-2 bg-sage-light/30',
                    !isDragged && !isOver && isThisPlaying && 'bg-sage-light/40 border-sage ring-2 ring-sage/40 shadow-card',
                    !isDragged && !isOver && !isThisPlaying && isThisSelected && 'bg-canvas-subtle border-border-strong',
                    !isDragged && !isOver && !isThisSelected && 'bg-canvas-card border-border hover:border-border-strong'
                  )}
                >
                  {/* Left Controls: Drag Handle + Move Up/Down + Position Index */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 mr-1.5">
                    {/* Native Drag Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing p-1.5 text-charcoal-subtle hover:text-charcoal"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Touch Friendly Move Up/Down */}
                    <div className="flex flex-col -space-y-1">
                      <button
                        type="button"
                        onClick={(e) => handleMoveItem(index, 'up', e)}
                        disabled={index === 0}
                        className={cn(
                          'p-0.5 rounded text-charcoal-subtle hover:text-charcoal focus:outline-none',
                          index === 0 && 'opacity-20 cursor-not-allowed'
                        )}
                        aria-label="Move song up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMoveItem(index, 'down', e)}
                        disabled={index === resolvedProgramSongs.length - 1}
                        className={cn(
                          'p-0.5 rounded text-charcoal-subtle hover:text-charcoal focus:outline-none',
                          index === resolvedProgramSongs.length - 1 && 'opacity-20 cursor-not-allowed'
                        )}
                        aria-label="Move song down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Sequence Number */}
                    <span className="w-6 text-center text-xs font-mono font-bold text-charcoal-muted">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Song Row Content: Tap row to play immediately */}
                  <div
                    onClick={() => handlePlayProgramSong(song)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    {/* Play/Pause Button */}
                    <button
                      type="button"
                      aria-label={isThisPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-subtle',
                        isThisPlaying
                          ? 'bg-sage text-canvas'
                          : 'bg-canvas-subtle text-charcoal group-hover:bg-sage-light group-hover:text-sage-hover'
                      )}
                    >
                      {isThisPlaying ? (
                        isLoadingAudio ? (
                          <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4 fill-current" />
                        )
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Song Details */}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h4
                          className={cn(
                            'text-sm font-semibold truncate leading-tight',
                            isThisPlaying ? 'text-sage-hover font-bold' : 'text-charcoal'
                          )}
                        >
                          {song.title}
                        </h4>

                        {isThisPlaying && (
                          <span className="flex items-center text-[10px] text-sage font-bold uppercase tracking-wider bg-canvas px-1.5 py-0.5 rounded-full ring-1 ring-sage/30 flex-shrink-0">
                            <Volume2 className="w-3 h-3 mr-1 animate-pulse" />
                            Playing
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
                        {item.sourceType === 'program_audio' && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                            Custom Cut
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Duration & Remove item */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {song.duration !== null && (
                      <span className="text-xs text-charcoal-muted font-medium">
                        {formatDuration(song.duration)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleRemoveItem(item.id, e)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal-subtle hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove from program sequence"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Song to Program Modal */}
        <Modal
          isOpen={isAddSongModalOpen}
          onClose={() => setIsAddSongModalOpen(false)}
          title="Add Song to Program"
          description="Select existing music from your library or upload an edited performance cut."
        >
          <div className="space-y-4 py-1">
            {/* Modal Tabs */}
            <div className="flex border-b border-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddSongTab('library')}
                className={`pb-2 px-3 border-b-2 transition-colors ${
                  addSongTab === 'library'
                    ? 'border-sage text-sage-hover'
                    : 'border-transparent text-charcoal-muted hover:text-charcoal'
                }`}
              >
                From Music Library
              </button>
              <button
                type="button"
                onClick={() => setAddSongTab('upload')}
                className={`pb-2 px-3 border-b-2 transition-colors ${
                  addSongTab === 'upload'
                    ? 'border-sage text-sage-hover'
                    : 'border-transparent text-charcoal-muted hover:text-charcoal'
                }`}
              >
                Upload Edited Audio Cut
              </button>
            </div>

            {addSongTab === 'library' ? (
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Filter library songs by name, category..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-charcoal-muted" />}
                  autoFocus
                />

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {filteredLibraryPickerSongs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-charcoal-muted">
                      No matching songs found in library.
                    </div>
                  ) : (
                    filteredLibraryPickerSongs.map((song) => {
                      const isAlreadyInProgram = programItems.some((it) => it.songId === song.id);

                      return (
                        <div
                          key={song.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-canvas-card hover:bg-canvas-subtle transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-xs font-semibold text-charcoal block truncate">
                              {song.title}
                            </span>
                            <span className="text-[11px] text-charcoal-muted truncate block">
                              {song.category || 'General'} {song.ragam ? `• ${song.ragam}` : ''}
                            </span>
                          </div>

                          <Button
                            variant={isAlreadyInProgram ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => handleAddSongFromLibrary(song)}
                            className="text-xs h-7 px-2.5 flex items-center gap-1"
                          >
                            {isAlreadyInProgram ? (
                              <>
                                <Check className="w-3 h-3 text-sage" />
                                <span>Add Again</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button variant="secondary" size="sm" onClick={() => setIsAddSongModalOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadPerformanceCut} className="space-y-3.5">
                <input
                  ref={customFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setUploadFile(file);
                      if (!uploadTitle) {
                        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  className="hidden"
                />

                <Input
                  label="Display Title"
                  type="text"
                  placeholder="e.g. Jatiswaram (Cut at 2nd Jati for Recital)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">
                    Select Audio File
                  </label>
                  <div
                    onClick={() => customFileInputRef.current?.click()}
                    className="p-4 rounded-xl border-2 border-dashed border-border hover:border-sage bg-canvas-card cursor-pointer text-center space-y-1.5 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-sage mx-auto" />
                    <p className="text-xs font-semibold text-charcoal">
                      {uploadFile ? uploadFile.name : 'Click to select audio file from device'}
                    </p>
                    <p className="text-[10px] text-charcoal-muted">
                      MP3, WAV, M4A, AAC, OGG supported. Stored separately from music library.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsAddSongModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!uploadFile}
                  >
                    Attach Audio Cut
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>

        {/* Edit Program Details Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Program Details"
        >
          <form onSubmit={handleUpdateProgram} className="space-y-3.5 py-1">
            <Input
              label="Program Title"
              type="text"
              value={programTitle}
              onChange={(e) => setProgramTitle(e.target.value)}
              required
            />

            <Input
              label="Event Date (Optional)"
              type="date"
              value={programEventDate}
              onChange={(e) => setProgramEventDate(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={programDescription}
                onChange={(e) => setProgramDescription(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-border bg-canvas-card text-charcoal focus:outline-none focus:border-sage resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ==============================================================================
  // VIEW 1: PROGRAMS LIST VIEW
  // ==============================================================================
  const filteredPrograms = programs.filter(
    (p) =>
      !p.isDeleted &&
      (p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full space-y-4">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-charcoal">Dance Programs</h2>
          <p className="text-sm text-charcoal-muted mt-0.5">
            Stage performance sequences, annual days, and recital setlists
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setProgramTitle('');
            setProgramDescription('');
            setProgramEventDate('');
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 shadow-subtle text-xs font-semibold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Program</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search programs by title or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-charcoal-muted" />}
          className="bg-canvas-card text-sm py-2.5 pl-10 pr-4 shadow-subtle border-border focus:border-sage"
        />
      </div>

      {/* Programs List */}
      <div className="space-y-3 pt-1">
        {filteredPrograms.length === 0 ? (
          <div className="text-center py-16 px-4 bg-canvas-card border border-border/80 rounded-2xl">
            <CalendarRange className="w-12 h-12 text-charcoal-subtle mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-charcoal">No Programs Found</h3>
            <p className="text-xs text-charcoal-muted mt-1 max-w-sm mx-auto leading-relaxed">
              Create a program to organize dance performance sequences, reorder items with drag-and-drop, and attach edited audio.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4"
            >
              Create Program
            </Button>
          </div>
        ) : (
          filteredPrograms.map((prog) => (
            <Card
              key={prog.id}
              onClick={() => setSelectedProgram(prog)}
              className="hover:border-sage cursor-pointer transition-all duration-150 p-4 space-y-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-charcoal group-hover:text-sage-hover transition-colors leading-snug">
                      {prog.title}
                    </h3>
                    {prog.eventDate && (
                      <Badge variant="sage" size="sm">
                        {formatDate(prog.eventDate)}
                      </Badge>
                    )}
                  </div>

                  {prog.description && (
                    <p className="text-xs text-charcoal-muted mt-1 line-clamp-2 leading-relaxed">
                      {prog.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => handleDuplicate(prog, e)}
                    className="text-xs h-8 px-2 text-charcoal-muted hover:text-charcoal"
                    title="Duplicate Program"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => handleDeleteProgram(prog.id, e)}
                    className="text-xs h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    title="Delete Program"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Meta details & Play action */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-charcoal-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-charcoal">
                    <Music2 className="w-3.5 h-3.5 text-sage" />
                    <span>View Repertoire Sequence &rarr;</span>
                  </span>

                  <span className="hidden sm:inline text-charcoal-subtle">
                    By {prog.createdByName || 'Member'}
                  </span>
                </div>

                <span className="text-xs text-sage font-semibold group-hover:underline">
                  Open Program &rarr;
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Feature Capabilities Spotlight */}
      <div className="p-4 rounded-xl bg-canvas-subtle/70 border border-border/80 text-xs space-y-2 mt-4">
        <div className="flex items-center gap-2 font-semibold text-charcoal">
          <Sparkles className="w-4 h-4 text-sage" />
          <span>Collaborative Performance Features</span>
        </div>
        <ul className="text-charcoal-muted space-y-1 pl-4 list-disc">
          <li><strong>Open & Reorder</strong>: Tap any program to open its sequence and drag songs into order.</li>
          <li><strong>Individual Playback</strong>: Tap any song to rehearse it directly without waiting.</li>
          <li><strong>Library Sharing</strong>: Reuses original audio without duplicating storage.</li>
          <li><strong>Custom Edited Cuts</strong>: Upload trimmed audio specifically for stage performances.</li>
        </ul>
      </div>

      {/* Create Program Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Dance Program"
        description="Organize a performance sequence for an annual day, festival, or stage recital."
      >
        <form onSubmit={handleCreateProgram} className="space-y-3.5 py-1">
          <Input
            label="Program Title"
            type="text"
            placeholder="e.g. Annual Day 2027 or Kuchipudi Festival"
            value={programTitle}
            onChange={(e) => setProgramTitle(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Event Date (Optional)"
            type="date"
            value={programEventDate}
            onChange={(e) => setProgramEventDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Senior students recital sequence, costumes, ragam details..."
              value={programDescription}
              onChange={(e) => setProgramDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-border bg-canvas-card text-charcoal focus:outline-none focus:border-sage resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Create Program
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
