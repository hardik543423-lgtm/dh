import React, { createContext, useContext, useState, useEffect } from 'react';

const PWAContext = createContext();

export const usePWA = () => useContext(PWAContext);

export const PWAProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      console.log('beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('App installed');
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      setIsStandalone(!!standalone);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    checkStandalone();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      return false;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === 'accepted';
  };

  return (
    <PWAContext.Provider value={{ isInstallable, isStandalone, installPWA }}>
      {children}
    </PWAContext.Provider>
  );
};
