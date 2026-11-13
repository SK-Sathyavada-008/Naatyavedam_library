import React, { useState } from 'react';
import {
  User,
  HardDrive,
  Trash2,
  LogOut,
  CheckCircle2,
  Users,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserProfile, UserRole, Song, ActivityLogEntry } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils';

export interface SettingsPageProps {
  user: UserProfile | null;
  onRoleSwitch: (role: UserRole) => void;
  onSignOut: () => void;
  deletedSongs: Song[];
  activityLogs: ActivityLogEntry[];
  onRestoreSong: (songId: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  onRoleSwitch,
  onSignOut,
  deletedSongs,
  activityLogs,
  onRestoreSong,
}) => {
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isStoragePersisted, setIsStoragePersisted] = useState(false);

  const handleRequestStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      setIsStoragePersisted(persisted);
      alert(persisted ? 'Persistent local storage granted!' : 'Storage persistence not granted by browser.');
    } else {
      alert('Persistent storage API not supported on this browser.');
    }
  };

  const isTeacher = user?.role === 'TEACHER';

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-charcoal">Account & Settings</h2>
        <p className="text-sm text-charcoal-muted mt-0.5">
          Manage your profile, offline storage, and school preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-sage-light text-sage flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-charcoal truncate">
              {user?.fullName || 'Kuchipudi Member'}
            </h3>
            <Badge variant={isTeacher ? 'sage' : 'neutral'} size="sm">
              {user?.role}
            </Badge>
          </div>
          <p className="text-xs text-charcoal-muted mt-0.5">
            @{user?.username || 'member'} • Joined {user ? formatDate(user.createdAt) : 'Recently'}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-sage font-medium mt-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Approved Member</span>
          </div>
        </div>
      </Card>

      {/* Phase 1 Role Simulator (Testing Teacher vs Student view) */}
      <Card className="bg-canvas-subtle/50 space-y-3">
        <div className="flex items-center gap-2 text-charcoal">
          <Sparkles className="w-4 h-4 text-sage" />
          <h4 className="text-sm font-semibold">Phase 1 Role Testing</h4>
        </div>
        <p className="text-xs text-charcoal-muted leading-relaxed">
          Switch roles to test how the interface adapts between the Dance Teacher and approved Students.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant={isTeacher ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onRoleSwitch('TEACHER')}
            className="text-xs"
          >
            Dance Teacher View
          </Button>
          <Button
            variant={!isTeacher ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onRoleSwitch('STUDENT')}
            className="text-xs"
          >
            Dance Student View
          </Button>
        </div>
      </Card>

      {/* Offline Storage Status */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-charcoal">
            <HardDrive className="w-4 h-4 text-sage" />
            <h4 className="text-sm font-semibold">Offline Device Storage</h4>
          </div>
          <span className="text-xs font-semibold text-sage">52.4 MB Used</span>
        </div>

        <p className="text-xs text-charcoal-muted leading-relaxed">
          Audio files are cached in your device's IndexedDB for offline rehearsals at the dance hall.
        </p>

        <div className="pt-1 flex items-center justify-between">
          <span className="text-xs text-charcoal-muted">
            Status: {isStoragePersisted ? 'Persistent storage enabled' : 'Standard cache'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRequestStorage}
            className="text-xs"
          >
            {isStoragePersisted ? 'Protected' : 'Protect Storage'}
          </Button>
        </div>
      </Card>

      {/* School & Library Management */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted px-1">
          Library Management
        </h4>

        {/* Teacher Approvals (Teacher Only) */}
        {isTeacher && (
          <div className="p-3.5 rounded-xl border border-border bg-canvas-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sage-light text-sage flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-charcoal block">Student Registrations</span>
                <span className="text-xs text-charcoal-muted">0 pending requests</span>
              </div>
            </div>
            <Badge variant="neutral" size="sm">
              All Approved
            </Badge>
          </div>
        )}

        {/* Recovery Bin */}
        <button
          onClick={() => setIsRecoveryModalOpen(true)}
          className="w-full p-3.5 rounded-xl border border-border bg-canvas-card hover:bg-canvas-subtle flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-medium text-charcoal block">Recovery Bin</span>
              <span className="text-xs text-charcoal-muted">
                {deletedSongs.length} {deletedSongs.length === 1 ? 'item' : 'items'} in recovery
              </span>
            </div>
          </div>
          <span className="text-xs font-medium text-sage-hover">View Bin</span>
        </button>

        {/* Activity History */}
        <button
          onClick={() => setIsActivityModalOpen(true)}
          className="w-full p-3.5 rounded-xl border border-border bg-canvas-card hover:bg-canvas-subtle flex items-center justify-between transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-canvas-subtle text-charcoal flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-medium text-charcoal block">Activity History</span>
              <span className="text-xs text-charcoal-muted">Uploads, renames and changes</span>
            </div>
          </div>
          <span className="text-xs font-medium text-charcoal-muted">View</span>
        </button>
      </div>

      {/* Application Information */}
      <div className="p-4 rounded-xl bg-canvas-subtle/70 border border-border/80 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-charcoal-muted">Application</span>
          <span className="font-semibold text-charcoal">Naatyavedam Library PWA</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-charcoal-muted">Current Phase</span>
          <span className="font-semibold text-sage">Phase 1: Project Foundation</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-charcoal-muted">Offline Support</span>
          <span className="font-semibold text-charcoal">Service Worker & Workbox Ready</span>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Recovery Bin Modal */}
      <Modal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title="Shared Recovery Bin"
        description="Deleted dance songs remain here so no audio is accidentally lost."
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {deletedSongs.length === 0 ? (
            <div className="text-center py-8 text-charcoal-muted text-sm">
              The recovery bin is currently empty.
            </div>
          ) : (
            deletedSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-canvas-card"
              >
                <div className="min-w-0 flex-1 mr-2 text-left">
                  <h5 className="text-sm font-semibold text-charcoal truncate">{song.title}</h5>
                  <p className="text-xs text-charcoal-muted truncate">
                    {song.category} • Deleted
                  </p>
                </div>
                <Button
                  variant="sage-subtle"
                  size="sm"
                  onClick={() => {
                    onRestoreSong(song.id);
                  }}
                  className="flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Activity History Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="School Activity Log"
        description="Chronological record of repertoire updates"
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {activityLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl border border-border bg-canvas-card text-left text-xs"
            >
              <div className="flex items-center justify-between font-semibold text-charcoal mb-1">
                <span>{log.songTitle}</span>
                <Badge
                  variant={
                    log.action === 'UPLOAD'
                      ? 'sage'
                      : log.action === 'DELETE'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {log.action}
                </Badge>
              </div>
              <p className="text-charcoal-muted">
                By <strong className="text-charcoal">{log.performedByName}</strong>
                {log.details ? ` (${log.details})` : ''}
              </p>
              <span className="text-[10px] text-charcoal-subtle block mt-1">
                {formatDate(log.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
