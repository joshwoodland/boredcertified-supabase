'use client';

import { useState } from 'react';
import { FiSettings } from 'react-icons/fi';

export default function LindyTest() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <main className="min-h-screen p-6 flex flex-col dark:bg-gray-900 dark:text-white">
      <div className="flex-1 flex flex-col">
        <h1 className="text-2xl font-bold mb-6 text-center">Lindy Functionality Test</h1>
        
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Simulating Removed Components</h2>
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Open settings"
              >
                <FiSettings className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="border border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <h3 className="font-medium mb-2">OpenAIChat would be here</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  This component provides a direct interface to chat with the AI assistant.
                  It uses system messages configured in LindySettings for either Initial 
                  Evaluation or Follow-Up visits.
                </p>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="text-sm">Key features:</p>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                    <li>Text area to enter patient transcript</li>
                    <li>Visit type selection (Initial/Follow-Up)</li>
                    <li>Model selection (GPT-4o, GPT-4o-mini, Claude 3 Opus)</li>
                    <li>Sends transcript to OpenAI API with selected system message</li>
                    <li>Displays AI response</li>
                  </ul>
                </div>
              </div>
              
              <div className="border border-dashed border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <h3 className="font-medium mb-2">LindySettings would appear when clicking the settings icon</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  This component allows editing of the system messages used by the OpenAIChat component.
                </p>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="text-sm">Key features:</p>
                  <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                    <li>Edit Initial Evaluation system message</li>
                    <li>Edit Follow-Up Visit system message</li>
                    <li>Save settings to the server via /api/settings endpoint</li>
                    <li>Uses the same settings API as the main Settings component</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Functionality Impact</h3>
                <p className="text-yellow-700 dark:text-yellow-400">
                  If Lindy components were removed:
                </p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-yellow-700 dark:text-yellow-400">
                  <li>Users would lose the simplified chat interface for medical transcripts</li>
                  <li>The specialized settings for system messages would be handled solely by the main Settings component</li>
                  <li>The same system messages can still be edited through the main Settings interface</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold dark:text-white">Settings Would Be Here</h2>
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <title>Close</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">
                The LindySettings component would show here, allowing you to edit system messages for:
              </p>
              <ul className="list-disc list-inside">
                <li>Initial Evaluation system message</li>
                <li>Follow-Up Visit system message</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 mt-4">
                These settings are also accessible through the main Settings component in the main app.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by OpenAI API • {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
