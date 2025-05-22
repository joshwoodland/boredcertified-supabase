/**
 * @file app/api/deepgram/token-test/route.ts
 * @description Diagnostic endpoint to test the Deepgram token API
 * This endpoint tests if the token API is working correctly by making a request
 * to the token API and returning the result.
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing the Deepgram token API
 * 
 * @param request The incoming request
 * @returns A response containing the test results
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[TOKEN TEST API] Testing Deepgram token API');
    
    // Get a token from our secure token API
    const timestamp = new Date().getTime();
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/deepgram/token?ttl=60&t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    console.log(`[TOKEN TEST API] Token API response status: ${tokenResponse.status}`);
    
    // Parse the token response
    let tokenData;
    try {
      tokenData = await tokenResponse.json();
      console.log('[TOKEN TEST API] Token API response structure:', Object.keys(tokenData));
    } catch (parseError) {
      console.error('[TOKEN TEST API] Failed to parse token response as JSON:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse token response',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          responseStatus: tokenResponse.status,
          responseText: await tokenResponse.text().catch(() => 'Unable to get response text'),
        },
        { status: 500 }
      );
    }
    
    // Check if the token request was successful
    if (!tokenResponse.ok) {
      console.error('[TOKEN TEST API] Token API returned an error:', tokenData);
      return NextResponse.json(
        {
          success: false,
          error: 'Token API returned an error',
          details: tokenData.error || tokenData.details || `Status code: ${tokenResponse.status}`,
          responseStatus: tokenResponse.status,
          responseData: tokenData,
        },
        { status: tokenResponse.status }
      );
    }
    
    // Verify we received a valid token
    if (!tokenData.token) {
      console.error('[TOKEN TEST API] Invalid token received:', tokenData);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token received',
          details: 'The token API returned a response without a token',
          responseData: tokenData,
        },
        { status: 500 }
      );
    }
    
    // Return success with token information (but not the actual token for security)
    return NextResponse.json({
      success: true,
      message: 'Successfully obtained Deepgram token',
      tokenReceived: true,
      tokenLength: tokenData.token.length,
      tokenPrefix: tokenData.token.substring(0, 5) + '...',
      expiresIn: tokenData.expiresIn,
    });
  } catch (error) {
    console.error('[TOKEN TEST API] Error testing token API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error testing token API',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
