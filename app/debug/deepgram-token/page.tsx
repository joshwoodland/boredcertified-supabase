'use client';

import { useState, useEffect } from 'react';
import styles from './styles.module.css';

export default function DeepgramTokenDebugPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<string>('Not connected');
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);

  const testTokenApi = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/deepgram/token-test?t=${timestamp}`);
      const data = await response.json();

      setResult(data);

      if (data.success && data.tokenReceived) {
        // If token test was successful, get an actual token for WebSocket testing
        const tokenResponse = await fetch(`/api/deepgram/token?ttl=60&t=${timestamp}`);
        const tokenData = await tokenResponse.json();

        if (tokenData.token) {
          setToken(tokenData.token);
        } else {
          setError('Token API returned success but no token was found');
        }
      }
    } catch (err) {
      setError(`Error testing token API: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const testWebSocket = () => {
    if (!token) {
      setError('No token available. Please test the token API first.');
      return;
    }

    setWsStatus('Connecting...');
    setWsMessages([]);

    // Create a WebSocket connection to Deepgram with token in URL
    const wsUrl = `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(token)}&encoding=linear16&sample_rate=16000`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsStatus('Connected successfully');
      setWsMessages(prev => [...prev, 'WebSocket connection established']);

      // Close after 5 seconds (this is just a test)
      setTimeout(() => {
        setWsStatus('Test complete, closing connection');
        socket.close();
      }, 5000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setWsMessages(prev => [...prev, `Received: ${JSON.stringify(data).substring(0, 100)}...`]);
      } catch (err) {
        setWsMessages(prev => [...prev, `Received non-JSON message: ${event.data}`]);
      }
    };

    socket.onerror = (event) => {
      setWsStatus('Error');
      setWsMessages(prev => [...prev, `WebSocket error: ${JSON.stringify(event)}`]);
    };

    socket.onclose = (event) => {
      setWsStatus(`Closed (${event.code}: ${event.reason})`);
      setWsMessages(prev => [...prev, `WebSocket closed: ${event.code} ${event.reason}`]);
    };
  };

  return (
    <div className={styles.container}>
      <h1>Deepgram Token API Debug</h1>

      <div className={styles.section}>
        <h2>Token API Test</h2>
        <button
          onClick={testTokenApi}
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Testing...' : 'Test Token API'}
        </button>

        {error && (
          <div className={styles.error}>
            <h3>Error:</h3>
            <pre>{error}</pre>
          </div>
        )}

        {result && (
          <div className={styles.result}>
            <h3>Result:</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>

      {token && (
        <div className={styles.section}>
          <h2>WebSocket Test</h2>
          <button
            onClick={testWebSocket}
            className={styles.button}
          >
            Test WebSocket Connection
          </button>

          <div className={styles.wsStatus}>
            <h3>Status: {wsStatus}</h3>
          </div>

          {wsMessages.length > 0 && (
            <div className={styles.wsMessages}>
              <h3>Messages:</h3>
              <ul>
                {wsMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
