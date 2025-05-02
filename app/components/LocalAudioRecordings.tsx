/**
 * This component has been simplified as part of removing audio file storage functionality.
 * Transcription functionality is still preserved.
 */

import React from 'react';

export default function LocalAudioRecordings() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          Audio Storage Disabled
        </h2>
      </div>

      <div className="text-gray-500 dark:text-gray-400 text-center p-6">
        <p className="mb-4">
          Audio file storage functionality has been removed from this application.
        </p>
        <p>
          Transcription functionality is still fully available during recording sessions.
        </p>
      </div>
    </div>
  );
}
