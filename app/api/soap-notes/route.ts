import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import OpenAI from 'openai'
import { systemMessage as initialVisitPrompt } from '@/app/config/initialVisitPrompt'
import { systemMessage as followUpVisitPrompt } from '@/app/config/followUpVisitPrompt'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to validate model name
function isValidModel(model: string): boolean {
  const validModels = [
    'gpt-4',
    'gpt-4-turbo-preview',  // 4o
    'gpt-4-0314',          // o1
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',  // 3o-mini
    'gpt-3.5-turbo-0301',  // o3-mini
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

interface SOAPContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  [key: string]: string;
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
  return model.includes('turbo');
}

// Helper function to create completion parameters
function createCompletionParams(model: string, messages: any[]) {
  const params: any = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "text" }  // We want the raw text format since we're using markdown
  };

  return params;
}

// Add type for OpenAI message
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
}

function createChunkSummaryPrompt(chunk: string, chunkIndex: number, totalChunks: number): ChatMessage {
  return {
    role: "system",
    content: `You are a medical scribe assistant. Your task is to extract and structure medical information from this transcript chunk (${chunkIndex + 1}/${totalChunks}). Maintain the exact format and structure for each section:

1. Chief Complaint and History of Present Illness
   - Exact patient complaints and symptoms
   - Chronological progression
   - Severity and frequency
   - Impact on daily life

2. Past Medical History, Family History, Social History
   - All mentioned diagnoses with dates
   - Family history updates
   - Social circumstances, including:
     * Living situation
     * Employment
     * Substance use
     * Stressors

3. Mental Status Examination
   - Appearance and behavior
   - Mood and affect
   - Thought process and content
   - Cognition and insight
   - Any SI/HI/Risk factors

4. Medications and Treatment
   - Current medications with exact dosages
   - Recent medication changes
   - Side effects or concerns
   - Treatment adherence

5. Vital Signs and Measurements
   - Any mentioned vital signs
   - Weight changes
   - Lab results

6. Plan and Follow-up
   - Medication adjustments
   - Treatment recommendations
   - Follow-up timing
   - Referrals

Preserve exact quotes when relevant to clinical assessment. Include all specific dates, numbers, and measurements. Do not summarize or paraphrase when exact details are provided.`
  }
}

async function createFinalSynthesisPrompt(transcript: string, isInitialVisit: boolean): Promise<ChatCompletionCreateParamsNonStreaming> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings) {
    throw new Error('Settings not found');
  }

  const systemMessage = isInitialVisit ? initialVisitPrompt : followUpVisitPrompt;
  console.log(`Using ${isInitialVisit ? 'initial' : 'follow-up'} visit system message`);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemMessage
    },
    {
      role: 'user',
      content: transcript
    }
  ];

  return {
    model: settings.gptModel,
    messages,
    max_tokens: 4000,
    temperature: 0.7,
    response_format: { type: 'text' } as const
  };
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { patientId, transcript, audioFileUrl } = json;

    // Get patient details including name
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json({
        error: 'Patient not found',
        details: 'Invalid patient ID'
      }, { status: 404 });
    }

    console.log('Processing SOAP note request:', { 
      patientId, 
      transcriptLength: transcript?.length,
      hasAudioUrl: !!audioFileUrl 
    });

    if (!patientId || !transcript) {
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
    const existingNotes = await prisma.sOAPNote.count({
      where: { patientId },
    });
    const isInitialVisit = existingNotes === 0;

    console.log('Visit type:', isInitialVisit ? 'Initial' : 'Follow-up');

    // Get current settings just for the model name
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      console.error('Settings not found');
      return NextResponse.json({
        error: 'Application configuration error',
        details: 'Settings not found'
      }, { status: 500 });
    }

    const model = settings.gptModel;
    if (!isValidModel(model)) {
      console.error('Invalid model specified:', model);
      return NextResponse.json({
        error: 'Invalid model configuration',
        details: `Model ${model} is not supported`
      }, { status: 500 });
    }

    console.log('Using GPT model:', model);

    let soapContent: SOAPContent = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    };

    try {
      // Determine chunk size based on transcript length
      const maxChunkSize = transcript.length > 100000 ? 32000 : 16000;
      const chunks = splitTranscriptIntoChunks(transcript, maxChunkSize);
      
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
                createChunkSummaryPrompt(chunk, index, chunks.length),
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

      // Step 2: Synthesize all summaries into final SOAP note with retries
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const completion = await openai.chat.completions.create(
            await createFinalSynthesisPrompt(transcript, isInitialVisit)
          );

          const responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('Empty response from OpenAI API');
          }

          try {
            const parsedContent = JSON.parse(responseContent.trim());
            
            // Validate the parsed content
            if (!parsedContent.subjective || !parsedContent.objective || !parsedContent.assessment || !parsedContent.plan) {
              throw new Error('Missing required SOAP note sections in response');
            }

            // Ensure all fields are strings
            soapContent = {
              subjective: String(parsedContent.subjective).trim(),
              objective: String(parsedContent.objective).trim(),
              assessment: String(parsedContent.assessment).trim(),
              plan: String(parsedContent.plan).trim()
            };

            break;
          } catch (parseError) {
            console.error('Error parsing GPT response:', parseError);
            throw new Error('Failed to parse GPT response as valid JSON');
          }
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            throw error;
          }
          console.log(`Retrying final synthesis (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      // Validate and clean up the SOAP content
      const requiredFields = ['subjective', 'objective', 'assessment', 'plan'] as const;
      const missingFields = requiredFields.filter(field => !soapContent[field]);
      if (missingFields.length > 0) {
        console.error('Missing fields in GPT response:', missingFields, 'Content:', soapContent);
        return NextResponse.json({
          error: 'Invalid SOAP note format',
          details: `Missing required fields: ${missingFields.join(', ')}`
        }, { status: 500 });
      }

      // Ensure all fields are strings and remove any line breaks
      requiredFields.forEach(field => {
        if (typeof soapContent[field] !== 'string') {
          soapContent[field] = String(soapContent[field]);
        }
        // Preserve line breaks but normalize them
        soapContent[field] = soapContent[field]
          .replace(/\r\n/g, '\n')  // Convert Windows line endings to Unix
          .replace(/\r/g, '\n')    // Convert old Mac line endings to Unix
          .trim();
      });

      try {
        // Create SOAP note in database
        const soapNote = await prisma.sOAPNote.create({
          data: {
            patientId,
            transcript,
            audioFileUrl,
            isInitialVisit,
            subjective: soapContent.subjective,
            objective: soapContent.objective,
            assessment: soapContent.assessment,
            plan: soapContent.plan,
          },
        });

        console.log('SOAP note created:', soapNote.id);
        return NextResponse.json(soapNote);
      } catch (error) {
        console.error('Error saving SOAP note to database:', error);
        return NextResponse.json({
          error: 'Database error',
          details: 'Failed to save SOAP note to database'
        }, { status: 500 });
      }

    } catch (error) {
      console.error('Error in OpenAI API call:', error);
      return NextResponse.json({
        error: 'Failed to generate SOAP note',
        details: error instanceof Error ? error.message : 'Error communicating with OpenAI API'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in SOAP note generation:', error);
    return NextResponse.json({ 
      error: 'Failed to create SOAP note',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const soapNotes = await prisma.sOAPNote.findMany({
      where: {
        patientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(soapNotes)
  } catch (error) {
    console.error('Error fetching SOAP notes:', error)
    return NextResponse.json({ error: 'Failed to fetch SOAP notes' }, { status: 500 })
  }
}