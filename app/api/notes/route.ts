import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import {
  convertToAppFormat,
  type AppNote
} from '@/app/lib/supabaseTypes';
import OpenAI from 'openai';
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages';
import { getModelForPurpose } from '@/app/utils/masterSettings';
import { v4 as uuidv4 } from 'uuid';

// Add checkSupabaseConnection function if it doesn't exist in supabaseTypes
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      console.error('[notes/route] Failed to initialize Supabase client');
      return false;
    }

    const { error } = await supabase.from('patients').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[notes/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[notes/route] Failed to connect to Supabase:', error);
    return false;
  }
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET handler for notes
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
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

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Get notes from Supabase
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[notes/route] Error fetching notes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notes', details: error.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appNotes = notes.map(note => convertToAppFormat(note, 'note')) as AppNote[];
    return NextResponse.json(appNotes);
  } catch (error) {
    console.error('[notes/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST handler for creating a new note
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const {
      patientId,
      title,
      content,
      visitType,
      visitDate,
      transcript,
      useStructuredPrompt,
      isInitialEvaluation,
      patientName,
      previousNote,
      soapTemplate,
      sourceNoteId
    } = body;

    // Validate required fields
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
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

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // If transcript is provided, generate a SOAP note using OpenAI
    let noteContent = content;
    if (transcript && useStructuredPrompt) {
      try {
        console.log('[notes/route] Generating SOAP note with OpenAI');

        // Get provider name and supervisor from settings
        let providerName = 'Josh Woodland, APRN, PMHNP'; // Default fallback
        let supervisor: string | null = null;
        try {
          // Get current user session
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;

          if (userId) {
            // Fetch user settings to get provider name and supervisor
            const { data: userSettings } = await supabase
              .from('app_settings')
              .select('provider_name, supervisor')
              .eq('user_id', userId)
              .single();

            if (userSettings?.provider_name) {
              providerName = userSettings.provider_name;
            }
            if (userSettings?.supervisor) {
              supervisor = userSettings.supervisor;
            }
          } else {
            // For users not logged in, get default settings
            const { data: defaultSettings } = await supabase
              .from('app_settings')
              .select('provider_name, supervisor')
              .eq('id', 'default')
              .single();

            if (defaultSettings?.provider_name) {
              providerName = defaultSettings.provider_name;
            }
            if (defaultSettings?.supervisor) {
              supervisor = defaultSettings.supervisor;
            }
          }
        } catch (settingsError) {
          console.warn('[notes/route] Could not fetch provider name and supervisor from settings, using defaults:', settingsError);
        }

        // Get the AI model from master settings
        const model = await getModelForPurpose('generate_soap');
        console.log(`[notes/route] Using AI model: ${model}`);

        // Use the buildOpenAIMessages utility to structure the messages
        console.log('[notes/route] Building OpenAI messages with:', {
          hasTranscript: !!transcript,
          transcriptLength: transcript?.length || 0,
          hasPreviousNote: !!previousNote,
          soapTemplateLength: soapTemplate?.length || 0,
          patientName: patientName || 'Patient',
          providerName,
          supervisor,
          isInitialEvaluation
        });

        const messages = buildOpenAIMessages({
          previousSoapNote: previousNote || undefined,
          currentTranscript: transcript,
          soapTemplate: soapTemplate || '', // Ensure it's always a string
          patientName: patientName || 'Patient',
          providerName: providerName,
          supervisor: supervisor,
          isInitialEvaluation: isInitialEvaluation
        });

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
          model: model, // Use model from master settings
          messages,
          temperature: 0.3, // Lower temperature for more consistent output
          max_tokens: 2000,
        });

        // Extract the generated content
        const generatedContent = completion.choices[0]?.message?.content?.trim();
        if (!generatedContent) {
          console.error('[notes/route] OpenAI returned empty content');
          throw new Error('OpenAI returned empty content');
        }
        
        noteContent = generatedContent;
        console.log('[notes/route] Successfully generated SOAP note, length:', noteContent.length);
      } catch (error) {
        console.error('[notes/route] Error generating SOAP note with OpenAI:', error);
        console.error('[notes/route] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        // Fall back to default content if OpenAI generation fails
        noteContent = content || (title ? `# ${title}\n\n` : 'New Note');
        console.log('[notes/route] Using fallback content:', noteContent);
      }
    } else {
      // Use provided content or default
      noteContent = content || (title ? `# ${title}\n\n` : 'New Note');
    }

    // Save the note to Supabase
    const noteId = uuidv4();
    const { data: createdNote, error: insertError } = await supabase
      .from('notes')
      .insert({
        id: noteId,
        patient_id: patientId,
        transcript: transcript || '',
        content: noteContent,
        summary: '', // Will be updated after summary generation if needed
        is_initial_visit: isInitialEvaluation || false,
        source_note_id: sourceNoteId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[notes/route] Error creating note:', insertError);
      return NextResponse.json(
        { error: 'Failed to create note', details: insertError.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appNote = convertToAppFormat(createdNote, 'note') as AppNote;
    return NextResponse.json(appNote);
  } catch (error) {
    console.error('[notes/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
