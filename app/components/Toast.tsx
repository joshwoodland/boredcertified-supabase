import { useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[type];

  const Icon = {
    success: FiCheckCircle,
    error: FiAlertCircle,
    info: FiInfo,
  }[type];

  return (
    <div
      className={`fixed bottom-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg 
        flex items-center gap-2 animate-fade-in z-50`}
      role="alert"
    >
      <Icon className="w-5 h-5" />
      <span>{message}</span>
    </div>
  );
} 