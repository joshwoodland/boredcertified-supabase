'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/app/lib/supabase';

export default function SettingsDebugPage() {
  const [clientSettings, setClientSettings] = useState<any>(null);
  const [apiSettings, setApiSettings] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Get user session info
        const supabase = supabaseBrowser;
        if (!supabase) {
          throw new Error('Failed to create Supabase client');
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }

        const session = sessionData.session;
        const userId = session?.user?.id;
        const userEmail = session?.user?.email;

        setUserInfo({
          isAuthenticated: !!session,
          userId,
          userEmail
        });

        console.log('[SETTINGS DEBUG] User info:', {
          isAuthenticated: !!session,
          userId,
          userEmail
        });

        // 2. Directly query Supabase from client
        if (userId) {
          console.log('[SETTINGS DEBUG] Fetching settings by user_id:', userId);
          const { data: userSettings, error: userSettingsError } = await supabase!
            .from('app_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (userSettingsError && userSettingsError.code !== 'PGRST116') {
            console.error('[SETTINGS DEBUG] Error fetching user settings:', userSettingsError);
          }

          if (userSettings) {
            console.log('[SETTINGS DEBUG] Found settings by user_id:', userSettings);
            setClientSettings({
              source: 'user_id',
              settings: userSettings
            });
          } else {
            console.log('[SETTINGS DEBUG] No settings found by user_id, trying email');

            if (userEmail) {
              const { data: emailSettings, error: emailSettingsError } = await supabase!
                .from('app_settings')
                .select('*')
                .eq('email', userEmail)
                .single();

              if (emailSettingsError && emailSettingsError.code !== 'PGRST116') {
                console.error('[SETTINGS DEBUG] Error fetching settings by email:', emailSettingsError);
              }

              if (emailSettings) {
                console.log('[SETTINGS DEBUG] Found settings by email:', emailSettings);
                setClientSettings({
                  source: 'email',
                  settings: emailSettings
                });
              } else {
                console.log('[SETTINGS DEBUG] No settings found by email, fetching default');

                const { data: defaultSettings, error: defaultSettingsError } = await supabase!
                  .from('app_settings')
                  .select('*')
                  .eq('id', 'default')
                  .single();

                if (defaultSettingsError) {
                  console.error('[SETTINGS DEBUG] Error fetching default settings:', defaultSettingsError);
                }

                if (defaultSettings) {
                  console.log('[SETTINGS DEBUG] Found default settings:', defaultSettings);
                  setClientSettings({
                    source: 'default',
                    settings: defaultSettings
                  });
                } else {
                  console.log('[SETTINGS DEBUG] No default settings found');
                  setClientSettings({
                    source: 'none',
                    settings: null
                  });
                }
              }
            }
          }
        } else {
          console.log('[SETTINGS DEBUG] No user ID, fetching default settings');

          const { data: defaultSettings, error: defaultSettingsError } = await supabase!
            .from('app_settings')
            .select('*')
            .eq('id', 'default')
            .single();

          if (defaultSettingsError) {
            console.error('[SETTINGS DEBUG] Error fetching default settings:', defaultSettingsError);
          }

          if (defaultSettings) {
            console.log('[SETTINGS DEBUG] Found default settings:', defaultSettings);
            setClientSettings({
              source: 'default',
              settings: defaultSettings
            });
          } else {
            console.log('[SETTINGS DEBUG] No default settings found');
            setClientSettings({
              source: 'none',
              settings: null
            });
          }
        }

        // 3. Fetch settings from API
        const apiResponse = await fetch('/api/debug/settings');
        if (!apiResponse.ok) {
          throw new Error(`API error: ${apiResponse.status}`);
        }

        const apiData = await apiResponse.json();
        console.log('[SETTINGS DEBUG] API settings:', apiData);
        setApiSettings(apiData);

      } catch (err) {
        console.error('[SETTINGS DEBUG] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings Debug Page</h1>

      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">User Information</h2>
            <pre className="bg-white dark:bg-gray-800 p-3 rounded overflow-auto max-h-40 text-black">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </div>

          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Client-side Settings</h2>
            <p className="text-sm text-gray-500 mb-2">
              Source: {clientSettings?.source || 'Unknown'}
            </p>
            <pre className="bg-white dark:bg-gray-800 p-3 rounded overflow-auto max-h-40 text-black">
              {JSON.stringify(clientSettings?.settings, null, 2)}
            </pre>
          </div>

          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">API Settings</h2>
            <p className="text-sm text-gray-500 mb-2">
              Source: {apiSettings?.source || 'Unknown'}
            </p>
            <pre className="bg-white dark:bg-gray-800 p-3 rounded overflow-auto max-h-40 text-black">
              {JSON.stringify(apiSettings?.settings, null, 2)}
            </pre>
          </div>

          <div className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Table Schema</h2>
            <pre className="bg-white dark:bg-gray-800 p-3 rounded overflow-auto max-h-40 text-black">
              {`app_settings columns:
- id (TEXT PRIMARY KEY)
- dark_mode (BOOLEAN)
- gpt_model (TEXT)
- initial_visit_prompt (TEXT)
- follow_up_visit_prompt (TEXT)
- auto_save (BOOLEAN)
- low_echo_cancellation (BOOLEAN)
- updated_at (TIMESTAMP)
- user_id (TEXT)
- email (TEXT)`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
