import type {
  AdmissionAuthority, CommunityGateway, CreateRoomRequest, Invite, MatchmakingRequest, Profile, ServerQuery,
} from '@countryballs/backend-interface';
import { createConfig } from '@countryballs/config';
import type { PlatformConfig } from '@countryballs/config';
import { canAllocate } from '@countryballs/host-core';
import { rankHosts } from '@countryballs/matchmaking';
import { assertCondition, DomainError, safeLabel, sameGame, secureIds, systemClock, validInteger } from '@countryballs/shared-types';
import type {
  Clock, Compatibility, GuestSession, Heartbeat, HostRegistration, HostSession, IdSource,
  JoinTicket, PublicHost, PublicRoom, RoomDetails,
} from '@countryballs/shared-types';
import type { GuestRecord, HostRecord, RoomRecord, Seat } from './models.js';
import { TokenBucket } from './rate-limit.js';

// Contract reference, single process, no network and no durable storage.
// Mutations contain no awaits: reservation + capacity check form one critical section.
export class InMemoryCommunityCoordinator implements CommunityGateway, AdmissionAuthority {
  private readonly hosts = new Map<string, HostRecord>();
  private readonly guests = new Map<string, GuestRecord>();
  private readonly rooms = new Map<string, RoomRecord>();
  constructor(
    private readonly config: Readonly<PlatformConfig> = createConfig(),
    private readonly clock: Clock = systemClock,
    private readonly ids: IdSource = secureIds,
  ) {}
  private limiter(): TokenBucket {
    return new TokenBucket(this.config.maxCoordinatorRequestsPerMinute, this.config.maxCoordinatorRequestsPerMinute / 60, this.clock);
  }
  private guest(token: string): GuestRecord {
    this.sweep();
    const guest = this.guests.get(token);
    assertCondition(guest, 'UNAUTHORIZED', 'Sessão ausente ou expirada.');
    guest.limiter.take(); return guest;
  }
  private host(token: string): HostRecord {
    this.sweep();
    const host = [...this.hosts.values()].find(h => h.session.accessToken === token);
    assertCondition(host, 'UNAUTHORIZED', 'Servidor não registrado ou expirado.');
    host.limiter.take(); return host;
  }
  private onlineHost(id: string): HostRecord {
    const host = this.hosts.get(id);
    assertCondition(host, 'HOST_OFFLINE', 'Servidor offline. Escolha outro servidor.');
    return host;
  }
  private room(id: string): RoomRecord {
    const room = this.rooms.get(id);
    assertCondition(room, 'NOT_FOUND', 'Sala não encontrada ou indisponível.'); return room;
  }
  private compatible(host: HostRecord, expected: Compatibility): void {
    assertCondition(expected.protocol === host.public.versions.protocol && host.public.games.some(g => sameGame(g, expected.game)), 'INCOMPATIBLE_VERSION', 'Atualize o jogo ou escolha um servidor compatível.');
  }
  private roomCopy(room: RoomRecord): RoomDetails {
    return structuredClone({ ...room.details, players: room.seats.size });
  }
  private usage(hostId: string): { publicMatches: number; privateMatches: number } {
    let publicMatches = 0; let privateMatches = 0;
    for (const room of this.rooms.values()) if (room.details.hostId === hostId) {
      if (room.usesReservedPool) privateMatches++; else publicMatches++;
    }
    return { publicMatches, privateMatches };
  }
  private hostCopy(host: HostRecord): PublicHost {
    const usage = this.usage(host.public.id);
    let currentPlayers = 0;
    for (const room of this.rooms.values()) if (room.details.hostId === host.public.id) {
      currentPlayers += [...room.seats.values()].filter(seat => seat.state === 'connected').length;
    }
    return structuredClone({ ...host.public, publicMatches: usage.publicMatches, currentMatches: usage.publicMatches + usage.privateMatches, currentPlayers });
  }
  private newTicket(room: RoomRecord, guest: GuestRecord): JoinTicket {
    const seat: Seat = {
      playerId: guest.session.playerId, guestToken: guest.session.accessToken,
      ticket: this.ids.token(), ticketExpiresAt: this.clock.now() + this.config.joinTicketTtlMs,
      resumeToken: this.ids.token(), state: 'reserved', disconnectedAt: null,
    };
    room.seats.set(seat.playerId, seat); room.emptySince = null;
    return this.ticketCopy(room, seat);
  }
  private ticketCopy(room: RoomRecord, seat: Seat): JoinTicket {
    return { room: this.roomCopy(room), playerId: seat.playerId, ticket: seat.ticket, expiresAt: seat.ticketExpiresAt, resumeToken: seat.resumeToken };
  }
  private checkCode(room: RoomRecord, code?: string): void {
    assertCondition(code !== undefined && (room.invites.get(code) ?? 0) > this.clock.now(), 'NOT_FOUND', 'Sala não encontrada ou indisponível.');
  }
  sweep(): void {
    const now = this.clock.now();
    for (const [token, guest] of this.guests) if (now >= guest.session.expiresAt) this.guests.delete(token);
    for (const [id, host] of this.hosts) {
      if (now - host.lastHeartbeat >= this.config.heartbeatIntervalMs * this.config.missedHeartbeats || now >= host.session.expiresAt) this.hosts.delete(id);
    }
    for (const [id, room] of this.rooms) {
      if (!this.hosts.has(room.details.hostId)) { this.rooms.delete(id); continue; }
      for (const [playerId, seat] of room.seats) {
        if (!this.guests.has(seat.guestToken) || (seat.state === 'reserved' && now >= seat.ticketExpiresAt) ||
          (seat.state === 'disconnected' && seat.disconnectedAt !== null && now - seat.disconnectedAt >= this.config.disconnectTimeoutMs)) room.seats.delete(playerId);
      }
      for (const [code, expiry] of room.invites) if (now >= expiry) room.invites.delete(code);
      if (room.seats.size === 0) {
        room.emptySince ??= now;
        if (now - room.emptySince >= this.config.emptyRoomTtlMs) this.rooms.delete(id);
      }
    }
  }
  async login(name: string): Promise<GuestSession> {
    this.sweep();
    assertCondition(safeLabel(name), 'INVALID_REQUEST', 'Nome inválido.');
    assertCondition(this.guests.size < this.config.maxGuests, 'RATE_LIMITED', 'Coordenador ocupado.');
    const session = { playerId: this.ids.id(), accessToken: this.ids.token(), expiresAt: this.clock.now() + this.config.guestSessionTtlMs };
    this.guests.set(session.accessToken, { session, name, limiter: this.limiter() });
    return structuredClone(session);
  }
  async logout(token: string): Promise<void> {
    this.guests.delete(token); this.sweep();
  }
  async registerHost(request: HostRegistration): Promise<HostSession> {
    this.sweep();
    assertCondition(this.hosts.size < this.config.maxHosts, 'RATE_LIMITED', 'Diretório ocupado.');
    assertCondition(safeLabel(request.name) && /^[A-Z]{2}(?:-[a-z0-9]{1,16})?$/.test(request.region), 'INVALID_REQUEST', 'Nome ou região inválidos.');
    assertCondition(request.versions.protocol === this.config.protocolVersion && /^\d+\.\d+\.\d+$/.test(request.versions.server) && /^\d+\.\d+\.\d+$/.test(request.versions.platform), 'INCOMPATIBLE_VERSION', 'Versão do servidor incompatível.');
    assertCondition(request.games.length > 0 && request.games.length <= 32 && request.games.every(g => /^[a-z][a-z0-9-]{0,39}$/.test(g.id) && /^\d+\.\d+\.\d+$/.test(g.version)), 'INVALID_REQUEST', 'Catálogo de jogos inválido.');
    assertCondition(validInteger(request.maxMatches, 1, this.config.maxPublicMatches) && validInteger(request.reservedPrivateMatches, 0, request.maxMatches), 'INVALID_REQUEST', 'Capacidade inválida.');
    const session = { hostId: this.ids.id(), accessToken: this.ids.token(), expiresAt: this.clock.now() + this.config.hostSessionTtlMs };
    this.hosts.set(session.hostId, {
      session, lastHeartbeat: this.clock.now(), heartbeatSequence: -1, limiter: this.limiter(),
      public: {
        id: session.hostId, name: request.name, region: request.region, versions: structuredClone(request.versions), games: structuredClone(request.games),
        trust: 'community-casual', maxMatches: request.maxMatches, reservedPrivateMatches: request.reservedPrivateMatches,
        currentMatches: 0, publicMatches: 0, currentPlayers: 0, load: 0, stability: 1, networkStatus: 'healthy', acceptingMatches: true,
      },
    });
    return structuredClone(session);
  }
  async unregisterHost(token: string): Promise<void> {
    const host = this.host(token); this.hosts.delete(host.public.id); this.sweep();
  }
  async heartbeat(token: string, heartbeat: Heartbeat): Promise<void> {
    const host = this.host(token);
    assertCondition(validInteger(heartbeat.sequence, 0, Number.MAX_SAFE_INTEGER) && heartbeat.sequence > host.heartbeatSequence, 'INVALID_REQUEST', 'Heartbeat repetido ou inválido.');
    assertCondition(validInteger(heartbeat.uptimeMs, 0, Number.MAX_SAFE_INTEGER) &&
      Number.isFinite(heartbeat.load) && heartbeat.load >= 0 && heartbeat.load <= 1 &&
      Number.isFinite(heartbeat.stability) && heartbeat.stability >= 0 && heartbeat.stability <= 1 &&
      validInteger(heartbeat.currentMatches, 0, host.public.maxMatches) &&
      validInteger(heartbeat.currentPlayers, 0, host.public.maxMatches * this.config.maxPlayersPerMatch) &&
      ['healthy', 'degraded'].includes(heartbeat.networkStatus) && typeof heartbeat.acceptingMatches === 'boolean', 'INVALID_REQUEST', 'Heartbeat inválido.');
    host.heartbeatSequence = heartbeat.sequence; host.lastHeartbeat = this.clock.now();
    Object.assign(host.public, { load: heartbeat.load, stability: heartbeat.stability, networkStatus: heartbeat.networkStatus, acceptingMatches: heartbeat.acceptingMatches });
  }
  async listServers(query: ServerQuery = {}): Promise<PublicHost[]> {
    this.sweep();
    return [...this.hosts.values()].map(h => this.hostCopy(h)).filter(h =>
      (!query.region || h.region === query.region) &&
      (!query.compatibility || (h.versions.protocol === query.compatibility.protocol && h.games.some(g => sameGame(g, query.compatibility!.game)))) &&
      (!query.availableOnly || (h.acceptingMatches && h.currentMatches < h.maxMatches && h.publicMatches < h.maxMatches - h.reservedPrivateMatches)));
  }
  async listRooms(query: ServerQuery = {}): Promise<PublicRoom[]> {
    this.sweep();
    const hosts = new Set((await this.listServers(query)).map(h => h.id));
    return [...this.rooms.values()].filter(r => r.details.visibility === 'public' && hosts.has(r.details.hostId) &&
      (!query.availableOnly || (r.details.status === 'lobby' && r.seats.size < r.details.maxPlayers)) &&
      (!query.compatibility || sameGame(r.details.game, query.compatibility.game))).map(r => {
      const { visibility: _visibility, ...safe } = this.roomCopy(r); return safe;
    });
  }
  async createRoom(token: string, request: CreateRoomRequest): Promise<RoomDetails> {
    this.sweep();
    const ownerHost = [...this.hosts.values()].find(h => h.session.accessToken === token);
    const owner = ownerHost ? this.host(token).public.id : this.guest(token).session.playerId;
    const host = this.onlineHost(request.hostId); this.compatible(host, request.compatibility);
    assertCondition(!ownerHost || ownerHost.public.id === request.hostId, 'UNAUTHORIZED', 'Servidor incorreto.');
    assertCondition(['public', 'private'].includes(request.visibility) && safeLabel(request.requestId, 64) && validInteger(request.maxPlayers, 2, this.config.maxPlayersPerMatch), 'INVALID_REQUEST', 'Configuração de sala inválida.');
    const existing = [...this.rooms.values()].find(r => r.owner === owner && r.requestId === request.requestId);
    if (existing) {
      assertCondition(existing.details.hostId === request.hostId && existing.details.visibility === request.visibility && existing.details.maxPlayers === request.maxPlayers && sameGame(existing.details.game, request.compatibility.game), 'INVALID_REQUEST', 'requestId já usado com outros dados.');
      return this.roomCopy(existing);
    }
    assertCondition(host.public.acceptingMatches, 'HOST_FULL', 'Servidor não está aceitando novas partidas.');
    const usage = this.usage(host.public.id);
    const usesReservedPool = Boolean(ownerHost && request.visibility === 'private');
    assertCondition(request.visibility === 'private' || host.public.maxMatches >= this.config.minPublicMatches, 'HOST_FULL', 'Servidor abaixo da meta pública; use sala privada.');
    assertCondition(canAllocate({ ...usage, maxMatches: host.public.maxMatches, reservedPrivateMatches: host.public.reservedPrivateMatches }, usesReservedPool ? 'private' : 'public'), 'HOST_FULL', 'Sem vagas para novas partidas neste servidor.');
    const details: RoomDetails = { id: this.ids.id(), hostId: host.public.id, game: structuredClone(request.compatibility.game), region: host.public.region, status: 'lobby', players: 0, maxPlayers: request.maxPlayers, visibility: request.visibility };
    const room: RoomRecord = { details, owner, requestId: request.requestId, usesReservedPool, seats: new Map(), emptySince: this.clock.now(), invites: new Map() };
    this.rooms.set(details.id, room); return this.roomCopy(room);
  }
  async createInvite(token: string, roomId: string): Promise<Invite> {
    this.sweep();
    const host = [...this.hosts.values()].find(h => h.session.accessToken === token);
    const owner = host ? this.host(token).public.id : this.guest(token).session.playerId;
    const room = this.room(roomId);
    assertCondition(room.owner === owner, 'UNAUTHORIZED', 'Somente o criador pode gerar convites.');
    assertCondition(room.invites.size < this.config.maxInvitesPerRoom, 'RATE_LIMITED', 'Limite de convites ativos.');
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = this.ids.roomCode();
      if (![...this.rooms.values()].some(r => r.invites.has(candidate))) { code = candidate; break; }
    }
    assertCondition(code, 'INVALID_STATE', 'Não foi possível gerar um código único.');
    const expiresAt = this.clock.now() + this.config.inviteTtlMs;
    room.invites.set(code, expiresAt); return { code, path: `/join/${code}`, expiresAt };
  }
  async findRoom(token: string, code: string): Promise<RoomDetails> {
    this.guest(token);
    assertCondition(/^CB-[A-HJ-NP-Z2-9]{8}$/.test(code), 'NOT_FOUND', 'Sala não encontrada ou indisponível.');
    const room = [...this.rooms.values()].find(r => (r.invites.get(code) ?? 0) > this.clock.now());
    assertCondition(room, 'NOT_FOUND', 'Sala não encontrada ou indisponível.'); return this.roomCopy(room);
  }
  async joinRoom(token: string, roomId: string, compatibility: Compatibility, code?: string): Promise<JoinTicket> {
    const guest = this.guest(token); const room = this.room(roomId);
    if (room.details.visibility === 'private') this.checkCode(room, code);
    this.compatible(this.onlineHost(room.details.hostId), compatibility);
    assertCondition(sameGame(room.details.game, compatibility.game), 'INCOMPATIBLE_VERSION', 'Jogo da sala incompatível.');
    assertCondition(room.details.status === 'lobby', 'ROOM_CLOSED', 'A partida já começou.');
    const existing = room.seats.get(guest.session.playerId);
    if (existing) {
      assertCondition(existing.state === 'reserved', 'INVALID_STATE', 'Use o fluxo de reconexão.'); return this.ticketCopy(room, existing);
    }
    assertCondition(room.seats.size < room.details.maxPlayers, 'ROOM_FULL', 'Sala cheia.');
    return this.newTicket(room, guest);
  }
  async consumeTicket(hostToken: string, ticket: string): Promise<{ roomId: string; playerId: string }> {
    const host = this.host(hostToken);
    for (const room of this.rooms.values()) for (const seat of room.seats.values()) if (seat.ticket === ticket) {
      assertCondition(room.details.hostId === host.public.id && seat.state === 'reserved' && this.clock.now() < seat.ticketExpiresAt, 'UNAUTHORIZED', 'Ticket inválido ou já utilizado.');
      seat.state = 'connected'; return { roomId: room.details.id, playerId: seat.playerId };
    }
    throw new DomainError('UNAUTHORIZED', 'Ticket inválido ou expirado.');
  }
  async markDisconnected(hostToken: string, roomId: string, playerId: string): Promise<void> {
    const host = this.host(hostToken); const room = this.room(roomId);
    assertCondition(room.details.hostId === host.public.id, 'UNAUTHORIZED', 'Sala de outro servidor.');
    const seat = room.seats.get(playerId);
    assertCondition(seat && seat.state === 'connected', 'INVALID_STATE', 'Jogador não conectado.');
    seat.state = 'disconnected'; seat.disconnectedAt = this.clock.now();
  }
  async resume(token: string, roomId: string, resumeToken: string): Promise<JoinTicket> {
    const guest = this.guest(token); const room = this.room(roomId);
    const seat = room.seats.get(guest.session.playerId);
    assertCondition(seat && seat.state === 'disconnected' && seat.resumeToken === resumeToken, 'UNAUTHORIZED', 'Reconexão inválida ou expirada.');
    return this.newTicket(room, guest);
  }
  async leaveRoom(token: string, roomId: string): Promise<void> {
    const guest = this.guest(token); const room = this.rooms.get(roomId);
    room?.seats.delete(guest.session.playerId);
    if (room && room.seats.size === 0) room.emptySince = this.clock.now();
  }
  async setRoomStatus(hostToken: string, roomId: string, status: 'lobby' | 'running' | 'ended'): Promise<void> {
    const host = this.host(hostToken); const room = this.room(roomId);
    assertCondition(room.details.hostId === host.public.id, 'UNAUTHORIZED', 'Sala de outro servidor.');
    const transitions = { lobby: ['running'], running: ['ended'], ended: ['lobby'] };
    assertCondition(transitions[room.details.status].includes(status), 'INVALID_STATE', 'Transição inválida.');
    if (status === 'running') assertCondition([...room.seats.values()].filter(s => s.state === 'connected').length >= 2, 'INVALID_STATE', 'Aguardando pelo menos dois jogadores.');
    room.details.status = status;
  }
  async getProfile(token: string): Promise<Profile> {
    const guest = this.guest(token); return { playerId: guest.session.playerId, name: guest.name, guest: true };
  }
  async matchmake(request: MatchmakingRequest): Promise<PublicHost[]> {
    return rankHosts(await this.listServers(), request, this.config).map(r => r.host);
  }
}
