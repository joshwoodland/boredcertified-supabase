import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';

interface AIMagicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (editRequest: string) => void;
  isLoading: boolean;
}

export default function AIMagicModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}: AIMagicModalProps) {
  const [editRequest, setEditRequest] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(editRequest);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiX className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          AI Magic Editor
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="editRequest"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              What would you like to change in the note?
            </label>
            <textarea
              id="editRequest"
              value={editRequest}
              onChange={(e) => setEditRequest(e.target.value)}
              className="w-full h-40 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              placeholder="Describe the changes you want to make..."
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-md hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
              disabled={isLoading || !editRequest.trim()}
            >
              {isLoading ? 'Processing...' : 'Apply AI Magic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 