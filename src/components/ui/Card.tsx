import React from 'react';
import { cn } from '../../utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'interactive';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-canvas-card border border-border shadow-subtle',
      subtle: 'bg-canvas-subtle/70 border border-border-subtle',
      interactive:
        'bg-canvas-card border border-border shadow-subtle hover:border-border-strong hover:shadow-card active:scale-[0.99] transition-all duration-150 cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-xl p-4', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
