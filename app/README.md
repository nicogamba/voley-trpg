# ZONA 3

Vóley táctico por turnos, mobile-first y jugable en el navegador. Un set a 7, 4v4 y resolución determinista: no hay dados, el puzzle es posicional.

## Estado

- Fases 1-4 del roadmap completadas: motor, tablero, IA, partido completo, tutorial, sonido y animaciones.
- 49 tests en verde y build de producción sin errores.
- Pendiente: playtest con 5 personas y deploy en Vercel.

## Cómo jugar

1. Elegí **Tutorial** en la portada para aprender el loop en 2 rallies.
2. **Saque:** tocá una zona del campo rival. El preview muestra la calidad de recepción que conseguís.
3. **Recepción:** elegí quién recibe. Moverse a la celda exacta del balón da +1; un pase perfecto devuelve 1 AP.
4. **Armado:** elegí tempo (Alto, Rápido o Espalda) y atacante.
5. **Lectura defensiva:** mové bloqueadores dentro de su fila y confirmá con **Listo**.
6. **Remate:** elegí tipo y zona. El preview muestra `A` (ataque), `B` (bloqueo) y `D` (defensa) antes de confirmar.
7. El ganador del rally saca el siguiente. A 7 puntos.

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
npm test        # tests del motor y de la UI
npm run build   # tsc -b && vite build
npm run lint    # oxlint
npm run preview # sirve dist/
```

## Estructura

```
app/
  src/engine/     motor puro: reglas, geometría, resolución, reducer, IA, simulador
  src/game/       store de Zustand, tablero, tutorial y sonido
  src/App.tsx     pantalla de juego, paneles y previews
  tests/          tests del motor, comandos, simulación y render
gdd_v1.1.md      GDD v1.2: diseño, fórmulas, roadmap y resultados de simulación
hoja_de_numeros.md  fuente de verdad de las fórmulas y tablas de balance
playtest.md      guion, planilla y métricas para el playtest de 5 personas
```

## Simulación

La simulación IA vs IA vive en `src/engine/simulate.ts` y se valida desde `tests/simulate.test.ts`:

- 100 partidos a 7 con el primer saque alternado.
- Win rate 51/49, 9.8 rallies por partido y 39.2% de ataques con bloqueador delante.
- La resolución es determinista; el RNG con semilla solo desempata decisiones de la IA.

## Deploy en Vercel

1. Importá el repositorio en Vercel.
2. Configurá **Root Directory** en `app`.
3. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.

## Próximos pasos

- Playtest de 5 personas con el guion y la planilla de `playtest.md`.
- Evaluar v1.3 de la finta (costo en AP o calidad del dig capada) si el playtest confirma que domina.
- Sprites pixel art y arte de fondo después de validar el loop con placeholders geométricos.
