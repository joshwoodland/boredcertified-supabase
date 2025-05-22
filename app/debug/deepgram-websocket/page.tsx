'use client';

import { useState } from 'react';

export default function DeepgramWebSocketDebugPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<string>('Not connected');
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setConnectionLog(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[DEEPGRAM DEBUG] ${message}`);
  };

  const testTokenGeneration = async () => {
    setLoading(true);
    setError(null);
    setToken(null);
    setConnectionLog([]);

    try {
      addLog('Starting token generation test...');
      
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/deepgram/token?ttl=300&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      addLog(`Token API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        addLog(`Token API error: ${JSON.stringify(errorData)}`);
        throw new Error(`Token API failed: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      addLog(`Token response keys: ${Object.keys(tokenData).join(', ')}`);

      if (!tokenData.token) {
        throw new Error('No token in response');
      }

      setToken(tokenData.token);
      addLog('Token generation successful');
      addLog(`Token length: ${tokenData.token.length}`);
      addLog(`Token expires in: ${tokenData.expiresIn} seconds`);
      addLog(`Project ID: ${tokenData.projectId || 'not provided'}`);
      addLog(`Scopes: ${tokenData.scopes ? tokenData.scopes.join(', ') : 'not provided'}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      addLog(`Token generation failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const testWebSocketConnection = () => {
    if (!token) {
      setError('No token available. Please generate a token first.');
      return;
    }

    // Close existing connection if any
    if (socket) {
      socket.close();
      setSocket(null);
    }

    setError(null);
    setWsStatus('Connecting...');
    setWsMessages([]);

    try {
      addLog('Creating WebSocket connection with improved error handling...');

      // Create WebSocket URL with token embedded in URL (correct method)
      const wsUrl = `wss://api.deepgram.com/v1/listen?` +
        `token=${encodeURIComponent(token)}&` +
        `language=en-US&` +
        `model=nova-2&` +
        `punctuate=true&` +
        `smart_format=true&` +
        `interim_results=true&` +
        `encoding=webm&` +
        `channels=1&` +
        `sample_rate=48000`;

      addLog(`WebSocket URL: ${wsUrl.substring(0, 100)}...`);

      const newSocket = new WebSocket(wsUrl);
      setSocket(newSocket);

      // Set reduced connection timeout for faster fallback
      const connectionTimeout = setTimeout(() => {
        addLog('Connection timeout after 5 seconds (reduced for faster fallback)');
        setWsStatus('Connection timeout');
        if (newSocket.readyState === WebSocket.CONNECTING) {
          newSocket.close();
        }
      }, 5000); // Reduced from 10 to 5 seconds

      newSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        setWsStatus('Connected');
        addLog('WebSocket connection established successfully');
        setWsMessages(prev => [...prev, 'Connection opened']);

        // Send a test message to verify the connection
        addLog('Sending connection verification message...');
        
        // Close after successful test
        setTimeout(() => {
          addLog('Test complete, closing connection...');
          setWsStatus('Test complete, closing connection');
          newSocket.close(1000, 'Test completed successfully');
        }, 3000);
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Received message type: ${data.type}`);
          setWsMessages(prev => [...prev, `${data.type}: ${JSON.stringify(data).substring(0, 200)}...`]);
        } catch (err) {
          addLog(`Received non-JSON message: ${event.data}`);
          setWsMessages(prev => [...prev, `Raw: ${event.data}`]);
        }
      };

      newSocket.onerror = (event) => {
        clearTimeout(connectionTimeout);
        addLog(`WebSocket error occurred - improved error handling`);
        addLog(`Error event: ${JSON.stringify(event)}`);
        setWsStatus('Error (improved detection)');
        setWsMessages(prev => [...prev, `Error: ${JSON.stringify(event)}`]);
      };

      newSocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        addLog(`WebSocket closed with code ${event.code}: ${event.reason}`);
        setWsStatus(`Closed (${event.code}: ${event.reason || 'No reason provided'})`);
        setWsMessages(prev => [...prev, `Closed: ${event.code} ${event.reason}`]);

        // Provide specific error code explanations with improved messaging
        if (event.code === 1006) {
          addLog('Code 1006: Abnormal closure - improved detection suggests:');
          addLog('- Authentication method incorrect (should use token in URL for browsers)');
          addLog('- Network connectivity issues');
          addLog('- Firewall blocking WebSocket connections');
          addLog('- Server-side token validation failure');
          addLog('Fallback to HTTP service would now be attempted automatically');
        } else if (event.code === 1011) {
          addLog('Code 1011: Server error - the server encountered an unexpected condition');
        } else if (event.code === 4001) {
          addLog('Code 4001: Authentication error - invalid or expired token');
        } else if (event.code === 1000) {
          addLog('Code 1000: Normal closure - connection closed successfully');
        }

        setSocket(null);
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Failed to create WebSocket: ${errorMessage}`);
      setError(errorMessage);
      setWsStatus('Failed to create connection');
    }
  };

  const testAlternativeConnection = () => {
    if (!token) {
      setError('No token available. Please generate a token first.');
      return;
    }

    addLog('Testing alternative connection method...');

    // Test using Authorization header approach (though this might not work for WebSocket)
    const wsUrl = `wss://api.deepgram.com/v1/listen?` +
      `language=en-US&` +
      `model=nova-2&` +
      `punctuate=true&` +
      `smart_format=true&` +
      `interim_results=true&` +
      `encoding=webm&` +
      `channels=1&` +
      `sample_rate=48000`;

    addLog(`Alternative URL (without token in query): ${wsUrl}`);
    addLog('Note: This approach may not work as WebSocket headers cannot be set in browser');

    // Just log the attempt for debugging
    addLog('This test demonstrates why token-in-URL is necessary for browser WebSocket connections');
  };

  const clearLogs = () => {
    setConnectionLog([]);
    setWsMessages([]);
    setError(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Deepgram WebSocket Connection Debug</h1>

      <div className="space-y-6">
        {/* Token Generation Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Step 1: Token Generation</h2>
          <button
            onClick={testTokenGeneration}
            disabled={loading}
            className={`px-4 py-2 rounded font-medium ${
              loading
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? 'Generating Token...' : 'Generate Test Token'}
          </button>

          {token && (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                ✅ Token generated successfully
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Token length: {token.length} characters
              </p>
            </div>
          )}
        </div>

        {/* WebSocket Connection Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Step 2: WebSocket Connection Test</h2>
          <div className="space-x-4">
            <button
              onClick={testWebSocketConnection}
              disabled={!token || wsStatus === 'Connecting...'}
              className={`px-4 py-2 rounded font-medium ${
                !token || wsStatus === 'Connecting...'
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              Test WebSocket Connection
            </button>

            <button
              onClick={testAlternativeConnection}
              disabled={!token}
              className={`px-4 py-2 rounded font-medium ${
                !token
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              Test Alternative Method
            </button>

            <button
              onClick={clearLogs}
              className="px-4 py-2 rounded font-medium bg-gray-500 hover:bg-gray-600 text-white"
            >
              Clear Logs
            </button>
          </div>

          <div className="mt-4">
            <p className="font-medium">Status: <span className={`${
              wsStatus.includes('Connected') ? 'text-green-600' : 
              wsStatus.includes('Error') || wsStatus.includes('Failed') ? 'text-red-600' : 
              'text-yellow-600'
            }`}>{wsStatus}</span></p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">Error:</h3>
            <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Connection Log */}
        {connectionLog.length > 0 && (
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="font-medium mb-2">Connection Log:</h3>
            <div className="max-h-64 overflow-y-auto">
              {connectionLog.map((log, i) => (
                <div key={i} className="text-sm font-mono text-gray-700 dark:text-gray-300 py-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WebSocket Messages */}
        {wsMessages.length > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium mb-2">WebSocket Messages:</h3>
            <div className="max-h-64 overflow-y-auto">
              {wsMessages.map((msg, i) => (
                <div key={i} className="text-sm font-mono text-blue-700 dark:text-blue-300 py-1">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Troubleshooting Guide */}
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">Troubleshooting Guide:</h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
            <li><strong>Error 1006:</strong> Usually indicates network issues, CORS problems, or server rejection. This is common on Vercel due to edge runtime limitations.</li>
            <li><strong>Error 4001:</strong> Authentication error. Check that the token is valid and has proper scopes.</li>
            <li><strong>Connection timeout:</strong> Network restrictions or firewall blocking WebSocket connections.</li>
            <li><strong>Immediate closure:</strong> Often caused by incorrect URL format or missing required parameters.</li>
          </ul>
          
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              💡 For Vercel deployments, consider using Deepgram's HTTP streaming API as an alternative to WebSocket connections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 