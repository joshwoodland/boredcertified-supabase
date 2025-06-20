import { useEffect, useState, useCallback } from 'react';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp', 
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA'
];

export function useKonami() {
  const [isRainbow, setIsRainbow] = useState(false);
  const [keySequence, setKeySequence] = useState<string[]>([]);

  const resetSequence = useCallback(() => {
    setKeySequence([]);
  }, []);

  const activateRainbow = useCallback(() => {
    setIsRainbow(true);
    setTimeout(() => {
      setIsRainbow(false);
    }, 3000);
    resetSequence();
  }, [resetSequence]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Update the key sequence
      setKeySequence(prev => {
        const newSequence = [...prev, event.code];
        
        // Keep only the last 10 keys (length of Konami code)
        if (newSequence.length > KONAMI_CODE.length) {
          newSequence.shift();
        }
        
        // Check if we match the Konami code
        if (newSequence.length === KONAMI_CODE.length) {
          const matches = newSequence.every((key, index) => key === KONAMI_CODE[index]);
          if (matches) {
            activateRainbow();
            return [];
          }
        }
        
        return newSequence;
      });
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activateRainbow]);

  return {
    isRainbow,
    activateRainbow,
    resetSequence
  };
} 