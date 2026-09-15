import { CommunityBackendProvider, InMemoryCommunityCoordinator, createBackendProvider } from '@countryballs/community-provider';
import { versions } from '@countryballs/config';

const coordinator = new InMemoryCommunityCoordinator();
const createProvider = () => createBackendProvider('community', { community: () => new CommunityBackendProvider(coordinator) });
const server = createProvider();
const game = { id: 'arena-2d', version: '0.1.0' };
const compatibility = { protocol: 1, game };
const host = await server.registerHost({ name: 'Dani-PC', region: 'BR', versions, games: [game], maxMatches: 5, reservedPrivateMatches: 1 });
const alice = createProvider(); const bob = createProvider();
await alice.login('Brasil'); await bob.login('Portugal');
const room = await alice.createRoom({ hostId: host.hostId, compatibility, visibility: 'private', maxPlayers: 8, requestId: 'demo-1' });
const invite = await alice.createInvite(room.id);
for (const player of [alice, bob]) {
  const ticket = await player.joinRoom(room.id, compatibility, invite.code);
  await coordinator.consumeTicket(host.accessToken, ticket.ticket);
}
await coordinator.setRoomStatus(host.accessToken, room.id, 'running');
console.log('Demonstração dos contratos em memória — sem WebRTC e sem física.');
console.log(JSON.stringify({ host: (await alice.listServers())[0].name, partidas: 1, jogadores: 2, estado: 'running', salasPublicas: (await alice.listRooms()).length }, null, 2));
await coordinator.setRoomStatus(host.accessToken, room.id, 'ended');
await coordinator.setRoomStatus(host.accessToken, room.id, 'lobby');
await alice.leaveRoom(room.id); await bob.leaveRoom(room.id);
console.log('Ciclo concluído; servidor continua registrado:', (await alice.listServers()).length === 1);
