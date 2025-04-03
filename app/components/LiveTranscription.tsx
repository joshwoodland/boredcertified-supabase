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
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const fullTranscriptRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastResultIndexRef = useRef(0);
  const interimResultRef = useRef('');

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
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
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
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
    // Auto-scroll to bottom when transcript updates
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

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
      className={`
        ${transcript || isRecording ? `
          bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm
          p-6 rounded-2xl h-[200px] relative overflow-y-auto
          transition-all duration-300 shadow-lg
          mt-8
        ` : 'text-center py-2 mt-8'}
      `}
    >
      {transcript || isRecording ? (
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {transcript || 'Listening...'}
        </p>
      ) : (
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Click the button above to start recording
        </p>
      )}
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