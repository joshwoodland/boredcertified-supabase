'use client';

import { useState, useEffect } from 'react';

/**
 * This component displays an error message when the application detects
 * an attempt to use the deprecated NEXT_PUBLIC_DEEPGRAM_API_KEY pattern
 */
export default function DeepgramSecurityError() {
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    // Check if the deprecated pattern is being used
    if (typeof process !== 'undefined' && 
        process.env && 
        'NEXT_PUBLIC_DEEPGRAM_API_KEY' in process.env) {
      setShowError(true);
    }

    // Also listen for error events from the security check
    const handleSecurityViolation = (event: CustomEvent) => {
      setShowError(true);
    };

    // Add event listener for security violations
    window.addEventListener('deepgram-security-violation' as any, handleSecurityViolation);

    return () => {
      window.removeEventListener('deepgram-security-violation' as any, handleSecurityViolation);
    };
  }, []);

  if (!showError) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-red-50 dark:bg-red-900/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center mb-4">
          <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold ml-3 text-red-700 dark:text-red-400">Security Configuration Error</h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The application has detected an attempt to use <code className="bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_DEEPGRAM_API_KEY</code>, which is a security risk.
          </p>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This application is configured to use secure server-side API routes to interact with Deepgram. 
            Exposing API keys in client-side code is a security vulnerability.
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="font-medium">How to fix this issue:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1 ml-4">
              <li>Remove any <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_DEEPGRAM_API_KEY</code> from your environment variables</li>
              <li>Use only <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded font-mono">DEEPGRAM_API_KEY</code> (without the NEXT_PUBLIC_ prefix)</li>
              <li>Ensure your application is using the latest version of the codebase</li>
              <li>Clear your browser cache and reload the application</li>
            </ol>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={() => setShowError(false)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-sm"
          >
            Dismiss Warning
          </button>
        </div>
      </div>
    </div>
  );
}
