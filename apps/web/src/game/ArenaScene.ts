import Phaser from 'phaser';
import { arenaRules } from '@countryballs/arena-2d';
import type { ArenaSnapshot } from '@countryballs/arena-2d';
import type { CloudRosterEntry, CountryCode } from '@countryballs/cloud-contracts';

type Controls = {
  onMove(move: [number, number]): void;
  onAttack(): void;
};

const countryColors: Record<CountryCode, { base: number; accent: number; band?: 'vertical' | 'horizontal' }> = {
  BR: { base: 0x159447, accent: 0xf6d447 }, PT: { base: 0x16814d, accent: 0xd63c42, band: 'vertical' },
  AR: { base: 0x75bdeb, accent: 0xffffff, band: 'horizontal' }, US: { base: 0xe9edf5, accent: 0xd94149, band: 'horizontal' },
  JP: { base: 0xf5f3ed, accent: 0xd83b45 }, DE: { base: 0x292c35, accent: 0xf0c64b, band: 'horizontal' },
  FR: { base: 0xf4f4f1, accent: 0x315bb2, band: 'vertical' }, IT: { base: 0xf4f4f1, accent: 0x168b51, band: 'vertical' },
};

export class ArenaScene extends Phaser.Scene {
  private snapshot: ArenaSnapshot | null = null;
  private roster = new Map<string, CloudRosterEntry>();
  private readonly balls = new Map<string, Phaser.GameObjects.Container>();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<'up' | 'down' | 'left' | 'right' | 'attack', Phaser.Input.Keyboard.Key> | undefined;
  private lastMove: [number, number] = [0, 0];
  private lastSentAt = 0;
  private initialized = false;

  constructor(private readonly localPlayerId: string, private readonly controls: Controls) { super('arena'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#101a2d');
    this.add.rectangle(arenaRules.width / 2, arenaRules.height / 2, arenaRules.width - 28, arenaRules.height - 28, 0x172641)
      .setStrokeStyle(4, 0x3b82f6, 0.42);
    for (let x = 80; x < arenaRules.width; x += 80) this.add.line(0, 0, x, 16, x, arenaRules.height - 16, 0x8eb7ff, 0.055).setOrigin(0);
    for (let y = 80; y < arenaRules.height; y += 80) this.add.line(0, 0, 16, y, arenaRules.width - 16, y, 0x8eb7ff, 0.055).setOrigin(0);
    this.add.circle(arenaRules.width / 2, arenaRules.height / 2, 105).setStrokeStyle(3, 0x65d5ff, 0.18);
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', attack: 'SPACE' }) as typeof this.wasd;
    }
    this.initialized = true;
    if (this.snapshot) this.setSnapshot(this.snapshot);
  }

  override update(time: number): void {
    const keys = this.wasd;
    const left = this.cursors?.left.isDown || keys?.left.isDown;
    const right = this.cursors?.right.isDown || keys?.right.isDown;
    const up = this.cursors?.up.isDown || keys?.up.isDown;
    const down = this.cursors?.down.isDown || keys?.down.isDown;
    const x = Number(Boolean(right)) - Number(Boolean(left));
    const y = Number(Boolean(down)) - Number(Boolean(up));
    const length = Math.max(1, Math.hypot(x, y));
    const move: [number, number] = [x / length, y / length];
    if (time - this.lastSentAt >= 50 || move[0] !== this.lastMove[0] || move[1] !== this.lastMove[1]) {
      this.lastMove = move; this.lastSentAt = time; this.controls.onMove(move);
    }
    if ((this.cursors?.space && Phaser.Input.Keyboard.JustDown(this.cursors.space)) || (keys?.attack && Phaser.Input.Keyboard.JustDown(keys.attack))) this.controls.onAttack();
  }

  setSnapshot(snapshot: ArenaSnapshot): void {
    this.snapshot = snapshot;
    if (!this.initialized) return;
    const active = new Set<string>();
    for (const [id, x10, y10, hp, score, alive, ready, fallbackName] of snapshot.players) {
      active.add(id);
      const item = this.balls.get(id) ?? this.createBall(id, fallbackName);
      const targetX = x10 / 10; const targetY = y10 / 10;
      this.tweens.killTweensOf(item);
      if (item.x === 0 && item.y === 0) item.setPosition(targetX, targetY);
      else this.tweens.add({ targets: item, x: targetX, y: targetY, duration: 70, ease: 'Linear' });
      item.setAlpha(alive ? 1 : 0.3);
      const hpBar = item.getByName('hp') as Phaser.GameObjects.Rectangle;
      hpBar.setDisplaySize(42 * hp / arenaRules.maxHp, 4).setPosition(-21 + 21 * hp / arenaRules.maxHp, 31);
      const status = item.getByName('status') as Phaser.GameObjects.Text;
      status.setText(snapshot.phase === 'lobby' && ready ? '✓ pronto' : `${score} ponto${score === 1 ? '' : 's'}`);
    }
    for (const [id, item] of this.balls) if (!active.has(id)) { item.destroy(); this.balls.delete(id); }
  }

  setRoster(roster: CloudRosterEntry[]): void {
    this.roster = new Map(roster.map(player => [player.playerId, player]));
    if (this.snapshot) this.setSnapshot(this.snapshot);
  }

  private createBall(id: string, fallbackName: string): Phaser.GameObjects.Container {
    const roster = this.roster.get(id);
    const colors = countryColors[roster?.country ?? 'BR'];
    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 22, 48, 17, 0x000000, 0.28);
    const ball = this.add.circle(0, 0, 24, colors.base).setStrokeStyle(id === this.localPlayerId ? 5 : 3, id === this.localPlayerId ? 0x65d5ff : 0x0a0d14);
    if (colors.band === 'horizontal') container.add(this.add.rectangle(0, 0, 42, 10, colors.accent));
    if (colors.band === 'vertical') container.add(this.add.rectangle(0, 0, 12, 42, colors.accent));
    if (!colors.band) container.add(this.add.circle(0, 2, roster?.country === 'JP' ? 9 : 12, colors.accent));
    const eyeLeft = this.add.ellipse(-7, -7, 5, 8, 0xffffff).setStrokeStyle(1, 0x111827);
    const eyeRight = this.add.ellipse(7, -7, 5, 8, 0xffffff).setStrokeStyle(1, 0x111827);
    const name = this.add.text(0, -40, roster?.name ?? fallbackName, { fontFamily: 'system-ui', fontSize: '14px', color: '#ffffff', stroke: '#0a1020', strokeThickness: 4 }).setOrigin(0.5);
    const hpBackground = this.add.rectangle(0, 31, 42, 4, 0x4b5563);
    const hpBar = this.add.rectangle(0, 31, 42, 4, 0x55e6a5).setName('hp');
    const status = this.add.text(0, 39, '', { fontFamily: 'system-ui', fontSize: '10px', color: '#c7d9ff' }).setOrigin(0.5).setName('status');
    container.addAt([shadow, ball], 0); container.add([eyeLeft, eyeRight, name, hpBackground, hpBar, status]);
    this.balls.set(id, container);
    return container;
  }
}
