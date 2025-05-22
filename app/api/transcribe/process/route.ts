import { NextRequest, NextResponse } from 'next/server';

/**
 * POST handler for server-side audio transcription
 * This endpoint receives audio data and forwards it to Deepgram,
 * providing better error handling and network reliability than client-side calls
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TRANSCRIBE API] Processing audio transcription request');

    // Get the Deepgram API key from environment variables
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      console.error('[TRANSCRIBE API] Missing Deepgram API key');
      return NextResponse.json(
        { error: 'Transcription service not configured' },
        { status: 500 }
      );
    }

    // Get the audio data from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('[TRANSCRIBE API] Forwarding audio to Deepgram', {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type
    });

    // Forward to Deepgram with proper error handling
    const deepgramFormData = new FormData();
    deepgramFormData.append('audio', audioFile);

    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
      },
      body: deepgramFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TRANSCRIBE API] Deepgram error:', response.status, errorText);
      
      return NextResponse.json(
        { 
          error: 'Transcription failed',
          details: `Deepgram API responded with status ${response.status}`,
          deepgramError: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[TRANSCRIBE API] Transcription successful');

    return NextResponse.json(result);

  } catch (error) {
    console.error('[TRANSCRIBE API] Error processing transcription:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 