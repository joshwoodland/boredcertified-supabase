import React, { useEffect, useState } from 'react';
import { checkSupabaseConnection, getSupabasePatients, convertToPrismaFormat, supabase } from '../lib/supabase';
import { prisma, connectWithFallback } from '../lib/db';
import { FiUser, FiTrash2, FiRefreshCw, FiEdit2 } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';

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

  // Function to load patients
  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (isSupabaseAvailable) {
        // Load patients from Supabase
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .order('name');
          
        if (error) throw error;
        
        const formattedPatients = data
          .map(patient => convertToPrismaFormat(patient, 'patient'))
          .filter(Boolean) as Patient[];
          
        setPatients(formattedPatients);
        setDataSource('supabase');
      } else {
        // No fallback to SQLite - just show an error
        throw new Error('Supabase connection unavailable');
      }
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Unable to load patients. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);
  
  // Function to add a new patient
  const addPatient = async (name: string) => {
    setIsAddingPatient(true);
    setError(null);
    
    try {
      // Check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (!isSupabaseAvailable) {
        throw new Error('Supabase connection unavailable');
      }
      
      // Generate a new UUID for the patient
      const newPatientId = uuidv4();
      
      // Add patient to Supabase
      const { error } = await supabase
        .from('patients')
        .insert({
          id: newPatientId,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Reload patients to get the updated list
      await loadPatients();
      
      // Set the newly added patient as selected
      onSelectPatient(newPatientId);
      
      setIsAddingPatient(false);
    } catch (err) {
      console.error('Error adding patient:', err);
      setError('Failed to add patient. Please try again.');
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
      // Check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (!isSupabaseAvailable) {
        throw new Error('Supabase connection unavailable');
      }
      
      // Update patient in Supabase
      const { error } = await supabase
        .from('patients')
        .update({
          name: editName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);
        
      if (error) throw error;
      
      onUpdatePatient(patientId, editName.trim());
      setIsEditing(null);
      setEditName('');
      
      // Reload the patient list
      await loadPatients();
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
      // Check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (!isSupabaseAvailable) {
        throw new Error('Supabase connection unavailable');
      }
      
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
      
      onMoveToTrash(patientId);
      await loadPatients();
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
      // Check if Supabase is available
      const isSupabaseAvailable = await checkSupabaseConnection();
      
      if (!isSupabaseAvailable) {
        throw new Error('Supabase connection unavailable');
      }
      
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
      
      onRestorePatient(patientId);
      await loadPatients();
    } catch (err) {
      console.error('Error restoring patient:', err);
      setError('Failed to restore patient');
    } finally {
      setIsProcessing(null);
    }
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
                      onSelectPatient(patient.id);
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
