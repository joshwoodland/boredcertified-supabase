'use client';

import { useState } from 'react';
import { useMicrophone } from '../../context/MicrophoneContextProvider';

export default function MicrophoneTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  
  const { 
    microphoneState, 
    startMicrophone, 
    stopMicrophone
  } = useMicrophone();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(`[MICROPHONE TEST] ${message}`);
  };

  const handleStart = () => {
    addLog('Starting recording...');
    startMicrophone();
  };

  const handleStop = () => {
    addLog('Stopping recording...');
    stopMicrophone();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Microphone Test</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleStart}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Start Recording
              </button>
              
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Stop Recording
              </button>
            </div>
            
            <button
              onClick={clearLogs}
              className="w-full px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Clear Logs
            </button>
          </div>
          
          {/* Status */}
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Current Status</h3>
            <p><strong>State:</strong> {microphoneState}</p>
          </div>
        </div>
        
        {/* Logs */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 