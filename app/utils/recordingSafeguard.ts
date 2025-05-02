// Types for recording session
export type RecordingSessionType = 'initial-visit' | 'follow-up' | 'general';

// Structure for saved transcript data
export interface SavedRecordingSession {
  timestamp: number;         // When the recording started
  lastActive: number;        // Last heartbeat timestamp
  transcript: string;        // Current transcript text
  sessionType: RecordingSessionType;
  contextData?: any;         // Optional context-specific data
}

const STORAGE_KEY = 'recording_session_data';
const RECOVERY_POINTS_KEY = 'recovery_points';

// Simple encryption function using a fixed key
// Note: For production, use a proper encryption library
function encryptData(data: string): string {
  const key = 'BoredCertified_SecureKey'; // Would be stored in env variables in production
  let result = '';
  
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result); // Base64 encode the result
}

// Decrypt data stored with encryptData
function decryptData(encryptedData: string): string {
  const key = 'BoredCertified_SecureKey';
  try {
    const data = atob(encryptedData); // Base64 decode
    let result = '';
    
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (e) {
    console.error('Error decrypting data:', e);
    return ''; // Return empty string on error
  }
}

// Save transcript checkpoint
export function saveTranscriptCheckpoint(
  transcript: string, 
  sessionType: RecordingSessionType,
  contextData?: any
): void {
  if (!transcript) return;
  
  const currentData = getExistingSession();
  
  const savedData: SavedRecordingSession = {
    timestamp: currentData?.timestamp || Date.now(),
    lastActive: Date.now(),
    transcript,
    sessionType,
    contextData
  };
  
  // Measure size of data to detect potential quota issues
  const dataString = JSON.stringify(savedData);
  const estimatedSize = new Blob([dataString]).size;
  
  try {
    // Try session storage first
    if (estimatedSize < 4.5 * 1024 * 1024) { // Stay under 5MB limit with buffer
      sessionStorage.setItem(STORAGE_KEY, encryptData(dataString));
    } else {
      console.warn('Data too large for sessionStorage, trimming transcript');
      // Trim data to fit if too large
      const trimmedData = {...savedData};
      // Keep trimming transcript until it fits
      while (new Blob([JSON.stringify(trimmedData)]).size > 4 * 1024 * 1024) {
        trimmedData.transcript = trimmedData.transcript.substring(
          0, Math.floor(trimmedData.transcript.length * 0.9)
        ) + ' [trimmed due to size constraints]';
      }
      sessionStorage.setItem(STORAGE_KEY, encryptData(JSON.stringify(trimmedData)));
    }
    
    // Also save to localStorage with timestamp for better persistence
    try {
      // Use a timestamped key in localStorage to maintain multiple recovery points
      const timestampedKey = `${STORAGE_KEY}_${Date.now()}`;
      localStorage.setItem(timestampedKey, encryptData(dataString));
      
      // Store list of recovery points (maintain last 3)
      const recoveryPoints = JSON.parse(localStorage.getItem(RECOVERY_POINTS_KEY) || '[]');
      recoveryPoints.push(timestampedKey);
      if (recoveryPoints.length > 3) {
        // Remove and clean up oldest recovery point
        const oldest = recoveryPoints.shift();
        localStorage.removeItem(oldest);
      }
      localStorage.setItem(RECOVERY_POINTS_KEY, JSON.stringify(recoveryPoints));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      // Continue with sessionStorage only if localStorage fails
    }
  } catch (error) {
    // Handle quota exceeded or other storage errors
    console.error('Storage error:', error);
    try {
      // Compress/truncate transcript as fallback
      const compressedData = {...savedData};
      compressedData.transcript = savedData.transcript.substring(0, 1000) + 
        ' [...content truncated for storage...]';
      sessionStorage.setItem(STORAGE_KEY + '_fallback', encryptData(JSON.stringify(compressedData)));
    } catch (e) {
      console.error('All storage attempts failed:', e);
    }
  }
}

// Update heartbeat (called frequently during recording)
export function updateHeartbeat(): void {
  const currentData = getExistingSession();
  if (currentData) {
    currentData.lastActive = Date.now();
    try {
      sessionStorage.setItem(STORAGE_KEY, encryptData(JSON.stringify(currentData)));
    } catch (error) {
      console.error('Error updating heartbeat:', error);
    }
  }
}

// Get existing session if one exists
export function getExistingSession(): SavedRecordingSession | null {
  try {
    // Try session storage first
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (data) {
      const decryptedData = decryptData(data);
      return JSON.parse(decryptedData);
    }
    
    // If not in session storage, check localStorage recovery points
    const recoveryPoints = JSON.parse(localStorage.getItem(RECOVERY_POINTS_KEY) || '[]');
    if (recoveryPoints.length > 0) {
      // Get most recent recovery point
      const latestKey = recoveryPoints[recoveryPoints.length - 1];
      const encryptedData = localStorage.getItem(latestKey);
      if (encryptedData) {
        const decryptedData = decryptData(encryptedData);
        return JSON.parse(decryptedData);
      }
    }
    
    // Try fallback storage if main storage failed
    const fallbackData = sessionStorage.getItem(STORAGE_KEY + '_fallback');
    if (fallbackData) {
      const decryptedData = decryptData(fallbackData);
      return JSON.parse(decryptedData);
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving saved session:', error);
    return null;
  }
}

// Check if there appears to be an interrupted session
export function hasInterruptedSession(): boolean {
  const savedData = getExistingSession();
  if (!savedData) return false;
  
  // Only consider recent sessions (within last hour)
  const isRecent = Date.now() - savedData.timestamp < 60 * 60 * 1000;
  
  // Only offer recovery if this appears to be an unexpected interruption
  // (vs. a normal session end where the checkpoint would have been cleared)
  const unexpectedInterruption = Date.now() - savedData.lastActive < 10 * 60 * 1000;
  
  return isRecent && unexpectedInterruption && Boolean(savedData.transcript);
}

// Clear recording session data (after successful completion or discarding)
export function clearRecordingSession(): void {
  try {
    // Clear session storage
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY + '_fallback');
    
    // Clear localStorage recovery points
    const recoveryPoints = JSON.parse(localStorage.getItem(RECOVERY_POINTS_KEY) || '[]');
    recoveryPoints.forEach((key: string) => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem(RECOVERY_POINTS_KEY);
  } catch (e) {
    console.error('Error clearing recording session:', e);
  }
}

// Setup cleanup policy for old recordings
export function setupStorageCleanupPolicy(): () => void {
  // Clear all recording data older than 24 hours
  const cleanupInterval = setInterval(() => {
    try {
      // Check sessionStorage
      const session = getExistingSession();
      if (session && (Date.now() - session.timestamp > 24 * 60 * 60 * 1000)) {
        clearRecordingSession();
      }
      
      // Check localStorage recovery points
      const recoveryPoints = JSON.parse(localStorage.getItem(RECOVERY_POINTS_KEY) || '[]');
      const updatedPoints = [];
      
      for (const key of recoveryPoints) {
        try {
          const encryptedData = localStorage.getItem(key);
          if (encryptedData) {
            const decrypted = decryptData(encryptedData);
            const parsed = JSON.parse(decrypted);
            
            if (Date.now() - parsed.timestamp <= 24 * 60 * 60 * 1000) {
              updatedPoints.push(key);
            } else {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Remove invalid entries
          localStorage.removeItem(key);
        }
      }
      
      localStorage.setItem(RECOVERY_POINTS_KEY, JSON.stringify(updatedPoints));
    } catch (e) {
      console.error('Error in storage cleanup:', e);
    }
  }, 60 * 60 * 1000); // Run every hour
  
  // Return cleanup function
  return () => clearInterval(cleanupInterval);
}
