import React from 'react';
import { cn } from '../../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'sage' | 'neutral' | 'accent' | 'warning' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'sage',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    sage: 'bg-sage-light text-sage-hover border-sage-border/60',
    neutral: 'bg-canvas-subtle text-charcoal-muted border-border',
    accent: 'bg-amber-50 text-amber-800 border-amber-200',
    warning: 'bg-orange-50 text-orange-800 border-orange-200',
    outline: 'bg-transparent text-charcoal border-border',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-medium px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border tracking-wide uppercase font-semibold transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

