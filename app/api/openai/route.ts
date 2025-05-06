import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/app/lib/supabase';
import OpenAI from 'openai';
import { estimateTokenCount } from '@/app/utils/tokenEncoding';
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages';

// Initialize OpenAI client
const openai = new OpenAI();

export async function POST(request: NextRequest) {
  try {
    const { patientId, transcript, isInitialVisit } = await request.json();

    // Get app settings
    const { data: settings, error: settingsError } = await serverSupabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch app settings' }, { status: 500 });
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
      transcript,
      isInitialVisit,
      initialVisitPrompt: settings.initial_visit_prompt,
      followUpVisitPrompt: settings.follow_up_visit_prompt
    });

    // Check token count
    const totalTokens = estimateTokenCount(messages);
    if (totalTokens > 16000) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: settings.gpt_model,
      messages,
      temperature: 0.2,
      max_tokens: 2000
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