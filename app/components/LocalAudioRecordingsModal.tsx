'use client';

import { FiX } from 'react-icons/fi';
import LocalAudioRecordings from './LocalAudioRecordings';

interface LocalAudioRecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocalAudioRecordingsModal({ isOpen, onClose }: LocalAudioRecordingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Audio Storage Disabled</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
            type="button"
          >
            <FiX className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 p-3 mb-4 rounded-md text-sm">
            <p className="mb-1 font-medium">Audio Storage Functionality Removed</p>
            <p>Audio recording storage has been disabled. Transcription functionality remains available during recording sessions.</p>
          </div>
          
          <LocalAudioRecordings />
        </div>
      </div>
    </div>
  );
}
