import React from 'react';
import { Music, CalendarRange, Disc3, Settings } from 'lucide-react';
import { AppView } from '../../types';
import { cn } from '../../utils';

export interface BottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  hasActiveTrack?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  hasActiveTrack = false,
}) => {
  const navItems = [
    {
      view: 'library' as AppView,
      label: 'Library',
      icon: Music,
    },
    {
      view: 'programs' as AppView,
      label: 'Programs',
      icon: CalendarRange,
    },
    {
      view: 'player' as AppView,
      label: 'Now Playing',
      icon: Disc3,
      badge: hasActiveTrack,
    },
    {
      view: 'settings' as AppView,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-canvas/95 backdrop-blur-md border-t border-border/80 pb-[env(safe-area-inset-bottom,0px)] select-none">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;

          return (
            <button
              key={item.view}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate(item.view);
              }}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full min-h-touch py-1 px-2 rounded-xl transition-colors touch-manipulation focus:outline-none',
                isActive
                  ? 'text-sage font-semibold'
                  : 'text-charcoal-muted hover:text-charcoal'
              )}
            >
              {/* Active subtle pill highlight */}
              <div
                className={cn(
                  'flex items-center justify-center w-12 h-7 rounded-full transition-colors mb-0.5',
                  isActive ? 'bg-sage-light text-sage-hover' : 'bg-transparent'
                )}
              >
                <Icon className={cn('w-5 h-5', item.view === 'player' && hasActiveTrack && 'animate-[spin_6s_linear_infinite]')} />
              </div>
              <span className="text-[11px] tracking-tight">{item.label}</span>

              {/* Indicator dot if active track and on other tab */}
              {item.badge && !isActive && (
                <span className="absolute top-2 right-1/3 w-2 h-2 rounded-full bg-sage ring-2 ring-canvas" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
