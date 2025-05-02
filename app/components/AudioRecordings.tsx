import React from 'react';
import { FiX } from 'react-icons/fi';

interface AudioRecordingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioRecordings({ isOpen, onClose }: AudioRecordingsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-xl font-semibold dark:text-white">Audio Recordings</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
            type="button"
          >
            <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              <p className="mb-4">Audio recording storage has been disabled.</p>
              <p>Transcription functionality is still available during recording sessions.</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
