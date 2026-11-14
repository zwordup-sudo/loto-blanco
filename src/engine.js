/** English draughts, WCDF section 1. Pure, immutable transitions; squares 0..63.
 * Terracotta (red) starts in rows 0..2 and moves toward row 7. */
export const RED = 'red';
export const WHITE = 'white';
export const opponent = (color) => color === RED ? WHITE : RED;
export const row = (square) => Math.floor(square / 8);
export const col = (square) => square % 8;
export const playable = (square) => Number.isInteger(square) && square >= 0 && square < 64 && (row(square) + col(square)) % 2 === 1;
export const notation = (square) => row(square) * 4 + Math.floor(col(square) / 2) + 1;
const key = (state) => `${state.turn}:${state.board.map(p => p ? (p.color === RED ? 'r' : 'w') + (p.king ? 'K' : 'm') : '.').join('')}`;
const directions = (piece) => piece.king ? [-1, 1] : [piece.color === RED ? 1 : -1];
const crownRow = (piece, square) => !piece.king && row(square) === (piece.color === RED ? 7 : 0);

/** Validated position constructor, also useful to host custom scenarios outside a browser. */
export function createPosition(board, turn = RED) {
  if (!Array.isArray(board) || board.length !== 64 || ![RED, WHITE].includes(turn)) throw new Error('Posición inválida');
  const copy = Array.from(board, (p, i) => {
    if (!p) return null;
    if (!playable(i) || ![RED, WHITE].includes(p.color) || typeof p.king !== 'boolean' || crownRow(p, i)) throw new Error('Ficha inválida');
    return { color: p.color, king: p.king };
  });
  const state = { board: copy, turn, forced: null, pending: null, quietPly: 0, ply: 0, history: [], repetitions: {}, result: null, drawOffer: null };
  state.repetitions[key(state)] = 1;
  if (!rawLegalMoves(state).length) state.result = { type: 'win', winner: opponent(turn), reason: 'blocked' };
  return state;
}

export function createGame() {
  return createPosition(Array.from({ length: 64 }, (_, i) => playable(i) && (row(i) < 3 || row(i) > 4)
    ? { color: row(i) < 3 ? RED : WHITE, king: false } : null));
}

function pieceMoves(state, from, capture) {
  const p = state.board[from];
  if (!p || p.color !== state.turn) return [];
  const moves = [];
  for (const dr of directions(p)) for (const dc of [-1, 1]) {
    const distance = capture ? 2 : 1;
    const r = row(from) + dr * distance, c = col(from) + dc * distance;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const to = r * 8 + c;
    if (state.board[to]) continue;
    const over = (row(from) + dr) * 8 + col(from) + dc;
    if (capture && (!state.board[over] || state.board[over].color === p.color)) continue;
    moves.push({ from, to, captured: capture ? over : null });
  }
  return moves;
}

function rawLegalMoves(state) {
  if (state.forced !== null) return pieceMoves(state, state.forced, true);
  const starts = state.board.flatMap((p, i) => p?.color === state.turn ? [i] : []);
  const jumps = starts.flatMap(i => pieceMoves(state, i, true));
  return jumps.length ? jumps : starts.flatMap(i => pieceMoves(state, i, false));
}

/** Legal next steps. During a chain only the same piece may continue. */
export function getLegalMoves(state) {
  return state.result ? [] : rawLegalMoves(state);
}

/** Validate a step against all pieces' capture obligations, never trusting caller metadata. */
export function applyMove(state, requested) {
  const move = getLegalMoves(state).find(m => m.from === requested?.from && m.to === requested?.to);
  if (!move) throw new Error('Jugada ilegal');
  const piece = state.board[move.from];
  const promoted = crownRow(piece, move.to);
  const board = state.board.map(p => p ? { ...p } : null);
  board[move.from] = null;
  board[move.to] = { ...piece, king: piece.king || promoted };
  if (move.captured !== null) board[move.captured] = null;
  const pending = state.pending
    ? { ...state.pending, path: [...state.pending.path, move.to], captures: [...state.pending.captures, move.captured] }
    : { color: state.turn, path: [move.from, move.to], captures: move.captured === null ? [] : [move.captured], man: !piece.king };
  let next = { ...state, board, pending, drawOffer: null };
  if (move.captured !== null && !promoted && pieceMoves(next, move.to, true).length) {
    return { ...next, forced: move.to };
  }
  next = {
    ...next, turn: opponent(state.turn), forced: null, pending: null, ply: state.ply + 1,
    quietPly: pending.man || pending.captures.length ? 0 : state.quietPly + 1,
    history: [...state.history, { color: pending.color, path: pending.path, captures: pending.captures, promoted }],
    repetitions: { ...state.repetitions },
  };
  const position = key(next);
  next.repetitions[position] = (next.repetitions[position] || 0) + 1;
  // The player who made the last legal move wins, before considering a draw.
  if (!rawLegalMoves(next).length) {
    next.result = { type: 'win', winner: state.turn, reason: board.some(p => p?.color === next.turn) ? 'blocked' : 'captured' };
  } else if (next.repetitions[position] >= 3) {
    next.result = { type: 'draw', reason: 'repetition' };
  } else if (next.quietPly >= 80) {
    next.result = { type: 'draw', reason: 'forty-moves' };
  }
  return next;
}

/** Enumerates complete turn paths, including all alternative capture branches (no longest-route rule). */
export function getLegalTurns(state) {
  const turns = [];
  function visit(current, path) {
    for (const move of getLegalMoves(current)) {
      const next = applyMove(current, move);
      const branch = [...path, move];
      if (next.forced === null) turns.push(branch);
      else visit(next, branch);
    }
  }
  visit(state, []);
  return turns;
}

/** WCDF 1.32.1: prove that an announced next turn would create the third occurrence. */
export function getRepetitionClaim(state) {
  if (state.result || state.forced !== null) return null;
  return getLegalTurns(state).find(moves => moves.reduce(applyMove, state).result?.reason === 'repetition') || null;
}

export function claimRepetition(state) {
  const witness = getRepetitionClaim(state);
  if (!witness) throw new Error('No hay triple repetición demostrable');
  return { ...state, result: { type: 'draw', reason: 'repetition', announced: witness.map(m => m.to) }, drawOffer: null };
}

export function offerDraw(state) {
  if (state.result || state.forced !== null || state.drawOffer) throw new Error('No se pueden ofrecer tablas ahora');
  return { ...state, drawOffer: state.turn };
}

export function respondDraw(state, player, accept) {
  if (!state.drawOffer || player !== opponent(state.drawOffer) || state.result) throw new Error('Respuesta de tablas inválida');
  return { ...state, drawOffer: null, result: accept ? { type: 'draw', reason: 'agreement' } : null };
}

export function resign(state) {
  if (state.result || state.forced !== null) throw new Error('No se puede abandonar ahora');
  return { ...state, result: { type: 'win', winner: opponent(state.turn), reason: 'resignation' }, drawOffer: null };
}

/** Replay and validate a complete record of steps, including unfinished jump-chain rejection. */
export function validateGame(moves, initial = createGame()) {
  try {
    if (!Array.isArray(moves)) throw new Error('Registro inválido');
    const state = moves.reduce(applyMove, initial);
    if (state.forced !== null) throw new Error('Cadena de captura incompleta');
    return { valid: true, state };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
