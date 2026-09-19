import { DurableObject } from 'cloudflare:workers';
import type { CloudRoom, CloudRoomStatus, CreateCloudRoomRequest } from '@countryballs/cloud-contracts';
import { createConfig } from '@countryballs/config';
import { assertCondition } from '@countryballs/shared-types';
import type { Env } from './env.js';

const config = createConfig();
const ROOM_TTL_MS = config.cloudRoomTtlMs;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
interface RateRecord { count: number; expiresAt: number }

export class RoomDirectory extends DurableObject<Env> {
  async checkRate(clientKey: string, action: 'create' | 'join'): Promise<void> {
    const now = Date.now(); const window = Math.floor(now / 60_000); const key = `rate:${action}:${clientKey}:${window}`;
    const current = await this.ctx.storage.get<RateRecord>(key);
    const limit = action === 'create' ? config.cloudCreatePerMinute : config.cloudJoinPerMinute;
    assertCondition((current?.count ?? 0) < limit, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto.');
    await this.ctx.storage.put(key, { count: (current?.count ?? 0) + 1, expiresAt: now + 120_000 } satisfies RateRecord);
    await this.scheduleCleanup();
  }

  async createRoom(input: CreateCloudRoomRequest): Promise<CloudRoom> {
    await this.cleanup();
    const existing = await this.ctx.storage.list({ prefix: 'room:', limit: config.cloudMaxRooms + 1 });
    assertCondition(existing.size < config.cloudMaxRooms, 'RATE_LIMITED', 'Limite temporário de salas atingido.');
    const id = crypto.randomUUID();
    const code = await this.uniqueCode();
    const now = Date.now();
    const room: CloudRoom = {
      id, name: input.roomName, code, visibility: input.visibility, status: 'lobby',
      playerCount: 0, maxPlayers: input.maxPlayers, createdAt: now, updatedAt: now,
      gameId: 'arena-2d', gameVersion: '0.1.0',
    };
    await this.ctx.storage.put(`room:${id}`, room);
    await this.ctx.storage.put(`code:${code}`, id);
    await this.scheduleCleanup();
    return room;
  }

  async getRoom(id: string): Promise<CloudRoom | null> {
    await this.cleanup();
    return await this.ctx.storage.get<CloudRoom>(`room:${id}`) ?? null;
  }

  async findByCode(code: string): Promise<CloudRoom | null> {
    await this.cleanup();
    const id = await this.ctx.storage.get<string>(`code:${code.toUpperCase()}`);
    return id ? await this.getRoom(id) : null;
  }

  async listRooms(): Promise<CloudRoom[]> {
    await this.cleanup();
    const records = await this.ctx.storage.list<CloudRoom>({ prefix: 'room:' });
    return [...records.values()]
      .filter(room => room.visibility === 'public' && room.status !== 'ended' && room.playerCount < room.maxPlayers)
      .map(room => this.publicRoom(room))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 50);
  }

  async updateRoom(id: string, patch: { playerCount?: number; status?: CloudRoomStatus }): Promise<void> {
    const room = await this.ctx.storage.get<CloudRoom>(`room:${id}`);
    if (!room) return;
    const next = { ...room, ...patch, updatedAt: Date.now() };
    await this.ctx.storage.put(`room:${id}`, next);
    await this.scheduleCleanup();
  }

  async deleteRoom(id: string): Promise<void> {
    const room = await this.ctx.storage.get<CloudRoom>(`room:${id}`);
    if (!room) return;
    await this.ctx.storage.delete([`room:${id}`, `code:${room.code}`]);
  }

  override async alarm(): Promise<void> {
    await this.cleanup();
    if ((await this.ctx.storage.list({ limit: 1 })).size > 0) await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = 'CB-' + Array.from(bytes, byte => ALPHABET[byte & 31]).join('');
      if (!await this.ctx.storage.get(`code:${code}`)) return code;
    }
    throw new Error('Unable to allocate room code');
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const rooms = await this.ctx.storage.list<CloudRoom>({ prefix: 'room:' });
    for (const room of rooms.values()) {
      if (room.playerCount === 0 && now - room.updatedAt >= ROOM_TTL_MS) await this.deleteRoom(room.id);
    }
    const rates = await this.ctx.storage.list<RateRecord>({ prefix: 'rate:' });
    for (const [key, rate] of rates) if (rate.expiresAt <= now) await this.ctx.storage.delete(key);
  }

  private publicRoom(room: CloudRoom): CloudRoom {
    const { code: _code, ...safe } = room;
    return safe;
  }

  private async scheduleCleanup(): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null) await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }
}
