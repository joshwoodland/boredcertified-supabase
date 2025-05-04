// Default settings for the application when no settings are available in the database

export const DefaultSettings = {
  id: 'default',
  deepgramApiKey: '',
  openaiApiKey: '',
  gptModel: 'gpt-4o',
  lowEchoCancellation: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}; 