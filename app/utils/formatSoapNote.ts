import { extractContent } from './safeJsonParse';

/**
 * Formats markdown-style SOAP notes into clean HTML with structured sections
 *
 * @param inputText - The raw markdown-formatted SOAP note from the API
 * @returns Properly formatted HTML with styled headings and sections
 */
export function formatSoapNote(inputText: string): string {
  if (!inputText) return '';

  // If the input might be JSON, extract the content safely
  let markdownText = typeof inputText === 'string' ? extractContent(inputText) : inputText;

  // Remove AI instruction text that might appear at the beginning of the note
  const telehealthSectionIndex = markdownText.indexOf('Telehealth Session Details');
  if (telehealthSectionIndex > 0) {
    const lastBreakBeforeTelehealth = markdownText.lastIndexOf('\n', telehealthSectionIndex);
    if (lastBreakBeforeTelehealth > 0) {
      markdownText = markdownText.substring(lastBreakBeforeTelehealth + 1);
    }
  }

  // Define the standard section headers
  const sectionHeaders = [
    'Telehealth Session Details',
    'Subjective',
    'Objective', 
    'Assessment',
    'Plan',
    'Therapy Note',
    'Coding'
  ];

  // Define the main SOAP section headers that should be emphasized
  const mainSoapHeaders = [
    'Subjective',
    'Objective',
    'Assessment', 
    'Plan'
  ];

  let formattedText = markdownText;

  // AGGRESSIVE CLEANUP: Remove all stray formatting artifacts first
  // Remove isolated colons and dashes
  formattedText = formattedText.replace(/^[\s\-]*:\s*$/gm, '');
  formattedText = formattedText.replace(/\n[\s\-]*:\s*\n/g, '\n');
  formattedText = formattedText.replace(/:\s*-\s*/g, ': ');
  formattedText = formattedText.replace(/-\s*:\s*/g, '');
  formattedText = formattedText.replace(/^-\s*$/gm, '');
  formattedText = formattedText.replace(/\n-\s*\n/g, '\n');
  
  // Remove "Added Today:" artifacts and standalone colons
  formattedText = formattedText.replace(/^[\s\-]*Added Today[\s\-]*:?\s*$/gm, '');
  formattedText = formattedText.replace(/\n[\s\-]*Added Today[\s\-]*:?\s*\n/g, '\n');
  formattedText = formattedText.replace(/Added Today\s*:\s*/g, '');
  
  // COMPREHENSIVE COLON FIXING: Handle all possible line-break-before-colon patterns
  
  // 1. Fix patterns like "Label\n: Content" -> "Label: Content" (most common case)
  formattedText = formattedText.replace(/([A-Za-z0-9\s\*\-\.]+)\n\s*:\s*/g, '$1: ');
  
  // 2. Fix patterns where colon is completely on its own line with content after
  formattedText = formattedText.replace(/\n\s*:\s*([A-Za-z])/g, ': $1');
  
  // 3. Remove standalone colons at beginning of lines
  formattedText = formattedText.replace(/^:\s*/gm, '');
  
  // 4. Fix specific problematic telehealth section patterns
  formattedText = formattedText.replace(/(Mode of Communication|Patient Location|Provider Location|Consent Obtained|Other Participants|Before Visit|After Visit)\s*\n\s*:\s*/g, '$1: ');
  
  // 5. Fix bold markdown patterns that got broken: "**Label**\n: Content" -> "**Label**: Content"
  formattedText = formattedText.replace(/(\*\*[^*]+\*\*)\s*\n\s*:\s*/g, '$1: ');
  
  // 6. Fix any remaining word-colon-newline patterns
  formattedText = formattedText.replace(/([A-Za-z])\n\s*:\s*([A-Za-z])/g, '$1: $2');
  
  // 7. Fix patterns where there are multiple spaces or tabs before the colon
  formattedText = formattedText.replace(/([A-Za-z0-9\s\*]+)\s{2,}:\s*/g, '$1: ');
  
  // 8. Remove any remaining standalone colons in the middle of lines
  formattedText = formattedText.replace(/\n\s*:\s*\n/g, '\n');
  formattedText = formattedText.replace(/\n\s*:\s*$/gm, '');
  
  // 9. Final cleanup for any remaining broken colon patterns
  formattedText = formattedText.replace(/([A-Za-z0-9\s\*\-]+[A-Za-z0-9\*])\s*\n+\s*:\s*/g, '$1: ');

  // Process headings (## Heading -> styled headers)
  formattedText = formattedText.replace(/^#{1,3}\s+(.*?)$/gm, (_, heading) => {
    const cleanHeading = heading.trim();
    const isNumberedPlanItem = /^\d+\.\s+.*?Plan$/i.test(cleanHeading);
    
    const isStandardSection = sectionHeaders.some(header =>
      cleanHeading.toLowerCase().includes(header.toLowerCase())
    ) && !isNumberedPlanItem;

    if (isStandardSection) {
      const isMainSoapHeader = mainSoapHeaders.some(header =>
        cleanHeading.toLowerCase().includes(header.toLowerCase())
      );
      return `<div class="soap-section-header${isMainSoapHeader ? ' soap-main-header' : ''}">${cleanHeading}</div>`;
    }

    return `<strong>${cleanHeading}</strong>`;
  });

  // Process bold text
  formattedText = formattedText.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>');
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert bullet points to HTML lists (simple approach)
  formattedText = formattedText.replace(/^[\s]*-\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive list items in ul tags
  formattedText = formattedText.replace(/(<li>.*<\/li>)(\n<li>.*<\/li>)*/g, (match) => {
    return `<ul class="pl-4 my-1">${match}</ul>`;
  });

  // Convert newlines to breaks
  formattedText = formattedText.replace(/\n/g, '<br>');

  // Final cleanup - remove multiple consecutive breaks
  formattedText = formattedText.replace(/(<br>\s*){3,}/g, '<br><br>');
  
  // Wrap in container
  formattedText = `<div class="soap-note-container">${formattedText}</div>`;

  return formattedText;
}

/**
 * Formats markdown-style SOAP notes into plain text with minimal formatting
 *
 * @param inputText - The raw markdown-formatted SOAP note from the API
 * @returns Clean plain text format without markdown symbols
 */
export function formatSoapNotePlainText(inputText: string): string {
  if (!inputText) return '';

  // If the input might be JSON, extract the content safely
  let extractedText = typeof inputText === 'string'
    ? extractContent(inputText)
    : inputText;

  // Remove AI instruction text that might appear at the beginning of the note
  const telehealthSectionIndex = extractedText.indexOf('Telehealth Session Details');
  if (telehealthSectionIndex > 0) {
    const lastBreakBeforeTelehealth = extractedText.lastIndexOf('\n', telehealthSectionIndex);
    if (lastBreakBeforeTelehealth > 0) {
      extractedText = extractedText.substring(lastBreakBeforeTelehealth + 1);
    }
  }

  // Remove heading markers but keep the heading text
  let formattedText = extractedText.replace(/^#{1,3}\s+(.*?)$/gm, '$1');

  // Remove bold markers but keep the text
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '$1');

  // Replace bullet points with standard dashes
  formattedText = formattedText.replace(/^\s*-\s+/gm, '- ');

  return formattedText;
}

/**
 * Formats markdown-style SOAP notes into plain text format suitable for copying to clipboard
 * This preserves the visual formatting without HTML tags or markdown symbols
 *
 * @param inputText - The raw markdown-formatted SOAP note from the API
 * @returns Clean plain text format with proper spacing and formatting for pasting into patient charts
 */
export function formatSoapNoteForCopy(inputText: string): string {
  if (!inputText) return '';

  // If the input might be JSON, extract the content safely
  let extractedText = typeof inputText === 'string'
    ? extractContent(inputText)
    : inputText;

  // Remove AI instruction text that might appear at the beginning of the note
  const telehealthSectionIndex = extractedText.indexOf('Telehealth Session Details');
  if (telehealthSectionIndex > 0) {
    const lastBreakBeforeTelehealth = extractedText.lastIndexOf('\n', telehealthSectionIndex);
    if (lastBreakBeforeTelehealth > 0) {
      extractedText = extractedText.substring(lastBreakBeforeTelehealth + 1);
    }
  }

  // Define the main section headers that should be emphasized
  const mainSoapHeaders = [
    'Subjective',
    'Objective', 
    'Assessment',
    'Plan'
  ];

  // Start with the extracted text
  let formattedText = extractedText;

  // Convert markdown headings to properly formatted headers
  formattedText = formattedText.replace(/^#{1,3}\s+(.*?)$/gm, (_, heading) => {
    const cleanHeading = heading.trim();
    
    // Check if this is a numbered item in the Plan section (like "1. Medication Management")
    const isNumberedPlanItem = /^\d+\.\s+.*/.test(cleanHeading);
    
    // Check if this is a main SOAP header that should be emphasized
    const isMainSoapHeader = mainSoapHeaders.some(header =>
      cleanHeading.toLowerCase().includes(header.toLowerCase())
    ) && !isNumberedPlanItem; // Exclude numbered plan items from main header treatment
    
    // Add extra spacing around main headers
    if (isMainSoapHeader) {
      return `\n${cleanHeading.toUpperCase()}\n`;
    }
    
    // For numbered plan items, keep them as regular text with proper spacing
    if (isNumberedPlanItem) {
      return `\n${cleanHeading}\n`;
    }
    
    // Regular headers get normal formatting
    return `\n${cleanHeading}\n`;
  });

  // Convert bold markdown to plain text but keep the emphasis through formatting
  formattedText = formattedText.replace(/\*\*(.*?):\*\*/g, '$1:');
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '$1');

  // Clean up bullet points - ensure consistent formatting
  formattedText = formattedText.replace(/^\s*[-*]\s+/gm, '• ');

  // Clean up numbered lists and ensure proper spacing
  formattedText = formattedText.replace(/^\s*(\d+)\.\s+/gm, '$1. ');

  // Ensure proper spacing between sections
  formattedText = formattedText.replace(/\n{3,}/g, '\n\n');

  // Clean up any remaining formatting issues
  formattedText = formattedText.replace(/^\s+|\s+$/g, ''); // Trim whitespace
  formattedText = formattedText.replace(/\n\s*\n\s*\n/g, '\n\n'); // Normalize spacing

  // Ensure the note ends with a single newline
  if (!formattedText.endsWith('\n')) {
    formattedText += '\n';
  }

  return formattedText;
}