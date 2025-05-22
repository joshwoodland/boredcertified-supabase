import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the Deepgram API key from environment variables
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      console.error('DEEPGRAM_API_KEY environment variable is not set');
      return NextResponse.json(
        { 
          error: 'Deepgram API key not found',
          details: 'The Deepgram API key is not configured on the server'
        },
        { status: 500 }
      );
    }

    // Get the options from the request body
    const options = await request.json();

    // Build the WebSocket URL with the provided options
    const queryParams = Object.entries(options)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');

    // Return the WebSocket URL and headers that the client should use
    return NextResponse.json({
      url: `wss://api.deepgram.com/v1/listen?${queryParams}`,
      headers: {
        Authorization: `Token ${apiKey}`
      }
    });
  } catch (error) {
    console.error('Error setting up Deepgram connection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to set up connection',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 