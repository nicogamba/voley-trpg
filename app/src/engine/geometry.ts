import type { Cell, Col, Player, Row, Side } from './types'

export const otherSide = (side: Side): Side =>
  side === 'home' ? 'away' : 'home'

export const sideName = (side: Side): string =>
  side === 'home' ? 'Local' : 'Rival'

export const sameCell = (a: Cell, b: Cell): boolean =>
  a.side === b.side && a.row === b.row && a.col === b.col

export const cellKey = (cell: Cell): string =>
  `${cell.side}:${cell.row}:${cell.col}`

export const orthogonalDistance = (a: Cell, b: Cell): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

export const moveDistance = (a: Cell, b: Cell): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

/** Las 4 celdas ortogonalmente vecinas dentro del mismo lado. */
export const orthogonalNeighborCells = (from: Cell): Cell[] => {
  const result: Cell[] = []
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const row = from.row + dr
    const col = from.col + dc
    if (row < 0 || row > 1 || col < 0 || col > 2) continue
    result.push({ side: from.side, row: row as Row, col: col as Col })
  }
  return result
}

/** Alcance de recepción/defensa: la propia celda y las ortogonalmente adyacentes. */
export const reaches = (from: Cell, to: Cell): boolean =>
  from.side === to.side && orthogonalDistance(from, to) <= 1

export const cellsOfSide = (side: Side): Cell[] => {
  const cells: Cell[] = []
  for (const row of [0, 1] as Row[]) {
    for (const col of [0, 1, 2] as Col[]) {
      cells.push({ side, row, col })
    }
  }
  return cells
}

export const cell = (side: Side, row: Row, col: Col): Cell => ({
  side,
  row,
  col,
})

/** Las 8 celdas vecinas dentro del mismo lado. */
export const neighborCells = (from: Cell): Cell[] => {
  const result: Cell[] = []
  for (const dr of [-1, 0, 1]) {
    for (const dc of [-1, 0, 1]) {
      if (dr === 0 && dc === 0) continue
      const row = from.row + dr
      const col = from.col + dc
      if (row < 0 || row > 1 || col < 0 || col > 2) continue
      result.push({ side: from.side, row: row as Row, col: col as Col })
    }
  }
  return result
}

export const zoneOf = (row: Row, col: Col): number => {
  if (row === 0) return [4, 3, 2][col]
  return [5, 6, 1][col]
}

export const zoneLabel = (target: Cell): string =>
  `zona ${zoneOf(target.row, target.col)}`

/**
 * Una costura es una celda vacía a la que llegan dos o más jugadores del
 * mismo equipo. Recibir ahí aplica -1.
 */
export const isSeam = (
  players: Player[],
  target: Cell,
  side: Side,
): boolean => {
  const occupied = players.some(
    (p) => p.side === target.side && sameCell(p.cell, target),
  )
  if (occupied) return false
  const receivers = players.filter(
    (p) => p.side === side && reaches(p.cell, target),
  )
  return receivers.length >= 2
}
