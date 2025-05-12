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

// Import AppSettings from the central location
import type { AppSettings } from '@/app/lib/supabaseTypes';
export type { AppSettings };

// Visit Types
export type VisitType = 'Initial Evaluation' | 'Follow-Up Visit';