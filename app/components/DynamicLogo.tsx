'use client';

import { useEffect, useState } from 'react';

interface DynamicLogoProps {
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  forceWhite?: boolean;
}

export default function DynamicLogo({ className, style, alt = "Bored Certified Logo", forceWhite = false }: DynamicLogoProps) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Only check dark mode if not forcing white
    if (!forceWhite && typeof window !== 'undefined') {
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
  }, [forceWhite]);

  // Combine custom styles with filter if needed
  const combinedStyle = {
    ...style,
    filter: (isDarkMode || forceWhite) ? 'none' : 'invert(1)',
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