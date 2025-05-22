'use client';

import { useState, useEffect } from 'react';

/**
 * Test component to diagnose Deepgram connection issues
 */
export default function DeepgramTest() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [connectionTest, setConnectionTest] = useState<any>(null);
  const [apiKeyTest, setApiKeyTest] = useState<any>(null);
  const [directTest, setDirectTest] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiKeyTestStatus, setApiKeyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [directTestStatus, setDirectTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Fetch environment information
  useEffect(() => {
    async function fetchEnvInfo() {
      try {
        const response = await fetch('/api/debug-env');
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        const data = await response.json();
        setEnvInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch environment info');
      } finally {
        setLoading(false);
      }
    }

    fetchEnvInfo();
  }, []);

  // Test Deepgram connection
  const testDeepgramConnection = async () => {
    setTestStatus('testing');
    try {
      console.log('Testing Deepgram connection...');
      const response = await fetch('/api/deepgram/websocket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          language: 'en-US',
          model: 'nova-2',
          punctuate: true,
        }),
      });

      const data = await response.json();
      console.log('Deepgram test response:', data);

      setConnectionTest({
        status: response.status,
        ok: response.ok,
        data,
      });

      setTestStatus(response.ok ? 'success' : 'error');
    } catch (err) {
      console.error('Error testing Deepgram connection:', err);
      setConnectionTest({
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setTestStatus('error');
    }
  };

  // Test Deepgram API key directly
  const testDeepgramApiKey = async () => {
    setApiKeyTestStatus('testing');
    try {
      console.log('Testing Deepgram API key...');
      const response = await fetch('/api/test-deepgram-key');

      const data = await response.json();
      console.log('Deepgram API key test response:', data);

      setApiKeyTest(data);
      setApiKeyTestStatus(data.keyWorks ? 'success' : 'error');
    } catch (err) {
      console.error('Error testing Deepgram API key:', err);
      setApiKeyTest({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      setApiKeyTestStatus('error');
    }
  };

  // Run direct environment test
  const runDirectTest = async () => {
    setDirectTestStatus('testing');
    try {
      console.log('Running direct environment test...');
      const response = await fetch('/api/deepgram-direct-test');

      const data = await response.json();
      console.log('Direct test response:', data);

      setDirectTest(data);
      setDirectTestStatus(data.hasDeepgramKey ? 'success' : 'error');
    } catch (err) {
      console.error('Error running direct test:', err);
      setDirectTest({
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setDirectTestStatus('error');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Deepgram Connection Diagnostics</h1>

      {loading ? (
        <div className="animate-pulse flex space-x-4 mb-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Environment Information</h2>
          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
            <pre className="text-sm">{JSON.stringify(envInfo, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Direct Environment Test (Recommended First)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          This test directly checks if the DEEPGRAM_API_KEY environment variable is available to the server.
        </p>
        <button
          onClick={runDirectTest}
          disabled={directTestStatus === 'testing'}
          className={`px-4 py-2 rounded font-medium ${
            directTestStatus === 'testing'
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {directTestStatus === 'testing' ? 'Testing...' : 'Run Direct Test'}
        </button>

        {directTest && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Direct Test Results:</h3>
            <div className={`p-4 rounded-md overflow-x-auto ${
              directTestStatus === 'success'
                ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <pre className="text-sm">{JSON.stringify(directTest, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Test Deepgram API Key</h2>
        <button
          onClick={testDeepgramApiKey}
          disabled={apiKeyTestStatus === 'testing'}
          className={`px-4 py-2 rounded font-medium ${
            apiKeyTestStatus === 'testing'
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {apiKeyTestStatus === 'testing' ? 'Testing...' : 'Test API Key'}
        </button>

        {apiKeyTest && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">API Key Test Results:</h3>
            <div className={`p-4 rounded-md overflow-x-auto ${
              apiKeyTestStatus === 'success'
                ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <pre className="text-sm">{JSON.stringify(apiKeyTest, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Test Deepgram WebSocket Connection</h2>
        <button
          onClick={testDeepgramConnection}
          disabled={testStatus === 'testing'}
          className={`px-4 py-2 rounded font-medium ${
            testStatus === 'testing'
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {testStatus === 'testing' ? 'Testing...' : 'Test WebSocket Connection'}
        </button>

        {connectionTest && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">WebSocket Test Results:</h3>
            <div className={`p-4 rounded-md overflow-x-auto ${
              testStatus === 'success'
                ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <pre className="text-sm">{JSON.stringify(connectionTest, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded">
        <p className="font-medium">Troubleshooting Tips:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Check if the DEEPGRAM_API_KEY environment variable is set in Vercel</li>
          <li>Try adding the API key directly to the Vercel project settings (not using a .env file)</li>
          <li>Make sure the API key is set as a plain string without quotes</li>
          <li>Try redeploying the application after setting the environment variable</li>
          <li>Check if the API key has the necessary permissions (Speech, Admin)</li>
          <li>Verify that the API key has not expired</li>
          <li>Check if there are any network restrictions preventing access to Deepgram</li>
        </ul>
      </div>
    </div>
  );
}
