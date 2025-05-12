import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/deepgram/token
 *
 * Returns a short-lived Deepgram token (15 minutes) so the browser
 * never sees your master API key.
 */
export async function GET(_req: NextRequest) {
  try {
    const masterKey = process.env.DEEPGRAM_API_KEY;
    if (!masterKey) {
      console.error('DEEPGRAM_API_KEY environment variable is not set');
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }

    // Make a POST request to Deepgram's API to create a temporary key
    const response = await fetch('https://api.deepgram.com/v1/keys', {
      method: 'POST',
      headers: {
        Authorization: `Token ${masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'temporary-client-key',
        scopes: ['usage:write'],
        expires_in: 900, // seconds
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Deepgram key: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(
      { token: data.key, expiresIn: 900 },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating Deepgram token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}