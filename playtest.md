# Playtest ZONA 3 v1.3 — guion y planilla

Objetivo: validar que el **duelo oculto** se entiende sin ayuda, que las pistas
alcanzan para decidir y que dan ganas de jugar otro set.

Formato: 5 personas, sesión de 15 minutos, una por una. Moderador con cronómetro
y planilla. No se explica ninguna regla antes de la portada.

## Antes de empezar

- Servir la build de producción (`npm run build && npm run preview`) o la URL
  de Vercel.
- Dispositivo principal: celular real en vertical. Secundario: desktop con
  ventana angosta.
- Grabar pantalla si se puede. Confirmar sonido activo y volumen audible.
- Verificar que no haya scroll vertical ni recortes en 360×640 y 390×844.

## Qué cambió y qué hay que observar

En v1.3 el jugador **no ve números antes de elegir**. La IA ya se comprometió y
la UI solo muestra pistas. El resultado (punto, bloqueo o dig) aparece recién en
el cut-in. Tres cosas nuevas para testear:

1. ¿Entiende que el rival ya eligió?
2. ¿Las pistas le sirven para decidir o le parecen ruido?
3. ¿El cut-in le explica qué pasó y por qué?

## Guion (15 min)

1. **Portada (1 min).** “Esto es ZONA 3, un juego de vóley por turnos. Probá lo
   que quieras.”
   - Registrar si entra solo a Tutorial o a Partido rápido.
   - No corregir. Anotar la primera duda.
2. **Tutorial (4 min).** Pedirle que haga el tutorial completo.
   - ¿Lee las tarjetas? ¿Usa Saltar?
   - ¿Entiende que el saque solo elige zona y que no hay preview?
   - ¿Reconoce las pistas del rival en ataque y en defensa?
   - ¿Entiende la energía como portón (2 o 3 AP) y no como moneda?
3. **Partido libre (7 min).** “Jugá un set hasta que termine.”
   - No intervenir salvo bloqueo técnico.
   - Anotar dudas frente a las pistas, el menú de esquemas y el cut-in.
   - Anotar si toca zonas, espera o repite una jugada por costumbre.
4. **Cierre (3 min).** Encuesta oral y una pregunta abierta: “¿Qué cambiarías
   primero?”

## Planilla por tester

| Campo | Valor |
|---|---|
| Tester / fecha | |
| Dispositivo y navegador | |
| Entró por | Tutorial / Partido rápido |
| Completó el tutorial | Sí / No / Saltó |
| Duda principal en el tutorial | |
| Duda principal en el partido | |
| ¿Entendió que el rival elige primero? | Sí / No / Parcial |
| ¿Las pistas le sirvieron para decidir? | Sí / No / Parcial |
| ¿Entendió el resultado del cut-in? | Sí / No / Parcial |
| ¿Distinguió punto / bloqueo / dig? | Sí / No / Parcial |
| ¿Entendió los 4 esquemas? | Sí / No / Parcial |
| ¿Entendió la energía? | Sí / No / Parcial |
| Errores técnicos | |
| Scroll o recorte visual | |
| Duración del set | |
| Resultado del set | |
| ¿Jugaría otro set? (1-5) | |
| ¿Qué cambiaría primero? | |

## Métricas del set (sección 17 del GDD v1.3)

Anotar por partida observada:

| Métrica | Objetivo | Partida 1 | Partida 2 | Partida 3 | Partida 4 | Partida 5 |
|---|---|---|---|---|---|---|
| Duración del set | 5-8 min | | | | | |
| Ataques por rally | 1.2-2.2 | | | | | |
| Pases perfectos | 5-15% | | | | | |
| Bloqueos | 15-25% | | | | | |
| Digs | 15-25% | | | | | |
| Puntos de ataque | 55-65% | | | | | |
| Win rate vs IA | 40-60% | | | | | |
| “Jugaría otro set” | 4/5 | | | | | |
| Entiende las pistas sin ayuda | 4/5 | | | | | |
| Entiende el cut-in | 4/5 | | | | | |

Los porcentajes se estiman contando remates y resultados en el log del set. Para
datos finos, correr la simulación con semilla fija (sección 9 de
`hoja_de_numeros.md`) y comparar contra lo observado.

### Preguntas guía para las métricas cualitativas

- **Pistas:** “¿Qué te dijo esa pista?” y “¿Cambiaste la jugada por lo que
  leíste?”
- **Cut-in:** “Contame qué pasó en esa jugada.” Si no puede nombrar ataque,
  esquema y resultado, el cut-in falla.
- **Esquemas:** “¿Por qué elegiste ese?” Si elige siempre el mismo, el matchup
  no se está leyendo.
- **Energía:** “¿Por qué no usaste Pipe?” para ver si entiende el costo 3.

## Preguntas de cierre

- ¿Qué parte se sintió más clara? ¿Cuál más confusa?
- ¿Las pistas se sienten justas o arbitrarias?
- ¿El cut-in se hace largo o repetitivo en el quinto rally?
- ¿La finta se siente demasiado fuerte por ser gratis?
- ¿El tablero se lee con 8 fichas o se agranda?
- ¿Jugarías otro set ahora? ¿Por qué?

## Criterios de salida

- **Pasa:** 4/5 completa el tutorial sin ayuda, 4/5 jugaría otro set, 4/5
  entiende las pistas y el cut-in, y no hay bugs bloqueantes.
- **Ajustar:** si el set pasa de 8 minutos, si la finta supera el 35% de los
  ataques observados o si las pistas se leen como ruido.
- **Cortar:** si hay que explicar el duelo oculto con la voz del moderador, el
  tutorial no está funcionando.

## Después

- Volcar los datos en la sección 17 del GDD v1.3.
- Decidir **una sola palanca** para v1.4 (finta, pista de zona, costo del Pipe o
  peso de la IA).
- No tocar arte ni sprites hasta cerrar el playtest.
