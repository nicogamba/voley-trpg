# Playtest CT1 — guion y planilla

Objetivo: validar que la campaña CT1 se entiende sin ayuda y que las
mecánicas nuevas (tensión, saque por zonas, armado que fija atacante, bloqueo
vivo y festejo de punto) se sienten justas.

Formato: **5 personas**, sesión de **15–20 minutos**, una por una. Moderador
con cronómetro y planilla. No se explican reglas antes de empezar.

## Antes de empezar

- Usar la build de producción (`npm run build && npm run preview`) o la URL de
  Vercel.
- Dispositivo principal: celular real en vertical. Secundario: desktop con
  ventana angosta.
- Abrir una ventana privada o borrar `localStorage` para arrancar la campaña
  desde cero.
- Si hace falta reproducir una partida, usar `?seed=123` en la URL y anotar la
  seed. La demo rápida de la final es `?ct1=1`.
- Grabar pantalla si se puede. Confirmar sonido activo.

## Guion (15–20 min)

1. **Portada (2 min).** “Esto es ZONA 3, un juego de vóley por turnos. Probá lo
   que quieras.”
   - Registrar si elige **CAMPAÑA CT1**, MODO V2 o V1.
   - No señalar la ayuda `?`. Anotar si la encuentra solo.
2. **Primera etapa (8–10 min).** Pedirle que juegue hasta terminar el set.
   - No intervenir salvo bloqueo técnico.
   - Anotar la primera duda y el primer error de lectura.
3. **Lectura de mecánicas (3 min).** Sin corregir, preguntar:
   - “¿Qué hace la barra de tensión?”
   - “¿Por qué elegiste esa zona de saque?”
   - “¿Por qué el menú de ataque tiene esos golpes y no otros?”
   - “Contame qué pasó en ese bloqueo.”
   - “¿Qué pasa si perdés la etapa?”
4. **Reintento o siguiente etapa (3 min).** Ver si entiende el progreso y si
   quiere jugar otra.
5. **Cierre (2 min).** Preguntas finales y “¿qué cambiarías primero?”.

## Qué observar

- Tiempo hasta el primer saque.
- Si entiende que el saque es una intención y que el rival puede cubrir.
- Si entiende que el armador fijó al atacante y por eso cambia el menú.
- Si lee el bloqueo como contacto → desenlace (stuff / toque / afuera).
- Si el festejo de punto se siente bien o hace el ritmo largo.
- Si necesita toques de más para avanzar el texto.
- Dificultad por etapa, duración del set y uso en móvil.
- Scroll, recortes o botones incómodos en 360×640 y 390×844.

## Planilla por tester

| Campo | Valor |
|---|---|
| Tester / fecha | |
| Dispositivo y navegador | |
| Entró por | Campaña CT1 / V2 / V1 |
| Encontró la ayuda `?` | Sí / No |
| Primera duda | |
| ¿Entendió la tensión? | Sí / No / Parcial |
| ¿Entendió las zonas de saque? | Sí / No / Parcial |
| ¿Entendió el armado y el menú de ataque? | Sí / No / Parcial |
| ¿Entendió el bloqueo? | Sí / No / Parcial |
| ¿Entendió el reintento/progreso? | Sí / No / Parcial |
| Toques de más para avanzar | |
| Duración del set | |
| Resultado de la etapa | |
| Errores técnicos | |
| ¿Jugaría otra etapa? (1–5) | |
| ¿Qué cambiaría primero? | |

## Métricas para tunear después

- Mezcla de bloqueo actual: **~38% stuff / ~44% toque vivo / ~18% block out**.
- El toque vivo casi siempre lo levanta el líbero con calidad 1. Si el playtest
  pide más dramatismo, subir la dificultad del dig o agregar una tirada de
  control.
- Dificultad de la escalera y duración del set a 25.
- Claridad de los textos de ayuda y de los banners de resultado.

## Criterios de salida

- **Pasa:** 4/5 entiende tensión, saque, ataque y bloqueo sin ayuda; 4/5
  jugaría otra etapa; no hay bugs bloqueantes; el set dura 5–10 minutos.
- **Ajustar:** si hay que explicar el armado o el bloqueo con la voz del
  moderador, si el set pasa de 10 minutos o si el festejo se siente repetitivo.
- **Cortar:** si la campaña no se entiende y la ayuda no alcanza.

## Después

- Volcar los resultados acá y ajustar una cosa por vez.
- Anotar la seed de cualquier partida con un bug para reproducirla.
