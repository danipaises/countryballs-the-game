import type { GameManifest, GameRuntime, RuntimeContext } from '@countryballs/game-core';
import { assertCondition } from '@countryballs/shared-types';
import type { PlayerId } from '@countryballs/shared-types';

export const arenaManifest = Object.freeze({
  id: 'arena-2d', version: '0.1.0', name: 'CountryBalls Arena', icon: 'countryball-arena',
  dimension: '2d', renderer: 'phaser', protocolVersion: 1, minPlayers: 2, maxPlayers: 8,
  maps: [{ id: 'first-ring', name: 'Primeira arena', version: '0.1.0' }], status: 'playable',
} satisfies GameManifest);
export const arenaRules = Object.freeze({
  width: 960, height: 640, playerRadius: 18, moveSpeed: 180,
  maxHp: 100, attackDamage: 25, attackRange: 60, attackCooldownMs: 500,
  respawnMs: 3_000, roundDurationMs: 180_000, inputTimeoutMs: 250,
});
export type ArenaInput = { move: [number, number] };
export function validateArenaInput(value: unknown): ArenaInput {
  assertCondition(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_MESSAGE', 'Input inválido.');
  const input = value as Record<string, unknown>;
  assertCondition(Object.keys(input).length === 1 && Array.isArray(input.move) && input.move.length === 2, 'INVALID_MESSAGE', 'Envie apenas o vetor de movimento.');
  const [x, y] = input.move as unknown[];
  assertCondition(typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1 && typeof y === 'number' && Number.isFinite(y) && Math.abs(y) <= 1, 'INVALID_MESSAGE', 'Direção inválida.');
  const length = Math.max(1, Math.hypot(x, y));
  return { move: [x / length, y / length] };
}
export type ArenaCommand = 'attack' | 'ready' | 'rematch';
export function validateArenaCommand(name: string, payload: unknown): ArenaCommand {
  assertCondition(['attack', 'ready', 'rematch'].includes(name) && payload === null, 'INVALID_MESSAGE', 'Comando da Arena inválido.');
  return name as 'attack' | 'ready' | 'rematch';
}
export interface ArenaPlayerState {
  slot: number;
  x: number;
  y: number;
  hp: number;
  score: number;
  respawnTick: number;
}
export type ArenaPhase = 'lobby' | 'running' | 'ended';
export type ArenaEvent = {
  type: 'PLAYER_JOIN' | 'PLAYER_LEAVE' | 'PLAYER_DAMAGED' | 'PLAYER_RESPAWN' | 'MATCH_START' | 'MATCH_END' | 'LOBBY_RESET';
  playerId?: string;
  targetId?: string;
  damage?: number;
  winnerId?: string | null;
};
export type ArenaSnapshotPlayer = [string, number, number, number, number, number, number, string];
export type ArenaSnapshot = {
  phase: ArenaPhase;
  tick: number;
  remainingTicks: number;
  winnerId: string | null;
  players: ArenaSnapshotPlayer[];
};

interface PlayerInternal {
  id: string;
  name: string;
  slot: number;
  x: number;
  y: number;
  hp: number;
  score: number;
  alive: boolean;
  ready: boolean;
  respawnTick: number;
  cooldownUntilTick: number;
  input: ArenaInput;
  lastInputTick: number;
}

export class ArenaSimulation implements GameRuntime<ArenaInput, ArenaSnapshot, ArenaEvent, ArenaCommand> {
  private readonly players = new Map<PlayerId, PlayerInternal>();
  private readonly pendingEvents: ArenaEvent[] = [];
  private phase: ArenaPhase = 'lobby';
  private roundEndsAt = 0;
  private currentTick = 0;
  private disposed = false;
  private eventId = 0;
  private winnerId: string | null = null;

  constructor(private readonly context: RuntimeContext) {}

  addPlayer(id: PlayerId, name: string): void {
    this.assertActive();
    assertCondition(!this.players.has(id) && this.players.size < arenaManifest.maxPlayers, 'ROOM_FULL', 'Sala cheia.');
    const used = new Set([...this.players.values()].map(player => player.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const spawn = this.spawnFor(slot);
    this.players.set(id, {
      id, name, slot, ...spawn, hp: arenaRules.maxHp, score: 0, alive: true, ready: false,
      respawnTick: 0, cooldownUntilTick: 0, input: { move: [0, 0] }, lastInputTick: this.currentTick,
    });
    this.pendingEvents.push({ type: 'PLAYER_JOIN', playerId: id });
  }

  removePlayer(id: PlayerId): void {
    if (this.players.delete(id)) this.pendingEvents.push({ type: 'PLAYER_LEAVE', playerId: id });
    if (this.phase === 'running' && this.players.size < arenaManifest.minPlayers) this.endRound();
  }

  acceptInput(playerId: PlayerId, input: ArenaInput): void {
    const player = this.player(playerId);
    player.input = validateArenaInput(input);
    player.lastInputTick = this.currentTick;
  }

  acceptCommand(playerId: PlayerId, _commandId: number, command: ArenaCommand): void {
    const player = this.player(playerId);
    if (command === 'ready' && this.phase === 'lobby') {
      player.ready = true;
      if (this.players.size >= arenaManifest.minPlayers && [...this.players.values()].every(candidate => candidate.ready)) this.startRound();
      return;
    }
    if (command === 'rematch' && this.phase === 'ended') {
      player.ready = true;
      if (this.players.size >= arenaManifest.minPlayers && [...this.players.values()].every(candidate => candidate.ready)) { this.resetLobby(); this.startRound(); }
      return;
    }
    if (command === 'attack' && this.phase === 'running') this.attack(player);
  }

  step(tick: number, deltaSeconds: number) {
    this.assertActive();
    assertCondition(Number.isSafeInteger(tick) && tick >= this.currentTick && Number.isFinite(deltaSeconds) && deltaSeconds > 0 && deltaSeconds <= 0.1, 'INVALID_REQUEST', 'Tick inválido.');
    this.currentTick = tick;
    if (this.phase === 'running') {
      for (const player of this.players.values()) {
        if (!player.alive && tick >= player.respawnTick) this.respawn(player);
        if (!player.alive) continue;
        const inputExpired = tick - player.lastInputTick > Math.ceil(arenaRules.inputTimeoutMs / 1000 * this.context.tickRate);
        const [dx, dy] = inputExpired ? [0, 0] : player.input.move;
        player.x = this.clamp(player.x + dx * arenaRules.moveSpeed * deltaSeconds, arenaRules.playerRadius, arenaRules.width - arenaRules.playerRadius);
        player.y = this.clamp(player.y + dy * arenaRules.moveSpeed * deltaSeconds, arenaRules.playerRadius, arenaRules.height - arenaRules.playerRadius);
      }
      this.resolvePlayerCollisions();
      if (tick >= this.roundEndsAt) this.endRound();
    }
    const events = this.pendingEvents.splice(0).map(payload => ({ tick, eventId: ++this.eventId, payload }));
    return events;
  }

  snapshot(): ArenaSnapshot {
    return {
      phase: this.phase, tick: this.currentTick,
      remainingTicks: this.phase === 'running' ? Math.max(0, this.roundEndsAt - this.currentTick) : 0,
      winnerId: this.winnerId,
      players: [...this.players.values()].sort((a, b) => a.slot - b.slot).map(player => [
        player.id, Math.round(player.x * 10), Math.round(player.y * 10), player.hp,
        player.score, player.alive ? 1 : 0, player.ready ? 1 : 0, player.name,
      ]),
    };
  }

  dispose(): void { this.disposed = true; this.players.clear(); this.pendingEvents.length = 0; }

  private startRound(): void {
    this.phase = 'running'; this.winnerId = null;
    this.roundEndsAt = this.currentTick + Math.round(arenaRules.roundDurationMs / 1000 * this.context.tickRate);
    for (const player of this.players.values()) {
      Object.assign(player, this.spawnFor(player.slot), { hp: arenaRules.maxHp, score: 0, alive: true, ready: false, respawnTick: 0, cooldownUntilTick: 0 });
    }
    this.pendingEvents.push({ type: 'MATCH_START' });
  }

  private endRound(): void {
    if (this.phase !== 'running') return;
    this.phase = 'ended';
    const ordered = [...this.players.values()].sort((a, b) => b.score - a.score || a.slot - b.slot);
    this.winnerId = ordered.length > 0 ? ordered[0]!.id : null;
    for (const player of this.players.values()) { player.ready = false; player.input = { move: [0, 0] }; }
    this.pendingEvents.push({ type: 'MATCH_END', winnerId: this.winnerId });
  }

  private resetLobby(): void {
    this.phase = 'lobby'; this.winnerId = null;
    for (const player of this.players.values()) { player.ready = false; Object.assign(player, this.spawnFor(player.slot), { hp: arenaRules.maxHp, score: 0, alive: true }); }
    this.pendingEvents.push({ type: 'LOBBY_RESET' });
  }

  private attack(attacker: PlayerInternal): void {
    if (!attacker.alive || this.currentTick < attacker.cooldownUntilTick) return;
    attacker.cooldownUntilTick = this.currentTick + Math.ceil(arenaRules.attackCooldownMs / 1000 * this.context.tickRate);
    const target = [...this.players.values()].filter(candidate => candidate.id !== attacker.id && candidate.alive)
      .map(candidate => ({ candidate, distance: Math.hypot(candidate.x - attacker.x, candidate.y - attacker.y) }))
      .filter(entry => entry.distance <= arenaRules.attackRange)
      .sort((a, b) => a.distance - b.distance || a.candidate.slot - b.candidate.slot)[0]?.candidate;
    if (!target) return;
    target.hp = Math.max(0, target.hp - arenaRules.attackDamage);
    this.pendingEvents.push({ type: 'PLAYER_DAMAGED', playerId: attacker.id, targetId: target.id, damage: arenaRules.attackDamage });
    if (target.hp === 0) {
      target.alive = false;
      target.respawnTick = this.currentTick + Math.ceil(arenaRules.respawnMs / 1000 * this.context.tickRate);
      target.input = { move: [0, 0] };
      attacker.score++;
    }
  }

  private respawn(player: PlayerInternal): void {
    Object.assign(player, this.spawnFor(player.slot), { hp: arenaRules.maxHp, alive: true, respawnTick: 0, cooldownUntilTick: this.currentTick });
    this.pendingEvents.push({ type: 'PLAYER_RESPAWN', playerId: player.id });
  }

  private resolvePlayerCollisions(): void {
    const players = [...this.players.values()].filter(player => player.alive);
    for (let a = 0; a < players.length; a++) for (let b = a + 1; b < players.length; b++) {
      const first = players[a]!; const second = players[b]!;
      let dx = second.x - first.x; let dy = second.y - first.y; let distance = Math.hypot(dx, dy);
      const minimum = arenaRules.playerRadius * 2;
      if (distance >= minimum) continue;
      if (distance === 0) { dx = first.slot < second.slot ? 1 : -1; dy = 0; distance = 1; }
      const push = (minimum - distance) / 2; const nx = dx / distance; const ny = dy / distance;
      first.x = this.clamp(first.x - nx * push, arenaRules.playerRadius, arenaRules.width - arenaRules.playerRadius);
      first.y = this.clamp(first.y - ny * push, arenaRules.playerRadius, arenaRules.height - arenaRules.playerRadius);
      second.x = this.clamp(second.x + nx * push, arenaRules.playerRadius, arenaRules.width - arenaRules.playerRadius);
      second.y = this.clamp(second.y + ny * push, arenaRules.playerRadius, arenaRules.height - arenaRules.playerRadius);
    }
  }

  private spawnFor(slot: number): { x: number; y: number } {
    const angle = slot / arenaManifest.maxPlayers * Math.PI * 2;
    return { x: arenaRules.width / 2 + Math.cos(angle) * 220, y: arenaRules.height / 2 + Math.sin(angle) * 150 };
  }
  private player(id: string): PlayerInternal { const value = this.players.get(id); assertCondition(value, 'UNAUTHORIZED', 'Jogador não pertence à partida.'); return value; }
  private clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
  private assertActive(): void { assertCondition(!this.disposed, 'INVALID_STATE', 'Simulação encerrada.'); }
}

export const arenaModule = {
  manifest: arenaManifest,
  validateInput: validateArenaInput,
  validateCommand: validateArenaCommand,
  createRuntime(context: RuntimeContext): ArenaSimulation { return new ArenaSimulation(context); },
};
