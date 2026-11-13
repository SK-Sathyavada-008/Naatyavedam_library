import React, { useState } from 'react';
import { User, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AppView, UserRole } from '../types';

export interface LoginPageProps {
  onNavigate: (view: AppView) => void;
  onLoginSuccess: (role: UserRole, username: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    // Phase 1 local state test authentication:
    // If username contains teacher or guru -> teacher, otherwise student
    const role: UserRole = username.toLowerCase().includes('teacher') || username.toLowerCase().includes('guru')
      ? 'TEACHER'
      : 'STUDENT';

    onLoginSuccess(role, username.trim());
  };

  const handleQuickFill = (role: UserRole) => {
    if (role === 'TEACHER') {
      setUsername('guru_keerthana');
      setPassword('teacher123');
    } else {
      setUsername('ananya_dance');
      setPassword('student123');
    }
    setError('');
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            type="text"
            placeholder="e.g. guru_keerthana or ananya"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
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
              setError('');
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

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" variant="primary" size="lg" className="w-full text-base font-semibold">
              Sign In
            </Button>
          </div>
        </form>

        {/* Phase 1 Local Test Helper */}
        <div className="mt-8 p-3 rounded-xl bg-canvas-subtle/80 border border-border text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-subtle mb-2">
            Phase 1 Quick-Fill Credentials
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('TEACHER')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-canvas-card border border-border text-xs text-charcoal font-medium hover:border-sage"
            >
              Fill Teacher
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('STUDENT')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-canvas-card border border-border text-xs text-charcoal font-medium hover:border-sage"
            >
              Fill Student
            </button>
          </div>
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
    </div>
  );
};

