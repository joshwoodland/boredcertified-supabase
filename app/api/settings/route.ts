import { NextResponse } from 'next/server';
import { createServerClient } from '@/app/lib/supabase';
import { cookies } from 'next/headers';
import { AppSettings, SupabaseSettings } from '@/app/lib/supabaseTypes';
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

export async function GET(request: Request) {
  try {
    const supabaseServer = createServerClient();
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }

    let userEmail = session?.user?.email || null;
    let userId = session?.user?.id || null;
    let source = 'none';
    let data = null;

    // First try to get settings by user_id if available
    if (userId) {
      console.log('Fetching settings by user_id:', userId);
      const { data: userSettings, error: userSettingsError } = await supabaseServer
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (userSettingsError && userSettingsError.code !== 'PGRST116') {
        console.error('Error fetching settings by user_id:', userSettingsError);
      }

      if (userSettings) {
        console.log('Found settings by user_id');
        data = userSettings;
        source = 'user_id';
      }
    }

    // If no settings found by user_id, try by email
    if (!data && userEmail) {
      console.log('Fetching settings by email:', userEmail);
      const { data: emailSettings, error: emailSettingsError } = await supabaseServer
        .from('app_settings')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (emailSettingsError && emailSettingsError.code !== 'PGRST116') {
        console.error('Error fetching settings by email:', emailSettingsError);
      }

      if (emailSettings) {
        console.log('Found settings by email');
        data = emailSettings;
        source = 'email';
      }
    }

    // If still no settings, get default settings
    if (!data) {
      console.log('Fetching default settings');
      const { data: defaultSettings, error: defaultSettingsError } = await supabaseServer
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (defaultSettingsError) {
        console.error('Error fetching default settings:', defaultSettingsError);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
      }

      if (defaultSettings) {
        console.log('Found default settings');
        data = defaultSettings;
        source = 'default';
      } else {
        return NextResponse.json({ error: 'No settings found' }, { status: 404 });
      }
    }

    // If no settings exist yet, create default settings
    if (!data) {
      const defaultSettings = {
        id: userEmail || 'default',
        dark_mode: false,
        gpt_model: 'gpt-4o',
        initial_visit_additional_preferences: '',
        follow_up_visit_additional_preferences: '',
        auto_save: true,
        email: userEmail,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      const { data: newSettings, error: createError } = await supabaseServer
        .from('app_settings')
        .insert(defaultSettings)
        .select()
        .maybeSingle();

      if (createError) {
        console.error('Error creating default settings:', createError);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }

      data = newSettings;
      source = 'newly_created';
    }

    // Convert snake_case to camelCase for client using our utility
    const appSettings = supabaseToAppSettings(data);

    // Add source information for debugging
    const clientSettings = {
      ...appSettings,
      source
    };

    return NextResponse.json(clientSettings);

  } catch (error) {
    console.error('Unexpected error in settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    if (!supabaseServer) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }
    const body = await request.json();

    // Get user session
    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();

    if (sessionError || !session) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const userId = session.user.id;

    // Check if settings exist for this user
    const { data: existingSettings, error: fetchError } = await supabaseServer
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing settings:', fetchError);
      return NextResponse.json({ error: 'Failed to check settings' }, { status: 500 });
    }

    // If settings don't exist, create them
    if (!existingSettings) {
      const userSettingsId = `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Create app settings with defaults and convert to Supabase format
      const userSettings = applyDefaultSettings({
        id: userSettingsId,
        darkMode: body.darkMode,
        gptModel: body.gptModel,
        initialVisitPrompt: body.initialVisitPrompt,
        followUpVisitPrompt: body.followUpVisitPrompt,
        autoSave: body.autoSave,
        email: userEmail,
        userId: userId,
        updatedAt: new Date()
      });

      // Convert to Supabase format
      const newSettings = appToSupabaseSettings(userSettings);

      const { data: createdSettings, error: createError } = await supabaseServer
        .from('app_settings')
        .insert(newSettings)
        .select()
        .single();

      if (createError) {
        console.error('Error creating settings:', createError);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }

      // Convert snake_case to camelCase for client using our utility
      const clientSettings = supabaseToAppSettings(createdSettings);

      return NextResponse.json(clientSettings);
    }

    // First convert existing settings to app format
    const existingAppSettings = supabaseToAppSettings(existingSettings);

    // Merge with new settings
    const updatedSettings = {
      ...existingAppSettings,
      ...body,
      updatedAt: new Date()
    };

    // Convert back to Supabase format for storage
    const updateData = appToSupabaseSettings(updatedSettings);

    // Update settings in Supabase
    const { data, error } = await supabaseServer
      .from('app_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    // Convert snake_case to camelCase for client using our utility
    const clientSettings = supabaseToAppSettings(data);

    return NextResponse.json(clientSettings);

  } catch (error) {
    console.error('Unexpected error in settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
