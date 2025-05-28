'use client';

import React from 'react';
import { SavedRecordingSession } from '../utils/recordingSafeguard';

interface RecoveryPromptProps {
  savedSession: SavedRecordingSession;
  onRecover: (transcript: string) => void;
  onDiscard: () => void;
}

export default function RecoveryPrompt({ 
  savedSession, 
  onRecover, 
  onDiscard 
}: RecoveryPromptProps) {
  const { timestamp, transcript, sessionType } = savedSession;
  const formattedTime = new Date(timestamp).toLocaleTimeString();
  const wordCount = transcript.split(/\s+/).length;
  const minutesAgo = Math.round((Date.now() - timestamp) / 60000);
  
  // Get friendly name for session type
  const sessionName = 
    sessionType === 'initial-visit' ? 'Initial Evaluation' :
    sessionType === 'follow-up' ? 'Follow-Up Visit' : 'Recording';
  
  return (
    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-6 border-blue-200 dark:border-blue-800">
      <div className="flex items-center mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-blue-800 dark:text-blue-300">
            Recovered {sessionName} Data
          </h3>
          <p className="text-blue-700 dark:text-blue-400 text-sm">
            From {minutesAgo} {minutesAgo === 1 ? 'minute' : 'minutes'} ago ({formattedTime})
          </p>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-blue-700 dark:text-blue-400 text-sm font-medium">
            Recovered content:
          </span>
          <span className="text-blue-600 dark:text-blue-500 text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
            ~{wordCount} words
          </span>
        </div>
        <div className="max-h-32 overflow-y-auto bg-white dark:bg-gray-800 p-3 rounded border border-blue-200 dark:border-blue-800">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            {transcript.substring(0, 300)}
            {transcript.length > 300 ? '...' : ''}
          </p>
        </div>
      </div>
      
      <p className="text-blue-700 dark:text-blue-400 mb-4 text-sm">
        It looks like your {sessionName.toLowerCase()} was interrupted unexpectedly.
        Would you like to recover this transcript?
      </p>
      
      <div className="flex space-x-3">
        <button
          onClick={() => onRecover(transcript)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recover Transcript
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 border border-blue-600 text-blue-600 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
