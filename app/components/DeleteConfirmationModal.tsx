import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  noteDate: string;
}

export default function DeleteConfirmationModal({ 
  isOpen, 
  onConfirm, 
  onCancel,
  noteDate
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Dimming overlay */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[150]" onClick={handleBackdropClick} />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-[151] flex items-center justify-center p-4" onClick={handleBackdropClick}>
        <div 
          className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-sm overflow-hidden shadow-xl animate-bounce-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-center mb-4 text-red-500">
              <FiAlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-medium text-center dark:text-gray-100">
              Are you sure you want to delete this note from {noteDate}?
            </h3>
            <p className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">
              This action cannot be undone.
            </p>
          </div>
          
          <div className="flex border-t dark:border-gray-700">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 px-6 py-4 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium border-r dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="flex-1 px-6 py-4 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
