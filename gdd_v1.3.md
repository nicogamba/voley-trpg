# ZONA 3 — GDD v1.3 “Duelo oculto”

**Vóley táctico por turnos · mobile-first · un set a 7 · 4v4**

> Reemplaza a `gdd_v1.1.md` (v1.2). Los cambios de esta versión están en la
> sección 2. La hoja de fórmulas vigente es `hoja_de_numeros.md` (v1.3).

---

## 1. Visión

ZONA 3 es un juego de vóley por turnos con estética Tecmo Cup / Captain Tsubasa
de Famicom. El jugador no mueve fichas: **lee la jugada rival y elige la
respuesta**. La tensión no viene de la ejecución, viene de comprometerse antes
de ver el resultado.

- Sesiones de 5-8 minutos, vertical 9:16, sin scroll.
- Un set a 7 puntos. Cada rally da un punto, saque o no.
- 4 contra 4. Sin rotación, sin cambios, sin dados.
- El rival elige primero, en secreto. El jugador elige después, con pistas.
- El resultado se revela recién en el cut-in.

**Fantasía:** “El rival ya se jugó. Ahora leo la pista, elijo mi carta y veo si
le gané el duelo.”

---

## 2. Qué cambia respecto de v1.2

| Área | v1.2 | v1.3 |
|---|---|---|
| Defensa | Mover bloqueadores con 2 AP de reacción | Elegir uno de 4 esquemas, a ciegas |
| Información | Preview exacto de A/B/D antes de confirmar | Nada: solo pistas veraces; el resultado aparece en el cut-in |
| Movimiento | Movimiento posicional con AP | Se elimina. El tablero es presentacional y marca objetivos |
| Resolución | Bloqueo y defensa por posición | Un solo duelo `A` vs `D` con matchup de esquema |
| Ataques | Tempo + tipo | Seis ataques con zona y costo propios |
| AP | 3 AP ofensivos + 2 defensivos | 2 AP, tope 3; un pase perfecto devuelve 1 |
| Undo | Permitido antes de confirmar | Eliminado: el cut-in ya reveló la apuesta |
| Cámara | HUD + tablero + preview | Tablero arriba, ventana de comandos abajo, cut-in a pantalla completa |
| Idioma | Español | Español, con lenguaje llano y una acción por fase |

---

## 3. Pilares

1. **Leer, no ejecutar.** La habilidad está en interpretar pistas y elegir.
2. **Compromiso oculto.** La IA decide antes; el jugador nunca ve el resultado
   hasta el final.
3. **Una decisión por pantalla.** Sin menús anidados ni previews numéricos.
4. **Cada ataque tiene su zona.** No hay una jugada dominante.
5. **Partido corto, revancha inmediata.** 5-8 minutos, reinicio en un toque.

---

## 4. Tablero y geometría

### 4.1. Vista

- Cada lado es una grilla de **2 filas × 3 columnas** (6 zonas).
- Fila 0 = frente (junto a la red). Fila 1 = fondo.
- El campo rival se dibuja arriba; el propio, abajo.
- El tablero no se toca para moverse: solo se tocan **zonas objetivo**
  resaltadas con `◎`.
- La ficha del atacante se marca con un anillo; la zona del último duelo
  parpadea.

### 4.2. Zonas

| Zona | Celda local |
|---|---|
| 4 | (0,0) |
| 3 | (0,1) |
| 2 | (0,2) |
| 5 | (1,0) |
| 6 | (1,1) |
| 1 | (1,2) |

El rival usa el espejo.

### 4.3. Alcance

- Recepción y defensa alcanzan **la celda propia + las 4 ortogonales**.
- La diagonal no se alcanza. Se descartó el alcance diagonal porque el líbero
  cubría toda la cancha y desaparecía la decisión.
- Una **costura** es una celda vacía alcanzable por 2 o más jugadores: recibir
  ahí cuesta `-1`.

### 4.4. Presión del balón

| Balón | Presión |
|---|---|
| Libre | 0 |
| Saque | 1 |
| Finta | 1 |
| Remate | 3 |

---

## 5. Equipos, formación y stats

### 5.1. Formación local

| Clase | Nombre | Celda | Técnica | Potencia | Velocidad | Lectura |
|---|---|---|---|---|---|---|
| Armador | Armador | (0,1) | 5 | 2 | 3 | 4 |
| Central | Central | (0,0) | 2 | 4 | 3 | 5 |
| Opuesto | Opuesto | (1,2) | 2 | 5 | 4 | 3 |
| Líbero | Líbero | (1,1) | 5 | 1 | 5 | 5 |

El rival usa la formación espejada: armador (0,1), central (0,2), opuesto
(1,0), líbero (1,1).

### 5.2. Restricciones

- El líbero no ataca y no saca.
- El rápido es exclusivo del central y solo entra por la columna 1.
- El pipe exige al opuesto desde la fila de fondo.
- Un jugador de fondo (opuesto y líbero) no ataca desde la fila de frente.
- El central y el armador atacan desde cualquier fila.

### 5.3. Rotación

Fuera del MVP. La formación es fija para que el jugador aprenda las zonas.

---

## 6. Flujo del partido

```
MATCH_START
  └─> SERVE ──(ace / error)──> POINT
        │
        └─(en juego)─> RECEIVE ──> SET ──> ATTACK | DEFEND ──> POINT | dig
                                                │                 │
                                                └──── cut-in ─────┘
                                                                  │
                                                          (dig) SET rival
                                                                  │
                                                          (punto) SERVE
```

- Si saca el jugador: `SERVE → RECEIVE rival → SET rival → DEFEND`.
- Si saca la IA: `SERVE rival → RECEIVE → SET → ATTACK`.
- `ATTACK` y `DEFEND` son la misma fase de duelo vista desde cada lado.
- Después de un dig, la posesión cambia y el rally sigue con `SET`.
- El ganador del punto saca el siguiente.
- A 7 puntos termina el set. Sin ventaja de 2.

### 6.1. Fases y responsables

| Fase | Actúa | Acción |
|---|---|---|
| `SERVE` | Sacador | Tocar una zona rival |
| `RECEIVE` | Equipo en posesión | Elegir receptor o dejar pasar |
| `SET` | Equipo en posesión | Elegir armador y atacante |
| `ATTACK` | Jugador | Elegir tipo de ataque y zona |
| `DEFEND` | Jugador | Elegir esquema defensivo |
| `MATCH_END` | — | Resultado y revancha |

---

## 7. Duelo oculto

### 7.1. Quién elige qué y cuándo

1. Termina el armado. El estado entra en `ATTACK` o `DEFEND`.
2. El motor compromete la respuesta rival **antes** de que el jugador elija:
   - Si el jugador ataca, la IA elige un **esquema defensivo**.
   - Si el jugador defiende, la IA elige un **plan de ataque** (tipo + zona).
3. La UI muestra 1 o 2 **pistas veraces** según la Lectura del jugador.
4. El jugador elige. La resolución es determinista.
5. El cut-in revela ataque, esquema y resultado.

No hay `undo`: una vez visto el cut-in, la jugada ya ocurrió.

### 7.2. Pistas

- Lectura >= 4 → 2 pistas. Lectura < 4 → 1 pista.
- Las pistas describen el esquema o el ataque rival, nunca el resultado.
- Nunca muestran `A`, `D`, `%` ni el nombre del esquema si es defensa.

| Esquema | Pista 1 | Pista 2 |
|---|---|---|
| Muro | Dos manos se levantan en la red. | La zona de red está bien cubierta. |
| Bloqueo abierto | La defensa se reparte por todo el ancho. | No hay una zona especialmente cargada. |
| Defensa profunda | El fondo se llena de camisetas. | La red queda con espacios. |
| Líbero atento | El líbero se ubica en el centro. | El centro está cubierto. |

Para un ataque rival se revela el tipo y la zona: “El opuesto viene de
atrás (Pipe)” + “Apuntan a la zona 5”.

---

## 8. Ataques

| Ataque | Bonus | Costo | Zona / condición | Fantasía |
|---|---|---|---|---|
| Potencia | +2 | 2 | Cualquiera | Fuerza bruta |
| Colocación | 0 | 0 | Cualquiera; +2 en esquina | Busca el hueco |
| Rápido | +2 | 0 | Central; solo columna 1 | Llega antes que el bloqueo |
| Pipe | +2 | 3 | Opuesto desde el fondo | Ataque de segunda línea |
| Wipe | +2 | 2 | Cualquiera | Usa las manos del bloqueo |
| Finta | 0 | 0 | Solo fila de fondo; +2 en esquina | Toque suave |

- “Esquina” = columna 0 o 2.
- El rápido **ignora el bonus de posición del defensor**: la defensa no llega a
  acomodarse.
- El costo en energía no se acumula entre rallies: es un portón, no una moneda.
  Con 2 AP se puede usar Potencia, Wipe o cualquier ataque gratis; con 3 AP se
  habilita el Pipe.

---

## 9. Esquemas defensivos

| Esquema | Stat | Bonus de clase | Zona que premia | Frena | Sufre |
|---|---|---|---|---|---|
| Muro | Lectura | Central +1 | Fila de frente (+1) | Potencia, Rápido | Pipe, Wipe, Finta |
| Bloqueo abierto | Velocidad | Líbero +1 | Siempre +1 | Colocación, Wipe, Finta | Potencia, Rápido |
| Defensa profunda | Lectura | Líbero +1 | Fila de fondo (+1) | Potencia, Pipe, Wipe | Colocación, Finta |
| Líbero atento | Técnica | Líbero +2 | Columna central (+1) | Colocación, Finta | Potencia, Rápido, Pipe |

Los bonus de matchup son `+2` / `0` / `-2`. El jugador debe inferir el esquema
rival desde la pista, no calcularlo.

---

## 10. Fórmulas

> La versión completa, con tablas y ejemplos, está en `hoja_de_numeros.md`.

### 10.1. Recepción / dig

```
R = Técnica
  + (líbero ? 1 : 0)
  + (celda propia ? 1 : (Velocidad >= 4 ? 0 : -1))
  - presión
  - (costura ? 1 : 0)
```

| R | Calidad |
|---|---|
| >= 6 | 3 — perfecta |
| 4-5 | 2 — buena |
| 2-3 | 1 — mala |
| <= 1 | 0 — error |

Un dig nunca deja la bola en calidad 0: si el duelo empató, la bola queda
jugable con calidad 1. Un error de recepción sí termina el rally.

### 10.2. Armado

```
S = clamp(
  calidad_pase
  - (distancia > 2 ? 1 : 0)
  - (no es armador ni líbero ? 2 : 0)
  - (Técnica <= 3 ? 1 : 0),
  0, 3
)
```

El líbero es armador de emergencia: no paga la penalización de clase. Si el
armado da 0, el punto es rival y la UI lo advierte.

### 10.3. Ataque

```
A = Potencia
  + calidad_armado
  + bonus_de_tipo
  + 3
  - (|columna_atacante - columna_objetivo| >= 2 ? 1 : 0)
  + (colocación o finta en esquina ? 2 : 0)
```

### 10.4. Defensa

```
defensor = el mejor del esquema para esa zona
D = 3
  + stat_del_esquema
  + bonus_de_clase
  + bonus_de_posición (salvo Rápido)
  + bonus_de_zona_del_esquema
  + matchup[esquema][ataque]
```

- Muro y Profunda premian la misma columna; Abierto y Líbero premian alcanzar
  la celda.
- El Rápido ignora el bonus de posición.

### 10.5. Resultado

```
delta = A - D
```

| Condición | Resultado |
|---|---|
| `delta >= 1` | Punto del atacante |
| `delta <= -2` y esquema de red | Bloqueo: punto de la defensa |
| resto | Dig, calidad `delta === 0 ? 1 : clamp(-delta, 1, 3)` |

Los esquemas de red son Muro y Bloqueo abierto. Los demás siempre hacen dig.

### 10.6. Energía

- Arranca en 2. Tope 3.
- Un pase perfecto (calidad 3) devuelve +1.
- Costos: Potencia 2, Wipe 2, Pipe 3, el resto 0.
- La energía no se acumula entre rallies.

---

## 11. IA

- **Siempre se compromete antes**: `withHiddenChoice` corre después de cada
  `reduce` y guarda `hiddenChoice` en el estado.
- **Defensa:** pesa clase de atacante, calidad del armado, historial de ataques
  rivales y evita repetir el último esquema. Un ruido con semilla le da margen
  para sorprender.
- **Ataque:** evalúa cada tipo/zona contra los 4 esquemas, con pesos según el
  historial defensivo rival. Elige entre las opciones casi óptimas, no siempre
  la mejor.
- **Saque:** apunta al receptor más débil, pero no siempre; un saque predecible
  regala pases perfectos.
- **Recepción/armado:** elige el receptor de mayor calidad y el armador de
  mejor combinación calidad/clase/distancia.
- El RNG tiene semilla. La resolución no usa azar.

---

## 12. Partido y puntuación

| Regla | Valor |
|---|---|
| Puntos por set | 7 |
| Ventaja de 2 | No |
| Punto por rally | Sí, siempre |
| Saque | Lo saca el ganador del punto |
| Tope de ataques por rally | 20 (para evitar rallies infinitos) |
| Duración objetivo | 5-8 minutos |

---

## 13. UI / UX

### 13.1. Layout vertical

```
┌──────────────────────────┐
│ HUD: marcador · fase · energía │
├──────────────────────────┤
│ TABLERO RIVAL            │
│ ───────── RED ─────────  │
│ TABLERO PROPIO           │
├──────────────────────────┤
│ VENTANA DE COMANDOS      │
│  fase · pistas · botones │
├──────────────────────────┤
│ Log / tutorial           │
└──────────────────────────┘
```

- Ancho máximo 430 px, centrado. Sin scroll en 360×640.
- Una acción por fase. Los botones son grandes y con verbo claro.
- El tablero solo resalta lo que se puede tocar.
- El cut-in ocupa toda la pantalla y se avanza tocando.

### 13.2. Cut-in

- Fondo oscuro con retratos pixelados grandes, `VS` y nombres.
- Texto tipo typewriter con el relato del duelo.
- Sello de resultado: `¡PUNTO!`, `BLOQUEO`, `DIG Q2`.
- Marcador y número de rally congelados al momento del duelo.

### 13.3. Claridad

- Sin `A/B/D`, sin porcentajes y sin nombres de esquema antes de elegir.
- El tutorial enseña el loop en 2 rallies.
- “Cómo se juega” explica pistas, energía y zonas de cada ataque.
- El log usa lenguaje llano: “Punto para Local (3-2)”.

---

## 14. Dirección de arte

- Pixel art de 8/16 bits, paleta azul noche + dorado + rojo.
- Marcos pixelados, scanlines suaves, tipografía de mayúsculas.
- Retratos geométricos de 12×12 como placeholder.
- Chiptune y SFX sintetizados con WebAudio.
- Sin arte final hasta cerrar el playtest.

---

## 15. Arquitectura técnica

- Vite + React + TypeScript + Zustand + Vitest.
- `src/engine/` es puro: tipos, reglas, geometría, resolución, reducer, IA y
  simulador.
- `src/game/` contiene el store, el tablero, los menús, el cut-in, el tutorial,
  los retratos y el sonido.
- El reducer es determinista y no muta el estado de entrada.
- `withHiddenChoice` es la única capa que agrega la apuesta de la IA.
- Deploy en Vercel con Root Directory = `app`.

---

## 16. Balance de referencia (500 partidos IA vs IA)

| Métrica | Resultado |
|---|---|
| Win rate local / rival | 49.4% / 50.6% |
| Rallies por partido | 12.0 |
| Comandos por partido | 53.8 |
| Ataques por rally | 1.24 |
| Pases 0/1/2/3 | 0 / 2825 / 2743 / 449 (7.5% perfectos) |
| Armados 0/1/2/3 | 0 / 3988 / 2841 / 609 |
| Ataques | 7438 |
| Bloqueos | 20.6% |
| Digs | 19.1% |
| Puntos de ataque | 60.3% |
| Tipos | potencia 1122 · colocación 1550 · rápido 1677 · pipe 178 · wipe 807 · finta 2104 |
| Esquemas | muro 3716 · abierto 1372 · profunda 1733 · líbero 617 |

**Lectura:** los seis ataques y los cuatro esquemas aparecen. La finta y el
rápido son los ataques más usados; el pipe queda como jugada de pase
perfecto. El win rate está equilibrado.

---

## 17. Métricas de playtest

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Duración del set | 5-8 min | Cronómetro |
| Ataques por rally | 1.2-2.2 | Log |
| Pases perfectos | 5-15% | Contador |
| Bloqueos | 15-25% | Contador |
| Digs | 15-25% | Contador |
| Puntos de ataque | 55-65% | Contador |
| Win rate vs IA | 40-60% | 20 partidas |
| “Jugaría otro set” | 4/5 | Encuesta |
| Entiende las pistas sin ayuda | 4/5 | Observación |
| Entiende el resultado del cut-in | 4/5 | Observación |

Si los digs son muy raros, bajar `SCHEME_BASE` o el umbral de bloqueo. Si los
bloqueos dominan, subir el bonus de Wipe/Finta o bajar el de Muro. Una palanca
por vez y volver a simular.

---

## 18. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El jugador no entiende que el rival ya eligió | Alto | Pista visible + copy “El rival ya eligió” |
| Las pistas se sienten arbitrarias | Alto | Son siempre veraces y se explican en el tutorial |
| Cut-in repetitivo | Medio | Textos por tipo de ataque y resultado; sellos distintos |
| Partido demasiado corto | Medio | 7 puntos y rallies de 1.2 ataques dan 5-8 min |
| Una jugada domina | Medio | Matriz 6×4 + simulación de 500 partidos |
| Mobile con scroll | Alto | Layout fijo, pruebas en 360×640 y 390×844 |
| IA predecible | Medio | Ruido con semilla + historial + anti-repetición |

---

## 19. Fuera del MVP

- Rotación, 6v6, sustituciones.
- Progresión, niveles, equipo, gacha.
- Historia, campaña, diálogos largos.
- Online, cuentas, backend.
- Guardado y reanudación.
- Saques con riesgo, out, faltas de red, antenas.
- Habilidades de clase (quedan como idea post-MVP).
- Arte final y sprites.
- Localización más allá del español.

---

## 20. Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-26 | Vertical 9:16, un set a 7, 4v4 | Sesión mobile de 5-8 min |
| 2026-10-26 | Duelo oculto con respuesta rival comprometida | Evitar el preview que resolvía el puzzle |
| 2026-10-26 | Cuatro esquemas defensivos en lugar de movimiento | El movimiento libre no se entendía y no aportaba |
| 2026-10-26 | Sin `undo` | El cut-in ya revela la apuesta |
| 2026-10-26 | Pistas según Lectura (1 o 2) | Dar valor a una stat de lectura sin revelar el resultado |
| 2026-10-26 | Líbero armador de emergencia | Evitar la cadena de errores de armado |
| 2026-10-26 | Alcance ortogonal | El diagonal convertía al líbero en cobertura total |
| 2026-10-26 | Rápido solo por el centro e ignora posición | Tenía que dejar de ser un ataque gratis sin costo |
| 2026-10-26 | Finta solo al fondo | Diferenciarla de Colocación y evitar el spam |
| 2026-10-26 | `SCHEME_BASE` 3 y bonus de ataque 2 | Bajar los puntos automáticos y dar lugar al dig |

---

## 21. Preguntas abiertas

- ¿La finta necesita seguir siendo gratis?
- ¿El jugador defiende suficiente para aprender los esquemas?
- ¿La pista de la zona rival es demasiada información?
- ¿7 puntos alcanzan para que aparezca la lectura entre esquemas?
- ¿El cut-in necesita un botón explícito además del “tocá para seguir”?
- ¿El tablero 3×2 se lee bien con 8 fichas en un celular chico?
