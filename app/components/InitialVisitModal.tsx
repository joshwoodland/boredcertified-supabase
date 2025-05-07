'use client';

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import { useAppSettings } from '../hooks/useAppSettings';
import RecoveryPrompt from './RecoveryPrompt';

const LiveTranscription = dynamic(
  () => import('./LiveTranscription'),
  { ssr: false }
);

interface InitialVisitModalProps {
  onRecordingComplete: (blob: Blob, transcript: string, isInitialEvaluation: boolean) => void;
  onClose: () => void;
  manualTranscript?: string; // Optional manual transcript for paste-in functionality
}

export default function InitialVisitModal({
  onRecordingComplete,
  onClose,
  manualTranscript
}: InitialVisitModalProps) {
  const { settings } = useAppSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!manualTranscript); // Start in edit mode if manual transcript is provided
  const [editableTranscript, setEditableTranscript] = useState(manualTranscript || '');
  const [visitType, setVisitType] = useState<'initial' | 'followup' | null>(null);

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
    sessionType: 'initial-visit',
    contextData: { visitType }
  });

  // Handle recovered transcript
  const onRecoverTranscript = useCallback((recoveredText: string) => {
    // Set up the recovered transcript for editing
    setEditableTranscript(recoveredText);
    setIsEditMode(true);

    // Try to recover visit type from session data
    if (recoverySession?.contextData?.visitType) {
      setVisitType(recoverySession.contextData.visitType);
    }

    // Create a placeholder audio blob
    audioBlob.current = new Blob([], { type: 'audio/wav' });

    // Clear the recovery session after applying it
    handleRecoverTranscript(recoveredText);
  }, [recoverySession, handleRecoverTranscript]);

  // Audio recording refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioBlob = useRef<Blob | null>(null);

  // Cleanup recording resources on unmount
  React.useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  const handleTranscriptUpdate = useCallback((newTranscript: string, isFinal: boolean) => {
    if (isFinal) {
      setFinalTranscript(prev => {
        const updatedTranscript = prev ? `${prev} ${newTranscript}` : newTranscript;
        return updatedTranscript.trim();
      });
    }

    setTranscript(newTranscript.trim());

    // Always ensure we're working with the most complete version of the transcript
    // This matches the implementation in AudioRecorder.tsx
    const completeTranscript = finalTranscript || newTranscript;
    // If we had a parent onTranscriptUpdate handler we'd use it here
  }, [finalTranscript]);

  // Add debug console log
  useEffect(() => {
    console.log('InitialVisitModal rendering:', {
      hasManualTranscript: !!manualTranscript,
      transcriptLength: manualTranscript?.length || 0,
    });
  }, [manualTranscript]);

  // Start recording function
  const startRecording = async (type: 'initial' | 'followup') => {
    try {
      // Log visit type selection
      console.log(`Visit type selected: ${type}`);
      
      // Set visit type
      setVisitType(type);

      // Reset state
      setError(null);
      setTranscript('');
      setFinalTranscript('');

      // Check if mediaDevices API is available
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not available in this browser or context');
      }

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');

      // Clean up if there was an error
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  // Stop recording function
  const stopRecording = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setIsRecording(false);

    // Create a minimal empty audio blob - we don't need to store audio
    const emptyBlob = new Blob([], { type: 'audio/wav' });
    audioBlob.current = emptyBlob;

    // Set the editable transcript and enter edit mode
    setEditableTranscript(finalTranscript || transcript);
    setIsEditMode(true);
  };

  // Function to generate SOAP note with edited transcript
  // Add warning before page close during recording
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  const generateSoapNote = () => {
    if (!editableTranscript.trim()) {
      setError('Transcript cannot be empty');
      return;
    }

    if (visitType === null) {
      setError('Visit type not selected');
      return;
    }

    // Clear recording session data when successfully submitting
    clearRecordingData();

    // Send the recording, edited transcript, and visit type to the parent component
    onRecordingComplete(
      audioBlob.current || new Blob([], { type: 'audio/wav' }),
      editableTranscript,
      visitType === 'initial'
    );

    // Automatically close the modal after submission
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto pt-20 pb-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-3xl mx-auto">
        {recoverySession && (
          <RecoveryPrompt
            savedSession={recoverySession}
            onRecover={onRecoverTranscript}
            onDiscard={handleDiscardRecovery}
          />
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">
            {!isRecording && !isEditMode
              ? "Select Visit Type"
              : isRecording
                ? "Recording in Progress"
                : manualTranscript
                  ? "Review Transcript and Select Visit Type"
                  : "Edit Transcript"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isEditMode ? (
          // Transcript edit mode
          <div className="my-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              {manualTranscript ? 'Review Transcript' : 'Edit Transcript'}
            </h3>
            <textarea
              value={editableTranscript}
              onChange={(e) => setEditableTranscript(e.target.value)}
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
              placeholder="Edit the transcript if needed..."
            />
            {visitType === null && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  Please select a visit type below before generating the SOAP note.
                </p>
              </div>
            )}
            {!visitType && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <button
                  onClick={() => setVisitType('initial')}
                  className={`flex flex-col items-center justify-center p-4 border-2 ${visitType === 'initial' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-blue-400'} rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}
                >
                  <span className="text-lg font-medium text-gray-800 dark:text-white">Initial Evaluation</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                    First time seeing this patient
                  </p>
                </button>

                <button
                  onClick={() => setVisitType('followup')}
                  className={`flex flex-col items-center justify-center p-4 border-2 ${visitType === 'followup' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-purple-400'} rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors`}
                >
                  <span className="text-lg font-medium text-gray-800 dark:text-white">Follow Up</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                    Have seen this patient before
                  </p>
                </button>
              </div>
            )}
          </div>
        ) : !isRecording ? (
          // Visit type selection
          <div className="py-4">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Please select the appropriate visit type for this recording:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => startRecording('initial')}
                className="flex flex-col items-center justify-center p-6 border-2 border-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-lg font-medium text-gray-800 dark:text-white">Initial Evaluation</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                  First time seeing this patient
                </p>
              </button>

              <button
                onClick={() => startRecording('followup')}
                className="flex flex-col items-center justify-center p-6 border-2 border-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                <span className="text-lg font-medium text-gray-800 dark:text-white">Follow Up</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                  Have seen this patient before
                </p>
              </button>
            </div>
          </div>
        ) : (
          // Recording in progress
          <div>
            <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <p className="text-red-600 dark:text-red-400 font-medium">
                  Recording in progress - speak clearly and at a normal pace
                </p>
              </div>
            </div>

            {/* Hidden transcript component - will still function but not be visible */}
            <div className="hidden">
              <LiveTranscription
                isRecording={isRecording}
                onTranscriptUpdate={handleTranscriptUpdate}
                lowEchoCancellation={settings?.lowEchoCancellation || false}
              />
            </div>

            {/* Placeholder for transcript UI */}
            <div className="mt-4 mb-6 w-full bg-gray-800 dark:bg-gray-800 p-6 rounded-2xl relative shadow-lg" style={{ height: '200px' }}>
              <p className="text-white">
                {transcript || 'Listening...'}
              </p>

              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-4">
          {isEditMode ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={generateSoapNote}
                disabled={!editableTranscript.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generate SOAP Note
              </button>
            </>
          ) : !isRecording ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
              </svg>
              Stop Recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
