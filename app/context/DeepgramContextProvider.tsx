"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  FunctionComponent,
} from "react";

interface DeepgramContextType {
  connection: LiveClient | null;
  connectToDeepgram: (options: LiveSchema, endpoint?: string) => Promise<void>;
  disconnectFromDeepgram: () => void;
  connectionState: LiveConnectionState;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const getApiKey = async (): Promise<string> => {
  console.log('[DEEPGRAM CONTEXT] Fetching API key from /api/deepgram/authenticate');
  const response = await fetch("/api/deepgram/authenticate", { cache: "no-store" });
  
  console.log('[DEEPGRAM CONTEXT] API key response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[DEEPGRAM CONTEXT] Failed to get API key:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to get API key: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('[DEEPGRAM CONTEXT] API key received successfully');
  return result.key;
};

const DeepgramContextProvider: FunctionComponent<
  DeepgramContextProviderProps
> = ({ children }) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(
    LiveConnectionState.CLOSED
  );

  /**
   * Connects to the Deepgram speech recognition service and sets up a live transcription session.
   *
   * @param options - The configuration options for the live transcription session.
   * @param endpoint - The optional endpoint URL for the Deepgram service.
   * @returns A Promise that resolves when the connection is established.
   */
  const connectToDeepgram = async (options: LiveSchema, endpoint?: string) => {
    try {
      console.log('[DEEPGRAM CONTEXT] Getting API key...');
      const key = await getApiKey();
      console.log('[DEEPGRAM CONTEXT] Creating Deepgram client...');
      const deepgram = createClient(key);

      console.log('[DEEPGRAM CONTEXT] Establishing live connection...');
      const conn = deepgram.listen.live(options, endpoint);

      conn.addListener(LiveTranscriptionEvents.Open, () => {
        console.log('[DEEPGRAM CONTEXT] Connection opened');
        setConnectionState(LiveConnectionState.OPEN);
      });

      conn.addListener(LiveTranscriptionEvents.Close, () => {
        console.log('[DEEPGRAM CONTEXT] Connection closed');
        setConnectionState(LiveConnectionState.CLOSED);
      });

      conn.addListener(LiveTranscriptionEvents.Error, (error) => {
        console.error('[DEEPGRAM CONTEXT] Connection error:', error);
      });

      setConnection(conn);
    } catch (error) {
      console.error('[DEEPGRAM CONTEXT] Failed to connect:', error);
      setConnectionState(LiveConnectionState.CLOSED);
    }
  };

  const disconnectFromDeepgram = async () => {
    if (connection) {
      console.log('[DEEPGRAM CONTEXT] Disconnecting...');
      connection.finish();
      setConnection(null);
      setConnectionState(LiveConnectionState.CLOSED);
    }
  };

  return (
    <DeepgramContext.Provider
      value={{
        connection,
        connectToDeepgram,
        disconnectFromDeepgram,
        connectionState,
      }}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram(): DeepgramContextType {
  const context = useContext(DeepgramContext);
  if (context === undefined) {
    throw new Error(
      "useDeepgram must be used within a DeepgramContextProvider"
    );
  }
  return context;
}

export {
  DeepgramContextProvider,
  useDeepgram,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
}; 