import type { GameManifest } from '@countryballs/game-core';
import { assertCondition } from '@countryballs/shared-types';

export const arenaManifest = Object.freeze({
  id: 'arena-2d', version: '0.1.0', name: 'CountryBalls Arena', icon: 'countryball-arena',
  dimension: '2d', renderer: 'phaser', protocolVersion: 1, minPlayers: 2, maxPlayers: 8,
  maps: [{ id: 'first-ring', name: 'Primeira arena', version: '0.1.0' }], status: 'development',
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
export function validateArenaCommand(name: string, payload: unknown): 'attack' | 'ready' | 'rematch' {
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
// Quantized compact tuples. Identity/name/country mapping travels reliably at join.
export type ArenaSnapshot = { remainingTicks: number; players: [number, number, number, number, number, number][] };
