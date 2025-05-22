/**
 * @file app/api/deepgram/test-connection/route.ts
 * @description Test endpoint to verify Deepgram API connectivity and token generation
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing basic Deepgram connectivity
 * POST handler for testing actual transcription functionality
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[CONNECTION TEST] Testing basic Deepgram connectivity');

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    // Test basic connectivity
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${deepgramApiKey}`,
      },
      signal: AbortSignal.timeout(10000)
    });

    const result = {
      timestamp: new Date().toISOString(),
      connectivity: {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        projectsFound: undefined as number | undefined
      },
      fixes_applied: {
        'HTTP auth method': 'Bearer instead of Token',
        'Audio format handling': 'Auto-detection enabled',
        'Parameter conflicts': 'Removed encoding conflicts',
        'Error handling': 'Enhanced validation and logging'
      }
    };

    if (response.ok) {
      const data = await response.json();
      result.connectivity.projectsFound = data.projects?.length || 0;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[CONNECTION TEST] Error:', error);
    return NextResponse.json(
      {
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for testing transcription with a sample audio file
 * This helps verify that the 400 errors have been resolved
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TRANSCRIPTION TEST] Testing transcription functionality');

    const contentType = request.headers.get('content-type');
    
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { 
          error: 'Please send a multipart/form-data request with an audio file',
          example: 'curl -X POST -F "audio=@test.webm" /api/deepgram/test-connection'
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided in form data' },
        { status: 400 }
      );
    }

    console.log('[TRANSCRIPTION TEST] Received audio file:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Forward to our fixed transcription endpoint
    const transcriptionFormData = new FormData();
    transcriptionFormData.append('audio', audioFile);

    const transcriptionResponse = await fetch(`${request.nextUrl.origin}/api/transcribe/process`, {
      method: 'POST',
      body: transcriptionFormData,
    });

    const transcriptionResult = await transcriptionResponse.json();

    const result = {
      timestamp: new Date().toISOString(),
      test_file: {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type
      },
      transcription: {
        success: transcriptionResponse.ok,
        status: transcriptionResponse.status,
        statusText: transcriptionResponse.statusText,
        result: transcriptionResult
      },
      fixes_verified: transcriptionResponse.ok ? [
        '✅ HTTP authentication working',
        '✅ Audio format accepted by Deepgram',
        '✅ No parameter conflicts',
        '✅ Server-side transcription functional'
      ] : [
        '❌ Still experiencing issues - check logs above'
      ]
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[TRANSCRIPTION TEST] Error:', error);
    return NextResponse.json(
      {
        error: 'Transcription test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 