'use client';

import { useState, useEffect } from 'react';
import PatientList from './components/PatientList';
import AudioRecorder from './components/AudioRecorder';
import SOAPNote from './components/SOAPNote';
import Settings from './components/Settings';
import { FiSettings, FiTrash2 } from 'react-icons/fi';

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  deletedAt: string | null;
  soapNotes: Array<{
    id: string;
    createdAt: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    isInitialVisit: boolean;
  }>;
}

export default function Home() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>();
  const [currentNote, setCurrentNote] = useState<Patient['soapNotes'][0] | null>(null);
  const [patientNotes, setPatientNotes] = useState<Patient['soapNotes']>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [showTrash, setShowTrash] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [forceCollapse, setForceCollapse] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');

  const loadingMessages = [
    "The cookies are in the oven... 🍪",
    "Expert medical scribe doing work rn 🤓",
    "Sit back and relax, lazy ass 🛋️",
    "Making your notes prettier than your handwriting 📝",
    "Teaching AI to read doctor's handwriting... 🤔",
    "Converting coffee into SOAP notes ☕",
    "Bribing the AI with virtual cookies 🍪",
    "Making medical terminology sound fancy AF 🎩",
    "Doing your work while you scroll TikTok 📱",
    "The hamsters powering our servers are tired 🐹",
    "Translating doctor-speak to human language 🤖",
    "Your note is being artisanally crafted ✨",
    "Making your attending proud... maybe 🤷",
    "Turning caffeine into documentation 🧪",
    "The AI is having an existential crisis 🤯"
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
      const response = await fetch(`/api/soap-notes?patientId=${patientId}`);
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
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Failed to load patients. Please refresh the page.');
    }
  };

  const handleAddPatient = async () => {
    const name = prompt('Enter patient name:');
    if (!name) return;

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      const newPatient = await response.json();
      setPatients([...patients, newPatient]);
    } catch (error) {
      console.error('Error adding patient:', error);
      setError('Failed to add patient. Please try again.');
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

  const handleManualTranscriptSubmit = async () => {
    if (!selectedPatientId || !manualTranscript.trim()) {
      setError('Please select a patient and enter a transcript');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const soapResponse = await fetch('/api/soap-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript: manualTranscript,
        }),
      });

      if (!soapResponse.ok) {
        throw new Error('Failed to generate SOAP note');
      }

      const soapNote = await soapResponse.json();
      setCurrentNote(soapNote);
      setManualTranscript('');
      setIsManualInput(false);
      setForceCollapse(prev => !prev);
      
      await fetchPatientNotes(selectedPatientId);
    } catch (error) {
      console.error('Error processing transcript:', error);
      setError(error instanceof Error ? error.message : 'Error processing transcript. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob, transcript: string) => {
    try {
      setIsProcessing(true);
      setError(null);

      if (!selectedPatientId) {
        throw new Error('No patient selected');
      }

      if (!transcript.trim()) {
        throw new Error('No transcript generated. Please try recording again.');
      }

      // Upload audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload audio file');
      }

      const { url: audioFileUrl } = await uploadResponse.json();

      // Generate SOAP note
      const soapResponse = await fetch('/api/soap-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          transcript,
          audioFileUrl,
        }),
      });

      if (!soapResponse.ok) {
        const errorData = await soapResponse.json();
        console.error('SOAP note generation failed:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to generate SOAP note');
      }

      const soapNote = await soapResponse.json();

      // Validate the SOAP note response
      if (!soapNote || !soapNote.id) {
        console.error('Invalid SOAP note response:', soapNote);
        throw new Error('Invalid SOAP note response from server');
      }

      // Update patient's SOAP notes
      setCurrentNote(soapNote);
      setForceCollapse(prev => !prev);
      setPatientNotes(prev => [soapNote, ...prev]);

    } catch (error) {
      console.error('Error in handleRecordingComplete:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">Medical Scribe Assistant</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={`p-2 rounded-full transition-colors ${
              showTrash 
                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                : 'hover:bg-gray-100 dark:hover:bg-dark-accent'
            }`}
            title={showTrash ? 'Show active patients' : 'Show trash'}
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
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

      <div className="grid md:grid-cols-12 gap-6">
        {/* Patient List */}
        <div className="md:col-span-3">
          <PatientList
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={setSelectedPatientId}
            onAddPatient={handleAddPatient}
            onMoveToTrash={handleMoveToTrash}
            onRestorePatient={handleRestorePatient}
            showTrash={showTrash}
          />
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-9 space-y-6">
          <div className="bg-white dark:bg-dark-secondary rounded-lg shadow">
            <div className="flex items-center justify-between p-6 border-b dark:border-dark-border">
              <h2 className="text-2xl font-semibold dark:text-dark-text">Recording Session</h2>
              {selectedPatient && (
                <div className="text-gray-600 dark:text-dark-muted">
                  Patient: <span className="font-medium dark:text-dark-text">{selectedPatient.name}</span>
                </div>
              )}
            </div>
            
            <div className="p-6">
              {selectedPatientId ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsManualInput(!isManualInput)}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        isManualInput
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-dark-accent dark:text-dark-text dark:hover:bg-dark-border'
                      }`}
                    >
                      {isManualInput ? 'Switch to Recording' : 'Manual Input'}
                    </button>
                  </div>

                  {isManualInput ? (
                    <div className="space-y-4">
                      <textarea
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        placeholder="Paste or type your transcript here..."
                        className="w-full h-48 p-4 border rounded-md dark:bg-dark-accent dark:border-dark-border dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-muted"
                      />
                      <button
                        onClick={handleManualTranscriptSubmit}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        Generate SOAP Note
                      </button>
                    </div>
                  ) : (
                    <AudioRecorder 
                      onRecordingComplete={handleRecordingComplete}
                      isProcessing={isProcessing}
                    />
                  )}

                  {isProcessing && (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-dark-muted animate-fade-in">{loadingMessage}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-dark-muted">Please select a patient to start recording</p>
              )}
            </div>
          </div>

          {/* SOAP Notes Display */}
          <div className="space-y-4">
            {patientNotes.map((note, index) => (
              <SOAPNote 
                key={note.id} 
                note={note} 
                isLatest={index === 0}
                forceCollapse={forceCollapse}
              />
            ))}
          </div>
        </div>
      </div>

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
} 