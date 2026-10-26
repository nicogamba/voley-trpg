export type Side = 'home' | 'away'
export type Row = 0 | 1
export type Col = 0 | 1 | 2

export type Cell = {
  side: Side
  row: Row
  col: Col
}

export type ClassId = 'setter' | 'middle' | 'opposite' | 'libero'

export type Stats = {
  tecnica: number
  potencia: number
  velocidad: number
  lectura: number
}

export type Player = {
  id: string
  side: Side
  classId: ClassId
  name: string
  stats: Stats
  cell: Cell
}

export type BallPressure = 'free' | 'serve' | 'tip' | 'attack'

export type Quality = 0 | 1 | 2 | 3

export type Tempo = 'high' | 'quick' | 'back'

export type AttackKind =
  | 'power'
  | 'placement'
  | 'quick'
  | 'pipe'
  | 'wipe'
  | 'tip'

export type Phase =
  | 'SERVE'
  | 'RECEIVE'
  | 'SET'
  | 'BLOCK_COMMIT'
  | 'ATTACK'
  | 'MATCH_END'

export type Ball = {
  cell: Cell
  pressure: BallPressure
  quality: Quality
  lastTouchId: string | null
}

export type LogEntry = {
  text: string
  tone: 'neutral' | 'good' | 'bad'
}

export type GameState = {
  phase: Phase
  score: Record<Side, number>
  server: Side
  possession: Side
  ap: number
  reactionAp: number
  players: Player[]
  ball: Ball
  passQuality: Quality
  setQuality: Quality
  tempo: Tempo | null
  attackerId: string | null
  targetScore: number
  winner: Side | null
  rallyNumber: number
  touches: number
  rallyAttacks: number
  log: LogEntry[]
}

export type AttackOutcome = 'point' | 'dig' | 'blocked'

export type AttackResolution = {
  A: number
  B: number
  A_pass: number
  D: number
  outcome: AttackOutcome
  digQuality: Quality | null
  defenderId: string | null
  blockerIds: string[]
}

export type PointReason = 'ace' | 'error' | 'block' | 'attack' | 'cap'

export type EngineEvent =
  | { type: 'SERVE'; server: Side; target: Cell }
  | {
      type: 'MOVE'
      playerId: string
      from: Cell
      to: Cell
      phase: Phase
    }
  | {
      type: 'RECEIVE'
      playerId: string | null
      value: number
      quality: Quality
      outcome: 'ok' | 'ace' | 'error'
      seam: boolean
    }
  | {
      type: 'SET'
      setterId: string
      targetId: string
      tempo: Tempo
      quality: Quality
      outcome: 'ok' | 'error'
    }
  | { type: 'SHIFT'; playerId: string; from: Cell; to: Cell }
  | {
      type: 'ATTACK'
      playerId: string
      kind: AttackKind
      target: Cell
      resolution: AttackResolution
    }
  | {
      type: 'POINT'
      side: Side
      reason: PointReason
      score: Record<Side, number>
    }
  | { type: 'MATCH_END'; winner: Side; score: Record<Side, number> }
  | { type: 'PHASE'; phase: Phase }

export type Command =
  | { type: 'SERVE'; target: Cell }
  | { type: 'MOVE'; playerId: string; to: Cell }
  | { type: 'RECEIVE'; playerId: string | null }
  | {
      type: 'SET'
      setterId: string
      targetId: string
      tempo: Tempo
    }
  | { type: 'SHIFT'; playerId: string; to: Cell }
  | { type: 'COMMIT_BLOCK' }
  | { type: 'ATTACK'; playerId: string; kind: AttackKind; target: Cell }

export type ReduceResult = {
  state: GameState
  events: EngineEvent[]
}
