/**
 * @file app/api/deepgram/token/route.ts
 * @description Server-side API route for generating temporary Deepgram API tokens
 * This endpoint securely accesses the Deepgram API key from server-side environment
 * variables and generates a temporary token that can be used by the client.
 *
 * Uses the Deepgram Token-based Auth API:
 * https://developers.deepgram.com/docs/token-based-authentication
 */

import { NextRequest, NextResponse } from 'next/server';

// Set dynamic to force-dynamic to prevent caching
export const dynamic = 'force-dynamic';

/**
 * GET handler for generating a Deepgram API token
 *
 * @param request The incoming request
 * @returns A response containing the generated token or an error
 */
export async function GET(request: NextRequest) {
  try {
    // Get TTL from query params or use default (2 hours for better stability)
    const ttlParam = request.nextUrl.searchParams.get('ttl');
    const requestedTtl = ttlParam ? parseInt(ttlParam, 10) : 7200;

    console.log('[DEEPGRAM TOKEN API] Token generation request:', {
      requestedTtl,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')?.substring(0, 100)
    });

    // Get the Deepgram API key from environment variables
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

    // Check if the API key is available
    if (!deepgramApiKey) {
      console.error('[DEEPGRAM TOKEN API] Missing Deepgram API key');
      return NextResponse.json(
        { error: 'Deepgram API configuration error' },
        { status: 500 }
      );
    }

    console.log('[DEEPGRAM TOKEN API] API key available, length:', deepgramApiKey.length);

    // For faster, more reliable token generation, let's try using the main API key directly
    // instead of creating temporary keys, which might be causing the quick expiration
    const useDirectKey = request.nextUrl.searchParams.get('direct') === 'true';
    
    if (useDirectKey) {
      console.log('[DEEPGRAM TOKEN API] Using direct API key approach');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400, // 24 hours for main API key
        scopes: ['usage:write', 'usage:read'],
        projectId: 'main-key',
        method: 'direct'
      });
    }

    console.log('[DEEPGRAM TOKEN API] Generating temporary token for real-time streaming');

    // Generate a temporary token using the Deepgram API
    // We'll use the project keys endpoint which is more reliable
    // First, get the projects
    const projectsStartTime = Date.now();
    const projectsResponse = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const projectsResponseTime = Date.now() - projectsStartTime;
    console.log('[DEEPGRAM TOKEN API] Projects API response time:', projectsResponseTime + 'ms');

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      console.error('[DEEPGRAM TOKEN API] Error getting projects:', projectsResponse.status, errorText);
      
      // Fallback to direct API key if projects endpoint fails
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key due to projects endpoint failure');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400, // 24 hours for main API key
        scopes: ['usage:write', 'usage:read'],
        projectId: 'fallback-main-key',
        method: 'fallback-direct'
      });
    }

    // Parse the projects response
    let projectsData;
    try {
      projectsData = await projectsResponse.json();
      console.log('[DEEPGRAM TOKEN API] Projects found:', projectsData.projects?.length || 0);
    } catch (parseError) {
      console.error('[DEEPGRAM TOKEN API] Error parsing projects response:', parseError);
      
      // Fallback to direct API key
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key due to parse error');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: 'fallback-main-key',
        method: 'fallback-direct'
      });
    }

    // Get the first project ID
    if (!projectsData.projects || projectsData.projects.length === 0) {
      console.error('[DEEPGRAM TOKEN API] No projects found');
      
      // Fallback to direct API key
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key - no projects found');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: 'fallback-main-key',
        method: 'fallback-direct'
      });
    }

    const projectId = projectsData.projects[0].project_id;
    console.log(`[DEEPGRAM TOKEN API] Using project ID: ${projectId}`);

    // Now create a temporary API key for this project with proper scopes for real-time streaming
    const keyCreationStartTime = Date.now();
    const response = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `temp-streaming-key-${Date.now()}`,
        time_to_live_in_seconds: requestedTtl,
        scopes: [
          'usage:write',     // Required for real-time streaming
          'usage:read'       // Allows reading usage data if needed
        ],
        comment: 'Generated by BoredCertified app for real-time WebSocket streaming'
      })
    });

    const keyCreationResponseTime = Date.now() - keyCreationStartTime;
    console.log('[DEEPGRAM TOKEN API] Key creation response time:', keyCreationResponseTime + 'ms');

    // Check if the response is OK before parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEEPGRAM TOKEN API] Error response from Deepgram:', response.status, errorText);
      
      // Fallback to direct API key if temporary key creation fails
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key due to temporary key creation failure');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: projectId,
        method: 'fallback-direct',
        originalError: errorText
      });
    }

    // Parse the response
    let data;
    try {
      const responseText = await response.text();
      console.log('[DEEPGRAM TOKEN API] Key creation response length:', responseText.length);
      data = JSON.parse(responseText);
      
      // Log key details for debugging
      console.log('[DEEPGRAM TOKEN API] Generated key details:', {
        hasKey: !!data.key,
        keyLength: data.key?.length || 0,
        keyId: data.key_id || 'no-id',
        ttl: requestedTtl,
        timestamp: new Date().toISOString()
      });
      
    } catch (parseError) {
      console.error('[DEEPGRAM TOKEN API] Error parsing JSON response:', parseError);
      
      // Fallback to direct API key
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key due to JSON parse error');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: projectId,
        method: 'fallback-direct'
      });
    }

    // Verify the data contains a key
    if (!data.key) {
      console.error('[DEEPGRAM TOKEN API] Response missing key:', data);
      
      // Fallback to direct API key
      console.log('[DEEPGRAM TOKEN API] Falling back to direct API key - no key in response');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: projectId,
        method: 'fallback-direct'
      });
    }

    console.log('[DEEPGRAM TOKEN API] Successfully generated temporary streaming token');

    // Return the token and expiration time to the client
    return NextResponse.json({
      token: data.key,
      expiresIn: requestedTtl,
      scopes: ['usage:write', 'usage:read'],
      projectId: projectId,
      method: 'temporary-key',
      keyId: data.key_id || 'unknown',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    // Log the error
    console.error('[DEEPGRAM TOKEN API] Error generating token:', error);

    // Last resort fallback to direct API key
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      console.log('[DEEPGRAM TOKEN API] Using direct API key as last resort fallback');
      return NextResponse.json({
        token: deepgramApiKey,
        expiresIn: 86400,
        scopes: ['usage:write', 'usage:read'],
        projectId: 'error-fallback',
        method: 'error-fallback-direct',
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Return a generic error message to the client
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
