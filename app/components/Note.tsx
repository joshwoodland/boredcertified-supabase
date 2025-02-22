'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Note {
  id: string;
  createdAt: string;
  content: string;
  summary?: string;
  isInitialVisit: boolean;
}

interface NoteContent {
  content: string;
}

interface NoteProps {
  note: Note;
  isLatest?: boolean;
  forceCollapse?: boolean;
}

export default function Note({ note, isLatest = false, forceCollapse = false }: NoteProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState<string>('');

  const parsedContent = useMemo(() => {
    try {
      const content = JSON.parse(note.content) as NoteContent;
      return content.content;
    } catch {
      return note.content;
    }
  }, [note.content]);

  useEffect(() => {
    setEditableContent(parsedContent);
  }, [parsedContent]);

  useEffect(() => {
    if (!isLatest) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [isLatest, forceCollapse]);

  const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' ' + new Date(note.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });

  const handleContentChange = (value: string) => {
    setEditableContent(value);
  };

  const handleSave = async () => {
    // Here you would implement the save functionality
    setIsEditing(false);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow transition-all duration-200 ${
      isLatest || isExpanded ? 'p-8' : 'p-4'
    }`}>
      {/* Header */}
      <div className={`flex items-start justify-between ${!isLatest && 'cursor-pointer'}`}
        onClick={() => !isLatest && setIsExpanded(!isExpanded)}>
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
              {note.summary || 'Follow-up visit'}
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

      {/* Content */}
      {(isLatest || isExpanded) && (
        <div className="mt-8">
          {/* Edit Toggle */}
          {isLatest && (
            <div className="mb-6">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {isEditing ? 'Save Changes' : 'Edit Note'}
              </button>
            </div>
          )}

          {/* Note Content */}
          <div className="prose dark:prose-invert max-w-none">
            {isEditing ? (
              <textarea
                value={editableContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full min-h-[500px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
              />
            ) : (
              <div className="whitespace-pre-wrap">{parsedContent}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 