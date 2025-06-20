"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

// Enhanced interfaces for topic detection
interface TopicDetectionResult {
  segments: Array<{
    text: string;
    topics: Array<{
      topic: string;
      confidence_score: number;
    }>;
  }>;
}

interface EnhancedLiveTranscriptionEvent extends LiveTranscriptionEvent {
  topics?: TopicDetectionResult;
}

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
  topicsEnabled: boolean;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

// Cache the API key promise to avoid multiple requests
let apiKeyPromise: Promise<string> | null = null;

const getApiKey = async (): Promise<string> => {
  if (!apiKeyPromise) {
    apiKeyPromise = fetch("/api/deepgram/authenticate", { cache: "no-store" })
      .then(response => response.json())
      .then(result => result.key)
      .catch(error => {
        apiKeyPromise = null; // Reset on error
        throw error;
      });
  }
  return apiKeyPromise;
};

const DeepgramContextProvider: FunctionComponent<
  DeepgramContextProviderProps
> = ({ children }) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(
    LiveConnectionState.CLOSED
  );
  const [topicsEnabled, setTopicsEnabled] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  /**
   * Connects to the Deepgram speech recognition service and sets up a live transcription session.
   *
   * @param options - The configuration options for the live transcription session.
   * @param endpoint - The optional endpoint URL for the Deepgram service.
   * @returns A Promise that resolves when the connection is established.
   */
  const connectToDeepgram = async (options: LiveSchema, endpoint?: string) => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting || connectionState === LiveConnectionState.OPEN) {
      console.log("[DEEPGRAM CONTEXT] Connection already in progress or open");
      return;
    }

    console.log("[DEEPGRAM CONTEXT] === CONNECT TO DEEPGRAM CALLED ===");
    setIsConnecting(true);

    try {
      console.log("[DEEPGRAM CONTEXT] Getting API key...");
      const key = await getApiKey();
      
      // Track if topics are enabled
      const hasTopics = !!(options as any).topics;
      setTopicsEnabled(hasTopics);
      
      if (hasTopics) {
        console.log("[DEEPGRAM CONTEXT] Topic detection enabled - using built-in topics");
      }

      console.log("[DEEPGRAM CONTEXT] Creating client...");
      const deepgram = createClient(key);
      
      console.log("[DEEPGRAM CONTEXT] Establishing live connection...");
      const conn = deepgram.listen.live(options, endpoint);

      conn.addListener(LiveTranscriptionEvents.Open, () => {
        console.log("[DEEPGRAM CONTEXT] Connection opened successfully");
        setConnectionState(LiveConnectionState.OPEN);
        setIsConnecting(false);
      });

      conn.addListener(LiveTranscriptionEvents.Close, (event) => {
        console.log("[DEEPGRAM CONTEXT] Connection closed:", event);
        setConnectionState(LiveConnectionState.CLOSED);
        setConnection(null);
        setTopicsEnabled(false);
        setIsConnecting(false);
      });

      conn.addListener(LiveTranscriptionEvents.Error, (error) => {
        console.error("[DEEPGRAM CONTEXT] Connection error:", error);
        setConnectionState(LiveConnectionState.CLOSED);
        setConnection(null);
        setTopicsEnabled(false);
        setIsConnecting(false);
      });

      setConnection(conn);
    } catch (error) {
      console.error("[DEEPGRAM CONTEXT] Failed to connect:", error);
      setConnectionState(LiveConnectionState.CLOSED);
      setConnection(null);
      setTopicsEnabled(false);
      setIsConnecting(false);
    }
  };

  const disconnectFromDeepgram = () => {
    if (connection) {
      console.log("[DEEPGRAM CONTEXT] Disconnecting...");
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
        topicsEnabled,
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