import type { GuestSession, HostSession, PublicHost, RoomDetails } from '@countryballs/shared-types';
import type { TokenBucket } from './rate-limit.js';

export interface GuestRecord { session: GuestSession; name: string; limiter: TokenBucket }
export interface HostRecord {
  session: HostSession;
  public: PublicHost;
  lastHeartbeat: number;
  heartbeatSequence: number;
  limiter: TokenBucket;
}
export interface Seat {
  playerId: string;
  guestToken: string;
  ticket: string;
  ticketExpiresAt: number;
  resumeToken: string;
  state: 'reserved' | 'connected' | 'disconnected';
  disconnectedAt: number | null;
}
export interface RoomRecord {
  details: RoomDetails;
  owner: string;
  requestId: string;
  usesReservedPool: boolean;
  seats: Map<string, Seat>;
  emptySince: number | null;
  invites: Map<string, number>;
}
