/**
 * DeepgramService.ts
 *
 * This service handles real-time transcription using Deepgram's WebSocket API.
 * It manages the WebSocket connection, audio recording, and provides transcription results.
 * Compatible with Deepgram SDK v3
 *
 * Supports audio loopback for capturing both microphone and system audio
 * when using virtual audio devices like BlackHole or Loopback.
 */

export class DeepgramService {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  /**
   * Creates a new DeepgramService instance
   *
   * @param onTranscript Callback function that receives transcription text and final status
   * @param onError Callback function that receives errors
   * @param audioDeviceId Optional audio device ID to use for capture (for loopback support)
   */
  constructor(
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onError: (error: Error) => void,
    private audioDeviceId?: string,
    private lowEchoCancellation: boolean = false
  ) {}

  /**
   * Starts the transcription service
   * - Requests microphone access (or specific audio device if provided)
   * - Establishes WebSocket connection to Deepgram
   * - Begins streaming audio data
   */
  async start() {
    try {
      // Request microphone access with specific device ID if provided
      let audioConstraints: MediaStreamConstraints;

      if (this.lowEchoCancellation) {
        // Use low echo cancellation settings
        audioConstraints = {
          audio: {
            ...(this.audioDeviceId ? { deviceId: { exact: this.audioDeviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        };
        console.log('Using low echo cancellation mode');
      } else {
        // Use standard settings
        audioConstraints = this.audioDeviceId
          ? { audio: { deviceId: { exact: this.audioDeviceId } } }
          : { audio: true };
      }

      this.stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error('Deepgram API key not found');
      }

      // Create WebSocket connection to Deepgram
      // Using direct WebSocket connection instead of SDK for browser compatibility
      const options = {
        language: 'en-US',
        model: 'nova-2',
        punctuate: true,
        diarize: false,
        smart_format: true
      };

      // Build URL with query parameters
      const queryParams = Object.entries(options)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');

      // Create WebSocket with API key in header
      this.socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${queryParams}`,
        ['token', apiKey]
      );

      // Set up WebSocket event handlers
      this.socket.onopen = () => {
        console.log('Deepgram connection established');
        this.startRecording();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript || '';
          if (transcript) {
            this.onTranscript(transcript, data.is_final || false);
          }
        }
      };

      this.socket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        this.handleError(new Error('WebSocket error occurred'));
      };

      this.socket.onclose = (event) => {
        console.log(`Deepgram connection closed: ${event.code} ${event.reason}`);
        this.handleDisconnect();
      };

    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Unknown error occurred'));
    }
  }

  /**
   * Starts recording audio and sending it to Deepgram
   */
  private startRecording() {
    if (!this.stream || !this.socket) return;

    try {
      // Create MediaRecorder to capture audio
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm',
      });

      // Send audio data to Deepgram when available
      this.mediaRecorder.ondataavailable = (event) => {
        if (this.socket?.readyState === WebSocket.OPEN && event.data.size > 0) {
          this.socket.send(event.data);
        }
      };

      // Handle recording errors
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.handleError(new Error('Recording error occurred'));
      };

      // Start recording with 250ms intervals
      this.mediaRecorder.start(250);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to start recording'));
    }
  }

  /**
   * Handles errors by calling the error callback and attempting to reconnect
   */
  private handleError(error: Error) {
    this.onError(error);
    this.reconnect();
  }

  /**
   * Handles WebSocket disconnection with exponential backoff retry
   */
  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      this.reconnectTimeout = setTimeout(() => this.reconnect(), delay);
    } else {
      this.onError(new Error('Maximum reconnection attempts reached'));
    }
  }

  /**
   * Attempts to reconnect to Deepgram
   */
  private async reconnect() {
    this.stop(false);
    await this.start();
  }

  /**
   * Stops the transcription service
   * @param resetAttempts Whether to reset reconnection attempts (default: true)
   */
  stop(resetAttempts = true) {
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop media recorder if it's recording
    if (this.mediaRecorder?.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping media recorder:', e);
      }
    }

    // Close WebSocket connection
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
    }

    // Stop all audio tracks
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping audio tracks:', e);
      }
    }

    // Reset instance variables
    this.socket = null;
    this.mediaRecorder = null;
    this.stream = null;

    // Reset reconnection attempts if requested
    if (resetAttempts) {
      this.reconnectAttempts = 0;
    }
  }
}
