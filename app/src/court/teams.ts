import type { ClassId, Stats } from '../engine'
import { cell, mirrorCol } from './geometry'
import type { CourtPlayer, CourtTeam, Side } from './types'

export type TeamId = 'arg' | 'chi' | 'ita' | 'jpn' | 'usa' | 'bra'

export type RosterEntry = {
  classId: ClassId
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
    ],
  },
}

const BASE_STATS: Record<ClassId, Stats> = {
  setter: { tecnica: 5, potencia: 2, velocidad: 3, lectura: 4 },
  middle: { tecnica: 2, potencia: 4, velocidad: 3, lectura: 5 },
  opposite: { tecnica: 2, potencia: 5, velocidad: 4, lectura: 3 },
  libero: { tecnica: 5, potencia: 1, velocidad: 5, lectura: 5 },
}

const roundStat = (value: number): number => Math.round(value * 10) / 10

/** Fila y columna de la formación base del lado local. */
const HOME_SLOT: Record<ClassId, { row: 0 | 1 | 2; col: 0 | 1 | 2 | 3 }> = {
  setter: { row: 0, col: 1 },
  middle: { row: 0, col: 0 },
  opposite: { row: 2, col: 3 },
  libero: { row: 2, col: 1 },
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
  return team.roster.map((entry) => {
    const base = BASE_STATS[entry.classId]
    const slot = HOME_SLOT[entry.classId]
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
      id: `${side}-${entry.classId}`,
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
