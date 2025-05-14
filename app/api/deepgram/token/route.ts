import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/deepgram/token
 *
 * Returns a short-lived token for WebSocket streaming.
 * The token will be used by the client to establish a WebSocket connection.
 */
export async function POST(_req: NextRequest) {
  try {
    const masterKey = process.env.DEEPGRAM_API_KEY;
    console.log('Attempting to access DEEPGRAM_API_KEY. Is it defined:', !!masterKey);
    if (!masterKey) {
      console.error('DEEPGRAM_API_KEY environment variable is not set');
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }

    // Use the correct endpoint URL for token generation
    const url = 'https://api.deepgram.com/v1/auth/token';
    const payload = {
      scopes: ['listen'], // Corrected from 'scope' to 'scopes' (array)
      time_to_live_in_seconds: 900, // 15 minutes
    };

    // Log the request details for debugging
    console.log('Deepgram request:', { url, method: 'POST', payload });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Log the response status and headers
    console.log('Deepgram response:', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', errorText);
      
      // Parse error response if possible
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Failed to create Deepgram token: ${errorJson.message || response.statusText}`);
      } catch (e) {
        // If parsing fails, use the raw error text
        throw new Error(`Failed to create Deepgram token: ${response.statusText}. Details: ${errorText}`);
      }
    }

    const data = await response.json();

    return NextResponse.json(
      { token: data.token, expiresIn: 900 },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating Deepgram token:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate token',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}