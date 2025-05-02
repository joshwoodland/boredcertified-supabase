'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppSettings } from './hooks/useAppSettings';
// Import SupabasePatientList component instead of the regular PatientList
import SupabasePatientList from './components/SupabasePatientList';
import AudioRecorder from './components/AudioRecorder';
import SupabasePatientNotes from './components/SupabasePatientNotes';
import Settings from './components/Settings';
import SoapNoteGenerator from './components/SoapNoteGenerator';
import FollowUpModal from './components/FollowUpModal';
import InitialVisitModal from './components/InitialVisitModal';
import ManualTranscriptModal from './components/ManualTranscriptModal';
import { FiSettings, FiTrash2, FiPlayCircle, FiSearch, FiUser } from 'react-icons/fi';
import AudioRecordings from './components/AudioRecordings';

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

export default function Home() {
  const { settings } = useAppSettings();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>();
  const [currentNote, setCurrentNote] = useState<Patient['notes'][0] | null>(null);
  const [patientNotes, setPatientNotes] = useState<Patient['notes']>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [showTrash, setShowTrash] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [showManualTranscriptModal, setShowManualTranscriptModal] = useState(false);
  const [forceCollapse, setForceCollapse] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [trashedPatientsData, setTrashedPatientsData] = useState<Patient[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showInitialVisitModal, setShowInitialVisitModal] = useState(false);
  const [lastVisitNote, setLastVisitNote] = useState('');
  const [isRecordingFromModal, setIsRecordingFromModal] = useState(false);
  const [isActiveRecordingSession, setIsActiveRecordingSession] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [isAudioRecordingsOpen, setIsAudioRecordingsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    fetchPatients();
  }, [showTrash]);

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
      const response = await fetch(`/api/notes?patientId=${patientId}`);
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
      setTrashedPatientsData(data.filter((p: Patient) => p.isDeleted));
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
      setIsActiveRecordingSession(true);
      return;
    }

    // Use the most recent note for follow-up items
    const lastNote = patientNotes[0];
    setLastVisitNote(lastNote.content || '');
    setShowFollowUpModal(true);
    setIsActiveRecordingSession(true);
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

      await fetchPatientNotes(selectedPatientId);
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
    if (!selectedPatientId || !transcript.trim()) {
      setError('Please select a patient and enter a transcript');
      return;
    }

    setIsProcessing(true);
    setError(null);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Generate SOAP note
      const soapResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript,
          isInitialEvaluation,
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

      await fetchPatientNotes(selectedPatientId);
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

      // Upload audio file with JWood test audio file name
      const formData = new FormData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      formData.append('file', audioBlob, `JWood test audio file ${timestamp}.wav`);
      formData.append('transcript', fullTranscript);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        const errorMessage = typeof uploadData === 'object' && uploadData !== null
          ? uploadData.error || 'Failed to upload audio file'
          : 'Failed to upload audio file';
        throw new Error(errorMessage);
      }

      if (!uploadData || typeof uploadData !== 'object' || !uploadData.url) {
        throw new Error('Invalid upload response format');
      }

      const { url: audioFileUrl } = uploadData;

      // Generate SOAP note
      const soapResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript,
          audioFileUrl,
          isInitialEvaluation,
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

  const handleUpdatePatient = (patientId: string, newName: string) => {
    setPatients(prevPatients =>
      prevPatients.map(patient =>
        patient.id === patientId ? { ...patient, name: newName } : patient
      )
    );
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <>
      <div className="container mx-auto px-4 py-0 -mt-12 -mb-14">
        <div className="flex justify-between items-center mb-0">
          <div className="flex items-center space-x-3">
            <div className="h-72 flex items-center">
              <img
                src="/logo.png"
                alt="Bored Certified Logo"
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
                <FiSearch className="mr-2" />
                Search Patient
              </button>

              {showPatientSearch && (
                <div className="absolute z-50 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-2">
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      placeholder="Type to search patients..."
                      className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient: Patient) => (
                        <div
                          key={patient.id}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            setSelectedPatientId(patient.id);
                            setShowPatientSearch(false);
                            setPatientSearchQuery('');
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-gray-100 dark:bg-gray-600 rounded-full">
                              <FiUser className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </div>
                            <span className="dark:text-white">{patient.name}</span>
                          </div>
                        </div>
                      ))
                    ) : patientSearchQuery.trim() ? (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No patients found
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowTrash(!showTrash)}
              className={`p-2 rounded-full transition-colors shadow-md ${
                showTrash
                  ? 'bg-red-500 text-white dark:bg-red-600'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
              title={showTrash ? 'Show active patients' : 'Show trash'}
            >
              <FiTrash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                document.documentElement.classList.add('modal-open');
                setIsSettingsOpen(true);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-accent rounded-full transition-colors dark:text-dark-text"
              title="Settings"
            >
              <FiSettings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
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
            />
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-9 space-y-4 -mt-2">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
              <div className="flex items-center justify-between py-4 px-4 dark:border-dark-border">
                {selectedPatientId ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                      onClick={handleStartNewVisit}
                      className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl transition transform hover:scale-105 active:scale-95 shadow-md hover:brightness-110"
                      disabled={isProcessing}
                    >
                      <FiPlayCircle className="w-4 h-4" />
                      <span>Start New Visit</span>
                    </button>

                    <button
                      onClick={() => {
                        // Check if there's at least one previous note
                        if (patientNotes.length === 0) {
                          // Show the manual transcript modal for visit type selection
                          setShowManualTranscriptModal(true);
                        } else {
                          // For patients with existing notes, show the manual input directly
                          setIsManualInput(true);
                          setIsActiveRecordingSession(true);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-1.5 text-sm border border-gray-300 dark:border-white bg-white dark:bg-transparent text-gray-800 dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition transform hover:scale-105 active:scale-95"
                      disabled={isProcessing}
                    >
                      <span>Paste in Transcript</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-600 dark:text-dark-muted">Please select a patient to start</div>
                )}

                {selectedPatient && (
                  <div className="text-gray-600 dark:text-white flex items-center gap-2">
                    <FiUser className="w-4 h-4" />
                    <span className="font-medium">{selectedPatient.name}</span>
                  </div>
                )}
              </div>

              <div className="p-0">
                {selectedPatientId ? (
                  <div className="space-y-6">

                    {/* Manual Transcript Input Section */}
                    {isManualInput && !showInitialVisitModal && (
                      <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md m-6">
                        <h2 className="text-lg font-semibold mb-4 dark:text-white">Transcript Entry</h2>
                        <textarea
                          value={manualTranscript}
                          onChange={(e) => setManualTranscript(e.target.value)}
                          placeholder="Paste or type the visit transcript here..."
                          className="w-full min-h-[300px] p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isProcessing}
                        />

                        {/* Replace the manual buttons with the SoapNoteGenerator component */}
                        <SoapNoteGenerator
                          patientId={selectedPatientId}
                          transcript={manualTranscript}
                          onNoteGenerated={(note) => {
                            setCurrentNote(note);
                            setManualTranscript('');
                            setIsManualInput(false);
                            setForceCollapse(prev => !prev);
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
                          <button
                            onClick={handleManualTranscriptSubmit}
                            disabled={!manualTranscript.trim() || isProcessing}
                            className="ml-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Process Transcript
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
                ) : (
                  <p className="text-gray-600 dark:text-dark-muted p-6">Please select a patient to start recording</p>
                )}
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
                  createdAt: note.createdAt.toISOString(),
                  content: note.content,
                  isInitialVisit: note.isInitialVisit
                });
              }}
                forceCollapse={forceCollapse}
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

      {/* Audio Recorder - Only display during active recording sessions */}
      {selectedPatientId && !isManualInput && isActiveRecordingSession && !isProcessing && (
        <div className="hidden">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isProcessing={isProcessing}
            isRecordingFromModal={isRecordingFromModal}
            onTranscriptUpdate={handleTranscriptUpdate}
            lowEchoCancellation={settings?.lowEchoCancellation || false}
          />
        </div>
      )}

      {/* Follow-Up Checklist Modal */}
      {showFollowUpModal && selectedPatientId && patientNotes.length > 0 && (
        <FollowUpModal
          lastVisitNote={lastVisitNote}
          patientId={selectedPatientId}
          noteId={patientNotes[0].id} // Use the most recent note's ID
          onRecordingComplete={handleRecordingComplete}
          onClose={() => {
            setShowFollowUpModal(false);
            setIsRecordingFromModal(false);
            setIsActiveRecordingSession(false);
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
        />
      )}

      {/* Manual Transcript Modal */}
      {showManualTranscriptModal && (
        <ManualTranscriptModal
          onTranscriptSubmit={handleManualTranscriptFromModal}
          onClose={() => {
            setShowManualTranscriptModal(false);
          }}
        />
      )}
    </>
  );
}
