import { test, expect } from '@playwright/test';

const cell = (page, square) => page.locator(`[data-square="${square}"]`);
async function step(page, from, to) {
  await cell(page, from).click();
  await cell(page, to).click();
}

// Fixture injection only at the test server boundary. No debug APIs in the shipped application.
async function scenario(page, pieces, options = {}) {
  const board = Array(64).fill(null);
  for (const [i, color, king = false] of pieces) board[i] = { color, king };
  await page.route('**/src/main.js', async route => {
    const response = await route.fetch();
    let source = await response.text();
    source = source.replace('import { createGame,', 'import { createPosition, createGame,');
    source = source.replace('let game = createGame();', `let game = { ...createPosition(${JSON.stringify(board)}, '${options.turn || 'red'}'), quietPly: ${options.quietPly || 0} };`);
    await route.fulfill({ response, body: source });
  });
  await page.goto('/');
}

test('mesa inicial, destinos, movimiento, registro y sin desbordamiento', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#board .piece')).toHaveCount(24);
  await expect(page.locator('#turn-status')).toContainText('Terracota');
  await cell(page, 17).click();
  await expect(page.locator('.destination')).toHaveCount(2);
  await cell(page, 24).click();
  await expect(page.locator('#turn-status')).toContainText('Marfil');
  await expect(page.locator('.history-list')).toContainText('9 – 13');
  await expect(cell(page, 24).locator('.piece.red')).toHaveCount(1);
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noOverflow).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('mesa.png'), fullPage: true });
});

test('captura obligatoria global y bifurcación con selección retenida', async ({ page }) => {
  await scenario(page, [[17, 'red'], [23, 'red'], [26, 'white'], [42, 'white'], [44, 'white'], [62, 'white']]);
  await cell(page, 23).click();
  await expect(page.locator('.destination')).toHaveCount(0);
  await expect(page.locator('#board-help')).toContainText('captura es obligatoria');
  await step(page, 17, 35);
  await expect(cell(page, 35)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.destination')).toHaveCount(2);
  await expect(cell(page, 49)).toHaveClass(/destination/);
  await expect(cell(page, 53)).toHaveClass(/destination/);
  await expect(page.locator('#turn-status')).toContainText('Terracota');
  await cell(page, 23).click();
  await expect(cell(page, 35)).toHaveAttribute('aria-selected', 'true');
  await cell(page, 53).click();
  await expect(page.locator('#turn-status')).toContainText('Marfil');
  await expect(page.locator('#board .piece.white')).toHaveCount(2);
  await expect(page.locator('.history-list')).toContainText('9 × 18 × 27');
});

test('coronación durante captura termina turno sin salto hacia atrás', async ({ page }) => {
  await scenario(page, [[40, 'red'], [49, 'white'], [51, 'white'], [7, 'white', true]]);
  await step(page, 40, 58);
  await expect(cell(page, 58).locator('.king.red')).toHaveCount(1);
  await expect(page.locator('#turn-status')).toContainText('Marfil');
  await expect(cell(page, 51).locator('.piece.white')).toHaveCount(1);
  await expect(page.locator('.destination')).toHaveCount(0);
});

test('victoria por bloqueo, resultado y revancha sin salir de la mesa', async ({ page }) => {
  await scenario(page, [[8, 'white'], [1, 'red'], [21, 'red']]);
  await step(page, 21, 28);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#modal-title')).toHaveText('Victoria de Terracota.');
  await expect(page.locator('#modal-body')).toContainText('no tiene movimientos legales');
  await page.locator('#modal-confirm').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#board .piece')).toHaveCount(24);
  await expect(page.locator('#turn-status')).toContainText('JUGADOR 2');
  await expect(page.locator('#game-counter')).toHaveText('N.º 02');
});

test('tablas por triple repetición anunciada', async ({ page }) => {
  await scenario(page, [[1, 'red', true], [62, 'white', true]]);
  const moves = [[1, 8], [62, 55], [8, 1], [55, 62], [1, 8], [62, 55], [8, 1]];
  for (const [from, to] of moves) await step(page, from, to);
  await expect(page.locator('#claim')).toBeVisible();
  await page.locator('#claim').click();
  await expect(page.locator('#modal-title')).toHaveText('Una partida en tablas.');
  await expect(page.locator('#modal-body')).toContainText('Triple repetición');
});

test('tablas a los 40 movimientos de cada jugador', async ({ page }) => {
  await scenario(page, [[1, 'red', true], [62, 'white', true]], { quietPly: 79 });
  await step(page, 1, 8);
  await expect(page.locator('#modal-title')).toHaveText('Una partida en tablas.');
  await expect(page.locator('#modal-body')).toContainText('40 movimientos');
});

test('acuerdo: rechazo, cierre con Escape y aceptación explícita del rival', async ({ page }) => {
  await page.goto('/');
  await page.locator('#draw').click();
  await expect(page.locator('#modal-body')).toContainText('Jugador 2 · Marfil');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#turn-status')).toContainText('Terracota');
  await page.locator('#draw').click();
  await page.locator('#modal-cancel').click();
  await page.locator('#draw').click();
  await page.locator('#modal-confirm').click();
  await expect(page.locator('#modal-title')).toHaveText('Una partida en tablas.');
  await expect(page.locator('#modal-body')).toContainText('acordado');
});

test('teclado, giro, reglamento y reinicio cancelable', async ({ page }) => {
  await page.goto('/');
  await cell(page, 17).focus();
  await page.keyboard.press('Enter');
  await expect(cell(page, 17)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(cell(page, 18)).toBeFocused();
  await page.locator('#flip').click();
  await expect(page.locator('[data-square]').first()).toHaveAttribute('data-square', '0');
  await page.locator('#rules-tab').click();
  await expect(page.locator('#journal')).toContainText('Si puedes capturar');
  await page.locator('#guide').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // The selection made with Enter survives board rotation and opening the rules.
  await expect(cell(page, 17)).toHaveAttribute('aria-selected', 'true');
  await cell(page, 24).click();
  await page.locator('#new-game').click();
  await page.locator('#modal-cancel').click();
  await expect(cell(page, 24).locator('.piece')).toHaveCount(1);
  await page.locator('#new-game').click();
  await page.locator('#modal-confirm').click();
  await expect(cell(page, 17).locator('.piece')).toHaveCount(1);
  await expect(cell(page, 24).locator('.piece')).toHaveCount(0);
});

test('partida completa solo con clics legales', async ({ page }) => {
  await page.goto('/');
  // Reduces UI wait overhead without bypassing user interaction or engine validation.
  let seed = 412;
  for (let i = 0; i < 700; i++) {
    if (await page.getByRole('dialog').isVisible()) break;
    const starts = await page.locator('.square.selectable').evaluateAll(els => els.map(el => el.dataset.square));
    expect(starts.length).toBeGreaterThan(0);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const selected = page.locator('.square.selected');
    if (!await selected.count()) await cell(page, starts[seed % starts.length]).click();
    const destinations = await page.locator('.destination').evaluateAll(els => els.map(el => el.dataset.square));
    expect(destinations.length).toBeGreaterThan(0);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    await cell(page, destinations[seed % destinations.length]).click();
  }
  await expect(page.locator('#modal-title')).toHaveText(/Victoria|tablas/);
  await expect(page.locator('#turn-status')).toContainText('PARTIDA TERMINADA');
});
