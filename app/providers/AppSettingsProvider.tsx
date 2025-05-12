'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { debugClientCookies } from '@/app/utils/cookies';
import { AppSettings } from '@/app/lib/supabaseTypes';
import {
  supabaseToAppSettings,
  appToSupabaseSettings,
  applyDefaultSettings,
  generateUserSettingsId
} from '@/app/utils/settingsConverter';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_ID
} from '@/app/lib/defaultSettings';

interface AppSettingsContextType {
  settings: AppSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

// Add this function to help with debugging
const checkAuthCookies = () => {
  return debugClientCookies('AUTH DEBUG');
};

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Add a function to refresh settings that can be exposed to consumers
  const refreshSettings = async () => {
    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('[AUTH DEBUG] Cannot refresh settings - Supabase client not initialized');
      setError(new Error('Unable to initialize authentication client'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchOrInitSettings(session.user.id, session.user.email || null);
      } else {
        await fetchOrInitSettings(null, null);
      }
    } catch (error) {
      console.error('[AUTH DEBUG] Error refreshing settings:', error);
      setError(error instanceof Error ? error : new Error('Failed to refresh settings'));
    }
  };

  // Initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[AUTH DEBUG] Performing initial auth check');

        // Check if Supabase client is initialized
        if (!supabase) {
          console.error('[AUTH DEBUG] Cannot check auth - Supabase client not initialized');
          return null;
        }

        // Check cookies first
        const hasAuthCookies = checkAuthCookies();
        console.log('[AUTH DEBUG] Auth cookies present in browser:', hasAuthCookies);

        // Get session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AUTH DEBUG] Error getting session:', sessionError);
          return null;
        }

        if (session?.user) {
          console.log('[AUTH DEBUG] Session found:', {
            id: session.user.id,
            email: session.user.email,
            expires: new Date(session.expires_at! * 1000).toISOString()
          });
          return session;
        } else {
          console.log('[AUTH DEBUG] No session found, but cookies present:', hasAuthCookies);

          if (hasAuthCookies) {
            console.log('[AUTH DEBUG] Attempting to refresh session due to cookie mismatch');
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

              if (refreshError) {
                console.error('[AUTH DEBUG] Error refreshing session:', refreshError);
                return null;
              }

              if (refreshData.session) {
                console.log('[AUTH DEBUG] Session refreshed successfully:', {
                  id: refreshData.session.user.id,
                  email: refreshData.session.user.email
                });
                return refreshData.session;
              }
            } catch (refreshErr) {
              console.error('[AUTH DEBUG] Exception during session refresh:', refreshErr);
            }
          }

          console.log('[AUTH DEBUG] No session available after refresh attempt');
          return null;
        }
      } catch (err) {
        console.error('[AUTH DEBUG] Unexpected error in checkAuth:', err);
        return null;
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth().then(session => {
      if (session?.user) {
        fetchOrInitSettings(session.user.id, session.user.email || null);
      } else {
        fetchOrInitSettings(null, null);
      }
    });
  }, [supabase, retryCount]); // Add retryCount to retry the auth check if needed

  // Listen for auth state changes
  useEffect(() => {
    if (!authChecked) return;

    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('[AUTH DEBUG] Cannot set up auth listener - Supabase client not initialized');
      return;
    }

    console.log('[AUTH DEBUG] Setting up auth state change listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session) => {
      console.log('[AUTH DEBUG] Auth state changed:', event);

      if (session?.user) {
        const { id, email } = session.user;
        console.log('[AUTH DEBUG] User authenticated:', { id, email });
        fetchOrInitSettings(id, email || null);
      } else {
        console.log('[AUTH DEBUG] User logged out');
        fetchOrInitSettings(null, null);
      }
    });

    return () => {
      console.log('[AUTH DEBUG] Unsubscribing from auth changes');
      subscription.unsubscribe();
    };
  }, [supabase, authChecked]);

  async function fetchOrInitSettings(userId: string | null, email: string | null) {
    try {
      setIsLoading(true);
      console.log('[AUTH DEBUG] fetchOrInitSettings called with:', { userId, email });

      // Check if Supabase client is initialized
      if (!supabase) {
        console.error('[AUTH DEBUG] Cannot fetch settings - Supabase client not initialized');
        setError(new Error('Unable to initialize database client'));
        setIsLoading(false);
        return;
      }

      let userSettings = null;
      let apiBackoff = false;

      // If user is logged in, try to fetch their settings
      if (userId) {
        console.log('[AUTH DEBUG] User is logged in, fetching user settings');
        try {
          const { data, error: fetchError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (!fetchError && data) {
            console.log('[AUTH DEBUG] Found existing user settings');
            userSettings = data;
          } else if (fetchError && fetchError.code === 'PGRST116') {
            console.log('[AUTH DEBUG] No settings found for user, creating new settings');
            // No settings found for this user, create new settings
            const userSettingsId = `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

            try {
              // First, get default settings to use as base
              const { data: defaultSettings, error: defaultError } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 'default')
                .single();

              if (defaultError) {
                console.error('[AUTH DEBUG] Error fetching default settings:', defaultError);
                throw defaultError;
              }

              console.log('[AUTH DEBUG] Using default settings as template for new user settings');
              const now = new Date().toISOString();

              const { data: newSettings, error: insertError } = await supabase
                .from('app_settings')
                .insert({
                  id: userSettingsId,
                  user_id: userId,
                  email: email,
                  dark_mode: true,
                  gpt_model: defaultSettings?.gpt_model ?? 'gpt-4o',
                  initial_visit_prompt: defaultSettings?.initial_visit_prompt ?? '',
                  follow_up_visit_prompt: defaultSettings?.follow_up_visit_prompt ?? '',
                  low_echo_cancellation: defaultSettings?.low_echo_cancellation ?? false,
                  auto_save: defaultSettings?.auto_save ?? false,
                  updated_at: now
                })
                .select()
                .single();

              if (insertError) {
                console.error('[AUTH DEBUG] Error creating user settings:', insertError);
                throw insertError;
              }

              console.log('[AUTH DEBUG] Successfully created new user settings');
              userSettings = newSettings;
            } catch (settingsError) {
              console.error('[AUTH DEBUG] Error in settings creation flow:', settingsError);
              apiBackoff = true;
            }
          } else {
            console.error('[AUTH DEBUG] Error fetching user settings:', fetchError);
            apiBackoff = true;
          }
        } catch (supabaseError) {
          console.error('[AUTH DEBUG] Exception in Supabase operations:', supabaseError);
          apiBackoff = true;
        }
      } else {
        console.log('[AUTH DEBUG] No user ID provided, fetching default settings');
        try {
          // Fetch default settings for logged out users
          const { data, error: defaultError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'default')
            .single();

          if (defaultError) {
            console.error('[AUTH DEBUG] Error fetching default settings:', defaultError);
            apiBackoff = true;
          } else {
            userSettings = data;
          }
        } catch (defaultError) {
          console.error('[AUTH DEBUG] Exception fetching default settings:', defaultError);
          apiBackoff = true;
        }
      }

      // If we have settings, set them
      if (userSettings) {
        // Convert from snake_case to camelCase using our utility
        const appSettings = supabaseToAppSettings(userSettings);
        if (appSettings) {
          setSettings(appSettings);
          setError(null);
          return;
        }
      }

      // If we haven't returned yet, we need to try the API fallback
      if (apiBackoff) {
        // Fall back to API endpoint which has additional fallback mechanisms
        try {
          console.log('[AUTH DEBUG] Attempting API fallback');
          const response = await fetch('/api/settings');
          if (response.ok) {
            const data = await response.json();
            console.log('[AUTH DEBUG] API fallback successful');
            // Apply default settings to ensure all required properties are present
            setSettings(applyDefaultSettings({
              id: 'api_fallback',
              darkMode: data.darkMode,
              gptModel: data.gptModel,
              initialVisitPrompt: data.initialVisitPrompt,
              followUpVisitPrompt: data.followUpVisitPrompt,
              lowEchoCancellation: data.lowEchoCancellation,
              autoSave: data.autoSave,
              email: data.email,
              userId: data.userId,
              updatedAt: new Date()
            }));
            setError(null);
          } else {
            throw new Error(`API responded with ${response.status}`);
          }
        } catch (apiErr) {
          console.error('[AUTH DEBUG] API fallback also failed:', apiErr);

          // If we reach here, both Supabase and API failed, so use some default settings as a last resort
          setSettings(applyDefaultSettings({
            id: 'fallback_default',
            updatedAt: new Date()
          }));

          setError(new Error('Failed to load settings from both Supabase and API. Using defaults.'));

          // If we've retried less than 3 times, try again in a second
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prevCount => prevCount + 1);
            }, 1000);
          }
        }
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Error in fetchOrInitSettings:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Set default settings as fallback
      setSettings(applyDefaultSettings({
        id: 'error_fallback',
        updatedAt: new Date()
      }));
    } finally {
      setIsLoading(false);
    }
  }

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setIsLoading(true);

      // Check if Supabase client is initialized
      if (!supabase) {
        console.error('[AUTH DEBUG] Cannot update settings - Supabase client not initialized');
        setError(new Error('Unable to initialize database client'));
        setIsLoading(false);
        return;
      }

      // Get current session to ensure we have the latest auth state
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      console.log('[AUTH DEBUG] updateSettings called with user:', userId);

      // Convert camelCase to snake_case for Supabase using our utility
      const updateData = appToSupabaseSettings({
        ...newSettings,
        updatedAt: new Date()
      });

      let success = false;

      if (userId) {
        console.log('[AUTH DEBUG] Updating user-specific settings for user:', userId);

        try {
          // First check if user settings exist
          const { data: existingSettings, error: checkError } = await supabase
            .from('app_settings')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (checkError && checkError.code === 'PGRST116') {
            console.log('[AUTH DEBUG] No user settings found, creating new settings first');
            // No settings exist yet, need to create them first
            await fetchOrInitSettings(userId, session?.user?.email || null);

            // Try again after creating settings
            try {
              const { data: retrySettings, error: retryError } = await supabase
                .from('app_settings')
                .select('id')
                .eq('user_id', userId)
                .single();

              if (retryError) {
                console.error('[AUTH DEBUG] Failed to create user settings:', retryError);
                throw new Error('Failed to create user settings');
              }

              console.log('[AUTH DEBUG] Created user settings, now updating with new values');
            } catch (retryError) {
              console.error('[AUTH DEBUG] Error on retry check:', retryError);
              throw new Error('Failed to verify user settings were created');
            }
          }

          // Update user-specific settings
          const { error } = await supabase
            .from('app_settings')
            .update(updateData)
            .eq('user_id', userId);

          if (error) {
            console.error('[AUTH DEBUG] Error updating user settings:', error);
            throw error;
          }

          console.log('[AUTH DEBUG] Successfully updated user settings');
          success = true;
        } catch (updateError) {
          console.error('[AUTH DEBUG] Error in user settings update flow:', updateError);
          // We'll fall through to API fallback
        }
      } else {
        console.log('[AUTH DEBUG] No user logged in, updating default settings');
        // Update default settings
        try {
          const { error } = await supabase
            .from('app_settings')
            .update(updateData)
            .eq('id', 'default');

          if (error) {
            console.error('[AUTH DEBUG] Error updating default settings:', error);
            throw error;
          }

          console.log('[AUTH DEBUG] Updated default settings');
          success = true;
        } catch (defaultUpdateError) {
          console.error('[AUTH DEBUG] Error updating default settings:', defaultUpdateError);
          // We'll fall through to API fallback
        }
      }

      // If direct Supabase update was successful, update local state
      if (success) {
        setSettings(prev => prev ? { ...prev, ...newSettings } : null);
        setError(null);
        return;
      }

      // If we get here, we need to try the API fallback
      console.log('[AUTH DEBUG] Attempting API fallback for settings update');
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings)
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({ ...prev, ...data }));
          setError(null);
          console.log('[AUTH DEBUG] API fallback update successful');
        } else {
          throw new Error(`API responded with ${response.status}`);
        }
      } catch (apiErr) {
        console.error('[AUTH DEBUG] API fallback also failed:', apiErr);
        setError(new Error('Failed to update settings through both Supabase and API'));

        // Still update local settings for a smoother UX, but they won't persist
        setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Error updating settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to update settings'));

      // Still update local settings for a smoother UX, but they won't persist
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppSettingsContext.Provider value={{ settings, isLoading, error, updateSettings, refreshSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}
