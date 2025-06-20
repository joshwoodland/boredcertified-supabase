'use client';

import React, { useState } from 'react';
import MedicationTimelineModal from '@/app/components/MedicationTimelineModal';

export default function MedicationTimelineTestPage() {
  const [showTimeline, setShowTimeline] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🏥 Medication Timeline Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Interactive medication visualization with smart taper planning
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Demo Controls
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <button
                onClick={() => setShowTimeline(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Open Medication Timeline
              </button>
              
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                {showInstructions ? 'Hide' : 'Show'} Instructions
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                Test Data Includes:
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Sertraline 50→100→150mg (active)</li>
                <li>• Bupropion 150mg (discontinued)</li>
                <li>• Lorazepam 1mg (active)</li>
                <li>• PHQ-9/GAD-7 outcome markers</li>
                <li>• Guideline recommendations</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
              How to Test
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                  🎯 Basic Features
                </h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Hover over medication bars for details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Hover over dose change markers (circles)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Look for 🥳 outcome celebration markers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Notice amber tinting for high doses</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                  🎮 Advanced Features
                </h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Right-click any bar for Smart Taper plan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Try the Konami code: ↑↑↓↓←→←→BA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Watch for confetti on stable medications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Observe animated bar growth on load</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-yellow-800 dark:text-yellow-200">
                  <h4 className="font-medium">Note</h4>
                  <p className="mt-1 text-sm">
                    This demo uses mock data. In production, connect to your medication database API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Visual Timeline
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Medication periods with dose-dependent color intensity and guideline indicators
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3">💊</div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Smart Taper
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Right-click any medication for AI-generated taper schedules
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Celebrations
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Automatic detection and celebration of significant clinical improvements
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400">
          <p className="text-sm">
            Built with VisX, Framer Motion, and ❤️ for better clinical workflows
          </p>
        </div>
      </div>

      {/* Medication Timeline Modal */}
      <MedicationTimelineModal
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        patientId="demo-patient-123"
      />
    </div>
  );
} 