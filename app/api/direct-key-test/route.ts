import { NextRequest, NextResponse } from 'next/server';

/**
 * Extremely simple Deepgram API key test
 * This endpoint directly tests the Deepgram API key with minimal dependencies
 */
export async function GET(request: NextRequest) {
  // Log that this endpoint was called
  console.log('DIRECT-KEY-TEST ENDPOINT CALLED');
  
  try {
    // Check for Deepgram API key
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    // Log the results
    console.log(`DIRECT-KEY-TEST: Has API key: ${!!apiKey}`);
    console.log(`DIRECT-KEY-TEST: Key length: ${apiKey ? apiKey.length : 0}`);
    
    if (!apiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Deepgram API key is not set',
        keyExists: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test the API key by making a direct request to Deepgram API
    try {
      console.log('DIRECT-KEY-TEST: Testing API key with Deepgram API...');
      
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      const status = response.status;
      const ok = response.ok;
      
      console.log(`DIRECT-KEY-TEST: API response status: ${status}`);
      console.log(`DIRECT-KEY-TEST: API response ok: ${ok}`);
      
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        console.log('DIRECT-KEY-TEST: Could not parse response as JSON');
      }
      
      return NextResponse.json({
        status: ok ? 'success' : 'error',
        message: ok ? 'API key is valid' : 'API key is invalid',
        keyExists: true,
        keyWorks: ok,
        apiResponse: {
          status,
          ok,
          data: data ? { 
            projects_count: Array.isArray(data.projects) ? data.projects.length : 'unknown',
            has_data: !!data
          } : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      console.error('DIRECT-KEY-TEST: API request failed', apiError);
      
      return NextResponse.json({
        status: 'error',
        message: 'Failed to test API key with Deepgram API',
        keyExists: true,
        keyWorks: false,
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('DIRECT-KEY-TEST: Unexpected error', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'An unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
