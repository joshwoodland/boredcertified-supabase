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
 * GET handler for testing token functionality
 * This endpoint tests different token approaches to identify the expiration issue
 */
export async function GET(request: NextRequest) {
  try {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    const testType = request.nextUrl.searchParams.get('type') || 'all';
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Direct API key validation
    if (testType === 'all' || testType === 'direct') {
      console.log('[TOKEN TEST] Testing direct API key...');
      try {
        const directResponse = await fetch('https://api.deepgram.com/v1/projects', {
          method: 'GET',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        results.tests.directApiKey = {
          status: directResponse.status,
          ok: directResponse.ok,
          responseTime: 'measured',
          valid: directResponse.ok
        };

        if (directResponse.ok) {
          const projectsData = await directResponse.json();
          results.tests.directApiKey.projectsCount = projectsData.projects?.length || 0;
          results.tests.directApiKey.firstProjectId = projectsData.projects?.[0]?.project_id || null;
        }
      } catch (error) {
        results.tests.directApiKey = {
          error: error instanceof Error ? error.message : 'Unknown error',
          valid: false
        };
      }
    }

    // Test 2: Generate temporary token and immediately test it
    if (testType === 'all' || testType === 'temporary') {
      console.log('[TOKEN TEST] Testing temporary token generation and immediate validation...');
      try {
        // Get projects first
        const projectsResponse = await fetch('https://api.deepgram.com/v1/projects', {
          method: 'GET',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const projectId = projectsData.projects[0]?.project_id;

          if (projectId) {
            // Create temporary token with short TTL for testing
            const tempKeyResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
              method: 'POST',
              headers: {
                'Authorization': `Token ${deepgramApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: `test-token-${Date.now()}`,
                time_to_live_in_seconds: 300, // 5 minutes
                scopes: ['usage:write', 'usage:read'],
                comment: 'Test token for debugging expiration issues'
              })
            });

            if (tempKeyResponse.ok) {
              const tempKeyData = await tempKeyResponse.json();
              const tempToken = tempKeyData.key;
              const createdAt = new Date().toISOString();

              // Immediately test the temporary token
              const testResponse = await fetch('https://api.deepgram.com/v1/projects', {
                method: 'GET',
                headers: {
                  'Authorization': `Token ${tempToken}`,
                  'Content-Type': 'application/json'
                }
              });

              results.tests.temporaryToken = {
                created: true,
                createdAt,
                tokenLength: tempToken.length,
                keyId: tempKeyData.key_id,
                ttl: 300,
                immediateTest: {
                  status: testResponse.status,
                  ok: testResponse.ok,
                  testedAt: new Date().toISOString()
                }
              };

              // Wait 2 seconds and test again
              await new Promise(resolve => setTimeout(resolve, 2000));
              const delayedTestResponse = await fetch('https://api.deepgram.com/v1/projects', {
                method: 'GET',
                headers: {
                  'Authorization': `Token ${tempToken}`,
                  'Content-Type': 'application/json'
                }
              });

              results.tests.temporaryToken.delayedTest = {
                status: delayedTestResponse.status,
                ok: delayedTestResponse.ok,
                testedAt: new Date().toISOString(),
                delayMs: 2000
              };

              // Clean up - delete the test token
              try {
                await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys/${tempKeyData.key_id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Token ${deepgramApiKey}`,
                  }
                });
                results.tests.temporaryToken.cleanedUp = true;
              } catch (cleanupError) {
                results.tests.temporaryToken.cleanupError = cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error';
              }

            } else {
              const errorText = await tempKeyResponse.text();
              results.tests.temporaryToken = {
                created: false,
                error: `Failed to create temporary token: ${tempKeyResponse.status}`,
                errorText
              };
            }
          } else {
            results.tests.temporaryToken = {
              created: false,
              error: 'No project ID available'
            };
          }
        } else {
          results.tests.temporaryToken = {
            created: false,
            error: 'Failed to get projects for temporary token test'
          };
        }
      } catch (error) {
        results.tests.temporaryToken = {
          created: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test 3: Check existing temporary keys count
    if (testType === 'all' || testType === 'keys') {
      console.log('[TOKEN TEST] Checking existing temporary keys...');
      try {
        const projectsResponse = await fetch('https://api.deepgram.com/v1/projects', {
          method: 'GET',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const projectId = projectsData.projects[0]?.project_id;

          if (projectId) {
            const keysResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
              method: 'GET',
              headers: {
                'Authorization': `Token ${deepgramApiKey}`,
                'Content-Type': 'application/json'
              }
            });

            if (keysResponse.ok) {
              const keysData = await keysResponse.json();
              results.tests.existingKeys = {
                total: keysData.api_keys?.length || 0,
                temporaryKeys: keysData.api_keys?.filter((key: any) => key.name?.includes('temp')).length || 0,
                keys: keysData.api_keys?.map((key: any) => ({
                  id: key.key_id,
                  name: key.name,
                  scopes: key.scopes,
                  created: key.date_created
                })) || []
              };
            } else {
              results.tests.existingKeys = {
                error: `Failed to get keys: ${keysResponse.status}`
              };
            }
          }
        }
      } catch (error) {
        results.tests.existingKeys = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('[TOKEN TEST] Error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
