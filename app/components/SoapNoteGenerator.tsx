import { useState, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';

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

  const generateSoapNote = async () => {
    if (!patientId || !transcript.trim()) {
      onError('Patient ID and transcript are required');
      return;
    }

    setIsLoading(true);
    
    try {
      // Use the existing API endpoint that already handles visit type detection
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          transcript
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || 'Failed to generate SOAP note'
        );
      }

      const noteData = await response.json();
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