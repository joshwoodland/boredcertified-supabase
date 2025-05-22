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

    // Validate audio file
    if (audioFile.size === 0) {
      console.warn('[TRANSCRIBE API] Empty audio file received, skipping transcription');
      return NextResponse.json(
        { error: 'Empty audio file' },
        { status: 400 }
      );
    }

    // Log audio details for debugging
    console.log('[TRANSCRIBE API] Processing audio file', {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      timestamp: new Date().toISOString()
    });

    // Skip very small audio chunks that might be noise
    if (audioFile.size < 1000) { // Less than 1KB
      console.log('[TRANSCRIBE API] Skipping very small audio chunk');
      return NextResponse.json({ 
        results: { 
          channels: [{ 
            alternatives: [{ 
              transcript: '', 
              confidence: 0 
            }] 
          }] 
        } 
      });
    }

    // Forward to Deepgram with proper parameters
    const deepgramFormData = new FormData();
    deepgramFormData.append('audio', audioFile);

    // Build the API URL with transcription parameters
    const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('language', 'en-US');
    deepgramUrl.searchParams.set('model', 'nova-2');
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('smart_format', 'true');
    // Let Deepgram auto-detect the audio format from the WebM file
    // This is more reliable than manually specifying encoding parameters
    
    console.log('[TRANSCRIBE API] Sending request to Deepgram:', {
      url: deepgramUrl.toString(),
      audioSize: audioFile.size,
      audioType: audioFile.type,
      audioName: audioFile.name
    });

    const response = await fetch(deepgramUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepgramApiKey}`,
      },
      body: deepgramFormData, // Use FormData instead of raw file
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TRANSCRIBE API] Deepgram error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        audioSize: audioFile.size,
        audioType: audioFile.type
      });
      
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
    console.log('[TRANSCRIBE API] Transcription successful', {
      hasTranscript: !!(result.results?.channels?.[0]?.alternatives?.[0]?.transcript),
      transcriptLength: result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.length || 0
    });

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