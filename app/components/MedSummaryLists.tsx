'use client';

import React from 'react';
import { MedicationSummary } from '@/app/lib/types';

interface MedSummaryListsProps {
  summaries: MedicationSummary[];
}

export default function MedSummaryLists({ summaries }: MedSummaryListsProps) {
  const active = summaries.filter(s => s.isActive);
  const discontinued = summaries.filter(s => !s.isActive);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="text-sm space-y-4 max-h-64 overflow-y-auto">
      {/* Active Medications */}
      <div>
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Active Medications
        </h3>
        {active.length > 0 ? (
          <ul className="space-y-1 pl-5">
            {active.map(med => (
              <li key={med.medId} className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">{med.medName}</span>
                {med.lastDoseMg && (
                  <span className="text-blue-600 dark:text-blue-400 ml-1">
                    ({med.lastDoseMg} mg)
                  </span>
                )}
                <span className="text-gray-500 dark:text-gray-400 ml-2">
                  — started {formatDate(med.lastChangeDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 pl-5 italic">
            No active medications
          </p>
        )}
      </div>

      {/* Discontinued Medications */}
      <div>
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
          <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
          Discontinued
        </h3>
        {discontinued.length > 0 ? (
          <ul className="space-y-1 pl-5">
            {discontinued.map(med => (
              <li key={med.medId} className="text-red-600 dark:text-red-400 line-through">
                <span className="font-medium">{med.medName}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2 no-underline">
                  — {med.stopReason || "reason unknown"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 pl-5 italic">
            No discontinued medications
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Total medications: {summaries.length}</span>
          <span>Active: {active.length} | Discontinued: {discontinued.length}</span>
        </div>
      </div>
    </div>
  );
} 