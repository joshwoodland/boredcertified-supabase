'use client';

import { useState, useEffect } from 'react';
import { useDeepgram, LiveConnectionState } from '../context/DeepgramContextProvider';
import { useMicrophone, MicrophoneState } from '../context/MicrophoneContextProvider';

export default function TestDeepgramPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [logs, setLogs] = useState<string[]>([]);
  
  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphoneState, errorMessage } = useMicrophone();

  const addLog = (message: string) => {
    console.log(`[TEST PAGE] ${message}`);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog('Component mounted, initializing...');
    setStatus('Setting up microphone...');
    setupMicrophone();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    addLog(`Microphone state changed: ${microphoneState}`);
    if (microphoneState === MicrophoneState.Ready) {
      setStatus('Microphone ready, connecting to Deepgram...');
      connectToDeepgram({
        model: "nova-2",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    } else if (microphoneState === MicrophoneState.Error) {
      setStatus(`Microphone error: ${errorMessage}`);
      addLog(`Microphone error: ${errorMessage}`);
    }
  }, [microphoneState, connectToDeepgram, errorMessage]);

  useEffect(() => {
    addLog(`Deepgram connection state changed: ${connectionState}`);
    if (connectionState === LiveConnectionState.OPEN) {
      setStatus('✅ Ready! Deepgram connection is open');
    } else if (connectionState === LiveConnectionState.CLOSED) {
      setStatus('❌ Deepgram connection is closed');
    }
  }, [connectionState]);

  const testApiKeyEndpoint = async () => {
    addLog('Testing API key endpoint...');
    try {
      const response = await fetch('/api/deepgram/authenticate');
      addLog(`API endpoint response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        addLog(`API key received: ${data.key ? 'Yes (length: ' + data.key.length + ')' : 'No'}`);
      } else {
        const errorText = await response.text();
        addLog(`API endpoint error: ${errorText}`);
      }
    } catch (error) {
      addLog(`API endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">
          Deepgram Test Page
        </h1>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
            {status}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Microphone</h3>
              <p className={`text-sm ${
                microphoneState === MicrophoneState.Ready ? 'text-green-600' :
                microphoneState === MicrophoneState.Error ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {microphoneState}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Deepgram</h3>
              <p className={`text-sm ${
                connectionState === LiveConnectionState.OPEN ? 'text-green-600' :
                connectionState === LiveConnectionState.CLOSED ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {connectionState}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Environment</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {typeof window !== 'undefined' && window.location.hostname}
              </p>
            </div>
          </div>
          
          <button
            onClick={testApiKeyEndpoint}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test API Key Endpoint
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-700 dark:text-gray-300 mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 