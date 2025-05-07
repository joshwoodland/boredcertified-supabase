import { NextRequest, NextResponse } from 'next/server'
import { checkSupabaseConnection, supabase, serverSupabase, convertToAppFormat, SupabaseNote, AppSettings, AppPatient, AppNote } from '@/app/lib/supabase'
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

    const patient = convertToAppFormat(patientData, 'patient') as AppPatient;
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
        console.log('Using Supabase to get previous note for patient:', normalizedPatientId);

        // Try using serverSupabase instead of regular supabase to bypass RLS
        console.log('Attempting to fetch previous note using server role client');
        const { data: noteData, error: noteError } = await serverSupabase
          .from('notes')
          .select('content, id, created_at')
          .eq('patient_id', normalizedPatientId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (noteError) {
          console.error('Error fetching previous note from Supabase:', noteError);
          console.error('Error details:', JSON.stringify(noteError));
        } else {
          console.log(`Note data retrieved: ${noteData ? noteData.length : 0} notes found`);

          if (noteData && noteData.length > 0) {
            console.log('Previous note found:', noteData[0].id, 'created at:', noteData[0].created_at);
            console.log('Content type:', typeof noteData[0].content);
            console.log('Content snippet:', noteData[0].content.substring(0, 100) + '...');

            let previousContent = '';
            try {
              // Try to parse the content, which might be in JSON format
              console.log('Attempting to parse note content as JSON');
              const parsedContent = JSON.parse(noteData[0].content);
              console.log('Parsed content structure:', Object.keys(parsedContent));

              // If it has a content property, use that, otherwise use the whole parsed object
              if (typeof parsedContent.content === 'string') {
                console.log('Using parsedContent.content (string)');
                previousContent = parsedContent.content;
              } else if (parsedContent.content) {
                console.log('Using stringified parsedContent.content (object)');
                previousContent = JSON.stringify(parsedContent.content);
              } else {
                console.log('Using entire parsedContent');
                previousContent = JSON.stringify(parsedContent);
              }
            } catch (e) {
              // If parsing fails, use the content as is
              console.error('Error parsing note content:', e);
              console.log('Using raw content as fallback');
              previousContent = noteData[0].content;
            }

            // Add the previous note to the transcript with the specified format
            enhancedTranscript = transcript + `\n\n ##( Here is the note from the patient's previous visit to be used for greater context: ${previousContent} )`;
            console.log('Successfully added previous note to transcript');
          } else {
            console.warn('No previous notes found for patient:', normalizedPatientId);
          }
        }
      } catch (error) {
        console.error('Error fetching previous note:', error);
        // Continue with original transcript if there's an error
      }
    }

    console.log('Visit type:', isInitialVisit ? 'Initial' : 'Follow-up');

    // Get user session to check for user-specific settings
    console.log('Getting user session to check for user-specific settings');
    const supabaseServer = await createClient();
    const { data: { session } } = await supabaseServer.auth.getSession();
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;

    let settings: AppSettings | null = null;

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
        settings = convertToAppFormat(userSettings, 'settings') as AppSettings;
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
          settings = convertToAppFormat(emailSettings, 'settings') as AppSettings;
        }
      }
    }

    // If no user-specific settings found, fall back to default settings
    if (!settings) {
      console.log('No user-specific settings found, falling back to default settings');
      const { data: settingsData, error: settingsError } = await serverSupabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (settingsError) {
        console.error('Error fetching default settings:', settingsError);
        return NextResponse.json({
          error: 'Failed to fetch settings',
          details: settingsError.message
        }, { status: 500 });
      }

      if (!settingsData) {
        return NextResponse.json({
          error: 'Settings not found',
          details: 'No default settings found in the database'
        }, { status: 404 });
      }

      settings = convertToAppFormat(settingsData, 'settings') as AppSettings;
    }

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

      const note = convertToAppFormat(noteData, 'note') as AppNote;
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

    // Log detailed information about the request
    console.log(`Fetching notes for patient ID: ${patientId} (${new Date().toISOString()})`);

    // First try with normal client to see if there's any RLS issues
    console.log('Attempting to fetch notes with regular client first');
    const { data: regularData, error: regularError } = await supabase
      .from('notes')
      .select('id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (regularError) {
      console.error('Error fetching notes with regular client:', regularError);
      console.log('Will try with service role client instead');
    } else {
      console.log(`Regular client found ${regularData?.length || 0} notes`);
    }

    // Always use serverSupabase (service role) to ensure we bypass any RLS issues
    console.log('Using service role client to fetch notes');
    const { data: notesData, error: notesError } = await serverSupabase
      .from('notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes with service role client:', notesError);
      return NextResponse.json({
        error: 'Failed to fetch notes',
        details: notesError.message
      }, { status: 500 });
    }

    // Add detailed logging to diagnose issues
    if (!notesData || notesData.length === 0) {
      console.log(`No notes found for patient ID: ${patientId}`);
    } else {
      console.log(`Found ${notesData.length} notes for patient ID: ${patientId}`);
      console.log(`First note ID: ${notesData[0].id}, created at: ${notesData[0].created_at}`);

      // If we see a mismatch between regular and service client results, log it
      if (regularData && regularData.length !== notesData.length) {
        console.warn(`Note count mismatch! Regular client: ${regularData.length}, Service role: ${notesData.length}`);
        console.warn('This indicates a Row Level Security (RLS) issue that needs to be fixed');
      }
    }

    // Convert to App format with additional error handling
    const notes = notesData
      .map((note: SupabaseNote) => {
        try {
          return convertToAppFormat(note, 'note') as AppNote;
        } catch (err) {
          console.error(`Error converting note ${note.id}:`, err);
          return null;
        }
      })
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
