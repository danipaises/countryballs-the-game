import type { BackendProvider, CreateRoomRequest } from '@countryballs/backend-interface';
import { laneFor, ProtocolReceiver } from '@countryballs/protocol';
import type { MessageCodec, WireMessage } from '@countryballs/protocol';
import { assertCondition, systemClock } from '@countryballs/shared-types';
import type { Compatibility, JoinTicket, JsonValue, RoomDetails, Unsubscribe } from '@countryballs/shared-types';
import type { ConnectionState, Transport, TransportFactory, TransportStats } from '@countryballs/transport-interface';

export interface MatchConnection {
  readonly isReady: boolean;
  sendInput(input: JsonValue, estimatedServerTick: number): boolean;
  sendReliableEvent(name: string, payload: JsonValue): void;
  subscribe(handler: (message: WireMessage) => void): Unsubscribe;
  onState(handler: (state: ConnectionState) => void): Unsubscribe;
  stats(): TransportStats;
  leaveMatch(): Promise<void>;
}
export interface GameServerProvider {
  createMatch(request: CreateRoomRequest): Promise<RoomDetails>;
  joinMatch(roomId: string, compatibility: Compatibility, code?: string): Promise<MatchConnection>;
}
export class CommunityHostProvider implements GameServerProvider {
  constructor(
    private readonly backend: BackendProvider,
    private readonly transportFactory: TransportFactory,
    private readonly codec: MessageCodec,
    private readonly privacy: 'direct' | 'relay-only' = 'direct',
  ) {}
  createMatch(request: CreateRoomRequest): Promise<RoomDetails> { return this.backend.createRoom(request); }
  async joinMatch(roomId: string, compatibility: Compatibility, code?: string): Promise<MatchConnection> {
    const ticket = await this.backend.joinRoom(roomId, compatibility, code);
    let transport: Transport | undefined;
    try {
      transport = this.transportFactory.create({ matchId: roomId, ticket: ticket.ticket, privacy: this.privacy });
      await transport.connect();
      const connection = new NetworkConnection(transport, this.codec, ticket, () => this.backend.leaveRoom(roomId));
      const sent = transport.send('reliable', this.codec.encode({
        v: 1, kind: 'SYSTEM', type: 'HELLO', matchId: roomId,
        gameId: compatibility.game.id, gameVersion: compatibility.game.version, ticket: ticket.ticket,
      }));
      assertCondition(sent, 'BACKPRESSURE', 'Não foi possível enviar o handshake.');
      return connection;
    } catch (error) {
      transport?.close('JOIN_FAILED');
      await this.backend.leaveRoom(roomId).catch(() => undefined);
      throw error;
    }
  }
}
class NetworkConnection implements MatchConnection {
  private seq = 0;
  private commandId = 0;
  private ready = false;
  private closed = false;
  private readonly listeners = new Set<(message: WireMessage) => void>();
  private readonly detach: Unsubscribe;
  get isReady(): boolean { return !this.closed && this.ready && this.transport.state === 'connected'; }
  onState(handler: (state: ConnectionState) => void): Unsubscribe { return this.transport.onState(handler); }
  stats(): TransportStats { return this.transport.stats(); }
  constructor(private readonly transport: Transport, private readonly codec: MessageCodec, private readonly ticket: JoinTicket, private readonly leave: () => Promise<void>) {
    const receiver = new ProtocolReceiver(codec, 'host', ticket.room.id, systemClock);
    this.detach = transport.subscribe((lane, bytes) => {
      let message: WireMessage;
      try {
        const received = receiver.receive(lane, bytes);
        if (received === null) return;
        message = received;
        if (message.type === 'WELCOME') {
          assertCondition(message.playerId === ticket.playerId, 'UNAUTHORIZED', 'Jogador incorreto no handshake.');
          this.ready = true;
        }
      } catch {
        this.ready = false;
        transport.close('INVALID_MESSAGE');
        return;
      }
      for (const handler of this.listeners) handler(message);
    });
  }
  sendInput(payload: JsonValue, tick: number): boolean {
    this.assertReady();
    const message: WireMessage = { v: 1, kind: 'INPUT', type: 'INPUT_FRAME', matchId: this.ticket.room.id, seq: ++this.seq, tick, payload };
    return this.transport.send(laneFor(message), this.codec.encode(message));
  }
  sendReliableEvent(name: string, payload: JsonValue): void {
    this.assertReady();
    const sent = this.transport.send('reliable', this.codec.encode({
      v: 1, kind: 'EVENT', type: 'CLIENT_COMMAND', matchId: this.ticket.room.id, commandId: ++this.commandId, name, payload,
    }));
    assertCondition(sent, 'BACKPRESSURE', 'Canal confiável congestionado.');
  }
  subscribe(handler: (message: WireMessage) => void): Unsubscribe {
    this.listeners.add(handler); return () => { this.listeners.delete(handler); };
  }
  async leaveMatch(): Promise<void> {
    if (this.closed) return;
    this.closed = true; this.ready = false;
    this.detach(); this.listeners.clear(); this.transport.close('LEFT'); await this.leave();
  }
  private assertReady(): void {
    assertCondition(!this.closed && this.ready && this.transport.state === 'connected', 'DISCONNECTED', 'Aguarde a conexão com o servidor.');
  }
}
export { ReconnectionPolicy } from './reconnection.js';
