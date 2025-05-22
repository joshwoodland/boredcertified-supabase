import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/app/utils/serverConfig';

/**
 * Test endpoint to verify the Deepgram API key
 * This is for troubleshooting only and should be removed in production
 */
export async function GET(request: NextRequest) {
  try {
    // Get the Deepgram API key from environment variables or server runtime config
    const serverConfig = getServerConfig();
    const apiKey = process.env.DEEPGRAM_API_KEY || serverConfig.DEEPGRAM_API_KEY;

    // Check if the API key is set
    if (!apiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Deepgram API key is not set in environment variables or server config',
        keyExists: false,
        serverConfigAvailable: !!serverConfig,
      });
    }

    // Test the API key by making a simple request to Deepgram API
    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      return NextResponse.json({
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        keyExists: true,
        keyWorks: response.ok,
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 5) + '...',
        response: response.ok ? {
          // Only include minimal info for security
          projects_count: Array.isArray(data.projects) ? data.projects.length : 'unknown',
          has_data: !!data,
        } : {
          error: data.error || 'Unknown error',
        },
      });
    } catch (apiError) {
      // API request failed
      return NextResponse.json({
        status: 'error',
        message: 'Failed to validate Deepgram API key',
        keyExists: true,
        keyWorks: false,
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error in test-deepgram-key endpoint:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to test Deepgram API key',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
