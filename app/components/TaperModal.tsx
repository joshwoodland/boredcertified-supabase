'use client';

import React, { useState, useCallback } from 'react';
import { MedicationSpan } from '@/app/lib/types';
import { computeTaper, renderMarkdownTable } from '@/app/utils/medicationUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface TaperModalProps {
  span: MedicationSpan | null;
  open: boolean;
  onClose: () => void;
}

export default function TaperModal({ span, open, onClose }: TaperModalProps) {
  const [reductionPercent, setReductionPercent] = useState(25);
  const [intervalWeeks, setIntervalWeeks] = useState(2);
  const [copySuccess, setCopySuccess] = useState(false);

  const plan = span ? computeTaper(span, { reductionPercent, intervalWeeks }) : [];
  const mdPlan = renderMarkdownTable(plan);

  const handleCopyToNote = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mdPlan);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [mdPlan]);

  const handleClose = useCallback(() => {
    setCopySuccess(false);
    onClose();
  }, [onClose]);

  if (!open || !span) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Taper plan"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Smart Taper Plan
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {span.medName} ({span.doseMg} mg)
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reduction %
              </label>
              <select
                value={reductionPercent}
                onChange={(e) => setReductionPercent(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10% (conservative)</option>
                <option value={25}>25% (standard)</option>
                <option value={50}>50% (aggressive)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interval (weeks)
              </label>
              <select
                value={intervalWeeks}
                onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1 week</option>
                <option value={2}>2 weeks</option>
                <option value={4}>4 weeks</option>
              </select>
            </div>
          </div>

          {/* Plan Preview */}
          <div className="flex-grow overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Taper Schedule
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {plan.length - 1} steps over ~{plan.length > 1 ? (plan[plan.length - 1].weekNumber) : 0} weeks
                </span>
              </div>
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                {mdPlan}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ⚠️ This is a suggested plan. Always consult with prescribing physician.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleCopyToNote}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {copySuccess ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Copy to Note
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 