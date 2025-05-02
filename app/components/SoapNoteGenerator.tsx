import { useState, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';
import { formatSoapNote } from '../utils/formatSoapNote';

interface SoapNoteGeneratorProps {
  patientId: string | undefined;
  transcript: string;
  onNoteGenerated: (note: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export default function SoapNoteGenerator({
  patientId,
  transcript,
  onNoteGenerated,
  onError,
  disabled = false
}: SoapNoteGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<{
    gptModel: string;
    initialVisitPrompt: string;
    followUpVisitPrompt: string;
  }>({
    gptModel: 'gpt-4o',
    initialVisitPrompt: '',
    followUpVisitPrompt: ''
  });

  // Fetch app settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            gptModel: data.gptModel || 'gpt-4o',
            initialVisitPrompt: data.initialVisitPrompt,
            followUpVisitPrompt: data.followUpVisitPrompt
          });
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        onError('Failed to load settings');
      }
    };

    fetchSettings();
  }, [onError]);

  // Function to deduplicate stacked phrases in a transcript
  const deduplicateTranscript = (text: string): string => {
    if (!text) return '';
    
    // First pass: remove exact adjacent duplicated phrases
    let normalizedText = text;
    let prevNormalizedText = '';

    // Iteratively remove repeated adjacent patterns until no more changes
    while (normalizedText !== prevNormalizedText) {
      prevNormalizedText = normalizedText;
      
      // Remove repeating word sequences (2-8 words)
      for (let n = 8; n >= 2; n--) {
        const wordRegex = new RegExp(`((?:\\S+\\s+){${n-1}}\\S+)\\s+\\1`, 'gi');
        normalizedText = normalizedText.replace(wordRegex, '$1');
      }
    }
    
    // Second pass: remove stacking patterns (like "A B C A B C D")
    const stackingPattern = /((?:\S+\s+){2,6})\1+/g;
    let prevText = '';
    
    // Iteratively remove stacking patterns until no more changes
    while (prevText !== normalizedText) {
      prevText = normalizedText;
      normalizedText = normalizedText.replace(stackingPattern, '$1');
    }
    
    return normalizedText;
  };

  const generateSoapNote = async () => {
    if (!patientId || !transcript.trim()) {
      onError('Patient ID and transcript are required');
      return;
    }

    setIsLoading(true);
    
    try {
      // First check if this is an initial visit for the patient
      // This will help determine which template to use
      let isInitialVisit = false;
      try {
        const notesResponse = await fetch(`/api/notes?patientId=${patientId}`);
        if (notesResponse.ok) {
          const existingNotes = await notesResponse.json();
          isInitialVisit = existingNotes.length === 0;
          console.log('Visit type determined:', isInitialVisit ? 'Initial Visit' : 'Follow-up Visit');
        }
      } catch (error) {
        console.warn('Error checking if this is an initial visit, defaulting to follow-up', error);
      }
      
      // Get the patient's name for proper formatting in the note
      let patientName = "Patient";
      try {
        const patientResponse = await fetch(`/api/patients?id=${patientId}`);
        if (patientResponse.ok) {
          const patientData = await patientResponse.json();
          if (patientData && patientData.length > 0) {
            patientName = patientData[0].name;
          }
        }
      } catch (error) {
        console.warn('Error fetching patient name', error);
      }
      
      // Use the full transcript without deduplication
      const fullTranscript = transcript;
      
      // Use the API endpoint with explicit visit type and patient name
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          transcript: fullTranscript,
          useStructuredPrompt: true, // Always use the structured prompt approach
          isInitialEvaluation: isInitialVisit, // Explicitly pass visit type
          patientName: patientName // Pass patient name for proper formatting
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate SOAP note'
        );
      }

      // Process the generated note to ensure proper formatting
      const noteData = await response.json();
      
      // Ensure the note is formatted properly by formatting it explicitly if needed
      if (noteData && typeof noteData.content === 'string') {
        try {
          // Parse the content to check if it's JSON
          const contentObj = JSON.parse(noteData.content);
          
          // If content is in JSON format, ensure it's formatted properly
          if (typeof contentObj === 'object' && contentObj !== null) {
            // Format the note using formatSoapNote (which will be applied in the Note component)
            const formattedContent = formatSoapNote(JSON.stringify(contentObj));
            
            // Update the note content to include both raw and formatted content
            noteData.content = JSON.stringify({
              content: JSON.stringify(contentObj), // Keep original content
              formattedContent // Add formatted content
            });
          }
        } catch (e) {
          // If it's not JSON, just ensure it's a string
          console.log("Note content is not in JSON format, keeping as is");
        }
      }
      
      onNoteGenerated(noteData);
    } catch (error) {
      console.error('Error generating SOAP note:', error);
      onError(error instanceof Error ? error.message : 'Error generating SOAP note');
    } finally {
      setIsLoading(false);
    }
  };

  // Alternative approach using direct OpenAI API call
  const generateSoapNoteDirectly = async () => {
    if (!patientId || !transcript.trim()) {
      onError('Patient ID and transcript are required');
      return;
    }

    setIsLoading(true);
    
    try {
      // First check if this is an initial visit
      const notesResponse = await fetch(`/api/notes?patientId=${patientId}`);
      if (!notesResponse.ok) {
        throw new Error('Failed to fetch patient notes');
      }
      
      const existingNotes = await notesResponse.json();
      const isInitialVisit = existingNotes.length === 0;
      
      // Select the appropriate system message
      const systemMessage = isInitialVisit 
        ? settings.initialVisitPrompt 
        : settings.followUpVisitPrompt;
      
      // Make request to the OpenAI API
      const openaiResponse = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.gptModel,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: transcript }
          ],
          temperature: 0.7
        }),
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate SOAP note'
        );
      }

      const { content } = await openaiResponse.json();
      
      // Save the generated note
      const saveResponse = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          transcript,
          content,
          isInitialVisit
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save generated note');
      }

      const savedNote = await saveResponse.json();
      onNoteGenerated(savedNote);
    } catch (error) {
      console.error('Error generating SOAP note:', error);
      onError(error instanceof Error ? error.message : 'Error generating SOAP note');
    } finally {
      setIsLoading(false);
    }
  };

  // Example method for direct API calls to OpenAI (for reference/documentation)
  const exampleDirectApiCall = `
  // Example direct API call to OpenAI (for reference)
  const generateSoapNoteWithOpenAI = async (transcript: string, isInitialVisit: boolean) => {
    // 1. Get the appropriate system message based on visit type
    const systemMessage = isInitialVisit 
      ? settings.initialVisitPrompt 
      : settings.followUpVisitPrompt;
    
    // 2. Make the API request to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`
      },
      body: JSON.stringify({
        model: settings.gptModel, // e.g., "gpt-4o"
        messages: [
          { 
            role: 'system', 
            content: systemMessage 
          },
          { 
            role: 'user', 
            content: transcript 
          }
        ],
        temperature: 0.7
      })
    });
    
    // 3. Parse the response
    const data = await response.json();
    
    // 4. Extract the generated content
    const soapNote = data.choices[0]?.message?.content;
    
    return soapNote;
  }
  `;

  return (
    <div className="mt-4">
      <button
        onClick={generateSoapNote}
        disabled={disabled || isLoading || !transcript.trim()}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating SOAP Note...
          </>
        ) : (
          <>
            <FiSend className="mr-2" />
            Generate SOAP Note
          </>
        )}
      </button>
    </div>
  );
}
