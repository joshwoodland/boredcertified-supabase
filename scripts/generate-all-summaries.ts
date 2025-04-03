import { PrismaClient } from '@prisma/client';
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
        content: `You are a medical note summarizer. Create a one-line summary of the visit that includes:
1) The main symptoms or concerns reported by the patient
2) Any medication changes made during the visit (including dosages)
3) End with Continue [medication name] [dosage] for all current medications that were not changed

Example formats:
- Reports improved anxiety. Started Lexapro 10mg, continue Trazodone 50mg.
- Reports poor sleep and anxiety. Increased Lexapro to 20mg, continue Wellbutrin 150mg.

Be concise and focus only on these aspects. Use plain, direct language. Do not use any quotation marks in your response.`,
      },
      {
        role: 'user' as const,
        content,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  };

  const completion = await openai.chat.completions.create(summaryPrompt);
  return completion.choices[0]?.message?.content?.replace(/["']/g, '') || 'Visit summary not available';
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

    // Get all notes without summaries, including those with null or empty summaries
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { summary: null },
          { summary: '' }
        ]
      }
    });

    console.log(`Found ${notes.length} notes without summaries`);

    // Process notes in sequence to avoid rate limits
    for (const note of notes) {
      try {
        console.log(`Processing note ${note.id}...`);
        
        // Extract content for summarization
        let content;
        try {
          // Try to parse JSON content format
          const parsedContent = JSON.parse(note.content);
          content = parsedContent.content || note.content;
        } catch {
          // If not JSON, use as is
          content = note.content;
        }
        
        const summary = await generateSummary(content, settings.gptModel);
        
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

main(); 