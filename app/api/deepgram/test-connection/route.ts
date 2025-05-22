/**
 * @file app/api/deepgram/test-connection/route.ts
 * @description Test endpoint to verify Deepgram API connectivity and token generation
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for testing Deepgram connection
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DEEPGRAM TEST] Starting connection test...');

    // Get the Deepgram API key
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing DEEPGRAM_API_KEY environment variable',
          details: 'The server is not configured with a Deepgram API key'
        },
        { status: 500 }
      );
    }

    // Test 1: Get projects
    console.log('[DEEPGRAM TEST] Testing projects endpoint...');
    const projectsResponse = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to Deepgram API',
          details: `Projects endpoint returned ${projectsResponse.status}: ${errorText}`,
          step: 'projects'
        },
        { status: projectsResponse.status }
      );
    }

    const projectsData = await projectsResponse.json();
    if (!projectsData.projects || projectsData.projects.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No projects found',
          details: 'The API key does not have access to any projects',
          step: 'projects'
        },
        { status: 404 }
      );
    }

    const projectId = projectsData.projects[0].project_id;
    console.log(`[DEEPGRAM TEST] Found project: ${projectId}`);

    // Test 2: Create a temporary key
    console.log('[DEEPGRAM TEST] Testing temporary key creation...');
    const keyResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `test-key-${Date.now()}`,
        time_to_live_in_seconds: 60, // Very short-lived test key
        scopes: ['usage:write', 'usage:read'],
        comment: 'Test key to verify connectivity'
      })
    });

    if (!keyResponse.ok) {
      const errorText = await keyResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create temporary key',
          details: `Key creation returned ${keyResponse.status}: ${errorText}`,
          step: 'key_creation',
          projectId
        },
        { status: keyResponse.status }
      );
    }

    const keyData = await keyResponse.json();
    if (!keyData.key) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid key response',
          details: 'Key creation succeeded but no key was returned',
          step: 'key_validation',
          projectId
        },
        { status: 500 }
      );
    }

    console.log('[DEEPGRAM TEST] Temporary key created successfully');

    // Test 3: Test the temporary key with a simple API call
    console.log('[DEEPGRAM TEST] Testing temporary key validity...');
    const testResponse = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${keyData.key}`,
        'Content-Type': 'application/json'
      }
    });

    const keyWorksCorrectly = testResponse.ok;
    console.log(`[DEEPGRAM TEST] Temporary key test: ${keyWorksCorrectly ? 'PASSED' : 'FAILED'}`);

    // Test 4: Try to construct WebSocket URL
    const wsUrl = `wss://api.deepgram.com/v1/listen?` +
      `language=en-US&` +
      `model=nova-2&` +
      `punctuate=true&` +
      `smart_format=true&` +
      `interim_results=true&` +
      `encoding=webm&` +
      `channels=1&` +
      `sample_rate=48000&` +
      `authorization=${encodeURIComponent(`Token ${keyData.key}`)}`;

    return NextResponse.json({
      success: true,
      message: 'Deepgram connection test completed successfully',
      results: {
        apiKeyValid: true,
        projectsFound: projectsData.projects.length,
        projectId: projectId,
        temporaryKeyCreated: true,
        temporaryKeyValid: keyWorksCorrectly,
        keyLength: keyData.key.length,
        scopes: ['usage:write', 'usage:read'],
        websocketUrl: wsUrl.substring(0, 150) + '...',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[DEEPGRAM TEST] Connection test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        step: 'unknown'
      },
      { status: 500 }
    );
  }
} 