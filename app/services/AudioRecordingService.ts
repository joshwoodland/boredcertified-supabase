/**
 * Service for handling audio recording storage and retrieval
 */

/**
 * Save an audio recording to the server
 * @param audioBlob The audio blob to save
 * @param patientName The name of the patient (for filename)
 * @returns The URL of the saved audio file
 */
export async function saveAudioRecording(audioBlob: Blob, patientName: string = 'JWood'): Promise<string> {
  try {
    // Create a FormData object to send the file
    const formData = new FormData();

    // Create a filename with patient name and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${patientName} test audio file ${timestamp}.mp3`;

    // Add the file to the form data
    formData.append('file', audioBlob, filename);

    // Send the file to the server
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload audio recording');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error saving audio recording:', error);
    throw error;
  }
}

/**
 * Get all audio recordings
 * @returns Array of audio recording objects
 */
export async function getAudioRecordings() {
  try {
    const response = await fetch('/api/audio-recordings');

    if (!response.ok) {
      throw new Error('Failed to fetch audio recordings');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching audio recordings:', error);
    throw error;
  }
}
