'use client';

import { useState, useEffect, useRef } from 'react';
import { ICD10Code, icd10PsychCodes } from '../utils/icd10PsychCodes';
import { FiX, FiPlus } from 'react-icons/fi';

interface EditableDiagnosisProps {
  type: 'diagnosis' | 'ruleOut';
  initialDiagnoses: string[];
  onChange: (diagnoses: string[]) => void;
}

export default function EditableDiagnosis({ 
  type, 
  initialDiagnoses, 
  onChange 
}: EditableDiagnosisProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [diagnoses, setDiagnoses] = useState<string[]>(initialDiagnoses);
  const [filteredCodes, setFilteredCodes] = useState<ICD10Code[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format a diagnosis string from an ICD10Code
  const formatDiagnosis = (code: ICD10Code): string => {
    return `${code.code} ${code.description}`;
  };

  // Update filtered codes when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCodes([]);
      return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const results = icd10PsychCodes.filter(
      code => 
        code.code.toLowerCase().includes(lowerSearchTerm) || 
        code.description.toLowerCase().includes(lowerSearchTerm)
    ).slice(0, 10); // Limit to 10 results for performance

    setFilteredCodes(results);
  }, [searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSelectDiagnosis = (code: ICD10Code) => {
    const formattedDiagnosis = formatDiagnosis(code);
    
    // Add the new diagnosis to the list
    const updatedDiagnoses = [...diagnoses, formattedDiagnosis];
    setDiagnoses(updatedDiagnoses);
    onChange(updatedDiagnoses);
    
    // Reset search
    setSearchTerm('');
  };

  const handleRemoveDiagnosis = (index: number) => {
    const updatedDiagnoses = diagnoses.filter((_, i) => i !== index);
    setDiagnoses(updatedDiagnoses);
    onChange(updatedDiagnoses);
  };

  const handleAddButtonClick = () => {
    setIsEditing(true);
  };

  return (
    <div className="mb-4" ref={dropdownRef}>
      <div className="font-semibold mb-2">
        {type === 'diagnosis' ? 'Diagnosis:' : 'Rule Out:'}
      </div>
      
      {/* Display existing diagnoses */}
      <div className="space-y-2 mb-2">
        {diagnoses.length > 0 ? (
          diagnoses.map((diagnosis, index) => (
            <div 
              key={index} 
              className="flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md"
            >
              <span className="flex-1">{diagnosis}</span>
              <button
                onClick={() => handleRemoveDiagnosis(index)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2"
                aria-label="Remove diagnosis"
              >
                <FiX />
              </button>
            </div>
          ))
        ) : (
          <div className="text-gray-500 dark:text-gray-400 italic">
            No {type === 'diagnosis' ? 'diagnoses' : 'rule outs'} added
          </div>
        )}
      </div>
      
      {/* Add new diagnosis button */}
      {!isEditing ? (
        <button
          onClick={handleAddButtonClick}
          className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <FiPlus className="mr-1" />
          Add {type === 'diagnosis' ? 'diagnosis' : 'rule out'}
        </button>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ICD-10 codes..."
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          
          {/* Dropdown results */}
          {filteredCodes.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredCodes.map((code) => (
                <div
                  key={code.code}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleSelectDiagnosis(code)}
                >
                  <div className="font-medium">{code.code}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{code.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 