import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonCodec, assertRoute, channelPolicy, ProtocolReceiver } from '@countryballs/protocol';
import { createConfig } from '@countryballs/config';
import { validateArenaInput, validateArenaCommand } from '@countryballs/arena-2d';
import { codeIs } from './fixtures.mjs';

const codec = new JsonCodec();
const input = { v: 1, matchId: 'match-1', kind: 'INPUT', type: 'INPUT_FRAME', seq: 1, tick: 0, payload: { move: [1, 0] } };
test('protocolo: round-trip UTF-8 e canais separados', () => {
  assert.deepEqual(codec.decode(codec.encode(input)), input);
  assert.equal(channelPolicy.realtime.maxRetransmits, 0);
  assert.equal(channelPolicy.reliable.ordered, true);
});
test('mensagens de todas as categorias passam pelo codec', () => {
  for (const body of [
    { kind: 'STATE', type: 'STATE_SNAPSHOT', tick: 2, ack: 1, payload: [1, 20, 30] },
    { kind: 'EVENT', type: 'CLIENT_COMMAND', commandId: 1, name: 'attack', payload: null },
    { kind: 'EVENT', type: 'SERVER_EVENT', eventId: 1, tick: 2, name: 'PLAYER_JOIN', payload: { name: 'Brasil' } },
    { kind: 'SYSTEM', type: 'HELLO', gameId: 'arena-2d', gameVersion: '0.1.0', ticket: 'temporary-ticket' },
    { kind: 'SYSTEM', type: 'WELCOME', playerId: 'player-1', tickRate: 30, snapshotRate: 15 },
    { kind: 'SYSTEM', type: 'PING', nonce: 1 },
    { kind: 'SYSTEM', type: 'PONG', nonce: 1 },
    { kind: 'SYSTEM', type: 'ERROR', code: 'HOST_OFFLINE', message: 'Servidor desconectou.' },
  ]) {
    const message = { v: 1, matchId: 'match-1', ...body };
    assert.deepEqual(codec.decode(codec.encode(message)), message);
  }
});
test('versão incompatível produz erro claro', () => assert.throws(() => codec.encode({ ...input, v: 2 }), codeIs('INCOMPATIBLE_VERSION')));
test('campos extras, categoria errada e tipo desconhecido são rejeitados', () => {
  for (const value of [{ ...input, position: 100 }, { ...input, kind: 'EVENT' }, { ...input, type: 'WIN' }, { ...input, seq: -1 }]) {
    assert.throws(() => codec.encode(value), codeIs('INVALID_MESSAGE'));
  }
});
test('NaN, Infinity, objetos especiais e payload profundo são rejeitados', () => {
  let nested = null;
  for (let i = 0; i < 10; i++) nested = [nested];
  for (const payload of [NaN, Infinity, new Date(), nested, undefined]) assert.throws(() => codec.encode({ ...input, payload }), codeIs('INVALID_MESSAGE'));
});
test('JSON inválido, UTF-8 inválido e prototype pollution são rejeitados', () => {
  assert.throws(() => codec.decode(new Uint8Array([255])), codeIs('INVALID_MESSAGE'));
  assert.throws(() => codec.decode(new TextEncoder().encode('{')), codeIs('INVALID_MESSAGE'));
  const value = JSON.parse(JSON.stringify(input).replace('"move":[1,0]', '"__proto__":{}'));
  assert.throws(() => codec.encode(value), codeIs('INVALID_MESSAGE'));
});
test('limites contam bytes UTF-8 e respeitam cada canal', () => {
  assert.throws(() => codec.encode({ ...input, payload: 'á'.repeat(700) }), codeIs('MESSAGE_TOO_LARGE'));
  assert.throws(() => codec.decode(new Uint8Array(8_193)), codeIs('MESSAGE_TOO_LARGE'));
});
test('cliente não envia snapshots, nem mensagens para outro jogo ou canal', () => {
  const state = { v: 1, matchId: 'match-1', kind: 'STATE', type: 'STATE_SNAPSHOT', tick: 1, ack: 1, payload: [] };
  assert.throws(() => assertRoute(state, 'client', 'realtime', 'match-1'), codeIs('UNAUTHORIZED'));
  assert.throws(() => assertRoute(input, 'client', 'reliable', 'match-1'), codeIs('INVALID_MESSAGE'));
  assert.throws(() => assertRoute(input, 'client', 'realtime', 'other'), codeIs('UNAUTHORIZED'));
});
test('replay e inputs fora de ordem não são reaplicados', () => {
  const receiver = new ProtocolReceiver(codec, 'client', 'match-1', { now: () => 0 });
  assert.equal(receiver.receive('realtime', codec.encode(input)).seq, 1);
  assert.equal(receiver.receive('realtime', codec.encode(input)), null);
  assert.equal(receiver.receive('realtime', codec.encode({ ...input, seq: 0 })), null);
});
test('flood é limitado antes de decodificar o payload', () => {
  let now = 0;
  const receiver = new ProtocolReceiver(codec, 'client', 'match-1', { now: () => now }, createConfig({ maxInputPerSecond: 2 }));
  receiver.receive('realtime', codec.encode(input)); receiver.receive('realtime', codec.encode(input));
  assert.throws(() => receiver.receive('realtime', new Uint8Array([255])), codeIs('RATE_LIMITED'));
  now = 1_000;
  assert.equal(receiver.receive('realtime', codec.encode({ ...input, seq: 2 })).seq, 2);
});
test('Arena aceita intenção e normaliza diagonal, rejeita posição ou dano', () => {
  const normalized = validateArenaInput({ move: [1, 1] });
  assert.ok(Math.abs(Math.hypot(...normalized.move) - 1) < 0.000001);
  for (const input of [{ x: 100 }, { move: [2, 0] }, { move: [0, 0], damage: 99 }]) assert.throws(() => validateArenaInput(input));
  assert.equal(validateArenaCommand('attack', null), 'attack');
  assert.throws(() => validateArenaCommand('attack', { damage: 100 }));
});
