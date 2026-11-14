# Loto Blanco — memoria del proyecto

Project ID: `loto-blanco`

## Estado
- Primera mesa local jugable completa, creada sobre carpeta vacía.
- Git inicializado en `main`; repositorio público creado por autorización expresa.
- GitHub: https://github.com/zwordup-sudo/loto-blanco (remoto `origin`).
- Sin cuentas de juego, IA, red multijugador ni despliegue de la aplicación.
- La partida vive en memoria; recargar/cerrar pierde el estado, documentado en README.

## Decisiones y motivo
- JavaScript ESM + Vite, sin framework ni dependencias de ejecución.
- Motor puro en `src/engine.js`: sin DOM, almacenamiento ni imports de interfaz.
- Transiciones inmutables; `applyMove` valida pasos contra obligaciones globales.
- `getLegalMoves` devuelve pasos; `getLegalTurns` enumera rutas completas.
- Cadenas retienen turno y ficha; solo al final se actualizan historial y repetición.
- WCDF 1.20 permite elegir cualquier ruta, no exige maximizar capturas.
- Coronar termina siempre el turno, incluso si una nueva dama podría seguir saltando.
- Tablas: acuerdo explícito, tercera posición con mismo turno o 80 medios turnos
  sin captura ni avance de peón; no basta con contar turnos sin coronación.
- Árbitro digital declara repetición/40 movimientos automáticamente al cumplirse.
- Reclamación anticipada de triple repetición comprueba una próxima ruta completa.
- Victoria por ausencia de movimientos se evalúa antes de tablas.
- Colores internos red/white; interfaz terracota/marfil. Terracota comienza.
- Jugador 1 empieza con terracota; al reiniciar se intercambian colores.
- Sin APIs globales de depuración: escenarios E2E se inyectan mediante rutas de prueba.
- `.engram/config.json` usa `project_name`, no `project`; fija el ID del proyecto.

## Evidencia (2026-11-14)
- Entorno: Node 24.14.1, npm 11.11.0; se exige Node >=22.12.
- Reglamento WCDF PDF consultado, sección 1 (1.13–1.21 y 1.29–1.32).
- Webfetch devolvió binario; extracción en memoria con pypdf y User-Agent Mozilla.
- `npm install`: correcto, 0 vulnerabilidades.
- `npm test`: 17/17 pasan, sin navegador.
- `npm run test:e2e`: 18/18 pasan en Chromium, móvil y escritorio.
- E2E incluye partida completa solo con clics legales, cadenas, coronación,
  bloqueo, tablas, teclado, giro, reinicio cancelable y revancha.
- `npm run build`: correcto; salida estática en dist/, sin despliegue.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Capturas móvil/escritorio revisadas; sin desbordamiento horizontal.
- Publicación: pruebas repetidas (17 motor, 18 E2E y build correctos).
- `.gitignore` excluye dependencias, dist, resultados, archivos .env y claves.
- Primer test unitario falló por fixtures con peones marfil en fila de coronación;
  se corrigieron las posiciones (damas o fila legal), no se relajó el motor.
- Primer E2E de teclado/reinicio falló por volver a tocar la ficha ya seleccionada;
  el test ahora verifica que selección persiste al girar/abrir ayuda y toca destino.

## Pendientes y límites
- Ningún pendiente dentro del alcance local autorizado.
- No se probó Safari, Firefox ni celulares físicos; móvil es emulación Chromium.
- Sin persistencia ni relojes; no simula sanciones administrativas de torneo.
- Ejecutar: `npm install` y `npm run dev`; ver README.md para pruebas y API.
