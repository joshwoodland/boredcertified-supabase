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
  private maxReconnectAttempts = 2; // Reduced for faster fallback
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private disableReconnect = false; // Add flag to disable reconnect

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
   * Disable automatic reconnection attempts
   */
  public disableAutoReconnect(): void {
    this.disableReconnect = true;
    this.maxReconnectAttempts = 0;
  }

  /**
   * Gets WebSocket connection details using our token API
   */
  private async getConnectionDetails() {
    try {
      // Define transcription options with improved settings for Vercel deployment
      const options = {
        language: 'en-US',
        model: 'nova-2',
        punctuate: true,
        diarize: false,
        smart_format: true,
        interim_results: true,
        encoding: 'webm',
        channels: 1,
        sample_rate: 48000
      };

      console.log('Requesting Deepgram token from server...', {
        environment: process.env.NODE_ENV,
        buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'not set',
        tokenApiUrl: `/api/deepgram/token?ttl=3600&t=${new Date().getTime()}`
      });

      // Step 1: Get a temporary token from our secure API endpoint
      // Add a timestamp to avoid caching issues
      const timestamp = new Date().getTime();
      const tokenResponse = await fetch(`/api/deepgram/token?ttl=7200&t=${timestamp}`, {
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

      // Step 2: Build the WebSocket URL with the token embedded in the URL
      // This is the correct method for browser-based WebSocket connections to Deepgram
      const queryParams = Object.entries(options)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&');

      // Include the token directly in the URL - this is the correct approach per Deepgram docs
      const url = `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(tokenData.token)}&${queryParams}`;

      console.log('Built WebSocket URL with embedded token');

      // Return the WebSocket URL (no headers needed for browser-based connections)
      return { url };
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
        console.error('Legacy API returned an error:', data);
        throw new Error(data.details || data.error || `Server responded with status ${response.status}`);
      }

      // The legacy API should return a URL with token, but if it returns headers, we need to convert
      if (data.url && data.headers && data.headers.Authorization) {
        // Extract token from Authorization header and embed it in the URL
        const token = data.headers.Authorization.replace(/^(Token|Bearer)\s+/, '');
        
        // Build URL with token embedded
        const baseUrl = data.url;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const urlWithToken = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
        
        console.log('Converted legacy API response to token-in-URL format');
        return { url: urlWithToken };
      } else if (data.url) {
        // URL already has token embedded
        return { url: data.url };
      } else {
        throw new Error('Invalid legacy API response: missing URL');
      }
    } catch (error) {
      console.error('Error using legacy websocket API:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get legacy connection details');
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
      // Prevent multiple simultaneous starts
      if (this.socket || this.stream) {
        console.log('Service already starting or started, ignoring duplicate start request');
        return;
      }

      // SECURITY CHECK: Warn if there's any attempt to use the old NEXT_PUBLIC_DEEPGRAM_API_KEY pattern
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
            sampleRate: 48000,
            channelCount: 1
          },
        };
        console.log('Using low echo cancellation mode');
      } else {
        // Use standard settings optimized for WebRTC
        audioConstraints = {
          audio: {
            ...(this.audioDeviceId ? { deviceId: { exact: this.audioDeviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1
          }
        };
      }

      console.log('Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('Microphone access granted');

      try {
        // Get connection details from our API
        console.log('Requesting Deepgram connection details...');
        const { url } = await this.getConnectionDetails();

        // Create WebSocket with proper protocol and headers
        console.log('Creating WebSocket connection to Deepgram...');
        
        // Log the exact URL being used (with token partially masked for security)
        const maskedUrl = url.replace(/token=([^&]+)/, 'token=***REDACTED***');
        console.log('WebSocket URL (masked):', maskedUrl);
        console.log('URL length:', url.length);
        console.log('URL starts with wss://api.deepgram.com:', url.startsWith('wss://api.deepgram.com'));
        
        // Create WebSocket with token in URL
        this.socket = new WebSocket(url);
        
        // Log WebSocket creation details
        console.log('WebSocket instance created:', {
          readyState: this.socket.readyState,
          protocol: this.socket.protocol,
          extensions: this.socket.extensions,
          url: maskedUrl
        });

        // Set a connection timeout to handle hanging connections
        this.connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            console.error('WebSocket connection timeout after 10 seconds');
            this.socket.close();
            this.handleError(new Error('Connection timeout - WebSocket handshake failed'));
          }
        }, 10000); // 10 second timeout

        // Set up WebSocket event handlers
        this.socket.onopen = () => {
          console.log('Deepgram WebSocket connection established successfully');
          console.log('Connection details:', {
            readyState: this.socket?.readyState,
            url: url.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
          });
          
          // Clear connection timeout
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          this.reconnectAttempts = 0;
          this.startRecording();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received message type:', data.type);
            
            if (data.type === 'Results') {
              const transcript = data.channel?.alternatives?.[0]?.transcript || '';
              if (transcript) {
                console.log('Transcript received:', { 
                  text: transcript, 
                  isFinal: data.is_final || false,
                  confidence: data.channel?.alternatives?.[0]?.confidence 
                });
                this.onTranscript(transcript, data.is_final || false);
              }
            } else if (data.type === 'Error') {
              console.error('Deepgram API error:', data);
              this.handleError(new Error(`Deepgram API error: ${data.message || 'Unknown error'}`));
            } else if (data.type === 'Metadata') {
              console.log('Deepgram metadata received:', {
                request_id: data.request_id,
                model_info: data.model_info,
                duration: data.duration
              });
            } else {
              console.log('Unknown message type:', data.type, data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.handleError(new Error('Invalid WebSocket message format'));
          }
        };

        this.socket.onerror = (error) => {
          console.error('Deepgram WebSocket error:', error);
          console.error('Error details:', {
            readyState: this.socket?.readyState,
            timestamp: new Date().toISOString(),
            url: url.substring(0, 100) + '...'
          });
          
          // Clear connection timeout
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          // Provide more specific error messaging based on WebSocket state
          let errorMessage = 'WebSocket connection error';
          if (this.socket?.readyState === WebSocket.CONNECTING) {
            errorMessage = 'Failed to establish WebSocket connection - this may indicate authentication issues or network problems';
          } else if (this.socket?.readyState === WebSocket.CLOSING) {
            errorMessage = 'WebSocket connection is closing unexpectedly';
          }
          
          this.handleError(new Error(errorMessage));
        };

        this.socket.onclose = (event) => {
          console.log(`Deepgram connection closed: ${event.code} ${event.reason}`);
          console.log('Close event details:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            timestamp: new Date().toISOString(),
            url: url.substring(0, 100) + '...'
          });
          
          // Clear connection timeout
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          
          // Handle specific close codes with helpful error messages
          if (event.code === 1006) {
            console.error('WebSocket closed abnormally (1006) - Common causes:');
            console.error('- Authentication method incorrect (should use token in URL for browsers)');
            console.error('- Network connectivity issues');
            console.error('- Firewall blocking WebSocket connections');
            console.error('- Server-side token validation failure');
          } else if (event.code === 1011) {
            console.error('WebSocket closed due to server error (1011)');
          } else if (event.code === 4001) {
            console.error('WebSocket closed due to authentication error (4001)');
          } else if (event.code === 1000) {
            console.log('WebSocket closed normally (1000)');
          }
          
          this.handleDisconnect();
        };

      } catch (connectionError) {
        // Handle connection detail errors specifically
        console.error('Failed to establish Deepgram connection:', connectionError);
        this.onError(new Error('Failed to establish Deepgram connection. Please try again later.'));
        throw connectionError;
      }

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
      // Check if webm is supported, fallback to other formats
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
        }
      }

      console.log(`Using MIME type: ${mimeType}`);

      // Create MediaRecorder to capture audio
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
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
      console.log('Started recording and streaming to Deepgram');
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
    if (this.disableReconnect) {
      console.log('Auto-reconnect disabled, not attempting reconnection');
      this.onError(new Error('WebSocket connection lost'));
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000); // Max 5 seconds
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      this.reconnectTimeout = setTimeout(() => this.reconnect(), delay);
    } else {
      console.log(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached for WebSocket`);
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
    // Clear any pending timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
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