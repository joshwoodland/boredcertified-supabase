'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { DeepgramService } from '../services/DeepgramService';
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
  const deepgramServiceRef = useRef<DeepgramService | null>(null);
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

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('Deepgram error:', error);
    setNetworkError(true);

    // Provide more user-friendly error messages
    let userMessage = 'Connection error occurred';

    if (error.message.includes('API key not configured')) {
      userMessage = 'Speech-to-text service is not properly configured on the server. Please contact support.';
    } else if (error.message.includes('getUserMedia')) {
      userMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
    } else if (error.message.includes('Failed to get Deepgram token')) {
      userMessage = 'Unable to connect to speech-to-text service. Please check your internet connection.';
    } else {
      userMessage = error.message || 'Connection error occurred';
    }

    setNetworkErrorMessage(userMessage);

    // Call the parent component's error handler if provided
    if (onErrorRef.current) {
      onErrorRef.current(error);
    }
  }, []);

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
    if (isRecording && deepgramServiceRef.current) {
      deepgramServiceRef.current.stop();
      deepgramServiceRef.current = null;

      // Create new service with the selected device
      deepgramServiceRef.current = new DeepgramService(
        handleTranscriptUpdate,
        handleError,
        deviceId,
        lowEchoCancellation
      );

      // Start the service
      deepgramServiceRef.current.start().catch(handleError);
    }
  }, [isRecording]);

  // Initialize or clean up Deepgram service when recording state changes
  useEffect(() => {
    isRecordingRef.current = isRecording;

    if (isRecording) {
      // Reset state
      setTranscript('');
      setNetworkError(false);
      setNetworkErrorMessage('');

      // Create and start Deepgram service
      if (!deepgramServiceRef.current) {
        deepgramServiceRef.current = new DeepgramService(
          handleTranscriptUpdate,
          handleError,
          selectedAudioDeviceId,
          lowEchoCancellation
        );
      }

      // Start the service
      deepgramServiceRef.current.start().catch(handleError);
    } else if (deepgramServiceRef.current) {
      // Stop the service when recording stops
      deepgramServiceRef.current.stop();
    }

    // Clean up on unmount
    return () => {
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.stop();
        deepgramServiceRef.current = null;
      }
    };
  }, [isRecording, handleTranscriptUpdate, handleError]);

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
    if (!deepgramServiceRef.current || !isRecordingRef.current) return;

    setNetworkError(false);
    setNetworkErrorMessage('');

    // Restart the Deepgram service
    deepgramServiceRef.current.stop();
    setTimeout(() => {
      if (deepgramServiceRef.current && isRecordingRef.current) {
        deepgramServiceRef.current.start().catch(handleError);
      }
    }, 500);
  }, [handleError]);

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
