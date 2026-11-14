import React from 'react';
import { Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  canInstall: boolean;
  onPromptInstall: () => Promise<boolean>;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  canInstall,
  onPromptInstall,
}) => {
  const handleInstallClick = async () => {
    const success = await onPromptInstall();
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Install Naatyavedam on Android"
      description="Enjoy full-screen, offline-ready classical dance music access."
    >
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-sage-light/50 border border-sage/30">
          <div className="w-12 h-12 rounded-xl bg-canvas flex items-center justify-center text-sage font-bold text-lg shadow-subtle flex-shrink-0">
            న
          </div>
          <div>
            <h4 className="text-sm font-bold text-charcoal">Naatyavedam Library PWA</h4>
            <p className="text-xs text-charcoal-muted leading-tight mt-0.5">
              Works offline without browser URL bars or tabs.
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
            How to Install:
          </h5>

          <ol className="space-y-2.5 text-xs text-charcoal">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sage-light text-sage flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                1
              </span>
              <span>
                Open this app in <strong>Google Chrome</strong> on your Android phone.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sage-light text-sage flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                2
              </span>
              <span>
                Tap the <strong>⋮ (three dots)</strong> menu in Chrome&apos;s top-right corner.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sage-light text-sage flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                3
              </span>
              <span>
                Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.
              </span>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-sage-light text-sage flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                4
              </span>
              <span>
                Launch directly from your phone&apos;s home screen during rehearsals.
              </span>
            </li>
          </ol>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Maybe Later
          </Button>

          {canInstall ? (
            <Button
              variant="primary"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                alert("To add to home screen:\n\n• On Android Chrome: Tap the top-right 3-dots (⋮) menu and select 'Install app' or 'Add to Home screen'.\n\n• On iPhone Safari: Tap the Share button at the bottom and choose 'Add to Home Screen'.");
              }}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>How to Add</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
