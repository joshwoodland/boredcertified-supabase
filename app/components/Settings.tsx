'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiSettings, FiMoon, FiSun, FiX, FiInfo } from 'react-icons/fi';
import Toast from './Toast';
import SystemMessageEditor from './SystemMessageEditor';
import ConfirmationDialog from './ConfirmationDialog';
import { flushSync } from 'react-dom';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    gptModel: 'gpt-4',
    initialVisitPrompt: '',
    followUpVisitPrompt: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveButtonState, setSaveButtonState] = useState<'hidden' | 'unsaved' | 'saved'>('hidden');
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

  const handleSave = useCallback(async () => {
    console.log('handleSave triggered', { 
      currentSettings: settingsRef.current,
      isSaveInProgress: !!savePromiseRef.current 
    });

    if (savePromiseRef.current) {
      console.log('Save already in progress, waiting...');
      await savePromiseRef.current;
    }

    const startTime = Date.now();

    const settingsToSave = {
      ...settingsRef.current,
      initialVisitDescription: 'System message for initial psychiatric evaluation visits',
      followUpVisitDescription: 'System message for follow-up psychiatric visits',
    };

    console.log('Preparing to save settings:', settingsToSave);

    try {
      savePromiseRef.current = new Promise(async (resolve, reject) => {
        try {
          console.log('Starting save operation');
          setIsSaving(true);
          const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsToSave),
          });
          
          const data = await response.json();
          console.log('Save response received:', { ok: response.ok, data });
          
          if (!response.ok) {
            throw new Error(data.error || data.details || 'Failed to save settings');
          }
          
          initialSettings.current = settingsToSave;
          console.log('Updated initialSettings:', initialSettings.current);
          
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < 500) {
            await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
          }
          
          setIsDirty(false);
          setSaveButtonState('saved');
          resolve();
        } catch (error) {
          console.error('Save error:', error);
          setToast({ 
            message: error instanceof Error ? error.message : 'Failed to save settings', 
            type: 'error' 
          });
          reject(error);
        } finally {
          console.log('Save operation completed');
          setIsSaving(false);
        }
      });

      await savePromiseRef.current;
    } finally {
      savePromiseRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowConfirmation(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleChange = useCallback((changes: Partial<AppSettings>) => {
    console.log('handleChange called with:', changes);

    if (saveTimeoutId.current) {
      console.log('Clearing existing save timeout');
      clearTimeout(saveTimeoutId.current);
      saveTimeoutId.current = undefined;
    }

    flushSync(() => {
      setSettings(currentSettings => {
        const newSettings = { ...currentSettings, ...changes };
        console.log('Updating settings:', {
          currentSettings,
          changes,
          newSettings
        });
        return newSettings;
      });
    });

    setIsDirty(true);
    setSaveButtonState('unsaved');

    if (!savePromiseRef.current) {
      console.log('Scheduling new save operation');
      saveTimeoutId.current = setTimeout(() => {
        console.log('Save timeout triggered, current settings:', settings);
        handleSave();
      }, 1000);
    } else {
      console.log('Save already in progress, skipping new save schedule');
    }
  }, [handleSave, settings]);

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
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
      initialSettings.current = data;
      setIsDirty(false);
    } catch (error) {
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

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {showConfirmation && (
        <div className="fixed inset-0 z-[100]">
          <ConfirmationDialog
            isOpen={showConfirmation}
            onConfirm={async () => {
              await handleSave();
              setShowConfirmation(false);
              onClose();
            }}
            onCancel={() => {
              setShowConfirmation(false);
              onClose();
            }}
          />
        </div>
      )}

      <div className="fixed inset-0 bg-black opacity-50 z-[40]" />

      <div className="fixed inset-0 z-[50] flex items-center justify-center">
        <div
          ref={modalRef}
          className="bg-white dark:bg-dark-secondary rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative"
        >
          <div className="p-6 border-b dark:border-dark-border sticky top-0 bg-white dark:bg-dark-secondary z-[51] flex justify-between items-center">
            <h2 id="settings-title" className="text-2xl font-semibold flex items-center gap-2 dark:text-dark-text">
              <FiSettings className="w-6 h-6" />
              Settings
            </h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
              aria-label="Close settings"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-10 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 dark:text-dark-text">
                {settings.darkMode ? <FiMoon /> : <FiSun />}
                Dark Mode
              </label>
              <button
                onClick={() => handleChange({ darkMode: !settings.darkMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.darkMode ? 'bg-blue-500' : 'bg-gray-200 dark:bg-dark-accent'
                }`}
                role="switch"
                aria-checked={settings.darkMode}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-dark-text">
                GPT Model
              </label>
              <select
                value={settings.gptModel}
                onChange={(e) => handleChange({ gptModel: e.target.value })}
                className="w-full p-2 border rounded-md dark:bg-dark-accent dark:border-dark-border dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="gpt-4">GPT-4 (Base)</option>
                <option value="gpt-4-turbo-preview">GPT-4 Turbo (4o) - Recommended</option>
                <option value="gpt-4-0314">GPT-4 March (o1)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Base)</option>
                <option value="gpt-3.5-turbo-0125">GPT-3.5 Turbo Mini (3o-mini)</option>
                <option value="gpt-3.5-turbo-0301">GPT-3.5 Turbo Mini (o3-mini - Newest)</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-muted">
                Select the model to use for generating SOAP notes. GPT-4 Turbo is recommended for best results.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center mb-4">
                  <h3 className="text-lg font-medium dark:text-dark-text">
                    Chat GPT System Messages
                  </h3>
                  <div className="relative inline-flex ml-2">
                    <button
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors focus:outline-none group"
                      aria-label="Information about system messages"
                    >
                      <FiInfo className="w-4 h-4" />
                      <div className="hidden group-hover:block absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 p-2 bg-white dark:bg-dark-secondary rounded-md shadow-lg">
                        These are your specific instructions for Chat GPT to create your note how you want it.
                      </div>
                    </button>
                  </div>
                </div>
                <div className="space-y-4 [&_textarea]:!bg-dark-accent [&_textarea]:!border-dark-border [&_textarea]:!text-dark-text [&::-webkit-scrollbar-track]:!bg-dark-accent [&::-webkit-scrollbar-thumb]:!bg-gray-500/50 [&::-webkit-scrollbar-corner]:!bg-dark-accent">
                  <SystemMessageEditor
                    label="Initial Visit System Message"
                    value={settings.initialVisitPrompt}
                    onChange={(value) => handleChange({ initialVisitPrompt: value })}
                  />
                  <SystemMessageEditor
                    label="Follow-up Visit System Message"
                    value={settings.followUpVisitPrompt}
                    onChange={(value) => handleChange({ followUpVisitPrompt: value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t dark:border-dark-border flex justify-end bg-white dark:bg-dark-secondary items-center">
            <div className="text-sm text-gray-600 dark:text-dark-muted">
              {renderSaveStatus()}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
} 