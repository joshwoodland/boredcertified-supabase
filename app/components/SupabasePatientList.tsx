import React, { useEffect, useState } from 'react';
import { checkSupabaseConnection, getSupabasePatients, convertToPrismaFormat, supabase } from '../lib/supabase';
import { prisma, connectWithFallback } from '../lib/db';
import { FiUser, FiTrash2, FiRefreshCw, FiEdit2 } from 'react-icons/fi';

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface SupabasePatientListProps {
  selectedPatientId?: string;
  onSelectPatient: (patientId: string) => void;
  onMoveToTrash: (patientId: string) => void;
  onRestorePatient: (patientId: string) => void;
  onUpdatePatient: (patientId: string, name: string) => void;
  showTrash: boolean;
}

/**
 * Component that uses Supabase for patient data with SQLite fallback capability
 */
export default function SupabasePatientList({
  selectedPatientId,
  onSelectPatient,
  onMoveToTrash,
  onRestorePatient,
  onUpdatePatient,
  showTrash
}: SupabasePatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'sqlite'>('supabase');

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);

  // Filter patients when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
      return;
    }
    
    const filtered = patients.filter(patient => 
      patient.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPatients(filtered);
  }, [searchQuery, patients]);

  // Group patients by date (ignoring time)
  const groupPatientsByDate = (patientList: Patient[]) => {
    const groups: {[key: string]: {date: Date, patients: Patient[]}} = {};
    
    patientList.forEach(patient => {
      // Extract just the date part (ignoring time)
      const dateObj = new Date(patient.createdAt);
      const dateString = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!groups[dateString]) {
        groups[dateString] = {
          date: dateObj,
          patients: []
        };
      }
      
      groups[dateString].patients.push(patient);
    });
    
    // Convert to array and sort by date (newest first)
    return Object.values(groups).sort((a, b) => 
      b.date.getTime() - a.date.getTime()
    );
  };

  useEffect(() => {
    async function loadPatients() {
      setLoading(true);
      setError(null);
      
      try {
        // First try Supabase
        const isSupabaseAvailable = await checkSupabaseConnection();
        
        if (isSupabaseAvailable) {
          // Get data from Supabase
          const supabasePatients = await getSupabasePatients();
          
          // Convert to Prisma format
          const formattedPatients = supabasePatients
            .map(patient => convertToPrismaFormat(patient, 'patient'))
            .filter(patient => patient !== null && (patient as Patient).isDeleted === showTrash)
            .sort((a, b) => 
              (b as Patient).createdAt.getTime() - (a as Patient).createdAt.getTime()
            ) as Patient[];
            
          setPatients(formattedPatients);
          setDataSource('supabase');
        } else {
          // Fall back to SQLite
          const db = await connectWithFallback();
          const sqlitePatients = await db.patient.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
          });
          
          setPatients(sqlitePatients as Patient[]);
          setDataSource('sqlite');
        }
      } catch (err) {
        console.error('Error loading patients:', err);
        setError('Failed to load patients. Please try again.');
        
        // Attempt SQLite fallback if there was an error with Supabase
        try {
          const db = await connectWithFallback();
          const sqlitePatients = await db.patient.findMany({
            where: { isDeleted: showTrash },
            orderBy: { createdAt: 'desc' },
          });
          
          setPatients(sqlitePatients as Patient[]);
          setDataSource('sqlite');
        } catch (fallbackErr) {
          console.error('Both data sources failed:', fallbackErr);
          setError('All data sources unavailable. Please check your connection.');
        }
      } finally {
        setLoading(false);
      }
    }
    
    loadPatients();
  }, [showTrash]);
  
  // Function to add a new patient
  const addPatient = async (name: string) => {
    try {
      let newPatientId = '';
      
      if (dataSource === 'supabase') {
        // Get current user's session to access their email
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email;
        
        console.log('Creating patient with provider email:', userEmail);
        
        // Generate a new UUID for the patient
        newPatientId = crypto.randomUUID();
        
        // Add to Supabase with provider email
        const { error } = await supabase.from('patients').insert({
          id: newPatientId,
          name: name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
          provider_email: userEmail || 'joshwoodland@gmail.com', // Use current user's email or fallback
        });
        
        if (error) throw error;
      } else {
        // Add to SQLite
        const newPatient = await prisma.patient.create({
          data: {
            name: name,
          },
        });
        newPatientId = newPatient.id;
      }
      
      // Reload the patient list
      await loadPatients();
      
      // Select the newly created patient
      if (newPatientId) {
        onSelectPatient(newPatientId);
      }
    } catch (err) {
      console.error('Error adding patient:', err);
      setError('Failed to add patient');
    }
  };

  const handleEditClick = (patientId: string, event: React.MouseEvent, currentName: string) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditing(patientId);
    setEditName(currentName);
  };

  const handleEditSubmit = async (patientId: string, event: React.FormEvent) => {
    event.preventDefault();
    if (!editName.trim()) {
      setError('Patient name cannot be empty');
      return;
    }
    setIsProcessing(patientId);
    
    try {
      if (dataSource === 'supabase') {
        // Update in Supabase
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('patients')
          .update({
            name: editName.trim(),
            updated_at: now
          })
          .eq('id', patientId);
          
        if (error) throw error;
      } else {
        // Update in SQLite
        await prisma.patient.update({
          where: { id: patientId },
          data: { name: editName.trim() },
        });
      }
      
      onUpdatePatient(patientId, editName.trim());
      setIsEditing(null);
      setEditName('');
      
      // Reload the patient list
      loadPatients();
    } catch (err) {
      console.error('Error updating patient name:', err);
      setError('Failed to update patient name');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      setError('Patient name cannot be empty');
      return;
    }
    
    await addPatient(newPatientName.trim());
    setNewPatientName('');
    setIsAddingPatient(false);
  };

  const handleMoveToTrash = async (patientId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsProcessing(patientId);
    
    try {
      if (dataSource === 'supabase') {
        // Update in Supabase
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('patients')
          .update({
            is_deleted: true,
            deleted_at: now,
            updated_at: now
          })
          .eq('id', patientId);
          
        if (error) throw error;
      }
      
      onMoveToTrash(patientId);
      loadPatients();
    } catch (err) {
      console.error('Error moving patient to trash:', err);
      setError('Failed to move patient to trash');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRestorePatient = async (patientId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsProcessing(patientId);
    
    try {
      if (dataSource === 'supabase') {
        // Update in Supabase
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('patients')
          .update({
            is_deleted: false,
            deleted_at: null,
            updated_at: now
          })
          .eq('id', patientId);
          
        if (error) throw error;
      }
      
      onRestorePatient(patientId);
      loadPatients();
    } catch (err) {
      console.error('Error restoring patient:', err);
      setError('Failed to restore patient');
    } finally {
      setIsProcessing(null);
    }
  };

  // Function to load patients
  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First try Supabase
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (isSupabaseAvailable) {
        // Get data from Supabase - explicitly filter by current user email
        console.log('Loading patients from Supabase with provider email filtering');
        const supabasePatients = await getSupabasePatients(true);
        
        // Convert to Prisma format
        const formattedPatients = supabasePatients
          .map(patient => convertToPrismaFormat(patient, 'patient'))
          .filter(patient => patient !== null && (patient as Patient).isDeleted === showTrash)
          .sort((a, b) => 
            (b as Patient).createdAt.getTime() - (a as Patient).createdAt.getTime()
          ) as Patient[];
          
        setPatients(formattedPatients);
        setDataSource('supabase');
      } else {
        // Fall back to SQLite
        const db = await connectWithFallback();
        const sqlitePatients = await db.patient.findMany({
          where: { isDeleted: showTrash },
          orderBy: { createdAt: 'desc' },
        });
        
        setPatients(sqlitePatients as Patient[]);
        setDataSource('sqlite');
      }
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load patients. Please try again.');
      
      // Attempt SQLite fallback if there was an error with Supabase
      try {
        const db = await connectWithFallback();
        const sqlitePatients = await db.patient.findMany({
          where: { isDeleted: showTrash },
          orderBy: { createdAt: 'desc' },
        });
        
        setPatients(sqlitePatients as Patient[]);
        setDataSource('sqlite');
      } catch (fallbackErr) {
        console.error('Both data sources failed:', fallbackErr);
        setError('All data sources unavailable. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to handle patient selection
  const handlePatientSelect = (patientId: string) => {
    console.log('DEBUG - SupabasePatientList selecting patient:', {
      patientId,
      type: typeof patientId,
      length: patientId.length,
      bytes: Array.from(patientId).map(c => c.charCodeAt(0))
    });
    
    // Ensure the ID is a properly formatted string and valid UUID
    const strId = String(patientId).trim();
    
    // Validate UUID format with regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(strId);
    
    console.log('DEBUG - SupabasePatientList normalized patient ID:', { 
      normalized: strId,
      isValidUuid
    });
    
    if (!isValidUuid) {
      console.error('Invalid UUID format:', strId);
      setError('Invalid patient ID format detected');
      return;
    }
    
    // Check specific case for Sarah Bauman's ID
    const sarahBaumanId = 'e53c37eb-c698-4e36-bc23-d63b32968d46';
    if (strId.toLowerCase() === sarahBaumanId.toLowerCase()) {
      console.log(`Normalizing Sarah Bauman's ID: ${strId} -> ${sarahBaumanId}`);
      // Call the parent's onSelectPatient with the exact ID
      onSelectPatient(sarahBaumanId);
      return;
    }
    
    // Call the parent's onSelectPatient with the normalized ID
    onSelectPatient(strId);
  };

  if (loading) return <div>Loading patients...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Custom CSS for the gradient border */}
      <style jsx>{`
        .gradient-border-left {
          position: relative;
        }
        .gradient-border-left::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 4px; /* Match the original border-l-4 width */
          height: 100%;
          background: linear-gradient(to bottom, #9333ea, #3b82f6); /* Deeper purple to blue */
          z-index: 10;
        }
      `}</style>
      <div className="p-4 border-b dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-2">
          {/* Remove "Patients" header as requested */}
          {showTrash && (
            <h2 className="text-xl font-semibold dark:text-white">
              Trash
            </h2>
          )}
          
          {!showTrash && (
            <>
              {!isAddingPatient ? (
                <button
                  onClick={() => setIsAddingPatient(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-md transition-all shadow-md hover:shadow-lg"
                  type="button"
                >
                  Add New Patient
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full mr-3">
                    <FiUser className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <form 
                    onSubmit={handleAddPatientSubmit}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label htmlFor="newPatientName" className="sr-only">New Patient Name</label>
                        <input
                          id="newPatientName"
                          type="text"
                          value={newPatientName}
                          onChange={(e) => setNewPatientName(e.target.value)}
                          className="w-full px-3 py-1.5 text-base bg-transparent border-0 border-b-2 border-blue-500 dark:border-blue-400 focus:ring-0 focus:border-blue-600 dark:focus:border-blue-500 dark:text-white"
                          placeholder="Enter patient name"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingPatient(false);
                            setNewPatientName('');
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
          
          {/* Search box - Now below the add button */}
          <div className="relative mt-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-0 dark:text-white"
              placeholder="Search patients..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {patients.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {showTrash ? 'Trash is empty' : 'No patients found'}
          </div>
        ) : searchQuery && filteredPatients.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No patients found matching "{searchQuery}"
          </div>
        ) : (
          // Group patients by date and display with date headers
          groupPatientsByDate(searchQuery ? filteredPatients : patients).map(group => (
            <div key={group.date.toISOString()}>
              {/* Date header */}
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 sticky top-0 z-10 border-t border-b border-gray-200 dark:border-gray-600">
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {group.date.toLocaleDateString(undefined, { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              
              {/* Patients for this date */}
              <div className="divide-y dark:divide-gray-700">
                {group.patients.map(patient => (
                  <div
                    key={patient.id}
                    className={`p-4 cursor-pointer transition-all group ${
                      selectedPatientId === patient.id
                        ? 'gradient-border-left bg-gray-100 dark:bg-gray-800 shadow-inner shadow-black/30 dark:shadow-black/60 font-medium'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      if (isEditing === patient.id) return;
                      handlePatientSelect(patient.id);
                    }}
                  >
                    {isEditing === patient.id ? (
                      // Editing mode
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full mr-3">
                          <FiUser className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <form 
                          onSubmit={(e) => handleEditSubmit(patient.id, e)}
                          className="flex-1"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label htmlFor="patientName" className="sr-only">Patient Name</label>
                              <input
                                id="patientName"
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-1.5 text-base bg-transparent border-0 border-b-2 border-blue-500 dark:border-blue-400 focus:ring-0 focus:border-blue-600 dark:focus:border-blue-500 dark:text-white"
                                placeholder="Enter patient name"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditing(null);
                                  setEditName('');
                                }}
                                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                type="submit"
                                disabled={isProcessing === patient.id}
                                className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                              >
                                {isProcessing === patient.id ? (
                                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    ) : (
                      // Display mode
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full flex-shrink-0">
                            <FiUser className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium dark:text-white truncate">
                              {patient.name}
                            </h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-1 flex-shrink-0 pr-0.5">
                          {!showTrash && (
                            <button
                              type="button"
                              onClick={(e) => handleEditClick(patient.id, e, patient.name)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600"
                              title="Edit patient name"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => showTrash ? handleRestorePatient(patient.id, e) : handleMoveToTrash(patient.id, e)}
                            className={`opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600 ${
                              isProcessing === patient.id ? 'animate-spin' : ''
                            }`}
                            title={showTrash ? 'Restore patient' : 'Move to trash'}
                            disabled={isProcessing === patient.id}
                          >
                            {showTrash ? <FiRefreshCw className="w-4 h-4" /> : <FiTrash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
