'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { convertToAppFormat, AppSettings } from '@/app/lib/supabase';

// Debug logging helper
const debugLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(`[SETTINGS DEBUG] ${message}`, data);
    } else {
      console.log(`[SETTINGS DEBUG] ${message}`);
    }
  }
};

/**
 * GET handler for settings
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseServer = await createClient();

    // Get the user's email from their session
    const { data: { session } } = await supabaseServer.auth.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      console.warn('No user email found in session for fetching settings');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get settings from Supabase
    const { data, error } = await supabaseServer
      .from('app_settings')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings from Supabase:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch settings',
        details: error.message 
      }, { status: 500 });
    }

    // If no settings exist yet, create default settings
    if (!data) {
      const defaultSettings = {
        id: userEmail,
        dark_mode: false,
        gpt_model: 'gpt-4',
        initial_visit_prompt: 'Please summarize this initial visit note.',
        follow_up_visit_prompt: 'Please summarize this follow-up visit note.',
        auto_save: true,
        low_echo_cancellation: false,
        email: userEmail,
        user_id: session.user.id,
        updated_at: new Date().toISOString()
      };

      const { data: newSettings, error: createError } = await supabaseServer
        .from('app_settings')
        .insert(defaultSettings)
        .select()
        .maybeSingle();

      if (createError) {
        console.error('Error creating default settings in Supabase:', createError);
        return NextResponse.json({ 
          error: 'Failed to create default settings',
          details: createError.message 
        }, { status: 500 });
      }

      if (!newSettings) {
        return NextResponse.json({ 
          error: 'Failed to create default settings',
          details: 'No settings returned after creation'
        }, { status: 500 });
      }

      // Convert to App format and return
      const formattedSettings = convertToAppFormat(newSettings, 'settings') as AppSettings;
      if (!formattedSettings) {
        return NextResponse.json({ 
          error: 'Failed to convert settings data',
          details: 'Error converting settings format'
        }, { status: 500 });
      }
      return NextResponse.json(formattedSettings);
    }

    // Convert existing settings to App format and return
    const formattedSettings = convertToAppFormat(data, 'settings') as AppSettings;
    if (!formattedSettings) {
      return NextResponse.json({ 
        error: 'Failed to convert settings data',
        details: 'Error converting settings format'
      }, { status: 500 });
    }
    return NextResponse.json(formattedSettings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * POST handler for settings
 */
export async function POST(request: NextRequest) {
  debugLog('Starting POST request for settings');

  try {
    const body = await request.json();
    debugLog('Request body:', body);

    const supabaseServer = await createClient();

    // Get the user's email from their session
    const { data: { session } } = await supabaseServer.auth.getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      console.warn('No user email found in session for updating settings');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Convert camelCase to snake_case for Supabase
    const updateData = {
      dark_mode: body.darkMode,
      gpt_model: body.gptModel,
      initial_visit_prompt: body.initialVisitPrompt,
      follow_up_visit_prompt: body.followUpVisitPrompt,
      auto_save: body.autoSave,
      low_echo_cancellation: body.lowEchoCancellation,
      updated_at: new Date().toISOString()
    };

    // Update settings in Supabase
    const { data, error } = await supabaseServer
      .from('app_settings')
      .update(updateData)
      .eq('email', userEmail)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings in Supabase:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    // Convert to App format and return
    const formattedSettings = convertToAppFormat(data, 'settings');
    return NextResponse.json(formattedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}