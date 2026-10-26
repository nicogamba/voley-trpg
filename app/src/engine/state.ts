import { otherSide } from './geometry'
import {
  AP_PER_POSSESSION,
  CLASS_NAMES,
  CLASS_ORDER,
  CLASS_STATS,
  FORMATION,
  TARGET_SCORE,
} from './rules'
import type {
  Ball,
  Cell,
  ClassId,
  Col,
  GameState,
  Player,
  Side,
} from './types'

export const createPlayers = (): Player[] => {
  const players: Player[] = []
  for (const side of ['home', 'away'] as Side[]) {
    for (const classId of CLASS_ORDER) {
      const base = FORMATION[classId]
      const col = (side === 'home' ? base.col : 2 - base.col) as Col
      players.push({
        id: `${side}-${classId}`,
        side,
        classId,
        name: CLASS_NAMES[classId],
        stats: { ...CLASS_STATS[classId] },
        cell: { side, row: base.row, col },
      })
    }
  }
  return players
}

export const initialBall = (server: Side): Ball => ({
  cell: { side: server, row: 1, col: 0 },
  pressure: 'free',
  quality: 0,
  lastTouchId: null,
})

export type CreateMatchOptions = {
  targetScore?: number
  server?: Side
}

export const createMatch = (options: CreateMatchOptions = {}): GameState => {
  const server = options.server ?? 'home'
  return {
    phase: 'SERVE',
    score: { home: 0, away: 0 },
    server,
    possession: server,
    ap: 0,
    reactionAp: 0,
    players: createPlayers(),
    ball: initialBall(server),
    passQuality: 0,
    setQuality: 0,
    tempo: null,
    attackerId: null,
    targetScore: options.targetScore ?? TARGET_SCORE,
    winner: null,
    rallyNumber: 1,
    touches: 0,
    rallyAttacks: 0,
    log: [],
  }
}

/** Reinicia posiciones para el próximo rally. Sin rotación en el MVP. */
export const resetForServe = (state: GameState, server: Side): void => {
  state.phase = 'SERVE'
  state.score = { ...state.score }
  state.server = server
  state.possession = server
  state.ap = 0
  state.reactionAp = 0
  state.players = createPlayers()
  state.ball = initialBall(server)
  state.passQuality = 0
  state.setQuality = 0
  state.tempo = null
  state.attackerId = null
  state.rallyNumber += 1
  state.touches = 0
  state.rallyAttacks = 0
}

/** Deja el estado listo para la posesión del equipo que acaba de recibir. */
export const startPossession = (
  state: GameState,
  side: Side,
  ball: Ball,
  passQuality: number,
): void => {
  state.possession = side
  state.ball = ball
  state.passQuality = passQuality as GameState['passQuality']
  state.setQuality = 0
  state.tempo = null
  state.attackerId = null
  state.ap = AP_PER_POSSESSION
  state.reactionAp = 0
  state.touches = 1
  state.phase = 'SET'
}

export const defendingSide = (state: GameState): Side =>
  otherSide(state.possession)

export const playerById = (
  state: GameState,
  id: string | null,
): Player | undefined =>
  id ? state.players.find((player) => player.id === id) : undefined

export const playersOf = (state: GameState, side: Side): Player[] =>
  state.players.filter((player) => player.side === side)

export const cellKeyOf = (cell: Cell): string =>
  `${cell.side}:${cell.row}:${cell.col}`

export const isOccupied = (
  state: GameState,
  cell: Cell,
  ignorePlayerId?: string,
): boolean =>
  state.players.some(
    (player) =>
      player.id !== ignorePlayerId &&
      player.cell.side === cell.side &&
      player.cell.row === cell.row &&
      player.cell.col === cell.col,
  )

export const classOf = (
  state: GameState,
  side: Side,
  classId: ClassId,
): Player =>
  state.players.find(
    (player) => player.side === side && player.classId === classId,
  )!
