'use client';

import React, { useState } from 'react';
import MedicationTimelineModal from '@/app/components/MedicationTimelineModal';

export default function MedicationTimelineComparisonPage() {
  const [showTimelines, setShowTimelines] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            🏥 Medication Timeline Comparison
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Compare different approaches for handling overlapping medications
          </p>
        </div>

        {/* Demo Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Comparison Demo
          </h2>
          
          <div className="space-y-4">
            <button
              onClick={() => setShowTimelines(!showTimelines)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {showTimelines ? 'Close Timelines' : 'Show Both Versions'}
            </button>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Separated Version
            </h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Clear visual separation between medications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Easy individual medication tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Individual hover interactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">⚠</span>
                <span>Takes more vertical space</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Combined Version
            </h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Compact vertical layout</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Shows medication interactions clearly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Combined tooltip for overlapping meds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">⚠</span>
                <span>May be harder to track individual meds</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400">
          <p className="text-sm">
            Choose the version that best fits your workflow needs
          </p>
        </div>
      </div>

      {/* Medication Timeline Modals */}
      {showTimelines && (
        <>
          <MedicationTimelineModal
            open={true}
            onClose={() => setShowTimelines(false)}
            patientId="demo-patient-123"
            version="separated"
            className="mr-[470px]"
          />
          <MedicationTimelineModal
            open={true}
            onClose={() => setShowTimelines(false)}
            patientId="demo-patient-123"
            version="combined"
            className="ml-[470px]"
          />
        </>
      )}
    </div>
  );
} 