import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-lg bg-canvas-card border border-border shadow-modal rounded-t-2xl sm:rounded-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-95 duration-200',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/60">
          <div>
            {title && <h3 className="text-lg font-semibold text-charcoal">{title}</h3>}
            {description && <p className="text-sm text-charcoal-muted mt-0.5">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
            className="h-10 w-10 min-h-0 min-w-0 -mr-2 -mt-1 text-charcoal-muted hover:text-charcoal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 bg-canvas-subtle/50 border-t border-border/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

