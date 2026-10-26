import type {
  AttackKind,
  BallPressure,
  ClassId,
  Col,
  DefenseScheme,
  Row,
  Stats,
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

export const CLASS_LETTERS: Record<ClassId, string> = {
  setter: 'A',
  middle: 'C',
  opposite: 'O',
  libero: 'L',
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
/** Energía al empezar una posesión. */
export const AP_PER_POSSESSION = 2
/** Tope de energía; un pase perfecto devuelve 1. */
export const AP_MAX = 3
export const PERFECT_PASS_AP_REFUND = 1
export const MAX_RALLY_ATTACKS = 20

export const PRESSURE_VALUE: Record<BallPressure, number> = {
  free: 0,
  serve: 1,
  tip: 1,
  attack: 3,
}

export const ATTACK_KINDS: AttackKind[] = [
  'power',
  'placement',
  'quick',
  'pipe',
  'wipe',
  'tip',
]

export const ATTACK_LABEL: Record<AttackKind, string> = {
  power: 'Potencia',
  placement: 'Colocación',
  quick: 'Rápido',
  pipe: 'Pipe',
  wipe: 'Wipe',
  tip: 'Finta',
}

export const ATTACK_SHORT: Record<AttackKind, string> = {
  power: 'Fuerza bruta',
  placement: 'Busca el hueco',
  quick: 'Central, por el centro',
  pipe: 'Opuesto desde atrás',
  wipe: 'Usa tus manos',
  tip: 'Toque suave al fondo',
}

export const ATTACK_BONUS: Record<AttackKind, number> = {
  power: 2,
  placement: 0,
  quick: 2,
  pipe: 2,
  wipe: 2,
  tip: 0,
}

export const ATTACK_AP_COST: Record<AttackKind, number> = {
  power: 2,
  placement: 0,
  quick: 0,
  pipe: 3,
  wipe: 2,
  tip: 0,
}

export const DEFENSE_SCHEMES: DefenseScheme[] = [
  'wall',
  'spread',
  'deep',
  'libero',
]

export const SCHEME_LABEL: Record<DefenseScheme, string> = {
  wall: 'Muro',
  spread: 'Bloqueo abierto',
  deep: 'Defensa profunda',
  libero: 'Líbero atento',
}

export const SCHEME_SHORT: Record<DefenseScheme, string> = {
  wall: 'Cierra la red',
  spread: 'Cubre el ancho',
  deep: 'Espera atrás',
  libero: 'Lee las manos',
}

/** Stat que lidera cada esquema. */
export const SCHEME_STAT: Record<DefenseScheme, keyof Stats> = {
  wall: 'lectura',
  spread: 'velocidad',
  deep: 'lectura',
  libero: 'tecnica',
}

export const SCHEME_BASE: Record<DefenseScheme, number> = {
  wall: 3,
  spread: 3,
  deep: 3,
  libero: 3,
}

/**
 * Matchup oculto: cuánto suma cada esquema contra cada ataque.
 * Positivo = el esquema frena ese ataque. Negativo = ese ataque lo castiga.
 */
export const SCHEME_EDGE: Record<
  DefenseScheme,
  Record<AttackKind, number>
> = {
  wall: {
    power: 2,
    placement: 0,
    quick: 2,
    pipe: -2,
    wipe: -2,
    tip: -2,
  },
  spread: {
    power: -2,
    placement: 2,
    quick: -2,
    pipe: 0,
    wipe: 2,
    tip: 2,
  },
  deep: {
    power: 2,
    placement: -2,
    quick: 0,
    pipe: 2,
    wipe: 2,
    tip: -2,
  },
  libero: {
    power: -2,
    placement: 2,
    quick: -2,
    pipe: -2,
    wipe: 0,
    tip: 2,
  },
}

/** Clases que nacen en la fila del fondo y no pueden atacar desde la red. */
export const BACK_ROW_CLASSES: ClassId[] = ['opposite', 'libero']
