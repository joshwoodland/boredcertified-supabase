'use client';

import { useState, useMemo } from 'react';
import { FiUser, FiTrash2, FiRefreshCw, FiSearch, FiX, FiEdit2 } from 'react-icons/fi';
import Toast from './Toast';

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  deletedAt: string | null;
  soapNotes: Array<{
    createdAt: string;
  }>;
}

interface PatientListProps {
  patients: Patient[];
  selectedPatientId?: string;
  onSelectPatient: (patientId: string) => void;
  onAddPatient: () => void;
  onMoveToTrash: (patientId: string) => void;
  onRestorePatient: (patientId: string) => void;
  showTrash: boolean;
}

export default function PatientList({
  patients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  onMoveToTrash,
  onRestorePatient,
  showTrash,
}: PatientListProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Filter patients based on search query
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase();
    return patients.filter(patient => 
      patient.name.toLowerCase().includes(query)
    );
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
    event.stopPropagation();
    setIsEditing(patientId);
    setEditName(currentName);
  };

  const handleEditSubmit = async (patientId: string, event: React.FormEvent) => {
    event.preventDefault();
    setIsProcessing(patientId);
    try {
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: patientId, action: 'rename', name: editName }),
      });

      if (!response.ok) throw new Error('Failed to update patient name');
      
      setToast({ message: 'Patient name updated', type: 'success' });
      setIsEditing(null);
      // Refresh the patient list
      const updatedPatients = patients.map(p => 
        p.id === patientId ? { ...p, name: editName } : p
      );
      // You'll need to implement a way to update the parent's state here
    } catch (error) {
      setToast({ message: 'Failed to update patient name', type: 'error' });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold dark:text-white">
            {showTrash ? 'Trash' : 'Patients'}
          </h2>
          {!showTrash && (
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
          )}
        </div>
      </div>

      <div className="divide-y dark:divide-gray-700">
        {filteredPatients.map((patient) => (
          <div
            key={patient.id}
            className={`p-4 cursor-pointer transition-colors group ${
              selectedPatientId === patient.id
                ? 'bg-blue-50 dark:bg-blue-900'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => onSelectPatient(patient.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full">
                  <FiUser className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  {isEditing === patient.id ? (
                    <form onSubmit={(e) => handleEditSubmit(patient.id, e)} 
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="text-blue-500 hover:text-blue-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(null)}
                        className="text-gray-500 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <h3 className="font-medium dark:text-white">{patient.name}</h3>
                  )}
                  {patient.soapNotes?.[0] && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Last visit: {new Date(patient.soapNotes[0].createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!showTrash && (
                  <button
                    onClick={(e) => handleEditClick(patient.id, e, patient.name)}
                    className="p-2 rounded-full transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600"
                    title="Edit patient name"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => showTrash ? handleRestore(patient.id, e) : handleMoveToTrash(patient.id, e)}
                  className={`p-2 rounded-full transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600 ${
                    isProcessing === patient.id ? 'animate-spin' : ''
                  }`}
                  title={showTrash ? 'Restore patient' : 'Move to trash'}
                  disabled={isProcessing === patient.id}
                >
                  {showTrash ? <FiRefreshCw className="w-4 h-4" /> : <FiTrash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredPatients.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {showTrash
              ? 'Trash is empty'
              : searchQuery
                ? (
                    <div className="flex flex-col items-center gap-2">
                      <p>No patients found matching "{searchQuery}"</p>
                      <button
                        onClick={onAddPatient}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-800"
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