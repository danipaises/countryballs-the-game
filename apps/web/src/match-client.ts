import type { ArenaSnapshot } from '@countryballs/arena-2d';
import type { CloudAdmission, CloudRosterEntry } from '@countryballs/cloud-contracts';
import { JsonCodec } from '@countryballs/protocol';
import type { WireMessage } from '@countryballs/protocol';

export type MatchListener = (event: MatchClientEvent) => void;
export type MatchClientEvent =
  | { type: 'state'; snapshot: ArenaSnapshot }
  | { type: 'roster'; roster: CloudRosterEntry[] }
  | { type: 'connected' }
  | { type: 'closed'; message: string }
  | { type: 'error'; message: string };

export class MatchClient {
  private readonly codec = new JsonCodec();
  private socket: WebSocket | null = null;
  private seq = 0;
  private commandId = 0;
  private listeners = new Set<MatchListener>();
  constructor(readonly admission: CloudAdmission) {}

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}${this.admission.websocketPath}`);
    this.socket.binaryType = 'arraybuffer';
    this.socket.addEventListener('open', () => this.emit({ type: 'connected' }));
    this.socket.addEventListener('message', event => this.onMessage(event));
    this.socket.addEventListener('close', event => this.emit({ type: 'closed', message: event.reason || 'Conexão encerrada.' }));
    this.socket.addEventListener('error', () => this.emit({ type: 'error', message: 'Não foi possível conectar à partida.' }));
  }

  sendInput(move: [number, number], tick: number): void {
    this.send({ v: 1, kind: 'INPUT', type: 'INPUT_FRAME', matchId: this.admission.room.id, seq: ++this.seq, tick, payload: { move } });
  }
  command(name: 'attack' | 'ready' | 'rematch'): void {
    this.send({ v: 1, kind: 'EVENT', type: 'CLIENT_COMMAND', matchId: this.admission.room.id, commandId: ++this.commandId, name, payload: null });
  }
  subscribe(listener: MatchListener): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close(): void { this.socket?.close(1000, 'Saiu da partida'); this.socket = null; }

  private onMessage(event: MessageEvent): void {
    try {
      const bytes = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : new TextEncoder().encode(String(event.data));
      const message = this.codec.decode(bytes);
      if (message.type === 'STATE_SNAPSHOT') this.emit({ type: 'state', snapshot: message.payload as unknown as ArenaSnapshot });
      if (message.type === 'SERVER_EVENT' && message.name === 'ROSTER') this.emit({ type: 'roster', roster: message.payload as unknown as CloudRosterEntry[] });
      if (message.type === 'ERROR') this.emit({ type: 'error', message: message.message });
    } catch { this.emit({ type: 'error', message: 'O servidor enviou uma mensagem inválida.' }); }
  }
  private send(message: WireMessage): void { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(this.codec.encode(message)); }
  private emit(event: MatchClientEvent): void { for (const listener of this.listeners) listener(event); }
}
