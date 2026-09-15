import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityHostProvider } from '@countryballs/network-core';
import { JsonCodec } from '@countryballs/protocol';
import { fixture, compatibility, codeIs } from './fixtures.mjs';

// Contract fake. Not a WebRTC test and not exported in production packages.
class FakeTransport {
  state = 'idle';
  handlers = new Set();
  states = new Set();
  sent = [];
  async connect() { this.state = 'connected'; }
  send(lane, bytes) { this.sent.push({ lane, bytes }); return true; }
  subscribe(handler) { this.handlers.add(handler); return () => this.handlers.delete(handler); }
  onState(handler) { this.states.add(handler); return () => this.states.delete(handler); }
  close() { this.state = 'closed'; for (const handler of this.states) handler('closed'); }
  stats() { return { rttMs: null, packetLoss: null, bytesSent: 0, bytesReceived: 0, bufferedBytes: 0, path: 'unknown' }; }
  receive(lane, bytes) { for (const handler of this.handlers) handler(lane, bytes); }
}
test('Network API exige WELCOME e envia intenção sem dependência de engine', async () => {
  const f = await fixture(); const room = await f.create(); const transport = new FakeTransport(); const codec = new JsonCodec();
  const network = new CommunityHostProvider(f.client, { create: () => transport }, codec);
  const match = await network.joinMatch(room.id, compatibility);
  assert.equal(codec.decode(transport.sent[0].bytes).type, 'HELLO');
  assert.throws(() => match.sendInput({ move: [1, 0] }, 0), codeIs('DISCONNECTED'));
  const hello = codec.decode(transport.sent[0].bytes);
  await f.coordinator.consumeTicket(f.host.accessToken, hello.ticket);
  transport.receive('reliable', codec.encode({ v: 1, matchId: room.id, kind: 'SYSTEM', type: 'WELCOME', playerId: f.guest.playerId, tickRate: 30, snapshotRate: 15 }));
  assert.equal(match.isReady, true);
  match.sendInput({ move: [1, 0] }, 1); match.sendReliableEvent('attack', null);
  assert.equal(transport.sent[1].lane, 'realtime'); assert.equal(transport.sent[2].lane, 'reliable');
  await match.leaveMatch(); assert.equal((await f.client.listRooms())[0].players, 0);
  assert.equal(transport.handlers.size, 0); await match.leaveMatch();
});
test('falha de transporte devolve reserva de entrada', async () => {
  const f = await fixture(); const room = await f.create(); const transport = new FakeTransport();
  transport.connect = async () => { throw new Error('unreachable'); };
  const network = new CommunityHostProvider(f.client, { create: () => transport }, new JsonCodec());
  await assert.rejects(network.joinMatch(room.id, compatibility), /unreachable/);
  assert.equal((await f.client.listRooms())[0].players, 0); assert.equal(transport.state, 'closed');
});
test('falha na criação do transporte também devolve a reserva', async () => {
  const f = await fixture(); const room = await f.create();
  const network = new CommunityHostProvider(f.client, { create: () => { throw new Error('unsupported'); } }, new JsonCodec());
  await assert.rejects(network.joinMatch(room.id, compatibility), /unsupported/);
  assert.equal((await f.client.listRooms())[0].players, 0);
});
test('mensagem malformada do host encerra conexão', async () => {
  const f = await fixture(); const room = await f.create(); const transport = new FakeTransport();
  const network = new CommunityHostProvider(f.client, { create: () => transport }, new JsonCodec());
  const match = await network.joinMatch(room.id, compatibility);
  transport.receive('reliable', new Uint8Array([255]));
  assert.equal(transport.state, 'closed'); assert.equal(match.isReady, false);
  await match.leaveMatch();
});
