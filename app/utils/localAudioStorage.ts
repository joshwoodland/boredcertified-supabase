/**
 * localAudioStorage.ts
 *
 * This file has been emptied as part of removing audio file storage functionality
 * while preserving the Deepgram transcription capability.
 */

// Define the interface to maintain type compatibility with components that might reference it
export interface StoredRecording {
  id: string;
  name: string;
  timestamp: number;
  url: string;
  size: number;
  duration?: number;
  type: string;
}

// Stub functions that return empty or basic results
export async function saveRecordingLocally(audioBlob: Blob, name?: string): Promise<StoredRecording> {
  console.warn('Audio storage functionality has been removed');
  return {
    id: 'audio-storage-removed',
    name: name || 'Audio storage removed',
    timestamp: Date.now(),
    url: '',
    size: 0,
    type: 'audio/mp3'
  };
}

export async function getAllRecordings(): Promise<StoredRecording[]> {
  return [];
}

export async function getRecordingById(id: string): Promise<StoredRecording | null> {
  return null;
}

export async function deleteRecording(id: string): Promise<boolean> {
  return true;
}

export async function downloadRecording(id: string): Promise<boolean> {
  return false;
}

export async function clearAllRecordings(): Promise<boolean> {
  return true;
}

export interface ExportResult {
  links: Array<{ element: HTMLAnchorElement, url: string }>;
  cleanup: () => void;
}

export async function exportAllRecordings(): Promise<ExportResult | null> {
  return null;
}
