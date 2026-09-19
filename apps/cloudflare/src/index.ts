import type { CloudRoom, JoinCloudRoomRequest } from '@countryballs/cloud-contracts';
import { assertCondition, DomainError } from '@countryballs/shared-types';
import type { Env } from './env.js';
import { errorResponse, json, readJson, routeSegments } from './http.js';
import { ArenaMatch } from './match.js';
import { RoomDirectory } from './room-directory.js';
import { validateCreateRoom, validateJoinRoom } from './validation.js';

export { ArenaMatch, RoomDirectory };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return withSecurityHeaders(await env.ASSETS.fetch(request));
    try {
      return await api(request, env, url);
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  const segments = routeSegments(url);
  const directory = env.DIRECTORY.getByName('global');
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ status: 'ok', platform: env.PLATFORM_VERSION, protocol: Number(env.PROTOCOL_VERSION), hosting: 'cloudflare' });
  }
  if (request.method === 'GET' && url.pathname === '/api/rooms') {
    return json({ rooms: await directory.listRooms() });
  }
  if (request.method === 'POST' && url.pathname === '/api/rooms') {
    await directory.checkRate(await clientKey(request), 'create');
    const input = validateCreateRoom(await readJson(request));
    const room = await directory.createRoom(input);
    const match = env.MATCHES.getByName(room.id);
    try {
      await match.configure(room);
      const admission = await match.reserve(input.playerName, input.country);
      return json({ ...admission, room }, { status: 201 });
    } catch (error) {
      await directory.deleteRoom(room.id);
      throw error;
    }
  }
  if (segments.length === 4 && segments[0] === 'api' && segments[1] === 'rooms' && segments[3] === 'join' && request.method === 'POST') {
    await directory.checkRate(await clientKey(request), 'join');
    const roomId = segments[2]!;
    const input = validateJoinRoom(await readJson(request));
    const room = await directory.getRoom(roomId);
    assertCondition(room, 'NOT_FOUND', 'Sala não encontrada.');
    authorizePrivateRoom(room, input);
    return json(await env.MATCHES.getByName(room.id).reserve(input.playerName, input.country));
  }
  if (request.method === 'POST' && url.pathname === '/api/rooms/join-code') {
    await directory.checkRate(await clientKey(request), 'join');
    const input = validateJoinRoom(await readJson(request));
    assertCondition(input.code, 'NOT_FOUND', 'Informe o código da sala.');
    const room = await directory.findByCode(input.code);
    assertCondition(room, 'NOT_FOUND', 'Sala não encontrada.');
    return json(await env.MATCHES.getByName(room.id).reserve(input.playerName, input.country));
  }
  if (segments.length === 4 && segments[0] === 'api' && segments[1] === 'rooms' && segments[3] === 'socket' && request.method === 'GET') {
    const roomId = segments[2]!;
    assertCondition(await directory.getRoom(roomId), 'NOT_FOUND', 'Sala não encontrada.');
    return env.MATCHES.getByName(roomId).fetch(request);
  }
  throw new DomainError('NOT_FOUND', 'Rota não encontrada.');
}

async function clientKey(request: Request): Promise<string> {
  const source = request.headers.get('cf-connecting-ip') ?? 'local-development';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`countryballs-rate-v1:${source}`));
  return Array.from(new Uint8Array(hash).slice(0, 12), byte => byte.toString(16).padStart(2, '0')).join('');
}

function authorizePrivateRoom(room: CloudRoom, input: JoinCloudRoomRequest): void {
  if (room.visibility === 'private') assertCondition(input.code === room.code, 'NOT_FOUND', 'Sala não encontrada.');
}

function withSecurityHeaders(response: Response): Response {
  const copy = new Response(response.body, response);
  copy.headers.set('x-content-type-options', 'nosniff');
  copy.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  copy.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  copy.headers.set('cross-origin-opener-policy', 'same-origin');
  copy.headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss: ws:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return copy;
}
