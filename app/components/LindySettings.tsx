'use client';

import { useState, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

interface LindySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const LindySettings: React.FC<LindySettingsProps> = ({ isOpen, onClose }) => {
  const [initialEvalPrompt, setInitialEvalPrompt] = useState<string>('');
  const [followUpPrompt, setFollowUpPrompt] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load settings when modal opens
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          // Remove format strings if they exist
          setInitialEvalPrompt(data.initialVisitPrompt.replace(/^format:\{[^}]*\}\n/gm, ''));
          setFollowUpPrompt(data.followUpVisitPrompt.replace(/^format:\{[^}]*\}\n/gm, ''));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();

    // Close modal on escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Close modal when clicking outside
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('Saving...');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initialVisitPrompt: initialEvalPrompt,
          followUpVisitPrompt: followUpPrompt,
          initialVisitDescription: 'System message for initial psychiatric evaluation visits',
          followUpVisitDescription: 'System message for follow-up psychiatric visits',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('Error: Failed to save settings');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-white">System Message Settings</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close settings"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">
              Initial Evaluation System Message
            </label>
            <textarea
              value={initialEvalPrompt}
              onChange={(e) => setInitialEvalPrompt(e.target.value)}
              className="w-full h-60 p-3 border rounded-lg resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter system message for initial psychiatric evaluations..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-200">
              Follow-Up Visit System Message
            </label>
            <textarea
              value={followUpPrompt}
              onChange={(e) => setFollowUpPrompt(e.target.value)}
              className="w-full h-60 p-3 border rounded-lg resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter system message for follow-up psychiatric visits..."
            />
          </div>

          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-green-600 dark:text-green-400">
              {saveStatus}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LindySettings; 