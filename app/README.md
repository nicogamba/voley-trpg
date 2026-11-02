# ZONA 3

Vóley táctico por turnos, mobile-first y jugable en el navegador. Un set
decisivo a 25, 6v6 y resolución determinista: no hay dados. La tensión está en
leer la jugada rival y comprometerse antes de ver el resultado.

## Estado

- **v1.3 “Duelo oculto”**: motor reescrito, UI Tecmo, cut-in a pantalla completa
  y tutorial nuevo.
- **v1.3.1 “Claridad”**: cut-in en dos tiempos con botón explícito, resultado
  bloqueado 700 ms y franja **ÚLTIMA** para releer la jugada.
- **v1.3.2 “Ritmo”**: los turnos de la IA (saque, recepción y armado rival)
  esperan **CONTINUAR** y narran el último movimiento.
- **S1 “Shell CT1” (demo)**: pantalla partida, comando → cuadro de acción →
  relato → resultado. Set a 25 desde 17-19, motor **6v6** con rotación
  side-out y líbero en zaga.
- 149 tests en verde, `tsc -b`, `oxlint` y build de producción sin errores.
- Balance simulado con 500 partidos IA vs IA (ver más abajo).
- Pendiente: playtest con 5 personas y deploy en Vercel.

## Demo CT1 (S1)

La maqueta de sensación estilo Captain Tsubasa 1 vive en
`src/presentation/`. Se entra desde la portada con **CT1 · DEMO DE SENSACIÓN**
o agregando `?ct1=1` a la URL.

- Pantalla partida: acción arriba, relator y comandos abajo.
- El jugador elige un comando y después ve la jugada; el resultado aparece en
  el cuadro siguiente.
- La campaña recorre las **5 etapas** de la escalera; cada una arranca en su
  marcador inicial (18-18, 17-18, 17-19, 16-19, 16-20), con **saque local** y
  previa de Nando. La demo rápida `?ct1=1` juega la final desde 16-20.
- **Saque por destino:** zona 1, 5, 6 o corto. El riesgo de red/afuera sale de
  los stats del sacador y del destino.
- **Recepción:** perfecta, buena, exigida, dig, cayó en un compañero, free ball,
  red o afuera.
- **Free ball:** el rival recibe con calidad 3 y arma cómodo para atacar.
- **Armado CT1:** el armador elige al atacante y el lado (por 2 o por 4). El
  menú de ataque muestra solo los golpes de ese atacante; la pelota viaja a su
  celda y la imagen previa refleja el lado elegido. Si hace falta, corre a la
  pelota para no fallar el armado por distancia.
- **Saque y cobertura:** el plano se espeja según saca el local o la visita.
  El líbero puede cubrir la zona 1 y una recepción mala tiene una chance de
  salvada según lectura y velocidad. Un ace se cierra con la pelota en el piso.
- **Tensión 0-100:** reemplaza la energía AP en CT1. Paga potencia, wipe y
  pipe; sube con buenas recepciones y puntos.
- **Stats debajo del retrato:** TEC, POT, VEL y LEC en la tarjeta del jugador.
- El texto del relator se escribe solo. Si ya terminó, un toque avanza; si
  todavía está escribiendo, el primer toque lo completa y el segundo avanza.
- Los cuadros y el relator ya usan el arte generado; las técnicas especiales
  siguen pendientes.

El motor ya es **6v6 con rotación**, saque local, tensión y campaña de 5
etapas. También puede fallar el ataque (afuera o a la red). Falta arte final,
relator contextual, playtest y deploy.

### Arte de acción

Los 4 rostros de `art-source/principal/portraits.jpeg` ya están asignados a las
4 clases en `tools/prepare-sprites.py`: setter, opposite, middle y libero.
Para las poses de acción se genera una imagen por **clase + pose**, no por
jugador, con el kit cromático que usa el resto del arte:

- camiseta magenta, short cian, vivos amarillos;
- el líbero invierte camiseta y vivos;
- fondo de estadio oscuro, sin verdes ni luces magenta/cian/amarillas;
- pelota blanca/gris.

Después se recolorean todos los equipos con:

```bash
python3 tools/prepare-action.py --team arg --team bra
```

La entrada va en `art-source/actions/<clase>/<pose>.png` y la salida en
`app/src/assets/action/<equipo>/<clase>-<pose>.png`, a 720×640. El script
cuantiza la imagen, reemplaza solo los colores del kit y conserva piel, pelo,
pelota, fondo y sombreado.

Los **planos compartidos** (sin equipo) se preparan con:

```bash
python3 tools/prepare-shots.py
```

Toma los planos de `art-source/principal/` (saque, listo para sacar, justo
antes del ataque, duelo, bloqueo, recepción, armado, error de armado, pelota
en el aire, dig, punto, error, free ball, festejo, derrota y ataque por 2 /
por 4), los recorta a 1.125:1 y los deja en `app/src/assets/action/shared/`.
La pantalla CT1 usa esos planos en las decisiones y en la acción. La cancha ya
no aparece en el modo CT1.

Los retratos propios de cada equipo salen de las sheets:

```bash
python3 tools/prepare-portraits.py
```

Deja 6 retratos por equipo en
`app/src/assets/sprites/portraits/teams/`. El `CommandBox` los usa cuando
conoce el equipo del jugador.

El relator se recorta con:

```bash
python3 tools/prepare-nando.py
```

Deja las 5 expresiones en `app/src/assets/sprites/commentator/` y el
`CommentBox` las usa según la línea de Nando.

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
npm test        # 149 tests: motor, comandos, store, simulación, escenas y render
npm run build   # tsc -b && vite build
npm run lint    # oxlint
npm run preview # sirve dist/
```

## Estructura

```
app/
  src/engine/        motor puro: tipos, reglas, geometría, resolución, reducer, IA, simulador
  src/game/          store de Zustand, tablero, menús, cut-in, tutorial, retratos y sonido
  src/court/         cancha v2: motor de partido, escalera, sprites y coreografía
  src/presentation/  shell CT1: escenas, cuadros de acción, relator y comandos
  src/App.tsx        layout vertical, HUD y orquestación de fases
  tests/             tests del motor, comandos, store, simulación, escenas y render
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

- **S3:** arte final, relator contextual, intro/cierre de partido y QA en
  360×640 / 390×844.
- Playtest de 5 personas con el guion y la planilla de `playtest.md`.
- Ajustar una sola palanca por iteración con la simulación de 500 partidos.
- Sprites pixel art y arte de fondo después de validar el loop con placeholders
  geométricos.
