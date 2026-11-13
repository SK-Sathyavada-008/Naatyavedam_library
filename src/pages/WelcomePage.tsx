import React from 'react';
import { Music2, ShieldCheck, WifiOff, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AppView, UserRole } from '../types';

export interface WelcomePageProps {
  onNavigate: (view: AppView) => void;
  onQuickLogin: (role: UserRole) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onNavigate,
  onQuickLogin,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 max-w-lg mx-auto w-full min-h-screen">
      {/* Top Brand Hero */}
      <div className="pt-8 sm:pt-14 text-center flex flex-col items-center">
        {/* Classical Natya Emblem */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-sage-light border border-sage-border/60 flex items-center justify-center text-sage mb-6 shadow-subtle">
          <svg
            className="w-10 h-10 sm:w-12 sm:h-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-charcoal">
          Naatyavedam Library
        </h1>
        <p className="text-xs font-semibold tracking-widest text-sage uppercase mt-1">
          Kuchipudi Dance Repository
        </p>

        <p className="text-charcoal-muted text-sm sm:text-base mt-4 max-w-sm leading-relaxed">
          A dedicated, offline-first audio library for the dance teacher and students to practice, organize, and share classical repertoire.
        </p>

        {/* Value pillars */}
        <div className="grid grid-cols-3 gap-3 w-full mt-8 pt-6 border-t border-border/80 text-left">
          <div className="flex flex-col items-center text-center p-2 rounded-xl bg-canvas-subtle/50">
            <Music2 className="w-5 h-5 text-sage mb-1.5" />
            <span className="text-xs font-medium text-charcoal">Shared Library</span>
            <span className="text-[11px] text-charcoal-muted mt-0.5">One collection</span>
          </div>
          <div className="flex flex-col items-center text-center p-2 rounded-xl bg-canvas-subtle/50">
            <WifiOff className="w-5 h-5 text-sage mb-1.5" />
            <span className="text-xs font-medium text-charcoal">Offline First</span>
            <span className="text-[11px] text-charcoal-muted mt-0.5">Dance anywhere</span>
          </div>
          <div className="flex flex-col items-center text-center p-2 rounded-xl bg-canvas-subtle/50">
            <ShieldCheck className="w-5 h-5 text-sage mb-1.5" />
            <span className="text-xs font-medium text-charcoal">Teacher Guided</span>
            <span className="text-[11px] text-charcoal-muted mt-0.5">Verified school</span>
          </div>
        </div>
      </div>

      {/* Action Buttons & Quick Demo Access */}
      <div className="pb-8 pt-6 flex flex-col gap-3.5">
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNavigate('login')}
          className="w-full flex items-center justify-center gap-2 text-base font-semibold"
        >
          <span>Sign In to Library</span>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => onNavigate('register')}
          className="w-full text-base font-semibold"
        >
          Register as Student
        </Button>

        {/* Phase 1 Local Dev Bypass Shortcuts */}
        <div className="mt-4 p-3 rounded-xl bg-canvas-subtle/80 border border-border/60 text-center">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-subtle mb-2">
            Phase 1 Quick Demo Modes
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onQuickLogin('TEACHER')}
              className="px-2.5 py-1.5 rounded-lg bg-canvas-card border border-border hover:border-sage text-xs font-medium text-charcoal transition-colors text-center"
            >
              Enter as Teacher
            </button>
            <button
              onClick={() => onQuickLogin('STUDENT')}
              className="px-2.5 py-1.5 rounded-lg bg-canvas-card border border-border hover:border-sage text-xs font-medium text-charcoal transition-colors text-center"
            >
              Enter as Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

