import { createConfig, versions } from '@countryballs/config';
import type { PlatformConfig } from '@countryballs/config';
import { assertCondition, DomainError, safeLabel, validInteger } from '@countryballs/shared-types';
import type { JsonValue } from '@countryballs/shared-types';

interface Envelope { v: 1; matchId: string }
export type WireMessage = Envelope & (
  | { kind: 'INPUT'; type: 'INPUT_FRAME'; seq: number; tick: number; payload: JsonValue }
  | { kind: 'STATE'; type: 'STATE_SNAPSHOT'; tick: number; ack: number; payload: JsonValue }
  | { kind: 'EVENT'; type: 'CLIENT_COMMAND'; commandId: number; name: string; payload: JsonValue }
  | { kind: 'EVENT'; type: 'SERVER_EVENT'; eventId: number; tick: number; name: string; payload: JsonValue }
  | { kind: 'SYSTEM'; type: 'HELLO'; gameId: string; gameVersion: string; ticket: string }
  | { kind: 'SYSTEM'; type: 'WELCOME'; playerId: string; tickRate: number; snapshotRate: number }
  | { kind: 'SYSTEM'; type: 'PING' | 'PONG'; nonce: number }
  | { kind: 'SYSTEM'; type: 'ERROR'; code: string; message: string }
);
export type Lane = 'realtime' | 'reliable';
export type SenderRole = 'client' | 'host';
export interface MessageCodec {
  readonly name: string;
  encode(message: WireMessage): Uint8Array;
  decode(bytes: Uint8Array): WireMessage;
}
export const channelPolicy = Object.freeze({
  realtime: Object.freeze({ ordered: false, maxRetransmits: 0 }),
  reliable: Object.freeze({ ordered: true }),
});
export function laneFor(message: WireMessage): Lane {
  return message.kind === 'INPUT' || message.kind === 'STATE' ? 'realtime' : 'reliable';
}
function object(value: unknown): Record<string, unknown> {
  assertCondition(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_MESSAGE', 'Objeto esperado.');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]): void {
  const allowed = new Set(['v', 'matchId', 'kind', 'type', ...keys]);
  assertCondition(Object.keys(value).length === allowed.size && Object.keys(value).every(k => allowed.has(k)), 'INVALID_MESSAGE', 'Campos inesperados ou ausentes.');
}
function uint(value: unknown): void {
  assertCondition(typeof value === 'number' && validInteger(value, 0, 0xffffffff), 'INVALID_MESSAGE', 'Inteiro sem sinal esperado.');
}
function label(value: unknown, max = 64): void {
  assertCondition(typeof value === 'string' && safeLabel(value, max), 'INVALID_MESSAGE', 'Texto inválido.');
}
export function validateJson(value: unknown): asserts value is JsonValue {
  let remaining = 2_048;
  function visit(v: unknown, depth: number): void {
    assertCondition(--remaining >= 0 && depth <= 8, 'INVALID_MESSAGE', 'Payload complexo demais.');
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'number') {
      assertCondition(Number.isFinite(v), 'INVALID_MESSAGE', 'Número inválido.');
      return;
    }
    if (typeof v === 'string') {
      assertCondition(v.length <= 2_048, 'INVALID_MESSAGE', 'Texto longo demais.');
      return;
    }
    if (Array.isArray(v)) { for (const item of v) visit(item, depth + 1); return; }
    const record = object(v);
    assertCondition(Object.getPrototypeOf(record) === Object.prototype || Object.getPrototypeOf(record) === null, 'INVALID_MESSAGE', 'Objeto não serializável.');
    for (const [key, item] of Object.entries(record)) {
      assertCondition(!['__proto__', 'prototype', 'constructor'].includes(key) && key.length <= 64, 'INVALID_MESSAGE', 'Chave inválida.');
      visit(item, depth + 1);
    }
  }
  visit(value, 0);
}
export function validateMessage(value: unknown): WireMessage {
  const m = object(value);
  assertCondition(m.v === versions.protocol, 'INCOMPATIBLE_VERSION', 'Atualize o cliente e o CountryBalls Server: protocolo incompatível.');
  label(m.matchId);
  switch (m.type) {
    case 'INPUT_FRAME':
      exact(m, ['seq', 'tick', 'payload']);
      assertCondition(m.kind === 'INPUT', 'INVALID_MESSAGE', 'Categoria inválida.');
      uint(m.seq); uint(m.tick); validateJson(m.payload); break;
    case 'STATE_SNAPSHOT':
      exact(m, ['tick', 'ack', 'payload']);
      assertCondition(m.kind === 'STATE', 'INVALID_MESSAGE', 'Categoria inválida.');
      uint(m.tick); uint(m.ack); validateJson(m.payload); break;
    case 'CLIENT_COMMAND':
      exact(m, ['commandId', 'name', 'payload']);
      assertCondition(m.kind === 'EVENT', 'INVALID_MESSAGE', 'Categoria inválida.');
      uint(m.commandId); label(m.name); validateJson(m.payload); break;
    case 'SERVER_EVENT':
      exact(m, ['eventId', 'tick', 'name', 'payload']);
      assertCondition(m.kind === 'EVENT', 'INVALID_MESSAGE', 'Categoria inválida.');
      uint(m.eventId); uint(m.tick); label(m.name); validateJson(m.payload); break;
    case 'HELLO':
      exact(m, ['gameId', 'gameVersion', 'ticket']);
      label(m.gameId); label(m.gameVersion); label(m.ticket, 256); break;
    case 'WELCOME':
      exact(m, ['playerId', 'tickRate', 'snapshotRate']);
      label(m.playerId); uint(m.tickRate); uint(m.snapshotRate);
      assertCondition(Number(m.snapshotRate) > 0 && Number(m.tickRate) >= Number(m.snapshotRate), 'INVALID_MESSAGE', 'Taxas inválidas.'); break;
    case 'PING': case 'PONG': exact(m, ['nonce']); uint(m.nonce); break;
    case 'ERROR': exact(m, ['code', 'message']); label(m.code); label(m.message, 200); break;
    default: throw new DomainError('INVALID_MESSAGE', 'Tipo de mensagem desconhecido.');
  }
  if (['HELLO', 'WELCOME', 'PING', 'PONG', 'ERROR'].includes(String(m.type))) {
    assertCondition(m.kind === 'SYSTEM', 'INVALID_MESSAGE', 'Categoria inválida.');
  }
  return m as unknown as WireMessage;
}
export function assertRoute(message: WireMessage, sender: SenderRole, lane: Lane, matchId: string): void {
  assertCondition(message.matchId === matchId, 'UNAUTHORIZED', 'Partida incorreta.');
  assertCondition(laneFor(message) === lane, 'INVALID_MESSAGE', 'Canal incorreto.');
  const clientOnly = ['INPUT_FRAME', 'CLIENT_COMMAND', 'HELLO'];
  const hostOnly = ['STATE_SNAPSHOT', 'SERVER_EVENT', 'WELCOME', 'ERROR'];
  assertCondition(!(sender === 'client' && hostOnly.includes(message.type)) && !(sender === 'host' && clientOnly.includes(message.type)), 'UNAUTHORIZED', 'Mensagem não permitida para este participante.');
}
export class JsonCodec implements MessageCodec {
  readonly name = 'json-v1';
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  constructor(private readonly config: Readonly<PlatformConfig> = createConfig()) {}
  encode(message: WireMessage): Uint8Array {
    validateMessage(message);
    const bytes = this.encoder.encode(JSON.stringify(message));
    this.checkSize(bytes, laneFor(message));
    return bytes;
  }
  decode(bytes: Uint8Array): WireMessage {
    this.checkSize(bytes, 'reliable');
    let raw: unknown;
    try { raw = JSON.parse(this.decoder.decode(bytes)); }
    catch { throw new DomainError('INVALID_MESSAGE', 'JSON ou UTF-8 inválido.'); }
    const message = validateMessage(raw);
    this.checkSize(bytes, laneFor(message));
    return message;
  }
  private checkSize(bytes: Uint8Array, lane: Lane): void {
    const max = lane === 'realtime' ? this.config.maxRealtimeMessageBytes : this.config.maxReliableMessageBytes;
    assertCondition(bytes.byteLength > 0 && bytes.byteLength <= max, 'MESSAGE_TOO_LARGE', 'Mensagem excede o limite do canal.');
  }
}
export { ProtocolReceiver } from './receiver.js';
