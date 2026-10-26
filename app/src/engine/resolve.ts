import { otherSide, reaches, sameCell } from './geometry'
import {
  ATTACK_BONUS,
  ATTACK_KINDS,
  BACK_ROW_CLASSES,
  SCHEME_BASE,
  SCHEME_EDGE,
  SCHEME_STAT,
} from './rules'
import type {
  AttackKind,
  Cell,
  ClassId,
  DefenseScheme,
  DuelResolution,
  Player,
  Quality,
} from './types'

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/**
 * Recepción / dig.
 * `pressure` es el valor numérico de la presión (0, 1 o 3).
 */
export const receptionValue = (
  player: Player,
  ballCell: Cell,
  pressure: number,
  seam: boolean,
  options: { ignoresSeam?: boolean } = {},
): number => {
  const own = sameCell(player.cell, ballCell)
  const adjacentPenalty =
    own || player.stats.velocidad >= 4 ? 0 : -1
  const liberoBonus = player.classId === 'libero' ? 1 : 0
  const ownBonus = own ? 1 : 0
  const seamPenalty = seam && !options.ignoresSeam ? 1 : 0
  return (
    player.stats.tecnica +
    liberoBonus +
    ownBonus +
    adjacentPenalty -
    pressure -
    seamPenalty
  )
}

export const receptionQuality = (value: number): Quality => {
  if (value >= 6) return 3
  if (value >= 4) return 2
  if (value >= 2) return 1
  return 0
}

export const setQuality = (
  passQuality: Quality,
  setter: Player,
  distance: number,
): Quality => {
  const distancePenalty = distance > 2 ? 1 : 0
  // El líbero es el armador de emergencia: no paga penalización de clase.
  const nonSetterPenalty =
    setter.classId === 'setter' || setter.classId === 'libero' ? 0 : 2
  const lowTechniquePenalty = setter.stats.tecnica <= 3 ? 1 : 0
  return clamp(
    passQuality - distancePenalty - nonSetterPenalty - lowTechniquePenalty,
    0,
    3,
  ) as Quality
}

export const attackBase = (
  attacker: Player,
  kind: AttackKind,
  setQ: Quality,
  target: Cell,
): number => {
  const farColumn = Math.abs(attacker.cell.col - target.col) >= 2 ? 1 : 0
  return attacker.stats.potencia + setQ + ATTACK_BONUS[kind] + 3 - farColumn
}

/** Colocación y finta castigan las esquinas; el resto ataca donde puede. */
export const attackZoneBonus = (
  kind: AttackKind,
  target: Cell,
): number =>
  (kind === 'placement' || kind === 'tip') && target.col !== 1 ? 2 : 0

export const attackValue = (
  attacker: Player,
  kind: AttackKind,
  setQ: Quality,
  target: Cell,
): number => attackBase(attacker, kind, setQ, target) + attackZoneBonus(kind, target)

export type SchemeDefender = {
  player: Player
  value: number
}

const schemePool = (
  defending: Player[],
  scheme: DefenseScheme,
): Player[] => {
  if (scheme === 'wall') {
    const wall = defending.filter(
      (player) => player.cell.row === 0 && player.classId !== 'libero',
    )
    if (wall.length > 0) return wall
  }
  if (scheme === 'deep') {
    const back = defending.filter((player) => player.cell.row === 1)
    if (back.length > 0) return back
  }
  return defending
}

const schemePlayerValue = (
  player: Player,
  scheme: DefenseScheme,
  target: Cell,
  ignorePosition = false,
): number => {
  let value = player.stats[SCHEME_STAT[scheme]]
  if (scheme === 'wall' && player.classId === 'middle') value += 1
  if (scheme === 'deep' && player.classId === 'libero') value += 1
  if (scheme === 'spread' && player.classId === 'libero') value += 1
  if (scheme === 'libero' && player.classId === 'libero') value += 2
  if (!ignorePosition) {
    if (scheme === 'wall' || scheme === 'deep') {
      if (player.cell.col === target.col) value += 1
    } else if (reaches(player.cell, target)) {
      value += 1
    }
  }
  return value
}

export const schemeDefender = (
  defending: Player[],
  scheme: DefenseScheme,
  target: Cell,
  ignorePosition = false,
): SchemeDefender => {
  const pool = schemePool(defending, scheme)
  let best = pool[0] ?? defending[0]
  let bestValue = -1
  for (const player of pool) {
    const value = schemePlayerValue(player, scheme, target, ignorePosition)
    if (
      value > bestValue ||
      (value === bestValue && player.id.localeCompare(best?.id ?? '') < 0)
    ) {
      best = player
      bestValue = value
    }
  }
  return { player: best, value: Math.max(0, bestValue) }
}

export const schemeZoneBonus = (
  scheme: DefenseScheme,
  target: Cell,
): number => {
  switch (scheme) {
    case 'wall':
      return target.row === 0 ? 1 : 0
    case 'spread':
      return 1
    case 'deep':
      return target.row === 1 ? 1 : 0
    case 'libero':
      return target.col === 1 ? 1 : 0
  }
}

export const schemeBlockerIds = (
  defending: Player[],
  scheme: DefenseScheme,
  defender: Player,
): string[] => {
  if (scheme === 'wall') {
    const wall = defending.filter(
      (player) => player.cell.row === 0 && player.classId !== 'libero',
    )
    if (wall.length > 0) return wall.map((player) => player.id)
    return [defender.id]
  }
  if (scheme === 'spread' && defender.cell.row === 0) return [defender.id]
  return []
}

export const resolveDuel = (params: {
  attacker: Player
  kind: AttackKind
  target: Cell
  setQuality: Quality
  defending: Player[]
  scheme: DefenseScheme
}): DuelResolution => {
  const { attacker, kind, target, setQuality: setQ, defending, scheme } = params
  // El rápido llega antes de que la defensa acomode su posición.
  const { player: defender, value } = schemeDefender(
    defending,
    scheme,
    target,
    kind === 'quick',
  )
  const zone = schemeZoneBonus(scheme, target)
  const edge = SCHEME_EDGE[scheme][kind]
  const A = attackValue(attacker, kind, setQ, target)
  const D = SCHEME_BASE[scheme] + value + zone + edge
  const delta = A - D
  const netScheme = scheme === 'wall' || scheme === 'spread'
  const blockerIds = schemeBlockerIds(defending, scheme, defender)

  if (delta >= 1) {
    return {
      A,
      D,
      edge,
      zone,
      outcome: 'point',
      digQuality: null,
      defenderId: defender.id,
      blockerIds,
      scheme,
    }
  }

  if (netScheme && delta <= -2) {
    return {
      A,
      D,
      edge,
      zone,
      outcome: 'blocked',
      digQuality: null,
      defenderId: defender.id,
      blockerIds,
      scheme,
    }
  }

  // Un dig nunca es calidad 0: si el duelo quedó empatado, la bola
  // igual queda jugable (pase malo) para que el rally siga vivo.
  const digQuality = (delta === 0 ? 1 : clamp(-delta, 1, 3)) as Quality
  return {
    A,
    D,
    edge,
    zone,
    outcome: 'dig',
    digQuality,
    defenderId: defender.id,
    blockerIds,
    scheme,
  }
}

export type AttackCheck =
  | { ok: true }
  | { ok: false; reason: string }

const kindAllowedForPlayer = (
  attacker: Player,
  kind: AttackKind,
): AttackCheck => {
  if (attacker.classId === 'libero') {
    return { ok: false, reason: 'El líbero no puede atacar.' }
  }
  if (kind === 'quick' && attacker.classId !== 'middle') {
    return { ok: false, reason: 'El ataque rápido es exclusivo del central.' }
  }
  if (kind === 'pipe') {
    if (attacker.classId !== 'opposite' || attacker.cell.row !== 1) {
      return { ok: false, reason: 'El pipe exige al opuesto desde el fondo.' }
    }
  }
  if (BACK_ROW_CLASSES.includes(attacker.classId) && attacker.cell.row === 0) {
    return {
      ok: false,
      reason: 'Un jugador de fondo no puede atacar desde la red.',
    }
  }
  return { ok: true }
}

export const isAttackAllowed = (params: {
  attacker: Player
  kind: AttackKind
  target: Cell
}): AttackCheck => {
  const { attacker, kind, target } = params
  const base = kindAllowedForPlayer(attacker, kind)
  if (!base.ok) return base
  if (target.side !== otherSide(attacker.side)) {
    return { ok: false, reason: 'El ataque debe ir al campo rival.' }
  }
  if (kind === 'quick' && target.col !== 1) {
    return { ok: false, reason: 'El rápido solo entra por el centro.' }
  }
  if (kind === 'tip' && target.row !== 1) {
    return { ok: false, reason: 'La finta busca el fondo, no la red.' }
  }
  return { ok: true }
}

export const attackKindsFor = (attacker: Player): AttackKind[] =>
  ATTACK_KINDS.filter((kind) => kindAllowedForPlayer(attacker, kind).ok)

export const qualityLabel = (quality: Quality): string =>
  ['error', 'mala', 'buena', 'perfecta'][quality]

export const classLabel = (classId: ClassId): string => {
  const labels: Record<ClassId, string> = {
    setter: 'armador',
    middle: 'central',
    opposite: 'opuesto',
    libero: 'líbero',
  }
  return labels[classId]
}
