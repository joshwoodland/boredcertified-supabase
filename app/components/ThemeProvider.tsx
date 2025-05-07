'use client';

import { useEffect } from 'react';

export default function ThemeProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Always enable dark mode
    document.documentElement.classList.add('dark');

    // Store dark mode setting in localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      settings.darkMode = true;
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } else {
      localStorage.setItem('appSettings', JSON.stringify({ darkMode: true }));
    }
  }, []);

  return null;
} 