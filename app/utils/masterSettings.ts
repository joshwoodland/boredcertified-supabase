import { createServerClient } from '@/app/lib/supabase';

export interface MasterSettings {
  id: string;
  initial_eval_soap_template: string;
  follow_up_visit_soap_template: string;
  generate_soap_model: string;
  checklist_model: string;
  note_summary_model: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cache for master settings to reduce database calls
 */
let cachedMasterSettings: MasterSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Fetches master settings from the database
 * Uses caching to reduce database calls
 */
export async function getMasterSettings(): Promise<MasterSettings> {
  const now = Date.now();

  // Return cached settings if available and not expired
  if (cachedMasterSettings && (now - lastFetchTime) < CACHE_TTL) {
    return cachedMasterSettings;
  }

  try {
    const supabase = createServerClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    const { data, error } = await supabase
      .from('master_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Error fetching master settings:', error);
      throw new Error(`Failed to fetch master settings: ${error.message}`);
    }

    if (!data) {
      throw new Error('Master settings not found in database');
    }

    // Update cache
    cachedMasterSettings = data;
    lastFetchTime = now;

    return data;
  } catch (error) {
    console.error('Error in getMasterSettings:', error);
    
    // If we have cached settings, return them as fallback
    if (cachedMasterSettings) {
      console.warn('Using cached master settings due to database error');
      return cachedMasterSettings;
    }

    // Ultimate fallback - return default values
    console.warn('Using hardcoded fallback master settings');
    return getDefaultMasterSettings();
  }
}

/**
 * Gets the SOAP template based on visit type
 */
export async function getSoapTemplate(isInitialEvaluation: boolean): Promise<string> {
  try {
    const settings = await getMasterSettings();
    return isInitialEvaluation 
      ? settings.initial_eval_soap_template 
      : settings.follow_up_visit_soap_template;
  } catch (error) {
    console.error('Error getting SOAP template:', error);
    // Fallback to basic templates
    return isInitialEvaluation 
      ? 'Please generate a comprehensive SOAP note for this initial psychiatric evaluation.'
      : 'Please generate a comprehensive SOAP note for this follow-up psychiatric visit.';
  }
}

/**
 * Gets the AI model for a specific purpose
 */
export async function getModelForPurpose(purpose: 'generate_soap' | 'checklist' | 'note_summary'): Promise<string> {
  try {
    const settings = await getMasterSettings();
    
    switch (purpose) {
      case 'generate_soap':
        return settings.generate_soap_model;
      case 'checklist':
        return settings.checklist_model;
      case 'note_summary':
        return settings.note_summary_model;
      default:
        return 'gpt-4o'; // Default fallback
    }
  } catch (error) {
    console.error(`Error getting model for ${purpose}:`, error);
    return 'gpt-4o'; // Default fallback
  }
}

/**
 * Updates master settings in the database
 */
export async function updateMasterSettings(updates: Partial<Omit<MasterSettings, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    const { error } = await supabase
      .from('master_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'default');

    if (error) {
      throw new Error(`Failed to update master settings: ${error.message}`);
    }

    // Clear cache to force refresh on next fetch
    cachedMasterSettings = null;
    lastFetchTime = 0;
  } catch (error) {
    console.error('Error updating master settings:', error);
    throw error;
  }
}

/**
 * Fallback default settings in case database is unavailable
 */
function getDefaultMasterSettings(): MasterSettings {
  return {
    id: 'default',
    initial_eval_soap_template: 'Please generate a comprehensive SOAP note for this initial psychiatric evaluation.',
    follow_up_visit_soap_template: 'Please generate a comprehensive SOAP note for this follow-up psychiatric visit.',
    generate_soap_model: 'gpt-4o',
    checklist_model: 'gpt-4o',
    note_summary_model: 'gpt-4o',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Clears the cache - useful for testing or when settings are updated externally
 */
export function clearMasterSettingsCache(): void {
  cachedMasterSettings = null;
  lastFetchTime = 0;
}