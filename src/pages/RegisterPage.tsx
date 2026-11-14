import React, { useState } from 'react';
import { User, Lock, ArrowLeft, CheckCircle2, ShieldAlert, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AppView } from '../types';
import { registerStudent, validateUsername, validatePassword } from '../services/auth';

export interface RegisterPageProps {
  onNavigate: (view: AppView) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFullName = fullName.trim();
    if (!cleanFullName) {
      setError('Please provide your full name.');
      return;
    }

    const userCheck = validateUsername(username);
    if (!userCheck.isValid) {
      setError(userCheck.error || 'Invalid username.');
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      setError(passCheck.error || 'Invalid password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerStudent(cleanFullName, username, password);
      if (!result.success) {
        setError(result.error || 'Failed to submit registration request.');
        return;
      }

      setIsSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
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
              <span className="font-semibold text-charcoal"> @{username.toLowerCase().trim()}</span> has been received.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-canvas-subtle border border-border text-xs text-charcoal-muted text-left flex gap-2.5">
              <ShieldAlert className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" />
              <span>
                To protect school dance compositions, the dance teacher must review and approve your registration before you can log in.
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-2 w-full">
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('login')}
                className="w-full font-semibold"
              >
                Return to Sign In
              </Button>
            </div>
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
                placeholder="e.g. SK"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setError(null);
                }}
                required
              />

              <Input
                label="Username"
                type="text"
                placeholder="e.g. sk"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().trim());
                  setError(null);
                }}
                leftIcon={<User className="w-4 h-4" />}
                helperText="2–20 lowercase letters, numbers, and underscores"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <div className="pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full text-base font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Request...</span>
                    </div>
                  ) : (
                    'Submit Registration Request'
                  )}
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
