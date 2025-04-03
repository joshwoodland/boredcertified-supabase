'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiEdit, FiCopy } from 'react-icons/fi';
import { formatSoapNote } from '../utils/formatSoapNote';
import { safeJsonParse, extractContent } from '../utils/safeJsonParse';
import Toast from './Toast';

interface Note {
  id: string;
  createdAt: string;
  content: string;
  summary?: string | null;
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
  const [summary, setSummary] = useState<string | null>(note.summary ?? null);
  const [isFetchingSummary, setIsFetchingSummary] = useState<boolean>(false);
  const [showRawFormat, setShowRawFormat] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch summary if not available
  useEffect(() => {
    const fetchSummary = async () => {
      if (!note.summary && !isFetchingSummary) {
        setIsFetchingSummary(true);
        try {
          const response = await fetch(`/api/notes/${note.id}/summary`, {
            method: 'POST',
          });
          
          if (response.ok) {
            const data = await response.json();
            setSummary(data.summary);
          }
        } catch (error) {
          console.error('Error fetching summary:', error);
        } finally {
          setIsFetchingSummary(false);
        }
      }
    };

    fetchSummary();
  }, [note.id, note.summary, isFetchingSummary]);

  const parsedContent = useMemo(() => {
    try {
      const content = safeJsonParse<any>(note.content);
      if (!content) return note.content;
      
      // If it's the simple format with just content
      if (content.content) {
        return typeof content.content === 'string' ? content.content : JSON.stringify(content.content);
      }
      
      // If it's the complex SOAP format, combine all sections
      const sections = [];
      if (content.subjective) sections.push('Subjective:\n' + content.subjective);
      if (content.objective) sections.push('Objective:\n' + content.objective);
      if (content['mental status examination (mse):']) sections.push('Mental Status Examination:\n' + content['mental status examination (mse):']);
      if (content['assessment and plan:']) sections.push('Assessment and Plan:\n' + content['assessment and plan:']);
      if (content['therapy note:']) sections.push('Therapy Note:\n' + content['therapy note:']);
      return sections.join('\n\n');
    } catch (error) {
      console.error('Error parsing note content:', error, note.content);
      // Extract content more safely
      return extractContent(note.content);
    }
  }, [note.content]);

  // Format content with our custom formatter or use pre-formatted content if available
  const formattedContent = useMemo(() => {
    try {
      const content = safeJsonParse<any>(note.content);
      // If pre-formatted content is available, use it
      if (content && content.formattedContent) {
        return content.formattedContent;
      }
    } catch (error) {
      console.error('Error parsing note for formatted content:', error);
      // If parsing fails, continue to format the parsed content
    }
    
    // Otherwise format the parsed content
    return formatSoapNote(parsedContent);
  }, [parsedContent, note.content]);

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

  const copyNoteToClipboard = () => {
    // Create a temporary element with the formatted content
    const tempElement = document.createElement('div');
    tempElement.innerHTML = formattedContent;
    
    // Extract the text content from the HTML
    const plainText = tempElement.textContent || tempElement.innerText || '';
    
    navigator.clipboard.writeText(plainText).then(() => {
      // Show toast notification
      setToast({ message: 'Note copied!', type: 'success' });
      console.log('Note copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy note:', err);
      setToast({ message: 'Failed to copy note', type: 'error' });
    });
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
              {summary || note.summary || (isFetchingSummary ? 'Loading summary...' : 'Follow-up visit')}
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
          {/* Action Buttons */}
          <div className="mb-6 flex justify-between">
            <div>
              {isLatest && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <FiEdit className="mr-1" />
                  {isEditing ? 'Save Changes' : 'Edit Note'}
                </button>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowRawFormat(!showRawFormat)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                {showRawFormat ? 'Show Formatted' : 'Show Raw'}
              </button>
              <button
                onClick={copyNoteToClipboard}
                className="px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center"
              >
                <FiCopy className="mr-1" />
                Copy Note
              </button>
            </div>
          </div>

          {/* Note Content */}
          <div className="prose dark:prose-invert max-w-none">
            {isEditing ? (
              <textarea
                value={editableContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full min-h-[500px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
              />
            ) : showRawFormat ? (
              <div className="whitespace-pre-wrap">{parsedContent}</div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
            )}
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
} 