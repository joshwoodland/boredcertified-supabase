'use client';

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRecordingSafeguard } from '../hooks/useRecordingSafeguard';
import { useAppSettings } from '../providers/AppSettingsProvider';
import RecoveryPrompt from './RecoveryPrompt';
import LiveDeepgramRecorder, { LiveDeepgramRecorderRef } from './LiveDeepgramRecorder';
import { formatSoapNote } from '../utils/formatSoapNote';
import { hybridAnalysis, fallbackKeywordAnalysis, logAnalysisResults } from '../utils/semanticAnalysis';

interface DefaultChecklistModalProps {
  patientId: string;
  onClose: () => void;
}

interface DefaultChecklistItem {
  id: string;
  text: string;
  category: string;
}

const DEFAULT_CHECKLIST_ITEMS: DefaultChecklistItem[] = [
  { id: 'depression-scale', text: 'Depression scale (1-10 rating)', category: 'mental-health' },
  { id: 'anxiety-scale', text: 'Anxiety scale (1-10 rating)', category: 'mental-health' },
  { id: 'mood-stability', text: 'Mood stability assessment', category: 'mental-health' },
  { id: 'sleep', text: 'Sleep quality/patterns', category: 'lifestyle' },
  { id: 'exercise', text: 'Exercise habits', category: 'lifestyle' },
  { id: 'diet', text: 'Diet/nutrition', category: 'lifestyle' },
  { id: 'socialization', text: 'Socialization levels', category: 'lifestyle' },
  { id: 'hobbies', text: 'Hobbies/activities', category: 'lifestyle' }
];

export default function DefaultChecklistModal({
  patientId,
  onClose
}: DefaultChecklistModalProps) {
  const { settings } = useAppSettings();
  const [itemPoints, setItemPoints] = useState<Record<string, number>>({});
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [preserveTranscript, setPreserveTranscript] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState('');
  const [isGeneratingSoapNote, setIsGeneratingSoapNote] = useState(false);
  const [recorderStatus, setRecorderStatus] = useState('Initializing...');
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(true);
  const [enableSemanticAnalysis, setEnableSemanticAnalysis] = useState(true);
  const [lastTopics, setLastTopics] = useState<Array<{ topic: string; confidence_score: number }>>([]);
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
    sessionType: 'general',
    contextData: { patientId },
    patientId
  });

  // Handle recovered transcript
  const onRecoverTranscript = useCallback((recoveredText: string) => {
    setEditableTranscript(recoveredText);
    setIsEditMode(true);
    handleRecoverTranscript(recoveredText);
  }, [handleRecoverTranscript]);

  // Clear any cached transcript data on component mount to ensure clean state
  useEffect(() => {
    if (!recoverySession) {
      setTranscript('');
      setFinalTranscript('');
      setEditableTranscript('');
      setIsRecording(false);
      setIsEditMode(false);
      setPreserveTranscript(false);
    }
  }, [recoverySession]);

  // Keep track of which keywords have been processed to avoid double-counting
  const previousTranscriptLengthRef = useRef<number>(0);
  const isResumedSessionRef = useRef<boolean>(false);

  // Keywords for fallback analysis
  const itemKeywords: Record<string, string[]> = {
    'depression-scale': ['depression', 'depressed', 'sad', 'hopeless', 'worthless', 'down', 'blue', 'melancholy'],
    'anxiety-scale': ['anxiety', 'anxious', 'worried', 'nervous', 'panic', 'fear', 'stress', 'tense'],
    'mood-stability': ['mood', 'emotions', 'emotional', 'stable', 'unstable', 'ups and downs', 'mood swings'],
    'sleep': ['sleep', 'sleeping', 'insomnia', 'tired', 'fatigue', 'rest', 'bed', 'wake up', 'dreams'],
    'exercise': ['exercise', 'workout', 'gym', 'running', 'walking', 'physical activity', 'sports', 'fitness'],
    'diet': ['diet', 'eating', 'food', 'nutrition', 'appetite', 'meals', 'hungry', 'weight'],
    'socialization': ['social', 'friends', 'family', 'people', 'isolation', 'lonely', 'relationships', 'support'],
    'hobbies': ['hobbies', 'activities', 'interests', 'fun', 'enjoyment', 'leisure', 'recreation', 'passion']
  };

  // Analyze transcript using hybrid semantic + keyword approach
  const analyzeTranscript = useCallback((currentTranscript: string) => {
    if (!currentTranscript || !currentTranscript.trim()) return;

    console.log('[ANALYSIS] Starting analysis:', {
      method: enableSemanticAnalysis ? 'hybrid' : 'fallback',
      transcriptLength: currentTranscript.length,
      topicsAvailable: lastTopics.length
    });

    let result;
    
    if (enableSemanticAnalysis && lastTopics.length > 0) {
      // Use hybrid analysis with both semantic topics and keyword fallback
      result = hybridAnalysis(
        lastTopics,
        currentTranscript,
        itemKeywords,
        DEFAULT_CHECKLIST_ITEMS,
        'default',
        itemPoints
      );
    } else {
      // Fallback to keyword-only analysis
      result = fallbackKeywordAnalysis(
        currentTranscript,
        itemKeywords,
        DEFAULT_CHECKLIST_ITEMS,
        itemPoints
      );
    }

    // Log analysis results
    logAnalysisResults(result, 'Default Checklist');

    // Update points
    setItemPoints(result.itemPoints);

    // Auto-complete items that reach 100 points
    Object.entries(result.itemPoints).forEach(([itemId, points]) => {
      if (points >= 100) {
        setCompletedIds(prev => {
          if (!prev.includes(itemId)) {
            console.log(`[AUTO-COMPLETE] Item ${itemId} auto-completed with ${points} points`);
            return [...prev, itemId];
          }
          return prev;
        });
      }
    });
  }, [itemPoints, enableSemanticAnalysis, lastTopics]);

  // Handle topic detection from semantic analysis
  const handleTopicsDetected = useCallback((topics: Array<{ topic: string; confidence_score: number }>) => {
    console.log('[DEFAULT CHECKLIST] Topics detected:', topics);
    setLastTopics(topics);
    
    // Trigger analysis with the new topics
    if (transcript || finalTranscript) {
      const currentTranscript = transcript || finalTranscript;
      setTimeout(() => {
        analyzeTranscript(currentTranscript);
      }, 100); // Small delay to ensure topics state is updated
    }
  }, [transcript, finalTranscript, analyzeTranscript]);

  // Handle transcript updates
  const handleTranscriptUpdate = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
    analyzeTranscript(newTranscript);
  }, [analyzeTranscript]);

  // Handle recording start with extensive logging
  const handleStartRecording = useCallback(() => {
    console.log('[DEFAULT CHECKLIST] === START RECORDING BUTTON CLICKED ===');
    console.log('[DEFAULT CHECKLIST] Component state:', {
      isRecording,
      preserveTranscript,
      isEditMode,
      error,
      showRecoveryPrompt
    });
    
    console.log('[DEFAULT CHECKLIST] Recorder ref state:', {
      hasRef: !!recorderRef.current,
      canRecord: recorderRef.current?.canRecord,
      canStop: recorderRef.current?.canStop,
      isRecording: recorderRef.current?.isRecording,
      status: recorderRef.current?.status,
      error: recorderRef.current?.error
    });

    if (!recorderRef.current) {
      console.error('[DEFAULT CHECKLIST] ERROR: Recorder ref is null!');
      setError('Recording component not available. Please refresh the page.');
      return;
    }

    if (!recorderRef.current.canRecord) {
      console.error('[DEFAULT CHECKLIST] ERROR: Recorder cannot record!', {
        canRecord: recorderRef.current.canRecord,
        status: recorderRef.current.status,
        error: recorderRef.current.error
      });
      setError('Recording not ready. Please wait for microphone and connection to initialize.');
      return;
    }

    try {
      console.log('[DEFAULT CHECKLIST] Attempting to start recording...');
      
      // Reset state before starting
      setTranscript('');
      setFinalTranscript('');
      setPreserveTranscript(false);
      setShowRecoveryPrompt(false);
      setError(null);
      
      // Start recording
      recorderRef.current.startRecording();
      console.log('[DEFAULT CHECKLIST] Recording start command sent successfully');
      
      // Update recording state
      setIsRecording(true);
      
    } catch (error) {
      console.error('[DEFAULT CHECKLIST] ERROR: Exception during start recording:', error);
      setError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Handle recording stop
  const handleStopRecording = useCallback(() => {
    if (recorderRef.current?.canStop) {
      recorderRef.current.stopRecording();
    }
  }, []);

  // Handle recording completion
  const handleRecordingComplete = useCallback((audioBlob: Blob, transcriptText: string) => {
    setIsRecording(false);
    setFinalTranscript(transcriptText);
    setEditableTranscript(transcriptText);
    setIsEditMode(true);
    analyzeTranscript(transcriptText);
  }, [analyzeTranscript]);

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
    const categories: Record<string, DefaultChecklistItem[]> = {};
    
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
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
    setIsEditMode(false);
    setPreserveTranscript(true);
  };

  // Function to generate SOAP note with edited transcript
  const generateSoapNote = async () => {
    if (!editableTranscript.trim()) {
      setError('Transcript cannot be empty');
      return;
    }

    clearRecordingData();
    setPreserveTranscript(false);
    setIsGeneratingSoapNote(true);

    try {
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

      const fullTranscript = editableTranscript;
      const soapTemplate = settings?.followUpVisitPrompt || 'S:\nO:\nA:\nP:';

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patientId,
          transcript: fullTranscript,
          useStructuredPrompt: true,
          isInitialEvaluation: false,
          patientName: patientName,
          previousNote: null, // No previous note for default checklist
          soapTemplate: soapTemplate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate SOAP note'
        );
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      onClose();
    } catch (error) {
      console.error('Error generating SOAP note:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate SOAP note');
    } finally {
      setIsGeneratingSoapNote(false);
    }
  };

  // Get category display name
  const getCategoryName = (category: string) => {
    switch (category) {
      case 'mental-health': return 'Mental Health Assessment';
      case 'lifestyle': return 'Lifestyle Factors';
      default: return category;
    }
  };

  // Get category emoji
  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'mental-health': return '🧠';
      case 'lifestyle': return '🏃‍♂️';
      default: return '📋';
    }
  };

  // Get progress color based on points
  const getProgressColor = (progress: number, isComplete: boolean) => {
    if (isComplete) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    if (progress >= 80) return 'bg-lime-100 dark:bg-lime-900/30 border-lime-300 dark:border-lime-700';
    if (progress >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
    if (progress >= 40) return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
    if (progress > 0) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
    return 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-auto pt-20 pb-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-3xl mx-auto">
        {recoverySession && showRecoveryPrompt && (
          <RecoveryPrompt
            savedSession={recoverySession}
            onRecover={onRecoverTranscript}
            onDiscard={handleDiscardRecovery}
          />
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold dark:text-white">Default Assessment Checklist</h2>
            {/* Semantic Analysis Toggle */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={enableSemanticAnalysis}
                  onChange={(e) => setEnableSemanticAnalysis(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>AI Topic Detection</span>
                {enableSemanticAnalysis && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                    ON
                  </span>
                )}
              </label>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-muted dark:border-gray-600 dark:text-white resize-none"
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
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Live Transcription</h4>
                {/* Low Echo Cancellation Indicator */}
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                    title="Low echo cancellation enabled for video calls"
                  >
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Video call optimized</span>
                </div>
              </div>
              <div className={`live-transcription text-gray-800 dark:text-gray-200 max-h-32 overflow-y-auto ${isRecording ? 'animate-pulse' : ''}`}>
                {transcript || finalTranscript || "You may now begin speaking..."}
              </div>
            </div>

            {/* Checklist items */}
            <div className="my-4 space-y-6">
              {getItemsByCategory().map(({ category, items }) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                    <span className="mr-2">{getCategoryEmoji(category)}</span>
                    <span>{getCategoryName(category)}</span>
                  </h3>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const progress = itemPoints[item.id] || 0;
                      const isComplete = completedIds.includes(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`px-3 py-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${getProgressColor(progress, isComplete)}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-gray-800 dark:text-gray-200 font-medium">
                              {item.text}
                            </span>
                            <div className="flex items-center space-x-2">
                              {progress > 0 && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {Math.round(progress)}%
                                </div>
                              )}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isComplete 
                                  ? 'bg-green-500 border-green-500' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isComplete && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Default checklist view when not recording
          <div className="my-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                Assessment Checklist
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Click "Start Recording" to begin live transcription and automatic topic tracking, or manually check off items as you discuss them.
              </p>
            </div>

            {/* Checklist items */}
            <div className="space-y-6">
              {getItemsByCategory().map(({ category, items }) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                    <span className="mr-2">{getCategoryEmoji(category)}</span>
                    <span>{getCategoryName(category)}</span>
                  </h3>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const progress = itemPoints[item.id] || 0;
                      const isComplete = completedIds.includes(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`px-3 py-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${getProgressColor(progress, isComplete)}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-gray-800 dark:text-gray-200 font-medium">
                              {item.text}
                            </span>
                            <div className="flex items-center space-x-2">
                              {progress > 0 && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {Math.round(progress)}%
                                </div>
                              )}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isComplete 
                                  ? 'bg-green-500 border-green-500' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isComplete && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Topics change color as they are discussed more thoroughly. You can also manually toggle items by clicking on them.
              </p>
            </div>
          </div>
        )}

        {/* Hidden recorder component using headless mode */}
        <LiveDeepgramRecorder
          ref={recorderRef}
          onRecordingComplete={handleRecordingComplete}
          onTranscriptUpdate={handleTranscriptUpdate}
          isProcessing={false}
          isRecordingFromModal={true}
          headless={true}
          enableTopicDetection={enableSemanticAnalysis}
          onTopicsDetected={handleTopicsDetected}
        />

        {/* Error message */}
        {error && (
          <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
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
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              {isRecording ? (
                <button
                  onClick={handleStopRecording}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                  </svg>
                  Stop Recording
                </button>
              ) : preserveTranscript ? (
                <button
                  onClick={handleStartRecording}
                  disabled={!recorderRef.current?.canRecord}
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
                  onClick={handleStartRecording}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Start Recording
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 