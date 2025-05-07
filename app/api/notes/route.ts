import { NextRequest, NextResponse } from 'next/server'
import { checkSupabaseConnection, supabase, serverSupabase, convertToAppFormat, SupabaseNote } from '@/app/lib/supabase'
import OpenAI from 'openai'
import systemMessages from '@/app/config/systemMessages'
import { ChatCompletionMessageParam, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { formatSystemMessage } from '@/app/utils/formatSystemMessage'
import { formatSoapNote } from '@/app/utils/formatSoapNote'
import { estimateTokenCount, mightExceedTokenLimit } from '@/app/utils/tokenEncoding'
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/app/utils/supabase/server'
import { cookies } from 'next/headers'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      transcript,
      patientId: rawPatientId,
      audioFileUrl,
      isInitialEvaluation,
      model: requestedModel
    } = await request.json();

    if (!transcript) {
      return NextResponse.json({
        error: 'Missing required field',
        details: 'Transcript is required'
      }, { status: 400 });
    }

    // Normalize patient ID
    const normalizedPatientId = rawPatientId?.trim();

    if (!normalizedPatientId) {
      return NextResponse.json({
        error: 'Missing required field',
        details: 'Patient ID is required'
      }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    // Get patient from Supabase using the SERVICE ROLE client to bypass RLS for this check
    console.log('Querying Supabase (Service Role) for patient with normalized ID:', normalizedPatientId);
    const { data: patientData, error: patientError } = await serverSupabase
      .from('patients')
      .select('*')
      .eq('id', normalizedPatientId)
      .maybeSingle();

    console.log('DEBUG - Supabase (Service Role) query result:', {
      hasData: !!patientData,
      hasError: !!patientError,
      errorCode: patientError?.code,
      errorMessage: patientError?.message,
    });

    if (patientError) {
      console.error('Error fetching patient from Supabase (Service Role):', patientError);
      return NextResponse.json({
        error: 'Failed to fetch patient',
        details: patientError.message
      }, { status: 500 });
    }

    if (!patientData) {
      console.warn('Patient not found in Supabase (Service Role) with ID:', normalizedPatientId);
      return NextResponse.json({
        error: 'Patient not found',
        details: 'No patient found with the provided ID in the database.'
      }, { status: 404 });
    }

    const patient = convertToAppFormat(patientData, 'patient');
    if (!patient) {
      return NextResponse.json({
        error: 'Failed to convert patient data',
        details: 'Error converting patient format'
      }, { status: 500 });
    }

    // Count existing notes for this patient
    let existingNotes = 0;
    console.log('Using Supabase to count existing notes');
    const { count, error: countError } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', normalizedPatientId);

    if (countError) {
      console.error('Error counting notes in Supabase:', countError);
      return NextResponse.json({
        error: 'Failed to count notes',
        details: countError.message
      }, { status: 500 });
    }

    existingNotes = count || 0;

    // Use the provided isInitialEvaluation parameter if available, otherwise fall back to checking for existing notes
    const isInitialVisit = isInitialEvaluation !== undefined ? isInitialEvaluation : existingNotes === 0;

    console.log('Visit type determination:', {
      isInitialEvaluationProvided: isInitialEvaluation !== undefined,
      isInitialEvaluation,
      existingNotes,
      finalDecision: isInitialVisit ? 'Initial Visit' : 'Follow-up Visit'
    });

    // Get the most recent previous note if this is not the initial visit
    let enhancedTranscript = transcript;
    if (!isInitialVisit) {
      try {
        console.log('Using Supabase to get previous note');
        const { data: noteData, error: noteError } = await supabase
          .from('notes')
          .select('content')
          .eq('patient_id', normalizedPatientId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (noteError) {
          console.error('Error fetching previous note from Supabase:', noteError);
        } else if (noteData && noteData.length > 0) {
          let previousContent = '';
          try {
            // Try to parse the content, which might be in JSON format
            const parsedContent = JSON.parse(noteData[0].content);
            // If it has a content property, use that, otherwise use the whole parsed object
            previousContent = typeof parsedContent.content === 'string'
              ? parsedContent.content
              : JSON.stringify(parsedContent.content) || noteData[0].content;
          } catch (e) {
            // If parsing fails, use the content as is
            previousContent = noteData[0].content;
          }

          // Add the previous note to the transcript with the specified format
          enhancedTranscript = transcript + `\n\n ##( Here is the note from the patient's previous visit to be used for greater context: ${previousContent} )`;
          console.log('Added previous note to transcript');
        }
      } catch (error) {
        console.error('Error fetching previous note:', error);
        // Continue with original transcript if there's an error
      }
    }

    console.log('Visit type:', isInitialVisit ? 'Initial' : 'Follow-up');

    // Get current settings
    console.log('Using Supabase to get app settings');
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings from Supabase:', settingsError);
      return NextResponse.json({
        error: 'Failed to fetch settings',
        details: settingsError.message
      }, { status: 500 });
    }

    const settings = convertToAppFormat(settingsData, 'settings');
    if (!settings) {
      return NextResponse.json({
        error: 'Failed to convert settings data',
        details: 'Error converting settings format'
      }, { status: 500 });
    }

    // Make sure we have a valid model
    const model = requestedModel || settings.gptModel || 'gpt-4-turbo-preview';

    if (!isValidModel(model)) {
      console.error('Invalid model specified:', model);
      return NextResponse.json({
        error: 'Invalid model configuration',
        details: `Model ${model} is not supported`
      }, { status: 500 });
    }

    console.log('Using GPT model:', model);

    // Get the appropriate system message based on visit type
    const systemMessage = formatSystemMessage(
      isInitialVisit ? settings.initialVisitPrompt || '' : settings.followUpVisitPrompt || ''
    );

    // Build messages array for OpenAI
    const messages = buildOpenAIMessages({
      currentTranscript: enhancedTranscript,
      soapTemplate: systemMessage,
      patientName: patient.name || 'Patient'
    }) as ChatCompletionMessageParam[];

    // Check if we might exceed token limit
    if (mightExceedTokenLimit(messages.map(m => m.content).join('\n'), model)) {
      return NextResponse.json({
        error: 'Input too long',
        details: 'The combined input length may exceed the model\'s token limit'
      }, { status: 400 });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4000
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error('Empty response from OpenAI API');
    }

    // Format the response content
    const formattedContent = formatSoapNote(responseContent);

    // Create a new note
    console.log('Using Supabase to create note');
    try {
      // Generate a new UUID for the note
      const noteId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Insert note into Supabase using service role client to bypass RLS
      const { data: noteData, error: createError } = await serverSupabase
        .from('notes')
        .insert({
          id: noteId,
          patient_id: normalizedPatientId,
          transcript: transcript,
          content: JSON.stringify({
            content: responseContent,
            formattedContent
          }),
          is_initial_visit: isInitialVisit,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating note in Supabase:', createError);
        return NextResponse.json({
          error: 'Failed to create note',
          details: createError.message
        }, { status: 500 });
      }

      const note = convertToAppFormat(noteData, 'note');
      if (!note) {
        return NextResponse.json({
          error: 'Failed to convert note data',
          details: 'Error converting note format'
        }, { status: 500 });
      }

      // Generate a summary focusing on medication changes
      try {
        const summaryResponse = await fetch(new URL('/api/summary', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: responseContent }),
        });

        if (summaryResponse.ok) {
          const { summary } = await summaryResponse.json();

          // Update the note with the generated summary
          console.log('Using Supabase (Service Role) to update note summary');
          const { error: updateError } = await serverSupabase
            .from('notes')
            .update({ 
              summary, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', note.id);

          if (updateError) {
            console.error('Error updating note summary in Supabase:', updateError);
            // The summary update is not critical, we can continue
            console.log('Could not update summary, but note was created successfully');
          }

          note.summary = summary;
        }
      } catch (summaryError) {
        console.error('Error generating note summary:', summaryError);
        // Continue without summary if there's an error
      }

      console.log('Note created:', note.id);
      return NextResponse.json(note);

    } catch (error) {
      console.error('Error in OpenAI API call:', error);
      return NextResponse.json({
        error: 'Failed to generate note',
        details: error instanceof Error ? error.message : 'Error communicating with OpenAI API'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract patient ID from query parameters
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (!isSupabaseAvailable) {
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    console.log('Using Supabase to get notes');
    const { data: notesData, error: notesError } = await serverSupabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes from Supabase:', notesError);
      return NextResponse.json({
        error: 'Failed to fetch notes',
        details: notesError.message
      }, { status: 500 });
    }

    // Add logging for when no notes are found
    if (!notesData || notesData.length === 0) {
      console.log(`No notes found for patient ID: ${patientId}`);
    } else {
      console.log(`Found ${notesData.length} notes for patient ID: ${patientId}`);
    }

    // Convert to App format
    const notes = notesData
      .map((note: SupabaseNote) => convertToAppFormat(note, 'note'))
      .filter((note: unknown): note is NonNullable<ReturnType<typeof convertToAppFormat>> => note !== null);

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({
      error: 'Failed to fetch notes',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

function isValidModel(model: string): boolean {
  const validModels = [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'gpt-4o',
    'gpt-4o-mini'
  ];
  return validModels.includes(model);
}
