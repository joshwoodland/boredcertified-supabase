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

    // Add a single console message to help identify if old code is being used
    console.debug(
      '[SECURITY CHECK] Deepgram API integration is using secure server-side endpoints'
    );

    // Only set up the console.error override once
    const originalError = window.console.error;
    window.console.error = function(...args) {
      const message = args.join(' ');
      if (message.includes('NEXT_PUBLIC_DEEPGRAM_API_KEY') || 
          message.includes('Deepgram API key not found')) {
        console.warn(
          '[SECURITY NOTICE] Detected potential use of deprecated Deepgram pattern. ' +
          'Please ensure you are using the secure server-side implementation.'
        );
        setSecurityViolation(true);
      }
      originalError.apply(this, args);
    };

    // Clean up the console.error override when component unmounts
    return () => {
      window.console.error = originalError;
    };
  }, []); // Empty dependency array ensures this only runs once

  return securityViolation ? <DeepgramSecurityError /> : null;
}
