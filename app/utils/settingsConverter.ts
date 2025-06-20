/**
 * Utility functions for converting between Supabase and app settings formats
 */

import { SupabaseSettings, AppSettings } from '@/app/lib/supabaseTypes';
import { DEFAULT_SETTINGS } from '@/app/lib/defaultSettings';

/**
 * Converts Supabase settings format to application settings format
 * @param settings The Supabase settings record to convert
 * @returns Converted settings in application format
 */
export function supabaseToAppSettings(settings: SupabaseSettings | null): AppSettings | null {
  if (!settings) return null;
  
  return {
    id: settings.id,
    darkMode: settings.dark_mode,
    gptModel: settings.gpt_model,
    initialVisitPrompt: settings.initial_visit_additional_preferences,
    followUpVisitPrompt: settings.follow_up_visit_additional_preferences,
    autoSave: settings.auto_save,
    providerName: settings.provider_name,
    supervisor: settings.supervisor,
    email: settings.email,
    userId: settings.user_id,
    updatedAt: new Date(settings.updated_at),
  };
}

/**
 * Converts application settings format to Supabase settings format
 * @param settings The application settings to convert
 * @returns Converted settings in Supabase format
 */
export function appToSupabaseSettings(settings: Partial<AppSettings>): Partial<SupabaseSettings> {
  const result: Partial<SupabaseSettings> = {};
  
  if (settings.id !== undefined) result.id = settings.id;
  if (settings.darkMode !== undefined) result.dark_mode = settings.darkMode;
  if (settings.gptModel !== undefined) result.gpt_model = settings.gptModel;
  if (settings.initialVisitPrompt !== undefined) result.initial_visit_additional_preferences = settings.initialVisitPrompt;
  if (settings.followUpVisitPrompt !== undefined) result.follow_up_visit_additional_preferences = settings.followUpVisitPrompt;
  if (settings.autoSave !== undefined) result.auto_save = settings.autoSave;
  if (settings.providerName !== undefined) result.provider_name = settings.providerName;
  if (settings.supervisor !== undefined) result.supervisor = settings.supervisor;
  if (settings.email !== undefined) result.email = settings.email;
  if (settings.userId !== undefined) result.user_id = settings.userId;
  if (settings.updatedAt !== undefined) result.updated_at = settings.updatedAt.toISOString();
  
  return result;
}

/**
 * Creates a new settings object with default values for any missing properties
 * @param settings Partial settings object
 * @returns Complete settings object with defaults applied
 */
export function applyDefaultSettings(settings: Partial<AppSettings> | null): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    id: settings?.id || 'default',
    updatedAt: settings?.updatedAt || new Date(),
    ...settings,
  } as AppSettings;
}

/**
 * Generates a user settings ID from a user ID
 * @param userId The user ID
 * @returns A sanitized settings ID
 */
export function generateUserSettingsId(userId: string): string {
  return `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}
