import { useState, useEffect, useCallback } from 'react';

// Extend window event for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UsePwaInstallReturn {
  canInstall: boolean;
  isInstalled: boolean;
  isDismissed: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstall: () => void;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem('pwa_install_dismissed') === 'true';
  });

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone));

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Listen for beforeinstallprompt event (Chromium on Android / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 3. Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa_install_dismissed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA Install] Error triggering prompt:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem('pwa_install_dismissed', 'true');
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled && !isDismissed,
    isInstalled,
    isDismissed,
    promptInstall,
    dismissInstall,
  };
}
