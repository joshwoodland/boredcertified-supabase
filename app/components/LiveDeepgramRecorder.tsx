"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "../context/MicrophoneContextProvider";
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import RecoveryPrompt from './RecoveryPrompt';

interface LiveDeepgramRecorderProps {
  onRecordingComplete: (blob: Blob, transcript: string) => void;
  isProcessing: boolean;
  isRecordingFromModal?: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  lowEchoCancellation?: boolean;
}

const loadingMessages = [
  "Channeling Doctor Strange's medical expertise... Hold on, this might require some magic. 🪄",
  "Barbie says: 'I'm not just a fashion icon—I'm also a doctor!' 👩‍⚕️",
  "Taylor Swift is working on a new song: 'Patient History (10-Minute Version).' 🎵",
  "Consulting with House, M.D.—but without the sarcasm. 🏥",
  "Asking Wednesday Addams to brighten up this diagnosis… okay, maybe just a little. 🖤",
  "Transforming your words into SOAP notes—Optimus Prime style. 🤖",
  "Spider-Man's spidey sense is tingling… must be a breakthrough! 🕷️",
  "Welcome to The Last of Us: Medical Documentation Edition—don't worry, this infection is just a typo. 🌿",
  "Bluey's dad is helping write this note… turns out he's surprisingly good at it! 🐕",
  "Ted Lasso is giving your medical records the pep talk they deserve. 📋",
];

export default function LiveDeepgramRecorder({
  onRecordingComplete,
  isProcessing,
  isRecordingFromModal = false,
  onTranscriptUpdate,
  lowEchoCancellation = true
}: LiveDeepgramRecorderProps) {
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [usedMessageIndices, setUsedMessageIndices] = useState<Set<number>>(new Set());
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');

  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState } =
    useMicrophone();
  
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();
  const recordedChunks = useRef<Blob[]>([]);

  // Use the recording safeguard hook
  const {
    recoverySession,
    lastBackupTime,
    handleRecoverTranscript,
    handleDiscardRecovery,
    clearRecordingData
  } = useRecordingSafeguard({
    isRecording,
    transcript,
    finalTranscript,
    sessionType: 'general'
  });

  // Get a random unused loading message
  const getRandomLoadingMessage = useCallback(() => {
    const unusedIndices = Array.from(Array(loadingMessages.length).keys())
      .filter(i => !usedMessageIndices.has(i));

    if (unusedIndices.length === 0) {
      const randomIndex = Math.floor(Math.random() * loadingMessages.length);
      return loadingMessages[randomIndex];
    }

    const randomIndex = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
    return loadingMessages[randomIndex];
  }, [usedMessageIndices]);

  // Update loading message every 3 seconds
  useEffect(() => {
    if (isProcessing) {
      const initialMessage = getRandomLoadingMessage();
      setCurrentLoadingMessage(initialMessage);

      const updateUsedMessages = (message: string) => {
        const index = loadingMessages.indexOf(message);
        if (index !== -1) {
          setUsedMessageIndices(prev => {
            const newSet = new Set([...Array.from(prev), index]);
            if (newSet.size >= loadingMessages.length) {
              return new Set();
            }
            return newSet;
          });
        }
      };

      updateUsedMessages(initialMessage);

      const interval = setInterval(() => {
        const message = getRandomLoadingMessage();
        setCurrentLoadingMessage(message);
        updateUsedMessages(message);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isProcessing, getRandomLoadingMessage]);

  // Setup microphone on mount
  useEffect(() => {
    setupMicrophone();
  }, [setupMicrophone]);

  // Connect to Deepgram when microphone is ready
  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready && !connection) {
      connectToDeepgram({
        model: "nova-2",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    }
  }, [microphoneState, connection, connectToDeepgram]);

  // Handle transcription and audio data
  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      // iOS SAFARI FIX: Prevent packetZero from being sent
      if (e.data.size > 0) {
        connection?.send(e.data);
        // Store audio chunks for final blob
        recordedChunks.current.push(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      if (thisCaption !== "") {
        setTranscript(prev => {
          const updated = isFinal ? finalTranscript + " " + thisCaption : thisCaption;
          // Call onTranscriptUpdate if provided
          onTranscriptUpdate?.(updated);
          return updated;
        });

        if (isFinal && speechFinal) {
          setFinalTranscript(prev => prev + " " + thisCaption);
          clearTimeout(captionTimeout.current);
          captionTimeout.current = setTimeout(() => {
            setTranscript(finalTranscript + " " + thisCaption);
            clearTimeout(captionTimeout.current);
          }, 1000);
        }
      }
    };

    if (connectionState === LiveConnectionState.OPEN) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
    }

    return () => {
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      clearTimeout(captionTimeout.current);
    };
  }, [connectionState, microphone, connection, finalTranscript, onTranscriptUpdate]);

  // Keep connection alive
  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
  }, [microphoneState, connectionState, connection]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      recordedChunks.current = [];
      
      if (microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.OPEN) {
        startMicrophone();
        setIsRecording(true);
        setTranscript("");
        setFinalTranscript("");
      } else {
        setError("Please wait for microphone and connection to be ready");
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [microphoneState, connectionState, startMicrophone]);

  const stopRecording = useCallback(async () => {
    try {
      stopMicrophone();
      setIsRecording(false);
      
      // Create audio blob from recorded chunks
      const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm' });
      
      // Get final transcript
      const completeTranscript = finalTranscript || transcript;
      
      // Call the completion callback
      onRecordingComplete(audioBlob, completeTranscript);
      
      // Reset
      recordedChunks.current = [];
      clearRecordingData();
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  }, [stopMicrophone, finalTranscript, transcript, onRecordingComplete, clearRecordingData]);

  const handleEditSave = () => {
    setTranscript(editableTranscript);
    setFinalTranscript(editableTranscript);
    setIsEditMode(false);
  };

  const handleEditCancel = () => {
    setEditableTranscript(transcript || finalTranscript);
    setIsEditMode(false);
  };

  const getStatusMessage = () => {
    if (microphoneState === MicrophoneState.NotSetup) return "Setting up microphone...";
    if (microphoneState === MicrophoneState.SettingUp) return "Requesting microphone access...";
    if (microphoneState === MicrophoneState.Error) return "Microphone error. Please check permissions.";
    if (connectionState === LiveConnectionState.CLOSED) return "Connecting to Deepgram...";
    if (connectionState === LiveConnectionState.OPEN && microphoneState === MicrophoneState.Ready) {
      return isRecording ? "Recording..." : "Ready to record";
    }
    return "Initializing...";
  };

  const canRecord = microphoneState === MicrophoneState.Ready && 
                   connectionState === LiveConnectionState.OPEN && 
                   !isRecording && !isProcessing;

  const canStop = isRecording && microphoneState === MicrophoneState.Open;

  // Show recovery prompt if available
  if (recoverySession && !isRecording) {
    return (
      <RecoveryPrompt
        savedSession={recoverySession}
        onRecover={(transcript) => {
          setTranscript(transcript);
          setFinalTranscript(transcript);
          handleRecoverTranscript(transcript);
        }}
        onDiscard={handleDiscardRecovery}
      />
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Status Display */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1 bg-gray-50 p-3 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-1">Status</div>
          <div className={`text-sm ${
            canRecord ? 'text-green-600' :
            error ? 'text-red-600' :
            'text-yellow-600'
          }`}>
            {error || getStatusMessage()}
          </div>
        </div>
        
        <div className="flex-1 bg-gray-50 p-3 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-1">Recording</div>
          <div className={`text-sm ${isRecording ? 'text-red-600' : 'text-gray-600'}`}>
            {isRecording ? 'Active' : 'Stopped'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={startRecording}
          disabled={!canRecord}
          className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isRecording ? 'Recording...' : 'Start Recording'}
        </button>
        
        <button
          onClick={stopRecording}
          disabled={!canStop}
          className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Stop Recording
        </button>
      </div>

      {/* Transcript Display */}
      {(transcript || finalTranscript) && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-700">Transcription</h3>
            {!isRecording && (transcript || finalTranscript) && (
              <button
                onClick={() => {
                  setEditableTranscript(transcript || finalTranscript);
                  setIsEditMode(true);
                }}
                className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Edit
              </button>
            )}
          </div>

          {isEditMode ? (
            <div className="space-y-2">
              <textarea
                value={editableTranscript}
                onChange={(e) => setEditableTranscript(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Edit your transcription..."
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Save
                </button>
                <button
                  onClick={handleEditCancel}
                  className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={`text-gray-800 ${isRecording ? 'animate-pulse' : ''}`}>
              {transcript || finalTranscript || "No transcription yet..."}
            </div>
          )}
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-800 font-medium">Processing transcription...</span>
          </div>
          {currentLoadingMessage && (
            <p className="text-blue-600 text-sm mt-2">{currentLoadingMessage}</p>
          )}
        </div>
      )}
    </div>
  );
} 