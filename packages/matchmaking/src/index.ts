import { createConfig } from '@countryballs/config';
import type { PlatformConfig } from '@countryballs/config';
import { sameGame } from '@countryballs/shared-types';
import type { Compatibility, PublicHost } from '@countryballs/shared-types';

export interface MatchmakingCriteria {
  compatibility: Compatibility;
  region: string;
  latencyByHost: Readonly<Record<string, number>>;
  maxPingMs?: number;
}
export interface RankedHost { host: PublicHost; score: number; pingMs: number | null }
export const matchmakingWeights = Object.freeze({ region: 30, unknownPing: 100, occupancy: 80, load: 80, instability: 100 });
export function rankHosts(hosts: readonly PublicHost[], query: MatchmakingCriteria, config: Readonly<PlatformConfig> = createConfig()): RankedHost[] {
  return hosts.flatMap(host => {
    const communitySlots = host.maxMatches - host.reservedPrivateMatches;
    if (host.versions.protocol !== query.compatibility.protocol || !host.games.some(game => sameGame(game, query.compatibility.game)) ||
      !host.acceptingMatches || host.networkStatus !== 'healthy' || host.maxMatches < config.minPublicMatches ||
      host.currentMatches >= host.maxMatches || host.publicMatches >= communitySlots) return [];
    const measured = query.latencyByHost[host.id];
    const pingMs = typeof measured === 'number' && Number.isFinite(measured) && measured >= 0 ? measured : null;
    if (query.maxPingMs !== undefined && (pingMs === null || pingMs > query.maxPingMs)) return [];
    const w = matchmakingWeights;
    const score = (host.region === query.region ? 0 : w.region) + (pingMs ?? w.unknownPing) * 0.2 +
      host.currentMatches / host.maxMatches * w.occupancy + host.load * w.load + (1 - host.stability) * w.instability;
    return [{ host: structuredClone(host), score, pingMs }];
  }).sort((a, b) => a.score - b.score || a.host.id.localeCompare(b.host.id));
}
