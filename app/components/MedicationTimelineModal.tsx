'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParentSize } from '@visx/responsive';
import TimelineChart from './TimelineChart';
import MedSummaryLists from './MedSummaryLists';
import { useMedicationTimeline } from '@/app/hooks/useMedicationTimeline';

interface MedicationTimelineModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  className?: string;
  version?: 'separated' | 'combined';
}

export default function MedicationTimelineModal({
  open,
  onClose,
  patientId,
  className = '',
  version = 'separated'
}: MedicationTimelineModalProps) {
  const { data, isLoading, error } = useMedicationTimeline(patientId);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 bg-black bg-opacity-60 flex items-start justify-start z-50 pt-4 pl-4 ${className}`}>
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg w-[450px] max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Medication timeline"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Medication Timeline
                {version === 'separated' ? ' (Separated)' : ' (Combined)'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {data ? `Patient ID: ${patientId}` : 'Loading...'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close timeline"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow flex flex-col gap-4 px-6 pb-6 overflow-hidden">
            {/* Loading State */}
            {isLoading && (
              <div className="flex-grow flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading timeline...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex-grow flex items-center justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Error loading timeline
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Loaded */}
            {data && !isLoading && !error && (
              <>
                {/* Chart Area */}
                <div className="flex-grow min-h-[280px] bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <ParentSize>
                    {({ width, height }) => (
                      <TimelineChart
                        width={width}
                        height={Math.max(height, 240)}
                        events={data.events}
                        outcomeMarkers={data.outcomeMarkers}
                        guidelines={data.guidelines}
                        appointmentDots={data.appointmentDots}
                        version={version}
                      />
                    )}
                  </ParentSize>
                </div>

                {/* Instructions */}
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-medium">How to use:</p>
                      <ul className="mt-1 space-y-1">
                        <li>• Hover over points for details</li>
                        <li>• 🥳 markers show significant improvements</li>
                        <li>• Amber segments exceed recommended doses</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Summary Lists */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <MedSummaryLists summaries={data.summaries} />
                </div>
              </>
            )}

            {/* Empty State */}
            {data && data.events.length === 0 && (
              <div className="flex-grow flex items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    No medication data
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No medication events found for this patient.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 