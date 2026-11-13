import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { UserProfile, AppView } from '../../types';
import { Badge } from '../ui/Badge';

export interface TopHeaderProps {
  user: UserProfile | null;
  onNavigate: (view: AppView) => void;
  isOnline?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  onNavigate,
  isOnline = true,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-canvas/95 backdrop-blur-md border-b border-border/80 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Brand identity */}
        <button
          onClick={() => onNavigate('library')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-sage flex items-center justify-center text-canvas shadow-subtle group-hover:bg-sage-hover transition-colors">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-charcoal leading-none">
              Naatyavedam
            </h1>
            <span className="text-[11px] font-medium tracking-wide text-charcoal-muted uppercase">
              Kuchipudi Library
            </span>
          </div>
        </button>

        {/* Status & Profile Pill */}
        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          <div
            title={isOnline ? 'Online' : 'Offline mode active'}
            className="flex items-center text-xs text-charcoal-muted px-2 py-1 rounded-lg bg-canvas-subtle"
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-sage mr-1" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-600 mr-1" />
            )}
            <span className="text-[11px] hidden xs:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* User role / Settings button */}
          {user ? (
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border bg-canvas-card hover:bg-canvas-subtle transition-colors text-xs text-charcoal focus:outline-none"
            >
              <Badge variant={user.role === 'TEACHER' ? 'sage' : 'neutral'} size="sm">
                {user.role === 'TEACHER' ? 'Teacher' : 'Student'}
              </Badge>
              <span className="max-w-[80px] truncate hidden sm:inline font-medium">
                {user.username}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="text-xs font-semibold text-sage-hover hover:underline px-2 py-1"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

