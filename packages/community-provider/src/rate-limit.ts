import { assertCondition } from '@countryballs/shared-types';
import type { Clock } from '@countryballs/shared-types';

export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private readonly capacity: number, private readonly perSecond: number, private readonly clock: Clock) {
    assertCondition(capacity > 0 && perSecond > 0 && Number.isFinite(capacity) && Number.isFinite(perSecond), 'INVALID_REQUEST', 'Limite inválido.');
    this.tokens = capacity; this.last = clock.now();
  }
  take(): void {
    const now = this.clock.now();
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.last) * this.perSecond / 1_000);
    this.last = now;
    assertCondition(this.tokens >= 1, 'RATE_LIMITED', 'Muitas solicitações. Tente novamente em instantes.');
    this.tokens -= 1;
  }
}
