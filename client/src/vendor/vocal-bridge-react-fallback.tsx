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
const actionBus = new EventTarget();
const emitAction = (action: string, payload: Record<string, unknown> = {}) => actionBus.dispatchEvent(new CustomEvent(action, { detail: payload }));

const interpretCommand = (query: string): { action: string; payload?: Record<string, unknown>; response: string } => {
  const value = query.toLowerCase();
  if (/\b(?:open|show|go to|take me to)\b.*\b(?:live|itinerary|trip plan)\b/.test(value)) return { action: 'navigate', payload: { page: 'live' }, response: 'Opening the live itinerary.' };
  if (/\b(?:open|show|go to|take me to)\b.*\b(?:book|booking|payment|split)\b/.test(value)) return { action: 'navigate', payload: { page: 'checkout' }, response: 'Opening Book & split.' };
  if (/\b(?:open|show|go to|take me to)\b.*\b(?:expense|receipt|settlement)\b/.test(value)) return { action: 'navigate', payload: { page: 'expenses' }, response: 'Opening Shared expenses.' };
  if (/\b(?:open|show|go to|take me to)\b.*\b(?:travel memory|travel dna)\b/.test(value)) return { action: 'navigate', payload: { page: 'dna' }, response: 'Opening Travel memory.' };
  if (/\b(?:open|show|go to|take me to)\b.*\b(?:plan together|planner|preferences)\b/.test(value)) return { action: 'navigate', payload: { page: 'planner' }, response: 'Opening Plan together.' };
  if (/\b(?:option|bundle)\s*a\b|\bbest value\b/.test(value)) return { action: 'select_bundle', payload: { id: 'value' }, response: 'Selecting bundle A, Best value.' };
  if (/\b(?:option|bundle)\s*b\b|\bbest overall\b|\bamerican airlines\b/.test(value)) return { action: 'select_bundle', payload: { id: 'overall' }, response: 'Selecting bundle B, Best overall with American Airlines.' };
  if (/\b(?:option|bundle)\s*c\b|\bneighbou?rhood hop\b|\bmulti(?:-| )stay\b/.test(value)) return { action: 'select_bundle', payload: { id: 'neighborhood' }, response: 'Selecting bundle C, Neighborhood hop.' };
  if (/\bconfirm\b.*\b(?:booking|bundle|trip)\b/.test(value)) return { action: 'confirm_booking', response: 'Confirming the selected bundle and opening the payment split.' };
  if (/\b(?:collect|create|start)\b.*\b(?:paypal|payment)\b/.test(value)) return { action: 'collect_payment', response: 'Creating the PayPal sandbox payment split.' };
  const day = value.match(/\b(?:show|open|go to)?\s*day\s+(\d{1,2})\b/)?.[1];
  if (day) return { action: 'show_day', payload: { day: Number(day) }, response: `Showing day ${day}.` };
  if (/\b(complete|completed|done|finished|saw|visited|undo|restore|reopen|start|begin|arrived|cancel|skip|remove|drop|late|delay|delayed|behind|stuck)\b/.test(value)) return { action: 'itinerary_command', payload: { query }, response: 'Applying that change to the selected itinerary day.' };
  if (/\b(tired|exhausted|need a break|slow down)\b/.test(value)) return { action: 'replan_trip', payload: { type: 'tired' }, response: 'Reducing the active day while protecting its most important stop.' };
  if (/\b(?:delay|disruption|replan)\b/.test(value)) return { action: 'confirm_change', response: 'Applying the demo disruption and replanning the itinerary.' };
  return { action: 'trip_brief_ready', payload: { conversation: query }, response: 'Updating the trip from your spoken brief.' };
};

export function VocalBridgeProvider({ children }: { children: ReactNode; options?: Record<string, unknown> }) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [isMicrophoneEnabled, setMicState] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiHandlerRef = useRef<((query: string) => Promise<string>) | null>(null);

  const sendToAgent = useCallback(async (query: string) => {
    try {
      const response = aiHandlerRef.current
        ? await aiHandlerRef.current(query)
        : (() => { const command = interpretCommand(query); emitAction(command.action, command.payload); return command.response; })();
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
      setError({ code: 'MICROPHONE_UNAVAILABLE', message: 'This browser does not provide speech capture. Use Chrome or Edge, or type the same command in Plan together.' });
      setState('disconnected');
      setMicState(false);
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
  const sendAction = useCallback(async (action: string, payload: Record<string, unknown> = {}) => { emitAction(action, payload); }, []);

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
  const onAction = useCallback((action: string, handler: (payload: Record<string, unknown>) => void) => {
    const listener = (event: Event) => handler((event as CustomEvent<Record<string, unknown>>).detail ?? {});
    actionBus.addEventListener(action, listener);
    return () => actionBus.removeEventListener(action, listener);
  }, []);
  return { lastAction: null, sendAction, onAction };
}
