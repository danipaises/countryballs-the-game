import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityBackendProvider, createBackendProvider } from '@countryballs/community-provider';
import { fixture, compatibility, hostRequest, heartbeat, codeIs } from './fixtures.mjs';

test('registro, sessão e projeções não expõem tokens ou endereços', async () => {
  const f = await fixture();
  const hosts = await f.client.listServers();
  assert.equal(hosts.length, 1); assert.equal(hosts[0].trust, 'community-casual');
  assert.equal((await f.client.getProfile()).name, 'Dani');
  for (const field of ['accessToken', 'ip', 'address', 'ticket']) assert.equal(field in hosts[0], false);
  hosts[0].games[0].version = '9.9.9';
  assert.equal((await f.client.listServers())[0].games[0].version, '0.1.0');
});
test('servidor incompatível e capacidade inválida são recusados', async () => {
  const f = await fixture();
  await assert.rejects(f.coordinator.registerHost({ ...hostRequest, versions: { ...hostRequest.versions, protocol: 2 } }), codeIs('INCOMPATIBLE_VERSION'));
  await assert.rejects(f.coordinator.registerHost({ ...hostRequest, maxMatches: 0 }), codeIs('INVALID_REQUEST'));
  await assert.rejects(f.coordinator.registerHost({ ...hostRequest, name: '<script>' }), codeIs('INVALID_REQUEST'));
});
test('oito jogadores reservam, nono é recusado mesmo em chamadas concorrentes', async () => {
  const f = await fixture(); const room = await f.create();
  const players = await Promise.all(Array.from({ length: 9 }, () => f.player()));
  const result = await Promise.allSettled(players.map(p => p.provider.joinRoom(room.id, compatibility)));
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 8);
  assert.equal(result.find(r => r.status === 'rejected').reason.code, 'ROOM_FULL');
  for (const r of result) if (r.status === 'fulfilled') await f.coordinator.consumeTicket(f.host.accessToken, r.value.ticket);
  assert.equal((await f.client.listServers())[0].currentPlayers, 8);
});
test('múltiplas partidas respeitam pool comunitário e reserva do dono', async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => f.create()));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 4);
  assert.equal(outcomes.find(r => r.status === 'rejected').reason.code, 'HOST_FULL');
  await assert.rejects(f.create({ visibility: 'private' }), codeIs('HOST_FULL'));
  await f.create({ visibility: 'private' }, f.hostProvider);
  assert.equal((await f.client.listServers())[0].currentMatches, 5);
  await assert.rejects(f.create({ visibility: 'private' }, f.hostProvider), codeIs('HOST_FULL'));
});
test('criação idempotente não consome duas vagas; dados divergentes falham', async () => {
  const f = await fixture(); const a = await f.create({ requestId: 'same' });
  const b = await f.create({ requestId: 'same' }); assert.equal(a.id, b.id);
  assert.equal((await f.client.listServers())[0].currentMatches, 1);
  await assert.rejects(f.create({ requestId: 'same', maxPlayers: 4 }), codeIs('INVALID_REQUEST'));
});
test('sala privada só é descoberta com código e não aparece no diretório público', async () => {
  const f = await fixture(); const room = await f.create({ visibility: 'private' });
  const invite = await f.client.createInvite(room.id);
  assert.equal((await f.client.listRooms()).length, 0);
  assert.equal((await f.client.findRoom(invite.code)).id, room.id);
  await assert.rejects(f.client.joinRoom(room.id, compatibility), codeIs('NOT_FOUND'));
  const ticket = await f.client.joinRoom(room.id, compatibility, invite.code); assert.equal(ticket.room.id, room.id);
  assert.equal(invite.path, `/join/${invite.code}`);
});
test('código inválido e convite criado por outro usuário são recusados', async () => {
  const f = await fixture(); const room = await f.create(); const other = await f.player();
  await assert.rejects(f.client.findRoom('BR-7392'), codeIs('NOT_FOUND'));
  await assert.rejects(other.provider.createInvite(room.id), codeIs('UNAUTHORIZED'));
});
test('convite expira e limite impede crescimento ilimitado', async () => {
  const f = await fixture({ inviteTtlMs: 1_000, maxInvitesPerRoom: 1 }); const room = await f.create();
  const invite = await f.client.createInvite(room.id);
  await assert.rejects(f.client.createInvite(room.id), codeIs('RATE_LIMITED'));
  f.advance(1_000); await assert.rejects(f.client.findRoom(invite.code), codeIs('NOT_FOUND'));
});
test('heartbeat perdido retira host e salas no prazo exato', async () => {
  const f = await fixture(); await f.create();
  f.advance(14_999); assert.equal((await f.client.listServers()).length, 1);
  f.advance(1); assert.equal((await f.client.listServers()).length, 0); assert.equal((await f.client.listRooms()).length, 0);
  await assert.rejects(f.create(), codeIs('HOST_OFFLINE'));
});
test('heartbeat renova lease e repetição não renova o prazo', async () => {
  const f = await fixture(); f.advance(10_000); await f.hostProvider.heartbeat(heartbeat);
  f.advance(10_000); await assert.rejects(f.hostProvider.heartbeat(heartbeat), codeIs('INVALID_REQUEST'));
  assert.equal((await f.client.listServers()).length, 1);
  f.advance(5_000); assert.equal((await f.client.listServers()).length, 0);
});
test('heartbeat não sobrescreve contagem de vagas controlada pelo coordenador', async () => {
  const f = await fixture(); await f.create(); await f.hostProvider.heartbeat(heartbeat);
  assert.equal((await f.client.listServers())[0].currentMatches, 1);
});
test('host encerrado libera todas as salas', async () => {
  const f = await fixture(); await f.create(); await f.hostProvider.unregisterHost();
  assert.equal((await f.client.listServers()).length, 0); assert.equal((await f.client.listRooms()).length, 0);
});
test('ticket é temporário, vinculado ao host e de uso único', async () => {
  const f = await fixture(); const room = await f.create(); const ticket = await f.client.joinRoom(room.id, compatibility);
  const otherHost = await f.coordinator.registerHost({ ...hostRequest, name: 'Outro-PC' });
  await assert.rejects(f.coordinator.consumeTicket(otherHost.accessToken, ticket.ticket), codeIs('UNAUTHORIZED'));
  await f.coordinator.consumeTicket(f.host.accessToken, ticket.ticket);
  await assert.rejects(f.coordinator.consumeTicket(f.host.accessToken, ticket.ticket), codeIs('UNAUTHORIZED'));
});
test('ticket vencido libera vaga sem precisar do cliente sair', async () => {
  const f = await fixture({ joinTicketTtlMs: 1_000 }); const room = await f.create();
  const ticket = await f.client.joinRoom(room.id, compatibility); f.advance(1_000);
  await assert.rejects(f.coordinator.consumeTicket(f.host.accessToken, ticket.ticket), codeIs('UNAUTHORIZED'));
  assert.equal((await f.client.listRooms())[0].players, 0);
});
test('reconexão preserva identidade e rotaciona os tokens', async () => {
  const f = await fixture(); const room = await f.create(); const first = await f.client.joinRoom(room.id, compatibility);
  await f.coordinator.consumeTicket(f.host.accessToken, first.ticket);
  await f.coordinator.markDisconnected(f.host.accessToken, room.id, first.playerId);
  const resumed = await f.coordinator.resume(f.guest.accessToken, room.id, first.resumeToken);
  assert.equal(resumed.playerId, first.playerId); assert.notEqual(resumed.resumeToken, first.resumeToken);
  await f.coordinator.consumeTicket(f.host.accessToken, resumed.ticket);
  await f.coordinator.markDisconnected(f.host.accessToken, room.id, first.playerId);
  await assert.rejects(f.coordinator.resume(f.guest.accessToken, room.id, first.resumeToken), codeIs('UNAUTHORIZED'));
});
test('desconexão reserva a vaga até o timeout e depois libera', async () => {
  const f = await fixture({ disconnectTimeoutMs: 1_000 }); const room = await f.create(); const ticket = await f.client.joinRoom(room.id, compatibility);
  await f.coordinator.consumeTicket(f.host.accessToken, ticket.ticket);
  await f.coordinator.markDisconnected(f.host.accessToken, room.id, ticket.playerId);
  f.advance(999); assert.equal((await f.client.listRooms())[0].players, 1);
  f.advance(1); assert.equal((await f.client.listRooms())[0].players, 0);
  await assert.rejects(f.coordinator.resume(f.guest.accessToken, room.id, ticket.resumeToken), codeIs('UNAUTHORIZED'));
});
test('logout e saída liberam a vaga de jogador', async () => {
  const f = await fixture(); const room = await f.create(); await f.client.joinRoom(room.id, compatibility);
  await f.client.leaveRoom(room.id); assert.equal((await f.client.listRooms())[0].players, 0);
  await f.client.joinRoom(room.id, compatibility); await f.client.logout();
  assert.equal((await f.coordinator.listRooms())[0].players, 0);
});
test('sessão expirada não mantém vaga ocupada', async () => {
  const f = await fixture({ guestSessionTtlMs: 1_000 }); const room = await f.create();
  await f.client.joinRoom(room.id, compatibility); f.advance(1_000);
  await assert.rejects(f.client.getProfile(), codeIs('UNAUTHORIZED'));
  assert.equal((await f.coordinator.listRooms())[0].players, 0);
});
test('sala vazia expira e devolve capacidade ao host', async () => {
  const f = await fixture({ emptyRoomTtlMs: 1_000 }); await f.create(); f.advance(1_000);
  assert.equal((await f.client.listRooms()).length, 0); assert.equal((await f.client.listServers())[0].currentMatches, 0);
});
test('lobby, início, fim e revanche seguem ciclo; host continua disponível', async () => {
  const f = await fixture(); const room = await f.create();
  await assert.rejects(f.coordinator.setRoomStatus(f.host.accessToken, room.id, 'running'), codeIs('INVALID_STATE'));
  for (const p of [f.client, (await f.player()).provider]) {
    const ticket = await p.joinRoom(room.id, compatibility); await f.coordinator.consumeTicket(f.host.accessToken, ticket.ticket);
  }
  await f.coordinator.setRoomStatus(f.host.accessToken, room.id, 'running');
  await assert.rejects((await f.player()).provider.joinRoom(room.id, compatibility), codeIs('ROOM_CLOSED'));
  await f.coordinator.setRoomStatus(f.host.accessToken, room.id, 'ended');
  await f.coordinator.setRoomStatus(f.host.accessToken, room.id, 'lobby');
  assert.equal((await f.client.listRooms())[0].status, 'lobby'); assert.equal((await f.client.listServers()).length, 1);
});
test('cliente incompatível não ganha ticket', async () => {
  const f = await fixture(); const room = await f.create();
  await assert.rejects(f.client.joinRoom(room.id, { ...compatibility, protocol: 2 }), codeIs('INCOMPATIBLE_VERSION'));
  assert.equal((await f.client.listRooms())[0].players, 0);
});
test('rate limiting por sessão também protege tentativas de códigos inválidos', async () => {
  const f = await fixture({ maxCoordinatorRequestsPerMinute: 2 });
  await assert.rejects(f.client.findRoom('bad'), codeIs('NOT_FOUND'));
  await assert.rejects(f.client.findRoom('bad'), codeIs('NOT_FOUND'));
  await assert.rejects(f.client.findRoom('bad'), codeIs('RATE_LIMITED'));
});
test('factory nunca troca silenciosamente para um provider diferente', async () => {
  const f = await fixture();
  const provider = createBackendProvider('community', { community: () => new CommunityBackendProvider(f.coordinator) });
  assert.equal(provider.kind, 'community');
  assert.throws(() => createBackendProvider('firebase', {}), codeIs('UNSUPPORTED_PROVIDER'));
  assert.throws(() => createBackendProvider('toString', {}), codeIs('UNSUPPORTED_PROVIDER'));
  await assert.rejects(provider.getLeaderboard(compatibility.game), codeIs('UNSUPPORTED_FEATURE'));
});
