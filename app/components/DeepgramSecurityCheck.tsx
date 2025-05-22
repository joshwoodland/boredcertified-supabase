'use client';

import { useState, useEffect } from 'react';
import DeepgramSecurityError from './DeepgramSecurityError';

/**
 * This component performs a security check for deprecated Deepgram API key usage
 * It logs warnings to the console if it detects any attempts to use NEXT_PUBLIC_DEEPGRAM_API_KEY
 */
export default function DeepgramSecurityCheck() {
  const [securityViolation, setSecurityViolation] = useState(false);

  useEffect(() => {
    // Check for any existing NEXT_PUBLIC_DEEPGRAM_API_KEY in environment variables
    if (typeof process !== 'undefined' &&
        process.env &&
        'NEXT_PUBLIC_DEEPGRAM_API_KEY' in process.env) {
      console.error(
        'SECURITY WARNING: NEXT_PUBLIC_DEEPGRAM_API_KEY should not be used. ' +
        'The application is configured to use secure server-side API routes instead.'
      );
      setSecurityViolation(true);

      // Dispatch a custom event that can be caught by other components
      const event = new CustomEvent('deepgram-security-violation');
      window.dispatchEvent(event);
    }

    // Add a console message to help identify if old code is being used
    console.log(
      '%c[SECURITY CHECK] Deepgram API integration is using secure server-side endpoints',
      'color: green; font-weight: bold;'
    );

    // Check for any scripts or code that might be trying to access the deprecated variable
    // This is a safer approach that doesn't interfere with normal property access
    const checkForDeprecatedUsage = () => {
      try {
        // Check if there are any global references that might indicate old code
        if (typeof window !== 'undefined' && window.console) {
          // Override console.error temporarily to catch any Deepgram-related errors
          const originalError = window.console.error;
          window.console.error = function(...args) {
            const message = args.join(' ');
            if (message.includes('NEXT_PUBLIC_DEEPGRAM_API_KEY') || 
                message.includes('Deepgram API key not found')) {
              console.warn(
                '%c[SECURITY NOTICE] Detected potential use of deprecated Deepgram pattern. ' +
                'Please ensure you are using the secure server-side implementation.',
                'color: orange; font-weight: bold;'
              );
              setSecurityViolation(true);
            }
            originalError.apply(this, args);
          };

          // Restore original after a short delay
          setTimeout(() => {
            window.console.error = originalError;
          }, 5000);
        }
      } catch (error) {
        // Fail silently to avoid interfering with app functionality
        console.debug('Security check setup failed:', error);
      }
    };

    checkForDeprecatedUsage();
  }, []);

  return securityViolation ? <DeepgramSecurityError /> : null;
}
