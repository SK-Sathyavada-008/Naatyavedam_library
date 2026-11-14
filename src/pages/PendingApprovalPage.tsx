import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { UserProfile } from '../types';
import { revalidateSession } from '../services/auth';

export interface PendingApprovalPageProps {
  user: UserProfile;
  onApproved: (updatedProfile: UserProfile) => void;
  onSignOut: () => void;
}

export const PendingApprovalPage: React.FC<PendingApprovalPageProps> = ({
  user,
  onApproved,
  onSignOut,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const refreshed = await revalidateSession();
      if (refreshed && refreshed.status === 'APPROVED') {
        onApproved(refreshed);
      } else {
        setStatusMessage('Your registration is still awaiting teacher approval. Please check with Guru Veda.');
      }
    } catch {
      setStatusMessage('Unable to check approval status. Please verify your internet connection.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 max-w-md mx-auto w-full min-h-screen text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-5">
        <ShieldAlert className="w-9 h-9" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-charcoal">
        Registration Pending Approval
      </h2>

      <p className="text-sm text-charcoal-muted mt-2 leading-relaxed">
        Hello <strong className="text-charcoal">{user.fullName}</strong> (@{user.username}), your request to access Naatyavedam Library has been logged.
      </p>

      <Card className="my-6 text-left p-4 bg-canvas-card border-border/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
          <CheckCircle2 className="w-4 h-4 text-sage" />
          <span>Dance School Security</span>
        </div>
        <p className="text-xs text-charcoal-muted leading-relaxed">
          To protect school dance compositions and private rehearsal audio, the dance teacher must verify and approve each student account before library access is granted.
        </p>
      </Card>

      {statusMessage && (
        <div className="mb-4 p-3 rounded-xl bg-canvas-subtle border border-border text-xs text-charcoal leading-relaxed animate-in fade-in">
          {statusMessage}
        </div>
      )}

      <div className="space-y-3 w-full">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCheckStatus}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking Status...' : 'Check Approval Status'}</span>
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 text-charcoal-muted hover:text-charcoal"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
};

