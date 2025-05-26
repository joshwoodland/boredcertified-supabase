'use client';

import React, { useEffect, useState, useCallback, useRef } from "react";
import { FollowUpItem, fetchFollowUps, getCategoryEmoji, getCategoryName } from "../utils/fetchFollowUps";
import dynamic from 'next/dynamic';
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import { useAppSettings } from '../providers/AppSettingsProvider';
import RecoveryPrompt from './RecoveryPrompt';
import LiveDeepgramRecorder, { LiveDeepgramRecorderRef } from './LiveDeepgramRecorder';
import { saveChecklistToCache, getChecklistFromCache, getMostRecentChecklist } from '../utils/checklistCache';
import { formatSoapNote } from '../utils/formatSoapNote';

interface FollowUpModalProps {
  lastVisitNote: string;
  patientId: string;
  noteId: string;
  onClose: () => void;
}

export default function FollowUpModal({
  lastVisitNote,
  patientId,
  noteId,
  onClose
}: FollowUpModalProps) {
  const { settings } = useAppSettings();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [itemPoints, setItemPoints] = useState<Record<string, number>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(''); // Current/interim transcript
  const [finalTranscript, setFinalTranscript] = useState(''); // Accumulated final transcript
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [preserveTranscript, setPreserveTranscript] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [isGeneratingSoapNote, setIsGeneratingSoapNote] = useState(false);
  const recorderRef = useRef<LiveDeepgramRecorderRef>(null);

  // Use the recording safeguard hook
  const {
    recoverySession,
    handleRecoverTranscript,
    handleDiscardRecovery,
    clearRecordingData
  } = useRecordingSafeguard({
    isRecording,
    transcript,
    finalTranscript,
    sessionType: 'follow-up',
    contextData: { lastVisitNote }
  });

  // Handle recovered transcript
  const onRecoverTranscript = useCallback((recoveredText: string) => {
    // Set up the recovered transcript for editing
    setEditableTranscript(recoveredText);
    setIsEditMode(true);

    // Clear the recovery session after applying it
    handleRecoverTranscript(recoveredText);
  }, [handleRecoverTranscript]);

  // Keep track of which keywords have been processed to avoid double-counting
  const processedKeywordsRef = useRef<Map<string, Set<string>>>(new Map());

  // Ref to track the last transcript length that was analyzed
  const lastAnalyzedLengthRef = useRef<number>(0);

  // Reference to track the previous transcript length when resuming recording
  const previousTranscriptLengthRef = useRef<number>(0);
  // Flag to indicate if we're in a resumed recording session
  const isResumedSessionRef = useRef<boolean>(false);

  // Add debugging info for the lastVisitNote
  useEffect(() => {
    console.log('FollowUpModal rendering with:', {
      hasLastVisitNote: !!lastVisitNote,
      noteLength: lastVisitNote?.length || 0,
      patientId,
      noteId
    });
  }, [lastVisitNote, patientId, noteId]);

  // Fetch follow-up items on mount
  useEffect(() => {
    async function loadFollowUpItems() {
      setLoading(true);

      // Log debugging info
      console.log('Loading follow-up items:', {
        hasLastVisitNote: !!lastVisitNote,
        noteLength: lastVisitNote?.length || 0,
        patientId,
        noteId
      });

      // First, try to get the checklist from cache
      let cachedItems = null;

      // Try to get the specific checklist for this note
      if (patientId && noteId) {
        cachedItems = getChecklistFromCache(patientId, noteId);
      }

      // If no specific checklist, try to get the most recent one for this patient
      if (!cachedItems && patientId) {
        cachedItems = getMostRecentChecklist(patientId);
      }

      // If we have cached items, use them
      if (cachedItems && cachedItems.length > 0) {
        console.log('Using cached checklist items');
        setItems(cachedItems);
        setLoading(false);
        return;
      }

      // Otherwise, fetch from API
      console.log('Fetching new checklist items from API');
      const fetchedItems = await fetchFollowUps(lastVisitNote);
      setItems(fetchedItems);

      // Save to cache if we have items and patient/note IDs
      if (fetchedItems.length > 0 && patientId && noteId) {
        saveChecklistToCache(patientId, noteId, fetchedItems);
      }

      setLoading(false);
    }
    loadFollowUpItems();
  }, [lastVisitNote, patientId, noteId]);

  /**
   * Helper function to check if a keyword appears as a whole word/phrase in text
   * This prevents matching parts of other words (e.g., "the" in "therapy")
   */
  const matchesWholeWord = useCallback((text: string, keyword: string): boolean => {
    // Skip boundary check for multi-word phrases or very short keywords (like "mg")
    if (keyword.includes(' ') || keyword.length <= 2) {
      return text.includes(keyword);
    }

    // Use word boundary regex for single words
    const regex = new RegExp(`\\b${keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  }, []);

  /**
   * Enhanced helper function to check if any variation of a word is present
   * Handles common word forms and endings
   */
  const matchesWordVariation = useCallback((text: string, keyword: string): boolean => {
    // Common word endings to check
    const commonEndings = ['s', 'es', 'ed', 'ing', 'er', 'ers'];

    // First check exact match with word boundaries
    if (matchesWholeWord(text, keyword)) {
      return true;
    }

    // For single words, check common variations
    if (!keyword.includes(' ') && keyword.length > 3) {
      // Try adding common endings
      for (const ending of commonEndings) {
        if (matchesWholeWord(text, `${keyword}${ending}`)) {
          return true;
        }
      }

      // Special case for 'ing' - if word ends with 'e', remove it before adding 'ing'
      if (keyword.endsWith('e') && keyword.length > 4) {
        const stemWord = keyword.slice(0, -1);
        if (matchesWholeWord(text, `${stemWord}ing`)) {
          return true;
        }
      }
    }

    return false;
  }, [matchesWholeWord]);

  // Handle transcript updates from LiveDeepgramRecorder
  const handleTranscriptUpdate = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
    setFinalTranscript(newTranscript);

    // Analyze transcript for keywords and update points
    const currentTranscriptLength = newTranscript.length;
    
    // Only analyze new content to avoid double-counting
    if (currentTranscriptLength > lastAnalyzedLengthRef.current) {
      const newContent = newTranscript.slice(lastAnalyzedLengthRef.current);
      
      // Process each item for keyword matches in the new content
      items.forEach(item => {
        if (!processedKeywordsRef.current.has(item.id)) {
          processedKeywordsRef.current.set(item.id, new Set());
        }
        
        const processedKeywords = processedKeywordsRef.current.get(item.id)!;
        
        item.keywords.forEach(keyword => {
          if (!processedKeywords.has(keyword) && matchesWordVariation(newContent.toLowerCase(), keyword.toLowerCase())) {
            // Mark this keyword as processed for this item
            processedKeywords.add(keyword);
            
            // Add points for this item
            setItemPoints(prev => ({
              ...prev,
              [item.id]: (prev[item.id] || 0) + 1
            }));
            
            // Auto-complete items that reach the threshold
            if ((itemPoints[item.id] || 0) + 1 >= item.threshold) {
              setCompletedIds(prev => [...prev.filter(id => id !== item.id), item.id]);
            }
          }
        });
      });
      
      lastAnalyzedLengthRef.current = currentTranscriptLength;
    }
  }, [items, itemPoints, matchesWordVariation]);

  // Handle recording completion from LiveDeepgramRecorder
  const handleRecordingComplete = useCallback((blob: Blob, transcriptText: string) => {
    setFinalTranscript(transcriptText);
    setEditableTranscript(transcriptText);
    setIsEditMode(true);
    setIsRecording(false);
  }, []);

  // Toggle item completion
  const toggleItem = (id: string) => {
    setCompletedIds(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  // Group items by category
  const getItemsByCategory = () => {
    const categories: Record<string, FollowUpItem[]> = {};
    
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    
    return Object.entries(categories).map(([category, categoryItems]) => ({
      category,
      items: categoryItems
    }));
  };

  // Function to go back to checklist from transcript edit mode
  const backToChecklist = () => {
    // Keep the transcript data but exit edit mode
    setIsEditMode(false);
    setPreserveTranscript(true);
  };

  // Function to generate SOAP note with edited transcript
  const generateSoapNote = async () => {
    if (!editableTranscript.trim()) {
      setError('Transcript cannot be empty');
      return;
    }

    // Clear recording session data when successfully submitting
    clearRecordingData();

    // Reset the preserve transcript flag
    setPreserveTranscript(false);

    // Set loading state
    setIsGeneratingSoapNote(true);

    try {
      // First check if this is an initial visit for the patient (it's not, since this is a follow-up modal)
      const isInitialVisit = false;

      // We already have the previous note from props
      const previousNote = lastVisitNote;

      // Get the patient's name for proper formatting in the note
      let patientName = "Patient";
      try {
        const patientResponse = await fetch(`/api/patients?id=${patientId}`);
        if (patientResponse.ok) {
          const patientData = await patientResponse.json();
          if (patientData && patientData.length > 0) {
            patientName = patientData[0].name;
          }
        }
      } catch (error) {
        console.warn('Error fetching patient name', error);
      }

      // Use the full transcript without deduplication
      const fullTranscript = editableTranscript;

      // Get the appropriate template based on visit type (follow-up)
      const soapTemplate = settings?.followUpVisitPrompt || 'S:\nO:\nA:\nP:';

      // Use the API endpoint with explicit visit type, patient name, and previous note
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          transcript: fullTranscript,
          useStructuredPrompt: true, // Always use the structured prompt approach
          isInitialEvaluation: isInitialVisit, // Explicitly pass visit type
          patientName: patientName, // Pass patient name for proper formatting
          previousNote: previousNote, // Pass the previous note for context
          soapTemplate: soapTemplate // Pass the appropriate template
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate SOAP note'
        );
      }

      // Process the generated note to ensure proper formatting
      const noteData = await response.json();

      // Ensure the note is formatted properly by formatting it explicitly if needed
      if (noteData && typeof noteData.content === 'string') {
        try {
          const formattedContent = formatSoapNote(noteData.content);
          noteData.content = formattedContent;
        } catch (formatError) {
          console.warn('Error formatting SOAP note:', formatError);
          // Continue with unformatted content if formatting fails
        }
      }

      console.log('SOAP note generated successfully');
      onClose();
    } catch (error) {
      console.error('Error generating SOAP note:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate SOAP note');
    } finally {
      setIsGeneratingSoapNote(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto pt-20 pb-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-3xl mx-auto">
        {recoverySession && (
          <RecoveryPrompt
            savedSession={recoverySession}
            onRecover={onRecoverTranscript}
            onDiscard={handleDiscardRecovery}
          />
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Session Follow-Up Checklist</h2>
          <div className="flex items-center">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3 flex items-center"
              title="About follow-up detection"
              onClick={() => document.getElementById('infoSection')?.classList.toggle('hidden')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div id="infoSection" className="hidden mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">About the Follow-Up Checklist</h4>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
            This checklist shows topics that need follow-up from the previous visit. The system automatically tracks how thoroughly each topic is discussed during your session.
          </p>

          <div className="flex flex-wrap gap-2 mb-2">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-700 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Not discussed</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Briefly mentioned</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Partially discussed</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-lime-100 dark:bg-lime-900/30 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Almost complete</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Fully addressed</span>
            </div>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            Topics change color as they are discussed more thoroughly. You can also manually toggle items by clicking on them.
          </p>
        </div>

        {isEditMode ? (
          // Transcript edit mode
          <div className="my-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Edit Transcript
            </h3>
            <textarea
              value={editableTranscript}
              onChange={(e) => setEditableTranscript(e.target.value)}
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
              placeholder="Edit the transcript if needed..."
            />
          </div>
        ) : isRecording ? (
          // Recording mode with custom UI
          <div className="my-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              Recording Session
            </h3>
            
            {/* Live transcript display */}
            {(transcript || finalTranscript) && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Live Transcription</h4>
                <div className={`text-gray-800 dark:text-gray-200 ${isRecording ? 'animate-pulse' : ''}`}>
                  {transcript || finalTranscript || "No transcription yet..."}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-4">Generating checklist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No follow-up items found from the previous visit.</p>
          </div>
        ) : (
          <div className="my-4 space-y-6">
            {getItemsByCategory().map(({ category, items }) => (
              <div key={category} className="space-y-2">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                  <span className="mr-2">{getCategoryEmoji(category)}</span>
                  <span>{getCategoryName(category)}</span>
                </h3>
                <div className="space-y-2">
                  {items.map((item) => {
                    // Special rendering for Clinical Expertise items
                    if (item.category === 'clinical-expertise') {
                      // Format the text to add emoji and color-coded severity levels
                      const formatExpertiseText = (text: string) => {
                        // Split the text into sections and lines
                        const parts = text.split(/\n\n/);

                        return parts.map((part, partIndex) => {
                          // Check if this is the drug interactions section
                          if (part.startsWith('Potential Drug Interactions:')) {
                            const lines = part.split('\n');
                            const header = lines[0];
                            const interactions = lines.slice(1);

                            return (
                              <div key={`part-${partIndex}`}>
                                <div className="font-medium mb-2">{header}</div>
                                {interactions.map((line, lineIndex) => {
                                  // Apply formatting only to drug interaction lines starting with a dash
                                  if (line.trim().startsWith('-')) {
                                    // We'll replace the dash with the alert emoji in the formatLine function

                                    // Tokenize and format the line
                                    const formatLine = (line: string) => {
                                      // Replace dash with emoji first
                                      line = line.replace(/^(\s*)-/, '$1🚨');

                                      // Split the line into tokens while preserving spaces
                                      const tokens = line.split(/(\s+)/);

                                      // Process each token
                                      const formattedTokens = tokens.map((token, i) => {
                                        if (token === 'Moderate') {
                                          return <span key={i} style={{color: '#f97316'}}>Moderate</span>;
                                        } else if (token === 'Mild') {
                                          return <span key={i} style={{color: '#eab308'}}>Mild</span>;
                                        } else if (token === 'Severe') {
                                          return <span key={i} style={{color: '#ef4444'}}>Severe</span>;
                                        }
                                        return token;
                                      });

                                      return (
                                        <div key={`line-${lineIndex}`} className="ml-2 mb-1">
                                          {formattedTokens}
                                        </div>
                                      );
                                    };

                                    return formatLine(line.trim());
                                  }

                                  // Return other lines as-is
                                  return <div key={`line-${lineIndex}`} className="ml-0 mb-1">{line}</div>;
                                })}
                              </div>
                            );
                          } else {
                            // For other sections (like Expert Tip), just render with normal formatting
                            return (
                              <div key={`part-${partIndex}`} className="mt-3">
                                {part.split('\n').map((line, lineIndex) => (
                                  <div key={`line-${lineIndex}`} className={lineIndex === 0 ? "font-medium mb-2" : "ml-2 mb-1"}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            );
                          }
                        });
                      };

                      return (
                        <div
                          key={item.id}
                          className="px-3 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-gray-200"
                        >
                          {formatExpertiseText(item.text)}
                        </div>
                      );
                    }

                    // Standard rendering for regular checklist items
                    const progress = itemPoints[item.id] || 0;
                    const isComplete = completedIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        /* Always use the color gradient, regardless of completion status */
                        className={`cursor-pointer px-3 py-2 rounded-lg transition-all flex items-start ${
                          progress === 0 ? 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200' :
                          progress < item.threshold ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                          progress < 2 * item.threshold ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          progress < 3 * item.threshold ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' :
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        }`}
                        title={`Discussion coverage: ${progress}/${item.threshold}`}
                      >
                        <div className="relative flex-shrink-0 mr-3">
                          {/* Circle indicator */}
                          <span className={`inline-block w-5 h-5 mt-0.5 rounded-full border
                            ${isComplete ? "border-green-500 dark:border-green-500" : "border-gray-400 dark:border-gray-500"}`}>
                            {/* Only show checkmark when complete */}
                            {isComplete && (
                              <svg className="w-5 h-5 text-green-500 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>

                          {/* Always show progress bar with appropriate fill */}
                          {progress > 0 && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"
                              style={{ width: '20px' }}
                            >
                              <div
                                className={`h-full ${
                                  progress < item.threshold ? "bg-orange-500" :
                                  progress < 2 * item.threshold ? "bg-yellow-500" :
                                  progress < 3 * item.threshold ? "bg-lime-500" : "bg-green-500"
                                }`}
                                style={{ width: `${progress / item.threshold * 100}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                        <span>{item.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Recording status indicator */}
        {isRecording && (
          <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Recording in progress - topics will be checked off as they are discussed
              </p>
            </div>
          </div>
        )}

        {/* Preserved transcript indicator */}
        {!isRecording && !isEditMode && preserveTranscript && (
          <div className="my-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                Transcript saved - click "Resume Recording" to continue from where you left off
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-4">
          {isEditMode ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={backToChecklist}
                className="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-500 dark:border-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Checklist
              </button>
              <button
                onClick={generateSoapNote}
                disabled={!editableTranscript.trim() || isGeneratingSoapNote}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                type="button"
              >
                {isGeneratingSoapNote ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating SOAP Note...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate SOAP Note
                  </>
                )}
              </button>
            </>
          ) : !isRecording ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              {preserveTranscript ? (
                <button
                  onClick={() => {
                    if (recorderRef.current?.canRecord) {
                      recorderRef.current.startRecording();
                      setIsRecording(true);
                      setPreserveTranscript(false);
                    }
                  }}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume Recording
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (recorderRef.current?.canRecord) {
                      recorderRef.current.startRecording();
                      setIsRecording(true);
                      setPreserveTranscript(false);
                    }
                  }}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Start Recording
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (recorderRef.current?.canStop) {
                    recorderRef.current.stopRecording();
                  }
                  setIsRecording(false);
                  setPreserveTranscript(false);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
                Stop Recording
              </button>
            </>
          )}

        {/* Hidden LiveDeepgramRecorder in headless mode */}
        <LiveDeepgramRecorder
          ref={recorderRef}
          onRecordingComplete={handleRecordingComplete}
          isProcessing={false}
          isRecordingFromModal={true}
          onTranscriptUpdate={handleTranscriptUpdate}
          headless={true}
        />
        </div>
      </div>
    </div>
  );
}
