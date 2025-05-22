import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * POST handler for setting up a Deepgram WebSocket connection
 * This is a legacy endpoint that now uses the new token API
 *
 * @param request The incoming request
 * @returns A response containing the WebSocket URL and headers
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[DEEPGRAM WEBSOCKET API] Processing request');

    // Get the options from the request body
    const options = await request.json();

    // Get a token from our secure token API
    const timestamp = new Date().getTime();
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/deepgram/token?ttl=7200&t=${timestamp}`, {
      method: 'GET',
      // Use the same headers as the client would
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    // Check if the token request was successful
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[DEEPGRAM WEBSOCKET API] Failed to get token:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to get Deepgram token',
          details: errorData.error || `Token API responded with status ${tokenResponse.status}`,
        },
        { status: tokenResponse.status }
      );
    }

    // Parse the token response
    const tokenData = await tokenResponse.json();

    // Verify we received a valid token
    if (!tokenData.token) {
      console.error('[DEEPGRAM WEBSOCKET API] Invalid token received:', tokenData);
      return NextResponse.json(
        {
          error: 'Invalid token received',
          details: 'The token API returned an invalid response',
        },
        { status: 500 }
      );
    }

    console.log('[DEEPGRAM WEBSOCKET API] Successfully obtained token');

    // Build the WebSocket URL with the provided options
    const queryParams = Object.entries(options)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');

    // Return the WebSocket URL and headers with the temporary token
    // For temporary tokens from the token API, use Token format
    return NextResponse.json({
      url: `wss://api.deepgram.com/v1/listen?${queryParams}`,
      headers: {
        Authorization: `Token ${tokenData.token}`,
      },
    });
  } catch (error) {
    console.error('[DEEPGRAM WEBSOCKET API] Error setting up connection:', error);
    return NextResponse.json(
      {
        error: 'Failed to set up connection',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}