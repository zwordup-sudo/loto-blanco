import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createPosition, getLegalMoves, getLegalTurns, applyMove, validateGame, getRepetitionClaim, claimRepetition, offerDraw, respondDraw, resign } from '../src/engine.js';

const position = (pieces, turn = 'red') => {
  const board = Array(64).fill(null);
  for (const [square, color, king = false] of pieces) board[square] = { color, king };
  return createPosition(board, turn);
};
const move = (state, from, to) => applyMove(state, { from, to });

test('inicio: 12 fichas por lado, sale terracota y hay siete avances legales', () => {
  const s = createGame();
  assert.equal(s.board.filter(p => p?.color === 'red').length, 12);
  assert.equal(s.board.filter(p => p?.color === 'white').length, 12);
  assert.equal(s.turn, 'red');
  assert.equal(getLegalMoves(s).length, 7);
});

test('captura global obligatoria aunque otra ficha pueda avanzar', () => {
  const s = position([[17, 'red'], [21, 'red'], [26, 'white'], [62, 'white']]);
  assert.deepEqual(getLegalMoves(s), [{ from: 17, to: 35, captured: 26 }]);
  assert.throws(() => move(s, 21, 28), /ilegal/);
});

test('puede elegir rutas de distinta longitud; no se exige la captura máxima', () => {
  const fork = position([[19, 'red'], [26, 'white'], [28, 'white'], [42, 'white'], [62, 'white']]);
  const turns = getLegalTurns(fork);
  assert.deepEqual(turns.map(t => t.map(m => m.to)), [[33, 51], [37]]);
  assert.equal(move(fork, 19, 37).turn, 'white');
});

test('cadena: retiene turno y ficha, permite bifurcación y rechaza cambiar de ficha', () => {
  let s = position([[17, 'red'], [23, 'red'], [26, 'white'], [42, 'white'], [44, 'white'], [62, 'white']]);
  s = move(s, 17, 35);
  assert.equal(s.turn, 'red');
  assert.equal(s.forced, 35);
  assert.deepEqual(getLegalMoves(s).map(m => m.to), [49, 53]);
  assert.equal(s.history.length, 0);
  assert.throws(() => move(s, 23, 30), /ilegal/);
  s = move(s, 35, 53);
  assert.equal(s.turn, 'white');
  assert.equal(s.forced, null);
  assert.deepEqual(s.history[0].path, [17, 35, 53]);
  assert.equal(s.board[26], null);
  assert.equal(s.board[44], null);
});

test('coronar saltando termina el turno aunque la nueva dama pueda capturar hacia atrás', () => {
  const s = position([[40, 'red'], [49, 'white'], [51, 'white'], [7, 'white', true]]);
  const next = move(s, 40, 58);
  assert.equal(next.board[58].king, true);
  assert.equal(next.turn, 'white');
  assert.equal(next.forced, null);
  assert.equal(next.board[51].color, 'white');
  assert.equal(next.history[0].promoted, true);
});

test('coronación por avance, peones solo hacia delante y damas cortas hacia atrás', () => {
  const s = position([[49, 'red'], [7, 'white', true]]);
  assert.equal(move(s, 49, 56).board[56].king, true);
  const man = position([[35, 'red'], [26, 'white'], [7, 'white', true]]);
  assert.ok(getLegalMoves(man).every(m => m.to > m.from));
  const king = position([[35, 'red', true], [26, 'white'], [7, 'white', true]]);
  assert.deepEqual(getLegalMoves(king), [{ from: 35, to: 17, captured: 26 }]);
  assert.throws(() => move(king, 35, 8), /ilegal/);
});

test('victoria por bloqueo con fichas rivales todavía en el tablero', () => {
  const s = position([[8, 'white'], [1, 'red'], [21, 'red']]);
  const next = move(s, 21, 28);
  assert.deepEqual(next.result, { type: 'win', winner: 'red', reason: 'blocked' });
  assert.equal(getLegalMoves(next).length, 0);
});

test('victoria al capturar la última ficha y no permite continuar', () => {
  const next = move(position([[17, 'red'], [26, 'white']]), 17, 35);
  assert.equal(next.result.reason, 'captured');
  assert.equal(next.result.winner, 'red');
  assert.throws(() => move(next, 35, 42), /ilegal/);
});

test('una dama puede completar un circuito sin saltar dos veces la misma ficha', () => {
  let s = position([[19, 'red', true], [26, 'white'], [42, 'white'], [44, 'white'], [28, 'white']]);
  for (const [from, to] of [[19, 33], [33, 51], [51, 37], [37, 19]]) s = move(s, from, to);
  assert.deepEqual(s.history[0].captures, [26, 42, 44, 28]);
  assert.equal(s.board[19].king, true);
  assert.equal(s.result.reason, 'captured');
});

test('tablas por triple repetición con mismo jugador al turno; reclamación anticipada', () => {
  let s = position([[1, 'red', true], [62, 'white', true]]);
  const cycle = [[1, 8], [62, 55], [8, 1], [55, 62]];
  for (const [from, to] of [...cycle, ...cycle.slice(0, 3)]) s = move(s, from, to);
  assert.equal(s.result, null);
  const witness = getRepetitionClaim(s);
  assert.deepEqual(witness.map(m => m.to), [62]);
  assert.equal(claimRepetition(s).result.reason, 'repetition');
  assert.equal(move(s, 55, 62).result.reason, 'repetition');
});

test('40 movimientos por jugador: 80 medios turnos sin capturas ni avance de peones', () => {
  const s = position([[1, 'red', true], [62, 'white', true]]);
  const before = move({ ...s, quietPly: 78 }, 1, 8);
  assert.equal(before.quietPly, 79);
  assert.equal(before.result, null);
  assert.equal(move(before, 62, 55).result.reason, 'forty-moves');
});

test('captura y cualquier avance de peón reinician el contador de tablas', () => {
  const man = position([[17, 'red'], [62, 'white', true]]);
  assert.equal(move({ ...man, quietPly: 79 }, 17, 24).quietPly, 0);
  const capture = position([[17, 'red', true], [26, 'white'], [62, 'white', true]]);
  assert.equal(move({ ...capture, quietPly: 79 }, 17, 35).quietPly, 0);
});

test('acuerdo requiere respuesta del rival, puede rechazarse; abandono', () => {
  const offered = offerDraw(createGame());
  assert.throws(() => respondDraw(offered, 'red', true), /inválida/);
  assert.equal(respondDraw(offered, 'white', false).result, null);
  assert.equal(respondDraw(offered, 'white', true).result.reason, 'agreement');
  assert.equal(resign(createGame()).result.winner, 'white');
  assert.throws(() => claimRepetition(createGame()), /repetición/);
});

test('validación sin navegador: registro legal, jugada ilegal y cadena incompleta', () => {
  assert.equal(validateGame([{ from: 17, to: 24 }]).valid, true);
  assert.equal(validateGame([{ from: 17, to: 0 }]).valid, false);
  const s = position([[17, 'red'], [26, 'white'], [44, 'white'], [62, 'white']]);
  assert.match(validateGame([{ from: 17, to: 35 }], s).error, /incompleta/);
  assert.equal(validateGame([{ from: 17, to: 35 }, { from: 35, to: 53 }], s).valid, true);
});

test('transiciones y consultas no mutan el estado inicial', () => {
  const s = createGame();
  const snapshot = JSON.stringify(s);
  getLegalTurns(s);
  move(s, 17, 24);
  assert.equal(JSON.stringify(s), snapshot);
});

test('constructor rechaza ficha en casilla clara y peón sin coronar en fila final', () => {
  assert.throws(() => position([[0, 'red']]), /inválida/);
  assert.throws(() => position([[56, 'red']]), /inválida/);
});

test('una partida determinista legal termina y cada posición conserva sus invariantes', () => {
  let s = createGame(), seed = 412;
  for (let i = 0; i < 1200 && !s.result; i++) {
    const legal = getLegalMoves(s);
    assert.ok(legal.length);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const next = applyMove(s, legal[seed % legal.length]);
    assert.ok(next.board.filter(Boolean).length <= s.board.filter(Boolean).length);
    assert.equal(next.board.filter(Boolean).length, s.board.filter(Boolean).length - (legal[seed % legal.length].captured !== null ? 1 : 0));
    s = next;
  }
  assert.ok(s.result, 'La partida debe terminar');
});
