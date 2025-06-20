// Import the exact logic from the app
function extractContent(input) {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed.content || input;
    } catch {
      return input;
    }
  }
  return input;
}

function formatSoapNote(inputText) {
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
  
  // ENHANCED: Fix all line-break-before-colon patterns
  // Handle patterns like "Label\n: Content" -> "Label: Content"
  formattedText = formattedText.replace(/([A-Za-z0-9\s]+)\n\s*:\s*/g, '$1: ');
  
  // Handle patterns where colon is completely on its own line
  formattedText = formattedText.replace(/\n\s*:\s*([A-Za-z])/g, ': $1');
  formattedText = formattedText.replace(/^:\s*/gm, '');
  
  // Fix common problematic patterns specifically
  formattedText = formattedText.replace(/(Mode of Communication|Patient Location|Provider Location|Consent Obtained|Other Participants|Before Visit|After Visit)\s*\n\s*:\s*/g, '$1: ');
  
  // Remove any remaining standalone colons
  formattedText = formattedText.replace(/\n\s*:\s*\n/g, '\n');
  formattedText = formattedText.replace(/\n\s*:\s*$/gm, '');

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

// Test with the exact problematic input from the user
const problematicInput = `## Telehealth Session Details
Mode of Communication
: Session conducted via secure real-time audio and video.
Patient Location
: Patient located at home; address confirmed.
Provider Location
: Provider located in clinic office.
Consent Obtained
: Verbal consent for telehealth visit and use of AI charting tools obtained from patient prior to session.
Other Participants
: No additional participants present during session.`;

console.log('=== TESTING EXACT APP FLOW ===');
console.log('Input:');
console.log(problematicInput);
console.log('\n=== PROCESSING ===');

// Step 1: extractContent (simulating what happens in the app)
const extracted = extractContent(problematicInput);
console.log('After extractContent:', extracted === problematicInput ? 'Same as input' : 'Different');

// Step 2: formatSoapNote
const result = formatSoapNote(problematicInput);
console.log('\nFinal result:');
console.log(result);

// Check for the issue
const stillHasIssue = result.includes('Mode of Communication<br>: ') || result.includes('Patient Location<br>: ');
console.log('\n=== VERIFICATION ===');
console.log('Still has line-break-before-colon issue:', stillHasIssue);

if (stillHasIssue) {
  console.log('\n🚨 ISSUE FOUND! The formatSoapNote function is not fixing the issue properly.');
  // Let's debug step by step
  console.log('\nDebugging step by step:');
  let debug = problematicInput;
  console.log('Original:', debug.includes('Mode of Communication\n: '));
  debug = debug.replace(/([A-Za-z0-9\s]+)\n\s*:\s*/g, '$1: ');
  console.log('After first regex:', debug.includes('Mode of Communication: '));
  console.log('Full result after first regex:', debug);
} else {
  console.log('✅ FORMAT FUNCTION IS WORKING CORRECTLY');
} 