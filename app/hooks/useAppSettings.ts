'use client';

import { useState, useEffect } from 'react';

interface AppSettings {
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  lowEchoCancellation: boolean;
  autoSave: boolean;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/settings');
        
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        
        const data = await response.json();
        
        setSettings({
          darkMode: data.darkMode ?? false,
          gptModel: data.gptModel ?? 'gpt-4o',
          initialVisitPrompt: data.initialVisitPrompt ?? '',
          followUpVisitPrompt: data.followUpVisitPrompt ?? '',
          lowEchoCancellation: data.lowEchoCancellation ?? false,
          autoSave: data.autoSave ?? false,
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        
        // Try to load from localStorage as fallback
        try {
          const savedSettings = localStorage.getItem('appSettings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            setSettings({
              darkMode: parsedSettings.darkMode ?? false,
              gptModel: parsedSettings.gptModel ?? 'gpt-4o',
              initialVisitPrompt: parsedSettings.initialVisitPrompt ?? '',
              followUpVisitPrompt: parsedSettings.followUpVisitPrompt ?? '',
              lowEchoCancellation: parsedSettings.lowEchoCancellation ?? false,
              autoSave: parsedSettings.autoSave ?? false,
            });
          }
        } catch (e) {
          console.error('Error loading from localStorage:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, isLoading, error };
}
