'use client';

import { useState } from 'react';
import OpenAIChat from '../components/OpenAIChat';
import LindySettings from '../components/LindySettings';

export default function LindyPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <main className="min-h-screen p-6 flex flex-col dark:bg-gray-900 dark:text-white">
      <div className="flex-1 flex flex-col">
        <h1 className="text-2xl font-bold mb-6 text-center">Lindy Medical Assistant</h1>
        
        <div className="flex-1 flex flex-col">
          <OpenAIChat 
            openSettings={() => setIsSettingsOpen(true)} 
          />
        </div>
      </div>
      
      <LindySettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by OpenAI API • {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
} 