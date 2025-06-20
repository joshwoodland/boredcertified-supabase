"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
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
import { CUSTOM_TOPICS } from '../config/topicMappings';

interface LiveDeepgramRecorderProps {
  onRecordingComplete: (blob: Blob, transcript: string) => void;
  isProcessing: boolean;
  isRecordingFromModal?: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  headless?: boolean; // When true, renders no UI - only provides recording functionality
  onStatusChange?: (status: string) => void; // Callback for status updates in headless mode
  onRecordingStateChange?: (isRecording: boolean) => void; // Callback for recording state changes
  onErrorChange?: (error: string | null) => void; // Callback for error state changes
  onTopicsDetected?: (topics: Array<{ topic: string; confidence_score: number }>) => void; // New: Topic detection callback
  enableTopicDetection?: boolean; // New: Enable semantic topic detection
}

export interface LiveDeepgramRecorderRef {
  startRecording: () => void;
  stopRecording: () => void;
  cleanup: () => void;
  canRecord: boolean;
  canStop: boolean;
  isRecording: boolean;
  transcript: string;
  error: string | null;
  status: string;
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

const LiveDeepgramRecorder = forwardRef<LiveDeepgramRecorderRef, LiveDeepgramRecorderProps>(({
  onRecordingComplete,
  isProcessing,
  isRecordingFromModal = false,
  onTranscriptUpdate,
  headless = false,
  onStatusChange,
  onRecordingStateChange,
  onErrorChange,
  onTopicsDetected,
  enableTopicDetection = false
}, ref) => {
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [usedMessageIndices, setUsedMessageIndices] = useState<Set<number>>(new Set());
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');

  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, resetToReady, microphoneState } =
    useMicrophone();
  
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();
  const recordedChunks = useRef<Blob[]>([]);

  // Temporarily disable recording safeguard to match debug page performance
  // const {
  //   recoverySession,
  //   lastBackupTime,
  //   handleRecoverTranscript,
  //   handleDiscardRecovery,
  //   clearRecordingData
  // } = useRecordingSafeguard({
  //   isRecording,
  //   transcript,
  //   finalTranscript,
  //   sessionType: 'general'
  // });

  // Simplified cleanup function
  const clearRecordingData = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    setError(null);
    recordedChunks.current = [];
  }, []);

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

  // Setup microphone on mount and cleanup on unmount
  useEffect(() => {
    console.log('[LIVE RECORDER] Component mounted, setting up microphone...');
    setupMicrophone();
  }, [setupMicrophone]);

  // Connect to Deepgram when microphone is ready
  useEffect(() => {
    console.log('[LIVE RECORDER] Microphone state changed:', {
      microphoneState,
      hasConnection: !!connection,
      connectionState,
      enableTopicDetection
    });
    
    if (microphoneState === MicrophoneState.Ready && !connection) {
      console.log('[LIVE RECORDER] Connecting to Deepgram with nova-2 model...');
      
      const options: any = {
        model: "nova-2", // Changed from nova-3 to match working debug page
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      };
      
      // Add topic detection if enabled
      if (enableTopicDetection) {
        console.log('[LIVE RECORDER] Enabling topic detection with custom medical topics...');
        options.topics = true;
        options.custom_topic_mode = 'strict';
        options.custom_topic = CUSTOM_TOPICS;
        console.log('[LIVE RECORDER] Custom topics configured:', CUSTOM_TOPICS.length, 'topics');
      }
      
      connectToDeepgram(options);
    }
  }, [microphoneState, connection, connectToDeepgram, enableTopicDetection]);

  // Handle transcription and audio data - simplified like debug page
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

    const onTranscript = (data: any) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      console.log("thisCaption", thisCaption);
      
      // Handle topics if available and enabled
      if (enableTopicDetection && data.topics && data.topics.segments && onTopicsDetected) {
        const allTopics: Array<{ topic: string; confidence_score: number }> = [];
        
        data.topics.segments.forEach((segment: any) => {
          if (segment.topics) {
            segment.topics.forEach((topic: any) => {
              allTopics.push({
                topic: topic.topic,
                confidence_score: topic.confidence_score
              });
            });
          }
        });
        
        if (allTopics.length > 0) {
          console.log('[LIVE RECORDER] Topics detected:', allTopics);
          // Defer topic callback to avoid setState during render
          setTimeout(() => {
            onTopicsDetected(allTopics);
          }, 0);
        }
      }
      
      if (thisCaption !== "") {
        console.log('thisCaption !== ""', thisCaption);
        setTranscript(thisCaption);
        
        // Send complete accumulated transcript to modals for keyword analysis
        // This includes previous final segments plus current interim
        const completeTranscript = finalTranscript + (finalTranscript ? " " : "") + thisCaption;
        
        // Defer onTranscriptUpdate call to avoid setState during render
        setTimeout(() => {
          onTranscriptUpdate?.(completeTranscript);
        }, 0);

        if (isFinal && speechFinal) {
          // Accumulate final transcripts for the complete recording
          setFinalTranscript(prev => prev + " " + thisCaption);
          
          clearTimeout(captionTimeout.current);
          captionTimeout.current = setTimeout(() => {
            // Reset live caption after 3 seconds like the debug page
            setTranscript("");
            clearTimeout(captionTimeout.current);
          }, 3000);
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
  }, [connectionState, microphone, connection, onTranscriptUpdate, enableTopicDetection, onTopicsDetected]);

  // Keep connection alive - simplified like debug page
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

  // Notify parent components of state changes in headless mode
  useEffect(() => {
    if (headless && onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [headless, isRecording, onRecordingStateChange]);

  useEffect(() => {
    if (headless && onErrorChange) {
      onErrorChange(error);
    }
  }, [headless, error, onErrorChange]);

  useEffect(() => {
    if (headless && onStatusChange) {
      onStatusChange(getStatusMessage());
    }
  }, [headless, microphoneState, connectionState, isRecording, error, onStatusChange]);

  const startRecording = useCallback(async () => {
    console.log('[LIVE RECORDER] === START RECORDING METHOD CALLED ===');
    console.log('[LIVE RECORDER] Pre-conditions check:', {
      microphoneState,
      connectionState,
      isRecording,
      canRecord: microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.OPEN && !isRecording
    });

    // Match debug page pattern - simple and direct
    if (microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.OPEN) {
      try {
        console.log('[LIVE RECORDER] Conditions met, starting recording...');
        setError(null);
        recordedChunks.current = [];
        
        // Clear previous transcripts
        setTranscript("");
        setFinalTranscript("");
        
        // Start microphone immediately like debug page
        console.log('[LIVE RECORDER] Starting microphone...');
        startMicrophone();
        console.log('[LIVE RECORDER] Setting recording state to true...');
        setIsRecording(true);
        console.log('[LIVE RECORDER] Recording setup complete');
        
      } catch (err) {
        console.error('[LIVE RECORDER] ERROR in startRecording:', err);
        setError(err instanceof Error ? err.message : 'Failed to start recording');
      }
    } else {
      console.error('[LIVE RECORDER] Cannot start recording - conditions not met:', {
        microphoneReady: microphoneState === MicrophoneState.Ready,
        connectionOpen: connectionState === LiveConnectionState.OPEN,
        notAlreadyRecording: !isRecording,
        microphoneState,
        connectionState,
        isRecording
      });
    }
  }, [microphoneState, connectionState, startMicrophone, isRecording]);

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
      
      // Only clear recording data if not from modal (to allow resuming)
      if (!isRecordingFromModal) {
        clearRecordingData();
      } else {
        // For modal context, reset microphone to ready state so it can be resumed
        setTimeout(() => {
          resetToReady();
        }, 100);
      }
      
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  }, [stopMicrophone, finalTranscript, transcript, onRecordingComplete, clearRecordingData, isRecordingFromModal, resetToReady]);

  const cleanup = useCallback(() => {
    console.log('[LIVE RECORDER] Cleaning up recording resources...');
    
    // Stop recording if active
    if (isRecording) {
      try {
        stopMicrophone();
      } catch (error) {
        console.error('[LIVE RECORDER] Error stopping microphone during cleanup:', error);
      }
    }
    
    // Clear intervals and timeouts
    if (captionTimeout.current) {
      clearTimeout(captionTimeout.current);
      captionTimeout.current = null;
    }
    
    if (keepAliveInterval.current) {
      clearInterval(keepAliveInterval.current);
      keepAliveInterval.current = null;
    }
    
    // Disconnect from Deepgram
    disconnectFromDeepgram();
    
    // Reset component state
    setIsRecording(false);
    setTranscript("");
    setFinalTranscript("");
    setError(null);
    recordedChunks.current = [];
    clearRecordingData();
    
    console.log('[LIVE RECORDER] Cleanup complete');
  }, [isRecording, stopMicrophone, disconnectFromDeepgram, clearRecordingData]);

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
                   !isRecording;

  const canStop = isRecording && microphoneState === MicrophoneState.Open;

  // Enhanced debug logging to help identify issues
  useEffect(() => {
    console.log('[LIVE RECORDER DEBUG] State check:', {
      microphoneState,
      connectionState,
      isRecording,
      isProcessing,
      canRecord,
      canStop,
      error,
      timestamp: new Date().toISOString()
    });
    
    // Log specific blocking conditions
    if (!canRecord) {
      const reasons = [];
      if (microphoneState !== MicrophoneState.Ready) {
        reasons.push(`Microphone not ready: ${microphoneState}`);
      }
      if (connectionState !== LiveConnectionState.OPEN) {
        reasons.push(`Connection not open: ${connectionState}`);
      }
      if (isRecording) {
        reasons.push('Already recording');
      }
      console.log('[LIVE RECORDER DEBUG] Cannot record because:', reasons);
    }
  }, [microphoneState, connectionState, isRecording, isProcessing, canRecord, canStop, error]);

  // Expose recording controls through ref
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    cleanup,
    canRecord,
    canStop,
    isRecording,
    transcript: transcript || finalTranscript,
    error,
    status: getStatusMessage()
  }), [startRecording, stopRecording, cleanup, canRecord, canStop, isRecording, transcript, finalTranscript, error, getStatusMessage]);

  // Show recovery prompt if available (only in non-headless mode)
  // Disabled to match debug page simplicity
  // if (recoverySession && !isRecording && !headless) {
  //   return (
  //     <RecoveryPrompt
  //       savedSession={recoverySession}
  //       onRecover={(transcript) => {
  //         setTranscript(transcript);
  //         setFinalTranscript(transcript);
  //         handleRecoverTranscript(transcript);
  //       }}
  //       onDiscard={handleDiscardRecovery}
  //     />
  //   );
  // }

  // In headless mode, return null (no UI)
  if (headless) {
    return null;
  }

  return (
    <div className="flex flex-col space-y-4">


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
});

LiveDeepgramRecorder.displayName = 'LiveDeepgramRecorder';

export default LiveDeepgramRecorder; 