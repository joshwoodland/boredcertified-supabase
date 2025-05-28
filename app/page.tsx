'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppSettings } from './providers/AppSettingsProvider';
import SupabasePatientList from './components/SupabasePatientList';
import LiveDeepgramRecorder from './components/LiveDeepgramRecorder';
import SupabasePatientNotes from './components/SupabasePatientNotes';
import Settings from './components/Settings';
import SoapNoteGenerator from './components/SoapNoteGenerator';
import FollowUpModal from './components/FollowUpModal';
import InitialVisitModal from './components/InitialVisitModal';
import ManualTranscriptModal from './components/ManualTranscriptModal';
import { Settings as SettingsIcon, Trash2, PlayCircle, Search, User } from 'lucide-react';
import UserProfile from './components/UserProfile';
import AudioRecordings from './components/AudioRecordings';
import DynamicLogo from './components/DynamicLogo';
import { supabaseBrowser } from '@/app/lib/supabase';
import type { AppPatient } from './lib/supabaseTypes';
import type { Note } from './types/notes';
import { extractContent } from './utils/safeJsonParse';

// Use the singleton browser client for direct database access
const supabase = supabaseBrowser;

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  deletedAt: string | null;
  notes: Array<{
    id: string;
    createdAt: string;
    content: string;
    isInitialVisit: boolean;
  }>;
}

// Helper function to normalize patient IDs across the application
function normalizePatientId(id: any): string {
  if (!id) return '';

  // Convert to string and trim
  const strId = String(id).trim();

  // Validate UUID format with regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Check if this is Sarah Bauman's ID, and normalize if needed
  const sarahBaumanId = 'e53c37eb-c698-4e36-bc23-d63b32968d46';
  if (strId === sarahBaumanId || strId.toLowerCase() === sarahBaumanId.toLowerCase()) {
    console.log(`Normalizing Sarah Bauman's ID: ${strId} -> ${sarahBaumanId}`);
    return sarahBaumanId;
  }

  return uuidRegex.test(strId) ? strId : '';
}

export default function Home() {
  const { settings, isLoading: settingsLoading, error: settingsError, refreshSettings } = useAppSettings();
  const [patients, setPatients] = useState<AppPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [patientNotes, setPatientNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isActiveRecordingSession, setIsActiveRecordingSession] = useState(false);
  const [isRecordingFromModal, setIsRecordingFromModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showInitialVisitModal, setShowInitialVisitModal] = useState(false);
  const [showManualTranscriptModal, setShowManualTranscriptModal] = useState(false);
  const [lastVisitNote, setLastVisitNote] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [forceCollapse, setForceCollapse] = useState(false);
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Generating SOAP note...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAudioRecordingsOpen, setIsAudioRecordingsOpen] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [providedPreviousNote, setProvidedPreviousNote] = useState<string | null>(null);
  const [trashedPatientsData, setTrashedPatientsData] = useState<AppPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  // Enable dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Handle clicks outside of the search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowPatientSearch(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter patients based on search query
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return [];

    const query = patientSearchQuery.toLowerCase();
    return patients.filter(patient =>
      !patient.isDeleted && patient.name.toLowerCase().includes(query)
    );
  }, [patients, patientSearchQuery]);

  const loadingMessages = [
    "Channeling Doctor Strange's medical expertise... Hold on, this might require some magic. 🪄",
    "Barbie says: 'I'm not just a fashion icon—I'm also a doctor!' 👩‍⚕️",
    "Taylor Swift is working on a new song: 'Patient History (10-Minute Version).' 🎵",
    "Consulting with House, M.D.—but without the sarcasm. 🏥",
    "Asking Wednesday Addams to brighten up this diagnosis… okay, maybe just a little. 🖤",
    "Transforming your words into SOAP notes—Optimus Prime style. 🤖",
    "Spider-Man's spidey sense is tingling… must be a breakthrough! 🕷️",
    "Welcome to The Last of Us: Medical Documentation Edition—don't worry, this infection is just a typo. 🌿",
    "Bluey's dad is helping write this note… turns out he's surprisingly good at it! 🐕",
    "Ted Lasso is giving your medical records the pep talk they deserve. 📋",
    "Baby Yoda is using the Force to organize these notes… but mostly just staring adorably. 👶",
    "Roman Roy from Succession is attempting medical terminology… this could get interesting. 💼",
    "Welcome to The Bear: Medical Scribe Kitchen Edition—yes, chef! 👨‍🍳",
    "Ahsoka's lightsaber is making precise edits to your notes. ⚔️",
    "Guardians of the Galaxy are on a mission… to ensure accurate documentation. 🚀",
    "Mario and Luigi: Medical Scribe Bros—let's-a go! 🍄",
    "Oppenheimer is calculating the most optimal treatment plan… with extreme precision. 💥",
    "Beyoncé's Renaissance Tour is now a Medical Documentation World Tour! 🎤",
    "Ken is trying his best at medical scribing… he's just Ken. 👱‍♂️",
    "The Super Mario Bros. Movie presents: Journey to Perfect Notes! 🎮",
    "Welcome to Avatar: The Way of Medical Documentation. 💧",
    "Top Gun: Maverick's guide to swift and accurate scribing—because speed matters. ✈️",
    "John Wick: Chapter 4… of your medical history. 🕴️",
    "Everything Everywhere All At Once… but make it medical notes. 🥢",
    "Following the Mandalorian's Code of Medical Documentation—this is the way. 🪖",
    "Loki is causing mischief in the medical records… let's rein that in. 😈",
    "Stranger Things are happening in these notes… better double-check. 🔮",
    "The Last Airbender is mastering the four elements… of SOAP notes. 🌪️",
    "Squid Game: Red Light, Green Light… but for medical documentation. 🦑",
    "WandaVision's sitcom-style medical documentation—expect some plot twists. 📺",
    "Bridgerton's Lady Whistledown is reviewing your medical history… and it's quite the scandal. 📜",
    "Welcome to The White Lotus: Medical Scribe Resort Edition! 🌺",
    "Cousin Greg from Succession is attempting medical terminology… bless his heart. 📱",
    "Abbott Elementary's guide to keeping notes organized and stress-free. 📚",
    "The Bear… but for medical notes. Brace yourself. 🔪",
    "Only Murders in the Building—except we're solving medical mysteries instead. 🔍",
    "Rick and Morty's interdimensional medical adventures… hold on, this might get weird. 🧪",
    "The Crown's royal approach to medical documentation—strictly by the book. 👑",
    "Heartstopper's gentle, well-organized medical notes—because details matter. 🍂",
    "Shadow and Bone's magical approach to scribing… precision is key. ⚡",
    "Toss a coin to your medical scribe—The Witcher is on the case! 🎵",
    "Emily in Paris… but she's learning French medical terms. 🗼",
    "Peaky Blinders' Tommy Shelby organizing patient files—by order of the medical board. 🎩",
    "The Good Place's Janet computing medical data—this note is not a robot. 🤖",
    "Brooklyn Nine-Nine's Jake Peralta is investigating symptoms—cool, cool, cool. 🚔",
    "Moira Rose from Schitt's Creek is pronouncing medical terms… dramatically. 🌹",
    "Michael Scott from The Office attempting medical documentation… what could go wrong? 📎",
    "Leslie Knope from Parks and Recreation ensuring patient care is organized to perfection. 📋",
    "The Community study group tackling medical terminology—self-taught, of course. 📖",
    "Walter White from Breaking Bad is calculating medication dosages… let's double-check that. ⚗️"
  ];

  // Function to handle initial data loading
  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch settings and patients in parallel
      await Promise.all([
        refreshSettings(),
        // We'll get patients through the SupabasePatientList component's callback
        Promise.resolve()
      ]);

      if (settingsError) {
        console.error('Error loading settings:', settingsError);
        setError('Failed to load settings');
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data when component mounts
  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle patients loaded from SupabasePatientList
  const handlePatientsLoaded = (loadedPatients: AppPatient[]) => {
    setPatients(loadedPatients);
    setIsLoading(false);
    setTrashedPatientsData(loadedPatients.filter((p: AppPatient) => p.isDeleted));
  };

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientNotes(selectedPatientId);
    } else {
      setPatientNotes([]);
      setCurrentNote(null);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      interval = setInterval(() => {
        const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        setLoadingMessage(randomMessage);
      }, 3000); // Change message every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const fetchPatientNotes = async (patientId: string) => {
    try {
      // Normalize the patient ID for consistency
      const normalizedId = normalizePatientId(patientId);
      if (!normalizedId) {
        console.error('Invalid patient ID format:', patientId);
        throw new Error('Invalid patient ID format');
      }

      console.log('Fetching notes for normalized patient ID:', normalizedId);
      const response = await fetch(`/api/notes?patientId=${normalizedId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch patient notes');
      }
      const notes = await response.json();
      setPatientNotes(notes);
      setCurrentNote(notes[0] || null);
    } catch (error) {
      console.error('Error fetching patient notes:', error);
      setError('Failed to load patient notes');
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch(`/api/patients?showDeleted=${showTrash}`);
      const data = await response.json();
      setPatients(data);
      setTrashedPatientsData(data.filter((p: AppPatient) => p.isDeleted));
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Failed to load patients. Please refresh the page.');
    }
  };

  const handleAddPatient = async (name: string) => {
    if (!name) return;

    try {
      console.log('Adding patient:', name);
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      console.log('Response status:', response.status);
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);

      let data;
      try {
        const text = await response.text();
        console.log('Response text:', text);
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to add patient');
      }

      // Refresh the patient list to ensure we have the latest data
      await fetchPatients();
    } catch (error) {
      console.error('Error adding patient:', error);
      setError(error instanceof Error ? error.message : 'Failed to add patient. Please try again.');
      throw error;
    }
  };

  const handleMoveToTrash = async (patientId: string) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: patientId, action: 'moveToTrash' }),
      });
      if (!response.ok) throw new Error('Failed to move patient to trash');
      await fetchPatients();
      if (selectedPatientId === patientId) {
        setSelectedPatientId(undefined);
      }
    } catch (error) {
      console.error('Error moving patient to trash:', error);
      setError('Failed to move patient to trash');
    }
  };

  const handleRestorePatient = async (patientId: string) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: patientId, action: 'restore' }),
      });
      if (!response.ok) throw new Error('Failed to restore patient');
      await fetchPatients();
    } catch (error) {
      console.error('Error restoring patient:', error);
      setError('Failed to restore patient');
    }
  };

  const handleTranscriptUpdate = (transcript: string) => {
    setLiveTranscript(transcript);
  };

  // Handler for the "Start New Visit" button
  const handleStartNewVisit = async () => {
    if (!selectedPatientId) {
      setError('Please select a patient first');
      return;
    }

    // Check if there's at least one previous note
    if (patientNotes.length === 0) {
      // Show the initial visit modal instead of displaying an error
      setShowInitialVisitModal(true);
      // Don't set isActiveRecordingSession here - the modal will handle recording
      return;
    }

    // Use the most recent note for follow-up items
    const lastNote = patientNotes[0];
    setLastVisitNote(extractContent(lastNote.content) || '');
    setShowFollowUpModal(true);
    // Don't set isActiveRecordingSession here - the modal will handle recording
  };

  // Handler for starting recording from the follow-up modal
  const handleStartRecordingFromModal = async () => {
    // Keep the modal open and start recording
    // The AudioRecorder component will handle the actual recording
    try {
      // The AudioRecorder component needs to be triggered programmatically
      // We'll add a state to control this
      setIsRecordingFromModal(true);
    } catch (error) {
      console.error('Error starting recording from modal:', error);
      setError('Failed to start recording from modal');
    }
  };

  const handleCancel = async () => {
    if (abortController) {
      abortController.abort();
      setIsProcessing(false);
      setError('Note generation cancelled');
      setAbortController(null);
    }
  };

  const handleManualTranscriptSubmit = async () => {
    if (!selectedPatientId || !manualTranscript.trim()) {
      setError('Please select a patient and enter a transcript');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Use the full transcript without additional processing
      const fullTranscript = manualTranscript;

      const soapResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript: fullTranscript,
          useStructuredPrompt: true // Ensure we use the structured prompt approach
        }),
        signal: controller.signal
      });

      const responseData = await soapResponse.json();

      if (!soapResponse.ok) {
        const errorMessage = typeof responseData === 'object' && responseData !== null
          ? responseData.details || responseData.error || 'Failed to generate SOAP note'
          : 'Failed to generate SOAP note';
        console.error('SOAP note generation failed:', responseData);
        throw new Error(errorMessage);
      }

      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response format from server');
      }

      setCurrentNote(responseData);
      setManualTranscript('');
      setIsManualInput(false);
      setForceCollapse(prev => !prev);
      setIsActiveRecordingSession(false);
      setNotesRefreshTrigger(prev => prev + 1); // Increment refresh trigger

      if (selectedPatientId) {
        await fetchPatientNotes(selectedPatientId);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Note generation cancelled');
        return;
      }
      console.error('Error processing transcript:', error);
      setError(error instanceof Error ? error.message : 'Error processing transcript. Please try again.');
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  // Handler for manual transcript submission from the modal
  const handleManualTranscriptFromModal = async (transcript: string, isInitialEvaluation: boolean) => {
    // Add extensive debugging for patient ID
    console.log('DEBUG - Raw selectedPatientId:', {
      value: selectedPatientId,
      type: typeof selectedPatientId,
      stringified: JSON.stringify(selectedPatientId),
      length: selectedPatientId?.length
    });

    // Normalize patient ID with strict UUID format checking
    const patientId = normalizePatientId(selectedPatientId);

    console.log('DEBUG - Normalized patientId:', {
      value: patientId,
      isValid: !!patientId,
      patientIdBytes: patientId?.split('').map(c => c.charCodeAt(0)),
      selectedPatientBytes: selectedPatientId ? String(selectedPatientId).split('').map(c => c.charCodeAt(0)) : null
    });

    if (!patientId) {
      console.error('Missing patient ID when submitting transcript');
      setError('Please select a patient before generating a note');
      return;
    }

    if (!transcript.trim()) {
      setError('Please enter a transcript');
      return;
    }

    // Validate patient existence directly with Supabase before proceeding
    try {
      console.log('Validating patient ID with Supabase:', patientId);

      // Check if Supabase client is initialized
      if (!supabase) {
        throw new Error('Unable to initialize database client');
      }

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id, name')
        .eq('id', patientId)
        .single();

      if (patientError || !patientData) {
        console.error('Supabase validation error:', patientError || 'Patient not found');
        setError(`Patient validation failed: ${patientError?.message || 'Patient not found'}`);
        return;
      }

      console.log('Patient validated successfully with Supabase:', patientData);
    } catch (validationError) {
      console.error('Error during Supabase patient validation:', validationError);
      setError('Unable to validate patient. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Get patient name for proper formatting
      let patientName = "Patient";
      try {
        // First try to get from the patients array
        const selectedPatient = patients.find(p => p.id === patientId);
        if (selectedPatient) {
          patientName = selectedPatient.name;
        } else {
          // Fallback to API if not found in the array
          const patientResponse = await fetch(`/api/patients?id=${patientId}`);
          if (patientResponse.ok) {
            const patientData = await patientResponse.json();
            if (patientData && patientData.length > 0) {
              patientName = patientData[0].name;
            }
          }
        }
        console.log('Using patient name:', patientName);
      } catch (error) {
        console.warn('Error fetching patient name, using default', error);
      }

      // For follow-up visits, get the previous note for context
      let previousNote = null;
      if (!isInitialEvaluation) {
        try {
          const notesResponse = await fetch(`/api/notes?patientId=${patientId}`);
          if (notesResponse.ok) {
            const existingNotes = await notesResponse.json();
            if (existingNotes.length > 0) {
              previousNote = existingNotes[0].content;
              console.log('Previous note found for context');
            }
          }
        } catch (error) {
          console.warn('Error fetching previous notes', error);
        }
      }

      // Get the appropriate provider preferences from settings
      // These are additional instructions that will be combined with hardcoded templates in the API
      const providerPreferences = isInitialEvaluation
        ? settings?.initialVisitPrompt || 'Please include detailed medication side effects when mentioned. Use bullet points for medication lists.'
        : settings?.followUpVisitPrompt || 'Focus on changes since the last visit. Highlight any medication adjustments with "CHANGED" label.';

      // Create the request body with all required parameters
      const requestBody = {
        patientId: patientId,
        transcript,
        useStructuredPrompt: true, // Always use the structured prompt approach
        isInitialEvaluation,
        patientName,
        previousNote,
        soapTemplate: providerPreferences // Pass provider preferences to be combined with hardcoded templates in the API
      };

      console.log('DEBUG - Request body to be sent:', JSON.stringify(requestBody));

      // Generate SOAP note
      console.log('Sending request to /api/notes with patientId:', patientId);
      const soapResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      // Log the response status and headers for debugging
      console.log('SOAP API response status:', soapResponse.status);
      console.log('SOAP API response headers:', {
        contentType: soapResponse.headers.get('content-type'),
        statusText: soapResponse.statusText
      });

      const responseData = await soapResponse.json();
      console.log('SOAP API response data:', responseData);

      if (!soapResponse.ok) {
        const errorMessage = typeof responseData === 'object' && responseData !== null
          ? responseData.details || responseData.error || 'Failed to generate SOAP note'
          : 'Failed to generate SOAP note';
        console.error('SOAP note generation failed:', responseData);
        throw new Error(errorMessage);
      }

      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response format from server');
      }

      setCurrentNote(responseData);
      setManualTranscript('');
      setIsManualInput(false);
      setForceCollapse(prev => !prev);
      setIsActiveRecordingSession(false);
      setNotesRefreshTrigger(prev => prev + 1); // Increment refresh trigger

      if (patientId) {
        await fetchPatientNotes(patientId);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Note generation cancelled');
        return;
      }
      console.error('Error processing transcript:', error);
      setError(error instanceof Error ? error.message : 'Error processing transcript. Please try again.');
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob, transcript: string, isInitialEvaluation: boolean = false) => {
    try {
      setIsProcessing(true);
      setError(null);
      const controller = new AbortController();
      setAbortController(controller);

      if (!selectedPatientId) {
        throw new Error('No patient selected');
      }

      if (!transcript.trim()) {
        throw new Error('No transcript generated. Please try recording again.');
      }

      // Use the complete transcript without additional processing
      const fullTranscript = transcript;

      // Get patient name for proper formatting
      const selectedPatient = patients.find(p => p.id === selectedPatientId);
      const patientName = selectedPatient?.name || 'Patient';

      // For follow-up visits, get the previous note for context
      let previousNote = null;
      if (!isInitialEvaluation && patientNotes.length > 0) {
        previousNote = patientNotes[0].content;
      }

      // Get the appropriate provider preferences from settings
      // These are additional instructions that will be combined with hardcoded templates in the API
      const providerPreferences = isInitialEvaluation
        ? settings?.initialVisitPrompt || 'Please include detailed medication side effects when mentioned. Use bullet points for medication lists.'
        : settings?.followUpVisitPrompt || 'Focus on changes since the last visit. Highlight any medication adjustments with "CHANGED" label.';

      console.log('Generating SOAP note with structured prompt approach:', {
        isInitialVisit: isInitialEvaluation,
        hasPreviousNote: !!previousNote,
        patientName,
        templateLength: providerPreferences.length
      });

      // Generate SOAP note with structured prompt approach
      const soapResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript: fullTranscript,
          useStructuredPrompt: true, // Use the structured prompt approach
          isInitialEvaluation, // Pass visit type
          patientName, // Pass patient name for proper formatting
          previousNote, // Pass the previous note for context
          soapTemplate: providerPreferences // Pass provider preferences to be combined with hardcoded templates in the API
        }),
        signal: controller.signal
      });

      const responseData = await soapResponse.json();

      if (!soapResponse.ok) {
        const errorMessage = typeof responseData === 'object' && responseData !== null
          ? responseData.details || responseData.error || 'Failed to generate SOAP note'
          : 'Failed to generate SOAP note';
        console.error('SOAP note generation failed:', responseData);
        throw new Error(errorMessage);
      }

      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response format from server');
      }

      setCurrentNote(responseData);
      setLiveTranscript('');
      setIsActiveRecordingSession(false);
      setNotesRefreshTrigger(prev => prev + 1); // Increment refresh trigger

      await fetchPatientNotes(selectedPatientId);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Note generation cancelled');
        return;
      }
      console.error('Error processing recording:', error);
      setError(error instanceof Error ? error.message : 'Error processing recording. Please try again.');
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleUpdatePatient = async (patientId: string, name: string) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: patientId, name }),
      });
      if (!response.ok) throw new Error('Failed to update patient');
    } catch (error) {
      console.error('Error updating patient:', error);
      setError('Failed to update patient');
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Handler for when user provides a previous note for follow-up
  const handleFollowUpWithPreviousNote = async (previousNote: string) => {
    if (!selectedPatientId) {
      setError('Please select a patient first');
      return;
    }

    // Store the provided previous note
    setProvidedPreviousNote(previousNote);
    setLastVisitNote(previousNote);
    
    // Show the follow-up modal with the provided previous note
    setShowFollowUpModal(true);
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-0 -mt-12 -mb-14">
          <div className="flex justify-between items-center mb-0">
            <div className="flex items-center space-x-3">
              <div className="h-72 flex items-center">
                <DynamicLogo
                  style={{
                    height: '100%',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
              <span className="px-3 py-1 text-xs uppercase tracking-widest bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md font-bold shadow-md">BETA</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative" ref={searchRef}>
                <button
                  onClick={() => {
                    setShowPatientSearch(!showPatientSearch);
                    if (!showPatientSearch) {
                      setPatientSearchQuery('');
                    }
                  }}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-md transition-all shadow-md hover:shadow-lg"
                >
                  <Search className="mr-2" />
                  Search Patient
                </button>

                {showPatientSearch && (
                  <div className="absolute z-50 mt-2 w-64 bg-popover rounded-md shadow-lg border border-border">
                    <div className="p-2">
                      <input
                        type="text"
                        value={patientSearchQuery}
                        onChange={(e) => setPatientSearchQuery(e.target.value)}
                        placeholder="Type to search patients..."
                        className="w-full p-2 border rounded-md bg-background border-border text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {filteredPatients.length > 0 ? (
                        filteredPatients.map((patient: AppPatient) => (
                          <div
                            key={patient.id}
                            className="px-4 py-2 hover:bg-muted cursor-pointer"
                            onClick={() => {
                              setSelectedPatientId(patient.id);
                              setShowPatientSearch(false);
                              setPatientSearchQuery('');
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <div className="p-1 bg-muted rounded-full">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <span className="text-foreground">{patient.name}</span>
                            </div>
                          </div>
                        ))
                      ) : patientSearchQuery.trim() ? (
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                          No patients found
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowTrash(!showTrash)}
                className={`p-2 rounded-full transition-colors shadow-md border-2 ${
                  showTrash
                    ? 'bg-red-500 text-white dark:bg-red-600 border-red-500 dark:border-red-600'
                    : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-white text-white'
                }`}
                title={showTrash ? 'Show active patients' : 'Show trash'}
              >
                <Trash2 className="w-5 h-5" fill="none" strokeWidth={2} />
              </button>
              <button
                onClick={() => {
                  document.documentElement.classList.add('modal-open');
                  setIsSettingsOpen(true);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-accent rounded-full transition-colors dark:text-dark-text"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <UserProfile />
            </div>
          </div>

          {(error || settingsError) && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {typeof error === 'string' ? error : (typeof settingsError === 'string' ? settingsError : 'An error occurred')}
            </div>
          )}

          <div className="grid md:grid-cols-12 gap-6 -mt-6">
            {/* Patient List - Using Supabase integration */}
            <div className="md:col-span-3">
              <SupabasePatientList
                selectedPatientId={selectedPatientId}
                onSelectPatient={setSelectedPatientId}
                onMoveToTrash={handleMoveToTrash}
                onRestorePatient={handleRestorePatient}
                onUpdatePatient={handleUpdatePatient}
                showTrash={showTrash}
                onPatientsLoaded={handlePatientsLoaded}
              />
            </div>

            {/* Main Content Area */}
            <div className="md:col-span-9 space-y-4 -mt-2">
              <div className="bg-card rounded-lg shadow-lg border border-border">
                <div className="flex items-center justify-between py-4 px-4 dark:border-dark-border">
                  {selectedPatientId ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <button
                        onClick={handleStartNewVisit}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl transition transform hover:scale-105 active:scale-95 shadow-md hover:brightness-110"
                        disabled={isProcessing}
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Start New Visit</span>
                      </button>

                      <button
                        onClick={() => {
                          // First check if patient is selected
                          if (!selectedPatientId) {
                            setError('Please select a patient before pasting in transcript');
                            return;
                          }

                          // Check if there's at least one previous note
                          if (patientNotes.length === 0) {
                            console.log('Opening manual transcript modal for first visit with patientId:', selectedPatientId);
                            // Show the manual transcript modal for visit type selection
                            setShowManualTranscriptModal(true);
                          } else {
                            console.log('Opening manual input form for existing patient with patientId:', selectedPatientId);
                            // For patients with existing notes, show the manual input directly
                            setIsManualInput(true);
                            setIsActiveRecordingSession(true);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm border-2 border-white bg-transparent text-white rounded-xl hover:bg-white/10 transition transform hover:scale-105 active:scale-95"
                        disabled={isProcessing || !selectedPatientId}
                      >
                        <span>Paste in Transcript</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Please select a patient to start</div>
                  )}

                  {selectedPatient && (
                    <div className="text-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="font-medium">{selectedPatient.name}</span>
                    </div>
                  )}
                </div>

                <div className="p-0">
                  {selectedPatientId ? (
                    <div className="space-y-6">

                      {/* Manual Transcript Input Section */}
                      {isManualInput && !showInitialVisitModal && (
                        <div className="w-full bg-card p-6 rounded-lg shadow-lg border border-border m-6">
                          <h2 className="text-lg font-semibold mb-4 text-foreground">Transcript Entry</h2>
                          <textarea
                            value={manualTranscript}
                            onChange={(e) => setManualTranscript(e.target.value)}
                            placeholder="Paste or type the visit transcript here..."
                            className="w-full min-h-[300px] p-4 border rounded-lg bg-background border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            disabled={isProcessing}
                          />

                          {/* Replace the manual buttons with the SoapNoteGenerator component */}
                          <SoapNoteGenerator
                            patientId={selectedPatientId}
                            transcript={manualTranscript}
                            onNoteGenerated={(note) => {
                              // Convert the note to match the expected Note type
                              const typedNote: Note = {
                                id: note.id,
                                patientId: note.patientId,
                                transcript: note.transcript || '', // Ensure transcript is not undefined
                                content: note.content,
                                summary: note.summary || null,
                                isInitialVisit: note.isInitialVisit || false,
                                createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
                                updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date()
                              };
                              setCurrentNote(typedNote);
                              setManualTranscript('');
                              setIsManualInput(false);
                              setForceCollapse(prev => !prev);
                              setNotesRefreshTrigger(prev => prev + 1); // Increment refresh trigger
                              fetchPatientNotes(selectedPatientId!);
                            }}
                            onError={(errorMessage) => setError(errorMessage)}
                            disabled={isProcessing || !selectedPatientId || !manualTranscript.trim()}
                          />

                          {isProcessing && (
                            <div className="mt-4 text-center">
                              <div className="flex justify-center mb-2">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
                              <button
                                onClick={handleCancel}
                                className="mt-4 px-4 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => {
                                setIsManualInput(false);
                                setManualTranscript('');
                              }}
                              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}


                      {isProcessing && !isManualInput && (
                        <div className="text-center py-4 p-6">
                          <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-l-2 border-blue-500"></div>
                            <p className="text-sm text-gray-600 dark:text-dark-muted animate-fade-in">{loadingMessage}</p>
                            <button
                              onClick={handleCancel}
                              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                              cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* SOAP Notes Display */}
              {selectedPatientId && (
                <SupabasePatientNotes
                  patientId={selectedPatientId}
                  selectedNoteId={currentNote?.id}
                  onNoteSelect={(note) => {
                    // Convert from the Supabase Note format to the format expected by page.tsx
                    setCurrentNote({
                      id: note.id,
                      patientId: note.patientId,
                      transcript: note.transcript,
                      content: note.content,
                      summary: note.summary,
                      isInitialVisit: note.isInitialVisit,
                      createdAt: note.createdAt,
                      updatedAt: note.updatedAt
                    });

                    // Set the lastVisitNote for the follow-up modal
                    setLastVisitNote(extractContent(note.content));
                  }}
                  forceCollapse={forceCollapse}
                  refreshTrigger={notesRefreshTrigger} // Pass the refresh trigger
                  onDeleteNote={async (noteId) => {
                    try {
                      // Call the API to delete the note
                      const response = await fetch(`/api/notes/${noteId}`, {
                        method: 'DELETE',
                      });

                      if (!response.ok) {
                        throw new Error('Failed to delete note');
                      }

                      // If the deleted note was the current note, clear it
                      if (currentNote?.id === noteId) {
                        setCurrentNote(null);
                      }

                      // Refresh the notes list
                      if (selectedPatientId) {
                        fetchPatientNotes(selectedPatientId);
                      }
                    } catch (error) {
                      console.error('Error deleting note:', error);
                      setError(error instanceof Error ? error.message : 'Failed to delete note');
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Settings Modal - Outside the container */}
        <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        {/* Audio Recordings Modal */}
        {isAudioRecordingsOpen && (
          <AudioRecordings isOpen={isAudioRecordingsOpen} onClose={() => setIsAudioRecordingsOpen(false)} />
        )}

        {/* Live Deepgram Recorder - Only display during active recording sessions when no modals are open */}
        {selectedPatientId && !isManualInput && isActiveRecordingSession && !isProcessing && !showInitialVisitModal && !showFollowUpModal && (
          <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-40 max-w-md">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recording Session Active</div>
            <LiveDeepgramRecorder
              onRecordingComplete={(audioBlob, transcript) => handleRecordingComplete(audioBlob, transcript, false)}
              isProcessing={isProcessing}
              isRecordingFromModal={isRecordingFromModal}
              onTranscriptUpdate={handleTranscriptUpdate}
              lowEchoCancellation={settings?.lowEchoCancellation || false}
            />
          </div>
        )}

        {/* Follow-Up Checklist Modal */}
        {showFollowUpModal && selectedPatientId && (patientNotes.length > 0 || providedPreviousNote) && (
          <FollowUpModal
            lastVisitNote={lastVisitNote}
            patientId={selectedPatientId}
            noteId={patientNotes.length > 0 ? patientNotes[0].id : 'provided-note'} // Use the most recent note's ID or a placeholder for provided notes
            onClose={() => {
              setShowFollowUpModal(false);
              setIsRecordingFromModal(false);
              setIsActiveRecordingSession(false);
              setProvidedPreviousNote(null); // Clear the provided previous note

              // Refresh notes after closing the modal to show the newly generated note
              if (selectedPatientId) {
                fetchPatientNotes(selectedPatientId);
              }
            }}
          />
        )}

        {/* Initial Visit Modal */}
        {showInitialVisitModal && (
          <InitialVisitModal
            onRecordingComplete={handleRecordingComplete}
            onClose={() => {
              setShowInitialVisitModal(false);
              setIsRecordingFromModal(false);
              setIsActiveRecordingSession(false);
              // Clear manual transcript if we're closing the modal
              if (isManualInput) {
                setManualTranscript('');
                setIsManualInput(false);
              }
            }}
            manualTranscript={isManualInput ? manualTranscript : undefined}
            patientId={selectedPatientId}
            hasPreviousNotes={patientNotes.length > 0}
            onFollowUpWithPreviousNote={handleFollowUpWithPreviousNote}
          />
        )}

        {/* Manual Transcript Modal */}
        {showManualTranscriptModal && (
          <ManualTranscriptModal
            onTranscriptSubmit={handleManualTranscriptFromModal}
            onClose={() => {
              setShowManualTranscriptModal(false);
            }}
            selectedPatientId={selectedPatientId}
          />
        )}
      </div>
    </>
  );
}
