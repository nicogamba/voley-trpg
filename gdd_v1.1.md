# ZONA 3 — GDD v1.2

**Vóley táctico por turnos · Prototipo web mobile-first**

> Documento de diseño vivo. Reemplaza conceptualmente a `game_design_document.md`, que queda como referencia de la primera idea. Las fórmulas están alineadas con `hoja_de_numeros.md` v1.2 y se validan con simulación.

| Campo | Valor |
|---|---|
| Versión | 1.2 — balance validado con simulación |
| Fecha | 26 de octubre de 2026 |
| Estado | Fases 1-4 jugables en navegador; falta playtest |
| Plataforma | Navegador. Mobile-first vertical (9:16). Desktop centrado. |
| Stack | Vite + React + TypeScript + Tailwind + Zustand + Vitest |
| Nombre provisional | ZONA 3 |

## Índice

0. Resumen ejecutivo
1. Visión y fantasía
2. Pilares de diseño
3. Reglas de vóley: qué respetamos
4. Tablero y geometría
5. Equipos, formación y roles
6. Stats y clases
7. Economía de acciones (AP)
8. Flujo de un rally
9. Resolución determinista
10. Acciones, ataques y habilidades
11. Máquina de estados
12. IA
13. Partido y puntuación
14. UI/UX mobile-first
15. Dirección de arte
16. Arquitectura técnica
17. Roadmap
18. Métricas de playtest
19. Riesgos y mitigaciones
20. Fuera de alcance (MVP)
21. Glosario
22. Registro de decisiones
23. Preguntas abiertas

---

## 0. Resumen ejecutivo

**ZONA 3** es un RPG táctico de vóley por turnos para navegador. El jugador controla un equipo de cuatro —armador, central, opuesto y líbero— en un tablero de **3 columnas x 2 filas por lado**. Cada rally es un puzzle determinista: leer el saque rival, construir un pase de calidad, elegir el armado y superar el bloqueo. No hay reflejos ni dados ocultos: hay información visible, **3 AP por posesión** y decisiones posicionales. Partidas de 5-8 minutos, un set a 7 puntos, estética anime escolar en pixel art.

La referencia mental es **Into the Breach + Haikyuu**: la claridad y el determinismo del primero, la fantasía de equipo y el rally del segundo.

---

## 1. Visión y fantasía

**Fantasía central:** “Leo la jugada antes de que pase.”

El jugador no gana por reflejos ni por fuerza bruta, sino por **leer** al rival, **posicionar** a su equipo y **encadenar** tres toques de calidad. La recompensa emocional es el rally construido: pase perfecto → armado rápido → remate a la zona que el bloqueo dejó libre.

**Promesa de diseño:**
- Cada toque importa.
- El jugador siente que construye la jugada, no que elige de un menú.
- Perder se siente justo: la información estaba visible.
- Una partida entra en una sesión corta de mobile.

**Anti-fantasía:**
- No es un juego de reflejos ni de timing.
- No es un gacha ni un manager.
- No es un simulador realista de 6v6.
- No es un juego de azar disfrazado de táctica.

**Público:** jugadores casuales de tácticas, fans del vóley y del anime deportivo, gente que juega en el celular en sesiones de 5-10 minutos.

---

## 2. Pilares de diseño

1. **Cadena de calidad.** Recepción → armado → remate. Cada eslabón condiciona al siguiente. Un pase perfecto abre opciones que un pase malo no permite.
2. **Información perfecta, decisiones imperfectas.** Todo el estado relevante es visible: posiciones, stats, bloqueo, probabilidades. El reto es decidir, no adivinar.
3. **Pocas acciones, gran impacto.** 3 AP por posesión. Cada movimiento compite con una habilidad o un ataque más potente.
4. **Identidad por rol.** Las cuatro clases se sienten distintas en stats, restricciones y opciones.
5. **Mobile-first, sin timers.** Vertical, tap-to-move, targets grandes, partidas cortas, pausa libre.

---

## 3. Reglas de vóley: qué respetamos

| Regla real | Decisión MVP | Motivo |
|---|---|---|
| 3 toques máximo por equipo | Se respeta | Es el corazón del rally |
| El bloqueo no cuenta como toque | Se respeta | Permite el contraataque tras bloqueo |
| Un jugador no toca dos veces seguidas (salvo bloqueo) | Se respeta | Evita jugadas raras |
| Rally scoring: cada rally da un punto | Se respeta | Más simple y moderno |
| Rotación al ganar el saque | Post-MVP | Añade capa estratégica, pero complica todo |
| Líbero no ataca ni bloquea | Se respeta | Le da identidad y restricción |
| Un jugador de fondo no ataca desde la fila del frente | Se respeta | Crea restricción posicional real |
| Saque desde atrás de la línea | Simplificado: elige zona | El servidor no ocupa una celda |
| Red, antenas, faltas de red | Se ignoran | Ruido para un casual |
| Dobles, lifts, retenciones | Se ignoran | Ruido para un casual |
| Pelota fuera | Se ignora: siempre cae en una celda | Menos frustración, más lectura |
| Saque agresivo con riesgo | Post-MVP | Se agrega como decisión avanzada |

**Terminología:** usamos “punto de rally”, no “side-out”. “Rotación” queda para después del MVP.

### Reglas duras (no negociables)

- 4 contra 4.
- Tablero de 3 columnas x 2 filas por lado.
- Máximo 3 toques por equipo.
- El bloqueo no cuenta como toque.
- 3 AP por posesión ofensiva.
- 2 AP de reacción por posesión defensiva.
- Resolución determinista: sin RNG oculto en el resultado.
- El líbero no ataca ni bloquea.
- Un set a 7 puntos.
- Sin rotación en el MVP.
- Mobile vertical primero.

---

## 4. Tablero y geometría

### 4.1. Vista

```
        EQUIPO RIVAL
   ┌─────┬─────┬─────┐
   │     │     │     │   fondo rival
   ├─────┼─────┼─────┤
   │  C  │  A  │     │   frente rival
   ╞═════╪═════╪═════╡   RED
   │  C  │  A  │     │   frente propio
   ├─────┼─────┼─────┤
   │     │  L  │  O  │   fondo propio
   └─────┴─────┴─────┘
        TU EQUIPO
```

`A` = Armador, `C` = Central, `O` = Opuesto, `L` = Líbero. La formación rival es la espejada.

### 4.2. Medidas

- Cada lado: **3 columnas x 2 filas** = 6 zonas.
- Total: 12 celdas.
- La cancha completa queda en proporción 9 x 18 m, que es la real.
- La red está entre las dos filas del frente.
- La línea de ataque separa la fila del frente de la fila del fondo.

### 4.3. Coordenadas

```ts
type Side = 'home' | 'away';
type Row = 0 | 1;        // 0 = frente (red), 1 = fondo
type Col = 0 | 1 | 2;    // 0 = izquierda, 1 = centro, 2 = derecha (perspectiva del equipo)
type Cell = { side: Side; row: Row; col: Col };
```

### 4.4. Zonas oficiales

| Fila | Izquierda | Centro | Derecha |
|---|---|---|---|
| Frente | 4 | 3 | 2 |
| Fondo | 5 | 6 | 1 |

La numeración es desde la perspectiva de cada equipo. En la UI principal no se muestran los números: se usan en el tutorial y en el código.

### 4.5. Espacio táctico

Con 4 jugadores y 6 zonas por lado, **siempre hay 2 zonas libres**. Esas zonas son el puzzle: el ataque busca la zona libre, la defensa intenta cubrirla. Las zonas libres iniciales del equipo local son frente-derecha (2) y fondo-izquierda (5).

### 4.6. Alcance y costuras

- **Alcance:** celda propia + celdas ortogonalmente adyacentes. La diagonal no se alcanza, salvo con la habilidad del líbero.
- **Velocidad >= 4:** ignora la penalización por recibir/defender en una celda adyacente.
- **Costura (seam):** celda vacía alcanzable por 2 o más jugadores. Recibir en costura aplica **-1**.
- Si nadie alcanza la celda, el ataque o saque es punto directo.

### 4.7. Estado de la pelota

```ts
type Ball = {
  cell: Cell;
  height: 'low' | 'high' | 'net';
  quality: number;       // 0-3, calidad del último toque
  lastTouchId?: string;
};
```

La altura es una abstracción visual y de animación; la lógica principal usa celda y calidad.

---

## 5. Equipos, formación y roles

### 5.1. Formación inicial (equipo local)

| Jugador | Zona | Fila | Rol |
|---|---|---|---|
| Armador | 3 (frente-centro) | Frente | Arma, hace finta, bloquea |
| Central | 4 (frente-izquierda) | Frente | Ataque rápido, bloqueo |
| Opuesto | 1 (fondo-derecha) | Fondo | Pipe, remate, defensa |
| Líbero | 6 (fondo-centro) | Fondo | Recepción, cobertura amplia |

Zonas libres: **2 (frente-derecha)** y **5 (fondo-izquierda)**.

El equipo rival usa la formación espejada.

### 5.2. Restricciones por rol

- **Armador:** puede armar desde cualquier celda, pero arma mejor cerca de la pelota. Puede bloquear desde el frente. Puede atacar (finta) si está en el frente.
- **Central:** ataque rápido y bloqueo. Es el mejor bloqueador por su Lectura y su bonus de clase.
- **Opuesto:** ataca desde el fondo (pipe). Si sube al frente, no puede atacar (regla de jugador de fondo). Defiende desde el fondo.
- **Líbero:** no ataca ni bloquea. Recibe y defiende con alcance ortogonal y es el único que puede cubrir la diagonal (habilidad). No saca. Es el jugador más técnico.

### 5.3. Rotación (post-MVP)

Cuando un equipo gana el rally recibiendo, rota una posición en sentido horario. El líbero entra por el jugador que va al fondo. La rotación es la capa estratégica de la versión completa; no está en el MVP.

---

## 6. Stats y clases

### 6.1. Stats (escala 1-5)

| Stat | Uso |
|---|---|
| **Técnica** | Calidad de pase y de armado |
| **Potencia** | Potencia de saque y remate |
| **Velocidad** | Alcance para recibir/defender |
| **Lectura** | Calidad de bloqueo y defensa; pistas de tendencia rival |

No hay crecimiento de stats en el MVP. La identidad viene de la clase y de la formación.

### 6.2. Perfiles

| Clase | Técnica | Potencia | Velocidad | Lectura | Identidad |
|---|---|---|---|---|---|
| Armador | 5 | 2 | 3 | 4 | Cerebro; arma, finta, bloquea |
| Central | 2 | 4 | 3 | 5 | Muro y ataque rápido |
| Opuesto | 2 | 5 | 4 | 3 | Cañón; pipe y remate |
| Líbero | 5 | 1 | 5 | 5 | Ancla defensiva; recibe y cubre |

### 6.3. Valores derivados

- **Alcance:** celda propia + ortogonal adyacente. La diagonal no se alcanza, salvo con la habilidad del líbero.
- **Velocidad >= 4:** ignora la penalización por recibir/defender en celda adyacente. Líbero y opuesto ajustan mejor; armador y central no.
- **Movimiento:** 1 celda por 1 AP para todos. La Velocidad no abarata el movimiento; mejora la recepción y la defensa en celdas ajenas.
- **Bloqueo:** solo jugadores en la fila del frente. El central suma +1 al valor de bloqueo.
- **Ataque:** el líbero no puede atacar. El opuesto solo ataca desde el fondo.

---

## 7. Economía de acciones (AP)

### 7.1. Posesión ofensiva: 3 AP

| Acción | Costo | Notas |
|---|---|---|
| Mover 1 celda | 1 AP | Solo ortogonal |
| Recibir / defender | 0 AP | La acción de toque es gratuita si estás en posición |
| Armado alto | 0 AP | Habilita ataque de potencia, colocación, wipe o finta |
| Combo de ataque rápido | 1 AP | Armado rápido + ataque rápido; solo central |
| Combo de pipe | 1 AP | Armado de espalda + ataque de pipe; solo opuesto desde el fondo |
| Ataque de potencia | 1 AP | Sobre un armado alto |
| Ataque de colocación | 0 AP | Sobre un armado alto |
| Wipe (mano fuera) | 1 AP | Sobre un armado alto; requiere bloqueador en la columna |
| Finta (tip) | 0 AP | Sobre un armado alto; ignora el bloqueo, pero es fácil de defender |
| Habilidad de clase | 1-2 AP | Una vez por set |
| Saque | 0 AP | Solo elige zona; no consume los 3 AP de la posesión |

### 7.2. Pase perfecto

Si la recepción o el dig resultan en calidad **3**, el equipo recupera **+1 AP** (máximo 3). Es la recompensa que convierte la calidad en recursos.

### 7.3. Posesión defensiva: 2 AP de reacción

Durante el ataque rival, el equipo defensor tiene **2 AP de reacción** para:
- Mover un jugador de la fila del frente a otra columna del frente (1 AP por celda).
- Mover un jugador de la fila del fondo a otra columna del fondo (1 AP por celda).

No se puede cruzar de fila en la fase de reacción. El atacante ve las posiciones finales antes de elegir.

### 7.4. Reglas de economía

- Los AP no se acumulan entre rallies.
- Los AP de reacción no se acumulan entre ataques.
- Si el equipo se queda sin AP, siempre puede hacer acciones de costo 0 (armado alto, colocación, finta).
- **Deshacer:** se puede deshacer cualquier movimiento antes de confirmar el toque. Una vez resuelto el toque, no se deshace.
- No hay timers.

---

## 8. Flujo de un rally

### 8.1. Cuando el jugador ataca

1. **Saque rival** → la pelota se telegrafía a una celda.
2. **Recepción** (3 AP): el jugador mueve al receptor y confirma. Se calcula la calidad del pase (0-3).
3. **Pase perfecto** → +1 AP.
4. **Armado** (mismos AP): el armador se mueve y elige tempo + destino:
   - Alto (0 AP): al central o al opuesto.
   - Rápido (1 AP): al central, habilita ataque rápido.
   - Espalda (1 AP): al opuesto desde el fondo, habilita pipe.
5. **Lectura del bloqueo rival**: el rival gasta sus 2 AP de reacción moviendo bloqueadores y defensores. El jugador ve las posiciones.
6. **Remate**: el jugador elige tipo y zona. El costo depende del tipo.
7. **Resolución**: bloqueo → defensa → punto o dig.
8. **Punto**: el ganador saca. A 7.

### 8.2. Cuando el jugador defiende

1. **Saque propio** → el jugador elige la zona objetivo.
2. **Recepción rival** → la IA mueve y resuelve.
3. **Armado rival** → la IA elige tempo y destino.
4. **Lectura defensiva** (2 AP de reacción): el jugador mueve bloqueadores y defensores. La stat Lectura muestra una pista de la tendencia rival.
5. **Remate rival** → la IA elige tipo y zona según lo que ve.
6. **Resolución**: bloqueo → defensa → punto o dig.
7. Si hay dig, la posesión cambia y el jugador empieza su posesión con la calidad del dig como pase.

### 8.3. Ejemplo completo (números v1.2)

- Saque rival a zona 5. El líbero está en 6 y se mueve a 5 (1 AP).
  `R = 5 + 1 + 1 - 1 = 6` → **pase 3**.
- El armador está en 3, se mueve a 6 (1 AP) y arma rápido al central en 4.
  `S = 3` (pase 3, distancia 1, armador) → **armado 3**.
- AP: 3 - 1 (líbero) + 1 (pase perfecto) - 1 (armador) - 1 (combo rápido) = 1.
- El central ataca rápido a la columna 0: `A_base = 4 + 3 + 2 = 9`.
  El bloqueo rival leyó y suma `B = 5 + 1 = 6`; con un bloqueador, `A = 9 - 2 = 7`, `A_pasa = 6`; el líbero D=7 → **dig 1**.
- Pero el central ve el compromiso y cambia a la columna 2: `A_base = 4 + 3 + 2 - 1 = 8`; sin bloqueo, `A = 8`; la defensa rival llega con Lectura 3 → `D = 3` → **punto**.
- La decisión fue leer el bloqueo, no pegarle más fuerte.

---

## 9. Resolución determinista

Todos los resultados se calculan y se muestran **antes de confirmar**. No hay RNG en el resultado.

### 9.1. Recepción / dig

```
R = Técnica
  + (líbero ? 1 : 0)
  + (celda propia ? 1 : (Velocidad >= 4 ? 0 : -1))
  - presión_del_balón
  - (costura ? 1 : 0)
```

Presión del balón: balón libre 0, saque 1, finta 1, remate 3.

| R | Calidad |
|---|---|
| >= 6 | 3 — perfecto |
| 4-5 | 2 — bueno |
| 2-3 | 1 — malo |
| <= 1 | 0 — error |

**Regla del armador que recibe:** si el armador toca la recepción, no puede armar el siguiente toque. La UI lo advierte antes de confirmar. Es lo que hace peligroso el saque a la zona 4.

### 9.2. Armado

```
S = clamp(
  calidad_pase
  - (distancia > 1 ? 1 : 0)
  - (no es armador ? 2 : 0)
  - (Técnica <= 3 ? 1 : 0),
  0, 3
)
```

El armador puede armar desde su celda o una adyacente sin penalización. Solo a 2+ celdas hay **-1**.

| S | Calidad |
|---|---|
| 3 | 3 — perfecto |
| 2 | 2 — bueno |
| 1 | 1 — malo |
| 0 | 0 — error |

**Efecto:** el armador preserva la calidad del pase; un no-armador la destruye. El líbero arma como máximo 1; el central y el opuesto, 0. La cadena de calidad se lee de un vistazo.

### 9.3. Remate vs bloqueo

```
A_base = Potencia
  + calidad_armado
  + bonus_de_tipo
  - (columna_objetivo_a_2_columnas ? 1 : 0)

A = A_base - 2 * bloqueadores_en_la_columna
```

`A` es el valor después de la penalización por bloqueo.

| Tipo | Bonus | Costo | Condición |
|---|---|---|---|
| Potencia | +1 | 1 AP | Armado alto |
| Colocación | 0 | 0 AP | Armado alto |
| Rápido | +2 | combo 1 AP | Central + armado rápido |
| Pipe | +1 | combo 1 AP | Opuesto desde el fondo + armado de espalda |
| Wipe | -1 | 1 AP | Armado alto + bloqueador en la columna |
| Finta | -1 | 0 AP | Armado alto; ignora el bloqueo |

```
B = Lectura_del_bloqueador
  + (es central ? 1 : 0)
  + (segundo bloqueador en la columna ? 1 : 0)
```

| Bloqueo | B |
|---|---|
| Nadie | 0 |
| Armador solo | 4 |
| Central solo | 6 |
| Central + armador | 7 |

En el tablero 3x2 solo puede haber un bloqueador por columna, así que `B = 7` queda como valor de referencia para una cancha más grande: en el MVP el máximo real es 6.

- Si no hay bloqueador en la columna, `B = 0` y no se aplica la resta de `2 * bloqueadores`.
- Si `A <= B` → **bloqueado** (en el MVP, punto para la defensa).
- Si `A > B` → la pelota pasa. `A_pasa = A - (había_bloqueador ? 1 : 0)`.
- La finta ignora el bloqueo: `A_pasa = A`, pero la defensa recibe +1.
- El wipe ignora el bloqueo: `A_pasa = A` (se usa el bloqueo para mandar la pelota afuera).

### 9.4. Remate vs defensa

El defensor es el jugador que está en la celda objetivo o que la alcanza. Si hay varios, se usa el mejor.

```
D = Lectura
  + (líbero ? 1 : 0)
  + (defensor en la celda objetivo ? 1 : 0)
  + (finta ? 1 : 0)
```

```
delta = D - A_pasa
```

| delta | Resultado |
|---|---|
| < -1 | Punto del atacante |
| -1 | Dig con calidad 0 |
| 0 | Dig con calidad 1 |
| 1 | Dig con calidad 1 |
| 2 | Dig con calidad 2 |
| >= 3 | Dig con calidad 3 |

La calidad del dig se convierte en la calidad del pase de la siguiente posesión.

### 9.5. Saque

- El servidor elige una celda del campo rival.
- `presión = 1` (saque normal).
- Si nadie alcanza la celda → **ace**.
- Si alguien alcanza → recepción con la fórmula de 9.1.
- No hay falta de saque en el MVP. El saque agresivo con riesgo es post-MVP.

### 9.6. Bloqueo en el MVP

Un remate bloqueado termina el rally y da el punto a la defensa. Es una simplificación consciente: el “scramble” y la cobertura del bloqueo son post-MVP. El jugador puede evitar el bloqueo porque ve las posiciones antes de atacar.

**El bloqueo como disuasión (hallazgo v1.2):** con información perfecta, un atacante racional nunca elige un remate que va a ser bloqueado; usa colocación, finta o wipe. Eso no invalida el bloqueo: cambia su función. El valor del bloqueo está en **empujar el ataque hacia zonas peores** y en castigar al jugador que golpea sin leer. En la simulación, el 39% de los ataques se juegan con un bloqueador delante y el 0% termina bloqueado. El bloqueo se valida con escenarios forzados en los tests y con el riesgo que asume el humano.

### 9.7. Preview

La UI muestra, para cada celda objetivo candidata:
- Calidad de pase / armado.
- `A` vs `B`.
- `A_pasa` vs `D`.
- Resultado: **Punto**, **Dig** o **Bloqueo**.

La información es exacta. El jugador decide con todo a la vista.

---

## 10. Acciones, ataques y habilidades

### 10.1. Ataques

| Ataque | Rol | Uso |
|---|---|---|
| Potencia | Opuesto / central | Máxima potencia; riesgo de bloqueo |
| Colocación | Cualquiera | Gratis; busca la zona libre |
| Rápido | Central | Rápido y fuerte; requiere combo |
| Pipe | Opuesto | Desde el fondo; exige armado de espalda |
| Wipe | Cualquiera | Usa el bloqueo para mandarla afuera |
| Finta | Cualquiera | Ignora el bloqueo; fácil de defender |

### 10.2. Habilidades (una por clase, una vez por set)

| Clase | Habilidad | Costo | Efecto |
|---|---|---|---|
| Armador | Colocación perfecta | 2 AP | El próximo armado es calidad 3 |
| Central | Muro | 1 AP | +2 al valor de bloqueo en su columna |
| Opuesto | Mano fuera | 1 AP | El próximo ataque ignora el bloqueo |
| Líbero | Cobertura total | 1 AP | La próxima recepción o defensa del líbero alcanza cualquier celda de su lado e ignora la costura |

Las habilidades compiten con el movimiento y el ataque. Son la capa RPG del MVP.

### 10.3. Saque

- Elige zona.
- El servidor es el opuesto (fondo-derecha). El líbero no saca.
- Sin riesgo en el MVP.

### 10.4. Bloqueo y cobertura

- Solo la fila del frente bloquea.
- En la fase de reacción, los jugadores se mueven dentro de su fila.
- El atacante ve las posiciones finales.
- La defensa se resuelve por posición y alcance, no por una asignación abstracta.

---

## 11. Máquina de estados

```
MATCH_START
  └─> SERVE ──(ace)──> POINT
        │
        └─(en juego)─> RECEIVE ──> SET ──> BLOCK_COMMIT ──> ATTACK ──> RESOLVE
                                                                          │
                                              ┌───────────────────────────┤
                                              │                           │
                                           (dig)                       (punto)
                                              │                           │
                                              v                           v
                                            SET                         POINT
                                                                          │
                                                                    (fin de set)
                                                                          │
                                                                          v
                                                                      MATCH_END
```

| Estado | Quién actúa | Qué pasa |
|---|---|---|
| `MATCH_START` | — | Inicializa score, saque y formación |
| `SERVE` | Servidor | Elige zona objetivo |
| `RECEIVE` | Receptor | Movimiento + resolución del pase |
| `SET` | Armador | Movimiento + tempo + destino |
| `BLOCK_COMMIT` | Defensa | 2 AP de reacción; mueve bloqueadores/defensores |
| `ATTACK` | Atacante | Elige tipo y zona |
| `RESOLVE` | — | Calcula bloqueo, defensa y resultado |
| `POINT` | — | Suma punto, define saque, chequea fin de set |
| `MATCH_END` | — | Resultado y revancha |

`ANIMATING` es un bloqueo de UI, no un estado lógico. La lógica puede resolver el rally completo y emitir eventos; la UI los reproduce en orden.

---

## 12. IA

### 12.1. Heurísticas por fase

- **Saque:** apunta al receptor más débil o a la costura; evita al líbero.
- **Recepción:** mueve al mejor receptor dentro de alcance; prioriza al líbero.
- **Armado:** evalúa central rápido, opuesto en pipe o armado alto; elige el ataque con mejor preview contra la defensa rival.
- **Ataque:** evalúa cada combinación de tipo y zona; prefiere punto, evita bloqueo, acepta dig si no hay mejor.
- **Defensa:** mueve bloqueadores a la columna más probable y defensores a la zona más probable, según la tendencia del atacante.

### 12.2. Dificultad

- **Fácil:** elige al azar entre opciones viables.
- **Normal:** heurística greedy; lee la posición actual.
- **Difícil:** greedy + explota las tendencias del jugador (post-MVP).

El MVP usa **Normal**.

### 12.3. Tendencia y lectura

Cada equipo IA tiene un perfil de tendencia (ej. “60% ataca por zona 4”). La stat Lectura del jugador revela una pista antes del bloqueo: “Probable: zona 4”. No es información oculta: es una pista visible que el jugador puede ignorar.

---

## 13. Partido y puntuación

- **Formato:** un set a 7 puntos.
- **Puntuación:** rally scoring; cada rally da un punto.
- **Saque:** el ganador del rally saca el siguiente.
- **Empate 6-6:** el siguiente punto gana (sin ventaja de 2 en el MVP).
- **Rotación:** no en el MVP.
- **Tiempos muertos:** no en el MVP.
- **Inicio:** el jugador saca primero (tutorial) o se define por sorteo en partidos normales.
- **Revancha:** botón al final; reinicia el estado.

---

## 14. UI/UX mobile-first

### 14.1. Layout vertical

```
┌─────────────────────────┐
│ MARCADOR  3 - 2   SAQUE │  barra superior
├─────────────────────────┤
│                         │
│       CAMPO RIVAL       │
│       (3 x 2)           │
│                         │
│ ═════════ RED ═════════ │
│                         │
│       TU CAMPO          │
│       (3 x 2)           │
│                         │
├─────────────────────────┤
│  JUGADOR SELECCIONADO   │  panel inferior
│  stats · AP · acciones  │
├─────────────────────────┤
│  LOG: “¡Pase perfecto!” │
└─────────────────────────┘
```

- Ancho máximo: 480px, centrado en desktop.
- Fondo oscuro fuera de la cancha.
- Sin scroll en el juego; todo entra en una pantalla.

### 14.2. Componentes

- **Scoreboard:** puntos, indicador de saque, nombre de equipos.
- **Board:** grilla 3x4, red, líneas, pelota, fichas.
- **PlayerToken:** forma + color + inicial; outline al seleccionar.
- **ActionBar:** botones contextuales con costo de AP.
- **PreviewPanel:** resultado esperado de la acción.
- **Log:** últimas 2-3 acciones, con texto corto.
- **UndoButton:** deshacer antes de confirmar.
- **TutorialOverlay:** pasos con flechas y texto.

### 14.3. Interacción

- Tap en ficha → seleccionar.
- Tap en celda resaltada → mover.
- Tap en la pelota o en el botón de acción → recibir/armar/rematar.
- Tap en celda objetivo → previsualizar; segundo tap o botón “Confirmar” → ejecutar.
- Sin hover. Sin doble tap. Sin gestos ocultos.
- Targets de 44px mínimo.

### 14.4. Preview

Ejemplo de panel:

```
PASE 2  →  ARMADO 2  →  BLOQUEO 1  →  PUNTO: SÍ
```

Si el resultado es malo, el panel lo dice con claridad:

```
PASE 1  →  ARMADO 1  →  BLOQUEO 2  →  RESULTADO: BLOQUEADO
```

### 14.5. Feedback

- “¡Pase perfecto!” + destello.
- “Bloqueo del central” + sonido seco.
- “¡Punto!” + shake leve.
- “+1 AP” flotante.
- Colores: verde = favorable, amarillo = disputado, rojo = desfavorable.

### 14.6. Accesibilidad

- Forma + color por clase (no solo color).
- Contraste alto.
- Texto mínimo 14px.
- Opción “reducir movimiento”.
- Sin timers.
- Botones con labels, no solo iconos.

### 14.7. Checklist mobile

- `viewport-fit=cover` y safe-area.
- `100dvh`, no `100vh`.
- `touch-action: manipulation`.
- `-webkit-tap-highlight-color: transparent`.
- `user-select: none` en el tablero.
- Prevenir zoom por doble tap.
- Probar en 360x640, 390x844 y 768x1024.
- No depender de hover.

---

## 15. Dirección de arte

### 15.1. Tono

**Anime escolar + pixel art.** Equipos con personalidad, energía de torneo, colores saturados, expresiones exageradas en los popups. La referencia emocional es Haikyuu; la referencia de claridad es un juego de tablero.

### 15.2. Especificaciones

- Resolución lógica: 360x640, escalada con CSS.
- Sprites de jugador: 32x32.
- Pelota: 16x16.
- Tiles de cancha: 96x64 por celda.
- `image-rendering: pixelated`.
- Animaciones a 8-12 fps, con interpolación solo para la pelota.

### 15.3. Paleta

| Uso | Color |
|---|---|
| Equipo local (coral) | `#FF6B6B` |
| Equipo rival (teal) | `#4ECDC4` |
| Cancha / madera | `#D9A066` |
| Cancha clara | `#F4E1C1` |
| Red | `#2B2D42` |
| Pelota | `#FFF3B0` |
| Texto | `#1A1A1A` |
| Acento / punto | `#FFD166` |

### 15.4. Formas placeholder

| Clase | Forma |
|---|---|
| Armador | Círculo |
| Central | Triángulo |
| Opuesto | Rombo |
| Líbero | Cuadrado |

La forma se mantiene cuando lleguen los sprites: el sprite va dentro de la silueta, así la transición no rompe la lectura.

### 15.5. Animación y audio

- Pelota: arco con squash al impactar.
- Remate: destello + shake leve.
- Bloqueo: chispa en la red.
- Punto: popup + jingle corto.
- Audio: ambiente de cancha, silbato, golpe de pelota, red. Post-MVP o SFX simples.

---

## 16. Arquitectura técnica

### 16.1. Stack

- **Vite + React + TypeScript.**
- **Tailwind** para UI; CSS Grid para el tablero.
- **Zustand** para el estado global.
- **Vitest** para el motor.
- **Vercel** para deploy.

El motor vive fuera de React. React solo renderiza y despacha comandos.

### 16.2. Estructura

```
src/
  engine/
    types.ts        // tipos del dominio
    state.ts        // estado inicial y utilidades
    commands.ts     // validación y reducer
    resolve.ts      // fórmulas de resolución
    ai.ts           // heurísticas de la IA
    events.ts       // eventos para animar
    rng.ts          // RNG con semilla, solo cosmético
  store/
    gameStore.ts    // Zustand + dispatch + undo
  ui/
    App.tsx
    Board.tsx
    Cell.tsx
    PlayerToken.tsx
    Ball.tsx
    Scoreboard.tsx
    ActionBar.tsx
    PreviewPanel.tsx
    Log.tsx
    Tutorial.tsx
  styles/
    board.css
    theme.css
tests/
  resolve.test.ts
  commands.test.ts
  match.test.ts
  simulate.ts
```

### 16.3. Tipos base

```ts
type Side = 'home' | 'away';
type Row = 0 | 1;
type Col = 0 | 1 | 2;
type Cell = { side: Side; row: Row; col: Col };

type ClassId = 'setter' | 'middle' | 'opposite' | 'libero';
type Stats = { tecnica: number; potencia: number; velocidad: number; lectura: number };

type Player = {
  id: string;
  side: Side;
  classId: ClassId;
  name: string;
  stats: Stats;
  cell: Cell;
};

type Phase =
  | 'MATCH_START'
  | 'SERVE'
  | 'RECEIVE'
  | 'SET'
  | 'BLOCK_COMMIT'
  | 'ATTACK'
  | 'RESOLVE'
  | 'POINT'
  | 'MATCH_END';

type GameState = {
  phase: Phase;
  score: Record<Side, number>;
  server: Side;
  possession: Side;
  ap: number;
  reactionAp: number;
  players: Player[];
  ball: Ball;
  log: LogEntry[];
};

type Command =
  | { type: 'MOVE'; playerId: string; to: Cell }
  | { type: 'RECEIVE'; playerId: string }
  | { type: 'SET'; setterId: string; targetId: string; tempo: 'high' | 'quick' | 'back' }
  | { type: 'SHIFT'; playerId: string; to: Cell }
  | { type: 'ATTACK'; playerId: string; target: Cell; kind: AttackKind }
  | { type: 'CONFIRM' }
  | { type: 'UNDO' };
```

### 16.4. Contrato del motor

- `reduce(state, command) → { state, events }`.
- El reducer valida fase, AP, legalidad y alcance.
- Es determinista: mismo estado + mismo comando = mismo resultado.
- Los eventos describen lo que pasó para que la UI anime.
- La IA usa el mismo `reduce` y el mismo preview que el jugador.
- El RNG con semilla se usa solo para variación cosmética, nunca para el resultado.

### 16.5. Testing

- Unitarios: recepción, armado, bloqueo, defensa, AP, alcance, costuras, ace.
- Integración: un rally completo de saque a punto; un partido completo a 7.
- Simulación: 1000 rallies IA vs IA; distribución de resultados, duración media, pases perfectos, bloqueos, digs.
- Visual: 360x640, 390x844, 768x1024, 1440x900.

### 16.6. Deploy

- Vercel: framework Vite, build `npm run build`, output `dist`.
- Sin backend en el MVP.
- PWA y persistencia local: post-MVP.

### 16.7. Rendimiento

- 12 celdas y 8 fichas: no hay problema de performance.
- Memoizar celdas y fichas; usar selectores de Zustand.
- Animar con CSS transforms, no con layout.
- Evitar re-render del log en cada frame.

---

## 17. Roadmap

| Fase | Entregable | Criterio de aceptación | Estado |
|---|---|---|---|
| **0. Diseño** | GDD v1 + hoja de números + paper test de 3 rallies | Reglas cerradas y un rally jugado en papel | Completada |
| **1. Motor** | Tipos, reducer, resolución, tests | `npm test` verde; 100 rallies simulados sin errores | Completada |
| **2. Tablero** | Grilla 3x4, fichas, tap-to-move, AP, preview, undo | Se puede mover y recibir en 360x640 | Completada |
| **3. IA + partido** | IA de saque/recepción/armado/ataque/defensa, score, fin de set | Partido completo a 7 contra la IA | Completada |
| **4. Juice** | Tutorial, animaciones, sonido, pulido mobile | Un jugador nuevo entiende el loop sin ayuda | Completada |
| **5. Playtest** | Deploy en Vercel + 5 testers + métricas | 4/5 quiere jugar otro rally | Pendiente |

**Estado actual:** el juego corre de punta a punta en el navegador con tutorial de 2 rallies, sonido sintetizado, animaciones y layout sin scroll desde 360x640. Falta el deploy y el playtest.

**Definición de terminado del MVP:** partido completo a 7 contra la IA, sin crashes, jugable en un celular de 360px de ancho, con tutorial y sonido básico.

---

## 18. Métricas de playtest

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Duración media del rally | 2-4 ataques | Log de eventos |
| Pases perfectos | 5-20% | Contador |
| Ataques con bloqueador delante | 30-45% | Contador |
| Bloqueos | 0-5% de los ataques | Contador |
| Digs | 35-50% de los ataques | Contador |
| AP gastados por rally | 2.5-3.0 | Suma |
| Duración del partido | 5-8 min | Timer |
| Win rate vs IA normal | 50-60% | 20 partidas |
| “Jugaría otro rally” | 4/5 | Encuesta |

Si los pases perfectos son muy raros, subir el bonus del líbero o bajar la presión del saque. Si los bloqueos son muy altos, bajar el bonus del central o el valor de Lectura. Los números se ajustan con la simulación, no a ojo.

---

## 19. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fatiga de decisiones | Alto | 3 AP, previews claros, undo, tutorial |
| Determinismo resuelto | Medio | Tendencias de IA, variedad de sets, dificultad |
| Aglomeración de fichas | Medio | 12 celdas, fichas grandes; probar 3v3 si no se lee |
| Cadena de calidad invisible | Alto | Preview y log siempre visibles |
| Scope creep | Alto | Lista de fuera de alcance; no rotación ni progresión |
| Mobile mal resuelto | Alto | Checklist y playtest en device real |
| IA predecible | Medio | Perfiles de tendencia y mezcla de decisiones |
| Tutorial largo | Medio | Enseñar en 2 rallies, no en 10 pantallas |

---

## 20. Fuera de alcance (MVP)

- Rotación, 6v6, sustituciones.
- Progresión, niveles, equipo, gacha.
- Historia, campaña, diálogos, retratos.
- Online, cuentas, backend.
- Guardado y reanudación.
- Reglas avanzadas: dobles, lifts, faltas de red, antenas, saques con riesgo, out.
- Múltiples canchas o equipos.
- Localización más allá del español.
- Monetización.
- Replays y espectador.

---

## 21. Glosario

- **Rally:** secuencia desde el saque hasta que la pelota toca el suelo o se comete una falta.
- **Punto de rally:** cada rally da un punto, sin importar quién sacó.
- **Rotación:** cambio de posición al ganar el saque; post-MVP.
- **Zona:** cada una de las 6 áreas por lado (4-3-2 frente; 5-6-1 fondo).
- **Frente / fondo:** fila junto a la red / fila detrás de la línea de ataque.
- **Red:** separación entre los dos campos.
- **Línea de ataque:** límite que impide atacar desde el frente a los jugadores de fondo.
- **Pipe:** ataque del opuesto desde el fondo.
- **Tempo:** velocidad del armado (alto, rápido, de espalda).
- **Wipe / mano fuera:** ataque que usa el bloqueo para que la pelota salga.
- **Finta / tip:** ataque suave que engaña al bloqueo.
- **Dig:** defensa de un remate.
- **Bloqueo:** acción de los jugadores del frente para detener el remate.
- **Costura (seam):** espacio entre dos jugadores; recibir ahí es más difícil.
- **Ace:** saque que nadie alcanza.
- **Líbero:** especialista defensivo; no ataca, no bloquea, no saca.
- **Armador:** el que arma; cerebro del equipo.
- **Central:** bloqueador y atacante rápido.
- **Opuesto:** atacante principal desde el fondo.

---

## 22. Registro de decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| 4v4 | 3v3 / 6v6 | El armador necesita dos atacantes para que su decisión importe; 6v6 es demasiado scope |
| Tablero 3x2 por lado | 3x3 | 6 zonas oficiales, proporción real, mejor lectura en vertical |
| Resolución determinista | Dados / porcentajes ocultos | El puzzle se siente justo y legible; el reto es posicional |
| Defensa controlada por el jugador | Defensa automática | La mitad del deporte y de las decisiones |
| 3 AP por posesión | 3 AP por fase | La calidad se convierte en recursos; premia construir la jugada |
| Solo clases y stats | Progresión / campaña | Validar el rally primero; el meta-juego viene después |
| Un set a 7 | A 5 / a 15 | 5-8 minutos, suficiente para que la estrategia aparezca |
| Anime escolar | Realista / sci-fi | Encaja con clases, habilidades y tono casual |
| Alcance 1 + ortogonal | Alcance 2 (8 vecinos) | El alcance 2 cubría toda la cancha y mataba el puzzle posicional |
| Velocidad >= 4 ignora la penalización por celda adyacente | Penalización fija | Da identidad a líbero y opuesto sin regalar alcance diagonal |
| Armado = calidad del pase menos penalizaciones | Técnica + pase - distancia | La fórmula aditiva diluía la cadena de calidad |
| Pase perfecto con +1 por celda propia | Sin bonus de celda | El umbral 5 de la v1.1 hacía que el pase perfecto saliera casi gratis |
| Habilidad del líbero “Cobertura total” | “Recepción perfecta” | Resuelve la debilidad diagonal sin cobertura pasiva total |
| Armado desde celda adyacente sin penalización | Exigir la celda exacta del balón | Evita que el armador no pueda armar cuando la celda está ocupada |
| Movimiento solo ortogonal | Movimiento en 8 direcciones | Con alcance 1, la diagonal gratis hacía que el reposicionamiento no costara nada |
| Recepción +1 en la celda exacta | Sin bonus de celda | Hace que el posicionamiento previo importe y permite el pase perfecto al líbero |
| Umbrales de recepción 6 / 4 / 2 | 5 / 3 / 1 | Baja el pase perfecto automático y conserva el pase bueno como resultado típico |
| Wipe con -1 | Wipe con +1 | Era un ataque demasiado eficiente: ignoraba el bloqueo y encima sumaba |
| Calidad de dig 0 / 1 / 1 / 2 / 3 | 0 / 1 / 2 / 3 | El dig perfecto salía casi gratis; ahora exige una lectura clara |
| Bloqueadores solo en la misma columna | Columna y adyacentes | En 3x2, la adyacencia permitía dobles bloqueos irreales con dos jugadores de red |
| El bloqueo como disuasión | El bloqueo como resultado frecuente | Con información perfecta la IA evita el bloqueo; su valor es condicionar el ataque |
| Primer saque alternado en la simulación | Local siempre saca | El saque es una ventaja estructural; alternar mide simetría (51/49) |
| Tutorial contextual de 2 rallies | Tutorial de 10 pantallas | Enseñar jugando; el jugador entiende el loop en menos de un minuto |
| Sonido sintetizado con WebAudio | Archivos de audio | Sin assets, sin carga y con control de mute inmediato |
| Log de 2 líneas y modo compacto en pantallas bajas | Log de 4 líneas siempre visible | Mantener cero scroll en 360x640 sin perder la información clave |
| Nombre ZONA 3 | — | La zona del armador; provisional |

---

## 23. Preguntas abiertas

- ¿El saque a zona 2 castiga demasiado? ¿Necesita una ayuda al receptor?
- ¿La habilidad “Cobertura total” se vuelve obligatoria?
- ¿El tablero 3x2 es demasiado chico para 4v4?
- ¿La regla de armado adyacente hace que el armador no necesite moverse?
- ¿La finta necesita un costo en AP para que no sea el ataque por defecto de la IA?
- ¿Los digs perfectos son demasiado frecuentes contra la finta?
- Perfiles de tendencia de la IA y cantidad de equipos.
- Nombres definitivos de equipos y personajes.
- ¿Medidor de momentum? Post-MVP.
- ¿Tiempo muerto como pausa táctica? Post-MVP.
- ¿Framer Motion o solo CSS?
- ¿Soporte landscape en tablet/desktop?
- ¿Persistencia local del partido?

---

## 24. Simulación v1.2 (Fase 1)

Motor determinista en TypeScript, IA con información perfecta, 100 partidos a 7 puntos con el primer saque alternado. Semilla base 1000.

| Métrica | Resultado v1.2 |
|---|---|
| Partidos | 100 (local 51 / rival 49) |
| Rallies por partido | 9.8 |
| Comandos por partido | 117.8 |
| Ataques por rally | 1.74 |
| Saques | 984 |
| Aces / errores de recepción | 0 / 0 |
| Pases | 0 / 0 / 984 / 0 (0% perfectos) |
| Armados | 0 / 0 / 984 / 729 (0 errores) |
| Ataques | 1.713 |
| Ataques con bloqueador delante | 39.2% |
| Bloqueos | 0.0% |
| Digs | 42.6% |
| Puntos de ataque | 57.4% |
| Tipos de ataque | potencia 563, colocación 180, wipe 187, finta 783 |

**Lectura:**

- **La simetría funciona.** Al alternar el primer saque, el win rate queda 51/49. La ventaja de sacar primero existe, pero no rompe el set.
- **Cero aces y cero errores** son consecuencia de la IA perfecta: siempre elige la mejor recepción posible. El error aparece cuando el jugador se posiciona mal, no por azar.
- **El pase perfecto no se regala.** La IA dirige el saque al receptor más débil; el líbero bien posicionado sí alcanza calidad 3, pero hay que buscarlo.
- **El bloqueo disuade, no gana.** 39% de los ataques van contra un bloqueador y ninguno termina bloqueado: el atacante elige finta, colocación o wipe. Es el comportamiento esperado de información perfecta; el humano puede ser castigado si golpea de frente.
- **La finta domina.** 783 de 1.713 ataques son fintas y todos los digs de la simulación salen perfectos. Es la palanca de balance abierta para v1.3: subir el costo de la finta o bajar la calidad del dig contra finta.

**Criterio de aceptación de Fase 1:** `npm test` en verde (49 tests), `npm run build` sin errores y simulación reproducible por semilla.

---

## 25. Fase 4: tutorial, sonido y pulido

### 25.1. Guion del tutorial (2 rallies)

El tutorial usa una tarjeta contextual sobre el pie de la pantalla. Reemplaza al log mientras dura y se puede saltar sin reiniciar el partido.

**Rally 1 — saque propio:**

1. **Saque:** “Tocá una zona del campo rival. El preview muestra el pase que consigue: buscá una zona débil, no la más cómoda.”
2. **Recepción rival:** la IA juega sola.
3. **Lectura:** “Movés bloqueadores dentro de su fila con 2 AP de reacción. No siempre bloquean: condicionan hacia dónde ataca el rival.”
4. **Recepción propia:** “Elegí quién recibe. El líbero es el mejor. Si no llega, movelo antes con 1 AP: la celda exacta da +1.”
5. **Armado:** “El armador reparte. Alto habilita potencia y colocación; Rápido solo al central y cuesta 1 AP.”
6. **Remate:** “Elegí tipo y tocá la zona. Finta y wipe ignoran el bloqueo; el líbero los lee.”

**Rally 2 — defensa:** se repiten las pistas de lectura y recepción con el foco en el dig. Al terminar el segundo punto aparece el overlay **Tutorial completado** con el marcador y el botón **Jugar el partido**, que reinicia el set a 0-0.

**Regla de diseño:** enseñar jugando, no con pantallas. La portada ofrece además **Cómo se juega** con las cuatro ideas clave para consulta libre.

### 25.2. Sonido

SFX sintetizados con WebAudio, sin archivos:

| Evento | Sonido |
|---|---|
| Saque / remate | golpe corto con ruido y caída de tono |
| Recepción / dig | golpe seco grave |
| Armado | dos notas cortas ascendentes |
| Bloqueo | zumbido grave |
| Punto | arpegio ascendente; el punto rival baja |
| Fin de set | fanfarria o descenso |
| Interfaz / movimiento | click y tick suaves |

El audio se desbloquea con el primer gesto del usuario y se silencia desde la portada o el header. No hay música en el MVP.

### 25.3. Animaciones

- Fichas y balón hacen `pop` al cambiar de celda.
- La celda atacada destella con el impacto.
- El punto aparece como banner flotante sobre el tablero y el marcador hace `pop`.
- Los paneles entran con `slide-up`; el tutorial y el modal de ayuda también.
- Todo respeta `prefers-reduced-motion`.

### 25.4. Layout y pulido mobile

- El tablero usa una altura de celda con `clamp()` y variables CSS.
- En pantallas de 700px de alto o menos se compacta el header, se oculta el log y se reducen las celdas; el tutorial ocupa el lugar del log.
- A 660px o menos se achican fichas y botones para mantener el objetivo de **cero scroll** en 360x640.
- Los targets siguen siendo la celda completa (mínimo 44px) y se respeta `safe-area-inset-bottom`.

### 25.5. Criterio de aceptación de Fase 4

`npm test` en verde (49 tests), `npm run build` sin errores, flujo completo verificado en Chrome headless a 390x844 y 360x640, y tutorial jugable de punta a punta sin errores de consola.
