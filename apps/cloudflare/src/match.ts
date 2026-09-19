import { DurableObject } from 'cloudflare:workers';
import { ArenaSimulation, validateArenaCommand, validateArenaInput } from '@countryballs/arena-2d';
import type { ArenaPhase } from '@countryballs/arena-2d';
import type { CloudAdmission, CloudRoom, CloudRosterEntry, CountryCode } from '@countryballs/cloud-contracts';
import { createConfig } from '@countryballs/config';
import { JsonCodec, ProtocolReceiver } from '@countryballs/protocol';
import type { WireMessage } from '@countryballs/protocol';
import { assertCondition, DomainError, systemClock } from '@countryballs/shared-types';
import type { Env } from './env.js';

interface TicketRecord extends CloudRosterEntry { ticket: string; expiresAt: number }
interface Connection { socket: WebSocket; player: CloudRosterEntry; receiver: ProtocolReceiver }
const config = createConfig();
const TICKET_TTL_MS = config.cloudJoinTicketTtlMs;
const TICK_RATE = config.matchTickRate;
const SNAPSHOT_RATE = config.snapshotRate;

export class ArenaMatch extends DurableObject<Env> {
  private readonly codec = new JsonCodec(createConfig());
  private readonly connections = new Map<string, Connection>();
  private readonly simulation = new ArenaSimulation({ matchId: this.ctx.id.toString(), tickRate: TICK_RATE, seed: 1, random: Math.random });
  private room: CloudRoom | null = null;
  private tick = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPhase: ArenaPhase = 'lobby';
  private commandIds = new Map<string, number>();
  private serverEventId = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => { this.room = await this.ctx.storage.get<CloudRoom>('room') ?? null; });
  }

  async configure(room: CloudRoom): Promise<void> {
    if (this.room) {
      assertCondition(this.room.id === room.id, 'INVALID_STATE', 'Sala já configurada.');
      return;
    }
    this.room = room;
    await this.ctx.storage.put('room', room);
  }

  async reserve(name: string, country: CountryCode): Promise<CloudAdmission> {
    const room = this.requireRoom();
    await this.removeExpiredTickets();
    assertCondition(room.status !== 'ended', 'ROOM_CLOSED', 'Esta sala encerrou.');
    const pending = await this.ctx.storage.list<TicketRecord>({ prefix: 'ticket:' });
    assertCondition(this.connections.size + pending.size < room.maxPlayers, 'ROOM_FULL', 'Sala cheia.');
    const playerId = crypto.randomUUID();
    const ticket = this.randomToken();
    const expiresAt = Date.now() + TICKET_TTL_MS;
    await this.ctx.storage.put(`ticket:${ticket}`, { playerId, name, country, ticket, expiresAt } satisfies TicketRecord);
    return { room, playerId, ticket, expiresAt, websocketPath: `/api/rooms/${room.id}/socket?ticket=${encodeURIComponent(ticket)}` };
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    const ticket = new URL(request.url).searchParams.get('ticket') ?? '';
    const record = await this.ctx.storage.get<TicketRecord>(`ticket:${ticket}`);
    if (!record || record.expiresAt <= Date.now()) return new Response('Ticket invalid or expired', { status: 401 });
    await this.ctx.storage.delete(`ticket:${ticket}`);
    const pair = new WebSocketPair();
    const client = pair[0]; const server = pair[1];
    server.accept();
    const connection: Connection = {
      socket: server, player: { playerId: record.playerId, name: record.name, country: record.country },
      receiver: new ProtocolReceiver(this.codec, 'client', this.requireRoom().id, systemClock),
    };
    this.connections.set(record.playerId, connection);
    this.simulation.addPlayer(record.playerId, record.name);
    server.addEventListener('message', event => this.onMessage(record.playerId, event));
    server.addEventListener('close', () => this.disconnect(record.playerId));
    server.addEventListener('error', () => this.disconnect(record.playerId));
    this.send(connection, { v: 1, kind: 'SYSTEM', type: 'WELCOME', matchId: this.requireRoom().id, playerId: record.playerId, tickRate: TICK_RATE, snapshotRate: SNAPSHOT_RATE });
    this.broadcastRoster();
    await this.updateDirectory();
    this.startTicker();
    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(playerId: string, event: MessageEvent): void {
    const connection = this.connections.get(playerId);
    if (!connection) return;
    try {
      const bytes = typeof event.data === 'string' ? new TextEncoder().encode(event.data) : event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : new Uint8Array(event.data as ArrayBuffer);
      const message = connection.receiver.receive(this.laneForIncoming(bytes), bytes);
      if (!message) return;
      if (message.type === 'INPUT_FRAME') this.simulation.acceptInput(playerId, validateArenaInput(message.payload));
      if (message.type === 'CLIENT_COMMAND') {
        const last = this.commandIds.get(playerId) ?? 0;
        if (message.commandId <= last) return;
        this.commandIds.set(playerId, message.commandId);
        this.simulation.acceptCommand(playerId, message.commandId, validateArenaCommand(message.name, message.payload));
      }
    } catch (error) {
      const domain = error instanceof DomainError ? error : new DomainError('INVALID_MESSAGE', 'Mensagem inválida.');
      this.send(connection, { v: 1, kind: 'SYSTEM', type: 'ERROR', matchId: this.requireRoom().id, code: domain.code, message: domain.message });
      connection.socket.close(1008, 'Invalid message');
    }
  }

  private laneForIncoming(bytes: Uint8Array): 'realtime' | 'reliable' {
    const text = new TextDecoder().decode(bytes);
    return text.includes('"kind":"INPUT"') ? 'realtime' : 'reliable';
  }

  private startTicker(): void {
    if (this.timer || this.connections.size === 0) return;
    let last = Date.now(); let accumulator = 0;
    this.timer = setInterval(() => {
      const now = Date.now(); accumulator = Math.min(100, accumulator + now - last); last = now;
      const stepMs = 1000 / TICK_RATE; let steps = 0;
      while (accumulator >= stepMs && steps++ < 3) {
        accumulator -= stepMs; this.tick++;
        const events = this.simulation.step(this.tick, 1 / TICK_RATE);
        for (const event of events) this.broadcast({ v: 1, kind: 'EVENT', type: 'SERVER_EVENT', matchId: this.requireRoom().id, eventId: ++this.serverEventId, tick: event.tick, name: event.payload.type, payload: event.payload });
        if (this.tick % (TICK_RATE / SNAPSHOT_RATE) === 0) this.broadcast({ v: 1, kind: 'STATE', type: 'STATE_SNAPSHOT', matchId: this.requireRoom().id, tick: this.tick, ack: 0, payload: this.simulation.snapshot() });
        const phase = this.simulation.snapshot().phase;
        if (phase !== this.lastPhase) { this.lastPhase = phase; void this.updateDirectory(); }
      }
    }, 16);
  }

  private disconnect(playerId: string): void {
    if (!this.connections.delete(playerId)) return;
    this.commandIds.delete(playerId);
    this.simulation.removePlayer(playerId);
    this.broadcastRoster();
    void this.updateDirectory();
    if (this.connections.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private broadcastRoster(): void {
    const roster: CloudRosterEntry[] = [...this.connections.values()].map(connection => connection.player);
    this.broadcast({
      v: 1, kind: 'EVENT', type: 'SERVER_EVENT', matchId: this.requireRoom().id,
      eventId: ++this.serverEventId, tick: this.tick, name: 'ROSTER',
      payload: roster.map(player => ({ playerId: player.playerId, name: player.name, country: player.country })),
    });
  }

  private broadcast(message: WireMessage): void {
    for (const connection of this.connections.values()) this.send(connection, message);
  }

  private send(connection: Connection, message: WireMessage): void {
    if (connection.socket.readyState !== WebSocket.OPEN) return;
    try { connection.socket.send(this.codec.encode(message)); }
    catch { connection.socket.close(1011, 'Send failed'); }
  }

  private async updateDirectory(): Promise<void> {
    const room = this.requireRoom();
    room.playerCount = this.connections.size; room.status = this.simulation.snapshot().phase; room.updatedAt = Date.now();
    await this.ctx.storage.put('room', room);
    await this.env.DIRECTORY.getByName('global').updateRoom(room.id, { playerCount: room.playerCount, status: room.status });
  }

  private async removeExpiredTickets(): Promise<void> {
    const tickets = await this.ctx.storage.list<TicketRecord>({ prefix: 'ticket:' });
    for (const [key, ticket] of tickets) if (ticket.expiresAt <= Date.now()) await this.ctx.storage.delete(key);
  }

  private requireRoom(): CloudRoom { assertCondition(this.room, 'INVALID_STATE', 'Sala ainda não configurada.'); return this.room; }
  private randomToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join(''); }
}
