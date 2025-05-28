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
  // This pattern matches from the beginning of the text up to the first occurrence of "Telehealth Session Details"
  const telehealthSectionIndex = markdownText.indexOf('Telehealth Session Details');
  if (telehealthSectionIndex > 0) {
    // Find the last line break before "Telehealth Session Details"
    const lastBreakBeforeTelehealth = markdownText.lastIndexOf('\n', telehealthSectionIndex);
    if (lastBreakBeforeTelehealth > 0) {
      // Remove everything before the section
      markdownText = markdownText.substring(lastBreakBeforeTelehealth + 1);
    }
  }

  // Define the standard section headers we want to identify
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

  // Replace dashed lines (---) with a temporary marker
  let formattedText = markdownText.replace(/^---+$/gm, '{{SECTION_DIVIDER}}');

  // Process headings (### Heading -> <strong>Heading</strong>)
  formattedText = formattedText.replace(/^#{1,3}\s+(.*?)$/gm, (_, heading) => {
    // Check if this is one of our standard section headers
    const cleanHeading = heading.trim();

    // Check if this is a numbered item in the Plan section (like "5. Safety Plan")
    const isNumberedPlanItem = /^\d+\.\s+.*?Plan$/i.test(cleanHeading);

    const isStandardSection = sectionHeaders.some(header =>
      cleanHeading.toLowerCase().includes(header.toLowerCase())
    ) && !isNumberedPlanItem; // Exclude numbered plan items

    if (isStandardSection) {
      // Check if this is one of the main SOAP headers that should be emphasized
      const isMainSoapHeader = mainSoapHeaders.some(header =>
        cleanHeading.toLowerCase().includes(header.toLowerCase())
      );

      // Create a section header with proper styling and spacing
      return `<div class="soap-section-header${isMainSoapHeader ? ' soap-main-header' : ''}">${cleanHeading}</div>`;
    }

    // Regular heading formatting with proper spacing
    return `<strong>${cleanHeading}</strong>`;
  });

  // Process subsections with bold (**Mood:** -> <strong>Mood:</strong>)
  formattedText = formattedText.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>');

  // Process any remaining bold text
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Add special formatting for Diagnosis and Rule Out sections
  formattedText = formattedText.replace(
    /(Diagnosis:|Assessment:|Rule Out:)\s*(<br>)?([^<]*)/gi,
    (match, label, _, content) => {
      // If the content is empty, don't format
      if (!content.trim()) return match;

      // Split content by lines, process each numbered/bulleted item
      const lines = content.split(/\n/).filter((line: string) => line.trim().length > 0);
      const items = lines.map((line: string) => {
        // Check if line has numbering (1. Something) or bullets (- Something)
        const trimmed = line.trim();
        if (trimmed.match(/^\d+\.\s+/) || trimmed.match(/^-\s+/)) {
          return `<li>${trimmed.replace(/^\d+\.\s+|-\s+/, '')}</li>`;
        }
        return `<li>${trimmed}</li>`;
      });

      // Return a properly formatted section with list (reduced spacing)
      return `<strong>${label}</strong><br><ul class="pl-4 my-1">${items.join('')}</ul>`;
    }
  );

  // Clean up any stray dashes or colons that might appear in the Telehealth Session Details section
  formattedText = formattedText.replace(/(<br>|^)\s*-\s*(<br>|$)/g, '<br>');
  formattedText = formattedText.replace(/(<br>|^)\s*:\s*(<br>|$)/g, '<br>');
  formattedText = formattedText.replace(/(<br>|^)\s*-\s*:/g, '');

  // Clean up specific sections that might have formatting issues
  formattedText = formattedText.replace(/Patient Location\s*:/g, '<strong>Patient Location</strong>:');
  formattedText = formattedText.replace(/Consent Obtained\s*:/g, '<strong>Consent Obtained</strong>:');
  formattedText = formattedText.replace(/Provider Location\s*:/g, '<strong>Provider Location</strong>:');
  formattedText = formattedText.replace(/Mode of Communication\s*:/g, '<strong>Mode of Communication</strong>:');
  formattedText = formattedText.replace(/Other Participants\s*:/g, '<strong>Other Participants</strong>:');

  // Convert paragraphs (double newlines) to proper HTML paragraphs
  formattedText = formattedText.replace(/\n\n/g, '</p><p>');

  // Convert single newlines to breaks with reduced spacing
  formattedText = formattedText.replace(/\n/g, '<br>');

  // Wrap content in paragraph tags if not already wrapped
  if (!formattedText.startsWith('<p>')) {
    formattedText = `<p>${formattedText}</p>`;
  }

  // Convert bullet points to HTML lists (for remaining bullets not in Diagnosis/Rule Out)
  formattedText = formattedText.replace(/(<br>|^)- (.*?)(<br>|$)/g, (_, p1, p2, p3) => {
    // Check if we need to start a new list
    const startList = p1 && !p1.includes('</li>') ? '<ul>' : '';
    // Check if we need to end the list
    const endList = p3 && !p3.includes('<li>') ? '</ul>' : '';

    return `${startList}<li>${p2}</li>${endList}`;
  });

  // Replace section dividers with properly styled dividers
  formattedText = formattedText.replace(/{{SECTION_DIVIDER}}/g, '<div class="soap-section-divider"></div>');

  // Identify and wrap standard sections that might not have proper headers
  for (const header of sectionHeaders) {
    // Look for the section header in various formats (with or without colons, case insensitive)
    const regex = new RegExp(`(^|<br>)(${header}:?\\s*)`, 'gi');
    formattedText = formattedText.replace(regex, (_, prefix) => {
      // Check if this is one of the main SOAP headers that should be emphasized
      const isMainSoapHeader = mainSoapHeaders.some(mainHeader =>
        header.toLowerCase().includes(mainHeader.toLowerCase())
      );

      return `${prefix}<div class="soap-section-header${isMainSoapHeader ? ' soap-main-header' : ''}">${header}</div>`;
    });
  }

  // Wrap the entire content in a container for section-based styling
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