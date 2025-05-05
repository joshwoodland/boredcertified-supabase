import { NextRequest, NextResponse } from 'next/server'

// Simplified handler with a clearer signature
export const dynamic = 'force-dynamic'; // Disable caching for this route

export async function GET(
  request: NextRequest
) {
  console.log('Audio file storage functionality has been disabled');

  // Always return a "file not found" response since audio storage is disabled
  return NextResponse.json({
    error: 'Audio storage functionality has been disabled',
    disabled: true,
    message: 'Audio recording storage has been disabled'
  }, { status: 404 });
}