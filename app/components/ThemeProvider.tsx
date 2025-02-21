'use client';

import { useEffect } from 'react';

export default function ThemeProvider() {
  useEffect(() => {
    async function initializeTheme() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        const settings = await response.json();
        
        // Apply dark mode
        if (settings.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        // Store settings in localStorage for persistence
        localStorage.setItem('appSettings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error loading theme settings:', error);
        // Try to load from localStorage as fallback
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      }
    }
    initializeTheme();
  }, []);

  return null;
} 