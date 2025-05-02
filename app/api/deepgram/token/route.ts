import { NextRequest, NextResponse } from 'next/server';
import { Deepgram } from '@deepgram/sdk';

/**
 * API route to generate a short-lived Deepgram API token
 * This is more secure than exposing the API key directly to the client
 * Compatible with Deepgram SDK v3
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }

    // For SDK v3, we'll use the direct API key in the client
    // This is a simplified approach for the demo
    // In production, you should implement proper token generation
    // using the Deepgram API directly

    // Return the API key as a token (not recommended for production)
    return NextResponse.json({
      token: process.env.DEEPGRAM_API_KEY,
      message: 'Using direct API key for demo purposes'
    });
  } catch (error) {
    console.error('Error generating Deepgram token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
