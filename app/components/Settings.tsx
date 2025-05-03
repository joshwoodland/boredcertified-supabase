'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiSettings, FiMoon, FiSun, FiX, FiInfo } from 'react-icons/fi';
import Toast from './Toast';
import SystemMessageEditor from './SystemMessageEditor';
import ConfirmationDialog from './ConfirmationDialog';
import { flushSync } from 'react-dom';
import { MODEL_OPTIONS } from '@/app/config/models';
import { invalidateModelCache } from '@/app/utils/modelCache';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  lowEchoCancellation?: boolean;
  email?: string | null;
}

type SaveButtonState = 'hidden' | 'unsaved' | 'saved' | 'saving' | 'error';

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: true,
    gptModel: 'gpt-4o',
    initialVisitPrompt: '',
    followUpVisitPrompt: '',
    lowEchoCancellation: false,
    email: null,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>('hidden');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const initialRender = useRef(true);
  const initialSettings = useRef<AppSettings | null>(null);
  const saveTimeoutId = useRef<NodeJS.Timeout | undefined>(undefined);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const mouseDownTime = useRef<number>(0);
  const isSelectingText = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const handleSave = async () => {
    setSaveButtonState('saving');
    try {
      const currentSettings = settingsRef.current;
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          darkMode: currentSettings.darkMode,
          gptModel: currentSettings.gptModel,
          initialVisitPrompt: currentSettings.initialVisitPrompt,
          followUpVisitPrompt: currentSettings.followUpVisitPrompt,
          lowEchoCancellation: currentSettings.lowEchoCancellation,
          email: currentSettings.email,
          initialVisitDescription: 'System message for initial psychiatric evaluation visits',
          followUpVisitDescription: 'System message for follow-up psychiatric visits',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();

      // Only update the initialSettings reference, don't change current settings
      initialSettings.current = { ...currentSettings };

      // Invalidate the model cache to ensure we use the new settings
      invalidateModelCache();

      setIsDirty(false);
      setSaveButtonState('saved');
      setToast({ message: 'Settings saved successfully', type: 'success' });

      // Reset save button state after a delay
      setTimeout(() => {
        setSaveButtonState('hidden');
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveButtonState('error');
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
  };

  const handleClose = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (isDirty) {
      setShowConfirmation(true);
    } else {
      document.documentElement.classList.remove('modal-open');
      onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirmClose = () => {
    if (typeof window === 'undefined') return;

    document.documentElement.classList.remove('modal-open');
    setShowConfirmation(false);
    onClose();
  };

  const handleChange = useCallback((changes: Partial<AppSettings>) => {
    console.log('handleChange called with:', changes);

    if (saveTimeoutId.current) {
      console.log('Clearing existing save timeout');
      clearTimeout(saveTimeoutId.current);
      saveTimeoutId.current = undefined;
    }

    // Update settings immediately
    setSettings(currentSettings => {
      const newSettings = { ...currentSettings, ...changes };
      settingsRef.current = newSettings; // Update the ref immediately
      console.log('Updating settings:', {
        currentSettings,
        changes,
        newSettings
      });
      return newSettings;
    });

    setIsDirty(true);
    setSaveButtonState('unsaved');

    // Schedule save if no save is in progress
    if (!savePromiseRef.current) {
      console.log('Scheduling new save operation');
      saveTimeoutId.current = setTimeout(() => {
        console.log('Save timeout triggered, current settings:', settingsRef.current);
        handleSave();
      }, 1000);
    } else {
      console.log('Save already in progress, skipping new save schedule');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(event: MouseEvent) {
      mouseDownTime.current = Date.now();
    }

    function handleMouseUp(event: MouseEvent) {
      const mouseUpTime = Date.now();
      const timeDiff = mouseUpTime - mouseDownTime.current;
      const isDragging = timeDiff > 200;

      if (!isDragging) {
        const target = event.target as Node;
        const isOutsideClick = modalRef.current && !modalRef.current.contains(target);

        if (isOutsideClick) {
          event.preventDefault();
          event.stopPropagation();
          handleClose();
        }
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 's' && isOpen && isDirty) {
        event.preventDefault();
        handleSave();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isDirty, handleSave]);

  useEffect(() => {
    if (isOpen && initialRender.current) {
      fetchSettings();
      initialRender.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      // Update settings with the response data
      const newSettings = {
        darkMode: data.darkMode,
        gptModel: data.gptModel,
        initialVisitPrompt: data.initialVisitPrompt,
        followUpVisitPrompt: data.followUpVisitPrompt,
        lowEchoCancellation: data.lowEchoCancellation || false,
        email: data.email || null,
      };

      setSettings(newSettings);
      initialSettings.current = newSettings;
      setIsDirty(false);
      setSaveButtonState('hidden');
    } catch (error) {
      console.error('Error fetching settings:', error);
      if (!initialSettings.current) {
        initialSettings.current = settings;
      }
      setToast({ message: 'Failed to load settings', type: 'error' });
    }
  };

  useEffect(() => {
    if (initialSettings.current) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings.current);
      console.log('Settings change detected:', {
        current: settings,
        initial: initialSettings.current,
        hasChanges
      });
      setIsDirty(hasChanges);
      setSaveButtonState(hasChanges ? 'unsaved' : 'hidden');
    }
  }, [settings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutId.current) {
        clearTimeout(saveTimeoutId.current);
        saveTimeoutId.current = undefined;
      }
    };
  }, []);

  const renderSaveStatus = () => {
    if (isSaving) {
      return (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600 dark:text-dark-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving your edits...
        </span>
      );
    }

    if (saveButtonState === 'saved') {
      return (
        <span className="flex items-center text-green-600 dark:text-green-400">
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Edits saved
        </span>
      );
    }

    if (saveButtonState === 'unsaved') {
      return (
        <span className="flex items-center text-gray-600 dark:text-dark-muted">
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
          Unsaved changes
        </span>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Container - Higher z-index to cover everything */}
      <div className="fixed inset-0 z-[9999] isolate">
        {/* Backdrop - Semi-transparent overlay */}
        <div
          className="fixed inset-0 bg-black/30"
          aria-hidden="true"
          onClick={handleClose}
        />

        {/* Modal Content */}
        <div className="relative flex items-center justify-center min-h-screen p-4 z-[10000]">
          <div
            ref={modalRef}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold dark:text-white flex items-center gap-2">
                  <FiSettings className="w-6 h-6" />
                  Settings
                </h2>
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-200">Dark Mode</span>
                    {settings.darkMode ? <FiMoon /> : <FiSun />}
                  </div>
                  <div className="relative inline-block w-12 align-middle select-none">
                    <button
                      role="switch"
                      aria-checked={settings.darkMode}
                      onClick={() => handleChange({ darkMode: !settings.darkMode })}
                      className={`
                        relative block w-12 h-6 rounded-full
                        ${settings.darkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                        transition-colors duration-200
                      `}
                    >
                      <span
                        className={`
                          absolute top-1/2 left-1 -translate-y-1/2
                          h-4 w-4 rounded-full bg-white shadow
                          transform transition-transform duration-200 ease-in-out
                          ${settings.darkMode ? 'translate-x-6' : ''}
                        `}
                      />
                    </button>
                  </div>
                </div>

                {/* Low Echo Cancellation Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-200">Low Echo Cancellation</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Disables echo cancellation to help capture patient audio from speakers
                    </p>
                  </div>
                  <div className="relative inline-block w-12 align-middle select-none">
                    <button
                      role="switch"
                      aria-checked={settings.lowEchoCancellation}
                      onClick={() => handleChange({ lowEchoCancellation: !settings.lowEchoCancellation })}
                      className={`
                        relative block w-12 h-6 rounded-full
                        ${settings.lowEchoCancellation ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                        transition-colors duration-200
                      `}
                    >
                      <span
                        className={`
                          absolute top-1/2 left-1 -translate-y-1/2
                          h-4 w-4 rounded-full bg-white shadow
                          transform transition-transform duration-200 ease-in-out
                          ${settings.lowEchoCancellation ? 'translate-x-6' : ''}
                        `}
                      />
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="block text-gray-700 dark:text-gray-200">
                    GPT Model
                  </label>
                  <div className="space-y-2">
                    {MODEL_OPTIONS.map((model) => (
                      <div
                        key={model.value}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="radio"
                          id={model.value}
                          name="gptModel"
                          value={model.value}
                          checked={settings.gptModel === model.value}
                          onChange={(e) => handleChange({ gptModel: e.target.value })}
                          className="text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600"
                        />
                        <label
                          htmlFor={model.value}
                          className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                        >
                          {model.label}
                          {model.isRecommended && (
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                          <FiInfo
                            className="text-gray-400 cursor-help"
                            title={model.description}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SOAP Note Templates */}
                <div className="space-y-4">
                  <SystemMessageEditor
                    label="Initial Visit SOAP Note Template"
                    value={settings.initialVisitPrompt}
                    onChange={(value) => handleChange({ initialVisitPrompt: value })}
                  />
                  <SystemMessageEditor
                    label="Follow-up Visit SOAP Note Template"
                    value={settings.followUpVisitPrompt}
                    onChange={(value) => handleChange({ followUpVisitPrompt: value })}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t dark:border-dark-border">
              <div className="flex justify-end">
                {renderSaveStatus()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <ConfirmationDialog
          isOpen={true}
          onConfirm={handleConfirmClose}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </>
  );
}
