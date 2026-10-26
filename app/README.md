# ZONA 3

Vóley táctico por turnos, mobile-first y jugable en el navegador. Un set a 7,
4v4 y resolución determinista: no hay dados. La tensión está en leer la jugada
rival y comprometerse antes de ver el resultado.

## Estado

- **v1.3 “Duelo oculto”**: motor reescrito, UI Tecmo, cut-in a pantalla completa
  y tutorial nuevo.
- **v1.3.1 “Claridad”**: cut-in en dos tiempos con botón explícito, resultado
  bloqueado 700 ms y franja **ÚLTIMA** para releer la jugada.
- **v1.3.2 “Ritmo”**: los turnos de la IA (saque, recepción y armado rival)
  esperan **CONTINUAR** y narran el último movimiento.
- 70 tests en verde, `tsc -b`, `oxlint` y build de producción sin errores.
- Balance simulado con 500 partidos IA vs IA (ver más abajo).
- Pendiente: playtest con 5 personas y deploy en Vercel.

## Cómo jugar

1. Elegí **Tutorial** en la portada para aprender el loop en 2 rallies.
2. **Saque:** tocá una zona del campo rival. No hay preview: buscás dónde el
   rival recibe peor.
3. **Recepción:** elegí quién recibe. La celda exacta da +1 y un pase perfecto
   devuelve 1 de energía.
4. **Armado:** elegí armador y atacante. El líbero puede armar sin penalización.
5. **Duelo oculto:** si atacás, el rival ya eligió un esquema defensivo
   (Muro, Bloqueo abierto, Defensa profunda o Líbero atento). Si defendés, el
   rival ya eligió ataque y zona. Solo ves 1 o 2 pistas según tu Lectura.
6. **Tu elección:** ataque + zona, o esquema defensivo. Después, cut-in.
7. **Turno rival:** el saque, la recepción y el armado de la IA se leen en un
   cartel con **CONTINUAR**. La IA nunca avanza sola.
8. **Cut-in:** primero ves la jugada (ataque, zona y esquema); después, con
   **VER EL RESULTADO**, el desenlace: **punto**, **bloqueo** o **dig**. Se
   cierra con **CONTINUAR** y la franja **ÚLTIMA** te deja releerlo.
9. El ganador del rally saca el siguiente. A 7 puntos.

No hay `undo`: cuando ves el cut-in, la jugada ya ocurrió.

### Ataques

| Ataque | Costo | Zona / condición |
|---|---|---|
| Potencia | 2 | Cualquiera |
| Colocación | 0 | Cualquiera; +2 en esquinas |
| Rápido | 0 | Solo el central, por la columna 1; ignora la posición del defensor |
| Pipe | 3 | Solo el opuesto desde el fondo |
| Wipe | 2 | Cualquiera |
| Finta | 0 | Solo al fondo; +2 en esquinas |

### Esquemas defensivos

| Esquema | Frena | Sufre |
|---|---|---|
| Muro | Potencia, Rápido | Pipe, Wipe, Finta |
| Bloqueo abierto | Colocación, Wipe, Finta | Potencia, Rápido |
| Defensa profunda | Potencia, Pipe, Wipe | Colocación, Finta |
| Líbero atento | Colocación, Finta | Potencia, Rápido, Pipe |

La energía arranca en 2, tiene tope 3 y un pase perfecto devuelve +1. No se
acumula entre rallies: es un portón, no una moneda.

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + Zustand + Vitest.

## Desarrollo

```bash
cd app
npm install
npm run dev
```

El servidor queda en `http://127.0.0.1:5173/` (o el siguiente puerto libre).

```bash
npm test        # 70 tests: motor, comandos, store, simulación y render
npm run build   # tsc -b && vite build
npm run lint    # oxlint
npm run preview # sirve dist/
```

## Estructura

```
app/
  src/engine/     motor puro: tipos, reglas, geometría, resolución, reducer, IA, simulador
  src/game/       store de Zustand, tablero, menús, cut-in, tutorial, retratos y sonido
  src/App.tsx     layout vertical, HUD y orquestación de fases
  tests/          tests del motor, comandos, store, simulación y render
gdd_v1.3.md          GDD vigente: diseño, fórmulas, IA, métricas y riesgos
hoja_de_numeros.md   fuente de verdad de las fórmulas y tablas de balance v1.3
gdd_v1.1.md          GDD v1.2 histórico (movimiento y preview A/B/D)
playtest.md          guion, planilla y métricas para el playtest de 5 personas
```

## Simulación

La simulación IA vs IA vive en `src/engine/simulate.ts` y se valida desde
`tests/simulate.test.ts`:

- 500 partidos a 7 con el primer saque alternado.
- Win rate 49.4% / 50.6%, 12.0 rallies por partido y 1.24 ataques por rally.
- Pases perfectos 7.5%, bloqueos 20.6%, digs 19.1%, puntos de ataque 60.3%.
- Los 6 ataques y los 4 esquemas aparecen en la muestra.
- La resolución es determinista; el RNG con semilla solo varía decisiones de la
  IA y desempates.

Para ver el reporte completo:

```bash
npx vitest run tests/simulate.test.ts --silent=false
```

## Deploy en Vercel

1. Importá el repositorio en Vercel.
2. Configurá **Root Directory** en `app`.
3. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.

## Próximos pasos

- Playtest de 5 personas con el guion y la planilla de `playtest.md`.
- Ajustar una sola palanca por iteración con la simulación de 500 partidos.
- Sprites pixel art y arte de fondo después de validar el loop con placeholders
  geométricos.
