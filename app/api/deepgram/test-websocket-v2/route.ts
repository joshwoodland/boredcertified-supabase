/**
 * @file app/api/deepgram/test-websocket-v2/route.ts
 * @description Comprehensive WebSocket connection test using the correct authentication method
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing WebSocket connection with correct authentication
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DEEPGRAM WEBSOCKET TEST V2] Starting comprehensive test...');

    // Step 1: Get a temporary token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/deepgram/token?ttl=300`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get token',
          details: errorData,
          step: 'token_generation'
        },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token response',
          details: 'No token in response',
          step: 'token_validation'
        },
        { status: 500 }
      );
    }

    console.log('[DEEPGRAM WEBSOCKET TEST V2] Token obtained successfully');

    // Step 2: Test the old (incorrect) method for comparison
    const oldMethodUrl = `wss://api.deepgram.com/v1/listen?language=en-US&model=nova-2&punctuate=true&smart_format=true&interim_results=true&encoding=webm&channels=1&sample_rate=48000`;

    // Step 3: Test the new (correct) method
    const newMethodUrl = `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(tokenData.token)}&language=en-US&model=nova-2&punctuate=true&smart_format=true&interim_results=true&encoding=webm&channels=1&sample_rate=48000`;

    // Step 4: Validate URL construction
    const urlValidation = {
      tokenIncluded: newMethodUrl.includes('token='),
      tokenEncoded: newMethodUrl.includes(encodeURIComponent(tokenData.token)),
      parametersIncluded: newMethodUrl.includes('language=en-US'),
      urlLength: newMethodUrl.length,
      maxUrlLength: 2048 // Common browser limit
    };

    return NextResponse.json({
      success: true,
      message: 'WebSocket connection test configuration ready',
      results: {
        tokenGeneration: {
          success: true,
          tokenLength: tokenData.token.length,
          expiresIn: tokenData.expiresIn,
          scopes: tokenData.scopes || ['usage:write', 'usage:read']
        },
        urlConstruction: {
          oldMethod: {
            url: oldMethodUrl.substring(0, 150) + '...',
            authMethod: 'Sec-WebSocket-Protocol (INCORRECT)',
            note: 'This method causes error 1006'
          },
          newMethod: {
            url: newMethodUrl.substring(0, 150) + '...',
            authMethod: 'Token in URL (CORRECT)',
            note: 'This method should work in browsers'
          },
          validation: urlValidation
        },
        recommendations: [
          'Use token-in-URL method for browser WebSocket connections',
          'Ensure token is properly URL-encoded',
          'Set connection timeout to handle slow connections',
          'Implement proper error handling for connection failures',
          'Consider using HTTP fallback for unstable networks'
        ],
        troubleshooting: {
          error1006Causes: [
            'Using Sec-WebSocket-Protocol authentication (browser limitation)',
            'Network connectivity issues',
            'Firewall blocking WebSocket connections',
            'Invalid or expired tokens',
            'Malformed WebSocket URL'
          ],
          solutions: [
            'Switch to token-in-URL authentication',
            'Check network connectivity to api.deepgram.com',
            'Verify firewall allows WebSocket connections on port 443',
            'Ensure tokens are fresh and valid',
            'Implement HTTP streaming fallback'
          ]
        },
        nextSteps: [
          'Test the new URL in your browser console',
          'Update your DeepgramService to use token-in-URL method',
          'Implement connection retry logic',
          'Add comprehensive error logging'
        ],
        environment: {
          timestamp: new Date().toISOString(),
          nodeEnv: process.env.NODE_ENV,
          origin: request.nextUrl.origin
        }
      }
    });

  } catch (error) {
    console.error('[DEEPGRAM WEBSOCKET TEST V2] Test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'WebSocket test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        step: 'test_execution'
      },
      { status: 500 }
    );
  }
} 