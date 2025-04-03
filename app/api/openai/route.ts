import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/app/lib/db';

// Initialize the OpenAI client with the API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();

    // Extract request parameters
    const { model, messages, temperature = 0.7, patientId } = body;
    
    // Validate required parameters
    if (!model) {
      return NextResponse.json({ error: 'Missing model parameter' }, { status: 400 });
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid messages parameter' }, { status: 400 });
    }

    // If patientId is provided, we can determine if this is an initial or follow-up visit
    // and use the appropriate system message from settings
    if (patientId) {
      try {
        // Get settings to retrieve system messages
        const settings = await prisma.appSettings.findUnique({
          where: { id: 'default' },
        });

        if (!settings) {
          return NextResponse.json({ error: 'App settings not found' }, { status: 500 });
        }

        // Check if this is the first visit for this patient
        const existingNotes = await prisma.note.count({
          where: { patientId },
        });
        const isInitialVisit = existingNotes === 0;

        // Determine which system message to use
        const systemMessage = isInitialVisit 
          ? settings.initialVisitPrompt 
          : settings.followUpVisitPrompt;

        // Replace the system message if present, otherwise add it
        const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
        if (systemMessageIndex >= 0) {
          messages[systemMessageIndex].content = systemMessage;
        } else if (messages.length > 0) {
          messages.unshift({ role: 'system', content: systemMessage });
        }
      } catch (error) {
        console.error('Error determining visit type:', error);
        // Continue with the provided messages if there's an error
      }
    }

    // Validate API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set");
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
    }

    // Make request to OpenAI API
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });

    // Extract and return response content
    const content = completion.choices[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    
    return NextResponse.json({ 
      error: 'Failed to generate response',
      details: error instanceof Error ? error.message : 'Error communicating with OpenAI API'
    }, { status: 500 });
  }
} 