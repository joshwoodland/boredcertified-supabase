import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { getSupabaseNotes, convertToPrismaFormat, supabase, serverSupabase, PrismaNote, SupabaseNote } from '@/app/lib/supabase'
import OpenAI from 'openai'
import systemMessages from '@/app/config/systemMessages'
import { ChatCompletionMessageParam, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { formatSystemMessage } from '@/app/utils/formatSystemMessage'
import { formatSoapNote } from '@/app/utils/formatSoapNote'
import { estimateTokenCount, mightExceedTokenLimit } from '@/app/utils/tokenEncoding'
import { buildOpenAIMessages } from '@/app/utils/buildOpenAIMessages'

// Add logging right before OpenAI initialization
console.log('--- Initializing OpenAI Client --- ');
console.log('process.env.OPENAI_API_KEY (in notes route):', process.env.OPENAI_API_KEY ? `Exists (length: ${process.env.OPENAI_API_KEY.length})` : 'MISSING or EMPTY');
console.log('---------------------------------');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to validate model name
function isValidModel(model: string): boolean {
  const validModels = [
    'gpt-4o',
    'gpt-4o-mini'
  ];
  return validModels.includes(model);
}

// Helper function to truncate text while preserving important medical information
function truncateText(text: string, maxLength: number = 4000): string {
  // Rough approximation: 1 token ≈ 4 characters
  const maxChars = maxLength * 4;
  if (text.length <= maxChars) return text;

  // Split text into sentences
  const sentences = text.split(/(?<=[.!?])\s+/);

  // Keywords to prioritize (common medical terms and indicators)
  const importantKeywords = [
    'pain', 'symptoms', 'diagnosis', 'treatment', 'medication',
    'history', 'allergies', 'chronic', 'acute', 'severe',
    'blood pressure', 'temperature', 'pulse', 'heart rate',
    'complains of', 'reports', 'denies', 'presents with',
    'prescribed', 'recommends', 'follow up', 'lab results',
    'test results', 'examination shows', 'assessment'
  ];

  // Score each sentence based on importance
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Higher score for sentences with medical keywords
    importantKeywords.forEach(keyword => {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        score += 2;
      }
    });

    // Higher score for sentences that seem to be measurements or values
    if (/\d+/.test(sentence)) score += 1;

    // Higher score for sentences that seem to be direct quotes or complaints
    if (lowerSentence.includes('patient') ||
        lowerSentence.includes('reports') ||
        lowerSentence.includes('states') ||
        lowerSentence.includes('complains')) {
      score += 2;
    }

    return { sentence, score };
  });

  // Sort sentences by importance score
  scoredSentences.sort((a, b) => b.score - a.score);

  // Always keep the first and last sentences for context
  const firstSentence = sentences[0];
  const lastSentence = sentences[sentences.length - 1];

  // Build the truncated text from highest scoring sentences
  let result = firstSentence + ' ';
  let currentLength = firstSentence.length;

  // Add highest scoring sentences until we approach the limit
  for (const { sentence } of scoredSentences) {
    if (sentence === firstSentence || sentence === lastSentence) continue;

    if (currentLength + sentence.length + 1 <= maxChars - lastSentence.length - 50) {
      result += sentence + ' ';
      currentLength += sentence.length + 1;
    }
  }

  // Add the last sentence
  result += lastSentence;

  // If we're still over the limit, do a hard truncate but preserve more of the start
  if (result.length > maxChars) {
    const startLength = Math.floor(maxChars * 0.8);
    const endLength = maxChars - startLength - 20;
    result = result.slice(0, startLength) +
             '\n...[some content omitted for length]...\n' +
             result.slice(-endLength);
  }

  return result;
}

interface NoteContent {
  [key: string]: any;
}

// Helper function to extract content from GPT response
function extractContentFromResponse(responseContent: string): NoteContent {
  try {
    // First try parsing as markdown/text
    const sections: NoteContent = {};

    // Split content into sections by headers
    const sectionRegex = /(?:###|##|#)\s*([^#\n]+)([^#]*)/g;
    let match;

    while ((match = sectionRegex.exec(responseContent)) !== null) {
      const [, title, content] = match;
      const sectionTitle = title.trim().toLowerCase();
      sections[sectionTitle] = content.trim();
    }

    // If no sections were found, use the entire text as content
    if (Object.keys(sections).length === 0) {
      sections.content = responseContent.trim();
    }

    return sections;
  } catch (error) {
    // If parsing as text fails for some reason, try JSON as fallback
    try {
      const parsedContent = JSON.parse(responseContent.trim());
      return parsedContent;
    } catch (jsonError) {
      // If all parsing fails, just return the raw text
      return { content: responseContent.trim() };
    }
  }
}

interface SOAPContent {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  [key: string]: any; // Allow for additional fields
}

// Helper function to split transcript into chunks with overlap
function splitTranscriptIntoChunks(transcript: string, maxChunkSize: number = 16000): string[] {
  if (!transcript || transcript.length <= maxChunkSize) {
    console.log('Transcript fits in single chunk:', { length: transcript?.length });
    return [transcript];
  }

  const chunks: string[] = [];
  const chunkMetadata: Array<{ startIndex: number; endIndex: number }> = [];
  const overlap = 500; // Reduced overlap for better stability
  let startIndex = 0;

  console.log('Starting transcript chunking:', {
    totalLength: transcript.length,
    maxChunkSize,
    overlap
  });

  while (startIndex < transcript.length) {
    // Calculate the end index, ensuring we don't exceed the string length
    const endIndex = Math.min(startIndex + maxChunkSize, transcript.length);

    // Find a good breakpoint (end of sentence) if possible
    let actualEndIndex = endIndex;
    if (endIndex < transcript.length) {
      const searchText = transcript.slice(Math.max(endIndex - 100, startIndex), endIndex);
      const lastPeriod = searchText.lastIndexOf('.');
      if (lastPeriod !== -1) {
        actualEndIndex = Math.max(endIndex - 100, startIndex) + lastPeriod + 1;
      }
    }

    // Ensure we're making progress
    if (actualEndIndex <= startIndex) {
      actualEndIndex = endIndex;
    }

    // Extract the chunk and add it to our array
    const chunk = transcript.slice(startIndex, actualEndIndex).trim();
    if (chunk) {
      chunks.push(chunk);
      chunkMetadata.push({ startIndex, endIndex: actualEndIndex });
      console.log('Added chunk:', {
        chunkIndex: chunks.length - 1,
        chunkLength: chunk.length,
        startIndex,
        actualEndIndex,
        progress: `${Math.round((actualEndIndex / transcript.length) * 100)}%`
      });
    }

    // Move the start index forward, ensuring we make progress
    startIndex = actualEndIndex - overlap;
    const lastChunkMeta = chunkMetadata[chunkMetadata.length - 1];
    if (lastChunkMeta && startIndex <= lastChunkMeta.startIndex) {
      startIndex = actualEndIndex; // Skip overlap if we're not making progress
    }

    // Safety check to prevent infinite loops
    if (startIndex >= transcript.length) {
      console.log('Reached end of transcript');
      break;
    }
  }

  console.log('Chunking complete:', {
    numberOfChunks: chunks.length,
    totalChunkedLength: chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  });

  return chunks;
}

// Helper function to merge SOAP sections
function mergeSoapSections(soapResults: SOAPContent[]): SOAPContent {
  return {
    subjective: soapResults.map(r => r.subjective).join('\n'),
    objective: soapResults.map(r => r.objective).join('\n'),
    assessment: soapResults.map(r => r.assessment).join('\n'),
    plan: soapResults.map(r => r.plan).join('\n'),
  };
}

// Helper function to check if model supports JSON response format
function supportsJsonFormat(model: string): boolean {
  // Disable JSON format for all models to ensure they use the detailed template format
  return false;
}

// Helper function to validate note structure
function validateNoteStructure(content: any): boolean {
  try {
    // Basic structure check - just ensure we have a string or object with content
    return (typeof content === 'string' && content.length > 0) ||
           (typeof content === 'object' && content !== null);
  } catch (error) {
    return false;
  }
}

// Define a ChatMessage type
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Creates a chunk summary prompt using the system message stored in settings.
 *
 * @param chunk - A transcript chunk to process.
 * @param chunkIndex - The index of the current chunk.
 * @param totalChunks - The total number of chunks.
 * @param isInitialVisit - A flag to indicate if this is an initial visit.
 * @returns A ChatMessage object with the correctly formatted system prompt.
 */
function createChunkSummaryPrompt(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  isInitialVisit: boolean,
  patientName: string
): ChatMessage {
  const rawPrompt = isInitialVisit ? systemMessages.initialVisit : systemMessages.followUpVisit
  const systemMsg = formatSystemMessage(rawPrompt)
  const content = `${systemMsg.content}\n\nIMPORTANT: The patient's name is "${patientName}". Always use this exact name throughout the note, regardless of any other names mentioned in the transcript. Please extract and organize the relevant medical information from this transcript chunk (${chunkIndex + 1}/${totalChunks}).`
  return {
    role: 'system',
    content,
  }
}

// Helper function to create completion parameters
function createCompletionParams(model: string, messages: any[]) {
  const params: any = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "text" }
  };

  return params;
}

async function createFinalSynthesisPrompt(
  transcript: string,
  isInitialVisit: boolean,
  patientName: string,
  model: string
): Promise<ChatCompletionCreateParamsNonStreaming> {
  const rawSystemMessage = isInitialVisit ? systemMessages.initialVisit : systemMessages.followUpVisit;
  const formattedSystemMessage = formatSystemMessage(rawSystemMessage);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${formattedSystemMessage.content}\n\nIMPORTANT: The patient's name is "${patientName}". Always use this exact name throughout the note, regardless of any other names mentioned in the transcript.`
    },
    { role: 'user', content: transcript }
  ];

  return {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "text" }
  };
}

// Helper function to convert markdown sections to structured format
function convertMarkdownToStructured(markdown: string): any {
  // Return both the original markdown content and formatted HTML version
  return {
    content: markdown,
    formattedContent: formatSoapNote(markdown)
  };
}

// Helper function to ensure patient ID is properly formatted for Supabase
function normalizePatientId(id: any): string {
  if (!id) return '';

  // Convert to string and trim
  const strId = String(id).trim();

  // Validate UUID format with regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Return the normalized ID if it matches UUID format
  return uuidRegex.test(strId) ? strId : '';
}

export async function POST(request: NextRequest) {
  try {
    // Log the raw request structure
    const rawText = await request.text();
    console.log('DEBUG - Raw request body:', rawText);

    // Parse the JSON manually to avoid errors
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (parseError) {
      console.error('DEBUG - Failed to parse request JSON:', parseError);
      return NextResponse.json({
        error: 'Invalid request format',
        details: 'Could not parse request body as JSON'
      }, { status: 400 });
    }

    const { patientId, transcript, audioFileUrl, useStructuredPrompt = false, isInitialEvaluation, patientName } = json;

    // Log received patient ID information with more details
    console.log('DEBUG - API received patientId:', {
      value: patientId,
      type: typeof patientId,
      length: patientId?.length,
      bytes: patientId ? Array.from(String(patientId)).map(c => c.charCodeAt(0)) : null
    });

    // Normalize and validate the patient ID
    const normalizedPatientId = normalizePatientId(patientId);
    if (!normalizedPatientId) {
      console.error('Invalid patient ID format:', patientId);
      return NextResponse.json({
        error: 'Patient not found',
        details: 'Invalid patient ID'
      }, { status: 404 });
    }

    // Check if Supabase is available (inline implementation)
    let isSupabaseAvailable = false;
    try {
      // Check connection using the public client
      const { error } = await supabase.from('patients').select('id', { count: 'exact', head: true }).limit(1);
      if (!error || error.code === '42P01') {
        isSupabaseAvailable = true;
      } else {
        console.error('Supabase connection error (checking availability):', error);
      }
    } catch (error) {
      console.error('Failed to connect to Supabase (checking availability):', error);
    }

    console.log('DEBUG - Supabase is available:', isSupabaseAvailable);

    let patient;
    if (isSupabaseAvailable) {
      console.log('Using Supabase to get patient with ID:', normalizedPatientId);

      // Get patient from Supabase using the SERVICE ROLE client to bypass RLS for this check
      console.log('Querying Supabase (Service Role) for patient with normalized ID:', normalizedPatientId);
      const { data, error } = await serverSupabase // Use serverSupabase here!
        .from('patients')
        .select('*')
        .eq('id', normalizedPatientId)
        .maybeSingle(); // Use maybeSingle() to handle 0 rows gracefully without error

      console.log('DEBUG - Supabase (Service Role) query result:', {
        hasData: !!data,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
      });

      if (error) {
        // Log the error but proceed to Prisma fallback for non-404 errors
        console.error('Error fetching patient from Supabase (Service Role):', error, 'Patient ID:', normalizedPatientId);
      } else if (data) {
        // Patient found with service role!
        console.log('Patient found in Supabase (Service Role):', data.name, 'ID:', data.id);
        patient = convertToPrismaFormat(data, 'patient');
        console.log('DEBUG - Converted patient data:', patient);
      } else {
        // Patient genuinely not found, even with service role
        console.warn('Patient not found in Supabase (Service Role) with ID:', normalizedPatientId);
        return NextResponse.json({
          error: 'Patient not found',
          details: 'No patient found with the provided ID in the database.'
        }, { status: 404 });
      }
    }

    // If Supabase is unavailable, we can't proceed
    if (!patient && !isSupabaseAvailable) { // Adjusted fallback condition
      console.error('Supabase is unavailable and patient data is required');
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }

    if (!patient && isSupabaseAvailable) {
      // This case means Supabase is available, service role query ran, but failed for a reason other than not finding the user.
      // Or if the logic above didn't set the patient variable correctly.
      console.error('Supabase query failed unexpectedly or patient variable not set. Cannot proceed.');
      return NextResponse.json({ error: 'Database query failed', details: 'Failed to retrieve patient information.' }, { status: 500 });
    }

    // If patient is still not found after checks/fallbacks, something is wrong.
    if (!patient) {
        console.error('Patient could not be determined after all checks.');
        return NextResponse.json({ error: 'Patient not found', details: 'Could not retrieve patient information.' }, { status: 404 });
    }

    // Use provided patient name if available, otherwise fallback to the name from the database
    const effectivePatientName = patientName || patient.name;

    console.log('Processing note request:', {
      patientId,
      transcriptLength: transcript?.length,
      hasAudioUrl: !!audioFileUrl
    });

    if (!normalizedPatientId || !transcript) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'Both patientId and transcript are required'
      }, { status: 400 });
    }

    if (typeof transcript !== 'string') {
      return NextResponse.json({
        error: 'Invalid transcript format',
        details: 'Transcript must be a string'
      }, { status: 400 });
    }

    // Check if this is the first visit
    let existingNotes = 0;

    if (isSupabaseAvailable) {
      console.log('Using Supabase to count existing notes');
      const { count, error } = await supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', normalizedPatientId);

      if (error) {
        console.error('Error counting notes in Supabase:', error);
        // Fall back to Prisma if Supabase query fails
      } else {
        existingNotes = count || 0;
      }
    }

    // No fallback if Supabase is unavailable
    if (existingNotes === 0 && !isSupabaseAvailable) {
      console.log('Supabase is unavailable, cannot count existing notes');
      // Keep existingNotes as 0
    }

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
        let previousNote = null;

        if (isSupabaseAvailable) {
          console.log('Using Supabase (Anon Key) to get previous note');
          const { data: noteData, error: noteError } = await supabase // Using anon client here
             .from('notes')
             .select('content')
             .eq('patient_id', normalizedPatientId)
             .order('created_at', { ascending: false })
             .limit(1);

          if (noteError) {
            console.error('Error fetching previous note from Supabase (Anon Key):', noteError);
            // Fall back to Prisma if Supabase query fails
          } else if (noteData && noteData.length > 0) {
            previousNote = { content: noteData[0].content };
          }
        }

        // If no previous note found in Supabase, return an error
        if (!previousNote) {
          console.log('No previous note found and no fallback available');
          previousNote = null;
        }

        if (previousNote && previousNote.content) {
          let previousContent = '';
          try {
            // Try to parse the content, which might be in JSON format
            const parsedContent = JSON.parse(previousNote.content);
            // If it has a content property, use that, otherwise use the whole parsed object
            previousContent = typeof parsedContent.content === 'string'
              ? parsedContent.content
              : JSON.stringify(parsedContent.content) || previousNote.content;
          } catch (e) {
            // If parsing fails, use the content as is
            previousContent = previousNote.content;
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

    // Get current settings for the model name
    let settings = null;

    if (isSupabaseAvailable) {
      console.log('Using Supabase to get app settings');
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        console.error('Error fetching settings from Supabase:', error);
        // Fall back to Prisma if Supabase query fails
      } else {
        settings = convertToPrismaFormat(data, 'settings');
      }
    }

    // Use default settings if Supabase is unavailable
    if (!settings) {
      console.log('Supabase is unavailable, using default settings');
      settings = {
        id: 'default',
        darkMode: true,
        gptModel: 'gpt-4o',
        initialVisitPrompt: '',
        followUpVisitPrompt: '',
        autoSave: false,
        lowEchoCancellation: false,
        updatedAt: new Date()
      };
    }

    if (!settings) {
      console.error('Settings not found');
      return NextResponse.json({
        error: 'Application configuration error',
        details: 'Settings not found'
      }, { status: 500 });
    }

    // Make sure we have a valid model
    const model = settings.gptModel || 'gpt-4o'; // Use a default if undefined

    if (!isValidModel(model)) {
      console.error('Invalid model specified:', model);
      return NextResponse.json({
        error: 'Invalid model configuration',
        details: `Model ${model} is not supported`
      }, { status: 500 });
    }

    console.log('Using GPT model:', model);

    try {
      let responseContent;

      // Check whether to use structured prompt approach or legacy chunking approach
      if (useStructuredPrompt) {
        console.log('======= USING NEW STRUCTURED PROMPT APPROACH =======');
        console.log('Message format: Previous note and transcript as separate messages');
        console.log('Temperature: 0.3 (more deterministic output)');

        // Process and get previous note content if this isn't an initial visit
        let previousSoapNote = undefined;
        if (!isInitialVisit) {
          const previousNote = await prisma.note.findFirst({
            where: {
              patientId: normalizedPatientId,
              createdAt: { lt: new Date() }
            },
            orderBy: { createdAt: 'desc' },
            select: { content: true }
          });

          if (previousNote && previousNote.content) {
            try {
              // Try to parse the content, which might be in JSON format
              const parsedContent = JSON.parse(previousNote.content);
              // If it has a content property, use that
              previousSoapNote = typeof parsedContent.content === 'string'
                ? parsedContent.content
                : JSON.stringify(parsedContent.content) || previousNote.content;
            } catch (e) {
              // If parsing fails, use the content as is
              previousSoapNote = previousNote.content;
            }
          }
        }

        // Get the appropriate template
        const rawSystemMessage = isInitialVisit
          ? systemMessages.initialVisit
          : systemMessages.followUpVisit;

        // Check if transcript exceeds token limits
        const tokenEstimate = estimateTokenCount(transcript);
        const isLongTranscript = tokenEstimate > 3000;

        if (isLongTranscript) {
          console.log(`Long transcript detected (est. ${tokenEstimate} tokens), using chunking strategy`);

          // Fall back to chunking for very long transcripts
          const maxChunkSize = transcript.length > 100000 ? 32000 : 16000;
          const chunks = splitTranscriptIntoChunks(transcript, maxChunkSize);

          if (chunks.length === 0) {
            throw new Error('Failed to split transcript into chunks');
          }

          console.log(`Processing transcript in ${chunks.length} chunks`);

          // Process chunks as before
          const chunkSummaries = await Promise.all(chunks.map(async (chunk, index) => {
            let attempts = 0;
            const maxAttempts = 3;
            let summary = '';

            while (attempts < maxAttempts) {
              try {
                const completion = await openai.chat.completions.create({
                  model,
                  messages: [
                    createChunkSummaryPrompt(chunk, index, chunks.length, isInitialVisit, effectivePatientName),
                    { role: "user", content: chunk }
                  ],
                  temperature: 0.3,
                  max_tokens: 1000
                });

                summary = completion.choices[0]?.message?.content || '';
                if (!summary) {
                  throw new Error('Empty response from OpenAI API');
                }

                console.log(`Successfully processed chunk ${index + 1}/${chunks.length}`);
                return summary;
              } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                  throw error;
                }
                console.log(`Retrying chunk ${index + 1} (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
            return summary;
          }));

          // Filter out any undefined values
          const validSummaries = chunkSummaries.filter((summary): summary is string => !!summary);

          console.log(`Generated ${validSummaries.length} valid chunk summaries`);

          // Create structured messages with the chunk summaries as the transcript
          const finalContent = validSummaries.join("\n");
          const structuredMessages = buildOpenAIMessages({
            previousSoapNote,
            currentTranscript: finalContent,
            soapTemplate: rawSystemMessage,
            patientName: effectivePatientName
          });

          // Make the final API call with structured messages
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            try {
              const completion = await openai.chat.completions.create({
                model,
                messages: structuredMessages,
                temperature: 0.3,
                max_tokens: 4000,
                response_format: { type: "text" }
              });

              responseContent = completion.choices[0]?.message?.content;
              if (!responseContent) {
                throw new Error('Empty response from OpenAI API');
              }
              break;
            } catch (error) {
              attempts++;
              if (attempts === maxAttempts) {
                throw error;
              }
              console.log(`Retrying final synthesis (attempt ${attempts + 1}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
        } else {
          // For shorter transcripts, use the structured approach directly
          console.log('Using direct structured approach without chunking');

          const structuredMessages = buildOpenAIMessages({
            previousSoapNote,
            currentTranscript: transcript,
            soapTemplate: rawSystemMessage,
            patientName: effectivePatientName
          });

          const completion = await openai.chat.completions.create({
            model,
            messages: structuredMessages,
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: "text" }
          });

          responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('Empty response from OpenAI API');
          }
        }
      } else {
        // Use the legacy approach
        console.log('Using legacy chunking approach');

        const maxChunkSize = enhancedTranscript.length > 100000 ? 32000 : 16000;
        const chunks = splitTranscriptIntoChunks(enhancedTranscript, maxChunkSize);

        if (chunks.length === 0) {
          throw new Error('Failed to split transcript into chunks');
        }

        console.log(`Processing transcript in ${chunks.length} chunks`);

        // Step 1: Generate summaries for each chunk with retries
        const chunkSummaries = await Promise.all(chunks.map(async (chunk, index) => {
          let attempts = 0;
          const maxAttempts = 3;
          let summary = '';

          while (attempts < maxAttempts) {
            try {
              const completion = await openai.chat.completions.create({
                model,
                messages: [
                  createChunkSummaryPrompt(chunk, index, chunks.length, isInitialVisit, effectivePatientName),
                  { role: "user", content: chunk }
                ],
                temperature: 0.3,
                max_tokens: 1000
              });

              summary = completion.choices[0]?.message?.content || '';
              if (!summary) {
                throw new Error('Empty response from OpenAI API');
              }

              console.log(`Successfully processed chunk ${index + 1}/${chunks.length}`);
              return summary;
            } catch (error) {
              attempts++;
              if (attempts === maxAttempts) {
                throw error;
              }
              console.log(`Retrying chunk ${index + 1} (attempt ${attempts + 1}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
          return summary;
        }));

        // Filter out any undefined values
        const validSummaries = chunkSummaries.filter((summary): summary is string => !!summary);

        console.log(`Generated ${validSummaries.length} valid chunk summaries`);

        // Step 2: Synthesize all summaries into final note with retries
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            const finalContent = validSummaries.length > 1 ? validSummaries.join("\n") : enhancedTranscript;
            const completion = await openai.chat.completions.create(
              await createFinalSynthesisPrompt(finalContent, isInitialVisit, effectivePatientName, model)
            );

            responseContent = completion.choices[0]?.message?.content;
            if (!responseContent) {
              throw new Error('Empty response from OpenAI API');
            }
            break;
          } catch (error) {
            attempts++;
            if (attempts === maxAttempts) {
              throw error;
            }
            console.log(`Retrying final synthesis (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }

      // Handle the response content
      if (!responseContent) {
        throw new Error('Failed to generate SOAP note content');
      }

      // Format the note content with HTML
      const formattedContent = formatSoapNote(responseContent);

      // Create note in database with both raw and formatted content
      let note;

      if (isSupabaseAvailable) {
        console.log('Using Supabase to create note');
        try {
          // Generate a new UUID for the note
          const noteId = crypto.randomUUID();
          const now = new Date().toISOString();

          // Insert note into Supabase
          const { data, error } = await supabase
            .from('notes')
            .insert({
              id: noteId,
              patient_id: normalizedPatientId,
              transcript: transcript,
              content: JSON.stringify({
                content: responseContent,
                formattedContent
              }),
              audio_file_url: audioFileUrl,
              is_initial_visit: isInitialVisit,
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

          if (error) throw error;

          // Convert to Prisma format
          note = convertToPrismaFormat(data, 'note');
        } catch (error) {
          console.error('Error creating note in Supabase:', error);
          // Fall back to Prisma
        }
      }

      // No fallback if Supabase is unavailable
      if (!note) {
        console.error('Supabase is unavailable and no fallback is configured');
        return NextResponse.json({
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.'
        }, { status: 503 });
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
          if (isSupabaseAvailable) {
            console.log('Using Supabase to update note summary');
            const { error } = await supabase
              .from('notes')
              .update({ summary, updated_at: new Date().toISOString() })
              .eq('id', note.id);

            if (error) {
              console.error('Error updating note summary in Supabase:', error);
              // No fallback available, but we can continue since the note was created
              // The summary update is not critical
              console.log('Could not update summary, but note was created successfully');
            }
          } else {
            console.log('Using Prisma to update note summary');
            await prisma.note.update({
              where: { id: note.id },
              data: { summary }
            });
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
    console.error('Error in note generation:', error);
    return NextResponse.json({
      error: 'Failed to create note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPatientId = searchParams.get('patientId')

    // Normalize the patient ID
    const patientId = normalizePatientId(rawPatientId);

    if (!patientId) {
      console.error('Invalid patient ID in GET request:', rawPatientId);
      return NextResponse.json({ error: 'Valid patient ID is required' }, { status: 400 })
    }

    console.log('GET notes for patient ID:', patientId);

    // Using updated server-side validation
    try {
      const patientExists = await validatePatientWithServerSide(patientId);
      if (!patientExists) {
        console.warn(`Patient not found in Supabase for GET request: ${patientId}`);
        // Continue anyway to try to get notes
      }
    } catch (error) {
      console.error('API Error during Supabase patient validation:', error);
      // Continue anyway to try to get notes
    }

    // Check if Supabase is available (inline implementation)
    let isSupabaseAvailable = false;
    try {
      const { data, error } = await supabase.from('patients').select('id').limit(1);
      if (!error || error.code === '42P01') { // 42P01 means table doesn't exist, which is fine
        isSupabaseAvailable = true;
      } else {
        console.error('Supabase connection error:', error);
      }
    } catch (error) {
      console.error('Failed to connect to Supabase:', error);
    }

    if (isSupabaseAvailable) {
      console.log('Using Supabase to get notes');
      // Get notes from Supabase using the server-side function
      const supabaseNotes: SupabaseNote[] = await getSupabaseNotes(patientId);

      // If no notes are found, this might be because the patient doesn't exist
      // But we'll still return an empty array rather than an error

      // Convert to Prisma format
      const notes = supabaseNotes.map((note: SupabaseNote) =>
        convertToPrismaFormat(note, 'note')
      ).filter((note): note is PrismaNote => note !== null) as PrismaNote[];

      return NextResponse.json(notes);
    } else {
      // No fallback to SQLite/Prisma - just return an error
      console.error('Supabase is unavailable and no fallback is configured');
      return NextResponse.json({
        error: 'Database connection unavailable',
        details: 'Please check your database connection settings.'
      }, { status: 503 });
    }
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// Add this helper function for server-side patient validation
async function validatePatientWithServerSide(patientId: string): Promise<boolean> {
  try {
    const { data, error } = await serverSupabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .single();

    if (error) {
      console.error('Error validating patient existence in Supabase:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in validatePatientWithServerSide:', error);
    return false;
  }
}
