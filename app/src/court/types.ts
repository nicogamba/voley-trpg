import type { ClassId, Stats } from '../engine'

export type Side = 'home' | 'away'
export type CourtRow = 0 | 1 | 2
export type CourtCol = 0 | 1 | 2 | 3

export type CourtCell = {
  side: Side
  row: CourtRow
  col: CourtCol
}

export type Vec = { x: number; y: number }

export type Pose =
  | 'idle'
  | 'run'
  | 'jump'
  | 'serve'
  | 'receive'
  | 'set'
  | 'spike'
  | 'dig'
  | 'block'
  | 'celebrate'

export type CourtPlayer = {
  id: string
  side: Side
  classId: ClassId
  name: string
  stats: Stats
  cell: CourtCell
}

export type MoveSpec = {
  playerId: string
  to: CourtCell
  /** Si no se indica, dura lo mismo que el beat. */
  duration?: number
  /** Altura del salto en píxeles lógicos. */
  jump?: number
  pose?: Pose
}

export type BallSpec = {
  to: CourtCell
  /** Altura extra del arco en píxeles. */
  arc?: number
  zFrom?: number
  zTo?: number
  duration?: number
  delay?: number
  kind?: 'serve' | 'pass' | 'set' | 'spike' | 'free'
}

export type BeatKind =
  | 'serve'
  | 'receive'
  | 'set'
  | 'spike'
  | 'block'
  | 'dig'
  | 'point'
  | 'move'
  | 'wait'

/** Duelo que se muestra como cut-in durante un beat. */
export type CutInSpec = {
  kind: 'serve' | 'attack' | 'block'
  leftId: string
  rightId: string
  leftLabel: string
  rightLabel: string
  move: string
}

export type BeatSpec = {
  kind: BeatKind
  duration: number
  caption: string
  actorId?: string
  pose?: Pose
  moves?: MoveSpec[]
  ball?: BallSpec
  fx?: 'hit' | 'block' | 'floor' | 'whistle'
  point?: Side
  cutin?: CutInSpec
}

export type TeamKit = {
  shirt: string
  shorts: string
  trim: string
}

export type CourtTeam = {
  id: string
  name: string
  short: string
  flag: [string, string, string]
  kit: TeamKit
}
