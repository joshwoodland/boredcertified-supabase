import { createServerClient } from '@/app/lib/supabase';

export async function getModelFromSettings(userId: string | null): Promise<string> {
  try {
    // Initialize Supabase server client
    const supabaseServerOrNull = createServerClient();
    if (!supabaseServerOrNull) {
      console.error('[getModelFromSettings] Failed to initialize Supabase server client');
      return 'gpt-4-0125-preview'; // Default model if client initialization fails
    }
    const supabaseServer = supabaseServerOrNull;

    // Get settings from Supabase
    const { data: settings, error } = await supabaseServer
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !settings) {
      console.error('Error fetching settings:', error);
      return 'gpt-4-0125-preview'; // Default model if no settings found
    }

    return settings.gpt_model || 'gpt-4-0125-preview';
  } catch (error) {
    console.error('Error in getModelFromSettings:', error);
    return 'gpt-4-0125-preview'; // Default model on error
  }
}
