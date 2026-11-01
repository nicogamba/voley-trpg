import type { ClassId } from '../engine'

/** Técnicas de duelo del modo C. Cada clase tiene su repertorio. */
export type TechniqueId =
  | 'martillo'
  | 'cometa'
  | 'desliz'
  | 'gancho'
  | 'toque'
  | 'zambullida'
  | 'lectura'
  | 'techo'
  | 'muro'
  | 'manos'
  | 'piso'

export type TechniqueKind = 'attack' | 'defense'

export type Technique = {
  id: TechniqueId
  label: string
  note: string
  kind: TechniqueKind
  classId: ClassId
  cost: number
  bonus: number
  /** Las técnicas defensivas se usan una vez por rally. */
  oncePerRally?: boolean
}

export const TECHNIQUES: Record<TechniqueId, Technique> = {
  martillo: {
    id: 'martillo',
    label: 'MARTILLO',
    note: '+2 al ataque',
    kind: 'attack',
    classId: 'opposite',
    cost: 2,
    bonus: 2,
  },
  cometa: {
    id: 'cometa',
    label: 'COMETA',
    note: '+1 al ataque',
    kind: 'attack',
    classId: 'opposite',
    cost: 1,
    bonus: 1,
  },
  desliz: {
    id: 'desliz',
    label: 'DESLIZ',
    note: '+2 al ataque',
    kind: 'attack',
    classId: 'middle',
    cost: 2,
    bonus: 2,
  },
  gancho: {
    id: 'gancho',
    label: 'GANCHO',
    note: '+1 al ataque',
    kind: 'attack',
    classId: 'middle',
    cost: 1,
    bonus: 1,
  },
  toque: {
    id: 'toque',
    label: 'TOQUE',
    note: '+1 al ataque',
    kind: 'attack',
    classId: 'setter',
    cost: 1,
    bonus: 1,
  },
  zambullida: {
    id: 'zambullida',
    label: 'ZAMBULLIDA',
    note: '+2 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'libero',
    cost: 2,
    bonus: 2,
  },
  lectura: {
    id: 'lectura',
    label: 'LECTURA',
    note: '+1 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'libero',
    cost: 1,
    bonus: 1,
  },
  techo: {
    id: 'techo',
    label: 'TECHO',
    note: '+2 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'middle',
    cost: 2,
    bonus: 2,
  },
  muro: {
    id: 'muro',
    label: 'TAPÓN',
    note: '+1 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'middle',
    cost: 1,
    bonus: 1,
  },
  manos: {
    id: 'manos',
    label: 'MANOS',
    note: '+1 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'setter',
    cost: 1,
    bonus: 1,
  },
  piso: {
    id: 'piso',
    label: 'PISO',
    note: '+1 a la defensa',
    kind: 'defense',
    oncePerRally: true,
    classId: 'opposite',
    cost: 1,
    bonus: 1,
  },
}

const ATTACK_BY_CLASS: Record<ClassId, TechniqueId[]> = {
  setter: ['toque'],
  middle: ['desliz', 'gancho'],
  opposite: ['martillo', 'cometa'],
  libero: [],
  wing: ['martillo', 'cometa'],
}

const DEFENSE_BY_CLASS: Record<ClassId, TechniqueId[]> = {
  setter: ['manos'],
  middle: ['techo', 'muro'],
  opposite: ['piso'],
  libero: ['zambullida', 'lectura'],
  wing: ['piso'],
}

export const techniquesFor = (
  classId: ClassId,
  kind: TechniqueKind,
): Technique[] =>
  (kind === 'attack' ? ATTACK_BY_CLASS[classId] : DEFENSE_BY_CLASS[classId]).map(
    (id) => TECHNIQUES[id],
  )

export const techniqueById = (id: TechniqueId): Technique => TECHNIQUES[id]
