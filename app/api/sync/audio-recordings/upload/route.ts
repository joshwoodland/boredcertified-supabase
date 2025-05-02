import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Audio storage functionality has been disabled');
  
  return NextResponse.json({ 
    error: 'Audio storage functionality has been disabled',
    disabled: true,
    message: 'Audio recording storage has been disabled'
  }, { status: 400 });
}
