import { assertCondition, validInteger } from '@countryballs/shared-types';

export const versions = Object.freeze({ platform: '0.2.0', server: '0.1.0', protocol: 1 });
export const defaults = Object.freeze({
  maxPlayersPerMatch: 8,
  minPublicMatches: 3,
  maxPublicMatches: 10,
  heartbeatIntervalMs: 5_000,
  missedHeartbeats: 3,
  disconnectTimeoutMs: 15_000,
  joinTicketTtlMs: 15_000,
  guestSessionTtlMs: 3_600_000,
  hostSessionTtlMs: 86_400_000,
  emptyRoomTtlMs: 60_000,
  inviteTtlMs: 600_000,
  maxInvitesPerRoom: 8,
  matchTickRate: 30,
  snapshotRate: 15,
  interpolationDelayMs: 100,
  maxRealtimeMessageBytes: 1_200,
  maxReliableMessageBytes: 8_192,
  maxSignalBytes: 65_536,
  maxBufferedBytes: 65_536,
  maxInputPerSecond: 60,
  maxReliablePerSecond: 20,
  maxCoordinatorRequestsPerMinute: 120,
  maxHosts: 1_000,
  maxGuests: 10_000,
  cloudRoomTtlMs: 3_600_000,
  cloudJoinTicketTtlMs: 20_000,
  cloudMaxRooms: 200,
  cloudCreatePerMinute: 10,
  cloudJoinPerMinute: 60,
  protocolVersion: 1,
});
export type PlatformConfig = { [K in keyof typeof defaults]: number };
export function createConfig(overrides: Partial<PlatformConfig> = {}): Readonly<PlatformConfig> {
  const config = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(config)) {
    assertCondition(key in defaults && validInteger(value, 1, 1_000_000_000), 'INVALID_REQUEST', `Configuração inválida: ${key}`);
  }
  assertCondition(config.minPublicMatches <= config.maxPublicMatches, 'INVALID_REQUEST', 'Capacidade mínima maior que máxima.');
  assertCondition(config.maxPlayersPerMatch <= 64, 'INVALID_REQUEST', 'Limite do protocolo: 64 jogadores.');
  assertCondition(config.snapshotRate <= config.matchTickRate, 'INVALID_REQUEST', 'Snapshots excedem os ticks.');
  assertCondition(config.maxRealtimeMessageBytes <= config.maxReliableMessageBytes, 'INVALID_REQUEST', 'Limites de mensagens inconsistentes.');
  assertCondition(config.protocolVersion === versions.protocol, 'INCOMPATIBLE_VERSION', 'Este build implementa somente o protocolo 1.');
  return Object.freeze(config);
}
export interface ProviderConfig {
  backendProvider: string;
  gameServerProvider: string;
  transport: 'webrtc' | 'websocket' | 'lan';
  privacy: 'direct' | 'relay-only';
  coordinatorUrl: string;
}
