import type { AttackKind, DefenseScheme, Quality } from '../engine'
import type { CourtPlayer, CourtTeam, Side } from '../court/types'

/** Cómo se presenta la mitad superior de la pantalla. */
export type SceneMode = 'field' | 'closeup' | 'duel' | 'result'

/** Lado que tiñe el cuadro de acción. */
export type SceneTone = Side | 'neutral'

export type ScenePose =
  | 'serve'
  | 'receive'
  | 'set'
  | 'spike'
  | 'block'
  | 'dig'
  | 'celebrate'

export type SceneEffect = 'speed' | 'impact' | 'dust' | 'flash'

/** Planos de impacto compartidos entre equipos. */
export type ShotId =
  | 'serve'
  | 'readyToServe'
  | 'duel'
  | 'attack2'
  | 'attack4'
  | 'block'
  | 'receive'
  | 'receiveAlt'
  | 'set'
  | 'dig'
  | 'point'
  | 'error'
  | 'errorNet'
  | 'freeBall'
  | 'celebrate'
  | 'defeat'

export type Expression =
  | 'neutral'
  | 'excited'
  | 'shocked'
  | 'worried'
  | 'triumphant'

export type ActionFrameSpec = {
  mode: SceneMode
  actorId?: string
  rivalId?: string
  banner?: string
  stamp?: string
  tone?: SceneTone
  effect?: SceneEffect
  pose?: ScenePose
  shot?: ShotId
}

export type Speaker = 'comentador' | 'jugador' | 'rival'

export type CommentaryLine = {
  speaker: Speaker
  expression: Expression
  text: string
}

export type Scene = {
  id: string
  frame: ActionFrameSpec
  line: CommentaryLine
  /** Marcador que se muestra al entrar en la escena. */
  score?: Record<Side, number>
}

/** Contexto de la decisión que originó la jugada. */
export type SceneMeta = {
  serveType?: 'power' | 'float' | 'short'
  defenseScheme?: DefenseScheme
  attackKind?: AttackKind
  quality?: Quality | null
}

export type CommandOption = {
  id: string
  label: string
  note?: string
  disabled?: boolean
  actor?: CourtPlayer
}

export type PresentationTeams = Record<Side, CourtTeam>
