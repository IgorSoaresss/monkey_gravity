import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/dados-fases.js';
import { Fase, Jogo, Porta, SistemaPontuacao } from '../js/modelos.js';

const names = { blue: 'Lia', red: 'Caio' };

test('a dupla começa em gravidades opostas e salta contra a própria gravidade', () => {
  const scoring = new SistemaPontuacao();
  const phase = new Fase(LEVELS[0], names, scoring);
  const [blue, red] = phase.players;
  assert.equal(blue.gravity, 1);
  assert.equal(red.gravity, -1);
  assert.equal(phase.jump('blue'), true);
  assert.equal(blue.vy, -520);
  assert.equal(red.vy, 0);
});

test('uma interação inverte ambos e respeita a recarga global entre terminais', () => {
  const data = { ...LEVELS[2], terminals: [{ id: 'a', x: 300, radius: 70 }, { id: 'b', x: 900, radius: 70 }] };
  const phase = new Fase(data, names, new SistemaPontuacao());
  const blue = phase.players[0];
  blue.x = 286;
  blue.grounded = true;
  assert.equal(phase.interact('blue'), true);
  assert.deepEqual(phase.players.map((player) => player.gravity), [-1, 1]);
  blue.x = 886;
  blue.grounded = true;
  phase.elapsed = .4;
  assert.equal(phase.interact('blue'), false);
  phase.elapsed = .81;
  assert.equal(phase.interact('blue'), true);
  assert.deepEqual(phase.players.map((player) => player.gravity), [1, -1]);
});

test('reutilizar um terminal inverte a gravidade, mas não repete seus pontos', () => {
  const phase = new Fase(LEVELS[2], names, new SistemaPontuacao());
  const blue = phase.players[0];
  blue.x = 626;
  blue.grounded = true;
  assert.equal(phase.interact('blue'), true);
  phase.elapsed = .81;
  blue.grounded = true;
  assert.equal(phase.interact('blue'), true);
  assert.equal(blue.gravity, 1);
  assert.equal(phase.scoring.provisional.blue, 10);
});

test('porta aguarda o vão ficar livre antes de fechar', () => {
  const door = new Porta({ id: 'gate', x: 500, w: 42, surface: 'floor', plates: ['switch'], latchWhen: 'blue' });
  const player = { id: 'blue', x: 505, y: 600, w: 30, h: 38 };
  door.update([], [player]);
  assert.equal(door.open, true);
  player.x = 700;
  door.update([], [player]);
  assert.equal(door.open, false);
});

test('reiniciar a tentativa remove pontos provisórios sem apagar o total', () => {
  const scoring = new SistemaPontuacao();
  scoring.totals.blue = 20;
  scoring.add('blue', 10, true);
  const game = new Jogo(LEVELS, names, scoring);
  game.restart();
  assert.equal(scoring.getScore('blue'), 20);
  assert.equal(scoring.provisional.red, 0);
});

test('bônus de conclusão só é consolidado uma vez por fase na sessão', () => {
  const scoring = new SistemaPontuacao();
  scoring.add('blue', 10, true);
  const first = scoring.complete(1);
  const replay = scoring.complete(1);
  assert.deepEqual(first, { blue: 110, red: 100, repeated: false });
  assert.deepEqual(replay, { blue: 0, red: 0, repeated: true });
  assert.equal(scoring.totals.blue + scoring.totals.red, 210);
});

test('campo elétrico invalida a tentativa antes de avaliar uma saída', () => {
  const phase = new Fase(LEVELS[0], names, new SistemaPontuacao());
  phase.hazards.push({ id: 'test-arc', x: 100, y: 600, w: 50, h: 50 });
  phase.step(0, { blue: { left: false, right: false }, red: { left: false, right: false } });
  assert.equal(phase.failed, true);
  assert.equal(phase.completed, false);
});