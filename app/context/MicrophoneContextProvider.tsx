"use client";

import {
  createContext,
  useContext,
  useState,
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

  const setupMicrophone = async () => {
    if (microphoneState === MicrophoneState.SettingUp) {
      console.log('[MICROPHONE] Already setting up microphone...');
      return;
    }

    setMicrophoneState(MicrophoneState.SettingUp);

    try {
      console.log('[MICROPHONE] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      console.log('[MICROPHONE] Creating MediaRecorder...');
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

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
      });

      setMicrophone(recorder);
      setMicrophoneState(MicrophoneState.Ready);
      console.log('[MICROPHONE] Microphone setup complete');
    } catch (error) {
      console.error('[MICROPHONE] Error setting up microphone:', error);
      setMicrophoneState(MicrophoneState.Error);
    }
  };

  const startMicrophone = () => {
    if (microphone && microphoneState === MicrophoneState.Ready) {
      console.log('[MICROPHONE] Starting recording...');
      setMicrophoneState(MicrophoneState.Opening);
      microphone.start(100); // Send data every 100ms
    } else {
      console.log('[MICROPHONE] Cannot start - microphone not ready');
    }
  };

  const stopMicrophone = () => {
    if (microphone && microphoneState === MicrophoneState.Open) {
      console.log('[MICROPHONE] Stopping recording...');
      microphone.stop();
    }
  };

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        microphoneState,
        setupMicrophone,
        startMicrophone,
        stopMicrophone,
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