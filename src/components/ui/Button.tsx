import React from 'react';
import { cn } from '../../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'sage-subtle';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 rounded-xl';

    const variants = {
      primary: 'bg-sage text-canvas hover:bg-sage-hover active:bg-sage-active shadow-subtle',
      secondary: 'bg-canvas-card text-charcoal border border-border hover:bg-canvas-subtle hover:border-border-strong',
      'sage-subtle': 'bg-sage-light text-sage-hover hover:bg-sage-badge border border-sage-border/50',
      ghost: 'text-charcoal-muted hover:text-charcoal hover:bg-canvas-subtle',
      danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:bg-red-200',
    };

    const sizes = {
      sm: 'text-sm px-3 py-1.5 h-9',
      md: 'text-base px-4 py-2.5 min-h-touch',
      lg: 'text-lg px-6 py-3.5 min-h-[52px]',
      icon: 'h-12 w-12 p-0 min-h-touch min-w-touch flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

