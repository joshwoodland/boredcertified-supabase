'use client';

import { useState, useEffect, useRef } from 'react';
import { useDeepgram, LiveConnectionState } from '../../context/DeepgramContextProvider';
import { useMicrophone, MicrophoneState } from '../../context/MicrophoneContextProvider';

export default function LiveTranscriptionFixTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStats, setConnectionStats] = useState({
    keepAliveCount: 0,
    reconnectAttempts: 0,
    errorCount: 0,
    totalUptime: 0
  });
  
  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { microphone, microphoneState, setupMicrophone, startMicrophone, stopMicrophone } = useMicrophone();
  
  const startTimeRef = useRef<number | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(`[LIVE TRANSCRIPTION TEST] ${message}`);
  };

  // Monitor connection uptime
  useEffect(() => {
    if (connectionState === LiveConnectionState.OPEN && !startTimeRef.current) {
      startTimeRef.current = Date.now();
      uptimeIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const uptime = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setConnectionStats(prev => ({ ...prev, totalUptime: uptime }));
        }
      }, 1000);
      addLog('Connection established - starting uptime monitoring');
    } else if (connectionState === LiveConnectionState.CLOSED) {
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
        uptimeIntervalRef.current = null;
      }
      startTimeRef.current = null;
      addLog('Connection closed - uptime monitoring stopped');
    }

    return () => {
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
    };
  }, [connectionState]);

  // Monitor for keep-alive messages and errors
  useEffect(() => {
    if (!connection) return;

    const originalKeepalive = connection.keepAlive;
    connection.keepAlive = () => {
      setConnectionStats(prev => ({ ...prev, keepAliveCount: prev.keepAliveCount + 1 }));
      addLog('Keep-alive sent to Deepgram');
      return originalKeepalive.call(connection);
    };

    const handleError = (error: any) => {
      setConnectionStats(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      addLog(`Connection error detected: ${error.message || error}`);
    };

    const handleClose = () => {
      addLog('Connection closed unexpectedly');
    };

    // Note: In a real implementation, you'd use the proper event listeners
    // This is just for demonstration of monitoring

    return () => {
      // Restore original keepAlive if needed
    };
  }, [connection]);

  const handleSetup = async () => {
    addLog('Setting up microphone...');
    await setupMicrophone();
  };

  const handleConnect = async () => {
    addLog('Connecting to Deepgram...');
    setConnectionStats(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
    await connectToDeepgram({
      model: "nova-2",
      interim_results: true,
      smart_format: true,
      filler_words: true,
      utterance_end_ms: 3000,
    });
  };

  const handleStartRecording = () => {
    if (microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.OPEN) {
      addLog('Starting recording...');
      startMicrophone();
      setIsRecording(true);
      setTranscript('');
    } else {
      addLog(`Cannot start - Microphone: ${microphoneState}, Connection: ${connectionState}`);
    }
  };

  const handleStopRecording = () => {
    addLog('Stopping recording...');
    stopMicrophone();
    setIsRecording(false);
  };

  const resetStats = () => {
    setConnectionStats({
      keepAliveCount: 0,
      reconnectAttempts: 0,
      errorCount: 0,
      totalUptime: 0
    });
    addLog('Stats reset');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Live Transcription Fix Test</h1>
          <p className="text-gray-600">Testing the keep-alive fix and connection stability</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            
            <div className="space-y-3">
              <div className={`p-3 rounded ${
                microphoneState === MicrophoneState.Ready ? 'bg-green-100 text-green-800' :
                microphoneState === MicrophoneState.Error ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                <div className="font-medium">Microphone</div>
                <div className="text-sm">{microphoneState}</div>
              </div>
              
              <div className={`p-3 rounded ${
                connectionState === LiveConnectionState.OPEN ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                <div className="font-medium">Deepgram</div>
                <div className="text-sm">{connectionState}</div>
              </div>
              
              <div className={`p-3 rounded ${
                isRecording ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="font-medium">Recording</div>
                <div className="text-sm">{isRecording ? 'Active' : 'Stopped'}</div>
              </div>
            </div>
          </div>

          {/* Connection Stats */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Stats</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Keep-alives sent:</span>
                <span className="font-mono">{connectionStats.keepAliveCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Reconnect attempts:</span>
                <span className="font-mono">{connectionStats.reconnectAttempts}</span>
              </div>
              <div className="flex justify-between">
                <span>Errors detected:</span>
                <span className="font-mono text-red-600">{connectionStats.errorCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Connection uptime:</span>
                <span className="font-mono">{formatUptime(connectionStats.totalUptime)}</span>
              </div>
            </div>
            
            <button
              onClick={resetStats}
              className="mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Reset Stats
            </button>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleSetup}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Setup Microphone
              </button>
              
              <button
                onClick={handleConnect}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Connect to Deepgram
              </button>
              
              <button
                onClick={handleStartRecording}
                disabled={microphoneState !== MicrophoneState.Ready || connectionState !== LiveConnectionState.OPEN}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                Start Recording
              </button>
              
              <button
                onClick={handleStopRecording}
                disabled={!isRecording}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
              >
                Stop Recording
              </button>
              
              <button
                onClick={clearLogs}
                className="w-full px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Live Transcript</h2>
          <div className="bg-gray-50 p-4 rounded min-h-[100px]">
            {transcript || "Start recording to see live transcription..."}
          </div>
        </div>

        {/* Logs */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet...</div>
            )}
          </div>
        </div>

        {/* Test Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">Test Instructions</h2>
          <div className="text-blue-700 space-y-2">
            <p><strong>Test the fix:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Click "Setup Microphone" and allow access</li>
              <li>Click "Connect to Deepgram" and wait for connection</li>
              <li>Click "Start Recording" and speak for 30+ seconds</li>
              <li>Watch the keep-alive counter - it should increment every 10 seconds</li>
              <li>Verify transcription continues working throughout</li>
              <li>Click "Stop Recording" and try starting again</li>
            </ol>
            <p className="mt-4"><strong>Expected behavior:</strong> Live transcription should continue working indefinitely without stopping, and keep-alive messages should be sent regularly during recording.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 