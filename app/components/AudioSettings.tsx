'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getAudioInputDevices, 
  saveAudioDevicePreference, 
  getSavedAudioDevice,
  detectVirtualAudioDevice,
  isAudioLoopbackSupported
} from '../utils/audioLoopback';

interface AudioSettingsProps {
  onDeviceChange?: (deviceId: string) => void;
  className?: string;
}

export default function AudioSettings({ onDeviceChange, className = '' }: AudioSettingsProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasVirtualDevice, setHasVirtualDevice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Load available audio devices
  const loadAudioDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check for virtual audio devices
      const hasVirtual = await detectVirtualAudioDevice();
      setHasVirtualDevice(hasVirtual);
      
      // Get all audio input devices
      const devices = await getAudioInputDevices();
      setAudioDevices(devices);
      
      // Get saved device preference
      const savedDevice = getSavedAudioDevice();
      
      // If we have a saved device and it exists in the list, select it
      if (savedDevice && devices.some(d => d.deviceId === savedDevice)) {
        setSelectedDeviceId(savedDevice);
        if (onDeviceChange) onDeviceChange(savedDevice);
      } else if (devices.length > 0) {
        // Otherwise select the first device
        setSelectedDeviceId(devices[0].deviceId);
        if (onDeviceChange) onDeviceChange(devices[0].deviceId);
      }
      
      setPermissionDenied(false);
    } catch (error) {
      console.error('Error loading audio devices:', error);
      setPermissionDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceChange]);

  // Load devices on component mount
  useEffect(() => {
    if (isAudioLoopbackSupported()) {
      loadAudioDevices();
    }
  }, [loadAudioDevices]);

  // Handle device selection change
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedDeviceId(deviceId);
    saveAudioDevicePreference(deviceId);
    if (onDeviceChange) onDeviceChange(deviceId);
  };

  // If audio API is not supported, show a message
  if (!isAudioLoopbackSupported()) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Advanced audio settings are not supported in this browser.
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="audioDevice" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Audio Input Device
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showHelp ? 'Hide Help' : 'Need Help?'}
          </button>
        </div>
        
        {isLoading ? (
          <div className="h-10 flex items-center">
            <div className="animate-pulse w-full h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ) : permissionDenied ? (
          <div className="text-sm text-red-500">
            Microphone permission denied. Please allow microphone access in your browser settings.
          </div>
        ) : (
          <select
            id="audioDevice"
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            {audioDevices.length === 0 ? (
              <option value="">No audio devices found</option>
            ) : (
              audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio Device ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))
            )}
          </select>
        )}
        
        {!hasVirtualDevice && !isLoading && !permissionDenied && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            No virtual audio device detected. To capture patient audio, install BlackHole (Mac) or VB-Cable (Windows).
          </div>
        )}
        
        {hasVirtualDevice && !isLoading && !permissionDenied && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            Virtual audio device detected! Select it above to capture both your voice and patient audio.
          </div>
        )}
        
        {showHelp && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs">
            <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">How to capture patient audio:</h4>
            <p className="mb-2">To capture both your voice and the patient's voice from your computer speakers:</p>
            
            <div className="mb-2">
              <strong className="block">Mac users:</strong>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Install <a href="https://existential.audio/blackhole/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">BlackHole</a> or <a href="https://rogueamoeba.com/loopback/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Loopback</a></li>
                <li>Set up an aggregate device in Audio MIDI Setup</li>
                <li>Select the aggregate device in the dropdown above</li>
              </ol>
            </div>
            
            <div>
              <strong className="block">Windows users:</strong>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Install <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">VB-Cable</a> or <a href="https://vb-audio.com/Voicemeeter/banana.htm" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">VoiceMeeter Banana</a></li>
                <li>Configure your system to output to the virtual device</li>
                <li>Select the virtual device in the dropdown above</li>
              </ol>
            </div>
            
            <button
              type="button"
              onClick={() => loadAudioDevices()}
              className="mt-3 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Refresh Devices
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
