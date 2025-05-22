/**
 * @file app/api/deepgram/network-test/route.ts
 * @description Network connectivity test for Deepgram services
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing network connectivity to Deepgram
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DEEPGRAM NETWORK TEST] Starting network connectivity test...');

    const testResults: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Basic HTTP connectivity to Deepgram API
    try {
      const startTime = Date.now();
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const endTime = Date.now();

      testResults.tests.httpConnectivity = {
        success: response.ok,
        status: response.status,
        responseTime: endTime - startTime,
        headers: Object.fromEntries([...response.headers.entries()])
      };

      if (response.ok) {
        const data = await response.json();
        testResults.tests.httpConnectivity.projectsCount = data.projects?.length || 0;
      }
    } catch (error) {
      testResults.tests.httpConnectivity = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: DNS resolution for api.deepgram.com
    try {
      // This is a simple connectivity test
      const dnsStartTime = Date.now();
      const dnsResponse = await fetch('https://api.deepgram.com/favicon.ico', {
        method: 'HEAD'
      });
      const dnsEndTime = Date.now();

      testResults.tests.dnsResolution = {
        success: dnsResponse.status < 500,
        responseTime: dnsEndTime - dnsStartTime,
        status: dnsResponse.status
      };
    } catch (error) {
      testResults.tests.dnsResolution = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Get a test token for WebSocket testing
    try {
      const tokenResponse = await fetch(`${request.nextUrl.origin}/api/deepgram/token?ttl=60`, {
        method: 'GET'
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        
        testResults.tests.tokenGeneration = {
          success: true,
          tokenLength: tokenData.token?.length || 0,
          hasValidToken: !!tokenData.token
        };

        // Generate browser console test script
        if (tokenData.token) {
          const testUrl = `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(tokenData.token)}&language=en-US&model=nova-2&encoding=webm&channels=1&sample_rate=48000`;
          
          testResults.browserTest = {
            instructions: "Copy and paste this code into your browser console to test WebSocket connectivity:",
            script: `
// Deepgram WebSocket Connectivity Test
console.log('Testing WebSocket connection to Deepgram...');
const ws = new WebSocket('${testUrl}');
const timeout = setTimeout(() => {
  console.log('❌ Connection timeout after 10 seconds');
  ws.close();
}, 10000);

ws.onopen = () => {
  clearTimeout(timeout);
  console.log('✅ WebSocket connection successful!');
  setTimeout(() => ws.close(), 2000);
};

ws.onerror = (error) => {
  clearTimeout(timeout);
  console.error('❌ WebSocket error:', error);
};

ws.onclose = (event) => {
  clearTimeout(timeout);
  console.log(\`WebSocket closed: \${event.code} \${event.reason}\`);
  if (event.code === 1006) {
    console.log('❌ Error 1006: This indicates network/firewall blocking WebSocket connections');
  } else if (event.code === 1000) {
    console.log('✅ Normal closure - WebSocket test completed successfully');
  }
};`,
            note: "If this test fails with error 1006, it indicates network/firewall issues blocking WebSocket connections to Deepgram."
          };
        }
      } else {
        testResults.tests.tokenGeneration = {
          success: false,
          error: `Token generation failed with status ${tokenResponse.status}`
        };
      }
    } catch (error) {
      testResults.tests.tokenGeneration = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Analyze results and provide recommendations
    const allTestsPassed = Object.values(testResults.tests).every((test: any) => test.success);
    
    testResults.summary = {
      allTestsPassed,
      networkConnectivity: testResults.tests.httpConnectivity?.success ? 'Good' : 'Failed',
      dnsResolution: testResults.tests.dnsResolution?.success ? 'Good' : 'Failed',
      tokenGeneration: testResults.tests.tokenGeneration?.success ? 'Working' : 'Failed',
      recommendations: []
    };

    if (!testResults.tests.httpConnectivity?.success) {
      testResults.summary.recommendations.push('Check internet connectivity and firewall settings');
    }

    if (!testResults.tests.dnsResolution?.success) {
      testResults.summary.recommendations.push('DNS resolution issues - check DNS settings');
    }

    if (testResults.tests.httpConnectivity?.success && testResults.tests.tokenGeneration?.success) {
      testResults.summary.recommendations.push('HTTP connectivity is working - WebSocket issues are likely network/firewall related');
      testResults.summary.recommendations.push('Try the browser console test to confirm WebSocket blocking');
      testResults.summary.recommendations.push('Consider using HTTP streaming as a reliable alternative');
    }

    return NextResponse.json({
      success: allTestsPassed,
      message: 'Network connectivity test completed',
      results: testResults
    });

  } catch (error) {
    console.error('[DEEPGRAM NETWORK TEST] Test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Network test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 