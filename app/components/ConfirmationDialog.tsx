import { FiAlertCircle } from 'react-icons/fi';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({ isOpen, onConfirm, onCancel }: ConfirmationDialogProps) {
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
          className="bg-white dark:bg-dark-secondary rounded-lg w-full max-w-sm overflow-hidden shadow-xl animate-bounce-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-center dark:text-dark-text">
              Are you sure you want to go back without saving changes?
            </h3>
          </div>
          
          <div className="flex border-t dark:border-dark-border">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 px-6 py-4 text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-accent transition-colors font-medium border-r dark:border-dark-border"
            >
              Don't save
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="flex-1 px-6 py-4 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-dark-accent transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 