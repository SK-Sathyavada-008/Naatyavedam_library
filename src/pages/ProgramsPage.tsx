import React, { useState } from 'react';
import {
  CalendarRange,
  Plus,
  Search,
  Sparkles,
  Music2,
  Play,
  Copy,
  Clock,
} from 'lucide-react';
import { Program, UserProfile } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils';

export interface ProgramsPageProps {
  user: UserProfile | null;
  onPlaySong?: (songId: string) => void;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({ user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  // Sample initial programs showcasing collaborative dance performance management
  const [programs, setPrograms] = useState<Program[]>([
    {
      id: 'prog-001',
      title: 'Annual Day Recital 2027',
      description: 'Senior & Junior Kuchipudi sequence: Pushpanjali, Jatiswaram, Shabdam, and Tarangam finale.',
      eventDate: '2027-02-20',
      createdBy: 'teacher-001',
      createdByName: 'Guru Veda',
      createdAt: '2026-11-14T10:00:00Z',
      updatedAt: '2026-11-14T10:00:00Z',
      isDeleted: false,
      itemCount: 4,
      totalDuration: 1140, // 19 mins
    },
    {
      id: 'prog-002',
      title: 'Kuchipudi Youth Dance Festival',
      description: 'Stage competition repertoire: Fast tempo Kalyani Jatiswaram and Manduka Shabdam.',
      eventDate: '2027-03-15',
      createdBy: 'student-001',
      createdByName: 'SK',
      createdAt: '2026-11-14T11:00:00Z',
      updatedAt: '2026-11-14T11:00:00Z',
      isDeleted: false,
      itemCount: 2,
      totalDuration: 520, // 8.6 mins
    },
  ]);

  const filteredPrograms = programs.filter(
    (p) =>
      !p.isDeleted &&
      (p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newProg: Program = {
      id: `prog-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      eventDate: newEventDate || undefined,
      createdBy: user?.id || 'local',
      createdByName: user?.fullName || 'Member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      itemCount: 0,
      totalDuration: 0,
    };

    setPrograms([newProg, ...programs]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewEventDate('');
  };

  const handleDuplicateProgram = (program: Program) => {
    const copy: Program = {
      ...program,
      id: `prog-${Date.now()}`,
      title: `${program.title} (Copy)`,
      createdByName: user?.fullName || 'Member',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPrograms([copy, ...programs]);
  };

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
          onClick={() => setIsCreateModalOpen(true)}
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
              className="hover:border-border-strong transition-all duration-150 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-charcoal leading-snug">
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

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDuplicateProgram(prog)}
                    className="text-xs h-8 px-2 text-charcoal-muted hover:text-charcoal"
                    title="Duplicate Program"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Meta details & Play action */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-charcoal-muted">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-charcoal">
                    <Music2 className="w-3.5 h-3.5 text-sage" />
                    <span>{prog.itemCount || 0} songs</span>
                  </span>

                  {prog.totalDuration ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-charcoal-subtle" />
                      <span>{Math.round(prog.totalDuration / 60)} min</span>
                    </span>
                  ) : null}

                  <span className="hidden sm:inline text-charcoal-subtle">
                    By {prog.createdByName || 'Member'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs h-7 px-2.5 flex items-center gap-1 font-semibold"
                  >
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                    <span>Play Sequence</span>
                  </Button>
                </div>
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
          <li><strong>Shared Library References</strong>: Add original songs without duplicating audio files.</li>
          <li><strong>Edited Audio Cuts</strong>: Upload program-specific trimmed audio safely.</li>
          <li><strong>Drag & Drop Sequence</strong>: Rearrange songs in performance order.</li>
          <li><strong>Sequential Playback</strong>: Plays through the entire dance program continuously.</li>
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
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Event Date (Optional)"
            type="date"
            value={newEventDate}
            onChange={(e) => setNewEventDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Senior students recital sequence, costumes, ragam details..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
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
