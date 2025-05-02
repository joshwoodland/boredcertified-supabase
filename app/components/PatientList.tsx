'use client';

import { useState, useMemo } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { FiUser, FiTrash2, FiRefreshCw, FiSearch, FiX, FiEdit2 } from 'react-icons/fi';
import Toast from './Toast';

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  deletedAt: string | null;
  notes: Array<{
    createdAt: string;
  }>;
}

// Interface for grouped patients
interface PatientGroup {
  dateLabel: string;
  formattedDate: string;
  date: Date;
  patients: Patient[];
}

interface PatientListProps {
  patients: Patient[];
  selectedPatientId?: string;
  onSelectPatient: (patientId: string) => void;
  onAddPatient: (name: string) => void;
  onMoveToTrash: (patientId: string) => void;
  onRestorePatient: (patientId: string) => void;
  onUpdatePatient: (patientId: string, name: string) => void;
  showTrash: boolean;
}

export default function PatientList({
  patients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  onMoveToTrash,
  onRestorePatient,
  onUpdatePatient,
  showTrash,
}: PatientListProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');

  // Group patients by visit date and filter based on search query
  const groupedAndFilteredPatients = useMemo(() => {
    // First, filter patients based on search query
    let filteredList = patients;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredList = patients.filter(patient => 
        patient.name.toLowerCase().includes(query)
      );
    }
    
    // Then group filtered patients by the date of their most recent visit
    const groups: PatientGroup[] = [];
    const dateMap = new Map<string, PatientGroup>();
    
    filteredList.forEach(patient => {
      // Get the date of the patient's most recent visit, or use today's date if no visits
      let visitDate = new Date();
      if (patient.notes && patient.notes.length > 0) {
        visitDate = new Date(patient.notes[0].createdAt);
      }
      
      // Format the date as YYYY-MM-DD for grouping
      const dateKey = format(visitDate, 'yyyy-MM-dd');
      
      // Create a human-readable label for the date
      let dateLabel = format(visitDate, 'MMMM d, yyyy');
      if (isToday(visitDate)) {
        dateLabel = 'Today';
      } else if (isYesterday(visitDate)) {
        dateLabel = 'Yesterday';
      }
      
      // Format display date
      const formattedDate = format(visitDate, 'MMMM d, yyyy');
      
      // Add the patient to the appropriate date group
      if (!dateMap.has(dateKey)) {
        const newGroup = {
          dateLabel,
          formattedDate,
          date: visitDate,
          patients: []
        };
        dateMap.set(dateKey, newGroup);
        groups.push(newGroup);
      }
      
      dateMap.get(dateKey)!.patients.push(patient);
    });
    
    // Sort the groups by date, newest first
    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return groups;
  }, [patients, searchQuery]);

  const handleMoveToTrash = async (patientId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsProcessing(patientId);
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: patientId, action: 'moveToTrash' }),
      });

      if (!response.ok) throw new Error('Failed to move patient to trash');
      
      onMoveToTrash(patientId);
      setToast({ message: 'Patient moved to trash', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to move patient to trash', type: 'error' });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRestore = async (patientId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsProcessing(patientId);
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: patientId, action: 'restore' }),
      });

      if (!response.ok) throw new Error('Failed to restore patient');
      
      onRestorePatient(patientId);
      setToast({ message: 'Patient restored successfully', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to restore patient', type: 'error' });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleEditClick = async (patientId: string, event: React.MouseEvent, currentName: string) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditing(patientId);
    setEditName(currentName);
  };

  const handleEditSubmit = async (patientId: string, event: React.FormEvent) => {
    event.preventDefault();
    if (!editName.trim()) {
      setToast({ message: 'Patient name cannot be empty', type: 'error' });
      return;
    }
    setIsProcessing(patientId);
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: patientId, action: 'rename', name: editName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update patient name');
      
      setToast({ message: 'Patient name updated successfully', type: 'success' });
      setIsEditing(null);
      onUpdatePatient(patientId, editName.trim());
      setEditName('');
    } catch (error) {
      setToast({ message: 'Failed to update patient name', type: 'error' });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      setToast({ message: 'Patient name cannot be empty', type: 'error' });
      return;
    }
    try {
      onAddPatient(newPatientName.trim());
      setNewPatientName('');
      setIsAddingPatient(false);
      setToast({ message: 'Patient added successfully', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to add patient', type: 'error' });
    }
  };

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
          <h2 className="text-xl font-semibold dark:text-white">
            {showTrash ? 'Trash' : 'Patients'}
          </h2>
          {!showTrash && (
            <>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              {!isAddingPatient ? (
                <button
                  onClick={() => setIsAddingPatient(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-md transition-all shadow-md hover:shadow-lg"
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
                          autoFocus
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
                          <FiX className="w-5 h-5" />
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
        </div>
      </div>

      <div className="divide-y dark:divide-gray-700">
        {groupedAndFilteredPatients.map((group, groupIndex) => (
          <div key={group.dateLabel}>
            {/* Date header */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 sticky top-0 z-1">
              <h3 className="text-sm font-medium text-gray-500 dark:text-white">
                {group.dateLabel}
                {isToday(group.date) || isYesterday(group.date) ? 
                  <span className="text-xs ml-1 text-gray-500 dark:text-white">- {group.formattedDate}</span> : null}
              </h3>
            </div>
            
            {/* Patients in this group */}
            {group.patients.map((patient) => (
              <div
                key={patient.id}
                className={`p-4 cursor-pointer transition-all group ${
                  selectedPatientId === patient.id
                    ? 'gradient-border-left bg-gray-100 dark:bg-gray-800 shadow-inner shadow-black/30 dark:shadow-black/60 font-medium'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(null);
                    setEditName('');
                  }
                  onSelectPatient(patient.id);
                }}
              >
            {isEditing === patient.id ? (
              // Editing mode - update input background to match theme
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
                        autoFocus
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
                        <FiX className="w-5 h-5" />
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
                    {patient.notes?.[0] && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Last visit: {new Date(patient.notes[0].createdAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 ml-1 flex-shrink-0 pr-0.5">
                  {!showTrash && (
                    <button
                      onClick={(e) => handleEditClick(patient.id, e, patient.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600"
                      title="Edit patient name"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => showTrash ? handleRestore(patient.id, e) : handleMoveToTrash(patient.id, e)}
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
        ))}
        
        {groupedAndFilteredPatients.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {showTrash
              ? 'Trash is empty'
              : searchQuery
                ? (
                    <div className="flex flex-col items-center gap-2">
                      <p>No patients found matching "{searchQuery}"</p>
                      <button
                        onClick={() => setIsAddingPatient(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-md transition-all shadow-md hover:shadow-lg"
                      >
                        Add New Patient
                      </button>
                    </div>
                  )
                : 'No patients yet. Type a name to add one.'}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
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
