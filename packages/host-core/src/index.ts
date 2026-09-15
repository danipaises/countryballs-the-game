import { createConfig } from '@countryballs/config';
import type { PlatformConfig } from '@countryballs/config';
import { assertCondition, validInteger } from '@countryballs/shared-types';

export interface CapacityUsage {
  maxMatches: number;
  reservedPrivateMatches: number;
  publicMatches: number;
  privateMatches: number;
}
export function canAllocate(usage: CapacityUsage, visibility: 'public' | 'private'): boolean {
  const { maxMatches, reservedPrivateMatches, publicMatches, privateMatches } = usage;
  assertCondition(Object.values(usage).every(n => validInteger(n, 0, 1_000_000)) && maxMatches > 0 && reservedPrivateMatches <= maxMatches, 'INVALID_REQUEST', 'Capacidade inválida.');
  if (publicMatches + privateMatches >= maxMatches) return false;
  return visibility === 'private' || publicMatches < maxMatches - reservedPrivateMatches;
}
export interface BenchmarkSample {
  gameId: string;
  measuredAt: number;
  durationMs: number;
  // Highest concurrent FULL matches that meet tick budget and stability target.
  cpuSafeMatches: number;
  memoryAvailableMb: number;
  measuredMemoryPerMatchMb: number;
  uploadMbps: number | null;
  measuredMbpsPerMatch: number;
  latencyP95Ms: number | null;
  packetLoss: number | null;
  tickOverrunRatio: number;
  thermalThrottling: boolean;
}
export interface CapacityRecommendation {
  matches: number;
  publicEligible: boolean;
  reasons: string[];
}
export const benchmarkPolicy = Object.freeze({
  minimumDurationMs: 30_000,
  memoryReserveMb: 512,
  safetyFactor: 0.7,
  maximumLatencyMs: 200,
  maximumLoss: 0.02,
  maximumTickOverrun: 0.01,
});
// Evaluates measurements; does NOT collect hardware/network measurements itself.
export function recommendCapacity(sample: BenchmarkSample, config: Readonly<PlatformConfig> = createConfig()): CapacityRecommendation {
  for (const n of [sample.measuredAt, sample.durationMs, sample.cpuSafeMatches, sample.memoryAvailableMb, sample.measuredMemoryPerMatchMb, sample.measuredMbpsPerMatch, sample.tickOverrunRatio]) {
    assertCondition(Number.isFinite(n) && n >= 0, 'INVALID_REQUEST', 'Medição inválida.');
  }
  assertCondition(sample.measuredMemoryPerMatchMb > 0 && sample.measuredMbpsPerMatch > 0 && Number.isInteger(sample.cpuSafeMatches) && sample.tickOverrunRatio <= 1, 'INVALID_REQUEST', 'Perfil de carga inválido.');
  for (const n of [sample.uploadMbps, sample.latencyP95Ms, sample.packetLoss]) {
    assertCondition(n === null || (Number.isFinite(n) && n >= 0), 'INVALID_REQUEST', 'Medição de rede inválida.');
  }
  assertCondition(sample.packetLoss === null || sample.packetLoss <= 1, 'INVALID_REQUEST', 'Perda inválida.');
  const reasons: string[] = [];
  if (sample.durationMs < benchmarkPolicy.minimumDurationMs) reasons.push('Teste ainda muito curto.');
  if (sample.thermalThrottling) reasons.push('Dispositivo reduzindo desempenho por temperatura.');
  if (sample.tickOverrunRatio > benchmarkPolicy.maximumTickOverrun) reasons.push('Simulação não mantém os ticks.');
  if (sample.uploadMbps === null || sample.latencyP95Ms === null || sample.packetLoss === null) reasons.push('Rede não medida; não anunciar capacidade pública.');
  if ((sample.latencyP95Ms ?? 0) > benchmarkPolicy.maximumLatencyMs || (sample.packetLoss ?? 0) > benchmarkPolicy.maximumLoss) reasons.push('Rede instável para hospedagem pública.');
  const memory = Math.max(0, sample.memoryAvailableMb - benchmarkPolicy.memoryReserveMb) / sample.measuredMemoryPerMatchMb;
  const network = (sample.uploadMbps ?? 0) / sample.measuredMbpsPerMatch;
  const measured = Math.min(sample.cpuSafeMatches, memory, network) * benchmarkPolicy.safetyFactor;
  const matches = reasons.length ? 0 : Math.min(config.maxPublicMatches, Math.floor(measured));
  if (matches < config.minPublicMatches) reasons.push('Abaixo da meta pública; nunca elevar artificialmente a capacidade.');
  return { matches, publicEligible: matches >= config.minPublicMatches, reasons };
}
export interface HostTelemetry {
  uptimeMs: number;
  cpuPercent: number;
  ramMb: number;
  currentMatches: number;
  maxMatches: number;
  currentPlayers: number;
  bytesSent: number;
  bytesReceived: number;
  tickP95Ms: number;
  errors: number;
  version: string;
}
