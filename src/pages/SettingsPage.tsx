import React, { useState, useEffect, useCallback } from 'react';
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
  KeyRound,
  ShieldCheck,
  UserX,
  Check,
  X,
  RefreshCw,
  Copy,
  AlertTriangle,
  Smartphone,
  Download,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  Song,
  ActivityLogEntry,
  PasswordResetRequest,
  StorageEstimateInfo,
} from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils';
import {
  getDetailedStorageEstimate,
  requestPersistentStorage,
} from '../services/db';
import {
  fetchPendingStudents,
  fetchActiveStudents,
  approveStudent,
  rejectStudent,
  removeStudent,
  fetchPasswordResetRequests,
  approvePasswordReset,
} from '../services/auth';

export interface SettingsPageProps {
  user: UserProfile | null;
  onRoleSwitch?: (role: UserRole) => void;
  onSignOut: () => void;
  deletedSongs: Song[];
  activityLogs: ActivityLogEntry[];
  onRestoreSong: (songId: string) => void;
  onPermanentlyDeleteSong: (songId: string) => void;
  onEmptyRecoveryBin: () => void;
  onRefreshUserData?: () => void;
  onOpenInstall?: () => void;
  isStandalone?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  onRoleSwitch,
  onSignOut,
  deletedSongs,
  activityLogs,
  onRestoreSong,
  onPermanentlyDeleteSong,
  onEmptyRecoveryBin,
  onOpenInstall,
  isStandalone = false,
}) => {
  const isTeacher = user?.role === 'TEACHER';

  // Modals
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isTeacherAdminModalOpen, setIsTeacherAdminModalOpen] = useState(false);

  // Offline Storage Info
  const [isStoragePersisted, setIsStoragePersisted] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await getDetailedStorageEstimate();
      setStorageInfo(info);
      setIsStoragePersisted(info.isPersisted);
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  // Teacher Administration Data
  const [activeTab, setActiveTab] = useState<'pending' | 'students' | 'resets'>('pending');
  const [pendingStudents, setPendingStudents] = useState<UserProfile[]>([]);
  const [activeStudents, setActiveStudents] = useState<UserProfile[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [isTeacherDataLoading, setIsTeacherDataLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Student Removal Confirmation
  const [studentToRemove, setStudentToRemove] = useState<UserProfile | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Approved Password Reset Code Display Modal
  const [revealedResetCode, setRevealedResetCode] = useState<{ code: string; username: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Empty Bin Confirmation Modal
  const [isEmptyBinConfirmOpen, setIsEmptyBinConfirmOpen] = useState(false);

  // Load teacher management data
  const loadTeacherAdminData = useCallback(async () => {
    if (!isTeacher) return;
    setIsTeacherDataLoading(true);
    try {
      const [pending, active, resets] = await Promise.all([
        fetchPendingStudents(),
        fetchActiveStudents(),
        fetchPasswordResetRequests(),
      ]);
      setPendingStudents(pending);
      setActiveStudents(active);
      setResetRequests(resets);
    } catch (e) {
      console.error('Failed to load teacher admin data:', e);
    } finally {
      setIsTeacherDataLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    if (isTeacher) {
      loadTeacherAdminData();
    }
  }, [isTeacher, loadTeacherAdminData]);

  const handleRequestStorage = async () => {
    const granted = await requestPersistentStorage();
    setIsStoragePersisted(granted);
    await loadStorageInfo();
    alert(
      granted
        ? 'Persistent storage granted! Repertoire music in IndexedDB is protected against browser clearing.'
        : 'Storage persistence status updated.'
    );
  };

  // Teacher approves student
  const handleApproveStudent = async (studentId: string) => {
    const res = await approveStudent(studentId);
    if (res.success) {
      setActionSuccessMessage('Student registration approved! They now have library access.');
      await loadTeacherAdminData();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } else {
      alert(res.error || 'Failed to approve student');
    }
  };

  // Teacher rejects student
  const handleRejectStudent = async (studentId: string) => {
    if (!confirm('Reject this student registration request?')) return;
    const res = await rejectStudent(studentId);
    if (res.success) {
      setActionSuccessMessage('Student registration request rejected.');
      await loadTeacherAdminData();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } else {
      alert(res.error || 'Failed to reject student');
    }
  };

  // Teacher removes active student
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemoving(true);
    try {
      const res = await removeStudent(studentToRemove.id);
      if (res.success) {
        setActionSuccessMessage(`Student @${studentToRemove.username} removed. Access revoked immediately.`);
        setStudentToRemove(null);
        await loadTeacherAdminData();
        setTimeout(() => setActionSuccessMessage(null), 4000);
      } else {
        alert(res.error || 'Failed to remove student');
      }
    } finally {
      setIsRemoving(false);
    }
  };

  // Teacher approves password reset
  const handleApproveReset = async (requestId: string) => {
    const res = await approvePasswordReset(requestId);
    if (res.success && res.resetCode) {
      const targetReq = resetRequests.find((r) => r.id === requestId);
      setRevealedResetCode({
        code: res.resetCode,
        username: targetReq?.username || 'student',
      });
      await loadTeacherAdminData();
    } else {
      alert(res.error || 'Failed to approve reset request');
    }
  };

  const handleCopyCode = () => {
    if (!revealedResetCode) return;
    navigator.clipboard.writeText(revealedResetCode.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-charcoal">Account & Settings</h2>
        <p className="text-sm text-charcoal-muted mt-0.5">
          Manage your profile, dance school accounts, and offline storage
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
            <span>Approved {isTeacher ? 'Teacher / Administrator' : 'Dance Student'}</span>
          </div>
        </div>
      </Card>

      {/* Role Simulator (Testing Teacher vs Student view during development) */}
      {onRoleSwitch && (
        <Card className="bg-canvas-subtle/50 space-y-3">
          <div className="flex items-center gap-2 text-charcoal">
            <Sparkles className="w-4 h-4 text-sage" />
            <h4 className="text-sm font-semibold">Role View Switcher</h4>
          </div>
          <p className="text-xs text-charcoal-muted leading-relaxed">
            Test how the interface adapts between the Dance Teacher and approved Students.
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
      )}

      {/* Teacher Administration Hub (Teacher Only) */}
      {isTeacher && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              Teacher Administration
            </h4>
            <span className="text-[11px] font-semibold text-sage flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full School Controls</span>
            </span>
          </div>

          <Card className="space-y-4 border-sage-border bg-sage-light/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage-light text-sage flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-charcoal">Student & Account Management</h4>
                  <p className="text-xs text-charcoal-muted">
                    {pendingStudents.length} pending registration{pendingStudents.length === 1 ? '' : 's'} •{' '}
                    {resetRequests.length} reset request{resetRequests.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  loadTeacherAdminData();
                  setIsTeacherAdminModalOpen(true);
                }}
                className="text-xs font-semibold"
              >
                Manage School
              </Button>
            </div>

            {/* Quick Pending Registrations Summary */}
            {pendingStudents.length > 0 && (
              <div className="pt-2 border-t border-sage-border/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-charcoal">
                    Pending Approvals ({pendingStudents.length})
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab('pending');
                      setIsTeacherAdminModalOpen(true);
                    }}
                    className="text-xs font-medium text-sage-hover hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pendingStudents.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-lg bg-canvas-card border border-border flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-charcoal block truncate">{s.fullName}</span>
                        <span className="text-[11px] text-charcoal-muted">@{s.username}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="sage-subtle"
                          size="sm"
                          onClick={() => handleApproveStudent(s.id)}
                          className="text-xs h-7 px-2"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRejectStudent(s.id)}
                          className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Android & PWA Setup */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-charcoal">
            <Smartphone className="w-4 h-4 text-sage" />
            <h4 className="text-sm font-semibold">Android &amp; PWA Setup</h4>
          </div>
          {isStandalone ? (
            <Badge variant="sage" size="sm">Installed</Badge>
          ) : (
            <Badge variant="neutral" size="sm">Browser Tab</Badge>
          )}
        </div>

        <p className="text-xs text-charcoal-muted leading-relaxed">
          {isStandalone
            ? 'Naatyavedam is running in standalone mode on your Android device with Web Share Target and native audio attachment sharing.'
            : 'Install this application to your Android phone home screen for full-screen offline use and WhatsApp audio sharing.'}
        </p>

        {!isStandalone && onOpenInstall && (
          <div className="pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenInstall}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App on Android / Home Screen</span>
            </Button>
          </div>
        )}
      </Card>

      {/* Offline Storage & Persistence Status */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-charcoal">
            <HardDrive className="w-4 h-4 text-sage" />
            <h4 className="text-sm font-semibold">Offline Device Storage</h4>
          </div>
          <span className="text-xs font-semibold text-sage">IndexedDB Active</span>
        </div>

        <p className="text-xs text-charcoal-muted leading-relaxed">
          Audio recordings and dance music are stored in your device&apos;s IndexedDB for offline rehearsals at the stage or academy.
        </p>

        {/* Live Storage Meter */}
        {storageInfo && storageInfo.quotaBytes > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-charcoal-muted">
              <span>Used: {(storageInfo.usageBytes / 1024 / 1024).toFixed(1)} MB</span>
              <span>Available: {(storageInfo.quotaBytes / 1024 / 1024 / 1024).toFixed(1)} GB</span>
            </div>
            <div className="w-full bg-border rounded-full h-2 overflow-hidden">
              <div
                className="bg-sage h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(1, storageInfo.percentageUsed))}%` }}
              />
            </div>
          </div>
        )}

        <div className="pt-1 flex items-center justify-between">
          <span className="text-xs text-charcoal-muted">
            Status: {isStoragePersisted ? 'Persistent storage enabled (Protected)' : 'Standard cache (Click to protect)'}
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
              <span className="text-sm font-medium text-charcoal block">Recovery Bin (Trash)</span>
              <span className="text-xs text-charcoal-muted">
                {deletedSongs.length} {deletedSongs.length === 1 ? 'song' : 'songs'} in recovery
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
          <span className="text-charcoal-muted">Role Security</span>
          <span className="font-semibold text-sage">Phase 4: Supabase Role-Based Auth</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-charcoal-muted">Offline Support</span>
          <span className="font-semibold text-charcoal">Dexie IndexedDB + Service Worker</span>
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

      {/* ============================================================================== */}
      {/* MODALS */}
      {/* ============================================================================== */}

      {/* Teacher Administration Modal */}
      <Modal
        isOpen={isTeacherAdminModalOpen}
        onClose={() => setIsTeacherAdminModalOpen(false)}
        title="Dance School Administration"
        description="Manage student registrations, active accounts, and password resets."
      >
        <div className="space-y-4 py-1">
          {actionSuccessMessage && (
            <div className="p-2.5 rounded-xl bg-sage-light border border-sage-border text-xs text-sage-hover flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-border text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'border-sage text-sage-hover'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <span>Pending Approvals</span>
              {pendingStudents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-sage text-canvas text-[10px]">
                  {pendingStudents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'students'
                  ? 'border-sage text-sage-hover'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <span>Active Students</span>
              <span className="text-[11px] text-charcoal-muted">({activeStudents.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('resets')}
              className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'resets'
                  ? 'border-sage text-sage-hover'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <span>Password Resets</span>
              {resetRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {resetRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Pending Approvals */}
          {activeTab === 'pending' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-charcoal-muted px-1">
                <span>Registration requests requiring teacher verification</span>
                <button
                  onClick={loadTeacherAdminData}
                  className="flex items-center gap-1 text-sage-hover hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isTeacherDataLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {pendingStudents.length === 0 ? (
                <div className="text-center py-8 text-charcoal-muted text-xs bg-canvas-subtle/50 rounded-xl border border-dashed border-border">
                  No pending student registration requests.
                </div>
              ) : (
                pendingStudents.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-border bg-canvas-card flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 text-left">
                      <h5 className="text-sm font-semibold text-charcoal truncate">{s.fullName}</h5>
                      <p className="text-xs text-charcoal-muted">
                        @{s.username} • Submitted {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveStudent(s.id)}
                        className="text-xs h-8 px-2.5"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRejectStudent(s.id)}
                        className="text-xs h-8 px-2.5 text-red-600 hover:text-red-700"
                        title="Reject registration"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Active Students */}
          {activeTab === 'students' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-charcoal-muted px-1">
                <span>Enrolled students with music library access</span>
                <button
                  onClick={loadTeacherAdminData}
                  className="flex items-center gap-1 text-sage-hover hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isTeacherDataLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {activeStudents.length === 0 ? (
                <div className="text-center py-8 text-charcoal-muted text-xs bg-canvas-subtle/50 rounded-xl border border-dashed border-border">
                  No enrolled students currently registered.
                </div>
              ) : (
                activeStudents.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-border bg-canvas-card flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 text-left">
                      <h5 className="text-sm font-semibold text-charcoal truncate">{s.fullName}</h5>
                      <p className="text-xs text-charcoal-muted">
                        @{s.username} • Enrolled {s.approvedAt ? formatDate(s.approvedAt) : formatDate(s.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setStudentToRemove(s)}
                      className="text-xs h-8 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      title="Remove student from school"
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Password Resets */}
          {activeTab === 'resets' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-charcoal-muted px-1">
                <span>Student password reset requests</span>
                <button
                  onClick={loadTeacherAdminData}
                  className="flex items-center gap-1 text-sage-hover hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isTeacherDataLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {resetRequests.length === 0 ? (
                <div className="text-center py-8 text-charcoal-muted text-xs bg-canvas-subtle/50 rounded-xl border border-dashed border-border">
                  No pending password reset requests.
                </div>
              ) : (
                resetRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-border bg-canvas-card flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 text-left">
                      <h5 className="text-sm font-semibold text-charcoal truncate">@{r.username}</h5>
                      <p className="text-xs text-charcoal-muted">
                        Requested {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveReset(r.id)}
                      className="text-xs h-8 px-2.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1" />
                      Approve & Get Code
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Student Confirmation Modal */}
      <Modal
        isOpen={Boolean(studentToRemove)}
        onClose={() => setStudentToRemove(null)}
        title="Revoke Student Access?"
        description="Immediate session revocation across all devices."
      >
        <div className="space-y-3 py-1">
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              Are you sure you want to remove <strong className="font-bold">@{studentToRemove?.username}</strong>?
              They will be signed out immediately and denied library access.
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStudentToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmRemoveStudent}
              disabled={isRemoving}
            >
              {isRemoving ? 'Revoking...' : 'Confirm Remove Student'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revealed Password Reset Code Modal (For Teacher to share with Student) */}
      <Modal
        isOpen={Boolean(revealedResetCode)}
        onClose={() => setRevealedResetCode(null)}
        title="Temporary Reset Code Generated"
        description="Share this 6-character code with the student."
      >
        <div className="space-y-4 py-2 text-center">
          <p className="text-xs text-charcoal-muted">
            The student <strong className="text-charcoal">@{revealedResetCode?.username}</strong> can now enter this code on the Sign In &rarr; Forgot Password screen to set their new password.
          </p>

          <div className="p-4 rounded-2xl bg-canvas-subtle border-2 border-dashed border-sage flex flex-col items-center justify-center gap-2">
            <span className="text-3xl font-mono font-extrabold tracking-widest text-charcoal">
              {revealedResetCode?.code}
            </span>
            <span className="text-[11px] text-sage font-medium">Valid for 24 hours</span>
          </div>

          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-sage" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied to Clipboard' : 'Copy Code'}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setRevealedResetCode(null)}
              className="text-xs font-semibold"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recovery Bin Modal (With Role-Based Deletion Permissions) */}
      <Modal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title="Shared Recovery Bin (Trash)"
        description="Deleted dance songs remain here so no school repertoire is accidentally lost."
      >
        <div className="space-y-3 py-1">
          {/* Role Permission Notice */}
          <div className="p-2.5 rounded-xl bg-canvas-subtle border border-border text-[11px] text-charcoal-muted flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-sage flex-shrink-0 mt-0.5" />
            <span>
              {isTeacher
                ? 'Teacher Controls: You can restore songs or permanently delete them from the library.'
                : 'Student Permissions: You can restore deleted songs to the library. Only the dance teacher can permanently delete songs.'}
            </span>
          </div>

          {/* Teacher Empty Bin Trigger */}
          {isTeacher && deletedSongs.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsEmptyBinConfirmOpen(true)}
                className="text-xs flex items-center gap-1 h-7"
              >
                <Trash2 className="w-3 h-3" />
                <span>Empty Recovery Bin</span>
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {deletedSongs.length === 0 ? (
              <div className="text-center py-8 text-charcoal-muted text-xs bg-canvas-subtle/50 rounded-xl border border-dashed border-border">
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
                      {song.category || 'Repertoire'} • Deleted
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="sage-subtle"
                      size="sm"
                      onClick={() => onRestoreSong(song.id)}
                      className="flex items-center gap-1 text-xs h-8 px-2.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </Button>

                    {/* Permanent Delete is strictly available to Teachers only */}
                    {isTeacher && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Permanently delete "${song.title}" from device? This cannot be undone.`)) {
                            onPermanentlyDeleteSong(song.id);
                          }
                        }}
                        className="text-xs h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        title="Permanently Delete Song (Teacher Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Empty Recovery Bin Confirmation Modal (Teacher Only) */}
      <Modal
        isOpen={isEmptyBinConfirmOpen}
        onClose={() => setIsEmptyBinConfirmOpen(false)}
        title="Empty Recovery Bin?"
        description="Permanent deletion from device storage."
      >
        <div className="space-y-3 py-1">
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>
              This will permanently delete all <strong className="font-bold">{deletedSongs.length} songs</strong> in the recovery bin. Their audio blobs will be permanently wiped from IndexedDB. This action cannot be undone.
            </span>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsEmptyBinConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onEmptyRecoveryBin();
                setIsEmptyBinConfirmOpen(false);
              }}
            >
              Permanently Empty Bin
            </Button>
          </div>
        </div>
      </Modal>

      {/* Activity History Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="School Activity Log"
        description="Chronological record of repertoire updates."
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {activityLogs.length === 0 ? (
            <div className="text-center py-8 text-charcoal-muted text-xs bg-canvas-subtle/50 rounded-xl border border-dashed border-border">
              No recent activity recorded yet.
            </div>
          ) : (
            activityLogs.map((log) => (
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
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
