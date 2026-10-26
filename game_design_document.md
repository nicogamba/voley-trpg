# GDD & AI Agent Prompt: Tactical Volley RPG

## 1. Contexto del Proyecto
Queremos desarrollar un prototipo jugable para un juego web casual, con estética pixel art y diseño "mobile-first" (responsive, orientación vertical). 
El juego es una mezcla entre un RPG Táctico por turnos y Voleibol. 

## 2. Stack Tecnológico
*   **Entorno:** Vite (rápido, ideal para Vercel).
*   **Framework:** React (recomendado para manejar el estado complejo del tablero) con TypeScript.
*   **Estilos:** TailwindCSS (para prototipado rápido de la UI) o CSS puro.
*   **Despliegue:** Vercel (el proyecto debe estar configurado para un deploy continuo sencillo).
*   **Assets:** Marcadores de posición (placeholders) de colores sólidos o divs simples hasta tener los assets pixel art.

## 3. Core Gameplay y Mecánicas Básicas
El juego se basa en resolver "puzzles tácticos" en una cuadrícula. El tiempo se pausa antes de cada interacción del balón, permitiendo al jugador gastar Puntos de Acción (AP).

### 3.1. El Tablero (Grid)
*   Vista isométrica o top-down 2D.
*   El campo de juego consta de dos mitades. Cada mitad es una cuadrícula de 3x3.
*   Interacciones táctiles: Tap para seleccionar, Tap para mover/actuar.

### 3.2. Clases de Personajes (RPG)
Cada equipo tiene 3 jugadores en cancha:
1.  **Líbero (Defensa):** Alto rango de movimiento, bonificación al recibir saques o remates.
2.  **Armador (Soporte):** Su función es potenciar (buff) a los rematadores.
3.  **Rematador (DPS):** Estadísticas altas de salto y potencia para superar bloqueos.

### 3.3. Sistema de Turnos y AP (Action Points)
*   El jugador tiene **3 AP** por fase (turno).
*   Mover a un jugador 1 casilla cuesta 1 AP.
*   Usar habilidades especiales cuesta AP.
*   La regla de 3 toques del vóley dicta el flujo del turno.

## 4. Máquina de Estados (State Machine) del Juego
El agente debe estructurar la lógica del partido utilizando los siguientes estados secuenciales:

1.  **`STATE_SERVE` (Saque):** El equipo al saque elige una casilla objetivo.
2.  **`STATE_RECEIVE` (Recepción):** El juego se pausa. El jugador usa AP para mover a su Líbero a la casilla de impacto prevista. Se calcula Éxito/Fallo.
3.  **`STATE_SET` (Armado):** El juego se pausa. El jugador usa AP para mover a su Armador al balón y a su Rematador a la red. El Armador elige a quién asistir.
4.  **`STATE_ATTACK` (Remate vs Bloqueo):** El jugador elige la casilla objetivo en el campo rival. El rival genera un bloqueo automático. Se calcula si el balón pasa, rebota o es bloqueado.
5.  **`STATE_RESOLVE` (Resolución):** Si la pelota toca el suelo, se asigna el punto. Si la pelota es defendida, se cambia la posesión y el estado vuelve a `STATE_RECEIVE` para el otro equipo.
6.  **`STATE_SCORE` (Puntuación):** Se actualiza el marcador. Si hubo cambio de saque (Side-out), el equipo rota posiciones. Los partidos son a 5 puntos.

## 5. UI / UX
*   **Layout Vertical:** Mitad superior de la pantalla = Campo rival; Mitad inferior = Campo propio.
*   **HUD:** Marcador en la parte superior, contador de AP disponible, y un log de texto pequeño (ej: "¡Recepción perfecta!", "Bloqueo superado") en el centro.
*   **Controles:** No hay joystick. Se toca una unidad para seleccionarla, y luego se toca la cuadrícula para moverla o ejecutar una acción (Tap-to-move).

---

## 6. Instrucciones para el Agente IA (Roadmap Inicial)

**Fase 1: Setup y Estructura Base**
1. Inicializa un proyecto con Vite + React + TypeScript.
2. Configura una estructura de estado global (usando Context API o Zustand) para manejar la `GameState` (marcadores, turnos, posiciones en la cuadrícula).

**Fase 2: El Tablero y Entidades**
1. Renderiza un tablero de 3x6 (3x3 por equipo) visualmente claro usando CSS Grid.
2. Crea objetos de datos (entidades) para 3 jugadores de un equipo y 3 del rival, asignándoles posiciones iniciales (x, y) en el grid. Renderízalos como círculos de colores.

**Fase 3: Lógica de Interacción (El Micro-bucle)**
1. Implementa el flujo de estados (`SERVE` -> `RECEIVE` -> `SET` -> `ATTACK`).
2. Agrega la lógica de selección: Permite hacer click en un jugador aliado y luego en una casilla adyacente para moverlo, descontando 1 AP.
3. Simula una jugada de extremo a extremo sin cálculos matemáticos complejos todavía (que la pelota viaje de un lado a otro confirmando clicks).

**Por favor, comienza ejecutando la Fase 1 y Fase 2, y muestra el código base del componente principal del tablero.**