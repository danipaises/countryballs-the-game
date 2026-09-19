export const countries = ['BR', 'PT', 'AR', 'US', 'JP', 'DE', 'FR', 'IT'] as const;
export type CountryCode = typeof countries[number];
export type CloudRoomStatus = 'lobby' | 'running' | 'ended';
export type CloudRoomVisibility = 'public' | 'private';

export interface CloudRoom {
  id: string;
  name: string;
  code?: string;
  visibility: CloudRoomVisibility;
  status: CloudRoomStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  updatedAt: number;
  gameId: 'arena-2d';
  gameVersion: '0.1.0';
}

export interface CreateCloudRoomRequest {
  roomName: string;
  playerName: string;
  country: CountryCode;
  visibility: CloudRoomVisibility;
  maxPlayers: number;
}

export interface JoinCloudRoomRequest {
  playerName: string;
  country: CountryCode;
  code?: string;
}

export interface CloudAdmission {
  room: CloudRoom;
  playerId: string;
  ticket: string;
  websocketPath: string;
  expiresAt: number;
}

export interface CloudRosterEntry {
  playerId: string;
  name: string;
  country: CountryCode;
}

export interface ApiErrorBody { error: string; code: string }
