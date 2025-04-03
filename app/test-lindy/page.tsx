'use client';

import { useState } from 'react';

type VisitType = 'Initial Evaluation' | 'Follow-Up Visit';
type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'o1';

export default function TestLindy() {
  const [userInput, setUserInput] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>('Initial Evaluation');
  const [selectedModel, setSelectedModel] = useState<ModelType>('gpt-4o');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [initialEvalPrompt, setInitialEvalPrompt] = useState<string>(
    `You are Lindy, an AI medical assistant specialized in psychiatric evaluations. You are helping conduct an initial psychiatric evaluation.

# Guidelines
- Focus on psychiatric assessment and mental health history
- Note any current medications and treatments
- Identify key symptoms and their duration
- Assess risk factors for self-harm or harm to others
- Note any family history of mental health conditions
- Document substance use history
- Organize information in a clear, clinical format

# Output Format
Structure your assessment in SOAP format (Subjective, Objective, Assessment, Plan) and include relevant sections from the patient's history.`
  );
  const [followUpPrompt, setFollowUpPrompt] = useState<string>(
    `You are Lindy, an AI medical assistant specialized in psychiatric evaluations. You are helping with a follow-up psychiatric visit.

# Guidelines
- Focus on changes since the last visit
- Evaluate medication effectiveness and side effects
- Assess progress in treatment goals
- Document any new symptoms or concerns
- Evaluate risk factors (if present)
- Update treatment plan as needed
- Be concise but thorough

# Output Format
Structure your assessment in SOAP format (Subjective, Objective, Assessment, Plan) with emphasis on changes since the previous visit.`
  );
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setIsLoading(true);
    setAssistantResponse('');
    setErrorMessage('');

    try {
      // Choose system message based on visit type
      const systemMessage = visitType === 'Initial Evaluation' 
        ? initialEvalPrompt 
        : followUpPrompt;

      // Using our server-side API endpoint
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userInput }
          ],
          temperature: 0.7
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'API request failed');
      }

      setAssistantResponse(data.content);
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error generating response');
      setAssistantResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 dark:bg-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold mb-6 text-center">Lindy Medical Assistant</h1>
      
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md"
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>
        
        {showSettings && (
          <div className="mb-8 p-4 border rounded-lg dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">System Message Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Initial Evaluation System Message
                </label>
                <textarea
                  value={initialEvalPrompt}
                  onChange={(e) => setInitialEvalPrompt(e.target.value)}
                  className="w-full h-40 p-3 border rounded-lg resize-none dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Follow-Up Visit System Message
                </label>
                <textarea
                  value={followUpPrompt}
                  onChange={(e) => setFollowUpPrompt(e.target.value)}
                  className="w-full h-40 p-3 border rounded-lg resize-none dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Visit Type</label>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value as VisitType)}
              className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="Initial Evaluation">Initial Evaluation</option>
              <option value="Follow-Up Visit">Follow-Up Visit</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelType)}
              className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o-mini</option>
              <option value="o1">Claude 3 Opus (o1)</option>
            </select>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            <h3 className="font-medium mb-1">Error:</h3>
            <p>{errorMessage}</p>
          </div>
        )}

        {assistantResponse && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4 overflow-auto max-h-[400px] border dark:border-gray-700">
            <h3 className="font-medium mb-2">Assistant's Response:</h3>
            <div className="whitespace-pre-wrap">{assistantResponse}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Patient Transcript
            </label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Enter patient transcript..."
              className="w-full p-3 border rounded-md h-32 resize-y dark:bg-gray-800 dark:border-gray-700"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !userInput.trim()}
            className="w-full p-3 bg-blue-500 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating response...' : 'Generate Analysis'}
          </button>
        </form>
      </div>
      
      <footer className="text-center text-sm text-gray-500 mt-8">
        <p>Powered by OpenAI API • {new Date().getFullYear()}</p>
        <p className="mt-1 text-xs">Remember to set your OPENAI_API_KEY in the .env file</p>
      </footer>
    </div>
  );
} 