declare module '@vocalbridgeai/react' {
  import type { ReactNode } from 'react';

  export interface VocalBridgeError { code: string; message: string; }
  export interface TranscriptEntry { role: 'user' | 'agent'; text: string; timestamp: number; }
  export type ConnectionState = 'disconnected' | 'connecting' | 'waiting_for_agent' | 'connected';

  export function VocalBridgeProvider(props: { children: ReactNode; options: { auth: { tokenUrl: string }; participantName?: string; debug?: boolean } }): JSX.Element;
  export function useVocalBridge(): {
    state: ConnectionState;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isMicrophoneEnabled: boolean;
    toggleMicrophone: () => Promise<void>;
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
    sendAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
    agentMode?: string;
    error: VocalBridgeError | null;
    client: unknown;
  };
  export function useTranscript(): { transcript: TranscriptEntry[]; clear: () => void };
  export function useAgentActions(): {
    lastAction: { action: string; payload: Record<string, unknown> } | null;
    sendAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
    onAction: (action: string, handler: (payload: Record<string, unknown>) => void) => () => void;
  };
  export function useAIAgent(options: { onQuery: (query: string) => Promise<string> }): { pendingQuery: null; respond: (turnId: string, response: string) => Promise<void> };
}

declare const __VOCAL_BRIDGE_SDK_AVAILABLE__: boolean;
