import { NextRequest, NextResponse } from 'next/server';

/**
 * Direct test endpoint for Deepgram API key
 * This is a simplified endpoint with minimal dependencies to help diagnose issues
 */
export async function GET(request: NextRequest) {
  // Log to console to verify the endpoint is being called
  console.log('DIRECT TEST ENDPOINT CALLED');
  
  try {
    // Get all environment variables (names only)
    const allEnvVars = Object.keys(process.env).sort();
    
    // Check for Deepgram API key directly
    const hasDeepgramKey = 'DEEPGRAM_API_KEY' in process.env;
    const deepgramKeyValue = process.env.DEEPGRAM_API_KEY;
    const deepgramKeyLength = deepgramKeyValue ? deepgramKeyValue.length : 0;
    
    // Log the results (should appear in Vercel logs)
    console.log('DIRECT TEST RESULTS:');
    console.log(`- Has DEEPGRAM_API_KEY: ${hasDeepgramKey}`);
    console.log(`- Key length: ${deepgramKeyLength}`);
    console.log(`- Total env vars: ${allEnvVars.length}`);
    
    // Return the results
    return NextResponse.json({
      test: 'direct-test',
      timestamp: new Date().toISOString(),
      hasDeepgramKey,
      keyLength: deepgramKeyLength,
      totalEnvVars: allEnvVars.length,
      // Include a few env var names as a sample (not values)
      sampleEnvVars: allEnvVars.slice(0, 5),
      // Include Node.js version and environment
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('DIRECT TEST ERROR:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
