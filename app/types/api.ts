// OpenAI Chat API Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface ChatResponse {
  content: string;
}

// Settings API Types
export interface SystemMessage {
  content: string;
  version: string;
  lastUpdated: string;
  description: string;
}

export interface SystemMessageUpdate {
  content: string;
  description?: string;
}

export interface AppSettings {
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  autoSave?: boolean;
}

// Visit Types
export type VisitType = 'Initial Evaluation' | 'Follow-Up Visit'; 