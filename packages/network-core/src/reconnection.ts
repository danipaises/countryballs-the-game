import { assertCondition } from '@countryballs/shared-types';
import type { Clock } from '@countryballs/shared-types';

// Pure state policy; actual ICE restart and resume exchange are phase 4.
export class ReconnectionPolicy {
  private lostAt: number | null = null;
  private terminal = false;
  constructor(private readonly clock: Clock, private readonly timeoutMs: number) {
    assertCondition(Number.isFinite(timeoutMs) && timeoutMs > 0, 'INVALID_REQUEST', 'Timeout inválido.');
  }
  disconnect(): void { if (!this.terminal && this.lostAt === null) this.lostAt = this.clock.now(); }
  status(): 'connected' | 'reconnecting' | 'ended' {
    if (this.lostAt !== null && this.clock.now() - this.lostAt >= this.timeoutMs) this.terminal = true;
    return this.terminal ? 'ended' : this.lostAt === null ? 'connected' : 'reconnecting';
  }
  reconnect(): boolean {
    if (this.status() === 'ended') return false;
    this.lostAt = null; return true;
  }
}
