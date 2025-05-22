/**
 * DeepgramHttpService.ts
 *
 * Alternative to WebSocket-based DeepgramService that uses HTTP streaming.
 * This service provides a fallback for environments where WebSocket connections
 * are unreliable or blocked (like some Vercel edge deployments).
 *
 * Uses shorter audio chunks and HTTP POST requests for transcription.
 */

export class DeepgramHttpService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new DeepgramHttpService instance
   *
   * @param onTranscript Callback function that receives transcription text and final status
   * @param onError Callback function that receives errors
   * @param audioDeviceId Optional audio device ID to use for capture
   * @param lowEchoCancellation Whether to use low echo cancellation settings
   */
  constructor(
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onError: (error: Error) => void,
    private audioDeviceId?: string,
    private lowEchoCancellation: boolean = false
  ) {}

  /**
   * Transcribes an audio blob using HTTP API
   */
  private async transcribeAudioChunk(audioBlob: Blob): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      // Use our server-side transcription endpoint instead of direct Deepgram calls
      // This provides better error handling and avoids CORS/network issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch('/api/transcribe/process', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server transcription failed:', response.status, errorData);
        
        if (response.status === 401) {
          // Token issue on server side
          console.log('Server reports authentication error');
          return; // Skip this chunk
        }
        throw new Error(`Server transcription error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        const transcript = result.results.channels[0].alternatives[0].transcript;
        if (transcript.trim()) {
          // HTTP API results are always final
          this.onTranscript(transcript, true);
        }
      }
    } catch (error) {
      console.error('Error transcribing audio chunk:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Network error in HTTP transcription - likely connection issue');
        // Don't call onError for individual network failures to avoid stopping the service
        // But if this becomes persistent, the service will need to be restarted
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.error('HTTP transcription request timed out');
      } else {
        // For other errors, we might want to signal a problem
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('HTTP transcription failed with error:', errorMessage);
      }
    }
  }

  /**
   * Processes accumulated audio chunks
   */
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    // Take all accumulated chunks and combine them
    const chunksToProcess = [...this.audioChunks];
    this.audioChunks = []; // Clear the array

    if (chunksToProcess.length > 0) {
      // Combine chunks into a single blob
      const combinedBlob = new Blob(chunksToProcess, { type: 'audio/webm' });
      
      // Only process if the blob has a reasonable size (at least 1KB)
      if (combinedBlob.size > 1024) {
        await this.transcribeAudioChunk(combinedBlob);
      }
    }
  }

  /**
   * Starts the HTTP-based transcription service
   */
  async start(): Promise<void> {
    try {
      // Prevent multiple simultaneous starts
      if (this.isRecording || this.stream) {
        console.log('HTTP service already starting or started, ignoring duplicate start request');
        return;
      }

      console.log('Starting HTTP-based Deepgram service...');

      // Request microphone access
      const audioConstraints: MediaStreamConstraints = {
        audio: {
          ...(this.audioDeviceId ? { deviceId: { exact: this.audioDeviceId } } : {}),
          echoCancellation: !this.lowEchoCancellation,
          noiseSuppression: !this.lowEchoCancellation,
          autoGainControl: !this.lowEchoCancellation,
          sampleRate: 16000, // Lower sample rate for HTTP API
          channelCount: 1
        }
      };

      console.log('Requesting microphone access for HTTP service...');
      this.stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('Microphone access granted for HTTP service');

      // Check if webm is supported
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
        }
      }

      console.log(`HTTP service using MIME type: ${mimeType}`);

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error in HTTP service:', event);
        this.onError(new Error('Recording error occurred in HTTP service'));
      };

      // Start recording with shorter intervals for more responsive transcription
      this.mediaRecorder.start(3000); // 3 second intervals for HTTP
      this.isRecording = true;

      // Process audio chunks every 4 seconds
      this.processingInterval = setInterval(() => {
        if (this.isRecording) {
          this.processAudioChunks().catch(error => {
            console.error('Error processing audio chunks:', error);
          });
        }
      }, 4000);

      console.log('HTTP-based Deepgram service started successfully');
    } catch (error) {
      console.error('Failed to start HTTP service:', error);
      this.stop(); // Clean up on failure
      this.onError(error instanceof Error ? error : new Error('Failed to start HTTP service'));
    }
  }

  /**
   * Stops the HTTP-based transcription service
   */
  stop(): void {
    console.log('Stopping HTTP-based Deepgram service...');

    this.isRecording = false;

    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Stop media recorder
    if (this.mediaRecorder?.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
    }

    // Stop all audio tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.error('Error stopping audio track:', error);
        }
      });
    }

    // Process any remaining chunks
    if (this.audioChunks.length > 0) {
      this.processAudioChunks().catch(error => {
        console.error('Error processing final audio chunks:', error);
      });
    }

    // Reset variables
    this.mediaRecorder = null;
    this.stream = null;
    this.audioChunks = [];

    console.log('HTTP service stopped successfully');
  }
} 