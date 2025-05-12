import React, { useEffect } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  let bgColor = 'bg-blue-500'; // Default for info
  let Icon = FiInfo;

  if (type === 'success') {
    bgColor = 'bg-green-500';
    Icon = FiCheck;
  } else if (type === 'error') {
    bgColor = 'bg-red-500';
    Icon = FiAlertCircle;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3`}>
        <Icon className="w-5 h-5" />
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200 focus:outline-none"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}