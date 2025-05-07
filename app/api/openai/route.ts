import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, convertToAppFormat, AppSettings } from '@/app/lib/supabase';
import OpenAI from 'openai';
import { estimateTokenCount } from '@/app/utils/tokenEncoding';
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages';
import { createClient } from '@/app/utils/supabase/server';

// Initialize OpenAI client
const openai = new OpenAI();

export async function POST(request: NextRequest) {
  try {
    const { patientId, transcript, isInitialVisit } = await request.json();

    // Validate required fields
    if (!transcript) {
      return NextResponse.json({
        error: 'Missing required field',
        details: 'Transcript is required'
      }, { status: 400 });
    }

    if (isInitialVisit === undefined) {
      return NextResponse.json({
        error: 'Missing required field',
        details: 'isInitialVisit flag is required'
      }, { status: 400 });
    }

    // Get user session to check for user-specific settings
    const supabaseServer = await createClient();
    const { data: { session } } = await supabaseServer.auth.getSession();
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;

    let appSettings: AppSettings | null = null;

    // First try to get user-specific settings if user is logged in
    if (userId && userEmail) {
      console.log('Fetching user-specific settings for user:', userEmail);

      // Try to get settings by user_id first
      const { data: userSettings, error: userSettingsError } = await serverSupabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!userSettingsError && userSettings) {
        console.log('Found settings by user_id');
        appSettings = convertToAppFormat(userSettings, 'settings') as AppSettings;
      } else {
        // If not found by user_id, try by email
        console.log('No settings found by user_id, trying email');
        const { data: emailSettings, error: emailSettingsError } = await serverSupabase
          .from('app_settings')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        if (!emailSettingsError && emailSettings) {
          console.log('Found settings by email');
          appSettings = convertToAppFormat(emailSettings, 'settings') as AppSettings;
        }
      }
    }

    // If no user-specific settings found, fall back to default settings
    if (!appSettings) {
      console.log('No user-specific settings found, falling back to default settings');
      const { data: defaultSettings, error: settingsError } = await serverSupabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (settingsError) {
        console.error('Error fetching default settings:', settingsError);
        return NextResponse.json({
          error: 'Failed to fetch app settings',
          details: settingsError.message
        }, { status: 500 });
      }

      if (!defaultSettings) {
        return NextResponse.json({
          error: 'Settings not found',
          details: 'No default settings found in the database'
        }, { status: 404 });
      }

      appSettings = convertToAppFormat(defaultSettings, 'settings') as AppSettings;
    }

    if (!appSettings) {
      return NextResponse.json({
        error: 'Failed to convert settings data',
        details: 'Error converting settings format'
      }, { status: 500 });
    }

    // Get existing notes count for rate limiting
    const { count: existingNotes, error: countError } = await serverSupabase
      .from('notes')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting notes:', countError);
      return NextResponse.json({ error: 'Failed to count existing notes' }, { status: 500 });
    }

    // Rate limiting: Only allow up to 100 notes
    if (existingNotes && existingNotes >= 100) {
      return NextResponse.json({ error: 'Note limit reached' }, { status: 429 });
    }

    // Build messages for OpenAI
    const messages = buildOpenAIMessages({
      currentTranscript: transcript,
      soapTemplate: isInitialVisit ? appSettings.initialVisitPrompt : appSettings.followUpVisitPrompt,
      patientName: 'Patient'
    });

    // Check token count
    const totalTokens = estimateTokenCount(messages.map(m => m.content).join('\n'));
    if (totalTokens > 16000) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: appSettings.gptModel,
      messages,
      temperature: 0.2,
      max_tokens: 4000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error in OpenAI route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}