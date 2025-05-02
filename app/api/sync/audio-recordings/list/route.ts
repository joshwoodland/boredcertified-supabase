import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Audio storage functionality has been disabled');
    
    // Return an empty recordings array
    return NextResponse.json({ 
      recordings: [],
      disabled: true,
      message: 'Audio recording storage has been disabled'
    });
  } catch (error) {
    console.error('Error in audio recordings sync API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', disabled: true },
      { status: 500 }
    );
  }
}
