import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import OpenAI from 'openai'
import systemMessages from '@/app/config/systemMessages'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { formatSystemMessage } from '@/app/utils/formatSystemMessage'
import { formatSoapNote } from '@/app/utils/formatSoapNote'

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

export async function POST(request: NextRequest) {
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

    console.log('Processing note request:', { 
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
    const existingNotes = await prisma.note.count({
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
                createChunkSummaryPrompt(chunk, index, chunks.length, isInitialVisit, patient.name),
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
          const finalContent = validSummaries.length > 1 ? validSummaries.join("\n") : transcript;
          const completion = await openai.chat.completions.create(
            await createFinalSynthesisPrompt(finalContent, isInitialVisit, patient.name, model)
          );

          const responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('Empty response from OpenAI API');
          }

          // Format the note content with HTML
          const formattedContent = formatSoapNote(responseContent);
          
          // Create note in database with both raw and formatted content
          const note = await prisma.note.create({
            data: {
              patientId,
              transcript,
              audioFileUrl,
              isInitialVisit,
              content: JSON.stringify({ 
                content: responseContent,
                formattedContent 
              }),
            },
          });

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
              await prisma.note.update({
                where: { id: note.id },
                data: { summary }
              });
              
              note.summary = summary;
            }
          } catch (summaryError) {
            console.error('Error generating note summary:', summaryError);
            // Continue without summary if there's an error
          }

          console.log('Note created:', note.id);
          return NextResponse.json(note);
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            throw error;
          }
          console.log(`Retrying final synthesis (attempt ${attempts + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

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
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const notes = await prisma.note.findMany({
      where: {
        patientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}