import { AI_STANDARD, type AiTuning } from './match'
import type { TeamId } from './teams'

export type LadderStage = {
  id: string
  rival: TeamId
  city: string
  round: string
  final?: boolean
  targetScore: number
  /** Ajuste del rival en potencia, velocidad y lectura. */
  boost: number
  /** Ajuste aparte de técnica: mueve recepción y armado. */
  techBoost: number
  ai: AiTuning
}

/**
 * Gira de cinco paradas hasta la final. Los primeros sets son cortos para
 * que la escalera arranque rápido; la final se juega a 7.
 */
export const LADDER: LadderStage[] = [
  {
    id: 'chi',
    rival: 'chi',
    city: 'SANTIAGO',
    round: 'DEBUT',
    targetScore: 5,
    boost: -0.5,
    techBoost: 0,
    ai: { tolerance: 3.4, noise: 0.32, adapt: 0.1, jitter: 0.8, apBonus: 0 },
  },
  {
    id: 'ita',
    rival: 'ita',
    city: 'MILÁN',
    round: 'OCTAVOS',
    targetScore: 5,
    boost: -0.1,
    techBoost: 0,
    ai: { tolerance: 3.0, noise: 0.26, adapt: 0.2, jitter: 0.7, apBonus: 0 },
  },
  {
    id: 'jpn',
    rival: 'jpn',
    city: 'TOKIO',
    round: 'CUARTOS',
    targetScore: 7,
    boost: -0.1,
    techBoost: 0.25,
    ai: { tolerance: 2.6, noise: 0.2, adapt: 0.3, jitter: 0.6, apBonus: 0 },
  },
  {
    id: 'usa',
    rival: 'usa',
    city: 'LOS ÁNGELES',
    round: 'SEMIFINAL',
    targetScore: 7,
    boost: 0,
    techBoost: 0,
    ai: { tolerance: 2.2, noise: 0.14, adapt: 0.4, jitter: 0.5, apBonus: 0 },
  },
  {
    id: 'bra',
    rival: 'bra',
    city: 'RÍO DE JANEIRO',
    round: 'FINAL',
    final: true,
    targetScore: 7,
    boost: 0,
    techBoost: 0,
    ai: { tolerance: 2.2, noise: 0.14, adapt: 0.4, jitter: 0.5, apBonus: 1 },
  },
]

export const LADDER_STANDARD_AI = AI_STANDARD

export type LadderProgress = {
  /** Índice de la etapa por jugar. `LADDER.length` = gira completa. */
  stage: number
  /** Partidos ganados. */
  cleared: number
  /** Intentos en la etapa actual. */
  attempts: number
  lastResult: 'win' | 'loss' | null
}

export const EMPTY_PROGRESS: LadderProgress = {
  stage: 0,
  cleared: 0,
  attempts: 0,
  lastResult: null,
}

export const stageAt = (progress: LadderProgress): LadderStage | null =>
  LADDER[progress.stage] ?? null

export const isLadderComplete = (progress: LadderProgress): boolean =>
  progress.stage >= LADDER.length

export const recordResult = (
  progress: LadderProgress,
  won: boolean,
): LadderProgress => {
  if (won) {
    return {
      stage: progress.stage + 1,
      cleared: progress.cleared + 1,
      attempts: 0,
      lastResult: 'win',
    }
  }
  return {
    ...progress,
    attempts: progress.attempts + 1,
    lastResult: 'loss',
  }
}

const STORAGE_KEY = 'zona3.ladder.v2'

export const loadProgress = (): LadderProgress => {
  if (typeof localStorage === 'undefined') return EMPTY_PROGRESS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_PROGRESS
    const parsed = JSON.parse(raw) as Partial<LadderProgress>
    const stage = Math.max(
      0,
      Math.min(LADDER.length, Number(parsed.stage) || 0),
    )
    return {
      stage,
      cleared: Math.max(0, Math.min(stage, Number(parsed.cleared) || 0)),
      attempts: Math.max(0, Number(parsed.attempts) || 0),
      lastResult: parsed.lastResult === 'loss' ? 'loss' : null,
    }
  } catch {
    return EMPTY_PROGRESS
  }
}

export const saveProgress = (progress: LadderProgress): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Sin persistencia: la gira sigue viva en memoria.
  }
}
