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
  private currentToken: string | null = null;

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
   * Gets a fresh token for HTTP requests
   */
  private async getToken(): Promise<string> {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/deepgram/token?ttl=3600&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Token API failed: ${response.status}`);
      }

      const tokenData = await response.json();
      if (!tokenData.token) {
        throw new Error('No token received from server');
      }

      this.currentToken = tokenData.token;
      return tokenData.token;
    } catch (error) {
      console.error('Error getting Deepgram token:', error);
      throw new Error('Failed to get authentication token');
    }
  }

  /**
   * Transcribes an audio blob using HTTP API
   */
  private async transcribeAudioChunk(audioBlob: Blob): Promise<void> {
    if (!this.currentToken) {
      console.log('No token available, skipping transcription chunk');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to get a new one
          console.log('Token expired, refreshing...');
          await this.getToken();
          return; // Skip this chunk, next one will use new token
        }
        throw new Error(`Deepgram API error: ${response.status}`);
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
      // Don't call onError for individual chunk failures to avoid stopping the service
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

      // Get initial token
      await this.getToken();

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
    this.currentToken = null;

    console.log('HTTP service stopped successfully');
  }
} 