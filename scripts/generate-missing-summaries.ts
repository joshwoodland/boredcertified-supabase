import { PrismaClient, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function main() {
  try {
    // Get the current model from settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get all notes that don't have a summary
    const notes = await prisma.note.findMany({
      where: {
        summary: null
      }
    });

    console.log(`Found ${notes.length} notes without summaries`);

    // Process notes in sequence to avoid rate limits
    for (const note of notes) {
      try {
        console.log(`Processing note ${note.id}...`);
        const summary = await generateSummary(note.content, settings.gptModel);
        
        await prisma.note.update({
          where: { id: note.id },
          data: {
            summary
          }
        });

        console.log(`✓ Generated summary for note ${note.id}`);
        
        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to process note ${note.id}:`, error);
      }
    }

    console.log('Finished generating summaries');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main(); 