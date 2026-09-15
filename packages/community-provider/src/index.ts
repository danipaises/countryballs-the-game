import type { BackendProvider, CasualStats, CommunityGateway, CreateRoomRequest, MatchmakingRequest, ServerQuery } from '@countryballs/backend-interface';
import { assertCondition, DomainError } from '@countryballs/shared-types';
import type { Compatibility, GameVersion, GuestSession, Heartbeat, HostRegistration, HostSession } from '@countryballs/shared-types';

export class CommunityBackendProvider implements BackendProvider {
  readonly kind = 'community';
  private guest: GuestSession | undefined;
  private host: HostSession | undefined;
  constructor(private readonly gateway: CommunityGateway) {}
  private token(): string {
    assertCondition(this.guest, 'UNAUTHORIZED', 'Entre como convidado primeiro.'); return this.guest.accessToken;
  }
  private hostToken(): string {
    assertCondition(this.host, 'UNAUTHORIZED', 'Registre o servidor primeiro.'); return this.host.accessToken;
  }
  async login(name: string) {
    assertCondition(!this.guest, 'INVALID_STATE', 'Já existe uma sessão ativa.');
    this.guest = await this.gateway.login(name); return structuredClone(this.guest);
  }
  async logout() { if (this.guest) await this.gateway.logout(this.guest.accessToken); this.guest = undefined; }
  async registerHost(request: HostRegistration) {
    assertCondition(!this.host, 'INVALID_STATE', 'Servidor já registrado.');
    this.host = await this.gateway.registerHost(request); return structuredClone(this.host);
  }
  async unregisterHost() { await this.gateway.unregisterHost(this.hostToken()); this.host = undefined; }
  heartbeat(heartbeat: Heartbeat) { return this.gateway.heartbeat(this.hostToken(), heartbeat); }
  listServers(query?: ServerQuery) { return this.gateway.listServers(query); }
  listRooms(query?: ServerQuery) { return this.gateway.listRooms(query); }
  createRoom(request: CreateRoomRequest) {
    const token = this.host?.hostId === request.hostId ? this.hostToken() : this.token();
    return this.gateway.createRoom(token, request);
  }
  findRoom(code: string) { return this.gateway.findRoom(this.token(), code); }
  joinRoom(roomId: string, compatibility: Compatibility, code?: string) { return this.gateway.joinRoom(this.token(), roomId, compatibility, code); }
  leaveRoom(roomId: string) { return this.gateway.leaveRoom(this.token(), roomId); }
  createInvite(roomId: string) { return this.gateway.createInvite(this.host?.accessToken ?? this.token(), roomId); }
  getProfile() { return this.gateway.getProfile(this.token()); }
  matchmake(request: MatchmakingRequest) { return this.gateway.matchmake(request); }
  async saveStats(_stats: CasualStats): Promise<void> {
    throw new DomainError('UNSUPPORTED_FEATURE', 'Estatísticas persistentes serão implementadas em uma fase futura.');
  }
  async getLeaderboard(_game: GameVersion): Promise<never> {
    throw new DomainError('UNSUPPORTED_FEATURE', 'Partidas comunitárias não geram ranking competitivo confiável.');
  }
}
export type BackendFactory = () => BackendProvider;
export function createBackendProvider(name: string, registry: Readonly<Record<string, BackendFactory>>): BackendProvider {
  const factory = Object.hasOwn(registry, name) ? registry[name] : undefined;
  assertCondition(factory, 'UNSUPPORTED_PROVIDER', `Provider não implementado: ${name}`);
  return factory();
}
export { InMemoryCommunityCoordinator } from './coordinator.js';
export { TokenBucket } from './rate-limit.js';
