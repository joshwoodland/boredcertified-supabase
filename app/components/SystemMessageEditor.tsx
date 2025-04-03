import { useState, useRef, useEffect } from 'react';
import { FiMaximize2, FiX } from 'react-icons/fi';
import { flushSync } from 'react-dom';

interface SystemMessageEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function detectFormatting(content: string): { headings: Map<string, number>, cleanContent: string } {
  // Remove any existing format strings
  const cleanedContent = content.replace(/^format:\{[^}]*\}\n/gm, '');
  
  const lines = cleanedContent.split('\n');
  const headings = new Map<string, number>();
  
  lines.forEach(line => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      headings.set(text, level);
    }
  });

  return { headings, cleanContent: cleanedContent };
}

export default function SystemMessageEditor({ label, value, onChange }: SystemMessageEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const changeTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Remove format string from display value
    const displayValue = value.replace(/^format:\{[^}]*\}\n/gm, '');
    setLocalValue(displayValue);
  }, [value]);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (!isDirty || confirm('You have unsaved changes. Are you sure you want to close?')) {
      setIsExpanded(false);
      // Remove format string from display value
      const displayValue = value.replace(/^format:\{[^}]*\}\n/gm, '');
      setLocalValue(displayValue);
      setIsDirty(false);
    }
  };

  const handleClickOutside = (event: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      handleClose();
    }
  };

  const handleChange = (newValue: string) => {
    // Update the display value without format string
    setLocalValue(newValue);
    setIsDirty(true);
    
    const { headings, cleanContent } = detectFormatting(newValue);
    const formatGuide = Object.fromEntries(headings);
    
    // Only add format string if there are headings
    const formattedContent = Object.keys(formatGuide).length > 0 
      ? `format:${JSON.stringify(formatGuide)}\n${cleanContent}`
      : cleanContent;
    
    // Debounce the onChange callback
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }
    
    changeTimeoutRef.current = setTimeout(() => {
      onChange(formattedContent);
    }, 300);
  };

  const handleSave = () => {
    if (textareaRef.current) {
      textareaRef.current.blur();
      flushSync(() => {});
      requestAnimationFrame(() => {
        const finalValue = textareaRef.current ? textareaRef.current.value : localValue;
        const { headings, cleanContent } = detectFormatting(finalValue);
        const formatGuide = Object.fromEntries(headings);
        const formattedContent = Object.keys(formatGuide).length > 0 
          ? `format:${JSON.stringify(formatGuide)}\n${cleanContent}`
          : cleanContent;
        onChange(formattedContent);
        setIsDirty(false);
        setIsExpanded(false);
      });
    } else {
      const { headings, cleanContent } = detectFormatting(localValue);
      const formatGuide = Object.fromEntries(headings);
      const formattedContent = Object.keys(formatGuide).length > 0 
        ? `format:${JSON.stringify(formatGuide)}\n${cleanContent}`
        : cleanContent;
      onChange(formattedContent);
      setIsDirty(false);
      setIsExpanded(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2 dark:text-dark-text">
        {label}
      </label>
      
      <div className="relative">
        <textarea
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            setIsDirty(true);
            handleChange(e.target.value);
          }}
          className="w-full h-32 p-2 border rounded-md resize-none dark:bg-dark-accent dark:border-dark-border dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:!bg-dark-accent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/50 [&::-webkit-scrollbar-corner]:!bg-dark-accent"
          placeholder={`Enter the system message for ${label.toLowerCase()}...`}
        />
        <button
          onClick={() => setIsExpanded(true)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-accent"
          aria-label="Expand editor"
        >
          <FiMaximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Popup Editor */}
      {isExpanded && (
        <>
          {/* Dimming overlay */}
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" onClick={handleClickOutside} />
          
          {/* Modal */}
          <div 
            className="fixed inset-4 z-50 flex items-center justify-center"
            onClick={handleClickOutside}
          >
            <div
              ref={modalRef}
              className="bg-white dark:bg-dark-secondary rounded-lg w-full h-full overflow-hidden relative flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-6 border-b dark:border-dark-border">
                <h3 className="text-xl font-medium dark:text-dark-text">{label}</h3>
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
                  aria-label="Close editor"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 p-6 min-h-0">
                <textarea
                  ref={textareaRef}
                  value={localValue}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-full h-full p-6 border rounded-lg resize-none dark:bg-dark-accent dark:border-dark-border dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:!bg-dark-accent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/50 [&::-webkit-scrollbar-corner]:!bg-dark-accent"
                  placeholder={`Enter the system message for ${label.toLowerCase()}...`}
                  spellCheck={false}
                />
              </div>

              <div className="p-6 border-t dark:border-dark-border flex justify-end bg-white dark:bg-dark-secondary">
                {isDirty && (
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-base"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 