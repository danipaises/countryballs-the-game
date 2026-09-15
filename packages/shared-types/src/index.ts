export type HostId = string;
export type RoomId = string;
export type PlayerId = string;
export type Unsubscribe = () => void;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Visibility = 'public' | 'private';
export type TrustLevel = 'community-casual' | 'official-verified';
export type RoomStatus = 'lobby' | 'running' | 'ended';

export interface Versions {
  platform: string;
  server: string;
  protocol: number;
}
export interface GameVersion { id: string; version: string }
export interface Compatibility { protocol: number; game: GameVersion }
export interface PublicHost {
  id: HostId;
  name: string;
  region: string;
  versions: Versions;
  games: GameVersion[];
  trust: TrustLevel;
  maxMatches: number;
  reservedPrivateMatches: number;
  currentMatches: number;
  publicMatches: number;
  currentPlayers: number;
  load: number;
  stability: number;
  networkStatus: 'healthy' | 'degraded';
  acceptingMatches: boolean;
}
// Deliberately no room code, network address, token or list of members.
export interface PublicRoom {
  id: RoomId;
  hostId: HostId;
  game: GameVersion;
  region: string;
  status: RoomStatus;
  players: number;
  maxPlayers: number;
}
export interface RoomDetails extends PublicRoom { visibility: Visibility }
export interface GuestSession { playerId: PlayerId; accessToken: string; expiresAt: number }
export interface HostSession { hostId: HostId; accessToken: string; expiresAt: number }
export interface JoinTicket {
  room: RoomDetails;
  playerId: PlayerId;
  ticket: string;
  expiresAt: number;
  resumeToken: string;
}
export interface HostRegistration {
  name: string;
  region: string;
  versions: Versions;
  games: GameVersion[];
  maxMatches: number;
  reservedPrivateMatches: number;
}
export interface Heartbeat {
  sequence: number;
  uptimeMs: number;
  load: number;
  stability: number;
  networkStatus: 'healthy' | 'degraded';
  acceptingMatches: boolean;
  currentMatches: number;
  currentPlayers: number;
}
export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };
export interface IdSource { id(): string; token(): string; roomCode(): string }
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const secureIds: IdSource = {
  id: () => crypto.randomUUID(),
  token: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''),
  roomCode: () => 'CB-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), n => alphabet[n & 31]).join(''),
};
export const errorCodes = [
  'INVALID_REQUEST', 'INCOMPATIBLE_VERSION', 'UNAUTHORIZED', 'NOT_FOUND', 'HOST_OFFLINE',
  'HOST_FULL', 'ROOM_FULL', 'ROOM_CLOSED', 'RATE_LIMITED', 'EXPIRED', 'INVALID_STATE',
  'UNSUPPORTED_PROVIDER', 'UNSUPPORTED_FEATURE', 'MESSAGE_TOO_LARGE', 'INVALID_MESSAGE',
  'BACKPRESSURE', 'DISCONNECTED',
] as const;
export type ErrorCode = typeof errorCodes[number];
export class DomainError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
export function assertCondition(condition: unknown, code: ErrorCode, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
export function validInteger(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
export function safeLabel(value: string, max = 32): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    value.trim() === value && !/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value);
}
export function sameGame(a: GameVersion, b: GameVersion): boolean {
  return a.id === b.id && a.version === b.version;
}
