import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Create a temporary directory if it doesn't exist
    const tempDir = join(process.cwd(), 'tmp');
    try {
      await import('fs/promises').then(fs => fs.mkdir(tempDir, { recursive: true }));
    } catch (err) {
      console.error('Error creating temp directory:', err);
    }

    // Create a temporary file
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = join(tempDir, `${Date.now()}-${audioFile.name}`);
    
    console.log('Writing audio file to:', tempFilePath);
    await writeFile(tempFilePath, buffer);

    console.log('Starting transcription...');
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: await import('fs').then(fs => fs.createReadStream(tempFilePath)),
      model: 'whisper-1',
      language: 'en',
      response_format: 'json',
    });

    console.log('Transcription completed');

    // Clean up the temporary file
    try {
      await import('fs/promises').then(fs => fs.unlink(tempFilePath));
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }

    return NextResponse.json({ transcript: transcription.text });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 