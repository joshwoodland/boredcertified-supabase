import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { formatSoapNote } from '@/app/utils/formatSoapNote';

// Initialize the OpenAI client with the API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();

    // Extract request parameters
    const { model, messages, temperature = 0.7, returnFormatted = true } = body;
    
    // Validate required parameters
    if (!model) {
      return NextResponse.json({ error: 'Missing model parameter' }, { status: 400 });
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid messages parameter' }, { status: 400 });
    }

    // Get OpenAI model identifier
    const openAIModelId = model;
    
    // Make request to OpenAI API
    const completion = await openai.chat.completions.create({
      model: openAIModelId,
      messages,
      temperature,
    });

    // Extract and return response content
    const content = completion.choices[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }
    
    // Include both raw and formatted content in the response if requested
    if (returnFormatted) {
      try {
        const formattedContent = formatSoapNote(content);
        return NextResponse.json({ 
          content,
          formattedContent
        });
      } catch (error) {
        console.error('Error formatting content:', error);
        // If formatting fails, just return the raw content
        return NextResponse.json({ content });
      }
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