'use client';

import React, { useState } from 'react';

interface IntakeFormModalProps {
  onSubmitIntakeForm: (intakeForm: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function IntakeFormModal({
  onSubmitIntakeForm,
  onSkip,
  onClose
}: IntakeFormModalProps) {
  const [showTextArea, setShowTextArea] = useState(false);
  const [intakeForm, setIntakeForm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddIntakeForm = () => {
    setShowTextArea(true);
    setError(null);
  };

  const handleSubmit = () => {
    if (!intakeForm.trim()) {
      setError('Please enter an intake form or click Skip');
      return;
    }
    
    onSubmitIntakeForm(intakeForm.trim());
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 overflow-auto p-4">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg w-full max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-gray-100">
            Add Intake Form Context
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!showTextArea ? (
          <div className="py-4">
            <div className="mb-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 text-center mb-2">
                No Intake Form Context Available
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                This is an initial evaluation visit. Would you like to paste in the patient's intake form, medical history, or other relevant background information to add greater context?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleAddIntakeForm}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 transition-colors font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Intake Form Context
              </button>
              
              <button
                onClick={handleSkip}
                className="flex items-center justify-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                Paste Intake Form Context
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Paste the patient's intake form, medical history, referral information, or other relevant background information below. This will help generate a more comprehensive initial evaluation note.
              </p>
              <textarea
                value={intakeForm}
                onChange={(e) => setIntakeForm(e.target.value)}
                className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-muted dark:border-gray-600 dark:text-white resize-none"
                placeholder="Paste intake form, medical history, referral information, or other relevant background information here..."
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowTextArea(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Skip
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={!intakeForm.trim()}
                className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 