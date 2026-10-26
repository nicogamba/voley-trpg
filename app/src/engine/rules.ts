import type {
  AttackKind,
  BallPressure,
  ClassId,
  Col,
  Row,
  Stats,
  Tempo,
} from './types'

export const CLASS_STATS: Record<ClassId, Stats> = {
  setter: { tecnica: 5, potencia: 2, velocidad: 3, lectura: 4 },
  middle: { tecnica: 2, potencia: 4, velocidad: 3, lectura: 5 },
  opposite: { tecnica: 2, potencia: 5, velocidad: 4, lectura: 3 },
  libero: { tecnica: 5, potencia: 1, velocidad: 5, lectura: 5 },
}

export const CLASS_NAMES: Record<ClassId, string> = {
  setter: 'Armador',
  middle: 'Central',
  opposite: 'Opuesto',
  libero: 'Líbero',
}

export const CLASS_ORDER: ClassId[] = [
  'setter',
  'middle',
  'opposite',
  'libero',
]

export const FORMATION: Record<ClassId, { row: Row; col: Col }> = {
  setter: { row: 0, col: 1 },
  middle: { row: 0, col: 0 },
  opposite: { row: 1, col: 2 },
  libero: { row: 1, col: 1 },
}

export const TARGET_SCORE = 7
export const AP_PER_POSSESSION = 3
export const REACTION_AP = 2
export const PERFECT_PASS_AP_REFUND = 1
export const MAX_RALLY_ATTACKS = 20

export const PRESSURE_VALUE: Record<BallPressure, number> = {
  free: 0,
  serve: 1,
  tip: 1,
  attack: 3,
}

export const ATTACK_BONUS: Record<AttackKind, number> = {
  power: 1,
  placement: 0,
  quick: 2,
  pipe: 1,
  wipe: -1,
  tip: -1,
}

export const ATTACK_AP_COST: Record<AttackKind, number> = {
  power: 1,
  placement: 0,
  quick: 0,
  pipe: 0,
  wipe: 1,
  tip: 0,
}

export const TEMPO_AP_COST: Record<Tempo, number> = {
  high: 0,
  quick: 1,
  back: 1,
}

export const TEMPO_ATTACKS: Record<Tempo, AttackKind[]> = {
  high: ['power', 'placement', 'wipe', 'tip'],
  quick: ['quick'],
  back: ['pipe'],
}

/** Clases que nacen en la fila del fondo y no pueden atacar desde la red. */
export const BACK_ROW_CLASSES: ClassId[] = ['opposite', 'libero']
