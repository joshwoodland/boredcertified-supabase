import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple HTML debug page served directly from an API route
 * This bypasses any routing issues that might be occurring with the regular pages
 */
export async function GET(request: NextRequest) {
  // Log that this endpoint was called
  console.log('DEBUG-PAGE ENDPOINT CALLED');
  
  try {
    // Check for Deepgram API key
    const hasDeepgramKey = 'DEEPGRAM_API_KEY' in process.env;
    const deepgramKeyValue = process.env.DEEPGRAM_API_KEY || '';
    const keyLength = deepgramKeyValue.length;
    
    // Get all environment variables (names only)
    const allEnvVars = Object.keys(process.env).sort();
    
    // Log the results
    console.log(`DEBUG-PAGE: Has DEEPGRAM_API_KEY: ${hasDeepgramKey}`);
    console.log(`DEBUG-PAGE: Key length: ${keyLength}`);
    console.log(`DEBUG-PAGE: Total env vars: ${allEnvVars.length}`);
    
    // Create a simple HTML page with the debug information
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Deepgram Debug Page</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            h1 { color: #2563eb; }
            h2 { color: #4b5563; margin-top: 30px; }
            pre {
              background-color: #fff;
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
              border: 1px solid #e5e7eb;
            }
            .card {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
            }
            .success { color: #059669; }
            .error { color: #dc2626; }
            button {
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 10px 15px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
              margin-top: 10px;
            }
            button:hover {
              background-color: #1d4ed8;
            }
          </style>
        </head>
        <body>
          <h1>Deepgram API Debug Page</h1>
          <p>This page provides direct information about the Deepgram API key configuration.</p>
          
          <div class="card">
            <h2>Environment Information</h2>
            <p><strong>Server Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Node Environment:</strong> ${process.env.NODE_ENV || 'Not set'}</p>
            <p><strong>Running on Vercel:</strong> ${process.env.VERCEL === '1' ? 'Yes' : 'No'}</p>
          </div>
          
          <div class="card">
            <h2>Deepgram API Key Status</h2>
            <p><strong>API Key Available:</strong> <span class="${hasDeepgramKey ? 'success' : 'error'}">${hasDeepgramKey ? 'Yes' : 'No'}</span></p>
            <p><strong>API Key Length:</strong> ${keyLength} characters</p>
          </div>
          
          <div class="card">
            <h2>Environment Variables</h2>
            <p><strong>Total Variables:</strong> ${allEnvVars.length}</p>
            <p><strong>First 10 Variable Names:</strong></p>
            <pre>${JSON.stringify(allEnvVars.slice(0, 10), null, 2)}</pre>
          </div>
          
          <div class="card">
            <h2>Test API Endpoints</h2>
            <p>Click the buttons below to test the API endpoints directly:</p>
            
            <button onclick="testEndpoint('/api/env-test')">Test Basic Env</button>
            <button onclick="testEndpoint('/api/deepgram-direct-test')">Test Direct</button>
            <button onclick="testEndpoint('/api/test-deepgram-key')">Test API Key</button>
            <button onclick="testEndpoint('/api/deepgram/websocket', true)">Test WebSocket</button>
            
            <div id="result" style="margin-top: 20px;"></div>
          </div>
          
          <div class="card">
            <h2>Troubleshooting Tips</h2>
            <ul>
              <li>Check if the DEEPGRAM_API_KEY environment variable is set in Vercel</li>
              <li>Try adding the API key directly to the Vercel project settings (not using a .env file)</li>
              <li>Make sure the API key is set as a plain string without quotes</li>
              <li>Try redeploying the application after setting the environment variable</li>
              <li>Check if the API key has the necessary permissions (Speech, Admin)</li>
              <li>Verify that the API key has not expired</li>
            </ul>
          </div>
          
          <script>
            async function testEndpoint(url, isPost = false) {
              const resultDiv = document.getElementById('result');
              resultDiv.innerHTML = '<p>Testing ' + url + '...</p>';
              
              try {
                const response = await fetch(url, {
                  method: isPost ? 'POST' : 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: isPost ? JSON.stringify({
                    language: 'en-US',
                    model: 'nova-2',
                    punctuate: true,
                  }) : undefined
                });
                
                const data = await response.json();
                resultDiv.innerHTML = '<h3>Result from ' + url + ':</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
              } catch (error) {
                resultDiv.innerHTML = '<h3 class="error">Error testing ' + url + ':</h3><pre>' + error.message + '</pre>';
              }
            }
          </script>
        </body>
      </html>
    `;
    
    // Return the HTML page
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('DEBUG-PAGE ERROR:', error);
    return NextResponse.json({
      error: 'Debug page failed to load',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
