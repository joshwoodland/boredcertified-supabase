/**
 * audioLoopback.ts
 * 
 * Utility functions for handling audio loopback functionality
 * to capture both microphone and system audio in web browsers.
 */

// Check if the browser supports the necessary audio APIs
export function isAudioLoopbackSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices &&
    'AudioContext' in window
  );
}

// Check if a virtual audio device is likely available
export async function detectVirtualAudioDevice(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    // Look for common virtual audio device names
    const virtualDeviceKeywords = [
      'blackhole', 'loopback', 'virtual', 'vb-audio', 'voicemeeter',
      'soundflower', 'cable', 'aggregate', 'multi-output'
    ];
    
    return audioInputs.some(device => {
      const deviceName = device.label.toLowerCase();
      return virtualDeviceKeywords.some(keyword => deviceName.includes(keyword));
    });
  } catch (error) {
    console.error('Error detecting virtual audio devices:', error);
    return false;
  }
}

// Get available audio input devices
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Error getting audio input devices:', error);
    return [];
  }
}

// Request audio stream with specific device ID
export async function getAudioStream(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId 
      ? { deviceId: { exact: deviceId } } 
      : true
  };
  
  return navigator.mediaDevices.getUserMedia(constraints);
}

// Local storage key for audio settings
const AUDIO_SETTINGS_KEY = 'audio_loopback_settings';

// Save user's audio device preference
export function saveAudioDevicePreference(deviceId: string): void {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, deviceId);
  } catch (error) {
    console.error('Error saving audio device preference:', error);
  }
}

// Get user's saved audio device preference
export function getSavedAudioDevice(): string | null {
  try {
    return localStorage.getItem(AUDIO_SETTINGS_KEY);
  } catch (error) {
    console.error('Error getting saved audio device:', error);
    return null;
  }
}

// Clear saved audio device preference
export function clearAudioDevicePreference(): void {
  try {
    localStorage.removeItem(AUDIO_SETTINGS_KEY);
  } catch (error) {
    console.error('Error clearing audio device preference:', error);
  }
}
