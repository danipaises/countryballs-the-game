import Phaser from 'phaser';
import { arenaRules } from '@countryballs/arena-2d';
import type { ArenaEvent, ArenaMapId, ArenaSnapshot } from '@countryballs/arena-2d';
import type { CloudRosterEntry, CountryCode } from '@countryballs/cloud-contracts';

type Controls = { onMove(move: [number, number]): void; onAttack(): void };
const frames: Record<CountryCode, number> = { BR: 0, PT: 1, AR: 2, US: 3, JP: 4, DE: 5, FR: 6, IT: 7 };
const backgrounds: Record<ArenaMapId, string> = { 'orbital-station': 'arena-orbital', 'tropical-island': 'arena-island', 'street-court': 'arena-street' };

export class ArenaScene extends Phaser.Scene {
  private snapshot: ArenaSnapshot | null = null;
  private roster = new Map<string, CloudRosterEntry>();
  private readonly balls = new Map<string, Phaser.GameObjects.Container>();
  private readonly backdrops = new Map<ArenaMapId, Phaser.GameObjects.Image>();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<'up' | 'down' | 'left' | 'right' | 'attack', Phaser.Input.Keyboard.Key> | undefined;
  private lastMove: [number, number] = [0, 0];
  private lastSentAt = 0;
  private initialized = false;

  constructor(private readonly localPlayerId: string, private readonly controls: Controls) { super('arena'); }
  preload(): void {
    this.load.image('arena-orbital', '/arenas/orbital.webp');
    this.load.image('arena-island', '/arenas/island.webp');
    this.load.image('arena-street', '/arenas/street.webp');
    this.load.spritesheet('countryballs', '/arenas/countryballs.png', { frameWidth: 384, frameHeight: 384 });
  }
  create(): void {
    for (const [id, key] of Object.entries(backgrounds) as [ArenaMapId, string][]) {
      const image = this.add.image(arenaRules.width / 2, arenaRules.height / 2, key).setDisplaySize(arenaRules.width, arenaRules.height).setDepth(-10);
      image.setVisible(id === 'orbital-station'); this.backdrops.set(id, image);
    }
    this.add.rectangle(arenaRules.width / 2, arenaRules.height / 2, arenaRules.width - 20, arenaRules.height - 20).setStrokeStyle(4, 0xb9eaff, 0.38).setDepth(-5);
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', attack: 'SPACE' }) as typeof this.wasd;
    }
    this.initialized = true; if (this.snapshot) this.setSnapshot(this.snapshot);
  }
  override update(time: number): void {
    const keys = this.wasd;
    const x = Number(Boolean(this.cursors?.right.isDown || keys?.right.isDown)) - Number(Boolean(this.cursors?.left.isDown || keys?.left.isDown));
    const y = Number(Boolean(this.cursors?.down.isDown || keys?.down.isDown)) - Number(Boolean(this.cursors?.up.isDown || keys?.up.isDown));
    const length = Math.max(1, Math.hypot(x, y)); const move: [number, number] = [x / length, y / length];
    if (time - this.lastSentAt >= 50 || move[0] !== this.lastMove[0] || move[1] !== this.lastMove[1]) { this.lastMove = move; this.lastSentAt = time; this.controls.onMove(move); }
    if ((this.cursors?.space && Phaser.Input.Keyboard.JustDown(this.cursors.space)) || (keys?.attack && Phaser.Input.Keyboard.JustDown(keys.attack))) this.controls.onAttack();
  }
  setSnapshot(snapshot: ArenaSnapshot): void {
    this.snapshot = snapshot; if (!this.initialized) return;
    for (const [id, image] of this.backdrops) image.setVisible(id === snapshot.arenaId);
    const active = new Set<string>();
    for (const [id, x10, y10, hp, score, alive, ready, fallbackName] of snapshot.players) {
      active.add(id); const item = this.balls.get(id) ?? this.createBall(id, fallbackName);
      const targetX = x10 / 10; const targetY = y10 / 10; this.tweens.killTweensOf(item);
      if (item.x === 0 && item.y === 0) item.setPosition(targetX, targetY); else this.tweens.add({ targets: item, x: targetX, y: targetY, duration: 72, ease: 'Linear' });
      item.setAlpha(alive ? 1 : 0.35).setScale(alive ? 1 : 0.84);
      const hpBar = item.getByName('hp') as Phaser.GameObjects.Rectangle;
      hpBar.setDisplaySize(78 * hp / arenaRules.maxHp, 8).setPosition(-39 + 39 * hp / arenaRules.maxHp, 65);
      (item.getByName('status') as Phaser.GameObjects.Text).setText(snapshot.phase === 'lobby' && ready ? 'PRONTO ✓' : `${score} ${score === 1 ? 'PONTO' : 'PONTOS'}`);
    }
    for (const [id, item] of this.balls) if (!active.has(id)) { item.destroy(); this.balls.delete(id); }
  }
  setRoster(roster: CloudRosterEntry[]): void {
    this.roster = new Map(roster.map(player => [player.playerId, player]));
    for (const [id, item] of this.balls) { const player = this.roster.get(id); if (!player) continue; (item.getByName('body') as Phaser.GameObjects.Image).setFrame(frames[player.country]); (item.getByName('name') as Phaser.GameObjects.Text).setText(player.name); }
  }
  handleEvent(event: ArenaEvent): void {
    if (event.type !== 'PLAYER_DAMAGED' || !event.targetId) return;
    const target = this.balls.get(event.targetId); if (!target) return;
    const flash = this.add.circle(target.x, target.y, 54, 0xffffff, 0.8).setDepth(10);
    this.tweens.add({ targets: flash, scale: 1.65, alpha: 0, duration: 230, onComplete: () => flash.destroy() }); this.cameras.main.shake(90, 0.005);
  }
  private createBall(id: string, fallbackName: string): Phaser.GameObjects.Container {
    const player = this.roster.get(id); const container = this.add.container(0, 0).setDepth(5); const local = id === this.localPlayerId;
    const ring = this.add.circle(0, 6, 54).setStrokeStyle(local ? 6 : 3, local ? 0x4de5ff : 0xffffff, local ? 0.95 : 0.22);
    const shadow = this.add.ellipse(0, 38, 88, 28, 0x000000, 0.32);
    const body = this.add.image(0, 0, 'countryballs', frames[player?.country ?? 'BR']).setDisplaySize(108, 108).setName('body');
    const name = this.add.text(0, -67, player?.name ?? fallbackName, { fontFamily: 'Arial Black, system-ui', fontSize: '18px', color: '#ffffff', stroke: '#06101f', strokeThickness: 6 }).setOrigin(0.5).setName('name');
    const hpBack = this.add.rectangle(0, 65, 82, 10, 0x07111e, 0.9).setStrokeStyle(2, 0xffffff, 0.5);
    const hp = this.add.rectangle(0, 65, 78, 8, 0x4df098).setName('hp');
    const status = this.add.text(0, 78, '', { fontFamily: 'Arial Black, system-ui', fontSize: '11px', color: '#dff8ff', stroke: '#07111e', strokeThickness: 4 }).setOrigin(0.5).setName('status');
    container.add([ring, shadow, body, name, hpBack, hp, status]); this.balls.set(id, container); return container;
  }
}
