'use client';

import { useState, useEffect } from 'react';
import EditableDiagnosis from './EditableDiagnosis';

interface DiagnosisSectionProps {
  initialDiagnoses: string[];
  initialRuleOuts: string[];
  onDiagnosesChange?: (diagnoses: string[]) => void;
  onRuleOutsChange?: (ruleOuts: string[]) => void;
  readOnly?: boolean;
}

export default function DiagnosisSection({
  initialDiagnoses = [],
  initialRuleOuts = [],
  onDiagnosesChange,
  onRuleOutsChange,
  readOnly = false
}: DiagnosisSectionProps) {
  const [diagnoses, setDiagnoses] = useState<string[]>(initialDiagnoses);
  const [ruleOuts, setRuleOuts] = useState<string[]>(initialRuleOuts);

  // Update local state when props change
  useEffect(() => {
    setDiagnoses(initialDiagnoses);
  }, [initialDiagnoses]);

  useEffect(() => {
    setRuleOuts(initialRuleOuts);
  }, [initialRuleOuts]);

  const handleDiagnosesChange = (newDiagnoses: string[]) => {
    setDiagnoses(newDiagnoses);
    if (onDiagnosesChange) {
      onDiagnosesChange(newDiagnoses);
    }
  };

  const handleRuleOutsChange = (newRuleOuts: string[]) => {
    setRuleOuts(newRuleOuts);
    if (onRuleOutsChange) {
      onRuleOutsChange(newRuleOuts);
    }
  };

  // If in readOnly mode, just display the diagnoses as text
  if (readOnly) {
    return (
      <div className="mb-6">
        {diagnoses.length > 0 && (
          <div className="mb-4">
            <div className="font-semibold mb-2">Diagnosis:</div>
            <div className="space-y-1">
              {diagnoses.map((diagnosis, index) => (
                <div key={index} className="pl-4 py-1">
                  {index + 1}. {diagnosis}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {ruleOuts.length > 0 && (
          <div>
            <div className="font-semibold mb-2">Rule Out:</div>
            <div className="space-y-1">
              {ruleOuts.map((ruleOut, index) => (
                <div key={index} className="pl-4 py-1">
                  {index + 1}. {ruleOut}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Otherwise, use the editable components
  return (
    <div className="mb-6">
      <EditableDiagnosis
        type="diagnosis"
        initialDiagnoses={diagnoses}
        onChange={handleDiagnosesChange}
      />
      
      <EditableDiagnosis
        type="ruleOut"
        initialDiagnoses={ruleOuts}
        onChange={handleRuleOutsChange}
      />
    </div>
  );
} 