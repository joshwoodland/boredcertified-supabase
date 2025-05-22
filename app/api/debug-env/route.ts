import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/app/utils/serverConfig';

/**
 * Debug endpoint to check environment variables
 * This is for troubleshooting only and should be removed in production
 */
export async function GET(request: NextRequest) {
  try {
    // Get server runtime config
    const serverConfig = getServerConfig();

    // Check if the Deepgram API key is set in process.env
    const deepgramKeyAvailable = !!process.env.DEEPGRAM_API_KEY;
    const deepgramKeyLength = deepgramKeyAvailable ? process.env.DEEPGRAM_API_KEY!.length : 0;

    // Check if the Deepgram API key is set in serverRuntimeConfig
    const serverConfigKeyAvailable = !!serverConfig?.DEEPGRAM_API_KEY;
    const serverConfigKeyLength = serverConfigKeyAvailable ? serverConfig.DEEPGRAM_API_KEY.length : 0;

    // Get all environment variable names (without values for security)
    const envVarNames = Object.keys(process.env).sort();

    // Return environment information
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      deepgramKeyAvailable,
      deepgramKeyLength,
      serverConfigAvailable: !!serverConfig,
      serverConfigKeyAvailable,
      serverConfigKeyLength,
      environmentVariables: envVarNames,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in debug-env endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to get environment information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
