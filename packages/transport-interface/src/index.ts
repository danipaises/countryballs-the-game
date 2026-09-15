import type { Lane } from '@countryballs/protocol';
import type { Unsubscribe } from '@countryballs/shared-types';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
export interface TransportStats {
  rttMs: number | null;
  packetLoss: number | null;
  bytesSent: number;
  bytesReceived: number;
  bufferedBytes: number;
  path: 'lan' | 'direct' | 'relay' | 'unknown';
}
export interface Transport {
  readonly state: ConnectionState;
  connect(signal?: AbortSignal): Promise<void>;
  // Return false only for dropped realtime frames. Reliable overflow must fail visibly.
  send(lane: Lane, bytes: Uint8Array): boolean;
  subscribe(handler: (lane: Lane, bytes: Uint8Array) => void): Unsubscribe;
  onState(handler: (state: ConnectionState) => void): Unsubscribe;
  stats(): TransportStats;
  close(reason: string): void;
}
export type SignalPayload =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'ice'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: 'ice-complete' };
export interface SignalEnvelope {
  protocol: number;
  sessionId: string;
  generation: number;
  sequence: number;
  payload: SignalPayload;
}
export interface SignalingChannel {
  open(ticket: string, signal?: AbortSignal): Promise<void>;
  send(message: SignalEnvelope): Promise<void>;
  subscribe(handler: (message: SignalEnvelope) => void): Unsubscribe;
  close(): void;
}
export interface IceServerLease {
  urls: string[];
  username?: string;
  credential?: string;
  expiresAt: number;
}
export interface TransportFactory {
  create(options: { matchId: string; ticket: string; privacy: 'direct' | 'relay-only' }): Transport;
}
