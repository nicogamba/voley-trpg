import { otherSide, sameCell } from './geometry'
import {
  ATTACK_BONUS,
  BACK_ROW_CLASSES,
  TEMPO_ATTACKS,
} from './rules'
import type {
  AttackKind,
  AttackResolution,
  Cell,
  ClassId,
  Player,
  Quality,
  Tempo,
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
  const distancePenalty = distance > 1 ? 1 : 0
  const nonSetterPenalty = setter.classId === 'setter' ? 0 : 2
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
  targetCol: number,
): number => {
  const farColumn = Math.abs(attacker.cell.col - targetCol) >= 2 ? 1 : 0
  return attacker.stats.potencia + setQ + ATTACK_BONUS[kind] - farColumn
}

export const attackValue = (
  attacker: Player,
  kind: AttackKind,
  setQ: Quality,
  targetCol: number,
  blockerCount: number,
): number => {
  const ignoresBlock = kind === 'wipe' || kind === 'tip'
  const blockPenalty = ignoresBlock ? 0 : 2 * blockerCount
  return attackBase(attacker, kind, setQ, targetCol) - blockPenalty
}

export const blockValue = (blockers: Player[]): number => {
  if (blockers.length === 0) return 0
  const best = Math.max(
    ...blockers.map(
      (blocker) =>
        blocker.stats.lectura + (blocker.classId === 'middle' ? 1 : 0),
    ),
  )
  return best + (blockers.length > 1 ? 1 : 0)
}

export const defenseValue = (
  defender: Player,
  inCell: boolean,
  isTip: boolean,
): number =>
  defender.stats.lectura +
  (defender.classId === 'libero' ? 1 : 0) +
  (inCell ? 1 : 0) +
  (isTip ? 1 : 0)

/**
 * En el tablero 3x2 solo hay un jugador de red por columna. El doble bloqueo
 * (B=7) queda como valor de referencia para una cancha más grande.
 */
export const blockersFor = (
  defending: Player[],
  target: Cell,
): Player[] =>
  defending.filter(
    (p) =>
      p.cell.row === 0 &&
      p.cell.col === target.col &&
      p.classId !== 'libero',
  )

export const bestDefenderFor = (
  defending: Player[],
  target: Cell,
  isTip: boolean,
): { player: Player | null; value: number } => {
  let best: Player | null = null
  let bestValue = -1
  for (const player of defending) {
    if (!reachesCell(player, target)) continue
    const value = defenseValue(player, sameCell(player.cell, target), isTip)
    if (value > bestValue) {
      best = player
      bestValue = value
    }
  }
  return { player: best, value: bestValue }
}

const reachesCell = (player: Player, target: Cell): boolean =>
  player.cell.side === target.side &&
  Math.abs(player.cell.row - target.row) +
    Math.abs(player.cell.col - target.col) <=
    1

export type AttackCheck =
  | { ok: true }
  | { ok: false; reason: string }

export const isAttackAllowed = (params: {
  attacker: Player
  kind: AttackKind
  tempo: Tempo
  target: Cell
  defending: Player[]
}): AttackCheck => {
  const { attacker, kind, tempo, target, defending } = params
  if (attacker.classId === 'libero') {
    return { ok: false, reason: 'El líbero no puede atacar.' }
  }
  if (!TEMPO_ATTACKS[tempo].includes(kind)) {
    return { ok: false, reason: 'Ese ataque no corresponde al tempo.' }
  }
  if (BACK_ROW_CLASSES.includes(attacker.classId) && attacker.cell.row === 0) {
    return {
      ok: false,
      reason: 'Un jugador de fondo no puede atacar desde la red.',
    }
  }
  if (target.side !== otherSide(attacker.side)) {
    return { ok: false, reason: 'El ataque debe ir al campo rival.' }
  }
  if (kind === 'quick' && attacker.classId !== 'middle') {
    return { ok: false, reason: 'El ataque rápido es exclusivo del central.' }
  }
  if (kind === 'pipe') {
    if (attacker.classId !== 'opposite' || attacker.cell.row !== 1) {
      return { ok: false, reason: 'El pipe exige al opuesto desde el fondo.' }
    }
  }
  if (kind === 'wipe' && blockersFor(defending, target).length === 0) {
    return { ok: false, reason: 'El wipe necesita un bloqueador en la columna.' }
  }
  return { ok: true }
}

export const evaluateAttack = (
  attacker: Player,
  setQ: Quality,
  kind: AttackKind,
  target: Cell,
  defending: Player[],
): AttackResolution => {
  const blockers = blockersFor(defending, target)
  const B = blockValue(blockers)
  const A = attackValue(attacker, kind, setQ, target.col, blockers.length)
  const isTip = kind === 'tip'
  const isWipe = kind === 'wipe'
  const { player: defender, value: D } = bestDefenderFor(
    defending,
    target,
    isTip,
  )

  if (!isTip && !isWipe && A <= B) {
    return {
      A,
      B,
      A_pass: 0,
      D,
      outcome: 'blocked',
      digQuality: null,
      defenderId: null,
      blockerIds: blockers.map((b) => b.id),
    }
  }

  const A_pass = isTip || isWipe ? A : A - (blockers.length > 0 ? 1 : 0)
  const blockerIds = blockers.map((b) => b.id)

  if (!defender) {
    return {
      A,
      B,
      A_pass,
      D: 0,
      outcome: 'point',
      digQuality: null,
      defenderId: null,
      blockerIds,
    }
  }

  const delta = D - A_pass
  if (delta < -1) {
    return {
      A,
      B,
      A_pass,
      D,
      outcome: 'point',
      digQuality: null,
      defenderId: null,
      blockerIds,
    }
  }

  const digQuality =
    delta === -1 ? 0 : delta === 0 ? 1 : (Math.min(3, delta) as Quality)
  return {
    A,
    B,
    A_pass,
    D,
    outcome: 'dig',
    digQuality,
    defenderId: defender.id,
    blockerIds,
  }
}

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
