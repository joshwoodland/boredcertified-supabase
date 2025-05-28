import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import {
  convertToAppFormat,
  type AppNote
} from '@/app/lib/supabaseTypes';
import OpenAI from 'openai';
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages';
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
      soapTemplate
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
    if (transcript && useStructuredPrompt && soapTemplate) {
      try {
        console.log('[notes/route] Generating SOAP note with OpenAI');

        // Use the buildOpenAIMessages utility to structure the messages
        const messages = buildOpenAIMessages({
          previousSoapNote: previousNote || undefined,
          currentTranscript: transcript,
          soapTemplate: soapTemplate,
          patientName: patientName || 'Patient',
          isInitialEvaluation: isInitialEvaluation
        });

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o', // Use a capable model for medical content
          messages,
          temperature: 0.3, // Lower temperature for more consistent output
          max_tokens: 2000,
        });

        // Extract the generated content
        noteContent = completion.choices[0]?.message?.content?.trim() || 'New Note';
        console.log('[notes/route] Successfully generated SOAP note');
      } catch (error) {
        console.error('[notes/route] Error generating SOAP note with OpenAI:', error);
        // Fall back to default content if OpenAI generation fails
        noteContent = content || (title ? `# ${title}\n\n` : 'New Note');
      }
    } else {
      // Use provided content or default
      noteContent = content || (title ? `# ${title}\n\n` : 'New Note');
    }

    // Create a new note
    const newNote = {
      id: uuidv4(),
      patient_id: patientId,
      content: noteContent,
      created_at: visitDate || new Date().toISOString(), // Use visitDate as created_at if provided
      updated_at: new Date().toISOString(),
      transcript: transcript || '',
      summary: null,
      is_initial_visit: isInitialEvaluation !== undefined ? isInitialEvaluation : visitType === 'initial', // Use explicit flag or convert string visitType
      audio_file_url: null
    };

    // Insert the note into Supabase
    const { data: insertedNote, error } = await supabase
      .from('notes')
      .insert(newNote)
      .select()
      .single();

    if (error) {
      console.error('[notes/route] Error creating note:', error);
      return NextResponse.json(
        { error: 'Failed to create note', details: error.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appNote = convertToAppFormat(insertedNote, 'note') as AppNote;
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
