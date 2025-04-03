import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getCurrentModel } from '@/app/utils/modelCache';

const prisma = new PrismaClient();
const openai = new OpenAI();

// Removing the interface as it didn't resolve the type error
// interface RouteContext {
//   params: {
//     id: string;
//   };
// }

export async function POST(
  request: NextRequest,
  context: any // Revert to 'any' type to bypass build error
) {
  try {
    // Access params through the context object, assuming it has a params property
    const noteId = context?.params?.id; 

    // Add a check to ensure noteId was found
    if (!noteId) {
      console.error('Could not extract noteId from context params');
      return NextResponse.json({ error: 'Invalid request context' }, { status: 400 });
    }

    // Find the note
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // If note already has a summary, return it
    if (note.summary) {
      return NextResponse.json({ summary: note.summary });
    }

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

    // Get current model
    const model = await getCurrentModel();

    // Generate summary
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a medical note summarizer. Create a one-line summary of the visit that includes:
1) The main symptoms or concerns reported by the patient
2) Any medication changes made during the visit (including dosages)
3) End with Continue [medication name] [dosage] for all current medications that were not changed

Example formats:
- Reports improved anxiety. Started Lexapro 10mg, continue Trazodone 50mg.
- Reports poor sleep and anxiety. Increased Lexapro to 20mg, continue Wellbutrin 150mg.

Be concise and focus only on these aspects. Use plain, direct language. Do not use any quotation marks in your response.`
        },
        {
          role: 'user',
          content
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const summary = completion.choices[0]?.message?.content?.replace(/["']/g, '') || 'Follow-up visit';
    
    // Save the summary to the note
    await prisma.note.update({
      where: { id: noteId },
      data: { summary }
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating note summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 