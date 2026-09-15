import { InMemoryCommunityCoordinator, CommunityBackendProvider } from '@countryballs/community-provider';
import { createConfig, versions } from '@countryballs/config';

export const compatibility = { protocol: 1, game: { id: 'arena-2d', version: '0.1.0' } };
export const hostRequest = { name: 'Dani-PC', region: 'BR', versions, games: [compatibility.game], maxMatches: 5, reservedPrivateMatches: 1 };
export const heartbeat = { sequence: 0, uptimeMs: 0, load: 0.1, stability: 0.99, networkStatus: 'healthy', acceptingMatches: true, currentMatches: 0, currentPlayers: 0 };
export const codeIs = expected => error => error.code === expected;
export async function fixture(overrides = {}) {
  let now = 1_000_000;
  let requestId = 0;
  const clock = { now: () => now };
  const config = createConfig(overrides);
  const coordinator = new InMemoryCommunityCoordinator(config, clock);
  const hostProvider = new CommunityBackendProvider(coordinator);
  const host = await hostProvider.registerHost(hostRequest);
  const client = new CommunityBackendProvider(coordinator);
  const guest = await client.login('Dani');
  const create = (custom = {}, provider = client) => provider.createRoom({ hostId: host.hostId, compatibility, visibility: 'public', maxPlayers: 8, requestId: `request-${++requestId}`, ...custom });
  const player = async (name = 'Convidado') => {
    const provider = new CommunityBackendProvider(coordinator);
    const session = await provider.login(name);
    return { provider, session };
  };
  return { coordinator, hostProvider, host, client, guest, clock, config, create, player, advance: ms => { now += ms; } };
}
