import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfig } from '@countryballs/config';
import { recommendCapacity, canAllocate } from '@countryballs/host-core';
import { rankHosts } from '@countryballs/matchmaking';
import { ReconnectionPolicy } from '@countryballs/network-core';
import { fixture, hostRequest, compatibility, heartbeat, codeIs } from './fixtures.mjs';

const benchmark = { gameId: 'arena-2d', measuredAt: 0, durationMs: 60_000, cpuSafeMatches: 8, memoryAvailableMb: 4_096, measuredMemoryPerMatchMb: 64, uploadMbps: 20, measuredMbpsPerMatch: 0.5, latencyP95Ms: 40, packetLoss: 0.001, tickOverrunRatio: 0, thermalThrottling: false };
test('configuração valida relações e rejeita valores não finitos', () => {
  assert.throws(() => createConfig({ matchTickRate: NaN }), codeIs('INVALID_REQUEST'));
  assert.throws(() => createConfig({ snapshotRate: 60 }), codeIs('INVALID_REQUEST'));
  assert.throws(() => createConfig({ maxPublicMatches: 2 }), codeIs('INVALID_REQUEST'));
  assert.throws(() => createConfig({ protocolVersion: 2 }), codeIs('INCOMPATIBLE_VERSION'));
  assert.equal(createConfig({ maxPlayersPerMatch: 12 }).maxPlayersPerMatch, 12);
});
test('benchmark aplica margem e nunca força mínimo de três', () => {
  assert.equal(recommendCapacity(benchmark).matches, 5);
  const weak = recommendCapacity({ ...benchmark, cpuSafeMatches: 2 });
  assert.equal(weak.matches, 1); assert.equal(weak.publicEligible, false);
  assert.equal(recommendCapacity({ ...benchmark, cpuSafeMatches: 100 }).matches, 10);
});
test('rede desconhecida, perda, aquecimento e ticks instáveis bloqueiam recomendação pública', () => {
  for (const patch of [{ uploadMbps: null }, { packetLoss: 0.1 }, { thermalThrottling: true }, { tickOverrunRatio: 0.3 }, { durationMs: 1 }]) {
    const result = recommendCapacity({ ...benchmark, ...patch });
    assert.equal(result.matches, 0); assert.equal(result.publicEligible, false);
  }
});
test('upload e RAM limitam capacidade independentemente da CPU', () => {
  assert.equal(recommendCapacity({ ...benchmark, uploadMbps: 1 }).matches, 1);
  assert.equal(recommendCapacity({ ...benchmark, memoryAvailableMb: 600 }).matches, 0);
  assert.throws(() => recommendCapacity({ ...benchmark, uploadMbps: NaN }), codeIs('INVALID_REQUEST'));
});
test('reserva protege vagas próprias e todas contam no total', () => {
  const usage = { maxMatches: 5, reservedPrivateMatches: 1, publicMatches: 4, privateMatches: 0 };
  assert.equal(canAllocate(usage, 'public'), false); assert.equal(canAllocate(usage, 'private'), true);
  assert.equal(canAllocate({ ...usage, privateMatches: 1 }, 'private'), false);
});
test('matchmaking prefere host saudável menos ocupado quando latência é equivalente', async () => {
  const f = await fixture();
  const other = await f.coordinator.registerHost({ ...hostRequest, name: 'Pedro-PC' });
  await f.create(); await f.create();
  const ranked = rankHosts(await f.client.listServers(), { compatibility, region: 'BR', latencyByHost: { [f.host.hostId]: 30, [other.hostId]: 31 } });
  assert.equal(ranked[0].host.id, other.hostId);
});
test('matchmaking filtra host cheio, incompatível e rede degradada', async () => {
  const f = await fixture();
  await f.hostProvider.heartbeat({ ...heartbeat, networkStatus: 'degraded' });
  assert.equal((await f.client.matchmake({ compatibility, region: 'BR', latencyByHost: {} })).length, 0);
  await f.hostProvider.heartbeat({ ...heartbeat, sequence: 1 });
  assert.equal((await f.client.matchmake({ compatibility: { ...compatibility, protocol: 2 }, region: 'BR', latencyByHost: {} })).length, 0);
  for (let i = 0; i < 4; i++) await f.create();
  assert.equal((await f.client.matchmake({ compatibility, region: 'BR', latencyByHost: {} })).length, 0);
});
test('ping desconhecido não é zero e filtro de ping exige medição real', async () => {
  const f = await fixture();
  const hosts = await f.client.listServers();
  assert.equal(rankHosts(hosts, { compatibility, region: 'BR', latencyByHost: {} })[0].pingMs, null);
  assert.equal(rankHosts(hosts, { compatibility, region: 'BR', latencyByHost: {}, maxPingMs: 100 }).length, 0);
});
test('queda do host permite reconexão dentro do prazo e termina sem migração', () => {
  let now = 0;
  const policy = new ReconnectionPolicy({ now: () => now }, 15_000);
  policy.disconnect(); now = 10_000; policy.disconnect();
  assert.equal(policy.status(), 'reconnecting'); assert.equal(policy.reconnect(), true);
  policy.disconnect(); now = 25_000;
  assert.equal(policy.status(), 'ended'); assert.equal(policy.reconnect(), false);
});
