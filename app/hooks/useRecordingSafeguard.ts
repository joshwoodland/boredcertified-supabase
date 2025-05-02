'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  saveTranscriptCheckpoint, 
  updateHeartbeat,
  getExistingSession,
  hasInterruptedSession,
  clearRecordingSession,
  setupStorageCleanupPolicy,
  RecordingSessionType,
  SavedRecordingSession
} from '../utils/recordingSafeguard';

interface RecordingSafeguardOptions {
  isRecording: boolean;
  transcript: string;
  finalTranscript: string;
  sessionType: RecordingSessionType;
  contextData?: any;
}

export function useRecordingSafeguard({
  isRecording,
  transcript,
  finalTranscript,
  sessionType,
  contextData
}: RecordingSafeguardOptions) {
  const [recoverySession, setRecoverySession] = useState<SavedRecordingSession | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  
  // Check for interrupted sessions on mount
  useEffect(() => {
    if (hasInterruptedSession()) {
      const session = getExistingSession();
      // Only show recovery for matching session type
      if (session?.sessionType === sessionType) {
        setRecoverySession(session);
      }
    }
    
    // Set up storage cleanup policy
    const cleanup = setupStorageCleanupPolicy();
    return cleanup;
  }, [sessionType]);
  
  // Set up periodic saving and heartbeat
  useEffect(() => {
    if (isRecording) {
      // Adaptive checkpoint interval based on transcript changes
      let lastStoredTranscript = '';
      let checkpointInterval = 5000; // Start with 5 seconds
      
      const saveInterval = setInterval(() => {
        const currentTranscript = finalTranscript || transcript;
        
        // If transcript hasn't changed, gradually increase interval (up to 15 seconds)
        if (currentTranscript === lastStoredTranscript) {
          checkpointInterval = Math.min(checkpointInterval * 1.2, 15000);
        } else {
          // Reset to more frequent interval when transcript changes
          checkpointInterval = 5000;
          
          if (currentTranscript) {
            saveTranscriptCheckpoint(currentTranscript, sessionType, contextData);
            setLastBackupTime(Date.now());
            lastStoredTranscript = currentTranscript;
          }
        }
      }, checkpointInterval);
      
      // Heartbeat - more frequent to detect interruptions quickly
      const heartbeatInterval = setInterval(updateHeartbeat, 1000);
      
      // Warning before page close
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        clearInterval(saveInterval);
        clearInterval(heartbeatInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isRecording, transcript, finalTranscript, sessionType, contextData]);
  
  // Handle recovery actions
  const handleRecoverTranscript = useCallback((recoveredText: string) => {
    setRecoverySession(null);
    return recoveredText;
  }, []);
  
  const handleDiscardRecovery = useCallback(() => {
    clearRecordingSession();
    setRecoverySession(null);
  }, []);
  
  return {
    recoverySession,
    lastBackupTime,
    handleRecoverTranscript,
    handleDiscardRecovery,
    clearRecordingData: clearRecordingSession
  };
}
