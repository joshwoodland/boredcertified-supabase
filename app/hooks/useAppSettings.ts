'use client';

import { useState, useEffect } from 'react';

export interface AppSettings {
  model: string;
  temperature: number;
  lowEchoCancellation: boolean;
  darkMode?: boolean;
  gptModel?: string;
  initialVisitPrompt?: string;
  followUpVisitPrompt?: string;
  autoSave?: boolean;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings from API');
      }
      
      const data = await response.json();
      if (!data) {
        throw new Error('No settings data received');
      }

      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, error, fetchSettings };
}
