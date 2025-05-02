import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // No longer saving audio files
    console.log('Audio file storage functionality has been disabled');
    
    // Create a dummy timestamp for compatibility
    const timestamp = Date.now();
    const placeholderFilename = `placeholder-${timestamp}.mp3`;
    
    // Return a success response with placeholder data
    // This allows the app flow to continue without actually storing audio
    return NextResponse.json({
      success: true,
      filePath: placeholderFilename,
      url: `/uploads/${placeholderFilename}`,
      disabled: true,
      message: 'Audio recording storage has been disabled'
    });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
