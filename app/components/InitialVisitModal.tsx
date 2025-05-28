'use client';

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import { useAppSettings } from '../providers/AppSettingsProvider';
import RecoveryPrompt from './RecoveryPrompt';
import LiveDeepgramRecorder, { LiveDeepgramRecorderRef } from './LiveDeepgramRecorder';
import PreviousNoteModal from './PreviousNoteModal';

interface InitialVisitModalProps {
  onRecordingComplete: (blob: Blob, transcript: string, isInitialEvaluation: boolean) => void;
  onClose: () => void;
  manualTranscript?: string; // Optional manual transcript for paste-in functionality
  patientId?: string; // Patient ID for recovery session matching
  hasPreviousNotes?: boolean; // Whether the patient has previous notes
  onFollowUpWithPreviousNote?: (previousNote: string) => void; // Callback when user provides a previous note for follow-up
}

export default function InitialVisitModal({
  onRecordingComplete,
  onClose,
  manualTranscript,
  patientId,
  hasPreviousNotes = false,
  onFollowUpWithPreviousNote
}: InitialVisitModalProps) {
  const { settings } = useAppSettings();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(!!manualTranscript); // Start in edit mode if manual transcript is provided
  const [editableTranscript, setEditableTranscript] = useState(manualTranscript || '');
  const [visitType, setVisitType] = useState<'initial' | 'followup' | null>(null);
  const [recorderStatus, setRecorderStatus] = useState('Initializing...');
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(true);
  const [showPreviousNoteModal, setShowPreviousNoteModal] = useState(false);
  const recorderRef = useRef<LiveDeepgramRecorderRef>(null);

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
    contextData: { visitType, patientId },
    patientId
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

    // Clear the recovery session after applying it
    handleRecoverTranscript(recoveredText);
  }, [recoverySession, handleRecoverTranscript]);

  // Add debug console log
  useEffect(() => {
    console.log('InitialVisitModal rendering:', {
      hasManualTranscript: !!manualTranscript,
      transcriptLength: manualTranscript?.length || 0,
      hasPreviousNotes,
    });
  }, [manualTranscript, hasPreviousNotes]);

  // Handle transcript updates from LiveDeepgramRecorder
  const handleTranscriptUpdate = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
    setFinalTranscript(newTranscript);
  }, []);

  // Handle recording completion from LiveDeepgramRecorder
  const handleRecordingComplete = useCallback((blob: Blob, transcriptText: string) => {
    setFinalTranscript(transcriptText);
    setEditableTranscript(transcriptText);
    setIsEditMode(true);
    setIsRecording(false);
  }, []);

  // Start recording function
  const startRecording = async (type: 'initial' | 'followup') => {
    try {
      // Log visit type selection
      console.log(`Visit type selected: ${type}`);

      // If follow-up is selected but there are no previous notes, show the previous note modal
      if (type === 'followup' && !hasPreviousNotes) {
        setShowPreviousNoteModal(true);
        return;
      }

      // Set visit type
      setVisitType(type);

      // Hide recovery prompt when user selects a visit type (indicates they're not recovering)
      setShowRecoveryPrompt(false);

      // Reset state
      setError(null);
      setTranscript('');
      setFinalTranscript('');

      // Start recording using the ref
      if (recorderRef.current?.canRecord) {
        recorderRef.current.startRecording();
        setIsRecording(true);
      } else {
        setError('Recorder not ready. Please wait and try again.');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };

  // Handle follow-up button click in edit mode
  const handleFollowUpClick = () => {
    if (!hasPreviousNotes) {
      setShowPreviousNoteModal(true);
    } else {
      setVisitType('followup');
    }
  };

  // Handle previous note submission
  const handlePreviousNoteSubmit = (previousNote: string) => {
    setShowPreviousNoteModal(false);
    if (onFollowUpWithPreviousNote) {
      onFollowUpWithPreviousNote(previousNote);
    }
    onClose();
  };

  // Handle skipping previous note
  const handleSkipPreviousNote = () => {
    setShowPreviousNoteModal(false);
    // Proceed with follow-up without previous note context
    setVisitType('followup');
  };

  // Stop recording function
  const stopRecording = () => {
    if (recorderRef.current?.canStop) {
      recorderRef.current.stopRecording();
    }
  };

  // Function to generate SOAP note with edited transcript
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
      new Blob([], { type: 'audio/wav' }),
      editableTranscript,
      visitType === 'initial'
    );

    // Automatically close the modal after submission
    onClose();
  };

  // If showing previous note modal, render it instead
  if (showPreviousNoteModal) {
    return (
      <PreviousNoteModal
        onSubmitNote={handlePreviousNoteSubmit}
        onSkip={handleSkipPreviousNote}
        onClose={() => setShowPreviousNoteModal(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto pt-20 pb-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-3xl mx-auto">
        {recoverySession && showRecoveryPrompt && (
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
                  onClick={handleFollowUpClick}
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
        ) : isRecording ? (
          // Recording mode with custom UI
          <div className="my-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Recording Session
            </h3>
            


            {/* Transcript Display */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Live Transcription</h4>
              <div className={`text-gray-800 dark:text-gray-200 ${isRecording ? 'animate-pulse' : ''}`}>
                {transcript || finalTranscript || "Hello? Can you hear me?"}
              </div>
            </div>
          </div>
        ) : (
          // Visit type selection
          <div className="py-4">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Please select the appropriate visit type for this recording:
            </p>
            

            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => startRecording('initial')}
                disabled={!recorderRef.current?.canRecord}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-colors ${
                  recorderRef.current?.canRecord 
                    ? 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer' 
                    : 'border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${recorderRef.current?.canRecord ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className={`text-lg font-medium ${recorderRef.current?.canRecord ? 'text-gray-800 dark:text-white' : 'text-gray-500'}`}>Initial Evaluation</span>
                <p className={`text-sm text-center mt-2 ${recorderRef.current?.canRecord ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400'}`}>
                  First time seeing this patient
                </p>
              </button>

              <button
                onClick={() => startRecording('followup')}
                disabled={!recorderRef.current?.canRecord}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-colors ${
                  recorderRef.current?.canRecord 
                    ? 'border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer' 
                    : 'border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 mb-4 ${recorderRef.current?.canRecord ? 'text-purple-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                <span className={`text-lg font-medium ${recorderRef.current?.canRecord ? 'text-gray-800 dark:text-white' : 'text-gray-500'}`}>Follow Up</span>
                <p className={`text-sm text-center mt-2 ${recorderRef.current?.canRecord ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400'}`}>
                  Have seen this patient before
                </p>
              </button>
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

        {/* Hidden LiveDeepgramRecorder in headless mode */}
        <LiveDeepgramRecorder
          ref={recorderRef}
          onRecordingComplete={handleRecordingComplete}
          isProcessing={false}
          isRecordingFromModal={true}
          onTranscriptUpdate={handleTranscriptUpdate}
          headless={true}
          onStatusChange={setRecorderStatus}
          onRecordingStateChange={setIsRecording}
          onErrorChange={setError}
        />
        </div>
      </div>
    </div>
  );
}
