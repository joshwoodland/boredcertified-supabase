import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCurrentModel } from '@/app/utils/modelCache';

const openai = new OpenAI();

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { content } = json;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const model = await getCurrentModel();

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
          content: content
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const summary = completion.choices[0]?.message?.content?.replace(/["']/g, '') || 'Follow-up visit';
    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 