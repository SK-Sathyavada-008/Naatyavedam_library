import React, { useState } from 'react';
import { User, Lock, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AppView } from '../types';

export interface RegisterPageProps {
  onNavigate: (view: AppView) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please provide your full name');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // In Phase 1 local development state, simulate successful registration request
    setError('');
    setIsSubmitted(true);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 max-w-md mx-auto w-full min-h-screen">
      <div>
        <button
          onClick={() => onNavigate('login')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-muted hover:text-charcoal transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </button>

        {isSubmitted ? (
          <div className="p-6 rounded-2xl bg-canvas-card border border-border shadow-subtle text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-sage-light text-sage flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-charcoal">Registration Submitted</h3>
            <p className="text-sm text-charcoal-muted mt-2 leading-relaxed">
              Welcome, <strong className="text-charcoal">{fullName}</strong>! Your request to join as 
              <span className="font-semibold text-charcoal"> @{username}</span> has been queued.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-canvas-subtle border border-border text-xs text-charcoal-muted text-left flex gap-2.5">
              <ShieldAlert className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" />
              <span>
                To protect school dance compositions, the teacher must approve your registration before you can log in.
              </span>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('login')}
              className="mt-6 w-full"
            >
              Return to Sign In
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-charcoal">
                Student Registration
              </h2>
              <p className="text-sm text-charcoal-muted mt-1">
                Join your dance school's shared music repository
              </p>
            </div>

            {/* Note about teacher approval */}
            <div className="mb-5 p-3 rounded-xl bg-sage-light/60 border border-sage-border/50 text-xs text-sage-hover flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>All student accounts require one-time approval by the dance teacher.</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Input
                label="Full Name"
                type="text"
                placeholder="e.g. Ananya Rao"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <Input
                label="Username"
                type="text"
                placeholder="e.g. ananya_dance"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                leftIcon={<User className="w-4 h-4" />}
                helperText="Lowercase letters, numbers, and underscores"
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="pt-3">
                <Button type="submit" variant="primary" size="lg" className="w-full text-base font-semibold">
                  Submit Registration Request
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="pt-6 pb-4 text-center border-t border-border/80">
        <p className="text-sm text-charcoal-muted">
          Already registered?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="font-semibold text-sage-hover hover:underline"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
