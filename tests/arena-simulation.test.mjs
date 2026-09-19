import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaSimulation, arenaRules } from '@countryballs/arena-2d';

const runtime = () => new ArenaSimulation({ matchId: 'match-test', tickRate: 30, seed: 1, random: () => 0.5 });

test('Arena só inicia quando pelo menos dois jogadores estão prontos', () => {
  const arena = runtime();
  arena.addPlayer('a', 'Brasil');
  arena.acceptCommand('a', 1, 'ready');
  arena.step(1, 1 / 30);
  assert.equal(arena.snapshot().phase, 'lobby');
  arena.addPlayer('b', 'Japão');
  arena.acceptCommand('b', 1, 'ready');
  assert.equal(arena.snapshot().phase, 'running');
});

test('servidor calcula movimento, dano, ponto e respawn', () => {
  const arena = runtime();
  arena.addPlayer('a', 'Brasil'); arena.addPlayer('b', 'Japão');
  arena.acceptCommand('a', 1, 'ready'); arena.acceptCommand('b', 1, 'ready');
  for (let tick = 1; tick <= 20; tick++) {
    arena.acceptInput('a', { move: [-0.53, 0.85] });
    arena.step(tick, 1 / 30);
  }
  arena.acceptInput('a', { move: [0, 0] });
  arena.acceptCommand('a', 20, 'attack');
  for (const tick of [35, 50, 65]) {
    arena.step(tick, 1 / 30);
    arena.acceptCommand('a', tick, 'attack');
  }
  const defeated = arena.snapshot().players.find(player => player[0] === 'b');
  const attacker = arena.snapshot().players.find(player => player[0] === 'a');
  assert.equal(defeated?.[3], 0);
  assert.equal(defeated?.[5], 0);
  assert.equal(attacker?.[4], 1);
  const respawnTick = 65 + Math.ceil(arenaRules.respawnMs / 1000 * 30);
  arena.step(respawnTick, 1 / 30);
  const respawned = arena.snapshot().players.find(player => player[0] === 'b');
  assert.equal(respawned?.[3], arenaRules.maxHp);
  assert.equal(respawned?.[5], 1);
});

test('Arena encerra com segurança quando resta menos de dois jogadores', () => {
  const arena = runtime();
  arena.addPlayer('a', 'Brasil'); arena.addPlayer('b', 'Japão');
  arena.acceptCommand('a', 1, 'ready'); arena.acceptCommand('b', 1, 'ready');
  arena.removePlayer('b');
  assert.equal(arena.snapshot().phase, 'ended');
  assert.equal(arena.snapshot().winnerId, 'a');
});
