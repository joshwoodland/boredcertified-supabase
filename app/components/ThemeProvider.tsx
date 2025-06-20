'use client';

import { useEffect } from 'react';

export default function ThemeProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Force dark mode immediately - add to both html and body for maximum compatibility
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    // Add dark class immediately
    htmlElement.classList.add('dark');
    bodyElement.classList.add('dark');
    
    // Set attributes for maximum compatibility
    htmlElement.setAttribute('data-theme', 'dark');
    htmlElement.style.colorScheme = 'dark';

    // Store dark mode setting in localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        settings.darkMode = true;
        localStorage.setItem('appSettings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error updating localStorage settings:', error);
        localStorage.setItem('appSettings', JSON.stringify({ darkMode: true }));
      }
    } else {
      localStorage.setItem('appSettings', JSON.stringify({ darkMode: true }));
    }

    // Watch for any attempts to remove dark mode and re-add it
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (!htmlElement.classList.contains('dark')) {
            htmlElement.classList.add('dark');
          }
          if (!bodyElement.classList.contains('dark')) {
            bodyElement.classList.add('dark');
          }
        }
      });
    });

    // Start observing
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(bodyElement, { attributes: true, attributeFilter: ['class'] });

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
} 