import './style.css';
import { createGame, getLegalMoves, applyMove, notation, row, col, playable, opponent, getRepetitionClaim, claimRepetition, offerDraw, respondDraw, resign } from './engine.js';

const lotus = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 36C10 28 17 15 24 8c7 7 14 20 0 28Z"/><path d="M24 36C10 37 5 27 6 19c10 0 18 7 18 17Zm0 0c14 1 19-9 18-17-10 0-18 7-18 17Z"/><path d="M12 40h24"/></svg>`;
const icons = {
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  flip: '<path d="m7 3-4 4 4 4M3 7h14m0 14 4-4-4-4m4 4H7"/>',
  book: '<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  flag: '<path d="M5 22V3c6-4 9 4 15 0v10c-6 4-9-4-15 0"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  crown: '<path d="m3 6 4 3 5-5 5 5 4-3-2 12H5L3 6Zm2 15h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const colorName = (c) => c === 'red' ? 'Terracota' : 'Marfil';
let game = createGame();
let selected = null;
let flipped = true; // Terracotta, the first player, sits nearest the device.
let gameNumber = 1;
let focused = 17;
let activeTab = 'moves';
let dialogAction = null;
const player = (color) => `Jugador ${color === 'red' ? (gameNumber % 2 ? 1 : 2) : (gameNumber % 2 ? 2 : 1)}`;
const rules = `<div class="rules-content"><p>Dos colores. Un objetivo: dejar al rival sin jugadas.</p><ol><li><strong>Avanza en diagonal.</strong> Los peones avanzan una casilla hacia el lado contrario. Las damas también pueden retroceder, siempre una casilla.</li><li><strong>Si puedes capturar, debes hacerlo.</strong> Salta sobre una ficha rival a la casilla vacía siguiente. Puedes elegir cualquier ruta, no solo la más larga.</li><li><strong>Completa todos tus saltos.</strong> Continúa con la misma ficha mientras haya capturas. Los destinos se iluminan en el tablero.</li><li><strong>Llega al otro extremo.</strong> Tu peón se convierte en dama. Si coronas saltando, tu turno termina ahí.</li><li><strong>Gana por captura o bloqueo.</strong> También puedes acordar tablas o abandonar.</li></ol><h4>¿Cuándo son tablas?</h4><p>Por acuerdo, triple repetición de posición con el mismo turno, o 40 movimientos de cada jugador sin capturas ni avance de peones. La mesa declara automáticamente las dos últimas al cumplirse; también permite reclamar una triple repetición demostrable con la próxima jugada.</p><a href="https://wcdf.net/rules/rules_of_checkers_english.pdf" target="_blank" rel="noopener noreferrer">Consultar reglamento WCDF ${icon('arrow')}</a></div>`;

document.querySelector('#app').innerHTML = `
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="./" aria-label="Loto Blanco, inicio">${lotus}<span>LOTO BLANCO<small>CLUB DE JUEGOS DE MESA</small></span></a>
    <nav aria-label="Club"><span class="nav-current">La mesa</span><button class="nav-button" id="guide">El reglamento ${icon('book')}</button></nav>
    <span class="local-badge"><span></span> Sin conexión entre jugadores</span>
  </div></header>
  <main>
    <div class="breadcrumb">EL CLUB <span>/</span> LA MESA <span>/</span> <strong>DAMAS INGLESAS</strong></div>
    <section class="page-heading"><div><div class="eyebrow"><span></span> CLÁSICOS QUE NOS REÚNEN</div><h1>Una buena partida<br class="mobile-break"> empieza aquí<span>.</span></h1><p>Frente a frente. Sin prisa. Que hable el tablero.</p></div><div class="edition"><span>MESA</span><strong>01</strong><span>ABIERTA PARA DOS</span></div></section>
    <div class="table-layout">
      <section class="table-card" aria-label="Mesa de damas inglesas">
        <div class="table-title"><div><span class="table-symbol">${icon('crown')}</span><h2>Damas inglesas <span>8 × 8</span></h2></div><span class="mode-tag">${icon('people')} Partida local</span></div>
        <div class="board-area">
          <div class="player-bar" id="far-player"></div>
          <div class="board-frame"><div class="coordinate-top" aria-hidden="true"></div><div class="coordinate-side" aria-hidden="true"></div><div id="board" role="grid" aria-label="Tablero de damas, ocho filas y ocho columnas" aria-describedby="board-help"></div><span class="board-signature" aria-hidden="true">LOTO BLANCO · EST. 2026</span></div>
          <div class="player-bar" id="near-player"></div>
        </div>
        <div class="board-toolbar"><span><i class="legal-dot"></i> Destinos legales</span><button id="flip" title="Girar tablero">${icon('flip')} Girar tablero</button></div>
      </section>
      <aside class="sidebar" aria-label="Estado y controles de partida">
        <section class="status-card"><div class="card-eyebrow">LA PARTIDA <span id="game-counter">N.º 01</span></div><div id="turn-status" role="status" aria-live="polite" aria-atomic="true"></div><div class="turn-help" id="board-help"></div><div class="game-facts"><div><span>Modalidad</span><strong>Dos jugadores</strong></div><div><span>Reglamento</span><strong>WCDF <span class="tiny-check">${icon('check')}</span></strong></div></div><button class="primary-button" id="new-game">${icon('reset')} Nueva partida</button><div class="secondary-actions"><button id="draw">Ofrecer tablas</button><span></span><button id="resign">Abandonar</button></div><button class="claim-button" id="claim" hidden>Reclamar triple repetición ${icon('arrow')}</button></section>
        <section class="journal-card"><div class="tabs" role="tablist" aria-label="Información de la mesa"><button id="moves-tab" role="tab" aria-selected="true" aria-controls="journal">Jugadas <span id="move-count">0</span></button><button id="rules-tab" role="tab" aria-selected="false" aria-controls="journal">Cómo jugar</button></div><div id="journal" role="tabpanel" aria-labelledby="moves-tab"></div></section>
        <div class="club-note">${lotus}<div><strong>El placer está en la partida.</strong><p>Comparte la mesa. Respeta al rival.<br>Siempre hay una próxima jugada.</p></div></div>
      </aside>
    </div>
    <div class="bottom-note"><span>${icon('info')} Una mesa compartida en este dispositivo. Sin cuentas ni conexión multijugador.</span><span>HECHO PARA JUGAR, JUNTOS.</span></div>
  </main>
  <footer><span>LOTO BLANCO <i>·</i> El club está en la mesa.</span><span>Damas inglesas / Colección de clásicos</span></footer>
  <dialog id="modal" aria-labelledby="modal-title"><form method="dialog"><button class="close-dialog" aria-label="Cerrar diálogo" value="cancel">×</button><div id="modal-icon">${lotus}</div><div class="eyebrow">LOTO BLANCO · LA MESA</div><h2 id="modal-title"></h2><div id="modal-body"></div><div class="dialog-actions"><button value="cancel" class="text-button" id="modal-cancel">Volver a la mesa</button><button value="confirm" class="primary-button" id="modal-confirm">Confirmar</button></div></form></dialog>
`;

const boardEl = document.querySelector('#board');
const modal = document.querySelector('#modal');

function resultText() {
  const reasons = { blocked: 'El rival no tiene movimientos legales.', captured: 'Todas las fichas rivales han sido capturadas.', resignation: 'El rival ha abandonado la partida.', repetition: 'Triple repetición de la misma posición y turno.', 'forty-moves': '40 movimientos de cada jugador sin capturas ni avance de peones.', agreement: 'Ambos jugadores han acordado las tablas.' };
  return { title: game.result.type === 'draw' ? 'Una partida en tablas.' : `Victoria de ${colorName(game.result.winner)}.`, description: reasons[game.result.reason] };
}

function playerBar(color) {
  const count = game.board.filter(p => p?.color === color).length;
  const kings = game.board.filter(p => p?.color === color && p.king).length;
  const active = !game.result && game.turn === color;
  return `<div class="player-identity"><span class="avatar ${color}">${icon('crown')}</span><div><strong>${player(color)} <span class="player-color">/ ${colorName(color)}</span></strong><small>${kings ? `${kings} ${kings === 1 ? 'dama' : 'damas'} en juego` : color === 'red' ? 'Terracota abre la partida' : 'El otro lado de la mesa'}</small></div></div><div class="player-details"><span class="piece-count"><i class="mini-piece ${color}"></i><b>${count}</b><span> fichas</span></span><span class="player-indicator ${active ? 'active' : ''}">${active ? 'TU TURNO' : game.result ? 'FIN' : 'EN ESPERA'}</span></div>`;
}

function renderBoard() {
  const moves = getLegalMoves(game);
  const destinations = moves.filter(m => m.from === selected).map(m => m.to);
  const last = game.pending?.path || game.history.at(-1)?.path || [];
  const cells = Array.from({ length: 64 }, (_, i) => flipped ? 63 - i : i);
  boardEl.innerHTML = Array.from({ length: 8 }, (_, r) => `<div role="row">${cells.slice(r * 8, r * 8 + 8).map(i => {
    const p = game.board[i];
    const legal = destinations.includes(i);
    const isSelected = selected === i;
    const canSelect = moves.some(m => m.from === i);
    const label = `${String.fromCharCode(97 + col(i))}${8 - row(i)}${p ? `, ${p.king ? 'dama' : 'peón'} ${colorName(p.color)}` : ', vacía'}${legal ? ', destino legal' : ''}${isSelected ? ', seleccionada' : ''}`;
    return `<button role="gridcell" class="square ${playable(i) ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${legal ? 'destination' : ''} ${last.includes(i) ? 'last-move' : ''} ${canSelect ? 'selectable' : ''}" data-square="${i}" tabindex="${i === focused ? 0 : -1}" aria-label="${label}" aria-selected="${isSelected}" ${!playable(i) ? 'aria-disabled="true"' : ''}>${p ? `<span class="piece ${p.color} ${p.king ? 'king' : ''}"><span>${p.king ? icon('crown') : ''}</span></span>` : ''}${legal ? '<span class="destination-mark"></span>' : ''}</button>`;
  }).join('')}</div>`).join('');
  document.querySelector('.coordinate-top').innerHTML = (flipped ? 'hgfedcba' : 'abcdefgh').split('').map(c => `<span>${c}</span>`).join('');
  document.querySelector('.coordinate-side').innerHTML = (flipped ? '12345678' : '87654321').split('').map(c => `<span>${c}</span>`).join('');
  document.querySelector('#far-player').innerHTML = playerBar(flipped ? 'white' : 'red');
  document.querySelector('#near-player').innerHTML = playerBar(flipped ? 'red' : 'white');
}

function renderJournal() {
  const el = document.querySelector('#journal');
  document.querySelector('#moves-tab').setAttribute('aria-selected', String(activeTab === 'moves'));
  document.querySelector('#rules-tab').setAttribute('aria-selected', String(activeTab === 'rules'));
  el.setAttribute('aria-labelledby', activeTab === 'moves' ? 'moves-tab' : 'rules-tab');
  document.querySelector('#move-count').textContent = game.history.length;
  if (activeTab === 'rules') { el.innerHTML = rules; return; }
  if (!game.history.length) {
    el.innerHTML = `<div class="empty-journal"><div class="stacked-pieces"><i></i><i></i></div><strong>Todo está por jugar.</strong><p>El primer movimiento es de Terracota.<br>La historia de la partida aparecerá aquí.</p><span>32 CASILLAS. INFINITAS POSIBILIDADES.</span></div>`;
    return;
  }
  const text = (entry) => entry ? `${entry.path.map(notation).join(entry.captures.length ? ' × ' : ' – ')}${entry.promoted ? ' ♛' : ''}` : '—';
  el.innerHTML = `<div class="history-heading"><span>#</span><span><i class="mini-piece red"></i> Terracota</span><span><i class="mini-piece white"></i> Marfil</span></div><ol class="history-list">${Array.from({ length: Math.ceil(game.history.length / 2) }, (_, i) => `<li><span>${i + 1}.</span><span>${text(game.history[i * 2])}</span><span>${text(game.history[i * 2 + 1])}</span></li>`).join('')}</ol><div class="notation-note">Notación WCDF · × captura · ♛ coronación</div>`;
  el.querySelector('.history-list').scrollTop = 99999;
}

function render() {
  renderBoard();
  const moves = getLegalMoves(game);
  const capture = moves.some(m => m.captured !== null);
  document.querySelector('#turn-status').innerHTML = game.result
    ? `<div class="turn-caption">PARTIDA TERMINADA</div><h3 class="result-heading">${resultText().title}</h3>`
    : `<div class="turn-caption"><span class="live-dot"></span> TURNO DE ${player(game.turn).toUpperCase()}</div><h3><i class="status-piece ${game.turn}"></i>${colorName(game.turn)} ${icon('arrow')}</h3>`;
  document.querySelector('#board-help').innerHTML = game.result ? resultText().description : game.forced !== null
    ? `${icon('info')} <span><strong>Continúa la captura.</strong> La misma ficha debe completar sus saltos.</span>`
    : capture ? `${icon('info')} <span><strong>La captura es obligatoria.</strong> Elige una ficha que pueda saltar.</span>`
    : `${icon('info')} <span>${selected !== null ? 'Ahora elige uno de los destinos resaltados.' : 'Selecciona una de tus fichas para ver sus destinos legales.'}</span>`;
  document.querySelector('#game-counter').textContent = `N.º ${String(gameNumber).padStart(2, '0')}`;
  document.querySelector('#new-game').innerHTML = `${icon('reset')} ${game.result ? 'Jugar otra partida' : 'Nueva partida'}`;
  for (const id of ['draw', 'resign']) document.querySelector(`#${id}`).disabled = !!game.result || game.forced !== null;
  document.querySelector('#claim').hidden = !getRepetitionClaim(game);
  renderJournal();
}

function showDialog(title, body, confirm, action, cancel = 'Volver a la mesa') {
  document.querySelector('#modal-title').textContent = title;
  document.querySelector('#modal-body').innerHTML = body;
  document.querySelector('#modal-confirm').textContent = confirm || 'Entendido';
  document.querySelector('#modal-cancel').textContent = cancel;
  document.querySelector('#modal-cancel').hidden = !confirm;
  dialogAction = action;
  modal.returnValue = '';
  modal.showModal();
}

function newGame() {
  game = createGame();
  selected = null;
  focused = 17;
  gameNumber++;
  render();
}

function announceResult() {
  const result = resultText();
  showDialog(result.title, `<p>${result.description}</p><p class="dialog-subtle">Buena partida. Los jugadores intercambian colores en la próxima mesa.</p>`, 'Jugar otra partida', value => { if (value === 'confirm') newGame(); }, 'Ver el tablero');
}

boardEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-square]');
  if (!button || game.result || game.drawOffer) return;
  const square = Number(button.dataset.square);
  focused = square;
  const legal = getLegalMoves(game);
  const step = legal.find(m => m.from === selected && m.to === square);
  if (step) {
    game = applyMove(game, step);
    selected = game.forced;
    focused = game.forced ?? square;
  } else if (game.forced === null) {
    selected = legal.some(m => m.from === square) ? (selected === square ? null : square) : null;
  }
  render();
  boardEl.querySelector(`[data-square="${focused}"]`).focus({ preventScroll: true });
  if (game.result) announceResult();
});

boardEl.addEventListener('keydown', (event) => {
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[event.key];
  if (!delta && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const squares = [...boardEl.querySelectorAll('[data-square]')];
  const index = squares.indexOf(event.target);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 63 : Math.max(0, Math.min(63, index + delta));
  squares[index].tabIndex = -1;
  squares[next].tabIndex = 0;
  focused = Number(squares[next].dataset.square);
  squares[next].focus();
});

document.querySelector('#flip').addEventListener('click', () => { flipped = !flipped; renderBoard(); });
document.querySelector('#guide').addEventListener('click', () => showDialog('Lo esencial para jugar.', rules, null));
document.querySelector('#new-game').addEventListener('click', () => {
  if (game.result) { newGame(); return; }
  showDialog('¿Empezamos de nuevo?', '<p>La partida actual se perderá. El tablero vuelve a su posición inicial y los jugadores intercambian colores.</p>', 'Sí, nueva partida', value => { if (value === 'confirm') newGame(); });
});
document.querySelector('#draw').addEventListener('click', () => {
  game = offerDraw(game);
  const other = opponent(game.drawOffer);
  showDialog('¿Lo dejamos en tablas?', `<p><strong>${player(other)} · ${colorName(other)}</strong>, tu rival propone un empate. ¿Aceptas?</p>`, 'Aceptar tablas', value => {
    game = respondDraw(game, other, value === 'confirm');
    render();
    if (game.result) announceResult();
  }, 'Seguir jugando');
});
document.querySelector('#resign').addEventListener('click', () => showDialog('¿Abandonar la partida?', `<p>${colorName(opponent(game.turn))} ganará esta partida. Puedes volver a la mesa si prefieres continuar.</p>`, 'Sí, abandonar', value => {
  if (value === 'confirm') { game = resign(game); selected = null; render(); announceResult(); }
}));
document.querySelector('#claim').addEventListener('click', () => {
  game = claimRepetition(game);
  selected = null;
  render();
  announceResult();
});
document.querySelector('#moves-tab').addEventListener('click', () => { activeTab = 'moves'; renderJournal(); });
document.querySelector('#rules-tab').addEventListener('click', () => { activeTab = 'rules'; renderJournal(); });
document.querySelectorAll('[role="tab"]').forEach(tab => tab.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const other = document.querySelector(tab.id === 'moves-tab' ? '#rules-tab' : '#moves-tab');
    other.click(); other.focus();
  }
}));
modal.addEventListener('close', () => { const action = dialogAction; dialogAction = null; action?.(modal.returnValue); });
render();
