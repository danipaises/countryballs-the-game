import type { CloudAdmission, CloudRoom, CountryCode, CreateCloudRoomRequest, JoinCloudRoomRequest } from '@countryballs/cloud-contracts';
import { MatchClient } from './match-client.js';

export interface PlatformBackendProvider {
  readonly kind: string;
  listRooms(): Promise<CloudRoom[]>;
  createRoom(request: CreateCloudRoomRequest): Promise<CloudAdmission>;
  joinRoom(roomId: string, request: JoinCloudRoomRequest): Promise<CloudAdmission>;
  joinByCode(playerName: string, country: CountryCode, code: string): Promise<CloudAdmission>;
}

export interface BrowserGameServerProvider {
  readonly kind: string;
  connect(admission: CloudAdmission): MatchClient;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? `Erro ${response.status}`);
  return body;
}

export class CloudflareBackendProvider implements PlatformBackendProvider {
  readonly kind = 'cloudflare';
  async listRooms(): Promise<CloudRoom[]> { return (await request<{ rooms: CloudRoom[] }>('/api/rooms')).rooms; }
  createRoom(body: CreateCloudRoomRequest): Promise<CloudAdmission> { return request('/api/rooms', { method: 'POST', body: JSON.stringify(body) }); }
  joinRoom(roomId: string, body: JoinCloudRoomRequest): Promise<CloudAdmission> { return request(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: JSON.stringify(body) }); }
  joinByCode(playerName: string, country: CountryCode, code: string): Promise<CloudAdmission> { return request('/api/rooms/join-code', { method: 'POST', body: JSON.stringify({ playerName, country, code: code.toUpperCase().trim() }) }); }
}

export class CloudflareHostProvider implements BrowserGameServerProvider {
  readonly kind = 'cloudflare';
  connect(admission: CloudAdmission): MatchClient { return new MatchClient(admission); }
}

function requireProvider(name: string | undefined): 'cloudflare' {
  const selected = name || 'cloudflare';
  if (selected !== 'cloudflare') throw new Error(`Backend provider não instalado: ${selected}`);
  return selected;
}

requireProvider(import.meta.env.VITE_BACKEND_PROVIDER);
export const backendProvider: PlatformBackendProvider = new CloudflareBackendProvider();
export const gameServerProvider: BrowserGameServerProvider = new CloudflareHostProvider();
