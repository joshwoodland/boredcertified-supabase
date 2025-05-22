import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/app/utils/serverConfig';

export async function POST(request: NextRequest) {
  try {
    // Get the Deepgram API key from environment variables or server runtime config
    const serverConfig = getServerConfig();
    const apiKey = process.env.DEEPGRAM_API_KEY || serverConfig.DEEPGRAM_API_KEY;

    // More detailed debug logging
    console.log('Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? 'Present' : 'Missing');
    console.log('- Deepgram API key available:', !!apiKey);
    console.log('- API key length (if available):', apiKey ? apiKey.length : 0);
    console.log('- Server config available:', !!serverConfig);

    // Log all environment variables (without revealing their values)
    const envVars = Object.keys(process.env).sort();
    console.log('- Available environment variables:', envVars.join(', '));

    if (!apiKey) {
      console.error('DEEPGRAM_API_KEY environment variable is not set or empty');
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