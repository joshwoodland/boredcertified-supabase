'use client';

import { useState, useEffect } from 'react';
import { FiSend, FiSettings } from 'react-icons/fi';

interface OpenAIChatProps {
  openSettings: () => void;
}

type VisitType = 'Initial Evaluation' | 'Follow-Up Visit';
type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'o1';

const OpenAIChat: React.FC<OpenAIChatProps> = ({ openSettings }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>('Initial Evaluation');
  const [selectedModel, setSelectedModel] = useState<ModelType>('gpt-4o');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [initialEvalPrompt, setInitialEvalPrompt] = useState<string>('');
  const [followUpPrompt, setFollowUpPrompt] = useState<string>('');

  // Load system messages from local storage or settings API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          // Remove format tags if they exist
          setInitialEvalPrompt(data.initialVisitPrompt.replace(/^format:\{[^}]*\}\n/gm, ''));
          setFollowUpPrompt(data.followUpVisitPrompt.replace(/^format:\{[^}]*\}\n/gm, ''));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setIsLoading(true);
    setAssistantResponse('');

    try {
      // Choose system message based on visit type
      const systemMessage = visitType === 'Initial Evaluation' 
        ? initialEvalPrompt 
        : followUpPrompt;

      const response = await fetch('/api/chat', {
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

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      setAssistantResponse(data.content);
    } catch (error) {
      console.error('Error sending message:', error);
      setAssistantResponse('Error: Failed to get a response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Lindy Medical Assistant</h2>
        <button 
          onClick={openSettings}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Open settings"
        >
          <FiSettings className="w-5 h-5" />
        </button>
      </div>

      <div className="flex space-x-4 mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Visit Type</label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value as VisitType)}
            className="w-full p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700"
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
            className="w-full p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o-mini</option>
            <option value="o1">Claude 3 Opus (o1)</option>
          </select>
        </div>
      </div>

      {assistantResponse && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4 overflow-auto max-h-[500px]">
          <h3 className="font-medium mb-2">Assistant's Response:</h3>
          <div className="whitespace-pre-wrap">{assistantResponse}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-auto flex-shrink-0">
        <div className="relative">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Enter patient transcript..."
            className="w-full p-3 pr-10 border rounded-md h-32 resize-y dark:bg-gray-800 dark:border-gray-700"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !userInput.trim()}
            className="absolute bottom-3 right-3 p-2 bg-blue-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSend />
          </button>
        </div>
      </form>
      
      {isLoading && (
        <div className="text-center py-2 text-sm text-gray-500">
          Generating response...
        </div>
      )}
    </div>
  );
};

export default OpenAIChat; 