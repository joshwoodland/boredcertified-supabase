'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { DeepgramService } from '../services/DeepgramService';
import { DeepgramHttpService } from '../services/DeepgramHttpService';
import { getSavedAudioDevice } from '../utils/audioLoopback';
import dynamic from 'next/dynamic';

const AudioSettings = dynamic(
  () => import('./AudioSettings'),
  { ssr: false }
);

interface LiveTranscriptionProps {
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  showAudioSettings?: boolean;
  lowEchoCancellation?: boolean;
}

export default function LiveTranscription({
  isRecording,
  onTranscriptUpdate,
  onError,
  showAudioSettings = false,
  lowEchoCancellation = false
}: LiveTranscriptionProps) {
  const [transcript, setTranscript] = useState('');
  const [networkError, setNetworkError] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState('');
  const [connectionType, setConnectionType] = useState<'websocket' | 'http'>('websocket');
  const [wsRetryCount, setWsRetryCount] = useState(0);
  const deepgramServiceRef = useRef<DeepgramService | null>(null);
  const httpServiceRef = useRef<DeepgramHttpService | null>(null);
  const isRecordingRef = useRef(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | undefined>(undefined);

  // Store the onTranscriptUpdate callback in a ref to avoid re-renders
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
    onErrorRef.current = onError;
  }, [onTranscriptUpdate, onError]);

  // Handle transcript updates
  const handleTranscriptUpdate = useCallback((text: string, isFinal: boolean) => {
    // Update the UI with the transcript
    setTranscript(text);

    // Call the parent component's callback if provided
    if (onTranscriptUpdateRef.current) {
      onTranscriptUpdateRef.current(text, isFinal);
    }
  }, []);

  // Handle errors with automatic fallback to HTTP service
  const handleError = useCallback((error: Error) => {
    console.error('Deepgram error:', error);

    // Check if this is a WebSocket-related error that we should fall back from
    const isWebSocketError = error.message.includes('WebSocket') || 
                             error.message.includes('connection error') ||
                             error.message.includes('1006') ||
                             error.message.includes('Connection timeout');

    if (connectionType === 'websocket' && isWebSocketError && wsRetryCount < 2) {
      console.log(`WebSocket error detected, attempting fallback to HTTP service (retry ${wsRetryCount + 1}/2)`);
      setWsRetryCount(prev => prev + 1);
      
      // Try to fall back to HTTP service
      setTimeout(() => {
        if (isRecordingRef.current) {
          tryHttpFallback();
        }
      }, 1000);
      return;
    }

    setNetworkError(true);

    // Provide more user-friendly error messages
    let userMessage = 'Connection error occurred';

    if (error.message.includes('API key not found') || error.message.includes('API key not configured')) {
      userMessage = 'Speech-to-text service is not properly configured on the server. Please contact support.';
      console.error('Deepgram API key issue detected. The API key may not be set in the server environment variables.');
    } else if (error.message.includes('getUserMedia')) {
      userMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
    } else if (error.message.includes('Failed to get Deepgram') || error.message.includes('Failed to get connection details')) {
      if (connectionType === 'websocket') {
        userMessage = 'WebSocket connection failed. Trying HTTP fallback...';
      } else {
        userMessage = 'Unable to connect to speech-to-text service. Please check your internet connection.';
      }
    } else if (error.message.includes('Server responded with status')) {
      userMessage = 'Server error when connecting to speech-to-text service. Please try again later.';
    } else if (isWebSocketError && connectionType === 'http') {
      userMessage = 'Connection issues detected. Using HTTP streaming mode for better reliability.';
    } else {
      userMessage = error.message || 'Connection error occurred';
    }

    setNetworkErrorMessage(userMessage);

    // Call the parent component's error handler if provided
    if (onErrorRef.current) {
      onErrorRef.current(error);
    }
  }, [connectionType, wsRetryCount]);

  // Function to fall back to HTTP service
  const tryHttpFallback = useCallback(async () => {
    console.log('Falling back to HTTP-based Deepgram service...');
    
    // Stop WebSocket service
    if (deepgramServiceRef.current) {
      deepgramServiceRef.current.stop();
      deepgramServiceRef.current = null;
    }

    // Switch to HTTP mode
    setConnectionType('http');
    setNetworkError(false);
    setNetworkErrorMessage('');

    try {
      // Create and start HTTP service
      httpServiceRef.current = new DeepgramHttpService(
        handleTranscriptUpdate,
        handleError,
        selectedAudioDeviceId,
        lowEchoCancellation
      );

      await httpServiceRef.current.start();
      console.log('Successfully switched to HTTP-based service');
    } catch (httpError) {
      console.error('HTTP fallback also failed:', httpError);
      handleError(httpError instanceof Error ? httpError : new Error('HTTP fallback failed'));
    }
  }, [handleTranscriptUpdate, handleError, selectedAudioDeviceId, lowEchoCancellation]);

  // Load saved audio device on mount
  useEffect(() => {
    const savedDevice = getSavedAudioDevice();
    if (savedDevice) {
      setSelectedAudioDeviceId(savedDevice);
    }
  }, []);

  // Handle audio device change
  const handleAudioDeviceChange = useCallback((deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);

    // If already recording, restart with new device
    if (isRecording) {
      // Stop current service
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.stop();
        deepgramServiceRef.current = null;
      }
      if (httpServiceRef.current) {
        httpServiceRef.current.stop();
        httpServiceRef.current = null;
      }

      // Create new service based on current connection type
      if (connectionType === 'websocket') {
        deepgramServiceRef.current = new DeepgramService(
          handleTranscriptUpdate,
          handleError,
          deviceId,
          lowEchoCancellation
        );
        deepgramServiceRef.current.start().catch(handleError);
      } else {
        httpServiceRef.current = new DeepgramHttpService(
          handleTranscriptUpdate,
          handleError,
          deviceId,
          lowEchoCancellation
        );
        httpServiceRef.current.start().catch(handleError);
      }
    }
  }, [isRecording, connectionType, handleTranscriptUpdate, handleError, lowEchoCancellation]);

  // Initialize or clean up services when recording state changes
  useEffect(() => {
    isRecordingRef.current = isRecording;

    if (isRecording) {
      // Reset state
      setTranscript('');
      setNetworkError(false);
      setNetworkErrorMessage('');
      setWsRetryCount(0); // Reset retry count
      setConnectionType('websocket'); // Always start with WebSocket

      // Create and start WebSocket service first
      if (!deepgramServiceRef.current && !httpServiceRef.current) {
        deepgramServiceRef.current = new DeepgramService(
          handleTranscriptUpdate,
          handleError,
          selectedAudioDeviceId,
          lowEchoCancellation
        );

        // Start the service
        deepgramServiceRef.current.start().catch(handleError);
      }
    } else {
      // Stop both services when recording stops
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.stop();
        deepgramServiceRef.current = null;
      }
      if (httpServiceRef.current) {
        httpServiceRef.current.stop();
        httpServiceRef.current = null;
      }
      
      // Reset connection type for next session
      setConnectionType('websocket');
      setWsRetryCount(0);
    }

    // Clean up on unmount
    return () => {
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.stop();
        deepgramServiceRef.current = null;
      }
      if (httpServiceRef.current) {
        httpServiceRef.current.stop();
        httpServiceRef.current = null;
      }
    };
  }, [isRecording, handleTranscriptUpdate, handleError, selectedAudioDeviceId, lowEchoCancellation]);

  // Set up auto-scrolling for the transcript container
  useEffect(() => {
    if (!transcriptContainerRef.current) return;

    const observer = new MutationObserver(() => {
      if (transcriptContainerRef.current) {
        transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
      }
    });

    observer.observe(transcriptContainerRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, []);

  // Manual retry function
  const handleManualRetry = useCallback(() => {
    if (!isRecordingRef.current) return;

    setNetworkError(false);
    setNetworkErrorMessage('');

    // Restart the appropriate service
    if (connectionType === 'websocket' && deepgramServiceRef.current) {
      deepgramServiceRef.current.stop();
      setTimeout(() => {
        if (deepgramServiceRef.current && isRecordingRef.current) {
          deepgramServiceRef.current.start().catch(handleError);
        }
      }, 500);
    } else if (connectionType === 'http' && httpServiceRef.current) {
      httpServiceRef.current.stop();
      setTimeout(() => {
        if (httpServiceRef.current && isRecordingRef.current) {
          httpServiceRef.current.start().catch(handleError);
        }
      }, 500);
    }
  }, [handleError, connectionType]);

  return (
    <div className="w-full flex flex-col gap-2">
      {showAudioSettings && (
        <AudioSettings
          onDeviceChange={handleAudioDeviceChange}
          className="mb-2"
        />
      )}

      <div
        ref={transcriptContainerRef}
        className="w-full bg-gray-800 dark:bg-gray-800 p-6 rounded-2xl relative shadow-lg"
        style={{
          height: '200px',
          maxHeight: '200px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent',
          WebkitOverflowScrolling: 'touch'
        }}
      >
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 20px;
          border: 3px solid transparent;
        }
        .dark div::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.5);
        }
      `}</style>
      <div className="h-full">
        {networkError && (
          <div className="bg-red-600/20 text-red-200 px-3 py-2 rounded-md mb-3 text-sm">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="flex-1">{networkErrorMessage || 'Connection issue. Please try again.'}</span>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleManualRetry}
                className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition-colors"
              >
                Retry Now
              </button>
            </div>
          </div>
        )}

        {transcript || isRecording ? (
          <p className="text-white whitespace-pre-wrap leading-relaxed">
            {transcript || 'Listening...'}
          </p>
        ) : (
          <p className="text-gray-400 dark:text-gray-400 text-sm opacity-0">
            &nbsp;
          </p>
        )}
      </div>
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-300 bg-gray-700/80 px-2 py-1 rounded">
            {connectionType === 'websocket' ? (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                WebSocket
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                HTTP
              </>
            )}
          </div>
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        </div>
      )}
      </div>
    </div>
  );
}
