import { serverSupabase } from '@/app/lib/supabase';

export async function getModelFromSettings(userId: string | null): Promise<string> {
  try {
    // Get settings from Supabase
    const { data: settings, error } = await serverSupabase
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