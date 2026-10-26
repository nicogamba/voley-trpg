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

export type AttackKind =
  | 'power'
  | 'placement'
  | 'quick'
  | 'pipe'
  | 'wipe'
  | 'tip'

/** Esquema defensivo comprometido antes de ver la jugada rival. */
export type DefenseScheme = 'wall' | 'spread' | 'deep' | 'libero'

export type AttackPlan = {
  kind: AttackKind
  target: Cell
}

export type Phase =
  | 'SERVE'
  | 'RECEIVE'
  | 'SET'
  | 'ATTACK'
  | 'DEFEND'
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

export type AttackRecord = {
  side: Side
  kind: AttackKind
}

export type DefenseRecord = {
  side: Side
  scheme: DefenseScheme
}

/**
 * La respuesta que espera oculta hasta el cut-in.
 * - `defense`: la eligió la IA mientras el jugador ataca.
 * - `attack`: la eligió la IA mientras el jugador defiende.
 */
export type HiddenChoice =
  | { type: 'defense'; side: Side; scheme: DefenseScheme }
  | { type: 'attack'; side: Side; plan: AttackPlan }

export type GameState = {
  phase: Phase
  /** Lado que maneja el jugador. La IA controla el otro. */
  playerSide: Side
  score: Record<Side, number>
  server: Side
  possession: Side
  ap: number
  players: Player[]
  ball: Ball
  passQuality: Quality
  setQuality: Quality
  attackerId: string | null
  hiddenChoice: HiddenChoice | null
  attackHistory: AttackRecord[]
  defenseHistory: DefenseRecord[]
  targetScore: number
  winner: Side | null
  rallyNumber: number
  touches: number
  rallyAttacks: number
  log: LogEntry[]
}

export type AttackOutcome = 'point' | 'dig' | 'blocked'

export type DuelResolution = {
  /** Ataque: potencia + armado + bonificación + zona. */
  A: number
  /** Defensa: esquema + stat + zona + matchup. */
  D: number
  /** Ventaja del esquema contra ese tipo de ataque. */
  edge: number
  /** Cobertura del esquema sobre la zona elegida. */
  zone: number
  outcome: AttackOutcome
  digQuality: Quality | null
  defenderId: string | null
  blockerIds: string[]
  scheme: DefenseScheme
}

export type PointReason = 'ace' | 'error' | 'block' | 'attack' | 'cap'

export type EngineEvent =
  | { type: 'SERVE'; server: Side; target: Cell }
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
      quality: Quality
      outcome: 'ok' | 'error'
    }
  | {
      type: 'ATTACK'
      playerId: string
      kind: AttackKind
      target: Cell
      scheme: DefenseScheme
      resolution: DuelResolution
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
  | { type: 'RECEIVE'; playerId: string | null }
  | {
      type: 'SET'
      setterId: string
      targetId: string
    }
  | { type: 'ATTACK'; playerId: string; kind: AttackKind; target: Cell }
  | { type: 'DEFEND'; scheme: DefenseScheme }

export type ReduceResult = {
  state: GameState
  events: EngineEvent[]
}
