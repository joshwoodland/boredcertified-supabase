'use client';

import { useState, useEffect } from 'react';
import { useDeepgram, LiveConnectionState } from '../context/DeepgramContextProvider';
import { useMicrophone, MicrophoneState } from '../context/MicrophoneContextProvider';

export default function TestDeepgramPage() {
  const [status, setStatus] = useState('Initializing...');
  const [logs, setLogs] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  
  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphoneState } = useMicrophone();

  const addLog = (message: string) => {
    console.log(`[TEST PAGE] ${message}`);
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  // Handle Deepgram connection state changes
  useEffect(() => {
    addLog(`Deepgram connection state: ${connectionState}`);
  }, [connectionState]);

  // Handle microphone state changes
  useEffect(() => {
    addLog(`Microphone state changed: ${microphoneState}`);
    if (microphoneState === MicrophoneState.Ready) {
      setStatus('Microphone ready, connecting to Deepgram...');
      connectToDeepgram({
        model: "nova-2",
        punctuate: true,
        smart_format: true,
        filler_words: false,
        utterance_end_ms: 1000,
      });
    } else if (microphoneState === MicrophoneState.Error) {
      setStatus('Microphone error');
    }
  }, [microphoneState, connectToDeepgram]);

  // Setup initial microphone when component mounts
  useEffect(() => {
    addLog('Setting up microphone...');
    setupMicrophone();
  }, [setupMicrophone]);

  // Handle incoming messages
  useEffect(() => {
    if (!connection) return;

    const onMessage = (data: any) => {
      addLog(`Deepgram message received: ${JSON.stringify(data)}`);
      
      const message = JSON.parse(data);
      if (message.type === 'UtteranceEnd') {
        return;
      }

      if (message.channel?.alternatives?.[0]) {
        const newTranscript = message.channel.alternatives[0].transcript;
        if (newTranscript !== '') {
          setTranscript(prev => prev + ' ' + newTranscript);
        }
      }
    };

    const onClose = () => {
      addLog('Deepgram connection closed');
    };

    const onError = (error: any) => {
      addLog(`Deepgram error: ${error}`);
    };

    connection.addListener('message', onMessage);
    connection.addListener('close', onClose);
    connection.addListener('error', onError);

    return () => {
      connection.removeListener('message', onMessage);
      connection.removeListener('close', onClose);
      connection.removeListener('error', onError);
    };
  }, [connection]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Deepgram Test Page</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p className="mb-2"><strong>Overall Status:</strong> {status}</p>
          <p className="mb-2"><strong>Microphone State:</strong> {microphoneState}</p>
          <p className="mb-2"><strong>Deepgram State:</strong> {connectionState}</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Live Transcript</h2>
          <div className="bg-gray-100 p-4 rounded min-h-[100px]">
            {transcript || 'Start speaking to see live transcription...'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded max-h-96 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 