import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { arenaRules } from '@countryballs/arena-2d';
import type { ArenaSnapshot } from '@countryballs/arena-2d';
import type { CloudRosterEntry } from '@countryballs/cloud-contracts';
import { MatchClient } from './match-client.js';
import { ArenaScene } from './game/ArenaScene.js';

type Props = { client: MatchClient; snapshot: ArenaSnapshot | null; roster: CloudRosterEntry[] };
export function ArenaGame({ client, snapshot, roster }: Props) {
  const mount = useRef<HTMLDivElement>(null); const scene = useRef<ArenaScene | null>(null); const tick = useRef(0);
  const touchMove = useRef<[number, number]>([0, 0]); const stick = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const arena = new ArenaScene(client.admission.playerId, { onMove: move => client.sendInput(touchMove.current[0] || touchMove.current[1] ? touchMove.current : move, ++tick.current), onAttack: () => client.command('attack') });
    scene.current = arena;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: mount.current, width: arenaRules.width, height: arenaRules.height, scene: arena, backgroundColor: '#07111f', render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
    const unsubscribe = client.subscribe(event => { if (event.type === 'game-event') arena.handleEvent(event.event); });
    return () => { unsubscribe(); scene.current = null; game.destroy(true); };
  }, [client]);
  useEffect(() => { if (snapshot) scene.current?.setSnapshot(snapshot); }, [snapshot]);
  useEffect(() => scene.current?.setRoster(roster), [roster]);
  const moveStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect(); const dx = event.clientX - (box.left + box.width / 2); const dy = event.clientY - (box.top + box.height / 2); const max = box.width * .31; const distance = Math.hypot(dx, dy); const scale = distance > max ? max / distance : 1;
    const x = dx * scale; const y = dy * scale; if (stick.current) stick.current.style.transform = `translate(${x}px,${y}px)`;
    const length = Math.max(1, Math.hypot(dx, dy)); touchMove.current = [dx / length, dy / length]; client.sendInput(touchMove.current, ++tick.current);
  };
  const stopStick = () => { touchMove.current = [0, 0]; if (stick.current) stick.current.style.transform = 'translate(0,0)'; client.sendInput([0, 0], ++tick.current); };
  return <div className="arena-shell"><div className="arena-canvas" ref={mount} aria-label="Arena 2D" /><div className="touch-controls" aria-label="Controles de toque">
    <div className="joystick" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStick(event); }} onPointerUp={stopStick} onPointerCancel={stopStick}><span ref={stick} /></div>
    <button className="attack-button" onPointerDown={() => client.command('attack')} aria-label="Atacar"><i>⚡</i><b>ATACAR</b></button>
  </div></div>;
}
