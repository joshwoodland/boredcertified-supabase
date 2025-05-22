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
    // Check for any attempts to use the deprecated NEXT_PUBLIC_DEEPGRAM_API_KEY
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

    // Monitor for any attempts to access NEXT_PUBLIC_DEEPGRAM_API_KEY
    const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    Object.getOwnPropertyDescriptor = function(obj, prop) {
      if (obj === process?.env && prop === 'NEXT_PUBLIC_DEEPGRAM_API_KEY') {
        console.error(
          '%c[SECURITY VIOLATION] Attempted to access NEXT_PUBLIC_DEEPGRAM_API_KEY. ' +
          'This is a security risk and should not be used.',
          'color: red; font-weight: bold;'
        );
        console.trace('Stack trace for NEXT_PUBLIC_DEEPGRAM_API_KEY access attempt:');

        setSecurityViolation(true);

        // Dispatch a custom event that can be caught by other components
        const event = new CustomEvent('deepgram-security-violation');
        window.dispatchEvent(event);
      }
      // Fix TypeScript error by explicitly passing the arguments as an array
      return originalGetOwnPropertyDescriptor.call(this, obj, prop);
    };

    return () => {
      // Restore original method when component unmounts
      Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
    };
  }, []);

  return securityViolation ? <DeepgramSecurityError /> : null;
}
