import type {
  Compatibility, GameVersion, GuestSession, Heartbeat, HostRegistration, HostSession,
  JoinTicket, PublicHost, PublicRoom, RoomDetails, RoomId, Visibility,
} from '@countryballs/shared-types';

export interface ServerQuery {
  region?: string;
  compatibility?: Compatibility;
  availableOnly?: boolean;
}
export interface CreateRoomRequest {
  hostId: string;
  compatibility: Compatibility;
  visibility: Visibility;
  maxPlayers: number;
  requestId: string;
}
export interface MatchmakingRequest {
  compatibility: Compatibility;
  region: string;
  // RTT measured by THIS player; never pretend host-to-directory RTT is player ping.
  latencyByHost: Readonly<Record<string, number>>;
  maxPingMs?: number;
}
export interface Invite { code: string; path: string; expiresAt: number }
export interface Profile { playerId: string; name: string; guest: boolean }
export interface CasualStats { game: GameVersion; matches: number; wins: number }
export interface BackendProvider {
  readonly kind: string;
  login(name: string): Promise<GuestSession>;
  logout(): Promise<void>;
  registerHost(request: HostRegistration): Promise<HostSession>;
  unregisterHost(): Promise<void>;
  heartbeat(heartbeat: Heartbeat): Promise<void>;
  listServers(query?: ServerQuery): Promise<PublicHost[]>;
  listRooms(query?: ServerQuery): Promise<PublicRoom[]>;
  createRoom(request: CreateRoomRequest): Promise<RoomDetails>;
  findRoom(code: string): Promise<RoomDetails>;
  joinRoom(roomId: RoomId, compatibility: Compatibility, code?: string): Promise<JoinTicket>;
  leaveRoom(roomId: RoomId): Promise<void>;
  createInvite(roomId: RoomId): Promise<Invite>;
  getProfile(): Promise<Profile>;
  saveStats(stats: CasualStats): Promise<void>;
  getLeaderboard(game: GameVersion): Promise<never>;
  matchmake(request: MatchmakingRequest): Promise<PublicHost[]>;
}
// Authenticated coordinator contract; implementations: in-memory now, HTTPS later.
export interface CommunityGateway {
  login(name: string): Promise<GuestSession>;
  logout(token: string): Promise<void>;
  registerHost(request: HostRegistration): Promise<HostSession>;
  unregisterHost(token: string): Promise<void>;
  heartbeat(token: string, heartbeat: Heartbeat): Promise<void>;
  listServers(query?: ServerQuery): Promise<PublicHost[]>;
  listRooms(query?: ServerQuery): Promise<PublicRoom[]>;
  createRoom(token: string, request: CreateRoomRequest): Promise<RoomDetails>;
  findRoom(token: string, code: string): Promise<RoomDetails>;
  joinRoom(token: string, roomId: RoomId, compatibility: Compatibility, code?: string): Promise<JoinTicket>;
  leaveRoom(token: string, roomId: RoomId): Promise<void>;
  createInvite(token: string, roomId: RoomId): Promise<Invite>;
  getProfile(token: string): Promise<Profile>;
  matchmake(request: MatchmakingRequest): Promise<PublicHost[]>;
}
export interface AdmissionAuthority {
  consumeTicket(hostToken: string, ticket: string): Promise<{ roomId: string; playerId: string }>;
  markDisconnected(hostToken: string, roomId: string, playerId: string): Promise<void>;
  resume(token: string, roomId: string, resumeToken: string): Promise<JoinTicket>;
  setRoomStatus(hostToken: string, roomId: string, status: 'lobby' | 'running' | 'ended'): Promise<void>;
}
