import React, { useEffect, useState, useMemo } from 'react';
import { FiCalendar, FiRefreshCw, FiChevronDown, FiChevronUp, FiEdit, FiCopy, FiSend, FiTrash2 } from 'react-icons/fi';
import { LuWandSparkles } from 'react-icons/lu';
import { formatSoapNote, formatSoapNoteForCopy } from '../utils/formatSoapNote';
import { safeJsonParse, extractContent } from '../utils/safeJsonParse';
import Toast from './Toast';
import type { Note } from '../types/notes';
import AIMagicModal from './AIMagicModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface SupabasePatientNotesProps {
  patientId?: string;
  selectedNoteId?: string;
  onNoteSelect?: (note: Note) => void;
  forceCollapse?: boolean;
  refreshTrigger?: number;
  onDeleteNote?: (noteId: string) => void;
}

const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
};

/**
 * Component that uses Supabase for patient notes
 */
export default function SupabasePatientNotes({
  patientId,
  selectedNoteId,
  onNoteSelect,
  forceCollapse,
  refreshTrigger = 0,
  onDeleteNote
}: SupabasePatientNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAIMagicLoading, setIsAIMagicLoading] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string | null>>({});
  const [isFetchingSummary, setIsFetchingSummary] = useState<Record<string, boolean>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Initialize editedContent when selectedNote changes
  useEffect(() => {
    if (selectedNote) {
      setEditedContent(selectedNote.content);
    }
  }, [selectedNote]);

  const loadNotes = async () => {
    if (!patientId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    // Clear existing summaries when loading new notes
    setSummaries({});
    setIsFetchingSummary({});

    try {
      console.log(`Fetching notes for patient ID: ${patientId}`);

      // Use the API endpoint instead of direct Supabase access
      const response = await fetch(`/api/notes?patientId=${patientId}`, {
        // Ensure we're not getting a cached response
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        console.error(`Failed to fetch notes: ${response.status} ${response.statusText}, Details:`, errorDetails);
        throw new Error(`Failed to fetch notes: ${response.status}`);
      }

      const supabaseNotes = await response.json();
      console.log(`Retrieved ${supabaseNotes.length} notes from API`);

      // Notes are already in App format, just ensure dates are properly converted to Date objects
      const formattedNotes = supabaseNotes
        .map((note: Note) => {
          if (!note) {
            console.warn('Found null note in response');
            return null;
          }

          // Ensure dates are properly converted
          const createdAt = new Date(note.createdAt);
          const updatedAt = new Date(note.updatedAt);

          // Log the note for debugging
          console.log(`Processing note: ${note.id}, created: ${note.createdAt}, isInitialVisit: ${note.isInitialVisit}`);

          return {
            ...note,
            createdAt,
            updatedAt
          };
        })
        .filter((note: Note | null): note is Note => note !== null)
        .sort((a: Note, b: Note) => {
          const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt;
          const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : b.createdAt;
          return dateB.getTime() - dateA.getTime();
        });

      console.log(`Processed ${formattedNotes.length} valid notes`);
      setNotes(formattedNotes);

      // Extract summaries from the loaded notes and populate the summaries state
      const extractedSummaries: Record<string, string | null> = {};
      formattedNotes.forEach((note: Note) => {
        if (note.summary) {
          extractedSummaries[note.id] = note.summary;
        }
      });
      setSummaries(extractedSummaries);
      console.log(`Extracted ${Object.keys(extractedSummaries).length} existing summaries from notes`);

      // If there's a selectedNoteId, find and select that note
      if (selectedNoteId) {
        const selectedNote = formattedNotes.find((note: Note) => note.id === selectedNoteId);
        if (selectedNote) {
          setSelectedNote(selectedNote);
        }
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [patientId, refreshTrigger, selectedNoteId]);

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    onNoteSelect?.(note);
  };

  const handleEditClick = (note: Note) => {
    setSelectedNote(note);
    setEditedContent(note.content);
    setIsEditing(true);
  };

  const handleContentChange = (value: string) => {
    setEditedContent(value);
  };

  const handleSave = async (note: Note) => {
    if (!editedContent) return;

    try {
      // Format the content before saving
      const formattedContent = formatSoapNote(editedContent);

      // Create the content object with both raw and formatted content
      const contentToSave = JSON.stringify({
        content: editedContent,
        formattedContent
      });

      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentToSave,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      // Update the note in the list
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === note.id
            ? { ...n, content: contentToSave }
            : n
        )
      );

      // Update selected note
      setSelectedNote(prev =>
        prev?.id === note.id
          ? { ...prev, content: contentToSave }
          : prev
      );

      setIsEditing(false);
      setToastMessage('Note saved successfully');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('Error saving note:', error);
      setToastMessage('Failed to save note');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleCopy = (note: Note) => {
    // Format the note content for copying (removes markdown symbols, preserves formatting)
    const formattedText = formatSoapNoteForCopy(note.content);
    navigator.clipboard.writeText(formattedText).then(() => {
      setToastMessage('Note copied!');
      setToastType('success');
      setShowToast(true);
    }).catch(err => {
      console.error('Failed to copy note:', err);
      setToastMessage('Failed to copy note');
      setToastType('error');
      setShowToast(true);
    });
  };

  const handleAIMagicSubmit = async (noteId: string, editRequest: string) => {
    setIsAIMagicLoading(true);
    try {
      // Find the original note content
      const originalNote = notes.find(note => note.id === noteId);
      if (!originalNote) {
        throw new Error('Note not found');
      }

      // Extract the actual content from the note
      const originalContent = extractContent(originalNote.content);

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: originalContent,
          aiMagicRequest: editRequest,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply AI Magic edits');
      }

      const updatedNote = await response.json();

      // Update notes list
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === noteId
            ? { ...note, content: updatedNote.content }
            : note
        )
      );

      // Update selected note if it's the one being edited
      setSelectedNote(prev =>
        prev?.id === noteId
          ? { ...prev, content: updatedNote.content }
          : prev
      );

      setEditedContent(updatedNote.content);
      setToastMessage('SOAP note updated with AI Magic!');
      setToastType('success');
      setShowToast(true);
      setShowAIModal(false);
    } catch (error) {
      console.error('Error applying AI Magic edits:', error);
      setToastMessage(error instanceof Error ? error.message : 'Failed to apply AI Magic edits');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsAIMagicLoading(false);
    }
  };

  const handleSendWebhook = async (note: Note) => {
    try {
      const rawMarkdownNote = extractContent(note.content);

      const response = await fetch('https://woodlandpsychiatry.app.n8n.cloud/webhook/boredcertified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soapNote: rawMarkdownNote }),
      });

      if (!response.ok) throw new Error('Failed to send note');

      setToastMessage('Note shipped successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('Error sending note webhook:', error);
      setToastMessage('Failed to ship note');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteNote = (note: Note) => {
    if (!onDeleteNote) return;

    // Show the custom delete confirmation modal
    setNoteToDelete(note);
    setShowDeleteModal(true);
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete || !onDeleteNote) return;

    try {
      // Call the parent component's delete handler
      onDeleteNote(noteToDelete.id);

      // Remove the note from the local state
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteToDelete.id));

      // If the deleted note was selected, clear the selection
      if (selectedNote?.id === noteToDelete.id) {
        setSelectedNote(null);
      }

      setToastMessage('Note deleted successfully');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('Error deleting note:', error);
      setToastMessage('Failed to delete note');
      setToastType('error');
      setShowToast(true);
    } finally {
      // Close the modal and clear the note to delete
      setShowDeleteModal(false);
      setNoteToDelete(null);
    }
  };

  const cancelDeleteNote = () => {
    setShowDeleteModal(false);
    setNoteToDelete(null);
  };

  // Fetch summary for a note if not available
  const fetchNoteSummary = async (noteId: string) => {
    if (summaries[noteId] !== undefined || isFetchingSummary[noteId]) return;

    setIsFetchingSummary(prev => ({ ...prev, [noteId]: true }));
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSummaries(prev => ({ ...prev, [noteId]: data.summary }));
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummaries(prev => ({ ...prev, [noteId]: null }));
    } finally {
      setIsFetchingSummary(prev => ({ ...prev, [noteId]: false }));
    }
  };

  // Parse content for each note
  const getParsedContent = (noteContent: string) => {
    try {
      const content = safeJsonParse<any>(noteContent);
      if (!content) return noteContent;

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
      console.error('Error parsing note content:', error, noteContent);
      return extractContent(noteContent);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading notes...</div>;
  if (error) return <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>;
  if (!patientId) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No patient selected</div>;

  return (
    <div className="space-y-4">
      {/* Custom CSS for the gradient border and compact note styling */}
      <style jsx>{`
        .gradient-border {
          position: relative;
        }
        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 2px; /* Controls the border width */
          border-radius: 0.5rem; /* Match the rounded-lg class */
          background: conic-gradient(
            from 0deg at 50% 50%,
            #9333ea, /* Purple */
            #3b82f6, /* Blue */
            #9333ea, /* Purple */
            #3b82f6, /* Blue */
            #9333ea, /* Purple */
            #3b82f6, /* Blue */
            #9333ea, /* Purple */
            #3b82f6, /* Blue */
            #9333ea  /* Purple */
          );

          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 10;
        }

        /* Compact SOAP Note Styling */
        .compact-soap-note :global(p) {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .compact-soap-note :global(ul) {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
          padding-left: 1rem;
        }
        .compact-soap-note :global(li) {
          margin-top: 0;
          margin-bottom: 0;
          line-height: 1.2;
          padding-left: 0;
        }
        .compact-soap-note :global(br + br) {
          display: none;
        }
        .compact-soap-note :global(*) {
          line-height: 1.3;
        }

        /* Mono-column layout */
        .mono-column {
          max-width: 800px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .mono-column {
            width: 100%;
          }
        }
      `}</style>

      {notes.map((note) => {
        // Fetch summary if not available
        if (!summaries[note.id] && !isFetchingSummary[note.id]) {
          fetchNoteSummary(note.id);
        }

        return (
          <div
            key={note.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${
              selectedNote?.id === note.id ? 'gradient-border' : ''
            }`}
            onClick={() => handleNoteSelect(note)}
          >
            <details open={!isCollapsed && selectedNote?.id === note.id}>
              <summary className="flex items-center justify-between p-4 cursor-pointer">
                <div className="flex items-center">
                  <div className="pl-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(note.createdAt)}
                    </div>
                    <div className="text-xs">
                      {note.isInitialVisit ?
                        <span className="text-green-600 dark:text-green-400 font-medium">Initial Evaluation</span> :
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Follow-up Visit</span>
                      }
                    </div>
                    {/* Display summary when collapsed, regardless of selection state */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1 pr-4">
                      {summaries[note.id] || (isFetchingSummary[note.id] ? 'Loading summary...' : getParsedContent(note.content).split('\n')[0])}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {/* Always show expand/collapse indicator */}
                  <FiChevronDown className="text-gray-500 dark:text-gray-400" />
                </div>
              </summary>
              <div className="p-4 border-t dark:border-gray-700">
                {selectedNote?.id === note.id && (
                  <div className="flex items-center justify-end space-x-2 mb-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(note);
                      }}
                      className="p-2 flex items-center gap-2 transition transform hover:scale-105 active:scale-95"
                    >
                      <FiEdit className="text-purple-600 dark:text-purple-500 hover:drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]" />
                      <span className="text-purple-600 dark:text-purple-500">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(note);
                      }}
                      className="p-2 flex items-center gap-2 transition transform hover:scale-105 active:scale-95"
                    >
                      <FiCopy className="text-green-600 dark:text-green-500 hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      <span className="text-green-600 dark:text-green-500">Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAIModal(true);
                      }}
                      className="px-4 py-2 text-sm font-medium flex items-center transition transform hover:scale-105 active:scale-95"
                    >
                      <span className="inline-block mr-2">
                        <LuWandSparkles size={16} color="#a855f7" />
                      </span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                        AI Magic
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendWebhook(note);
                      }}
                      className="p-2 flex items-center gap-2 transition transform hover:scale-105 active:scale-95"
                    >
                      <FiSend className="text-blue-600 dark:text-blue-500 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      <span className="text-blue-600 dark:text-blue-500">Ship It</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note);
                      }}
                      className="p-2 transition transform hover:scale-105 active:scale-95"
                    >
                      <FiTrash2 className="text-red-600 dark:text-red-500 hover:drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
                    </button>
                  </div>
                )}

                {isEditing && selectedNote?.id === note.id ? (
                  <div className="space-y-4">
                    <textarea
                      value={editedContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="w-full min-h-[450px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(note)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none compact-soap-note mono-column">
                    <div dangerouslySetInnerHTML={{ __html: formatSoapNote(extractContent(note.content)) }} />
                  </div>
                )}
              </div>
            </details>
          </div>
        );
      })}

      {/* Toast notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      {/* AI Magic Modal */}
      {showAIModal && selectedNote && (
        <AIMagicModal
          isOpen={true}
          onClose={() => setShowAIModal(false)}
          onSubmit={(editRequest) => handleAIMagicSubmit(selectedNote.id, editRequest)}
          isLoading={isAIMagicLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && noteToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          onConfirm={confirmDeleteNote}
          onCancel={cancelDeleteNote}
          noteDate={formatDate(noteToDelete.createdAt)}
        />
      )}
    </div>
  );
}
