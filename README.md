# Loto Blanco · La primera mesa

Mesa de **damas inglesas 8 × 8 para dos personas en el mismo dispositivo**, de principio a fin. Verde pino, casillas crema y fichas mate en marfil y terracota. Diseñada para celular; también funciona con ratón y teclado en escritorio.

## Ejecutar

Requiere **Node.js 22.12 o posterior** y npm. Verificado con Node 24.14.1.

```sh
npm install
npm run dev
```

Abre **http://127.0.0.1:5173**. Ambos jugadores usan esa misma mesa. No necesita cuentas, servicios externos, fuentes remotas ni conexión multijugador. La instalación inicial de dependencias sí necesita Internet.

```sh
npm run build
npm run preview
```

`build` genera `dist/`; `preview` permite revisar esa compilación en **http://127.0.0.1:4173**. No es un despliegue.

## Jugar

1. Terracota abre la partida. En la primera partida corresponde al Jugador 1.
2. Toca una ficha tuya que pueda jugar; sus destinos aparecen como círculos claros.
3. Toca el destino para mover. Si alguna ficha puede capturar, quedan prohibidos todos los avances normales.
4. Durante una captura múltiple la ficha permanece seleccionada: elige uno de sus siguientes destinos. No puedes cambiar de ficha ni interrumpir la cadena.
5. Una corona identifica las damas. Coronar saltando finaliza inmediatamente el turno.
6. La mesa anuncia victoria o tablas y ofrece otra partida. Los jugadores intercambian colores al reiniciar. Reiniciar una partida en curso pide confirmación.

**Girar tablero** cambia la orientación, no los turnos. El historial usa numeración WCDF 1–32: `–` avance, `×` captura, `♛` coronación. **Cómo jugar** y **Reglas** contienen la ayuda.

**Teclado:** Tab entra al tablero; las flechas recorren casillas, Inicio/Fin van a los extremos, Enter/Espacio seleccionan o mueven. Escape cierra diálogos sin confirmar una acción. Hay foco visible, nombres de casilla, selección accesible y anuncio del turno.

## Reglamento aplicado

Referencia: [WCDF, Rules of Draughts (Checkers), sección 1](https://wcdf.net/rules/rules_of_checkers_english.pdf).

- **1.13–1.21:** empieza rojo/terracota; peones avanzan y capturan solo hacia delante; damas cortas en ambas direcciones; captura global obligatoria; se admite cualquier ruta, no necesariamente la más larga; cadenas completas con la misma ficha; la coronación termina el turno incluso durante una captura.
- **1.30–1.31:** gana quien deja al rival sin fichas o sin movimientos. También se admite abandono confirmado.
- **1.32:** tablas por acuerdo explícito de ambos jugadores, triple repetición con el mismo turno y 40 movimientos propios de cada jugador sin capturas ni avance de peones (80 medios turnos consecutivos). Cualquier avance de peón o captura reinicia ese contador, no solo una coronación.
- **Árbitro digital:** la mesa declara automáticamente tablas al producirse la tercera repetición o alcanzarse los 80 medios turnos. Además muestra **Reclamar triple repetición** si se puede demostrar que una próxima jugada completa generaría la tercera posición (1.32.1); el motor comprueba una ruta legal como prueba. No se cuentan posiciones intermedias de una cadena como turnos.
- Los movimientos ilegales se impiden; no se simulan sanciones de torneo por tocar fichas. No hay reloj, árbitro humano ni reglas administrativas de torneos.

## Probar

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm test` ejecuta el motor con `node:test`, sin DOM, servidor ni navegador. `test:e2e` inicia y detiene automáticamente Vite y prueba con Chromium en celular (390 × 664, perfil iPhone 13) y escritorio (1440 × 1100). La emulación móvil no implica pruebas en Safari ni en hardware real.

Cobertura:
- Captura obligatoria aunque otra ficha pueda avanzar.
- Rutas de distinta longitud y bifurcaciones durante una cadena.
- Selección retenida, continuación forzada y prohibición de cambiar de ficha.
- Coronación por salto que impide continuar hacia atrás.
- Damas cortas, captura hacia atrás y circuitos sin capturar dos veces la misma ficha.
- Victoria por bloqueo y por última captura.
- Tablas por acuerdo (aceptación, rechazo, Escape), repetición y 40 movimientos de cada jugador.
- Validación de registros, estados inmutables y cadenas incompletas.
- Teclado, giro, reinicio cancelable, resultado y revancha.
- Una partida completa de principio a fin mediante clics legales en cada tamaño.
- Ausencia de errores JavaScript iniciales y de desbordamiento horizontal.

Las pruebas E2E guardan `mesa.png` en `test-results/`; si hay fallos, conservan trazas para `npx playwright show-trace <ruta>/trace.zip`. Los escenarios especiales se inyectan solo en las respuestas del servidor de pruebas: la aplicación no publica controles de depuración ni permite editar su posición.

## Motor independiente

```js
import { createGame, getLegalMoves, applyMove, validateGame } from './src/engine.js';

const initial = createGame();
const legal = getLegalMoves(initial);
const next = applyMove(initial, legal[0]); // No modifica initial.
console.log(next.turn);

const record = validateGame([{ from: 17, to: 24 }]);
console.log(record.valid); // true
```

- Casillas internas: `fila * 8 + columna`, de 0 a 63; fila 0 arriba. Juegan las casillas con suma fila + columna impar. Terracota avanza hacia fila 7; marfil hacia fila 0.
- `getLegalMoves(state)` devuelve **pasos** `{ from, to, captured }`; durante una cadena devuelve solo las continuaciones obligatorias.
- `getLegalTurns(state)` enumera **rutas de un turno completo**. `applyMove` valida cada paso e ignora metadatos de captura aportados por el llamador.
- `validateGame(steps, initial?)` reproduce un registro, devuelve `{ valid, state }` o `{ valid: false, error }` y rechaza cadenas incompletas. Un registro válido puede terminar en una posición en curso; `state.result` indica si la partida concluyó.
- `createPosition(board, turn?)` permite construir escenarios válidos en Node. Las piezas son `{ color: 'red' | 'white', king: boolean }`, y las casillas vacías `null`.
- `offerDraw`, `respondDraw`, `getRepetitionClaim`, `claimRepetition` y `resign` resuelven los finales no asociados a un paso del tablero.

## Archivos y límites

```text
src/engine.js          Reglas puras, transiciones y validación
src/main.js            Interacción local, selección, diálogos e historial
src/style.css          Diseño adaptable y piezas sin imágenes externas
tests/engine.test.js   Pruebas de reglas sin navegador
tests/e2e/             Pruebas de interacción de la mesa
playwright.config.js  Perfiles móvil/escritorio y servidor de pruebas
```

La partida vive en memoria: **recargar o cerrar la página pierde la partida**. Esta entrega no incluye persistencia, IA, cuentas, juego por red ni despliegue.
