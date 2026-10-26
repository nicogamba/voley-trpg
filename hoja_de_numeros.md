# ZONA 3 — Hoja de números v1.3

**Balance del motor “duelo oculto” · 26 de octubre de 2026**

> Fuente de verdad de las fórmulas del prototipo. Reemplaza a la hoja v1.2.
> El diseño está en `gdd_v1.3.md`.

| Campo | Valor |
|---|---|
| Versión | 1.3 — duelo oculto |
| Alcance | Saque, recepción, armado, seis ataques, cuatro esquemas, energía |
| Estado | 500 partidos simulados; 63 tests en verde |
| Formato | Un set a 7, 4v4, tablero 3×2 por lado |

---

## 0. Cómo leer esta hoja

1. La resolución es determinista: mismo estado + mismas elecciones = mismo
   resultado.
2. Lo único oculto es la elección rival. La IA se compromete antes.
3. Los números son un punto de partida; se ajustan con la simulación, una
   palanca por vez (sección 9).
4. La UI no muestra `A`, `D` ni probabilidades antes del cut-in. Esta hoja es
   para diseño y balance, no para el jugador.

---

## 1. Cambios v1.3

| Cambio | v1.2 | v1.3 |
|---|---|---|
| Defensa | Mover bloqueadores con 2 AP | Elegir uno de 4 esquemas |
| Preview | `A/B/D` exacto antes de confirmar | Solo pistas; el resultado se revela en el cut-in |
| Movimiento | 1 AP por celda | Eliminado |
| Undo | Permitido | Eliminado |
| Resolución | Bloqueo y defensa separados | Un duelo `A - D` |
| AP | 3 ofensivos + 2 defensivos | 2, tope 3, pase perfecto +1 |
| Alcance | Ortogonal | Ortogonal (sin cambios) |
| Armado del líbero | Penalización de clase | Sin penalización: armador de emergencia |
| Distancia de armado | `> 1` → -1 | `> 2` → -1 |

**Hallazgo principal:** con el rival comprometido antes, el jugador no puede
“resolver” el puzzle mirando números. La decisión se muda a la lectura de
pistas y a la gestión de energía. Eso permite bajar los puntos automáticos y
darle lugar al dig.

---

## 2. Supuestos

### 2.1. Formación local

| Jugador | Clase | Celda | T | P | V | L |
|---|---|---|---|---|---|---|
| Armador | setter | (0,1) | 5 | 2 | 3 | 4 |
| Central | middle | (0,0) | 2 | 4 | 3 | 5 |
| Opuesto | opposite | (1,2) | 2 | 5 | 4 | 3 |
| Líbero | libero | (1,1) | 5 | 1 | 5 | 5 |

El rival usa la formación espejada.

### 2.2. Presión

| Balón | Presión |
|---|---|
| Libre | 0 |
| Saque | 1 |
| Finta | 1 |
| Remate | 3 |

### 2.3. Alcance y costuras

- Recepción/defensa: celda propia + 4 ortogonales.
- Costura: celda vacía alcanzable por 2+ jugadores. `-1`.
- La diagonal no se alcanza.

### 2.4. Determinismo

La resolución no usa RNG. El RNG con semilla solo varía decisiones de la IA y
desempates. La simulación es reproducible por semilla.

---

## 3. Recepción

### 3.1. Fórmula

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

### 3.2. Mejor receptor por zona (saque, presión 1)

| Zona | Celda | Receptor | R | Calidad | Costura |
|---|---|---|---|---|---|
| 4 | (0,0) | Armador | 3 | 1 — mala | No |
| 3 | (0,1) | Armador / Líbero | 5 | 2 — buena | No |
| 2 | (0,2) | Armador | 2 | 1 — mala | Sí |
| 5 | (1,0) | Líbero | 4 | 2 — buena | Sí |
| 6 | (1,1) | Líbero | 6 | 3 — perfecta | No |
| 1 | (1,2) | Líbero | 5 | 2 — buena | No |

**Lectura:** solo la zona 6 da pase perfecto sin ayuda. Las zonas 2 y 4 son las
débiles. El líbero cubre 1 y 5 con pase bueno. El armador que recibe no arma el
toque siguiente, pero el líbero lo reemplaza sin penalización de clase.

### 3.3. Dig

El dig usa la misma fórmula con la presión del remate (3). Después de un dig, la
calidad del dig es la calidad del pase de la siguiente posesión.

**Regla del piso:** un dig nunca queda en calidad 0. Si el duelo empató
(`delta = 0`), la bola queda jugable con calidad 1.

---

## 4. Armado

```
S = clamp(
  calidad_pase
  - (distancia > 2 ? 1 : 0)
  - (no es armador ni líbero ? 2 : 0)
  - (Técnica <= 3 ? 1 : 0),
  0, 3
)
```

| Armador | Distancia <= 2 | Distancia 3 |
|---|---|---|
| Armador | `pase` | `pase - 1` |
| Líbero | `pase` | `pase - 1` |
| Central / Opuesto | 0 | 0 |

Con pase 0/1/2/3:

| Armador | d<=2 | d=3 |
|---|---|---|
| Armador | 0 / 1 / 2 / 3 | 0 / 0 / 1 / 2 |
| Líbero | 0 / 1 / 2 / 3 | 0 / 0 / 1 / 2 |
| Central / Opuesto | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |

**Lectura:** el armador preserva la calidad. El líbero lo reemplaza si el
armador recibió. Un central u opuesto armando destruye la jugada.

---

## 5. Ataque

### 5.1. Fórmula

```
A = Potencia
  + calidad_armado
  + bonus_de_tipo
  + 3
  - (|columna_atacante - columna_objetivo| >= 2 ? 1 : 0)
  + (colocación o finta en esquina ? 2 : 0)
```

“Esquina” = columna 0 o 2.

### 5.2. Tipos

| Tipo | Bonus | Costo | Condición |
|---|---|---|---|
| Potencia | +2 | 2 AP | Ninguna |
| Colocación | 0 | 0 AP | Ninguna; +2 en esquina |
| Rápido | +2 | 0 AP | Central; solo columna 1; ignora posición del defensor |
| Pipe | +2 | 3 AP | Opuesto desde la fila de fondo |
| Wipe | +2 | 2 AP | Ninguna |
| Finta | 0 | 0 AP | Solo fila de fondo; +2 en esquina |

### 5.3. Valores de referencia (armado 2)

| Atacante | Potencia | Colocación | Rápido | Pipe | Wipe | Finta |
|---|---|---|---|---|---|---|
| Armador | 9 | 9 | — | — | 9 | 9 |
| Central | 11 | 11 | 11 | — | 11 | 11 |
| Opuesto | 12 | 12 | — | 12 | 12 | 12 |

El valor bruto se parece; lo que cambia es la zona legal, el costo y el matchup
con el esquema.

### 5.4. Legalidad

- El líbero no ataca.
- El rápido solo lo usa el central y solo apunta a la columna 1.
- La finta solo apunta a la fila de fondo.
- El pipe solo lo usa el opuesto desde la fila de fondo.
- Opuesto y líbero no atacan desde la fila de frente.
- El ataque siempre va al campo rival.

---

## 6. Defensa

### 6.1. Esquemas

| Esquema | Stat | Bonus de clase | Bonus de posición | Bonus de zona |
|---|---|---|---|---|
| Muro | Lectura | Central +1 | Misma columna +1 | Fila de frente +1 |
| Bloqueo abierto | Velocidad | Líbero +1 | Alcanza la celda +1 | Siempre +1 |
| Defensa profunda | Lectura | Líbero +1 | Misma columna +1 | Fila de fondo +1 |
| Líbero atento | Técnica | Líbero +2 | Alcanza la celda +1 | Columna 1 +1 |

El defensor es el jugador del esquema con mayor valor para esa zona:

- Muro elige solo jugadores de la fila de frente, sin líbero.
- Profunda elige solo jugadores de la fila de fondo.
- Abierto y Líbero eligen entre los cuatro.

El **Rápido ignora el bonus de posición**: la defensa no llega a acomodarse.

### 6.2. Matchup

`SCHEME_EDGE[esquema][ataque]`: positivo = el esquema frena; negativo = el
ataque castiga.

| | Potencia | Colocación | Rápido | Pipe | Wipe | Finta |
|---|---|---|---|---|---|---|
| Muro | +2 | 0 | +2 | -2 | -2 | -2 |
| Bloqueo abierto | -2 | +2 | -2 | 0 | +2 | +2 |
| Profunda | +2 | -2 | 0 | +2 | +2 | -2 |
| Líbero atento | -2 | +2 | -2 | -2 | 0 | +2 |

### 6.3. Fórmula de defensa

```
D = 3
  + stat_del_esquema
  + bonus_de_clase
  + bonus_de_posición (salvo Rápido)
  + bonus_de_zona
  + matchup
```

### 6.4. Ejemplo: central potencia armado 2, atacando (0,0)

| Esquema | Defensor | D | Resultado |
|---|---|---|---|
| Muro | Central rival | 12 | Dig Q1 |
| Bloqueo abierto | Líbero rival | 8 | Punto |
| Profunda | Líbero rival | 11 | Dig Q1 |
| Líbero atento | Líbero rival | 8 | Punto |

El mismo ataque cambia de resultado según el esquema. Esa es la apuesta oculta.

---

## 7. Resolución del duelo

```
delta = A - D
```

| Condición | Resultado |
|---|---|
| `delta >= 1` | Punto del atacante |
| `delta <= -2` y esquema de red | Bloqueo: punto de la defensa |
| resto | Dig con calidad `delta === 0 ? 1 : clamp(-delta, 1, 3)` |

- Esquemas de red: Muro y Bloqueo abierto.
- Los esquemas de fondo siempre hacen dig.
- El bloqueo suma el punto a la defensa y termina el rally.
- El dig cambia la posesión y el rally sigue.

### 7.1. Matriz de ejemplo (central, potencia, armado 2, zona 4 rival)

| `delta` | Resultado |
|---|---|
| +3 | Punto |
| +1 | Punto |
| 0 | Dig Q1 |
| -1 | Dig Q1 |
| -2 | Bloqueo (Muro/Abierto) o Dig Q2 (fondo) |
| -3 | Bloqueo o Dig Q3 |

---

## 8. Energía

| Regla | Valor |
|---|---|
| Inicial | 2 |
| Tope | 3 |
| Pase perfecto | +1 |
| Potencia / Wipe | 2 |
| Pipe | 3 |
| Colocación / Rápido / Finta | 0 |
| Acumulación entre rallies | No |

La energía es un **portón**, no una moneda: con 2 AP el jugador puede atacar con
Potencia o Wipe; con 3 AP se habilita el Pipe. No hay razón para “ahorrar” AP
porque no se acumula.

---

## 9. Simulación (500 partidos, semilla 1)

| Métrica | Resultado |
|---|---|
| Partidos | 500 (local 247 / rival 253) |
| Win rate | 49.4% / 50.6% |
| Rallies por partido | 12.0 |
| Comandos por partido | 53.8 |
| Ataques por rally | 1.24 |
| Saques | 6017 |
| Aces / errores de recepción | 0 / 0 |
| Pases 0/1/2/3 | 0 / 2825 / 2743 / 449 (7.5% perfectos) |
| Armados 0/1/2/3 | 0 / 3988 / 2841 / 609 |
| Ataques | 7438 |
| Bloqueos | 20.6% |
| Digs | 19.1% |
| Puntos de ataque | 60.3% |
| Duelos con matchup | 86.9% |
| Tipos | potencia 1122 · colocación 1550 · rápido 1677 · pipe 178 · wipe 807 · finta 2104 |
| Esquemas | muro 3716 · abierto 1372 · profunda 1733 · líbero 617 |
| Digs por calidad | Q0 0 · Q1 1163 · Q2 98 · Q3 160 |
| Puntos | ataque 4482 · bloqueo 1535 · error 0 · tope 0 |

### 9.1. Lectura

1. **Simetría:** 49.4/50.6 con el primer saque alternado.
2. **Los seis ataques aparecen.** La finta y el rápido son los más usados; el
   pipe queda como jugada de pase perfecto.
3. **Los cuatro esquemas aparecen.** Muro es el más común porque frena los dos
   ataques más usados; Líbero es el menos común.
4. **El dig ya no es residual:** 19.1% de los ataques, suficiente para que el
   rally respire.
5. **El bloqueo dejó de ser una lotería:** 20.6%, y castiga al que ataca sin
   leer.
6. **Cero aces y cero errores** son consecuencia de la IA perfecta. La presión
   del saque se mide en calidad de pase, no en errores.

---

## 10. Objetivos y palancas

### 10.1. Objetivos de balance

| Métrica | Objetivo | Estado |
|---|---|---|
| Win rate | 45-55% | 49.4/50.6 |
| Ataques por rally | 1.2-2.2 | 1.24 |
| Pases perfectos | 5-15% | 7.5% |
| Bloqueos | 15-25% | 20.6% |
| Digs | 15-25% | 19.1% |
| Puntos de ataque | 55-65% | 60.3% |
| Duración del set | 5-8 min | A validar en playtest |

### 10.2. Palancas

| Palanca | Si sube | Si baja |
|---|---|---|
| `SCHEME_BASE` | Más digs/bloqueos, menos puntos | Más puntos |
| Bonus de ataque | Más puntos | Más digs |
| Matchup `±2` | Más castigo a la elección equivocada | Más ruido |
| Umbral de bloqueo (`-2`) | Más bloqueos | Más digs |
| Costo del Pipe | Menos pipe | Más pipe |
| Ruido de la IA | Más variedad, menos adaptación | IA más predecible |
| Pesos del historial | IA más adaptativa | IA más aleatoria |

**Protocolo:** cambiar una palanca, simular 500 partidos, comparar. No cambiar
dos a la vez.

---

## 11. Preguntas abiertas

- ¿La finta gratis sigue siendo el ataque por defecto?
- ¿El Líbero atento necesita un empujón para aparecer más?
- ¿El jugador defiende lo suficiente para aprender los esquemas?
- ¿La pista de zona del ataque rival es demasiada información?
- ¿El pipe merece un costo menor ahora que el pase perfecto es raro?
- ¿El bloqueo debe dar el punto directo o generar una cobertura?
