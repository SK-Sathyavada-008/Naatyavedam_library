import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { AppView, UserProfile } from '../types';
import {
  signIn,
  requestPasswordReset,
  completePasswordReset,
  checkTeacherInitialized,
  initializeTeacher,
} from '../services/auth';

export interface LoginPageProps {
  onNavigate: (view: AppView) => void;
  onLoginSuccess: (profile: UserProfile) => void;
  revocationMessage?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
  revocationMessage,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(revocationMessage || null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Teacher Initialization State
  const [isTeacherInitialized, setIsTeacherInitialized] = useState<boolean>(true);
  const [initTeacherLoading, setInitTeacherLoading] = useState(false);
  const [initSuccessMessage, setInitSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkInit() {
      const initialized = await checkTeacherInitialized();
      setIsTeacherInitialized(initialized);
    }
    checkInit();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn(cleanUser, password);

      if (!result.success || !result.profile) {
        setError(result.error || 'Invalid credentials.');
        return;
      }

      onLoginSuccess(result.profile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (presetUser: string, presetPass: string) => {
    setUsername(presetUser);
    setPassword(presetPass);
    setError(null);
  };

  // Submit Password Reset Request (Step 1)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const clean = forgotUsername.trim().toLowerCase();
    if (!clean) {
      setForgotError('Please enter your username.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const result = await requestPasswordReset(clean);
      if (result.success) {
        setForgotSuccess(result.message);
        // Prompt student to enter the code when ready
      } else {
        setForgotError(result.error || 'Failed to submit reset request.');
      }
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Complete Password Reset with Teacher-approved 6-character code (Step 2)
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const cleanUser = forgotUsername.trim().toLowerCase();
    const cleanCode = resetCode.trim().toUpperCase();

    if (!cleanUser) {
      setForgotError('Please enter your username.');
      return;
    }
    if (!cleanCode || cleanCode.length < 6) {
      setForgotError('Please enter the 6-character reset code provided by your teacher.');
      return;
    }
    if (newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const result = await completePasswordReset(cleanUser, cleanCode, newPassword);
      if (result.success) {
        setForgotSuccess('Password reset successfully! You can now sign in with your new password.');
        setUsername(cleanUser);
        setPassword(newPassword);
        setTimeout(() => {
          setIsForgotModalOpen(false);
          setForgotStep('request');
        }, 2000);
      } else {
        setForgotError(result.error || 'Password reset failed.');
      }
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // One-time teacher account setup if database has no teacher yet
  const handleOneTimeTeacherInit = async () => {
    setInitTeacherLoading(true);
    setError(null);
    try {
      const result = await initializeTeacher('veda', 'naatyavedam', 'Guru Veda');
      if (result.success) {
        setIsTeacherInitialized(true);
        setInitSuccessMessage('Teacher account initialized! Username: veda, Password: naatyavedam');
        setUsername('veda');
        setPassword('naatyavedam');
      } else {
        setError(result.error || 'Teacher initialization failed.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Teacher setup error.');
    } finally {
      setInitTeacherLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 max-w-md mx-auto w-full min-h-screen">
      {/* Top Header Navigation */}
      <div>
        <button
          onClick={() => onNavigate('welcome')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-muted hover:text-charcoal transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-charcoal">Sign In</h2>
          <p className="text-sm text-charcoal-muted mt-1">
            Access the Kuchipudi dance music library
          </p>
        </div>

        {/* Revocation or Init Success Banner */}
        {initSuccessMessage && (
          <div className="mb-4 p-3 rounded-xl bg-sage-light border border-sage-border text-xs text-sage-hover flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{initSuccessMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            type="text"
            placeholder="e.g. veda or your_username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase().trim());
              setError(null);
            }}
            leftIcon={<User className="w-4 h-4" />}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none hover:text-charcoal"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />

          {/* Forgot Password Link */}
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => {
                setForgotUsername(username);
                setForgotError(null);
                setForgotSuccess(null);
                setIsForgotModalOpen(true);
              }}
              className="text-xs font-semibold text-sage-hover hover:underline inline-flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Forgot Password?</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <div className="pt-2">
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
                  <span>Signing In...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </Button>
          </div>
        </form>

        {/* Quick Testing Credentials Helper */}
        <div className="mt-8 p-3 rounded-xl bg-canvas-subtle/80 border border-border text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-subtle mb-2">
            School Accounts Quick-Fill
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('veda', 'naatyavedam')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-canvas-card border border-border text-xs text-charcoal font-medium hover:border-sage transition-colors"
            >
              Teacher (veda)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('sk', 'naatyavedam')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-canvas-card border border-border text-xs text-charcoal font-medium hover:border-sage transition-colors"
            >
              Student (sk)
            </button>
          </div>

          {/* Teacher Initialization helper if needed */}
          {!isTeacherInitialized && (
            <div className="mt-3 pt-2 border-t border-border">
              <Button
                variant="sage-subtle"
                size="sm"
                onClick={handleOneTimeTeacherInit}
                disabled={initTeacherLoading}
                className="w-full text-xs"
              >
                {initTeacherLoading ? 'Initializing Teacher...' : 'Initialize Teacher (veda / naatyavedam)'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Switcher */}
      <div className="pt-6 pb-4 text-center border-t border-border/80">
        <p className="text-sm text-charcoal-muted">
          New dance student?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="font-semibold text-sage-hover hover:underline"
          >
            Request Student Access
          </button>
        </p>
      </div>

      {/* Forgot Password / Reset Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Student Password Reset"
        description="Dance school security: your teacher approves the reset and provides a 6-character code."
      >
        <div className="space-y-4 py-1">
          {/* Step Tabs */}
          <div className="flex border-b border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setForgotStep('request');
                setForgotError(null);
              }}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                forgotStep === 'request'
                  ? 'border-sage text-sage-hover'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              1. Request Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotStep('reset');
                setForgotError(null);
              }}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                forgotStep === 'reset'
                  ? 'border-sage text-sage-hover'
                  : 'border-transparent text-charcoal-muted hover:text-charcoal'
              }`}
            >
              2. Enter Code & New Password
            </button>
          </div>

          {forgotError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotSuccess && (
            <div className="p-2.5 rounded-lg bg-sage-light border border-sage-border text-xs text-sage-hover flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{forgotSuccess}</span>
            </div>
          )}

          {forgotStep === 'request' ? (
            <form onSubmit={handleRequestReset} className="space-y-3">
              <Input
                label="Your Username"
                type="text"
                placeholder="e.g. sk"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value.toLowerCase().trim())}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <div className="p-2.5 rounded-lg bg-canvas-subtle border border-border text-xs text-charcoal-muted flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" />
                <span>
                  After requesting, contact Guru Veda. The teacher will approve your request and give you a 6-character code.
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isForgotLoading}
                >
                  {isForgotLoading ? 'Submitting...' : 'Send Request to Teacher'}
                </Button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('reset')}
                  className="text-xs text-sage-hover font-semibold hover:underline"
                >
                  Already have a 6-character reset code? Enter it here &rarr;
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCompleteReset} className="space-y-3">
              <Input
                label="Your Username"
                type="text"
                placeholder="e.g. sk"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value.toLowerCase().trim())}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="6-Character Reset Code"
                type="text"
                placeholder="e.g. 7A4F2C"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.toUpperCase().trim())}
                maxLength={6}
                leftIcon={<KeyRound className="w-4 h-4" />}
                helperText="Provided by your dance teacher upon approval"
                required
              />

              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsForgotModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isForgotLoading}
                >
                  {isForgotLoading ? 'Saving Password...' : 'Set New Password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
