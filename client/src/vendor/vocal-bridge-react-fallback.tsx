import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'waiting_for_agent' | 'connected';
type TranscriptEntry = { role: 'user' | 'agent'; text: string; timestamp: number };
type VoiceError = { code: string; message: string };

interface VoiceContextValue {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isMicrophoneEnabled: boolean;
  toggleMicrophone: () => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  sendAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  agentMode?: string;
  error: VoiceError | null;
  transcript: TranscriptEntry[];
  clear: () => void;
  setAiHandler: (handler: ((query: string) => Promise<string>) | null) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);
const sampleCommand = 'Plan a 5-day Japan trip for four people under $6,000 with temples, food, history, and photography.';

export function VocalBridgeProvider({ children }: { children: ReactNode; options?: Record<string, unknown> }) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [isMicrophoneEnabled, setMicState] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiHandlerRef = useRef<((query: string) => Promise<string>) | null>(null);

  const sendToAgent = useCallback(async (query: string) => {
    if (!aiHandlerRef.current) return;
    try {
      const response = await aiHandlerRef.current(query);
      setTranscript((entries) => [...entries, { role: 'agent', text: response, timestamp: Date.now() }]);
    } catch (cause) {
      setError({ code: 'DATA_CHANNEL_ERROR', message: cause instanceof Error ? cause.message : 'The JourneyOS agent did not respond.' });
    }
  }, []);

  const disconnect = useCallback(async () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (mockTimeoutRef.current) clearTimeout(mockTimeoutRef.current);
    mockTimeoutRef.current = null;
    setMicState(false);
    setState('disconnected');
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setState('connecting');
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setState('connected');
      setMicState(true);
      mockTimeoutRef.current = setTimeout(() => {
        setTranscript((entries) => [...entries, { role: 'user', text: sampleCommand, timestamp: Date.now() }]);
        void sendToAgent(sampleCommand);
        setMicState(false);
        setState('disconnected');
      }, 900);
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => { setState('connected'); setMicState(true); };
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result?.[0]?.transcript?.trim();
      if (result?.isFinal && text) {
        setTranscript((entries) => [...entries, { role: 'user', text, timestamp: Date.now() }]);
        void sendToAgent(text);
      }
    };
    recognition.onerror = (event) => {
      setError({ code: event.error === 'not-allowed' ? 'MICROPHONE_ERROR' : 'CONNECTION_FAILED', message: event.error === 'not-allowed' ? 'Microphone access was blocked.' : `Voice capture failed: ${event.error}.` });
      setMicState(false);
      setState('disconnected');
    };
    recognition.onend = () => { setMicState(false); setState('disconnected'); recognitionRef.current = null; };
    recognition.start();
  }, [sendToAgent]);

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      recognitionRef.current?.stop();
      setMicState(false);
    } else if (state === 'disconnected') await connect();
  }, [connect, state]);
  const toggleMicrophone = useCallback(() => setMicrophoneEnabled(!isMicrophoneEnabled), [isMicrophoneEnabled, setMicrophoneEnabled]);
  const clear = useCallback(() => setTranscript([]), []);
  const setAiHandler = useCallback((handler: ((query: string) => Promise<string>) | null) => { aiHandlerRef.current = handler; }, []);
  const sendAction = useCallback(async () => undefined, []);

  useEffect(() => () => { void disconnect(); }, [disconnect]);
  const value = useMemo<VoiceContextValue>(() => ({ state, connect, disconnect, isMicrophoneEnabled, toggleMicrophone, setMicrophoneEnabled, sendAction, agentMode: 'mock-fallback', error, transcript, clear, setAiHandler }), [clear, connect, disconnect, error, isMicrophoneEnabled, sendAction, setAiHandler, setMicrophoneEnabled, state, toggleMicrophone, transcript]);
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

const useVoiceContext = () => {
  const value = useContext(VoiceContext);
  if (!value) throw new Error('VocalBridgeProvider is missing.');
  return value;
};

export function useVocalBridge() {
  const { transcript: _transcript, clear: _clear, setAiHandler: _setAiHandler, ...voice } = useVoiceContext();
  return { ...voice, client: null };
}

export function useTranscript() {
  const { transcript, clear } = useVoiceContext();
  return { transcript, clear };
}

export function useAIAgent({ onQuery }: { onQuery: (query: string) => Promise<string> }) {
  const { setAiHandler } = useVoiceContext();
  useEffect(() => { setAiHandler(onQuery); return () => setAiHandler(null); }, [onQuery, setAiHandler]);
  return { pendingQuery: null, respond: async () => undefined };
}

export function useAgentActions() {
  const { sendAction } = useVoiceContext();
  const onAction = useCallback(() => () => undefined, []);
  return { lastAction: null, sendAction, onAction };
}
