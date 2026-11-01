import type { ClassId, Stats } from '../engine'
import { cell, mirrorCol } from './geometry'
import type { CourtPlayer, CourtTeam, Side } from './types'

export type TeamId = 'arg' | 'chi' | 'ita' | 'jpn' | 'usa' | 'bra'

export type RosterEntry = {
  classId: ClassId
  /** Id corto para distinguir dos jugadores de la misma clase. */
  id?: string
  name: string
  /** Ajuste fino sobre las stats base de la clase. */
  stats?: Partial<Stats>
}

export type TeamDef = CourtTeam & {
  /** Cómo juega el rival; se muestra en la escalera. */
  style: string
  roster: RosterEntry[]
}

/**
 * Nombres de fantasía: anagramas o variantes de una o dos letras sobre
 * apellidos reales de cada selección. El arte definitivo va después.
 */
export const TEAMS: Record<TeamId, TeamDef> = {
  arg: {
    id: 'arg',
    name: 'ARGENTINA',
    short: 'ARG',
    flag: ['#74c0e8', '#ffffff', '#74c0e8'],
    kit: { shirt: '#4f7fd4', shorts: '#223a7a', trim: '#e8eefc' },
    style: 'EQUILIBRIO',
    roster: [
      { classId: 'setter', name: 'PEREYRA' },
      { classId: 'middle', name: 'QUINTANA' },
      { classId: 'opposite', name: 'MOLINA' },
      { classId: 'libero', name: 'SOSA' },
      { classId: 'wing', id: 'wing-1', name: 'BENÍTEZ' },
      { classId: 'wing', id: 'wing-2', name: 'LUCERO' },
    ],
  },
  chi: {
    id: 'chi',
    name: 'CHILE',
    short: 'CHI',
    flag: ['#ffffff', '#c8352f', '#1b2a5e'],
    kit: { shirt: '#c8352f', shorts: '#1b2a5e', trim: '#ffffff' },
    style: 'ORDEN',
    roster: [
      { classId: 'setter', name: 'GRIMALT' },
      { classId: 'middle', name: 'PARRAGUI' },
      { classId: 'opposite', name: 'SOTO' },
      { classId: 'libero', name: 'MUNOZ' },
      { classId: 'wing', id: 'wing-1', name: 'ROJAS' },
      { classId: 'wing', id: 'wing-2', name: 'VIDAL' },
    ],
  },
  ita: {
    id: 'ita',
    name: 'ITALIA',
    short: 'ITA',
    flag: ['#2f7d4f', '#ffffff', '#c8352f'],
    kit: { shirt: '#2f6fd0', shorts: '#f0f4ff', trim: '#ffffff' },
    style: 'MURO',
    roster: [
      { classId: 'setter', name: 'GIANNI' },
      { classId: 'middle', name: 'RUSSO' },
      { classId: 'opposite', name: 'MICHELI' },
      { classId: 'libero', name: 'BALSO' },
      { classId: 'wing', id: 'wing-1', name: 'MORETTI' },
      { classId: 'wing', id: 'wing-2', name: 'FABBRI' },
    ],
  },
  jpn: {
    id: 'jpn',
    name: 'JAPÓN',
    short: 'JPN',
    flag: ['#ffffff', '#c8352f', '#ffffff'],
    kit: { shirt: '#e8eefc', shorts: '#b8242f', trim: '#b8242f' },
    style: 'RITMO',
    roster: [
      { classId: 'setter', name: 'SEKI' },
      { classId: 'middle', name: 'NISHIO' },
      { classId: 'opposite', name: 'TAKEDA' },
      { classId: 'libero', name: 'MOTOYAMA' },
      { classId: 'wing', id: 'wing-1', name: 'KANDA' },
      { classId: 'wing', id: 'wing-2', name: 'OZAKI' },
    ],
  },
  usa: {
    id: 'usa',
    name: 'ESTADOS UNIDOS',
    short: 'USA',
    flag: ['#23335e', '#ffffff', '#c8352f'],
    kit: { shirt: '#23335e', shorts: '#c8352f', trim: '#e8eefc' },
    style: 'POTENCIA',
    roster: [
      { classId: 'setter', name: 'CHRISTEN' },
      { classId: 'middle', name: 'HOLTAN' },
      { classId: 'opposite', name: 'ANDRES' },
      { classId: 'libero', name: 'SHOJI' },
      { classId: 'wing', id: 'wing-1', name: 'BAKER' },
      { classId: 'wing', id: 'wing-2', name: 'REED' },
    ],
  },
  bra: {
    id: 'bra',
    name: 'BRASIL',
    short: 'BRA',
    flag: ['#1f9d55', '#ffd166', '#1f9d55'],
    kit: { shirt: '#ffd166', shorts: '#1f9d55', trim: '#1f9d55' },
    style: 'JOGO BONITO',
    roster: [
      { classId: 'setter', name: 'RIBEIRO' },
      { classId: 'middle', name: 'COSTA' },
      { classId: 'opposite', name: 'ALVES' },
      { classId: 'libero', name: 'SOUZA' },
      { classId: 'wing', id: 'wing-1', name: 'MARQUES' },
      { classId: 'wing', id: 'wing-2', name: 'OLIVEIRA' },
    ],
  },
}

const BASE_STATS: Record<ClassId, Stats> = {
  setter: { tecnica: 5, potencia: 2, velocidad: 3, lectura: 4 },
  middle: { tecnica: 2, potencia: 4, velocidad: 3, lectura: 5 },
  opposite: { tecnica: 2, potencia: 5, velocidad: 4, lectura: 3 },
  libero: { tecnica: 5, potencia: 1, velocidad: 5, lectura: 5 },
  wing: { tecnica: 3, potencia: 4, velocidad: 4, lectura: 3 },
}

const roundStat = (value: number): number => Math.round(value * 10) / 10

type Slot = { row: 0 | 1 | 2; col: 0 | 1 | 2 | 3 }

/** Fila y columna de la formación base del lado local. */
const HOME_SLOT: Record<ClassId, Slot | Slot[]> = {
  setter: { row: 0, col: 1 },
  middle: { row: 0, col: 0 },
  opposite: { row: 2, col: 3 },
  libero: { row: 2, col: 1 },
  wing: [
    { row: 0, col: 3 },
    { row: 2, col: 0 },
  ],
}

export type FormationId = 'base' | 'reception' | 'block'

export const FORMATION_OPTIONS: {
  id: FormationId
  label: string
  note: string
}[] = [
  { id: 'base', label: 'BASE', note: 'Equilibrada' },
  { id: 'reception', label: 'RECEPCIÓN', note: 'Recibe y arma' },
  { id: 'block', label: 'BLOQUEO', note: 'Cierra la red' },
]

const FORMATION_SLOTS: Record<
  FormationId,
  Record<ClassId, Slot | Slot[]>
> = {
  base: HOME_SLOT,
  reception: {
    setter: { row: 2, col: 1 },
    middle: { row: 0, col: 1 },
    opposite: { row: 0, col: 2 },
    libero: { row: 2, col: 2 },
    wing: [
      { row: 0, col: 0 },
      { row: 2, col: 0 },
    ],
  },
  block: {
    setter: { row: 2, col: 0 },
    middle: { row: 0, col: 1 },
    opposite: { row: 0, col: 2 },
    libero: { row: 2, col: 3 },
    wing: [
      { row: 0, col: 0 },
      { row: 2, col: 1 },
    ],
  },
}

/** La formación mueve las piezas; el jugador ya no arrastra celdas. */
export const applyFormation = (
  players: CourtPlayer[],
  formationId: FormationId,
): CourtPlayer[] => {
  const counters: Partial<Record<ClassId, number>> = {}
  return players.map((player) => {
    if (player.side !== 'home') return player
    const slots = FORMATION_SLOTS[formationId][player.classId]
    const index = counters[player.classId] ?? 0
    counters[player.classId] = index + 1
    const slot = Array.isArray(slots)
      ? slots[Math.min(index, slots.length - 1)]
      : slots
    return {
      ...player,
      cell: cell('home', slot.row, slot.col),
    }
  })
}

/**
 * Arma el plantel de un equipo. `boost` sube todas las stats por igual y
 * sirve para escalar la dificultad de la escalera.
 */
export const buildRoster = (
  teamId: TeamId,
  side: Side,
  boost = 0,
  techBoost = 0,
): CourtPlayer[] => {
  const team = TEAMS[teamId]
  const counters: Partial<Record<ClassId, number>> = {}
  return team.roster.map((entry) => {
    const base = BASE_STATS[entry.classId]
    const slots = HOME_SLOT[entry.classId]
    const index = counters[entry.classId] ?? 0
    counters[entry.classId] = index + 1
    const slot = Array.isArray(slots)
      ? slots[Math.min(index, slots.length - 1)]
      : slots
    // La técnica queda aparte: mueve umbrales de recepción de golpe.
    const stats: Stats = {
      tecnica: roundStat(
        base.tecnica + techBoost + (entry.stats?.tecnica ?? 0),
      ),
      potencia: roundStat(
        base.potencia + boost + (entry.stats?.potencia ?? 0),
      ),
      velocidad: roundStat(
        base.velocidad + boost + (entry.stats?.velocidad ?? 0),
      ),
      lectura: roundStat(base.lectura + boost + (entry.stats?.lectura ?? 0)),
    }
    return {
      id: `${side}-${entry.id ?? entry.classId}`,
      side,
      classId: entry.classId,
      name: entry.name,
      stats,
      cell: cell(
        side,
        slot.row,
        side === 'home' ? slot.col : mirrorCol(slot.col),
      ),
    }
  })
}

export const teamById = (id: TeamId): CourtTeam => TEAMS[id]
