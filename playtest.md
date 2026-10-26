# Playtest ZONA 3 — guion y planilla

Objetivo: validar que el loop se entiende sin ayuda y que dan ganas de jugar otro rally.
Formato: 5 personas, sesión de 15 minutos, una por una. Moderador con cronómetro y planilla.

## Antes de empezar

- Servir la build de producción (`npm run build && npm run preview`) o la URL de Vercel.
- Dispositivo principal: celular real en vertical. Secundario: desktop con ventana angosta.
- Grabar pantalla si se puede. No explicar reglas antes de la portada.
- Confirmar que el sonido está activo y el volumen audible.

## Guion (15 min)

1. **Portada (1 min).** “Esto es ZONA 3, un juego de vóley por turnos. Probá lo que quieras.”
   - Registrar si entra solo a Tutorial o a Partido rápido.
   - No corregir. Anotar la primera duda.
2. **Tutorial (4 min).** Pedirle que haga el tutorial completo.
   - ¿Lee las tarjetas? ¿Usa Saltar?
   - ¿Entiende el preview de saque y de remate?
   - ¿Encuentra el botón Listo en la lectura defensiva?
3. **Partido libre (7 min).** “Jugá un set hasta que termine.”
   - No intervenir salvo bloqueo técnico.
   - Anotar errores de toque, scroll inesperado y acciones que repite.
4. **Cierre (3 min).** Encuesta oral y una pregunta abierta: “¿Qué cambiarías primero?”

## Planilla por tester

| Campo | Valor |
|---|---|
| Tester / fecha | |
| Dispositivo y navegador | |
| Entró por | Tutorial / Partido rápido |
| Completó el tutorial | Sí / No / Saltó |
| Duda principal en el tutorial | |
| Duda principal en el partido | |
| ¿Entendió A / B / D del preview? | Sí / No / Parcial |
| ¿Usó Deshacer? | Sí / No |
| ¿Usó la lectura defensiva? | Sí / No |
| Errores técnicos | |
| Scroll o recorte visual | |
| Duración del set | |
| Resultado del set | |
| ¿Jugaría otro rally? (1-5) | |
| ¿Qué cambiaría primero? | |

## Métricas del set (sección 18 del GDD)

Anotar por partida observada:

| Métrica | Objetivo | Partida 1 | Partida 2 | Partida 3 | Partida 4 | Partida 5 |
|---|---|---|---|---|---|---|
| Duración del partido | 5-8 min | | | | | |
| Ataques por rally | 2-4 | | | | | |
| Pases perfectos | 5-20% | | | | | |
| Ataques con bloqueador delante | 30-45% | | | | | |
| Bloqueos | 0-5% | | | | | |
| Digs | 35-50% | | | | | |
| AP gastados por rally | 2.5-3.0 | | | | | |
| Win rate vs IA normal | 50-60% | | | | | |
| “Jugaría otro rally” | 4/5 | | | | | |

Los porcentajes de ataques se pueden estimar contando remates y resultados en el log; para datos finos, correr la simulación con la semilla del día y comparar.

## Preguntas de cierre

- ¿Qué parte se sintió más clara? ¿Cuál más confusa?
- ¿El bloqueo se entiende como disuasión o como una lotería?
- ¿La finta se siente demasiado fuerte?
- ¿El tablero se lee con 8 fichas o se agranda?
- ¿Jugarías otro set ahora? ¿Por qué?

## Criterios de salida

- **Pasa:** 4/5 completa el tutorial sin ayuda, 4/5 jugaría otro rally y no hay bugs bloqueantes.
- **Ajustar:** si falla la comprensión de A/B/D, si el set pasa de 8 minutos o si la finta supera el 50% de los ataques.
- **Cortar:** si hay que explicar el loop con la voz del moderador, el tutorial no está funcionando.

## Después

- Volcar los datos en la sección 18 del GDD.
- Decidir una sola palanca para v1.3 (finta, saque o lectura defensiva).
- No tocar arte ni sprites hasta cerrar el playtest.
