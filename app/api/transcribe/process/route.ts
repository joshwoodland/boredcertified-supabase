import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import OpenAI from 'openai';
import systemMessages from '@/app/config/systemMessages';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { formatSystemMessage } from '@/app/utils/formatSystemMessage';
import { MODEL_MAP } from '@/app/config/models';
import { getCurrentModel } from '@/app/utils/modelCache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to validate model name and get its OpenAI identifier
function getOpenAIModelIdentifier(modelName: string): string {
  const modelId = MODEL_MAP[modelName];
  if (!modelId) {
    throw new Error(`Invalid model name: ${modelName}`);
  }
  return modelId;
}

// Helper function to validate model name
function isValidModel(model: string): boolean {
  return MODEL_MAP.hasOwnProperty(model);
}

interface ChunkSummary {
  index: number;
  summary: string;
  chunk: string;
  isInitialVisit: boolean;
  patientName: string;
}

// Example function that creates the final synthesis prompt
// and determines which model to use
async function createFinalSynthesisPrompt(
  transcript: string,
  isInitialVisit: boolean,
  modelName: string
): Promise<ChatCompletionCreateParamsNonStreaming> {
  const rawSystemMessage = isInitialVisit
    ? systemMessages.initialVisit
    : systemMessages.followUpVisit;
  const formattedSystemMessage = formatSystemMessage(rawSystemMessage);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: formattedSystemMessage.content as string,
    },
    { role: 'user', content: transcript },
  ];

  // Convert the UI model name to OpenAI's model identifier
  const openAIModelId = getOpenAIModelIdentifier(modelName);

  return {
    model: openAIModelId,
    messages,
    temperature: 0.3,
    max_tokens: 1000, // Adjust based on your application's requirements
  };
}

// Helper function to generate a summary
async function generateSummary(content: string, model: string): Promise<string> {
  const summaryPrompt: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      {
        role: 'system' as const,
        content: 'You are a medical note summarizer. Create a one-line summary (max 100 characters) of the key points from this medical note. Focus on the main diagnosis, treatment, or changes.',
      },
      {
        role: 'user' as const,
        content,
      },
    ],
    temperature: 0.3,
    max_tokens: 100,
  };

  const completion = await openai.chat.completions.create(summaryPrompt);
  return completion.choices[0]?.message?.content || 'Visit summary not available';
}

// Example usage in an API route
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

    // Check if this is the first visit
    const existingNotes = await prisma.note.count({
      where: { patientId },
    });
    const isInitialVisit = existingNotes === 0;

    console.log('Visit type:', isInitialVisit ? 'Initial' : 'Follow-up');

    // Get current settings just for the model name
    const model = await getCurrentModel();

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
      const chunks = transcript.split(/\n/).filter(Boolean);
      const chunkSummaries = await Promise.all(chunks.map(async (chunk: string, index: number): Promise<ChunkSummary> => {
        const summary = await generateSummary(chunk, model);
        return {
          index,
          summary,
          chunk,
          isInitialVisit,
          patientName: patient.name
        };
      }));

      const validSummaries = chunkSummaries.filter(summary => summary.summary.length > 0);
      const finalContent = validSummaries.length > 1 ? validSummaries.map(summary => summary.summary).join("\n") : transcript;

      const formattedSystemMessage = formatSystemMessage(systemMessages.initialVisit);

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `${formattedSystemMessage.content}\n\nIMPORTANT: The patient's name is "${patient.name}". Always use this exact name throughout the note, regardless of any other names mentioned in the transcript.`
          },
          { role: 'user', content: finalContent }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "text" }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Empty response from OpenAI API');
      }

      // Create note in database
      const note = await prisma.note.create({
        data: {
          patientId,
          transcript,
          content: responseContent,
          audioFileUrl: audioFileUrl || null,
          isInitialVisit,
        },
      });

      return NextResponse.json(note);
    } catch (error) {
      console.error('Error:', error);
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 