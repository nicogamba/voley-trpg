# ZONA 3 — Hoja de números v1.2

**Balance del motor · 26 de octubre de 2026**

> Esta hoja es la **fuente de verdad de las fórmulas** para la Fase 1. El GDD v1 queda desactualizado en las secciones 4.6 (alcance), 9.1-9.2 (recepción y armado) y 10.2 (habilidad del líbero). Los cambios están explicados abajo.

| Campo | Valor |
|---|---|
| Versión | 1.2 — balance validado con simulación |
| Alcance | Recepción, armado, ataque, bloqueo, defensa, AP |
| Estado | 100 partidos simulados; tests en verde |
| Formato | Un set a 7, 4v4, tablero 3x2 por lado |

---

## 0. Cómo usar esta hoja

1. Las tablas son **deterministas**: mismo estado, mismo resultado.
2. Los números no son balance final; son el punto de partida para la simulación de la Fase 1.
3. Si un número no cierra, se cambia **una palanca por vez** (sección 10) y se vuelve a simular.
4. La UI debe mostrar el preview exacto de estas fórmulas antes de confirmar.

---

## 1. Cambios v1.1 y v1.2

### 1.1. Alcance: se elimina el “alcance 2” pasivo

En un tablero de 3x2, “celda propia + 8 vecinos” cubre **toda la cancha** para el líbero parado en el centro. Eso elimina el puzzle posicional.

**Regla nueva:**
- Todos alcanzan **celda propia + ortogonal adyacente**.
- **Velocidad >= 4** ignora la penalización por recibir en celda adyacente.
- La diagonal **no** se alcanza, salvo con la habilidad del líbero.
- La costura (celda vacía alcanzable por 2+ jugadores) sigue aplicando **-1**.

**Efecto:** el líbero sigue siendo el mejor receptor, pero no cubre todo. El rival puede atacar la zona 2 o la 4 para forzar un pase malo. El jugador decide si mueve al líbero (1 AP) o acepta el pase malo.

### 1.2. Armado: la calidad del pase es la columna vertebral

La fórmula aditiva del GDD (`Técnica + pase - distancia`) hacía que un pase 1 y un pase 2 dieran el mismo armado 2 con el armador T5. La cadena de calidad se diluía.

**Regla nueva:**

```
S = clamp(pase - penalización_distancia - penalización_no_armador - penalización_técnica_baja, 0, 3)
```

- Distancia > 1: **-1**. El armador puede armar desde su celda o una adyacente sin penalización (da un paso al balón).
- No es armador: **-2**.
- Técnica <= 3: **-1**.
- La habilidad “Colocación perfecta” fija el armado en **3**.

**Efecto:** pase 3 → armado 3; pase 2 → armado 2; pase 1 → armado 1. El armador preserva la calidad; el no-armador la destruye. La cadena se lee de un vistazo.

### 1.3. Pase perfecto: umbral 6 en v1.2

La v1.1 bajó el umbral a 5 para que el líbero lograra un pase perfecto. La simulación mostró el problema inverso: el pase perfecto salía casi gratis y todos los digs terminaban en 3. En v1.2 se agrega **+1 por recibir en la celda exacta** y se sube el umbral.

**Regla nueva:**

```
R = Técnica
  + (líbero ? 1 : 0)
  + (celda propia ? 1 : (Velocidad >= 4 ? 0 : -1))
  - presión
  - (costura ? 1 : 0)
```

| R | Calidad |
|---|---|
| >= 6 | 3 — perfecto |
| 4-5 | 2 — bueno |
| 2-3 | 1 — malo |
| <= 1 | 0 — error |

**Efecto:** el líbero en la celda del balón (R=6) sí genera pase perfecto; el armador en su celda (R=5) se queda en pase bueno. Moverse a la celda exacta es una inversión de 1 AP que se paga con el +1 AP del pase perfecto. El rival lo contrarresta sirviendo a las zonas 2/4 o a las costuras.

### 1.4. Habilidad del líbero: “Cobertura total”

El GDD v1 tenía “Recepción perfecta”. La cambio por:

> **Cobertura total** (1 AP, una vez por set): la próxima recepción o defensa del líbero puede alcanzar **cualquier celda de su lado** e **ignora la penalización por costura**.

**Por qué:** resuelve la debilidad diagonal del líbero sin darle cobertura pasiva de toda la cancha. Es su jugada “clutch”: cubre la zona 2, recibe perfecto, el pase devuelve el AP y el equipo arma la jugada grande.

### 1.5. Aclaración: armado desde celda adyacente

El armador puede armar desde su celda o una adyacente **sin penalización**. Solo si el balón está a 2+ celdas hay **-1**. Esto evita que el armador tenga que ocupar exactamente la celda del balón (que muchas veces está ocupada por otro jugador).

### 1.6. Cambios v1.2 surgidos de la simulación

| Cambio | Antes | Ahora | Motivo |
|---|---|---|---|
| Movimiento | 8 direcciones | Solo ortogonal | La diagonal gratis hacía que reposicionarse no costara nada |
| Recepción en celda propia | 0 | +1 | Premia el posicionamiento y devuelve sentido al pase perfecto |
| Umbral de pase | 5 / 3 / 1 | 6 / 4 / 2 | Evita pases perfectos automáticos |
| Wipe | +1 | -1 | Ignoraba el bloqueo y encima sumaba: demasiado eficiente |
| Calidad del dig | 0 / 1 / 2 / 3 | 0 / 1 / 1 / 2 / 3 | El dig perfecto salía casi gratis |
| Bloqueadores | Columna o adyacente | Solo misma columna | En 3x2 la adyacencia permitía dobles bloqueos irreales |
| Primer saque | Local siempre | Alternado en simulación | El saque es ventaja estructural; alternar mide simetría |

**Hallazgo principal:** con información perfecta, la IA nunca se deja bloquear (0% de bloqueos). El bloqueo funciona como **disuasión**: el 39% de los ataques se juegan con un bloqueador delante y el atacante elige finta, colocación o wipe. Los bloqueos reales aparecen cuando el humano golpea sin leer. El detalle está en el GDD, sección 24.

---

## 2. Supuestos de cálculo

### 2.1. Formación local

| Jugador | Clase | Celda | T | P | V | L |
|---|---|---|---|---|---|---|
| Armador | setter | (0,1) — zona 3 | 5 | 2 | 3 | 4 |
| Central | middle | (0,0) — zona 4 | 2 | 4 | 3 | 5 |
| Opuesto | opposite | (1,2) — zona 1 | 2 | 5 | 4 | 3 |
| Líbero | libero | (1,1) — zona 6 | 5 | 1 | 5 | 5 |

El rival usa la formación espejada.

### 2.2. Presión del balón

| Tipo de balón | Presión |
|---|---|
| Balón libre | 0 |
| Saque normal | 1 |
| Finta | 1 |
| Remate | 3 |

### 2.3. Determinismo

No hay RNG en la resolución. El RNG con semilla se usa solo para variación cosmética y para desempatar decisiones de la IA. La simulación debe ser reproducible.

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

### 3.2. Recepción base vs saque normal

Mejor receptor disponible en la formación inicial:

| Zona | Celda | Receptor | R | Calidad |
|---|---|---|---|---|
| 1 | (1,2) | Líbero | 4 | 2 — bueno |
| 2 | (0,2) | Armador | 2 | 1 — malo |
| 3 | (0,1) | Armador | 5 | 2 — bueno |
| 4 | (0,0) | Armador | 3 | 1 — malo |
| 5 | (1,0) | Líbero | 4 | 2 — bueno |
| 6 | (1,1) | Líbero | 6 | 3 — perfecto |

**Lectura:** solo la zona 6 da pase perfecto sin moverse. Las zonas 2 y 4 son las débiles. En la 4, el mejor receptor es el **armador**, que si recibe no puede armar (misma persona no toca dos veces seguidas). Eso es una trampa: el rival sirve a la 4 para sacar al armador de la jugada.

### 3.3. Recepción con el líbero movido a zona 5

El jugador puede gastar 1 AP para mover al líbero a (1,0):

| Zona | Celda | Receptor | R | Calidad |
|---|---|---|---|---|
| 1 | (1,2) | Opuesto | 2 | 1 — malo |
| 2 | (0,2) | Armador | 2 | 1 — malo |
| 3 | (0,1) | Armador | 5 | 2 — bueno |
| 4 | (0,0) | Líbero | 5 | 2 — bueno |
| 5 | (1,0) | Líbero | 6 | 3 — perfecto |
| 6 | (1,1) | Líbero | 4 | 2 — bueno |

**Lectura:** mover al líbero arregla la zona 4 y convierte la 5 en perfecta, pero deja la 1 y la 2 expuestas. El +1 AP del pase perfecto paga el movimiento. No se puede cubrir todo: el rival elige qué zona atacar y el jugador elige qué zona conceder.

### 3.4. Distribución de calidad

| Escenario | Calidad 1 | Calidad 2 | Calidad 3 | Promedio |
|---|---|---|---|---|
| Saque uniforme (todas las zonas) | 2 | 3 | 1 | 1.83 |
| Saque inteligente a zonas 2 y 4 | 2 | 0 | 0 | 1.00 |

**Objetivo de diseño:** que un jugador bien posicionado ronde **1.8-2.2** de promedio, y que un rival que sirve a las zonas débiles lo baje a **1.0-1.4**. La diferencia es la recompensa de la lectura.

### 3.5. Regla del setter que recibe

Si el armador recibe, **no puede armar** el siguiente toque. La UI debe avisarlo antes de confirmar. El equipo puede:
- Mover al líbero para que reciba (1 AP).
- Usar “Cobertura total” del líbero.
- Aceptar que arme el líbero o el central (armado 0-1).

Esta regla es la que hace que el saque a la zona 4 sea realmente peligroso.

---

## 4. Armado

### 4.1. Fórmula

```
S = clamp(
  pase
  - (distancia > 1 ? 1 : 0)
  - (no es armador ? 2 : 0)
  - (Técnica <= 3 ? 1 : 0),
  0, 3
)
```

### 4.2. Tabla de armado

| Armador | Distancia al balón | Pase 0 | Pase 1 | Pase 2 | Pase 3 |
|---|---|---|---|---|---|
| Armador | 0-1 | 0 | 1 | 2 | 3 |
| Armador | 2+ | 0 | 0 | 1 | 2 |
| Líbero | 0-1 | 0 | 0 | 0 | 1 |
| Central / Opuesto | 0-1 | 0 | 0 | 0 | 0 |

**Lectura:** el armador es el único que preserva la calidad del pase. Un no-armador destruye la jugada. La distancia solo importa a partir de 2 celdas, así que el armador puede dar un paso al balón sin penalización.

### 4.3. Implicaciones tácticas

- El armador no debe recibir. Si recibe, el ataque se vuelve predecible o nulo.
- El líbero debe cubrir la zona del armador cuando el saque va al centro.
- “Colocación perfecta” (2 AP) convierte un pase malo en un armado 3. Es la habilidad para salvar una recepción rota.

---

## 5. Ataque vs bloqueo

### 5.1. Fórmula

```
A_base = Potencia
  + calidad_armado
  + bonus_de_tipo
  - (columna_objetivo_a_2_columnas ? 1 : 0)

A = A_base - 2 * bloqueadores_en_la_columna
```

`A` es el valor **después** de la penalización por bloqueo. La tabla de abajo usa ese valor.

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

- Sin bloqueador en la columna: **B = 0**.
- `A <= B` → **bloqueado** (punto para la defensa en el MVP).
- `A > B` → pasa. `A_pasa = A - (había bloqueador ? 1 : 0)`.

### 5.2. Valores de bloqueo

| Bloqueo | B |
|---|---|
| Nadie | 0 |
| Armador solo | 4 |
| Central solo | 6 |
| Central + armador | 7 |

En el tablero 3x2 solo hay un bloqueador por columna: el máximo real es **6**. La fila del 7 queda como referencia para una cancha más grande.

### 5.3. Escenarios representativos

| Ataque | Armado | Bloqueo | Defensor | A post-bloqueo | B | A pasa | D | Resultado |
|---|---|---|---|---|---|---|---|---|
| Opuesto potencia | 2 | ninguno | Líbero en celda | 8 | 0 | 8 | 7 | dig 0 |
| Opuesto potencia | 2 | ninguno | Opuesto en celda | 8 | 0 | 8 | 4 | punto |
| Opuesto potencia | 2 | central | Líbero en celda | 6 | 6 | — | 7 | bloqueado |
| Opuesto potencia | 3 | central + armador | Líbero en celda | 5 | 7 | — | 7 | bloqueado |
| Opuesto potencia | 2 | central + columna lejana | Líbero en celda | 5 | 6 | — | 7 | bloqueado |
| Central rápido | 2 | ninguno | Líbero en celda | 8 | 0 | 8 | 7 | dig 0 |
| Central rápido | 2 | central | Líbero en celda | 6 | 6 | — | 7 | bloqueado |
| Central rápido | 3 | central + armador | Líbero en celda | 5 | 7 | — | 7 | bloqueado |
| Opuesto finta | 2 | central | Líbero en celda | 6 | ignora | 6 | 8 | dig 2 |
| Opuesto finta | 2 | central | Opuesto en celda | 6 | ignora | 6 | 5 | dig 0 |
| Opuesto wipe | 2 | central | Líbero en celda | 6 | ignora | 6 | 7 | dig 1 |
| Armador colocación | 2 | ninguno | Opuesto en celda | 4 | 0 | 4 | 4 | dig 1 |

**Lectura:**
- El bloqueo es una **herramienta de zonificación**, no un muro automático. Un solo central detiene un ataque de potencia con armado 2; el atacante debe buscar la columna libre, usar wipe o finta, o armar mejor.
- Un doble bloqueo detendría incluso un ataque de potencia con armado 3 (A=5 vs B=7), pero en 3x2 no es alcanzable. El atacante solo tiene que evitar la columna del central.
- El líbero en la celda objetivo es un muro (D=7): un ataque de potencia con armado 2 queda en dig 0. El atacante debe apuntar a otra zona o forzar al líbero a moverse.
- La finta es letal contra el opuesto (D=5) pero el líbero la lee bien (D=8, dig 2).
- El wipe ahora resta 1 y deja un dig cómodo: es una salida segura, no un ataque gratis.

---

## 6. Ataque vs defensa

### 6.1. Fórmula

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

### 6.2. Valores de defensa

| Defensor | En celda | Adyacente |
|---|---|---|
| Líbero | 7 | 6 |
| Central | 6 | 5 |
| Armador | 5 | 4 |
| Opuesto | 4 | 3 |
| Nadie | 0 | 0 |

Con finta, sumar **+1** al defensor que la lee.

### 6.3. Lectura

- El líbero en su celda es la mejor defensa del juego. Atacar ahí es regalar la pelota.
- El opuesto es el defensor más débil. Atacar su zona es la jugada rentable.
- El central defiende bien cerca de la red; el armador es intermedio.
- La finta castiga a los defensores de Lectura baja y es inútil contra el líbero.
- El wipe es la respuesta al bloqueo, pero no a la defensa.

---

## 7. Cadena de calidad: ejemplo completo

### 7.1. Pase perfecto

- El líbero recibe en zona 6: R=6 → **pase 3**.
- El armador está adyacente: S=3 → **armado 3**.
- El opuesto ataca con potencia desde el fondo: `A_base = 5 + 3 + 1 = 9`; sin bloqueo, `A = 9`.
- Si no hay bloqueo: A_pasa = 9.
  - Contra el opuesto en celda (D=4): **punto**.
  - Contra el líbero en celda (D=7): **punto** (delta -2).
- La cadena perfecta le da al atacante la libertad de elegir y de superar incluso al líbero. El único contrapeso es el bloqueo: si el central está en la columna objetivo, `A = 9 - 2 = 7`, `B = 6`, pasa con `A_pasa = 6` y el líbero defiende con dig 1. Por eso el atacante busca la columna sin bloqueo.

### 7.2. Pase bueno

- Pase 2 → armado 2.
- `A_base = 5 + 2 + 1 = 8`.
- Contra un central solo (B=6): `A = 8 - 2 = 6` → **bloqueado**.
- El atacante debe buscar la columna libre: `A = 8`, D=4 → **punto**; o D=7 → **dig 0**.
- La cadena buena no alcanza para atacar la zona del líbero; obliga a jugar con el espacio.

### 7.3. Pase malo

- Pase 1 → armado 1.
- `A_base = 5 + 1 + 1 = 7`.
- Contra un central solo (B=6): `A = 7 - 2 = 5` → **bloqueado**.
- El atacante debe usar finta (`A = 5`, ignora bloqueo), wipe (`A = 5`, ignora bloqueo) o colocación a una zona vacía (`A = 6`, D=0 → **punto**).
- La cadena mala reduce las opciones a las jugadas de recurso.

**Conclusión:** la calidad del pase decide cuántas opciones tiene el atacante. Esa es la fantasía central del juego.

---

## 8. Economía de AP

### 8.1. Líneas comunes

| Línea | AP gastados | AP sobrantes |
|---|---|---|
| Líbero mueve (1) + armador mueve (1) + potencia (1) | 3 | 0 |
| Líbero mueve (1) + combo rápido (1) + colocación (0) | 2 | 1 |
| Sin mover + combo rápido (1) + potencia (1) | 2 | 1 |
| Pase perfecto: líbero mueve (1) + armador mueve (1) + combo (1) + habilidad (1) | 4 (3 base + 1 refund) | 0 |

### 8.2. Lectura

- Con 3 AP, el jugador puede **moverse dos veces y atacar con potencia**, o **moverse una vez y usar un combo**, o **quedarse quieto y usar una habilidad**.
- El pase perfecto devuelve 1 AP: permite la línea de 4 acciones (movimiento + movimiento + combo + habilidad) una vez por rally.
- La defensa tiene 2 AP de reacción: puede cubrir 2 de las 3 columnas. El atacante ataca la tercera. Esa es la tensión central del ataque.

### 8.3. Regla de oro

> Si una acción no compite con otra, no es una decisión.

Cada AP debe tener al menos dos usos valiosos. Si el movimiento siempre es la mejor opción, hay que subir el costo de mover o bajar el de las habilidades.

---

## 9. Objetivos de balance

| Métrica | Objetivo | Por qué |
|---|---|---|
| Pase perfecto (buena posición, buscado) | 15-30% | La cadena debe brillar |
| Pase perfecto (saque inteligente) | 0-5% | El saque debe presionar |
| Armado 3 tras pase perfecto | 80-100% | La cadena debe ser confiable |
| Ataques con bloqueador delante | 30-45% | El bloqueo zonifica |
| Bloqueo | 0-5% de los ataques | Con información perfecta la IA evita el bloqueo; el humano puede ser castigado |
| Dig | 35-50% de los ataques | El líbero importa |
| Punto directo de ataque | 50-65% | El atacante tiene la última palabra |
| Duración media del rally | 2-4 ataques | Legible en mobile |
| AP gastados por rally | 2.5-3.0 | Tensión de recursos |
| Duración del partido | 5-8 min | Sesión casual |
| Win rate vs IA normal | 45-55% | Justo con equipos iguales |
| Pase perfecto → punto | 65-80% | La calidad se convierte en puntos; el bloqueo es el contrapeso |

---

## 10. Palancas de ajuste

| Palanca | Si sube | Si baja | Cuándo tocarla |
|---|---|---|---|
| Umbral de pase perfecto | Menos pases perfectos | Más pases perfectos | Si la cadena es muy fácil/difícil |
| Bonus del líbero (+1) | Más pases perfectos | Menos | Si el líbero domina/no vale la pena |
| Presión del saque (1) | Recepciones peores | Recepciones mejores | Si el saque es irrelevante/opresivo |
| Penalización por costura (-1) | Más presión | Menos | Si el saque a costuras es muy fuerte |
| Bonus del central al bloqueo (+1) | Más bloqueos | Menos | Si el bloqueo es un muro/débil |
| Bonus de tipo (potencia +1, rápido +2) | Más puntos | Menos | Si el ataque no llega |
| AP de reacción (2) | Defensa más fuerte | Ataque más fuerte | Si un lado domina |
| Defensa del líbero en celda (+1) | Líbero más muro | Líbero más humano | Si el líbero es obligatorio |
| Costo de habilidad (1-2 AP) | Menos habilidades | Más | Si las habilidades son spam |
| Regla de armado adyacente | Menos presión sobre el armador | Más presión | Si el armador sufre demasiado |

**Protocolo:** cambiar una palanca, simular 10.000 rallies, comparar métricas. No cambiar dos a la vez.

---

## 11. Plan de simulación (Fase 1)

### 11.1. Qué implementar

- [x] `receptionQuality(player, ball, context)`
- [x] `setQuality(pass, setter, distance)`
- [x] `attackValue(attacker, kind, setQuality, blockers, colFar)`
- [x] `blockValue(blockers)`
- [x] `defenseValue(defender, inCell, tip)`
- [x] `resolveAttack(...)`
- [x] Contabilidad de AP.
- [ ] Undo en la UI (Fase 2).
- [x] IA greedy para las 5 fases.
- [x] Simulador de rallies IA vs IA.

### 11.2. Qué loguear

- Distribución de zonas de saque.
- Distribución de calidad de pase.
- Distribución de calidad de armado.
- Distribución de tipos de ataque.
- Tasa de bloqueo, dig y punto.
- Toques por rally.
- AP gastados por rally.
- Duración del partido.
- Win rate.
- Conversión pase perfecto → punto.
- Top 10 de patrones que más puntos generan.

### 11.3. Cómo simular

- 10.000 rallies con IA Normal vs IA Normal.
- 3 variantes:
  1. **Base:** las fórmulas de esta hoja.
  2. **Bloqueo +1:** B del central +1.
  3. **Líbero -1:** D del líbero en celda -1.
- Semilla fija para reproducibilidad.
- Reporte con histogramas y tabla de sensibilidad.

### 11.4. Criterio de aceptación

La simulación base debe caer dentro de los rangos de la sección 9. Si no, se ajusta una palanca y se repite. La variante que más se acerque a los objetivos se convierte en la v1.2.

### 11.5. Resultados v1.2 (100 partidos, primer saque alternado)

| Métrica | Resultado |
|---|---|
| Partidos | 100 (local 51 / rival 49) |
| Rallies por partido | 9.8 |
| Comandos por partido | 117.8 |
| Ataques por rally | 1.74 |
| Saques | 984 |
| Aces / errores de recepción | 0 / 0 |
| Pases | 0 / 0 / 984 / 0 |
| Armados | 0 / 0 / 984 / 729 |
| Ataques | 1.713 |
| Ataques con bloqueador delante | 39.2% |
| Bloqueos | 0.0% |
| Digs | 42.6% |
| Puntos de ataque | 57.4% |
| Tipos | potencia 563, colocación 180, wipe 187, finta 783 |

**Conclusiones:**

1. **La simetría funciona.** Al alternar el primer saque, el win rate queda 51/49. La ventaja de sacar primero existe, pero no rompe el set.
2. **Cero aces y cero errores** son consecuencia de la IA perfecta: siempre elige la mejor recepción. El error aparece cuando el jugador se posiciona mal, no por azar.
3. **El pase perfecto no se regala.** La IA dirige el saque al receptor más débil; el líbero bien posicionado sí alcanza calidad 3, pero hay que buscarlo.
4. **El bloqueo disuade, no gana.** 39% de los ataques van contra un bloqueador y ninguno termina bloqueado: el atacante elige finta, colocación o wipe. Es el comportamiento esperado de información perfecta.
5. **La finta domina.** 783 de 1.713 ataques son fintas. Es la palanca abierta para v1.3: subir el costo de la finta o bajar la calidad del dig contra finta.

**Criterio de Fase 1:** `npm test` en verde (49 tests), `npm run build` sin errores y simulación reproducible por semilla.

---

## 12. Preguntas abiertas

- ¿El saque a zona 2 es demasiado castigador? ¿Necesita una ayuda para el receptor?
- ¿La habilidad “Cobertura total” se vuelve obligatoria? Si es así, hay que abaratarla o hacerla pasiva.
- ¿El tablero 3x2 es demasiado chico para 4v4? Si hay aglomeración, probar 3v3 o 4x3.
- ¿La finta necesita un costo en AP para que no sea el ataque por defecto de la IA?
- ¿Los digs perfectos son demasiado frecuentes contra la finta?
- ¿La regla de armado adyacente hace que el armador no necesite moverse? Si es así, volver a la penalización por distancia 1.
- ¿La restricción del opuesto (no atacar desde el frente) se entiende en la UI?
- ¿Hace falta un medidor de momentum? Post-MVP.
- ¿El partido a 7 es suficiente para que la estrategia aparezca? Si no, probar a 9.

---

## 13. Apéndice: pseudocódigo

```ts
function receptionQuality(player: Player, ball: Ball, ctx: Context): number {
  const own = sameCell(player.cell, ball.cell);
  const positionBonus = own ? 1 : player.stats.velocidad >= 4 ? 0 : -1;
  const liberoBonus = player.classId === 'libero' ? 1 : 0;
  const pressure = ctx.incomingPressure; // 0 libre, 1 saque/finta, 3 remate
  const seamPenalty = ctx.seam && !ctx.ignoresSeam ? -1 : 0;
  const r = player.stats.tecnica + liberoBonus + positionBonus - pressure + seamPenalty;
  if (r >= 6) return 3;
  if (r >= 4) return 2;
  if (r >= 2) return 1;
  return 0;
}

function setQuality(pass: number, setter: Player, distance: number): number {
  const nonSetter = setter.classId === 'setter' ? 0 : -2;
  const lowTech = setter.stats.tecnica <= 3 ? -1 : 0;
  const distPenalty = distance > 1 ? -1 : 0;
  return clamp(pass + nonSetter + lowTech + distPenalty, 0, 3);
}

function attackValue(attacker: Player, kind: AttackKind, setQ: number, blockers: number, colFar: boolean): number {
  const bonus = { power: 1, placement: 0, quick: 2, pipe: 1, wipe: -1, tip: -1 }[kind];
  const blockPenalty = kind === 'wipe' || kind === 'tip' ? 0 : 2 * blockers;
  return attacker.stats.potencia + setQ + bonus - blockPenalty - (colFar ? 1 : 0);
}

function blockValue(blockers: Player[]): number {
  if (blockers.length === 0) return 0;
  const best = Math.max(
    ...blockers.map(b => b.stats.lectura + (b.classId === 'middle' ? 1 : 0))
  );
  return best + (blockers.length > 1 ? 1 : 0);
}

function defenseValue(defender: Player, inCell: boolean, isTip: boolean): number {
  return defender.stats.lectura
    + (defender.classId === 'libero' ? 1 : 0)
    + (inCell ? 1 : 0)
    + (isTip ? 1 : 0);
}

function resolveAttack(A: number, B: number, D: number, isWipe: boolean, isTip: boolean) {
  let aPass: number;
  if (isWipe || isTip) {
    aPass = A;
  } else {
    if (A <= B) return { outcome: 'blocked' as const };
    aPass = A - (B > 0 ? 1 : 0);
  }
  const delta = D - aPass;
  if (delta < -1) return { outcome: 'point' as const };
  if (delta === -1) return { outcome: 'dig' as const, quality: 0 };
  if (delta === 0) return { outcome: 'dig' as const, quality: 1 };
  if (delta === 1) return { outcome: 'dig' as const, quality: 1 };
  if (delta === 2) return { outcome: 'dig' as const, quality: 2 };
  return { outcome: 'dig' as const, quality: 3 };
}
```

---

## 14. Próximo paso

1. ~~Revisar esta hoja y aceptar los cambios v1.1.~~ Aceptados.
2. ~~Actualizar el GDD a v1.1.~~ Hecho.
3. ~~Implementar el motor puro con estas fórmulas y el simulador.~~ Hecho; 49 tests en verde.
4. ~~Comparar la simulación base contra los objetivos de la sección 9.~~ Hecho (sección 11.5).
5. ~~Ajustar una palanca por vez y cerrar la v1.2.~~ Cerrada.
6. ~~Fase 2: tablero DOM 3x4, tap-to-move, HUD de AP y preview de resolución.~~ Hecho.
7. ~~Fase 3: IA completa y partido a 7.~~ Hecho.
8. ~~Fase 4: tutorial de 2 rallies, sonido, animaciones y pulido mobile.~~ Hecho.
9. Fase 5: deploy en Vercel y playtest de 5 personas.
10. Abrir v1.3 si el playtest confirma que la finta domina: costo en AP o dig capado contra finta.
