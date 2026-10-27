import type { CourtCell, CourtCol, CourtRow, Side, Vec } from './types'

/**
 * Coordenadas lógicas de la cancha. El canvas mide 360x400 y se escala
 * con CSS; todo se dibuja en estas unidades.
 *
 * Ariba juega el rival, abajo el jugador. Cada lado tiene 3 filas:
 * fila 0 pegada a la red, fila 2 en el fondo.
 */
export const COURT = {
  width: 360,
  height: 484,
  left: 8,
  top: 14,
  cellW: 86,
  cellH: 76,
  netY: 242,
} as const

export const ROWS: CourtRow[] = [0, 1, 2]
export const COLS: CourtCol[] = [0, 1, 2, 3]

export const otherSide = (side: Side): Side =>
  side === 'home' ? 'away' : 'home'

export const sameCell = (a: CourtCell, b: CourtCell): boolean =>
  a.side === b.side && a.row === b.row && a.col === b.col

export const cellKey = (cell: CourtCell): string =>
  `${cell.side}:${cell.row}:${cell.col}`

export const cell = (
  side: Side,
  row: CourtRow,
  col: CourtCol,
): CourtCell => ({ side, row, col })

/** Espeja una columna al otro lado de la red (4 columnas). */
export const mirrorCol = (col: CourtCol): CourtCol =>
  (3 - col) as CourtCol

export const cellOrigin = (target: CourtCell): Vec => ({
  x: COURT.left + target.col * COURT.cellW,
  y:
    target.side === 'away'
      ? COURT.top + (2 - target.row) * COURT.cellH
      : COURT.netY + target.row * COURT.cellH,
})

export const cellCenter = (target: CourtCell): Vec => {
  const origin = cellOrigin(target)
  return {
    x: origin.x + COURT.cellW / 2,
    y: origin.y + COURT.cellH / 2,
  }
}

/** Distancia en celdas (rey: diagonal cuenta 1). */
export const cellDistance = (a: CourtCell, b: CourtCell): number =>
  a.side === b.side
    ? Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
    : Number.POSITIVE_INFINITY

/** Alcance de un jugador parado en `from` para jugar una pelota en `to`. */
export const reaches = (from: CourtCell, to: CourtCell): boolean =>
  cellDistance(from, to) <= 1

export const cellsOfSide = (side: Side): CourtCell[] => {
  const result: CourtCell[] = []
  for (const row of ROWS) {
    for (const col of COLS) result.push({ side, row, col })
  }
  return result
}

export const allCells = (): CourtCell[] => [
  ...cellsOfSide('away'),
  ...cellsOfSide('home'),
]

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t

export const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value))

/** Ease suave para que los desplazamientos no arranquen a los golpes. */
export const ease = (t: number): number => {
  const x = clamp01(t)
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2
}

/**
 * Punto de la cancha a partir de una celda y una altura sobre el piso.
 * La altura se resta en Y: cuanto más alto, más arriba se dibuja.
 */
export const screenPoint = (target: CourtCell, z = 0): Vec => {
  const center = cellCenter(target)
  return { x: center.x, y: center.y - z }
}
