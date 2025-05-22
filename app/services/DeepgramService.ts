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
   * @param lowEchoCancellation Whether to use low echo cancellation settings
   */
  constructor(
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onError: (error: Error) => void,
    private audioDeviceId?: string,
    private lowEchoCancellation: boolean = false
  ) {}

  /**
   * Gets WebSocket connection details using our token API
   */
  private async getConnectionDetails() {
    try {
      // Define transcription options
      const options = {
        language: 'en-US',
        model: 'nova-2',
        punctuate: true,
        diarize: false,
        smart_format: true,
      };

      console.log('Requesting Deepgram token from server...', {
        environment: process.env.NODE_ENV,
        buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'not set',
        tokenApiUrl: `/api/deepgram/token?ttl=3600&t=${new Date().getTime()}`
      });

      // Step 1: Get a temporary token from our secure API endpoint
      // Add a timestamp to avoid caching issues
      const timestamp = new Date().getTime();
      const tokenResponse = await fetch(`/api/deepgram/token?ttl=3600&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      console.log(`Token API response status: ${tokenResponse.status}`, {
        ok: tokenResponse.ok,
        statusText: tokenResponse.statusText,
        headers: Object.fromEntries([...tokenResponse.headers.entries()])
      });

      // Parse the token response
      let tokenData;
      let responseText;
      try {
        // First get the raw text for logging
        responseText = await tokenResponse.text();
        console.log('Token API raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));

        // Then parse it as JSON
        try {
          tokenData = JSON.parse(responseText);
          console.log('Token data structure:', Object.keys(tokenData));
        } catch (jsonError) {
          console.error('Failed to parse token response as JSON:', jsonError, 'Raw response:', responseText);
          throw new Error(`Failed to parse token response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        }
      } catch (textError) {
        console.error('Failed to get token response text:', textError);
        throw new Error(`Failed to read token response: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
      }

      // Check if the token request was successful
      if (!tokenResponse.ok) {
        console.error('Server returned an error for token request:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          data: tokenData
        });
        const errorMessage = tokenData.details || tokenData.error || `Server responded with status ${tokenResponse.status}`;
        console.error(`Detailed token error: ${errorMessage}`);

        // Try the legacy websocket API as a fallback
        console.log('Attempting to use legacy websocket API as fallback...');
        return this.getLegacyConnectionDetails();
      }

      // Verify we received a valid token
      if (!tokenData.token) {
        console.error('Invalid token received:', tokenData);

        // Try the legacy websocket API as a fallback
        console.log('Attempting to use legacy websocket API as fallback...');
        return this.getLegacyConnectionDetails();
      }

      console.log('Successfully received Deepgram token');

      // Step 2: Build the WebSocket URL with the provided options
      const queryParams = Object.entries(options)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');

      // Return the WebSocket URL and headers with the temporary token
      // For JWT tokens from the token API, we need to use Bearer format
      return {
        url: `wss://api.deepgram.com/v1/listen?${queryParams}`,
        headers: {
          Authorization: `Bearer ${tokenData.token}`,
        }
      };
    } catch (error) {
      console.error('Error getting Deepgram connection details:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get Deepgram connection details');
    }
  }

  /**
   * Fallback method to get WebSocket connection details using the legacy API
   * This is used when the token API fails
   */
  private async getLegacyConnectionDetails() {
    try {
      // Define transcription options
      const options = {
        language: 'en-US',
        model: 'nova-2',
        punctuate: true,
        diarize: false,
        smart_format: true,
      };

      console.log('Using legacy websocket API as fallback...');

      // Add a timestamp to avoid caching issues
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/deepgram/websocket?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(options),
      });

      console.log(`Legacy API response status: ${response.status}`, {
        ok: response.ok,
        statusText: response.statusText
      });

      // Always parse the response, even if it's an error
      let data;
      try {
        const responseText = await response.text();
        console.log('Legacy API raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
        data = JSON.parse(responseText);
        console.log('Legacy API response structure:', Object.keys(data));
      } catch (parseError) {
        console.error('Failed to parse legacy API response as JSON:', parseError);
        throw new Error(`Failed to parse server response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      if (!response.ok) {
        // Log the full error response for debugging
        console.error('Legacy API returned an error:', data);
        const errorMessage = data.details || data.error || `Server responded with status ${response.status}`;
        console.error(`Detailed error: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      if (!data.url || !data.headers?.Authorization) {
        console.error('Invalid connection details received from legacy API:', data);
        throw new Error('Invalid connection details received from server');
      }

      console.log('Successfully received connection details from legacy API');
      return data;
    } catch (error) {
      console.error('Error getting legacy connection details:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get Deepgram connection details');
    }
  }

  /**
   * Starts the transcription service
   * - Requests microphone access (or specific audio device if provided)
   * - Establishes WebSocket connection to Deepgram
   * - Begins streaming audio data
   */
  async start() {
    try {
      // SECURITY CHECK: Warn if there's any attempt to use the old NEXT_PUBLIC_DEEPGRAM_API_KEY pattern
      // This helps catch any old code that might still be trying to use the insecure pattern
      if (typeof process !== 'undefined' &&
          process.env &&
          'NEXT_PUBLIC_DEEPGRAM_API_KEY' in process.env) {
        console.error(
          'SECURITY WARNING: NEXT_PUBLIC_DEEPGRAM_API_KEY should not be used. ' +
          'The application is configured to use secure server-side API routes instead.'
        );
      }

      // Request microphone access with specific device ID if provided
      let audioConstraints: MediaStreamConstraints;

      if (this.lowEchoCancellation) {
        // Use low echo cancellation settings
        audioConstraints = {
          audio: {
            ...(this.audioDeviceId ? { deviceId: { exact: this.audioDeviceId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        };
        console.log('Using low echo cancellation mode');
      } else {
        // Use standard settings
        audioConstraints = this.audioDeviceId
          ? { audio: { deviceId: { exact: this.audioDeviceId } } }
          : { audio: true };
      }

      console.log('Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('Microphone access granted');

      try {
        // Get connection details from our API
        console.log('Requesting Deepgram connection details...');
        const { url, headers } = await this.getConnectionDetails();

        // Create WebSocket with the provided URL and headers
        console.log('Creating WebSocket connection to Deepgram...');
        this.socket = new WebSocket(url);

        // Add authorization header to the WebSocket connection
        this.socket.onopen = () => {
          if (this.socket) {
            // Set the authorization header
            // Send the authorization header with Bearer token
            this.socket.send(JSON.stringify({
              type: 'header',
              headers: {
                Authorization: headers.Authorization
              }
            }));
            console.log('Deepgram connection established');
            this.reconnectAttempts = 0;
            this.startRecording();
          }
        };
      } catch (connectionError) {
        // Handle connection detail errors specifically
        console.error('Failed to establish Deepgram connection:', connectionError);
        this.onError(new Error('Failed to establish Deepgram connection. Please try again later.'));
        throw connectionError;
      }

      // Set up WebSocket event handlers
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || '';
            if (transcript) {
              this.onTranscript(transcript, data.is_final || false);
            }
          } else if (data.type === 'Error') {
            this.handleError(new Error(`Deepgram API error: ${data.message || 'Unknown error'}`));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.handleError(new Error('Invalid WebSocket message format'));
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
    try {
      // Log the error with stack trace for better debugging
      console.error('Deepgram error handler called:', {
        message: error.message,
        stack: error.stack,
        reconnectAttempts: this.reconnectAttempts
      });

      // Notify the error callback
      this.onError(error);

      // Only attempt to reconnect if we haven't exceeded the maximum attempts
      // This prevents infinite reconnection loops
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
        this.reconnect();
      } else {
        console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      }
    } catch (handlerError) {
      // Prevent any errors in the error handler from causing further issues
      console.error('Error in Deepgram error handler:', handlerError);
    }
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
      this.stop(false); // Ensure cleanup without resetting attempts
    }
  }

  /**
   * Attempts to reconnect to Deepgram
   */
  private async reconnect() {
    this.stop(false); // Stop without resetting attempts
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

    // Stop media recorder
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // Close WebSocket connection
    if (this.socket) {
      this.socket.close();
    }

    // Stop all audio tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
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