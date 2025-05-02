import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('Audio storage functionality has been disabled');
  
  // Return an empty recordings array
  return NextResponse.json({ 
    recordings: [],
    disabled: true,
    message: 'Audio recording storage has been disabled'
  });
}
