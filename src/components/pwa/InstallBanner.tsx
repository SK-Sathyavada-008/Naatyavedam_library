import React from 'react';
import { Smartphone, Download, X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export const InstallBanner: React.FC<InstallBannerProps> = ({
  onInstall,
  onDismiss,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sage-light via-canvas-card to-sage-light/60 border border-sage/30 p-3.5 sm:p-4 mb-4 shadow-subtle animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage text-canvas flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-charcoal">
              Install Naatyavedam Library App
            </h4>
            <p className="text-[11px] sm:text-xs text-charcoal-muted leading-relaxed">
              Add to your Android home screen for full-screen offline rehearsals and direct audio sharing from WhatsApp &amp; Files.
            </p>
            <div className="pt-1.5 flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={onInstall}
                className="text-xs h-7 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install on Phone</span>
              </Button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-[11px] text-charcoal-muted hover:text-charcoal px-2 py-1"
              >
                Not now
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-charcoal-muted hover:text-charcoal p-1 rounded-lg hover:bg-canvas transition-colors"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
