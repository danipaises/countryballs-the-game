import type { ArenaMatch } from './match.js';
import type { RoomDirectory } from './room-directory.js';

export interface Env {
  ASSETS: Fetcher;
  DIRECTORY: DurableObjectNamespace<RoomDirectory>;
  MATCHES: DurableObjectNamespace<ArenaMatch>;
  PLATFORM_VERSION: string;
  PROTOCOL_VERSION: string;
}
