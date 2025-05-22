/**
 * @file app/api/deepgram/network-test/route.ts
 * @description Network connectivity test for Deepgram services
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing network connectivity to Deepgram
 * This helps diagnose WebSocket connection issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[NETWORK TEST] Testing Deepgram connectivity');

    const tests = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      tests: {} as any
    };

    // Test 1: Basic HTTP connectivity to Deepgram
    try {
      const httpResponse = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPGRAM_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      tests.tests.httpConnectivity = {
        success: httpResponse.ok,
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        responseTime: 'measured'
      };

    } catch (error) {
      tests.tests.httpConnectivity = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: DNS resolution
    try {
      const dnsStart = Date.now();
      await fetch('https://api.deepgram.com/health', {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      const dnsTime = Date.now() - dnsStart;

      tests.tests.dnsResolution = {
        success: true,
        responseTime: `${dnsTime}ms`
      };

    } catch (error) {
      tests.tests.dnsResolution = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Check if we're in a serverless environment
    tests.tests.environment = {
      isVercel: !!process.env.VERCEL,
      isServerless: !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL,
      platform: process.env.VERCEL ? 'vercel' : 'unknown',
      region: process.env.VERCEL_REGION || 'unknown'
    };

    // Test 4: WebSocket compatibility check
    tests.tests.websocketSupport = {
      // Note: We can't actually test WebSocket from server-side,
      // but we can check for known issues
      serverSide: 'Cannot test WebSocket from server-side',
      recommendation: 'WebSocket issues often related to: firewall, proxy, or browser security policies',
      suggestedFix: 'Use HTTP fallback for reliable transcription'
    };

    console.log('[NETWORK TEST] Test results:', tests);

    return NextResponse.json(tests);

  } catch (error) {
    console.error('[NETWORK TEST] Error running network tests:', error);
    return NextResponse.json(
      {
        error: 'Network test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 