import { createConfig } from '@countryballs/config';
import type { PlatformConfig } from '@countryballs/config';
import { assertCondition } from '@countryballs/shared-types';
import type { Clock } from '@countryballs/shared-types';
import { assertRoute } from './index.js';
import type { Lane, MessageCodec, SenderRole, WireMessage } from './index.js';

// One instance per authenticated peer per match. Never share replay counters across peers.
export class ProtocolReceiver {
  private readonly counters: Record<string, number> = {};
  private readonly budgets: Record<Lane, { tokens: number; last: number }>;
  constructor(
    private readonly codec: MessageCodec,
    private readonly remoteRole: SenderRole,
    private readonly matchId: string,
    private readonly clock: Clock,
    private readonly config: Readonly<PlatformConfig> = createConfig(),
  ) {
    this.budgets = {
      realtime: { tokens: config.maxInputPerSecond, last: clock.now() },
      reliable: { tokens: config.maxReliablePerSecond, last: clock.now() },
    };
  }
  receive(lane: Lane, bytes: Uint8Array): WireMessage | null {
    const budget = this.budgets[lane];
    const rate = lane === 'realtime' ? this.config.maxInputPerSecond : this.config.maxReliablePerSecond;
    const now = this.clock.now();
    budget.tokens = Math.min(rate, budget.tokens + Math.max(0, now - budget.last) / 1_000 * rate);
    budget.last = now;
    assertCondition(budget.tokens >= 1, 'RATE_LIMITED', 'Limite de mensagens excedido.');
    budget.tokens--;
    const message = this.codec.decode(bytes);
    assertRoute(message, this.remoteRole, lane, this.matchId);
    const counter = message.type === 'INPUT_FRAME' ? message.seq : message.type === 'STATE_SNAPSHOT' ? message.tick :
      message.type === 'CLIENT_COMMAND' ? message.commandId : message.type === 'SERVER_EVENT' ? message.eventId : null;
    if (counter !== null) {
      if (counter <= (this.counters[message.type] ?? -1)) return null;
      this.counters[message.type] = counter;
    }
    return message;
  }
}
