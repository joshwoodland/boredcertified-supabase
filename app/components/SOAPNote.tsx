'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface SOAPNoteProps {
  note: {
    id: string;
    createdAt: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    isInitialVisit: boolean;
  };
  isLatest?: boolean;
  forceCollapse?: boolean;
}

export default function SOAPNote({ note, isLatest = false, forceCollapse = false }: SOAPNoteProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  // Reset expanded state when isLatest changes or when forceCollapse changes
  useEffect(() => {
    if (!isLatest) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isLatest, forceCollapse]);

  // Generate a summary from the assessment
  const summary = useMemo(() => {
    const sentences = note.assessment.split(/[.!?]+/).filter(Boolean);
    return sentences[0]?.trim() || 'No assessment available';
  }, [note.assessment]);

  const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' ' + new Date(note.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow transition-all duration-200 ${
        isLatest || isExpanded ? 'p-6' : 'p-4'
      }`}
    >
      {/* Header - Always visible */}
      <div 
        className={`flex items-start justify-between ${!isLatest && 'cursor-pointer'}`}
        onClick={() => !isLatest && setIsExpanded(!isExpanded)}
      >
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold dark:text-white">
              {note.isInitialVisit ? 'Initial Evaluation' : 'Follow Up'}
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              note.isInitialVisit
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {formattedDate}
            </span>
          </div>
          {!isLatest && !isExpanded && (
            <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
              {summary}
            </p>
          )}
        </div>
        {!isLatest && (
          <button
            className="ml-4 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label={isExpanded ? 'Collapse note' : 'Expand note'}
          >
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {(isLatest || isExpanded) && (
        <div className={`mt-4 space-y-6 ${isLatest ? '' : 'animate-slide-down'}`}>
          {/* Consent Statement */}
          <p className="text-gray-600 dark:text-gray-400 italic">
            Patient consented to the use of Lindy to record and transcribe notes during this visit.
          </p>

          {/* Subjective Section */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Subjective</h3>
            <div className="prose dark:prose-invert max-w-none">
              {note.subjective.split('\n').map((paragraph, i) => (
                <p key={i} className="text-gray-600 dark:text-gray-400">{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Objective Section */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Objective</h3>
            <div className="prose dark:prose-invert max-w-none">
              {note.objective.split('\n').map((paragraph, i) => (
                <p key={i} className="text-gray-600 dark:text-gray-400">{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Assessment Section */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Assessment</h3>
            <div className="prose dark:prose-invert max-w-none">
              {note.assessment.split('\n').map((paragraph, i) => (
                <p key={i} className="text-gray-600 dark:text-gray-400">{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Plan Section */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Plan</h3>
            <div className="prose dark:prose-invert max-w-none">
              {note.plan.split('\n').map((paragraph, i) => (
                <p key={i} className="text-gray-600 dark:text-gray-400">{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 