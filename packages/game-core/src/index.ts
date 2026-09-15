import type { GameVersion, JsonValue, PlayerId } from '@countryballs/shared-types';

export interface GameManifest extends GameVersion {
  name: string;
  icon: string;
  dimension: '2d' | '3d';
  renderer: 'phaser' | 'babylon' | 'custom';
  protocolVersion: number;
  minPlayers: number;
  maxPlayers: number;
  maps: readonly { id: string; name: string; version: string }[];
  status: 'planned' | 'development' | 'playable';
}
export interface RuntimeContext {
  matchId: string;
  tickRate: number;
  seed: number;
  // Inject seeded PRNG in runtime. Do not use Date.now or Math.random in simulation.
  random(): number;
}
export interface GameEvent<E extends JsonValue> { tick: number; eventId: number; payload: E }
export interface GameRuntime<I, S, E extends JsonValue, C extends JsonValue = JsonValue> {
  addPlayer(id: PlayerId, name: string): void;
  removePlayer(id: PlayerId): void;
  acceptInput(playerId: PlayerId, input: I): void;
  acceptCommand(playerId: PlayerId, commandId: number, command: C): void;
  step(tick: number, deltaSeconds: number): readonly GameEvent<E>[];
  snapshot(): S;
  dispose(): void;
}
export interface GameModule<I, S, E extends JsonValue, C extends JsonValue = JsonValue> {
  manifest: GameManifest;
  validateInput(value: unknown): I;
  validateCommand(name: string, payload: unknown): C;
  createRuntime(context: RuntimeContext, settings: Readonly<Record<string, JsonValue>>): GameRuntime<I, S, E, C>;
}
// Future recovery format; no host migration implementation in phase 1.
export interface MatchCheckpoint<S> {
  schemaVersion: number;
  game: GameVersion;
  tick: number;
  rngState: number;
  state: S;
}
