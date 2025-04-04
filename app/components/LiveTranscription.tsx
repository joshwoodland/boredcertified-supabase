'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface LiveTranscriptionProps {
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
  state: string;
}

interface Window {
  SpeechRecognition: {
    new(): SpeechRecognition;
  };
  webkitSpeechRecognition: {
    new(): SpeechRecognition;
  };
}

export default function LiveTranscription({ isRecording, onTranscriptUpdate }: LiveTranscriptionProps) {
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState('');
  const [noSpeechDetected, setNoSpeechDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const fullTranscriptRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastResultIndexRef = useRef(0);
  const interimResultRef = useRef('');
  const retryCountRef = useRef(0);
  const noSpeechCountRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const watchdogRef = useRef<NodeJS.Timeout>();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
    }
    lastResultIndexRef.current = 0;
    interimResultRef.current = '';
    retryCountRef.current = 0;
    noSpeechCountRef.current = 0;
    setNetworkError(false);
    setNetworkErrorMessage('');
    setNoSpeechDetected(false);
  }, []);

  useEffect(() => {
    // Check if browser is supported by checking window object exists
    if (typeof window === 'undefined') {
      setIsSupported(false);
      return;
    }
    
    // Check if SpeechRecognition is supported
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Update activity timestamp
        lastActivityRef.current = Date.now();
        
        // Reset no-speech warning when we get results
        noSpeechCountRef.current = 0;
        setNoSpeechDetected(false);
        
        let currentTranscript = '';
        let isFinal = false;

        // Only process new results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            // Add to full transcript and clear interim
            fullTranscriptRef.current += ' ' + result[0].transcript;
            interimResultRef.current = '';
            isFinal = true;
          } else {
            // Update interim result
            interimResultRef.current = result[0].transcript;
          }
        }

        // Combine full transcript with current interim result
        currentTranscript = (fullTranscriptRef.current + ' ' + interimResultRef.current).trim();
        
        setTranscript(currentTranscript);
        onTranscriptUpdate?.(currentTranscript, isFinal);
      };

      recognition.onend = () => {
        // Only restart if we're still supposed to be recording
        if (isRecordingRef.current) {
          timeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
            }
          }, 100);
        }
      };

      recognition.onerror = (event: any) => {
        // Update activity timestamp
        lastActivityRef.current = Date.now();
        
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          // Increment no-speech counter
          noSpeechCountRef.current += 1;
          
          // Only show the no-speech message after 3 consecutive occurrences
          if (noSpeechCountRef.current >= 3) {
            setNoSpeechDetected(true);
          }
          
          // Still restart recognition
          if (isRecordingRef.current && recognition.state === 'inactive') {
            timeoutRef.current = setTimeout(() => {
              try {
                recognition.start();
              } catch (error) {
                console.error('Error restarting recognition:', error);
              }
            }, 100);
          }
          return;
        }
        
        // Reset no-speech counter for other errors
        noSpeechCountRef.current = 0;
        setNoSpeechDetected(false);
        
        if (event.error === 'network') {
          setNetworkError(true);
          retryCountRef.current += 1;
          
          // Set a more informative error message
          setNetworkErrorMessage(
            retryCountRef.current > 3 
              ? 'Persistent network issues. Check your connection.'
              : 'Network connection issue. Attempting to reconnect...'
          );
          
          // Replace exponential backoff with a quicker fixed retry delay
          // Use a short fixed delay (500ms) for faster recovery
          const retryDelay = 500;
          
          // For network errors, retry with fixed delay if still recording
          if (isRecordingRef.current && recognition.state === 'inactive') {
            timeoutRef.current = setTimeout(() => {
              try {
                recognition.start();
                
                // If reconnection is successful, reset error states after a short delay
                setTimeout(() => {
                  if (isRecordingRef.current) {
                    setNetworkError(false);
                    setNetworkErrorMessage('');
                    retryCountRef.current = 0;
                  }
                }, 2000);
              } catch (error) {
                console.error('Error restarting recognition after network error:', error);
                
                // If we fail to restart, try again immediately
                if (isRecordingRef.current) {
                  timeoutRef.current = setTimeout(() => {
                    try {
                      recognition.start();
                    } catch (innerError) {
                      console.error('Error on second restart attempt:', innerError);
                      // Update error message for persistent failures
                      setNetworkErrorMessage('Unable to reconnect. Try clicking "Retry" or restarting the recording.');
                    }
                  }, 100);
                }
              }
            }, retryDelay);
          }
          return;
        }
        
        // For other errors, restart if we're still recording
        if (isRecordingRef.current && recognition.state === 'inactive') {
          timeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
            } catch (error) {
              console.error('Error restarting recognition after error:', error);
            }
          }, 100);
        }
      };

      recognitionRef.current = recognition;
    }

    return cleanup;
  }, [cleanup, onTranscriptUpdate]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    
    if (!recognitionRef.current) return;
    
    if (isRecording) {
      // Starting a new recording session: reset transcript.
      // You can change this behavior if you want to append over multiple starts.
      fullTranscriptRef.current = '';
      interimResultRef.current = '';
      lastResultIndexRef.current = 0;
      retryCountRef.current = 0;
      noSpeechCountRef.current = 0;
      setNetworkError(false);
      setNoSpeechDetected(false);
      setTranscript('');
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    } else {
      // Stopping the recording without clearing the accumulated transcript.
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }, [isRecording]);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Always auto-scroll to bottom when transcript updates during recording
    if (transcriptContainerRef.current && isRecording) {
      const container = transcriptContainerRef.current;
      
      // Using setTimeout to ensure the DOM has updated
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 0);
    }
  }, [transcript, isRecording]);

  // Always scroll to bottom when transcript updates, even when not recording
  useEffect(() => {
    if (transcriptContainerRef.current && transcript) {
      const container = transcriptContainerRef.current;
      
      // Using setTimeout to ensure the DOM has updated
      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 0);
    }
  }, [transcript]);

  // Add a manual retry function
  const handleManualRetry = useCallback(() => {
    if (!recognitionRef.current || !isRecordingRef.current) return;
    
    try {
      setNetworkError(false);
      setNetworkErrorMessage('');
      retryCountRef.current = 0;
      
      // Clear any pending timeouts before retrying
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      recognitionRef.current.stop();
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error in manual retry:', error);
          setNetworkErrorMessage('Failed to restart. Please try again.');
        }
      }, 100);
    } catch (error) {
      console.error('Error in manual retry:', error);
    }
  }, []);

  // Add a function to check if recognition is active
  const checkRecognitionActive = useCallback(() => {
    if (isRecordingRef.current && recognitionRef.current) {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // If it's been more than 5 seconds since the last activity (result or error)
      // and we should be recording, but recognition state is inactive, restart it
      if (timeSinceLastActivity > 5000) {
        try {
          const recognition = recognitionRef.current;
          
          // Only restart if we're in inactive state
          if (recognition.state === 'inactive' || recognition.state === '') {
            console.log('Watchdog: Restarting inactive recognition service');
            recognition.stop();
            setTimeout(() => {
              try {
                recognition.start();
                lastActivityRef.current = Date.now();
              } catch (error) {
                console.error('Watchdog: Error restarting recognition service:', error);
              }
            }, 100);
          }
        } catch (error) {
          console.error('Watchdog: Error checking recognition state:', error);
        }
      }
    }
  }, []);

  // Add a useEffect to set up the watchdog timer
  useEffect(() => {
    // Set up watchdog timer to check for inactive recognition every 2 seconds
    if (isRecording) {
      watchdogRef.current = setInterval(checkRecognitionActive, 2000);
    } else if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
    }
    
    return () => {
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
      }
    };
  }, [isRecording, checkRecognitionActive]);

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p className="text-yellow-800 dark:text-yellow-200">
          Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={transcriptContainerRef}
      className="w-full bg-gray-800 dark:bg-gray-800 p-6 rounded-2xl relative shadow-lg"
      style={{
        height: '200px',
        maxHeight: '200px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent',
        /* WebKit browsers */
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
              <span className="flex-1">{networkErrorMessage || `Network connection issue. Reconnecting... (Attempt ${retryCountRef.current})`}</span>
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
        
        {noSpeechDetected && (
          <div className="bg-amber-600/20 text-amber-200 px-3 py-2 rounded-md mb-3 text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            No speech detected. Please check if:
            <ul className="list-disc ml-6 mt-1">
              <li>Your microphone is working</li>
              <li>You're speaking loud enough</li>
              <li>You've allowed microphone access</li>
            </ul>
          </div>
        )}
        
        {transcript || isRecording ? (
          <p className="text-white whitespace-pre-wrap leading-relaxed">
            {transcript || 'Listening...'}
          </p>
        ) : (
          <p className="text-gray-400 dark:text-gray-400 text-sm">
            Click the button above to start recording
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
  );
} 