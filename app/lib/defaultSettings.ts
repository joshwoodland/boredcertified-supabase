/**
 * Default settings for the application
 * This file serves as a single source of truth for default settings values
 */

export const DEFAULT_SETTINGS = {
  // UI settings
  darkMode: true,

  // Model settings
  gptModel: 'gpt-4o',

  // Additional preferences for SOAP note templates
  initialVisitPrompt: 'Please include detailed medication side effects when mentioned. Use bullet points for medication lists.',
  followUpVisitPrompt: 'Focus on changes since the last visit. Highlight any medication adjustments with "CHANGED" label.',

  // Feature settings
  autoSave: true,
  lowEchoCancellation: false,

  // User settings
  email: null as string | null,
  userId: null as string | null,
};

// OpenAI API settings
export const DEFAULT_API_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2000,
};

// Default settings ID for database
export const DEFAULT_SETTINGS_ID = 'default';

// Default user settings ID prefix
export const USER_SETTINGS_ID_PREFIX = 'user_id_';
