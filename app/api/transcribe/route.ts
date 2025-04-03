import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Ensure environment variables are loaded (especially locally with dotenv)
// In Vercel, these should be set in the project settings.
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, '\n'); // Handle potential escaped newlines

if (!clientEmail || !privateKey) {
  console.error('Missing Google Cloud credentials environment variables');
  // Avoid throwing here during build time, handle at request time
}

export async function POST(request: NextRequest) {
  if (!clientEmail || !privateKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Google Cloud credentials.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log(`Received file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Convert the file Blob/File object into a Buffer for the API
    const audioBytes = Buffer.from(await file.arrayBuffer());
    const audioBase64 = audioBytes.toString('base64');

    // Initialize the SpeechClient
    const speechClient = new SpeechClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      // Optional: Specify project ID if not implicitly set
      // projectId: process.env.GOOGLE_PROJECT_ID, 
    });

    // Configure the request
    const audio = {
      content: audioBase64,
    };
    const config = {
      // encoding: 'LINEAR16', // Often needed for WAV, but let GCSTT try auto-detect first
      // sampleRateHertz: 48000, // Ideally get this from client, but GCSTT can often auto-detect
      languageCode: 'en-US', // Adjust as needed
      // Optional: Enable enhanced models, punctuation, etc.
      // model: 'telephony', // Or 'medical_dictation' etc. if applicable
      // enableAutomaticPunctuation: true,
    };
    const speechRequest = {
      audio: audio,
      config: config,
    };

    console.log("Sending request to Google Cloud Speech-to-Text...");

    // Detects speech in the audio file
    const [response] = await speechClient.recognize(speechRequest);

    console.log("Received response from Google Cloud Speech-to-Text.");

    if (!response.results || response.results.length === 0) {
      console.log("Google Cloud Speech-to-Text returned no results.");
      return NextResponse.json({ transcript: '' }, { status: 200 }); // Return empty transcript gracefully
    }

    // Concatenate results
    const transcript = response.results
      .map(result => result.alternatives?.[0]?.transcript)
      .filter(Boolean) // Remove any potential undefined/null transcripts
      .join(' ');

    console.log(`Transcription result (length: ${transcript.length}): ${transcript.substring(0, 100)}...`);

    return NextResponse.json({ transcript: transcript.trim() });

  } catch (error) {
    console.error('Error calling Google Cloud Speech-to-Text API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Provide a more generic error message to the client
    return NextResponse.json(
      { error: `Failed to transcribe audio. ${errorMessage}` },
      { status: 500 }
    );
  }
} 