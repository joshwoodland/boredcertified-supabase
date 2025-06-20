"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";

interface MicrophoneContextType {
  microphone: MediaRecorder | null;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  setupMicrophone: () => void;
  resetToReady: () => void;
  microphoneState: MicrophoneState | null;
}

export enum MicrophoneEvents {
  DataAvailable = "dataavailable",
  Error = "error",
  Pause = "pause",
  Resume = "resume",
  Start = "start",
  Stop = "stop",
}

export enum MicrophoneState {
  NotSetup = -1,
  SettingUp = 0,
  Ready = 1,
  Opening = 2,
  Open = 3,
  Error = 4,
  Pausing = 5,
  Paused = 6,
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined
);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider = ({ children }: MicrophoneContextProviderProps) => {
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    MicrophoneState.NotSetup
  );
  const isSettingUpRef = useRef(false);

  const setupMicrophone = useCallback(async () => {
    console.log("[MICROPHONE CONTEXT] === SETUP MICROPHONE CALLED ===");
    console.log("[MICROPHONE CONTEXT] Current state:", microphoneState);
    console.log("[MICROPHONE CONTEXT] IsSettingUp ref:", isSettingUpRef.current);
    console.log("[MICROPHONE CONTEXT] Low echo cancellation always enabled for video calls");
    
    if (isSettingUpRef.current) {
      console.log("[MICROPHONE CONTEXT] Already setting up, returning early");
      return;
    }

    console.log("[MICROPHONE CONTEXT] Setting up microphone...");
    isSettingUpRef.current = true;
    setMicrophoneState(MicrophoneState.SettingUp);

    try {
      console.log("[MICROPHONE CONTEXT] Requesting user media...");
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false, // Always disabled for low echo cancellation (better for video calls)
          autoGainControl: true,
          noiseSuppression: true,
        },
      });

      console.log("[MICROPHONE CONTEXT] User media granted, creating MediaRecorder...");
      const microphone = new MediaRecorder(userMedia, {
        mimeType: "audio/webm",
      });

      console.log("[MICROPHONE CONTEXT] MediaRecorder created successfully");
      setMicrophone(microphone);
      setMicrophoneState(MicrophoneState.Ready);
      console.log("[MICROPHONE CONTEXT] Microphone setup successful - state set to Ready");
    } catch (error) {
      console.error("[MICROPHONE CONTEXT] Error setting up microphone:", error);
      
      // Log specific error types
      if (error instanceof DOMException) {
        console.error("[MICROPHONE CONTEXT] DOMException details:", {
          name: error.name,
          message: error.message,
          code: error.code
        });
        
        switch (error.name) {
          case 'NotAllowedError':
            console.error("[MICROPHONE CONTEXT] Microphone permission denied by user");
            break;
          case 'NotFoundError':
            console.error("[MICROPHONE CONTEXT] No microphone device found");
            break;
          case 'NotReadableError':
            console.error("[MICROPHONE CONTEXT] Microphone is already in use");
            break;
          default:
            console.error("[MICROPHONE CONTEXT] Unknown microphone error");
        }
      }
      
      setMicrophoneState(MicrophoneState.Error);
    } finally {
      // Reset the ref flag when setup is complete (success or failure)
      isSettingUpRef.current = false;
    }
  }, []); // No dependencies needed since we're hard-coding the behavior

  const startMicrophone = useCallback(() => {
    if (microphone && microphoneState === MicrophoneState.Ready) {
      // Use 250ms chunks like the official demo (instead of 100ms)
      microphone.start(250);
      setMicrophoneState(MicrophoneState.Open);
    }
  }, [microphone, microphoneState]);

  const stopMicrophone = useCallback(() => {
    if (microphone && microphoneState === MicrophoneState.Open) {
      microphone.stop();
      setMicrophoneState(MicrophoneState.Paused);
    }
  }, [microphone, microphoneState]);

  const resetToReady = useCallback(() => {
    if (microphoneState === MicrophoneState.Paused) {
      setMicrophoneState(MicrophoneState.Ready);
    }
  }, [microphoneState]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        startMicrophone,
        stopMicrophone,
        setupMicrophone,
        resetToReady,
        microphoneState,
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

export { MicrophoneContextProvider, useMicrophone }; 