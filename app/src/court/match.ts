import {
  ATTACK_AP_COST,
  ATTACK_BONUS,
  ATTACK_KINDS,
  BACK_ROW_CLASSES,
  DEFENSE_SCHEMES,
  SCHEME_BASE,
  SCHEME_EDGE,
  SCHEME_STAT,
} from '../engine'
import type {
  AttackKind,
  DefenseScheme,
  Quality,
} from '../engine'
import { cellDistance, cellsOfSide, otherSide } from './geometry'
import type { CourtCell, CourtPlayer, Side } from './types'

/** Reglas del partido v2 sobre la grilla de 4 columnas x 3 filas. */
export const MATCH_TARGET = 7
export const MATCH_AP_START = 2
/** El saque deja al que recibe con menos energía para el primer ataque. */
export const MATCH_AP_SERVE = 1
export const MATCH_AP_MAX = 3
export const MATCH_AP_REFUND = 1
export const MATCH_RALLY_CAP = 12
/** Un saque se puede recibir hasta a dos celdas de distancia. */
export const SERVE_REACH = 2

export type MatchPhase = 'SERVE' | 'ATTACK' | 'DEFEND' | 'END'

export type AttackPlan = {
  attackerId: string
  kind: AttackKind
  target: CourtCell
}

export type DuelResolution = {
  A: number
  D: number
  edge: number
  zone: number
  outcome: 'point' | 'dig' | 'blocked'
  digQuality: Quality | null
  defenderId: string
  blockerIds: string[]
  scheme: DefenseScheme
}

export type AttackRecord = { side: Side; kind: AttackKind }
export type DefenseRecord = { side: Side; scheme: DefenseScheme }

/** Ajuste de la IA rival; la escalera lo sube etapa por etapa. */
export type AiTuning = {
  /** Margen por debajo del mejor plan que la IA acepta. */
  tolerance: number
  /** Probabilidad de jugar un plan al azar. */
  noise: number
  /** Peso de cada ataque visto al elegir el esquema defensivo. */
  adapt: number
  /** Ruido del esquema defensivo. */
  jitter: number
  /** Energía extra (o de menos) con la que arranca el rival cada rally. */
  apBonus: number
}

export const AI_STANDARD: AiTuning = {
  tolerance: 2.2,
  noise: 0.12,
  adapt: 0.4,
  jitter: 0.55,
  apBonus: 0,
}

export type MatchState = {
  phase: MatchPhase
  playerSide: Side
  server: Side
  possession: Side
  score: Record<Side, number>
  ap: number
  players: CourtPlayer[]
  /** Posiciones de arranque de cada rally. */
  formation: Record<string, CourtCell>
  ball: CourtCell
  passQuality: Quality
  setQuality: Quality
  attackerId: string | null
  /** Esquema que eligió la IA mientras el jugador ataca. */
  hiddenScheme: DefenseScheme | null
  /** Ataque que eligió la IA mientras el jugador defiende. */
  hiddenAttack: AttackPlan | null
  winner: Side | null
  targetScore: number
  ai: AiTuning
  rallyNumber: number
  rallyAttacks: number
  attackHistory: AttackRecord[]
  defenseHistory: DefenseRecord[]
}

export type MatchEvent =
  | {
      type: 'SERVE'
      serverId: string
      target: CourtCell
      receiverId: string | null
      quality: Quality | null
      outcome: 'ok' | 'ace' | 'error'
    }
  | {
      type: 'RECEIVE'
      playerId: string
      from: CourtCell
      to: CourtCell
      quality: Quality
    }
  | {
      type: 'SET'
      setterId: string
      quality: Quality
      to: CourtCell
      outcome: 'ok' | 'error'
    }
  | {
      type: 'ATTACK'
      attackerId: string
      kind: AttackKind
      target: CourtCell
      resolution: DuelResolution
    }
  | {
      type: 'DIG'
      defenderId: string
      from: CourtCell
      to: CourtCell
      quality: Quality
    }
  | {
      type: 'POINT'
      side: Side
      reason: 'ace' | 'error' | 'attack' | 'block' | 'cap'
      score: Record<Side, number>
    }
  | {
      type: 'MATCH_END'
      winner: Side
      score: Record<Side, number>
    }

export const cloneState = (state: MatchState): MatchState => ({
  ...state,
  score: { ...state.score },
  players: state.players.map((player) => ({
    ...player,
    stats: { ...player.stats },
    cell: { ...player.cell },
  })),
  formation: Object.fromEntries(
    Object.entries(state.formation).map(([id, target]) => [
      id,
      { ...target },
    ]),
  ),
  ball: { ...state.ball },
  hiddenAttack: state.hiddenAttack
    ? {
        ...state.hiddenAttack,
        target: { ...state.hiddenAttack.target },
      }
    : null,
  attackHistory: state.attackHistory.map((record) => ({ ...record })),
  defenseHistory: state.defenseHistory.map((record) => ({ ...record })),
})

export const playersOf = (state: MatchState, side: Side): CourtPlayer[] =>
  state.players.filter((player) => player.side === side)

export const playerById = (
  state: MatchState,
  id: string | null,
): CourtPlayer | undefined =>
  id ? state.players.find((player) => player.id === id) : undefined

export const movePlayer = (
  state: MatchState,
  id: string,
  target: CourtCell,
): void => {
  const player = playerById(state, id)
  if (player) player.cell = { ...target }
}

const classOf = (state: MatchState, side: Side, classId: string) =>
  state.players.find(
    (player) => player.side === side && player.classId === classId,
  )

export const designatedServer = (
  state: MatchState,
  side: Side,
): CourtPlayer => {
  const roster = playersOf(state, side)
  return (
    classOf(state, side, 'opposite') ??
    roster.find((player) => player.classId !== 'libero') ??
    roster[0]
  )
}

export const designatedSetter = (
  state: MatchState,
  side: Side,
  ignoreId?: string | null,
): CourtPlayer => {
  const roster = playersOf(state, side)
  return (
    roster.find(
      (player) =>
        player.id !== ignoreId && player.classId === 'setter',
    ) ??
    roster
      .filter((player) => player.id !== ignoreId)
      .sort((a, b) => b.stats.tecnica - a.stats.tecnica)[0] ??
    roster[0]
  )
}

export const clampQuality = (value: number): Quality =>
  Math.max(0, Math.min(3, value)) as Quality

export const receptionValue = (params: {
  player: CourtPlayer
  ballCell: CourtCell
  pressure: number
  seam: boolean
  distance?: number
}): number => {
  const { player, ballCell, pressure, seam } = params
  const distance =
    params.distance ?? cellDistance(player.cell, ballCell)
  const own = distance === 0
  const reachPenalty =
    distance <= 1 ? 0 : Math.min(2, distance - 1)
  const liberoBonus = player.classId === 'libero' ? 1 : 0
  return (
    player.stats.tecnica +
    liberoBonus +
    (own ? 1 : 0) -
    pressure -
    (seam ? 1 : 0) -
    reachPenalty
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
  setter: CourtPlayer,
  distance: number,
): Quality => {
  const distancePenalty = distance > 2 ? 1 : 0
  const nonSetterPenalty =
    setter.classId === 'setter' || setter.classId === 'libero' ? 0 : 2
  const lowTechniquePenalty = setter.stats.tecnica <= 3 ? 1 : 0
  return clampQuality(
    passQuality - distancePenalty - nonSetterPenalty - lowTechniquePenalty,
  )
}

export const attackBase = (
  attacker: CourtPlayer,
  kind: AttackKind,
  setQ: Quality,
  target: CourtCell,
): number => {
  const farColumn =
    Math.abs(attacker.cell.col - target.col) >= 2 ? 1 : 0
  return attacker.stats.potencia + setQ + ATTACK_BONUS[kind] + 3 - farColumn
}

/** Con cuatro columnas, las esquinas son 0 y 3; el centro es 1 y 2. */
export const isCorner = (target: CourtCell): boolean =>
  target.col === 0 || target.col === 3

export const attackZoneBonus = (
  kind: AttackKind,
  target: CourtCell,
): number =>
  (kind === 'placement' || kind === 'tip') && isCorner(target) ? 2 : 0

export const attackValue = (
  attacker: CourtPlayer,
  kind: AttackKind,
  setQ: Quality,
  target: CourtCell,
): number => attackBase(attacker, kind, setQ, target) + attackZoneBonus(kind, target)

const kindAllowedForPlayer = (
  attacker: CourtPlayer,
  kind: AttackKind,
): { ok: true } | { ok: false; reason: string } => {
  if (attacker.classId === 'libero') {
    return { ok: false, reason: 'El líbero no puede atacar.' }
  }
  if (kind === 'quick' && attacker.classId !== 'middle') {
    return { ok: false, reason: 'El rápido es exclusivo del central.' }
  }
  if (kind === 'pipe') {
    if (attacker.classId !== 'opposite' || attacker.cell.row !== 2) {
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
  attacker: CourtPlayer
  kind: AttackKind
  target: CourtCell
}): { ok: true } | { ok: false; reason: string } => {
  const { attacker, kind, target } = params
  const base = kindAllowedForPlayer(attacker, kind)
  if (!base.ok) return base
  if (target.side !== otherSide(attacker.side)) {
    return { ok: false, reason: 'El ataque debe ir al campo rival.' }
  }
  if (kind === 'quick' && target.col !== 1 && target.col !== 2) {
    return { ok: false, reason: 'El rápido solo entra por el centro.' }
  }
  if (kind === 'tip' && target.row !== 2) {
    return { ok: false, reason: 'La finta busca el fondo, no la red.' }
  }
  return { ok: true }
}

export const attackKindsFor = (attacker: CourtPlayer): AttackKind[] =>
  ATTACK_KINDS.filter((kind) => kindAllowedForPlayer(attacker, kind).ok)

const schemePool = (
  defending: CourtPlayer[],
  scheme: DefenseScheme,
): CourtPlayer[] => {
  if (scheme === 'wall') {
    const wall = defending.filter(
      (player) => player.cell.row === 0 && player.classId !== 'libero',
    )
    if (wall.length > 0) return wall
  }
  if (scheme === 'deep') {
    const back = defending.filter((player) => player.cell.row === 2)
    if (back.length > 0) return back
  }
  return defending
}

const distanceBonus = (distance: number): number =>
  Math.max(-2, 1 - Math.max(0, distance - 1))

const schemePlayerValue = (
  player: CourtPlayer,
  scheme: DefenseScheme,
  target: CourtCell,
  ignorePosition = false,
): number => {
  let value = player.stats[SCHEME_STAT[scheme]]
  if (scheme === 'wall' && player.classId === 'middle') value += 1
  if (scheme === 'deep' && player.classId === 'libero') value += 1
  if (scheme === 'spread' && player.classId === 'libero') value += 1
  if (scheme === 'libero' && player.classId === 'libero') value += 2
  if (!ignorePosition) {
    value += distanceBonus(cellDistance(player.cell, target))
  }
  return value
}

export type SchemeDefender = {
  player: CourtPlayer
  value: number
}

export const schemeDefender = (
  defending: CourtPlayer[],
  scheme: DefenseScheme,
  target: CourtCell,
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
  target: CourtCell,
): number => {
  switch (scheme) {
    case 'wall':
      return target.row === 0 ? 1 : 0
    case 'spread':
      return 1
    case 'deep':
      return target.row === 2 ? 1 : 0
    case 'libero':
      return target.col === 1 || target.col === 2 ? 1 : 0
  }
}

export const schemeBlockerIds = (
  defending: CourtPlayer[],
  scheme: DefenseScheme,
  defender: CourtPlayer,
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
  attacker: CourtPlayer
  kind: AttackKind
  target: CourtCell
  setQuality: Quality
  defending: CourtPlayer[]
  scheme: DefenseScheme
}): DuelResolution => {
  const { attacker, kind, target, setQuality: setQ, defending, scheme } = params
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

  const digQuality = clampQuality(delta === 0 ? 1 : -delta)
  return {
    A,
    D,
    edge,
    zone,
    outcome: 'dig',
    digQuality: digQuality === 0 ? 1 : digQuality,
    defenderId: defender.id,
    blockerIds,
    scheme,
  }
}

export const pickAttackerFor = (
  state: MatchState,
  kind: AttackKind,
  target: CourtCell,
): CourtPlayer | undefined => {
  const candidates = playersOf(state, state.possession).filter(
    (player) => isAttackAllowed({ attacker: player, kind, target }).ok,
  )
  return candidates.sort(
    (a, b) =>
      attackValue(b, kind, state.setQuality, target) -
        attackValue(a, kind, state.setQuality, target) ||
      a.id.localeCompare(b.id),
  )[0]
}

export type AttackOption = {
  kind: AttackKind
  attacker: CourtPlayer
  targets: CourtCell[]
  cost: number
  affordable: boolean
}

export const attackOptions = (state: MatchState): AttackOption[] => {
  const side = state.possession
  const options: AttackOption[] = []
  for (const kind of ATTACK_KINDS) {
    let best: { attacker: CourtPlayer; targets: CourtCell[]; score: number } | null =
      null
    for (const attacker of playersOf(state, side)) {
      if (!attackKindsFor(attacker).includes(kind)) continue
      const targets = cellsOfSide(otherSide(side)).filter(
        (target) => isAttackAllowed({ attacker, kind, target }).ok,
      )
      if (targets.length === 0) continue
      const score = Math.max(
        ...targets.map((target) =>
          attackValue(attacker, kind, state.setQuality, target),
        ),
      )
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          attacker.stats.potencia > best.attacker.stats.potencia)
      ) {
        best = { attacker, targets, score }
      }
    }
    if (best) {
      options.push({
        kind,
        attacker: best.attacker,
        targets: best.targets,
        cost: ATTACK_AP_COST[kind],
        affordable: state.ap >= ATTACK_AP_COST[kind],
      })
    }
  }
  return options
}

export const schemeLabel = (scheme: DefenseScheme): string =>
  ({
    wall: 'MURO',
    spread: 'ABIERTO',
    deep: 'PROFUNDO',
    libero: 'LÍBERO',
  })[scheme]

export const schemeHint = (scheme: DefenseScheme): string =>
  ({
    wall: 'Cierra la red',
    spread: 'Cubre el ancho',
    deep: 'Espera atrás',
    libero: 'Lee las manos',
  })[scheme]

export const qualityLabel = (quality: Quality | null): string =>
  quality === null ? '' : ['error', 'mala', 'buena', 'perfecta'][quality]

export const defenseRecord = (
  side: Side,
  scheme: DefenseScheme,
): DefenseRecord => ({ side, scheme })

export { ATTACK_AP_COST, DEFENSE_SCHEMES }
