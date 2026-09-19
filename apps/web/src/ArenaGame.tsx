import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { ArenaSnapshot } from '@countryballs/arena-2d';
import type { CloudRosterEntry } from '@countryballs/cloud-contracts';
import { MatchClient } from './match-client.js';
import { ArenaScene } from './game/ArenaScene.js';

type Props = { client: MatchClient; snapshot: ArenaSnapshot | null; roster: CloudRosterEntry[] };

export function ArenaGame({ client, snapshot, roster }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<ArenaScene | null>(null);
  const tick = useRef(0);
  const touchMove = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    if (!mount.current) return;
    const arena = new ArenaScene(client.admission.playerId, {
      onMove: move => client.sendInput(touchMove.current[0] || touchMove.current[1] ? touchMove.current : move, ++tick.current),
      onAttack: () => client.command('attack'),
    });
    scene.current = arena;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: 960, height: 640, scene: arena,
      backgroundColor: '#101a2d', render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    return () => { scene.current = null; game.destroy(true); };
  }, [client]);

  useEffect(() => { if (snapshot) scene.current?.setSnapshot(snapshot); }, [snapshot]);
  useEffect(() => scene.current?.setRoster(roster), [roster]);

  const press = (move: [number, number]) => (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId); touchMove.current = move;
    client.sendInput(move, ++tick.current);
  };
  const release = () => { touchMove.current = [0, 0]; client.sendInput([0, 0], ++tick.current); };

  return <div className="arena-shell">
    <div className="arena-canvas" ref={mount} aria-label="Arena 2D" />
    <div className="touch-controls" aria-label="Controles de toque">
      <div className="dpad">
        <button className="up" onPointerDown={press([0, -1])} onPointerUp={release} onPointerCancel={release} aria-label="Mover para cima">▲</button>
        <button className="left" onPointerDown={press([-1, 0])} onPointerUp={release} onPointerCancel={release} aria-label="Mover para esquerda">◀</button>
        <button className="down" onPointerDown={press([0, 1])} onPointerUp={release} onPointerCancel={release} aria-label="Mover para baixo">▼</button>
        <button className="right" onPointerDown={press([1, 0])} onPointerUp={release} onPointerCancel={release} aria-label="Mover para direita">▶</button>
      </div>
      <button className="attack-button" onPointerDown={() => client.command('attack')}>ATACAR</button>
    </div>
  </div>;
}
