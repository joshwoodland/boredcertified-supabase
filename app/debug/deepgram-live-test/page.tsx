"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../../context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "../../context/MicrophoneContextProvider";

const DeepgramLiveTest = () => {
  const [caption, setCaption] = useState<string | undefined>(
    "Click 'Start Recording' to begin live transcription..."
  );
  const [isRecording, setIsRecording] = useState(false);
  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState } =
    useMicrophone();
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready && !connection) {
      connectToDeepgram({
        model: "nova-2",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState]);

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      // iOS SAFARI FIX:
      // Prevent packetZero from being sent. If sent at size 0, the connection will close. 
      if (e.data.size > 0) {
        connection?.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      console.log("thisCaption", thisCaption);
      if (thisCaption !== "") {
        console.log('thisCaption !== ""', thisCaption);
        setCaption(thisCaption);
      }

      if (isFinal && speechFinal) {
        clearTimeout(captionTimeout.current);
        captionTimeout.current = setTimeout(() => {
          setCaption("Listening...");
          clearTimeout(captionTimeout.current);
        }, 3000);
      }
    };

    if (connectionState === LiveConnectionState.OPEN) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
    }

    return () => {
      // prettier-ignore
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      clearTimeout(captionTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState]);

  const handleStartRecording = () => {
    if (microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.OPEN) {
      startMicrophone();
      setIsRecording(true);
      setCaption("Listening...");
    }
  };

  const handleStopRecording = () => {
    stopMicrophone();
    setIsRecording(false);
    setCaption("Recording stopped.");
  };

  const getStatusMessage = () => {
    if (microphoneState === MicrophoneState.NotSetup) return "Setting up microphone...";
    if (microphoneState === MicrophoneState.SettingUp) return "Requesting microphone access...";
    if (microphoneState === MicrophoneState.Error) return "Microphone error. Please check permissions.";
    if (connectionState === LiveConnectionState.CLOSED) return "Connecting to Deepgram...";
    if (connectionState === LiveConnectionState.OPEN && microphoneState === MicrophoneState.Ready) {
      return "Ready to start recording";
    }
    return "Initializing...";
  };

  const canRecord = microphoneState === MicrophoneState.Ready && 
                   connectionState === LiveConnectionState.OPEN && 
                   !isRecording;

  const canStop = isRecording && microphoneState === MicrophoneState.Open;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Deepgram Live Transcription Test
          </h1>
          
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Microphone Status</h3>
                <p className={`text-sm ${
                  microphoneState === MicrophoneState.Ready ? 'text-green-600' :
                  microphoneState === MicrophoneState.Error ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {microphoneState}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Connection Status</h3>
                <p className={`text-sm ${
                  connectionState === LiveConnectionState.OPEN ? 'text-green-600' :
                  connectionState === LiveConnectionState.CLOSED ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {connectionState}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Recording Status</h3>
                <p className={`text-sm ${isRecording ? 'text-green-600' : 'text-gray-600'}`}>
                  {isRecording ? 'Recording' : 'Stopped'}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">{getStatusMessage()}</p>
              
              <div className="flex gap-4">
                <button
                  onClick={handleStartRecording}
                  disabled={!canRecord}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Start Recording
                </button>
                
                <button
                  onClick={handleStopRecording}
                  disabled={!canStop}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Stop Recording
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg min-h-[200px]">
            <h3 className="font-semibold text-gray-700 mb-4">Live Transcription</h3>
            <div className="text-lg text-gray-800 leading-relaxed">
              {caption && (
                <p className={`${isRecording ? 'animate-pulse' : ''}`}>
                  {caption}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Allow microphone access when prompted</li>
            <li>Wait for the connection to Deepgram to establish</li>
            <li>Click "Start Recording" to begin live transcription</li>
            <li>Speak clearly into your microphone</li>
            <li>Watch the live transcription appear above</li>
            <li>Click "Stop Recording" when finished</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DeepgramLiveTest; 