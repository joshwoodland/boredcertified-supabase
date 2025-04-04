import { extractContent } from './safeJsonParse';

/**
 * Formats markdown-style SOAP notes into clean HTML
 * 
 * @param markdownText - The raw markdown-formatted SOAP note from the API
 * @returns Properly formatted HTML with styled headings and sections
 */
export function formatSoapNote(markdownText: string): string {
  if (!markdownText) return '';

  // If the input might be JSON, extract the content safely
  if (typeof markdownText === 'string') {
    markdownText = extractContent(markdownText);
  }

  // Process headings (### Heading -> <strong>Heading</strong>)
  let formattedText = markdownText.replace(/^#{1,3}\s+(.*?)$/gm, '<strong>$1</strong>');
  
  // Process subsections with bold (**Mood:** -> <strong>Mood:</strong>)
  formattedText = formattedText.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>');
  
  // Process any remaining bold text
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Add special formatting for Diagnosis and Rule Out sections
  formattedText = formattedText.replace(
    /(Diagnosis:|Assessment:|Rule Out:)\s*(<br>)?([^<]*)/gi,
    (match, label, br, content) => {
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
      
      // Return a properly formatted section with list
      return `<strong>${label}</strong><br><ul class="pl-4 my-2">${items.join('')}</ul>`;
    }
  );
  
  // Convert paragraphs (double newlines) to HTML paragraphs with breaks
  formattedText = formattedText.replace(/\n\n/g, '<br><br>');
  
  // Convert single newlines to breaks
  formattedText = formattedText.replace(/\n/g, '<br>');
  
  // Convert bullet points to HTML lists (for remaining bullets not in Diagnosis/Rule Out)
  formattedText = formattedText.replace(/(<br>|^)- (.*?)(<br>|$)/g, (match, p1, p2, p3) => {
    // Check if we need to start a new list
    const startList = p1 && !p1.includes('</li>') ? '<ul>' : '';
    // Check if we need to end the list
    const endList = p3 && !p3.includes('<li>') ? '</ul>' : '';
    
    return `${startList}<li>${p2}</li>${endList}`;
  });
  
  return formattedText;
}

/**
 * Formats markdown-style SOAP notes into plain text with minimal formatting
 * 
 * @param markdownText - The raw markdown-formatted SOAP note from the API
 * @returns Clean plain text format without markdown symbols
 */
export function formatSoapNotePlainText(markdownText: string): string {
  if (!markdownText) return '';

  // If the input might be JSON, extract the content safely
  if (typeof markdownText === 'string') {
    markdownText = extractContent(markdownText);
  }

  // Remove heading markers but keep the heading text
  let formattedText = markdownText.replace(/^#{1,3}\s+(.*?)$/gm, '$1');
  
  // Remove bold markers but keep the text
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // Replace bullet points with standard dashes
  formattedText = formattedText.replace(/^\s*-\s+/gm, '- ');
  
  return formattedText;
} 