'use client';

import { useEffect, useState } from 'react';

interface DynamicLogoProps {
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export default function DynamicLogo({ className, style, alt = "Bored Certified Logo" }: DynamicLogoProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Initialize the mode from document class on mount
    if (typeof window !== 'undefined') {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
      
      // Create a mutation observer to watch for class changes on html element
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
          }
        });
      });
      
      // Start observing document for theme changes
      observer.observe(document.documentElement, { attributes: true });
      
      // Cleanup
      return () => observer.disconnect();
    }
  }, []);

  // Combine custom styles with filter if needed
  const combinedStyle = {
    ...style,
    filter: isDarkMode ? 'none' : 'invert(1)',
  };

  return (
    <img
      src="/logo.png"
      alt={alt}
      className={className}
      style={combinedStyle}
    />
  );
} 