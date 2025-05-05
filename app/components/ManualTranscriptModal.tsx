'use client';

import React, { useState } from "react";

interface ManualTranscriptModalProps {
  onTranscriptSubmit: (transcript: string, isInitialEvaluation: boolean) => void;
  onClose: () => void;
  selectedPatientId?: string;
}

export default function ManualTranscriptModal({ 
  onTranscriptSubmit,
  onClose,
  selectedPatientId
}: ManualTranscriptModalProps) {
  // Add debugging logs for patient ID
  console.log('DEBUG - ManualTranscriptModal received patientId:', {
    value: selectedPatientId,
    type: typeof selectedPatientId,
    length: selectedPatientId?.length,
    bytes: selectedPatientId ? Array.from(selectedPatientId).map(c => c.charCodeAt(0)) : null
  });
  
  const [visitType, setVisitType] = useState<'initial' | 'followup' | null>(null);
  const [showTextArea, setShowTextArea] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVisitTypeSelect = (type: 'initial' | 'followup') => {
    setVisitType(type);
    setShowTextArea(true);
  };

  const handleSubmit = () => {
    if (!selectedPatientId) {
      setError('Please select a patient first');
      return;
    }
    
    if (!transcript.trim()) {
      setError('Transcript cannot be empty');
      return;
    }
    
    if (visitType === null) {
      setError('Visit type not selected');
      return;
    }
    
    onTranscriptSubmit(transcript, visitType === 'initial');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto pt-20 pb-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">
            {!showTextArea ? "Select Visit Type" : "Enter Transcript"}
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

        {!selectedPatientId && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-600 dark:text-yellow-400 font-medium">
              No patient is selected. Please select a patient before continuing.
            </p>
          </div>
        )}

        {!showTextArea ? (
          // Visit type selection
          <div className="py-4">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This appears to be the first visit record in the system. Please select the appropriate visit type:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => handleVisitTypeSelect('initial')}
                className="flex flex-col items-center justify-center p-6 border-2 border-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                disabled={!selectedPatientId}
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
                onClick={() => handleVisitTypeSelect('followup')}
                className="flex flex-col items-center justify-center p-6 border-2 border-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                disabled={!selectedPatientId}
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
          // Transcript entry
          <div className="my-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Transcript Entry
            </h3>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
              placeholder="Paste or type the visit transcript here..."
              disabled={!selectedPatientId}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-4">
          {showTextArea ? (
            <>
              <button
                onClick={() => setShowTextArea(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!transcript.trim() || !selectedPatientId}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generate SOAP Note
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
