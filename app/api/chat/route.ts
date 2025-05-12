import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createClient } from '@/app/utils/supabase/server';
import { convertToAppFormat, AppSettings } from '@/app/lib/supabaseTypes';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createClient();
    if (!supabase) {
      console.error('[chat/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('app_settings').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[chat/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[chat/route] Failed to connect to Supabase:', error);
    return false;
  }
}

// Helper function to get app settings
async function getAppSettings(): Promise<AppSettings | null> {
  try {
    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      console.error('[chat/route] Failed to initialize Supabase client');
      return null;
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[chat/route] Error fetching app settings:', error);
      return null;
    }

    return convertToAppFormat(data, 'settings') as AppSettings;
  } catch (error) {
    console.error('[chat/route] Error getting app settings:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { messages, model, temperature, max_tokens } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Get app settings for default values
    const settings = await getAppSettings();

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: model || settings?.gptModel || 'gpt-4',
      messages: messages as ChatCompletionMessageParam[],
      temperature: temperature !== undefined ? temperature : 0.7,
      max_tokens: max_tokens || 2000,
    });

    // Extract response
    const content = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      content,
      usage: completion.usage,
      model: completion.model,
    });
  } catch (error) {
    console.error('[chat/route] Error calling OpenAI:', error);

    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        {
          error: 'OpenAI API error',
          message: error.message,
          type: error.type,
          code: error.status,
        },
        { status: error.status || 500 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
