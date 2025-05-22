import { NextRequest, NextResponse } from 'next/server';

/**
 * Extremely simple environment variable test
 * This endpoint has minimal dependencies and just checks if environment variables exist
 */
export async function GET(request: NextRequest) {
  // Log that this endpoint was called
  console.log('ENV-TEST ENDPOINT CALLED');
  
  try {
    // Check for Deepgram API key
    const hasDeepgramKey = 'DEEPGRAM_API_KEY' in process.env;
    const deepgramKeyValue = process.env.DEEPGRAM_API_KEY || '';
    
    // Log the results
    console.log(`ENV-TEST: Has DEEPGRAM_API_KEY: ${hasDeepgramKey}`);
    console.log(`ENV-TEST: Key length: ${deepgramKeyValue.length}`);
    
    // Return basic info
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hasDeepgramKey,
      keyLength: deepgramKeyValue.length,
      environment: process.env.NODE_ENV,
      vercel: process.env.VERCEL === '1'
    });
  } catch (error) {
    console.error('ENV-TEST ERROR:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
