import React, { useEffect, useState, useMemo } from 'react';
import { checkSupabaseConnection, getSupabaseNotes, convertToPrismaFormat, supabase } from '../lib/supabase';
import { prisma, connectWithFallback } from '../lib/db';
import { FiCalendar, FiFileText, FiRefreshCw, FiChevronDown, FiChevronUp, FiEdit, FiCopy, FiZap, FiSend } from 'react-icons/fi';
import { formatSoapNote } from '../utils/formatSoapNote';
import { safeJsonParse, extractContent } from '../utils/safeJsonParse';
import Toast from './Toast';

// AIMagicModal component
interface AIMagicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (editRequest: string) => void;
  isLoading: boolean;
}

function AIMagicModal({ isOpen, onClose, onSubmit, isLoading }: AIMagicModalProps) {
  const [editRequest, setEditRequest] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">AI Magic Edit</h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Describe the changes you want to make to this SOAP note:
          </p>
          <textarea
            value={editRequest}
            onChange={(e) => setEditRequest(e.target.value)}
            className="w-full p-2 border rounded-md min-h-[100px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="E.g., Change the diagnosis from Depression to Undiagnosed mood disorder"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit(editRequest);
                setEditRequest('');
              }}
              disabled={isLoading || !editRequest.trim()}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Apply Magic'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Note {
  id: string;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  audioFileUrl: string | null;
  isInitialVisit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SupabasePatientNotesProps {
  patientId?: string;
  selectedNoteId?: string;
  onNoteSelect?: (note: Note) => void;
  forceCollapse?: boolean;
  refreshTrigger?: number; // Add refreshTrigger prop
}

/**
 * Component that uses Supabase for patient notes with SQLite fallback capability
 */
export default function SupabasePatientNotes({ 
  patientId, 
  selectedNoteId, 
  onNoteSelect,
  forceCollapse,
  refreshTrigger = 0 // Default to 0
}: SupabasePatientNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'sqlite'>('supabase');
  
  // Added state variables for Note functionality
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isAIMagicModalOpen, setIsAIMagicModalOpen] = useState<string | null>(null);
  const [isAIMagicLoading, setIsAIMagicLoading] = useState(false);

  // Initialize editableContent when notes change - use parsed content instead of raw content
  useEffect(() => {
    const contentMap: Record<string, string> = {};
    notes.forEach(note => {
      // Parse the content to make it readable and editable
      contentMap[note.id] = parseNoteContent(note.content);
    });
    setEditableContent(contentMap);
  }, [notes]);

  // Parse and format content functions
  const parseNoteContent = (content: string) => {
    try {
      const parsedContent = safeJsonParse<any>(content);
      if (!parsedContent) return content;
      
      // If it's the simple format with just content
      if (parsedContent.content) {
        return typeof parsedContent.content === 'string' 
          ? parsedContent.content 
          : JSON.stringify(parsedContent.content);
      }
      
      // If it's the complex SOAP format, combine all sections
      const sections = [];
      if (parsedContent.subjective) sections.push('Subjective:\n' + parsedContent.subjective);
      if (parsedContent.objective) sections.push('Objective:\n' + parsedContent.objective);
      if (parsedContent['mental status examination (mse):']) sections.push('Mental Status Examination:\n' + parsedContent['mental status examination (mse):']);
      if (parsedContent['assessment and plan:']) sections.push('Assessment and Plan:\n' + parsedContent['assessment and plan:']);
      if (parsedContent['therapy note:']) sections.push('Therapy Note:\n' + parsedContent['therapy note:']);
      return sections.join('\n\n');
    } catch (error) {
      console.error('Error parsing note content:', error, content);
      // Extract content more safely
      return extractContent(content);
    }
  };

  // Handle content change
  const handleContentChange = (noteId: string, value: string) => {
    setEditableContent(prev => ({
      ...prev,
      [noteId]: value
    }));
  };

  // Toggle editing for a note
  const toggleEditing = (noteId: string) => {
    setIsEditing(prev => {
      const isCurrentlyEditing = prev[noteId] || false;
      
      if (isCurrentlyEditing) {
        // If we're closing edit mode, save the changes
        handleSave(noteId);
      }
      
      return {
        ...prev,
        [noteId]: !isCurrentlyEditing
      };
    });
  };

  // Save edited content
  const handleSave = async (noteId: string) => {
    const editableText = editableContent[noteId];
    if (!editableText) return;
    
    try {
      // Format the edited text back to proper JSON structure that the API expects
      const formattedContent = formatSoapNote(editableText);
      
      // Create a content JSON string
      const contentJson = JSON.stringify({
        content: editableText,
        formattedContent
      });
      
      // First check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      let success = false;
      let updatedContent = contentJson;
      
      if (isSupabaseAvailable) {
        // Try to update the note directly in Supabase
        const { error } = await supabase
          .from('notes')
          .update({ 
            content: contentJson,
            updated_at: new Date().toISOString()
          })
          .eq('id', noteId);
          
        if (!error) {
          success = true;
        } else {
          console.error('Error updating note in Supabase:', error);
        }
      }
      
      // If Supabase failed or is not available, try the API
      if (!success) {
        // Make API call to save the note
        const response = await fetch(`/api/notes/${noteId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: contentJson }), // Send the properly formatted JSON content
        });
        
        if (!response.ok) {
          throw new Error('Failed to save note');
        }
        
        success = true;
      }
      
      if (success) {
        // Update the local note data with the new content
        setNotes(prev => 
          prev.map(note => 
            note.id === noteId ? { ...note, content: updatedContent } : note
          )
        );
        
        // Update the editable content with the parsed version
        setEditableContent(prev => ({
          ...prev,
          [noteId]: editableText
        }));
        
        // Show success toast
        setToast({ message: 'Note saved successfully', type: 'success' });
        
        // Update the editing state to exit edit mode
        setIsEditing(prev => ({
          ...prev,
          [noteId]: false
        }));
      }
    } catch (error) {
      console.error('Error saving note:', error);
      setToast({ message: 'Failed to save note', type: 'error' });
    }
  };

  // Copy note to clipboard
  const copyNoteToClipboard = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    const content = parseNoteContent(note.content);
    const formattedContent = formatSoapNote(content);
    
    // Create a temporary element with the formatted content
    const tempElement = document.createElement('div');
    tempElement.innerHTML = formattedContent;
    
    // Extract the text content from the HTML
    const plainText = tempElement.textContent || tempElement.innerText || '';
    
    navigator.clipboard.writeText(plainText).then(() => {
      // Show toast notification
      setToast({ message: 'Note copied!', type: 'success' });
    }).catch(err => {
      console.error('Failed to copy note:', err);
      setToast({ message: 'Failed to copy note', type: 'error' });
    });
  };

  // Send note to webhook
  const sendNoteWebhook = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    try {
      // Use the parsed content with markdown formatting
      const rawMarkdownNote = parseNoteContent(note.content);
      
      // Send webhook POST request
      const response = await fetch('https://woodlandpsychiatry.app.n8n.cloud/webhook/boredcertified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soapNote: rawMarkdownNote }),
      });
      
      if (!response.ok) throw new Error('Failed to send note');
      
      // Show success toast
      setToast({ message: 'Note shipped successfully!', type: 'success' });
    } catch (error) {
      console.error('Error sending note webhook:', error);
      setToast({ message: 'Failed to ship note', type: 'error' });
    }
  };

  // Handle AI Magic edits
  const handleAIMagicSubmit = async (noteId: string, editRequest: string) => {
    setIsAIMagicLoading(true);
    try {
      const response = await fetch(`/api/notes/${noteId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ editRequest }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || 'Failed to apply AI Magic edits');
      }
      
      const editedNote = await response.json();
      
      // Force refresh from the server to get the latest note
      const refreshResponse = await fetch(`/api/notes/${noteId}/edit`);
      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh note after edits');
      }
      
      const refreshedNote = await refreshResponse.json();
      
      // Update local state with the edited content
      setEditableContent(prev => ({
        ...prev,
        [noteId]: refreshedNote.content
      }));
      
      // Update notes array
      setNotes(prev => 
        prev.map(note => 
          note.id === noteId ? { ...note, content: refreshedNote.content } : note
        )
      );
      
      // Show success toast
      setToast({ message: 'SOAP note updated with AI Magic!', type: 'success' });
      
      // Close the modal
      setIsAIMagicModalOpen(null);
    } catch (error) {
      console.error('Error applying AI Magic edits:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to apply AI Magic edits',
        type: 'error'
      });
    } finally {
      setIsAIMagicLoading(false);
    }
  };

  useEffect(() => {
    async function loadNotes() {
      if (!patientId) {
        setNotes([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // First try Supabase
        const isSupabaseAvailable = await checkSupabaseConnection();
        
        if (isSupabaseAvailable) {
          // Get data from Supabase
          const supabaseNotes = await getSupabaseNotes(patientId);
          
          // Convert to Prisma format
          const formattedNotes = supabaseNotes
            .map(note => convertToPrismaFormat(note, 'note'))
            .filter(note => note !== null)
            .sort((a, b) => 
              (b as Note).createdAt.getTime() - (a as Note).createdAt.getTime()
            ) as Note[];
            
          setNotes(formattedNotes);
          setDataSource('supabase');
        } else {
          // No fallback to SQLite anymore - just show an error
          throw new Error('Supabase connection unavailable');
        }
      } catch (err) {
        console.error('Error loading notes:', err);
        setError('Unable to load notes. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }
    
    loadNotes();
  }, [patientId, refreshTrigger]); // Add refreshTrigger as a dependency
  

  // Function to load notes
  const loadNotes = async () => {
    if (!patientId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Check Supabase connection
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (isSupabaseAvailable) {
        // Get data from Supabase
        const supabaseNotes = await getSupabaseNotes(patientId);
        
        // Convert to Prisma format
        const formattedNotes = supabaseNotes
          .map(note => convertToPrismaFormat(note, 'note'))
          .filter(note => note !== null)
          .sort((a, b) => 
            (b as Note).createdAt.getTime() - (a as Note).createdAt.getTime()
          ) as Note[];
          
        setNotes(formattedNotes);
        setDataSource('supabase');
      } else {
        // No fallback to SQLite anymore - just show an error
        throw new Error('Supabase connection unavailable');
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setError('Unable to load notes. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading notes...</div>;
  if (error) return <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>;
  if (!patientId) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No patient selected</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
      {/* Refresh button */}
      <div className="flex justify-end mb-2">
        <button 
          type="button"
          onClick={() => loadNotes()}
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          title="Refresh notes"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {notes.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
            <FiFileText className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            No notes available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            This patient doesn't have any notes yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {notes.map(note => (
            <div 
              key={note.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${
                selectedNoteId === note.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
              }`}
              onClick={() => onNoteSelect && onNoteSelect(note)}
            >
              <div 
                className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 cursor-pointer relative"
                onClick={(e) => {
                  e.stopPropagation();
                  const detailsEl = e.currentTarget.nextElementSibling as HTMLDetailsElement;
                  if (detailsEl) detailsEl.open = !detailsEl.open;
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <FiCalendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {new Date(note.createdAt).toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    note.isInitialVisit 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {note.isInitialVisit ? 'Initial Visit' : 'Follow-up'}
                  </span>
                </div>
                
                <div className="mt-2 text-sm pr-8 text-gray-600 dark:text-gray-300 font-medium">
                  {note.summary || 'No summary available'}
                </div>
                
                <div className="absolute bottom-4 right-4 text-gray-500 dark:text-gray-400">
                  <FiChevronDown className="w-5 h-5" />
                </div>
              </div>
              
              <details open={selectedNoteId === note.id} className={`${forceCollapse ? '' : 'group'}`}>
                <summary className="hidden">
                  Expand note
                </summary>
                
                <div className="mt-4">
                  {/* Collapse button positioned at top-right of the details section */}
                  <div className="flex justify-end px-4 mb-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const detailsEl = e.currentTarget.closest('details') as HTMLDetailsElement;
                        if (detailsEl) detailsEl.open = false;
                      }}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      aria-label="Collapse note"
                    >
                      <FiChevronUp className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Action Buttons */}
                  <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center px-4">
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEditing(note.id);
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center transition transform hover:scale-105 active:scale-95"
                      >
                        <FiEdit className="mr-1" />
                        {isEditing[note.id] ? 'Save Changes' : 'Edit Note'}
                      </button>
                    </div>
                    <div className="flex items-center space-x-4 mt-3 sm:mt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAIMagicModalOpen(note.id);
                        }}
                        className="px-4 py-2 text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] flex items-center transition transform hover:scale-105 active:scale-95"
                      >
                        <FiZap className="mr-1 text-purple-500" />
                        <span className="font-semibold">AI Magic</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyNoteToClipboard(note.id);
                        }}
                        className="px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center transition transform hover:scale-105 active:scale-95"
                      >
                        <FiCopy className="mr-1" />
                        Copy Note
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendNoteWebhook(note.id);
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center transition transform hover:scale-105 active:scale-95"
                      >
                        <FiSend className="mr-1" />
                        Ship it
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                  
                  {/* Note Content */}
                  <div className="px-4 pb-4">
                    {isEditing[note.id] ? (
                      <textarea
                        value={editableContent[note.id] || ''}
                        onChange={(e) => handleContentChange(note.id, e.target.value)}
                        className="w-full min-h-[450px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 font-mono text-sm"
                      />
                    ) : (
                      <div className="prose dark:prose-invert max-w-none leading-relaxed text-base">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: formatSoapNote(parseNoteContent(note.content)) 
                          }} 
                          className="text-sm text-gray-700 dark:text-gray-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {note.audioFileUrl && (
                  <div className="px-4 pb-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                      Audio Recording
                    </div>
                    <audio controls className="w-full" src={note.audioFileUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                
                {/* AI Magic Modal for this note */}
                {isAIMagicModalOpen === note.id && (
                  <AIMagicModal
                    isOpen={true}
                    onClose={() => setIsAIMagicModalOpen(null)}
                    onSubmit={(editRequest) => handleAIMagicSubmit(note.id, editRequest)}
                    isLoading={isAIMagicLoading}
                  />
                )}
              </details>
            </div>
          ))}
        </div>
      )}
      
      {/* Toast notification */}
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
