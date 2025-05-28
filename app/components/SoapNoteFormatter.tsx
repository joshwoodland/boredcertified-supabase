'use client';

import { useState } from 'react';
import { formatSoapNote, formatSoapNotePlainText, formatSoapNoteForCopy } from '../utils/formatSoapNote';
import { extractContent } from '../utils/safeJsonParse';
import { FiCopy } from 'react-icons/fi';

export default function SoapNoteFormatter() {
  const [inputText, setInputText] = useState<string>(
`### Subjective

**Chief Complaint:** Anxiety and mood swings.

**History of Present Illness:** The patient reports increasing anxiety over the past 2 weeks with difficulty sleeping and concentrating at work.

### Objective

**Vital Signs:** BP 120/80, HR 72, RR 16, Temp 98.6°F

**Mental Status Examination:**
- **Appearance:** Well-groomed
- **Behavior:** Cooperative
- **Mood:** Anxious
- **Affect:** Congruent with mood, full range
- **Speech:** Normal rate, rhythm, and volume
- **Thought Process:** Logical and goal-directed
- **Thought Content:** No SI/HI, no delusions
- **Cognition:** Alert and oriented x3

### Assessment

1. Generalized Anxiety Disorder (F41.1)
2. Major Depressive Disorder, recurrent, moderate (F33.1)

### Plan

1. Continue Sertraline 50mg daily
2. Start CBT, weekly sessions
3. Follow up in 2 weeks`
  );
  
  const [outputFormat, setOutputFormat] = useState<'html' | 'text' | 'copy' | 'raw'>('html');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  // Safely extract content from potential JSON before formatting
  const safeInputText = extractContent(inputText);
  const formattedHtml = formatSoapNote(safeInputText);
  const formattedText = formatSoapNotePlainText(safeInputText);
  const formattedForCopy = formatSoapNoteForCopy(safeInputText);
  
  const handleCopy = () => {
    let textToCopy = '';
    
    switch (outputFormat) {
      case 'html':
        const tempElement = document.createElement('div');
        tempElement.innerHTML = formattedHtml;
        textToCopy = tempElement.textContent || tempElement.innerText || '';
        break;
      case 'text':
        textToCopy = formattedText;
        break;
      case 'copy':
        textToCopy = formattedForCopy;
        break;
      case 'raw':
        textToCopy = safeInputText;
        break;
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">SOAP Note Formatter Demo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Input (Markdown)</h3>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-[500px] p-3 border rounded-md font-mono text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Output</h3>
            <div className="flex space-x-2">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as any)}
                className="p-2 border rounded-md text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              >
                <option value="html">HTML</option>
                <option value="text">Plain Text</option>
                <option value="copy">Copy Format</option>
                <option value="raw">Raw Markdown</option>
              </select>
              
              <button 
                onClick={handleCopy}
                className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
              >
                <FiCopy className="mr-1" />
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          
          <div className="w-full h-[500px] p-3 border rounded-md overflow-auto dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
            {outputFormat === 'html' && (
              <div dangerouslySetInnerHTML={{ __html: formattedHtml }} />
            )}
            {outputFormat === 'text' && (
              <div className="whitespace-pre-wrap">{formattedText}</div>
            )}
            {outputFormat === 'copy' && (
              <div className="whitespace-pre-wrap">{formattedForCopy}</div>
            )}
            {outputFormat === 'raw' && (
              <div className="whitespace-pre-wrap font-mono text-sm">{safeInputText}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 