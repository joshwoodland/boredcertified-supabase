'use client';

import { useForm } from 'react-hook-form';
import { useAppSettings } from '@/app/providers/AppSettingsProvider';
import { AppSettings } from '@/app/lib/supabaseTypes';
import { useEffect, useState } from 'react';
import Toast from './Toast';

interface SettingsFormData {
  providerName: string;
  supervisor: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { settings, updateSettings, isLoading } = useAppSettings();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProviderNameEditable, setIsProviderNameEditable] = useState(false);
  const [showNameChangeConfirmation, setShowNameChangeConfirmation] = useState(false);
  
  const {
    register,
    reset,
    watch,
    formState: { isDirty }
  } = useForm<SettingsFormData>({
    defaultValues: {
      providerName: '',
      supervisor: '',
      initialVisitPrompt: '',
      followUpVisitPrompt: '',
    }
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      reset({
        providerName: settings.providerName,
        supervisor: settings.supervisor || '',
        initialVisitPrompt: settings.initialVisitPrompt,
        followUpVisitPrompt: settings.followUpVisitPrompt,
      });
    }
  }, [settings, reset]);

  // Auto-save functionality - watch all fields and save when they change
  const watchedValues = watch();
  useEffect(() => {
    if (settings && isDirty) {
      const saveChanges = async () => {
        try {
          await updateSettings({
            ...watchedValues,
            // Keep the locked settings
            darkMode: true,
            autoSave: true,
            gptModel: 'gpt-4o', // Always locked to GPT-4o
          });
          // Brief success feedback
          setToast({ message: 'Settings saved', type: 'success' });
          setTimeout(() => setToast(null), 2000);
        } catch (error) {
          setToast({ 
            message: error instanceof Error ? error.message : 'Failed to save settings', 
            type: 'error' 
          });
          setTimeout(() => setToast(null), 5000);
        }
      };

      // Debounce the save to avoid too many API calls
      const timeoutId = setTimeout(saveChanges, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [watchedValues, isDirty, settings, updateSettings]);

  const handleClose = () => {
    onClose(); // No need to check for unsaved changes since we auto-save
  };

  const handleNameChangeRequest = () => {
    setShowNameChangeConfirmation(true);
  };

  const handleNameChangeConfirm = () => {
    setIsProviderNameEditable(true);
    setShowNameChangeConfirmation(false);
  };

  const handleNameChangeCancel = () => {
    setShowNameChangeConfirmation(false);
  };

  const handleSaveProviderName = () => {
    setIsProviderNameEditable(false);
    // The auto-save functionality will handle saving the changes
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
              {isDirty && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Auto-saving changes...
                </p>
              )}
            </div>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Provider Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Provider Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Provider Name
              </label>
              <div className="relative">
                <input
                  {...register('providerName')}
                  type="text"
                  readOnly={!isProviderNameEditable}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 ${
                    isProviderNameEditable 
                      ? 'bg-white dark:bg-gray-800' 
                      : 'bg-gray-50 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                  placeholder="Your provider name will appear here"
                />
                {isProviderNameEditable && (
                  <button
                    type="button"
                    onClick={handleSaveProviderName}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This is the name that will appear on your SOAP notes – use your full legal name.
              </p>
              {!isProviderNameEditable && settings?.providerName && (
                <button
                  type="button"
                  onClick={handleNameChangeRequest}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm mt-2 underline"
                >
                  I need to change my name
                </button>
              )}
            </div>
          </div>

          {/* Model Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Model Settings</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GPT Model
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed">
                GPT-4o (locked)
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Model is locked to GPT-4o for optimal performance
              </p>
            </div>
          </div>

          {/* SOAP Note Templates */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">SOAP Note Preferences</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add your additional preferences to customize the standardized SOAP note templates.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Initial Visit Additional Preferences
                </label>
                <textarea
                  {...register('initialVisitPrompt')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Add any specific preferences for Initial Evaluation notes here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Follow-up Visit Additional Preferences
                </label>
                <textarea
                  {...register('followUpVisitPrompt')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Add any specific preferences for Follow-up Visit notes here..."
                />
              </div>
            </div>
          </div>

        </div>

        {/* Name Change Confirmation Modal */}
        {showNameChangeConfirmation && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Are you sure?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This is the name that will appear on your notes, so make sure to use the name used on your nursing licenses.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleNameChangeCancel}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNameChangeConfirm}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}
