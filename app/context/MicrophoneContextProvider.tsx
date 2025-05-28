"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  FunctionComponent,
} from "react";

export enum MicrophoneState {
  NotSetup = "NotSetup",
  SettingUp = "SettingUp",
  Ready = "Ready",
  Opening = "Opening",
  Open = "Open",
  Error = "Error",
  Closed = "Closed",
}

export enum MicrophoneEvents {
  DataAvailable = "dataavailable",
}

interface MicrophoneContextType {
  microphone: MediaRecorder | null;
  microphoneState: MicrophoneState;
  setupMicrophone: () => Promise<void>;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  errorMessage: string | null;
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined
);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider: FunctionComponent<
  MicrophoneContextProviderProps
> = ({ children }) => {
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    MicrophoneState.NotSetup
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setupMicrophone = useCallback(async () => {
    if (microphoneState === MicrophoneState.SettingUp) {
      console.log('[MICROPHONE] Already setting up microphone...');
      return;
    }

    console.log('[MICROPHONE] Starting microphone setup...');
    setMicrophoneState(MicrophoneState.SettingUp);
    setErrorMessage(null);

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      console.log('[MICROPHONE] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      console.log('[MICROPHONE] Microphone access granted');

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder is not supported in this browser');
      }

      // Try different MIME types for better compatibility
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('[MICROPHONE] opus codec not supported, trying alternatives...');
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          // Use default (no mimeType specified)
          mimeType = "";
        }
      }

      console.log('[MICROPHONE] Creating MediaRecorder with mimeType:', mimeType || 'default');
      
      const recorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);

      recorder.addEventListener("start", () => {
        console.log('[MICROPHONE] Recording started');
        setMicrophoneState(MicrophoneState.Open);
      });

      recorder.addEventListener("stop", () => {
        console.log('[MICROPHONE] Recording stopped');
        setMicrophoneState(MicrophoneState.Closed);
      });

      recorder.addEventListener("error", (event) => {
        console.error('[MICROPHONE] Recording error:', event);
        setMicrophoneState(MicrophoneState.Error);
        setErrorMessage(`Recording error: ${event}`);
      });

      recorder.addEventListener("dataavailable", (event) => {
        console.log('[MICROPHONE] Data available, size:', event.data.size);
      });

      setMicrophone(recorder);
      setMicrophoneState(MicrophoneState.Ready);
      console.log('[MICROPHONE] Microphone setup complete');
    } catch (error) {
      console.error('[MICROPHONE] Error setting up microphone:', error);
      setMicrophoneState(MicrophoneState.Error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Microphone access denied. Please allow microphone access and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          setErrorMessage('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError') {
          setErrorMessage('Microphone is being used by another application.');
        } else {
          setErrorMessage(`Microphone setup failed: ${error.message}`);
        }
      } else {
        setErrorMessage('Unknown error occurred during microphone setup');
      }
    }
  }, [microphoneState]);

  const startMicrophone = useCallback(() => {
    if (microphone && microphoneState === MicrophoneState.Ready) {
      console.log('[MICROPHONE] Starting recording...');
      setMicrophoneState(MicrophoneState.Opening);
      try {
        microphone.start(100); // Send data every 100ms
      } catch (error) {
        console.error('[MICROPHONE] Error starting recording:', error);
        setMicrophoneState(MicrophoneState.Error);
        setErrorMessage('Failed to start recording');
      }
    } else {
      console.log('[MICROPHONE] Cannot start - microphone not ready. State:', microphoneState);
    }
  }, [microphone, microphoneState]);

  const stopMicrophone = useCallback(() => {
    if (microphone && microphoneState === MicrophoneState.Open) {
      console.log('[MICROPHONE] Stopping recording...');
      try {
        microphone.stop();
      } catch (error) {
        console.error('[MICROPHONE] Error stopping recording:', error);
      }
    }
  }, [microphone, microphoneState]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        microphoneState,
        setupMicrophone,
        startMicrophone,
        stopMicrophone,
        errorMessage,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

function useMicrophone(): MicrophoneContextType {
  const context = useContext(MicrophoneContext);
  if (context === undefined) {
    throw new Error(
      "useMicrophone must be used within a MicrophoneContextProvider"
    );
  }
  return context;
}

export {
  MicrophoneContextProvider,
  useMicrophone,
}; 