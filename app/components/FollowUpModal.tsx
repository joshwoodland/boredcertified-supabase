'use client';

import React, { useEffect, useState, useCallback, useRef } from "react";
import { FollowUpItem, fetchFollowUps, getCategoryEmoji, getCategoryName } from "../utils/fetchFollowUps";
import dynamic from 'next/dynamic';
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import { useAppSettings } from '../hooks/useAppSettings';
import RecoveryPrompt from './RecoveryPrompt';
import { saveChecklistToCache, getChecklistFromCache, getMostRecentChecklist } from '../utils/checklistCache';

const LiveTranscription = dynamic(
  () => import('./LiveTranscription'),
  { ssr: false }
);

interface FollowUpModalProps {
  lastVisitNote: string;
  patientId: string;
  noteId: string;
  onRecordingComplete: (blob: Blob, transcript: string) => void;
  onClose: () => void;
}

export default function FollowUpModal({
  lastVisitNote,
  patientId,
  noteId,
  onRecordingComplete,
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
  // Removed unused isProcessing state
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [preserveTranscript, setPreserveTranscript] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState('');

  // Use the recording safeguard hook
  const {
    recoverySession,
    // lastBackupTime not used but available from the hook
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

    // Create a placeholder audio blob
    audioBlob.current = new Blob([], { type: 'audio/wav' });

    // Clear the recovery session after applying it
    handleRecoverTranscript(recoveredText);
  }, [handleRecoverTranscript]);

  // Audio recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  // Removed unused refs: mediaRecorderRef, chunksRef
  const audioBlob = useRef<Blob | null>(null);

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

  // Cleanup recording resources on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

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

  /**
   * Get the appropriate background color class based on points accumulated
   */
  const getCompletionColor = useCallback((item: FollowUpItem) => {
    const points = itemPoints[item.id] || 0;
    const threshold = item.threshold || 4; // Default threshold if not specified

    // Calculate percentage of completion
    const percentage = Math.min(points / threshold, 1);

    // No discussion yet - default state
    if (points === 0) return 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200';

    if (percentage < 0.33) {
      // Early discussion (orange)
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    } else if (percentage < 0.66) {
      // Moderate discussion (yellow/gold)
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    } else if (percentage < 1) {
      // Substantial discussion (light green)
      return 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300';
    } else {
      // Fully discussed (full green)
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
  }, [itemPoints]);

  /**
   * Get item progress percentage
   */
  const getItemProgress = useCallback((item: FollowUpItem) => {
    const points = itemPoints[item.id] || 0;
    const threshold = item.threshold || 4;
    return Math.min(Math.round((points / threshold) * 100), 100);
  }, [itemPoints]);

  /**
   * Analyze transcript for keywords and update points
   * This runs on every transcript update
   */
  useEffect(() => {
    // Only run when we have items and transcript
    if (!transcript || transcript.length === 0 || items.length === 0 || !isRecording) return;

    // Analyze the full transcript every time
    const transcriptLower = transcript.toLowerCase();

    // Create a new points object based on the existing one
    const newItemPoints = { ...itemPoints };

    // For each item, check for keywords in the transcript
    items.forEach((item) => {
      // Track keywords we've detected
      const detectedKeywords = new Set<string>();

      // Get or initialize the processed keywords set for this item
      if (!processedKeywordsRef.current.has(item.id)) {
        processedKeywordsRef.current.set(item.id, new Set<string>());
      }
      const processedKeywords = processedKeywordsRef.current.get(item.id)!;

      // Process keywords for all categories
      if (item.keywords) {
        item.keywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase();

          // Skip very common words that might cause false positives
          if (['the', 'and', 'that', 'with', 'for', 'this', 'patient'].includes(keywordLower)) {
            return;
          }

          // Only process keywords we haven't seen before in this session
          if (!processedKeywords.has(keywordLower) && matchesWordVariation(transcriptLower, keywordLower)) {
            // Add to detected and processed sets
            detectedKeywords.add(keywordLower);
            processedKeywords.add(keywordLower);

            // Calculate point value
            let pointValue: number;

            // Count how many keywords we've already processed for this item
            const processedCount = processedKeywords.size;

            // Apply diminishing returns based on how many keywords we've seen
            if (processedCount <= 1) {
              // First keyword
              pointValue = 0.5;
            } else if (processedCount <= 3) {
              // 2-3 keywords
              pointValue = 0.25;
            } else {
              // 4+ keywords
              pointValue = 0.125;
            }

            // Extra points for important keywords (first few in the list)
            if (item.keywords.indexOf(keyword) < 5) {
              pointValue += 0.2;
            }

            // Add points to this item
            newItemPoints[item.id] = (newItemPoints[item.id] || 0) + pointValue;
          }
        });
      }

      // Add diversity bonus if we detected multiple new keywords
      if (detectedKeywords.size >= 3) {
        const diversityBonus = Math.min(1, (detectedKeywords.size - 2) * 0.5);
        newItemPoints[item.id] = (newItemPoints[item.id] || 0) + diversityBonus;
      }
    });

    // Update the points state
    setItemPoints(newItemPoints);

    // Update completed ids based on thresholds
    const newCompletedIds = Object.entries(newItemPoints)
      .filter(([id, points]) => {
        const item = items.find(i => i.id === id);
        return item && points >= item.threshold;
      })
      .map(([id]) => id);

    setCompletedIds(newCompletedIds);

    // Update the last analyzed length
    lastAnalyzedLengthRef.current = transcript.length;
  }, [transcript, items, matchesWordVariation, itemPoints]);

  // Handle transcript updates from the LiveTranscription component
  const handleTranscriptUpdate = useCallback((newTranscript: string, isFinal: boolean) => {
    // Always update the displayed transcript for user feedback
    setTranscript(newTranscript.trim());

    // Only update the final transcript when we get final results
    if (isFinal) {
      setFinalTranscript(prevFinalTranscript => {
        // If this is a resumed session, handle transcript differently to avoid duplicates
        if (isResumedSessionRef.current) {
          // Check if the new transcript contains content that's already in the previous transcript
          // This helps prevent duplicates when Deepgram re-transcribes parts of the conversation
          const existingTranscript = prevFinalTranscript || '';

          // If we have a previous transcript, check for potential duplicates
          if (existingTranscript) {
            // Add a separator if we're resuming recording
            if (previousTranscriptLengthRef.current > 0 &&
                previousTranscriptLengthRef.current === existingTranscript.length) {
              // Add a newline to separate the previous and new content
              return `${existingTranscript}\n\n[Resumed recording]\n${newTranscript.trim()}`;
            }
          }
        }

        // Standard handling for non-resumed sessions or if we couldn't detect duplicates
        const updatedTranscript = prevFinalTranscript
          ? `${prevFinalTranscript} ${newTranscript}`
          : newTranscript;

        return updatedTranscript.trim();
      });
    }
  }, []);

  // Toggle an item's completion status manually
  const toggleItem = (id: string) => {
    setCompletedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // Group items by category
  const getItemsByCategory = () => {
    // Define the order of categories
    const categoryOrder = ['clinical-expertise', 'medications', 'diagnoses', 'important', 'sleep', 'exercise', 'diet', 'substances'];

    // Create a map of categories to items
    const categoryMap: Record<string, FollowUpItem[]> = {};

    items.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = [];
      }
      categoryMap[item.category].push(item);
    });

    // Return categories in the defined order
    return categoryOrder
      .filter(category => categoryMap[category] && categoryMap[category].length > 0)
      .map(category => ({
        category,
        items: categoryMap[category]
      }));
  };

  // Start recording function
  const startRecording = async () => {
    try {
      // Reset state
      setError(null);
      setTranscript('');
      setFinalTranscript('');
      setItemPoints({}); // Reset accumulated points
      setCompletedIds([]);

      // Reset the refs used for transcript analysis
      processedKeywordsRef.current = new Map();
      lastAnalyzedLengthRef.current = 0;

      // Reset the transcript tracking refs
      previousTranscriptLengthRef.current = 0;
      isResumedSessionRef.current = false;

      // Check if mediaDevices API is available
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not available in this browser or context');
      }

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');

      // Clean up if there was an error
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  // Stop recording function
  const stopRecording = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setIsRecording(false);

    // Create a minimal empty audio blob - we don't need to store audio
    const emptyBlob = new Blob([], { type: 'audio/wav' });
    audioBlob.current = emptyBlob;

    // Set the editable transcript and enter edit mode
    setEditableTranscript(finalTranscript || transcript);
    setIsEditMode(true);
    setPreserveTranscript(false); // Reset preserve transcript flag when stopping recording
  };

  // Function to go back to checklist from transcript edit mode
  const backToChecklist = () => {
    // Keep the transcript data but exit edit mode
    setIsEditMode(false);
    setPreserveTranscript(true);
  };

  // Function to resume recording
  const resumeRecording = async () => {
    try {
      // Reset error state
      setError(null);

      // Check if mediaDevices API is available
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not available in this browser or context');
      }

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Store the current transcript length before resuming
      previousTranscriptLengthRef.current = (finalTranscript || transcript).length;
      // Set the flag to indicate we're in a resumed session
      isResumedSessionRef.current = true;

      // Start recording again, but keep the existing transcript
      // We don't reset the transcript or finalTranscript here to preserve progress
      setIsRecording(true);
      setPreserveTranscript(false);

      // Don't reset the processedKeywordsRef or lastAnalyzedLengthRef
      // so we continue tracking the same keywords
    } catch (error) {
      console.error('Error resuming recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to resume recording');

      // Clean up if there was an error
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  // Add warning before page close during recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        // Standard way to show a confirmation dialog before leaving
        const confirmationMessage = 'Recording in progress. Are you sure you want to leave?';
        e.preventDefault();
        // Note: returnValue is deprecated but still needed for older browsers
        // Modern browsers will show their own generic message regardless of this text
        (e as any).returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  // Function to generate SOAP note with edited transcript
  const generateSoapNote = () => {
    if (!editableTranscript.trim()) {
      setError('Transcript cannot be empty');
      return;
    }

    // Clear recording session data when successfully submitting
    clearRecordingData();

    // Reset the preserve transcript flag
    setPreserveTranscript(false);

    // Send the recording and edited transcript to the parent component
    onRecordingComplete(audioBlob.current || new Blob([], { type: 'audio/wav' }), editableTranscript);

    // Automatically close the modal after submission
    onClose();
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
                    const progress = getItemProgress(item);
                    const isComplete = completedIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        /* Always use the color gradient, regardless of completion status */
                        className={`cursor-pointer px-3 py-2 rounded-lg transition-all flex items-start ${getCompletionColor(item)}`}
                        title={`Discussion coverage: ${progress}%${isComplete ? ' (Completed)' : ''}`}
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
                                  progress < 33
                                    ? "bg-orange-500"
                                    : progress < 66
                                      ? "bg-yellow-500"
                                      : progress < 100
                                        ? "bg-lime-500"
                                        : "bg-green-500"
                                }`}
                                style={{ width: `${progress}%` }}
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

        {/* Hidden LiveTranscription component - hidden but still functional */}
        {isRecording && (
          <div className="hidden">
            <LiveTranscription
              isRecording={isRecording}
              onTranscriptUpdate={handleTranscriptUpdate}
              lowEchoCancellation={settings?.lowEchoCancellation || false}
            />
          </div>
        )}

        {/* Visible transcript UI replacement */}
        {isRecording && (
          <div className="mt-4 mb-6 w-full bg-gray-800 dark:bg-gray-800 p-6 rounded-2xl relative shadow-lg" style={{ height: '200px', overflowY: 'auto' }}>
            <p className="text-white whitespace-pre-wrap leading-relaxed">
              {transcript || 'Listening...'}
            </p>

            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
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
                disabled={!editableTranscript.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generate SOAP Note
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
                  onClick={resumeRecording}
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
                  onClick={startRecording}
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
                onClick={stopRecording}
                className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
                Stop Recording
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
