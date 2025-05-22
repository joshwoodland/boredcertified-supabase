'use client';

import { useState, useEffect } from 'react';
import styles from './debug.module.css';

export default function DeepgramDebugPage() {
  const [tokenResponse, setTokenResponse] = useState<any>(null);
  const [directKeyResponse, setDirectKeyResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [envVars, setEnvVars] = useState<any>(null);

  const testTokenApi = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Testing Deepgram token API...');
      const response = await fetch('/api/deepgram/token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Token API response status:', response.status);
      const data = await response.json();
      console.log('Token API response data:', data);
      
      setTokenResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        data,
      });
    } catch (err) {
      console.error('Error testing token API:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const testDirectKeyApi = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Testing direct key API...');
      const response = await fetch('/api/direct-key-test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Direct key API response status:', response.status);
      const data = await response.json();
      console.log('Direct key API response data:', data);
      
      setDirectKeyResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        data,
      });
    } catch (err) {
      console.error('Error testing direct key API:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const checkEnvVars = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Checking environment variables...');
      const response = await fetch('/api/debug-env', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Env vars API response status:', response.status);
      const data = await response.json();
      console.log('Env vars API response data:', data);
      
      setEnvVars(data);
    } catch (err) {
      console.error('Error checking env vars:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Deepgram Debug Page</h1>
      <p>Use this page to test Deepgram API functionality</p>
      
      <div className={styles.section}>
        <h2>Test Deepgram Token API</h2>
        <button 
          onClick={testTokenApi} 
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Testing...' : 'Test Token API'}
        </button>
        
        {tokenResponse && (
          <div className={styles.response}>
            <h3>Response:</h3>
            <pre>{JSON.stringify(tokenResponse, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className={styles.section}>
        <h2>Test Direct Key API</h2>
        <button 
          onClick={testDirectKeyApi} 
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Testing...' : 'Test Direct Key API'}
        </button>
        
        {directKeyResponse && (
          <div className={styles.response}>
            <h3>Response:</h3>
            <pre>{JSON.stringify(directKeyResponse, null, 2)}</pre>
          </div>
        )}
      </div>
      
      <div className={styles.section}>
        <h2>Check Environment Variables</h2>
        <button 
          onClick={checkEnvVars} 
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Checking...' : 'Check Env Vars'}
        </button>
        
        {envVars && (
          <div className={styles.response}>
            <h3>Environment Variables:</h3>
            <pre>{JSON.stringify(envVars, null, 2)}</pre>
          </div>
        )}
      </div>
      
      {error && (
        <div className={styles.error}>
          <h3>Error:</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
