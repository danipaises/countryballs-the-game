import { CommunityBackendProvider, InMemoryCommunityCoordinator } from '@countryballs/community-provider';
import { createConfig, versions } from '@countryballs/config';
import { JsonCodec, ProtocolReceiver } from '@countryballs/protocol';
import { validateArenaInput } from '@countryballs/arena-2d';

const hostCount = Number(process.argv[2] ?? 3);
const matchesPerHost = Number(process.argv[3] ?? 4);
const seconds = Number(process.argv[4] ?? 10);
if (![hostCount, matchesPerHost, seconds].every(n => Number.isInteger(n) && n > 0) || hostCount > 20 || matchesPerHost > 10 || seconds > 120) {
  throw new Error('Uso: npm run load:contracts -- [hosts:1..20] [salas:1..10] [segundos:1..120]');
}
let now = 0;
const clock = { now: () => now };
const config = createConfig();
const coordinator = new InMemoryCommunityCoordinator(config, clock);
const codec = new JsonCodec(config);
const compatibility = { protocol: 1, game: { id: 'arena-2d', version: '0.1.0' } };
const hosts = [];
const bots = [];
const started = performance.now();
for (let h = 0; h < hostCount; h++) {
  const admin = new CommunityBackendProvider(coordinator);
  const host = await admin.registerHost({ name: `Host-${h}`, region: 'BR', versions, games: [compatibility.game], maxMatches: Math.max(3, matchesPerHost), reservedPrivateMatches: 0 });
  hosts.push({ admin, host });
  for (let m = 0; m < matchesPerHost; m++) {
    const room = await admin.createRoom({ hostId: host.hostId, compatibility, visibility: 'public', maxPlayers: 8, requestId: `load-${m}` });
    for (let p = 0; p < 8; p++) {
      const provider = new CommunityBackendProvider(coordinator); await provider.login(`Bot-${h}-${m}-${p}`);
      const ticket = await provider.joinRoom(room.id, compatibility); await coordinator.consumeTicket(host.accessToken, ticket.ticket);
      bots.push({ provider, roomId: room.id, receiver: new ProtocolReceiver(codec, 'client', room.id, clock, config) });
    }
    await coordinator.setRoomStatus(host.accessToken, room.id, 'running');
  }
}
let messages = 0; let bytes = 0;
for (let tick = 0; tick < seconds * config.matchTickRate; tick++) {
  now = tick / config.matchTickRate * 1_000;
  if (tick % (5 * config.matchTickRate) === 0) for (const { admin } of hosts) {
    await admin.heartbeat({ sequence: tick, uptimeMs: Math.floor(now), load: 0.1, stability: 1, networkStatus: 'healthy', acceptingMatches: true, currentMatches: matchesPerHost, currentPlayers: matchesPerHost * 8 });
  }
  for (const bot of bots) {
    const data = codec.encode({ v: 1, kind: 'INPUT', type: 'INPUT_FRAME', matchId: bot.roomId, seq: tick, tick, payload: { move: [tick % 2 ? 1 : -1, 0] } });
    const message = bot.receiver.receive('realtime', data);
    if (!message) throw new Error('Input inesperadamente descartado.');
    validateArenaInput(message.payload); messages++; bytes += data.length;
  }
}
const connectedPlayers = (await coordinator.listServers()).reduce((n, host) => n + host.currentPlayers, 0);
for (const bot of bots) await bot.provider.leaveRoom(bot.roomId);
console.log(JSON.stringify({ mode: 'synthetic-contracts-only', hostCount, matches: hostCount * matchesPerHost, connectedPlayers, messages, encodedBytes: bytes, virtualSeconds: seconds, elapsedMs: Math.round(performance.now() - started), remainingPlayers: (await coordinator.listServers()).reduce((n, host) => n + host.currentPlayers, 0), limitation: 'Não mede rede, WebRTC, hardware de host, renderização ou física. Não é um benchmark de capacidade.' }, null, 2));
