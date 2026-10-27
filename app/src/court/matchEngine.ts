import { ATTACK_AP_COST } from '../engine'
import type { AttackKind, DefenseScheme, Quality } from '../engine'
import {
  MATCH_AP_MAX,
  MATCH_AP_REFUND,
  MATCH_AP_SERVE,
  MATCH_AP_START,
  MATCH_RALLY_CAP,
  MATCH_TARGET,
  SERVE_REACH,
  AI_STANDARD,
  attackOptions,
  cloneState,
  defenseCandidates,
  designatedServer,
  designatedSetter,
  isAttackAllowed,
  movePlayer,
  pickAttackerFor,
  playerById,
  playersOf,
  receptionQuality,
  receptionValue,
  resolveDuel,
  schemeDefender,
  setQuality,
  type AttackPlan,
  type AiTuning,
  type MatchEvent,
  type MatchState,
} from './match'
import { chooseAttackPlan, chooseDefenseScheme, chooseServeTarget } from './matchAi'
import { cellDistance, cellsOfSide, otherSide, sameCell } from './geometry'
import type { CourtCell, CourtPlayer, Side } from './types'
import { TECHNIQUES, type TechniqueId } from './techniques'
import type { Rng } from './matchAi'

export class MatchError extends Error {}

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new MatchError(message)
}

const manhattan = (a: CourtCell, b: CourtCell): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

export type CreateMatchOptions = {
  roster: CourtPlayer[]
  playerSide?: Side
  server?: Side
  targetScore?: number
  ai?: AiTuning
}

export const createMatch = (options: CreateMatchOptions): MatchState => {
  const players = options.roster.map((player) => ({
    ...player,
    stats: { ...player.stats },
    cell: { ...player.cell },
  }))
  const state: MatchState = {
    phase: 'SERVE',
    playerSide: options.playerSide ?? 'home',
    server: options.server ?? 'home',
    possession: options.server ?? 'home',
    score: { home: 0, away: 0 },
    ap: 0,
    defenseTechniqueUsed: false,
    players,
    formation: Object.fromEntries(
      players.map((player) => [player.id, { ...player.cell }]),
    ),
    ball: { ...players[0].cell },
    passQuality: 0,
    setQuality: 0,
    attackerId: null,
    hiddenScheme: null,
    hiddenAttack: null,
    winner: null,
    targetScore: options.targetScore ?? MATCH_TARGET,
    ai: options.ai ?? AI_STANDARD,
    rallyNumber: 1,
    rallyAttacks: 0,
    attackHistory: [],
    defenseHistory: [],
  }
  state.ball = { ...designatedServer(state, state.server).cell }
  return state
}

const pushHistory = (
  state: MatchState,
  attackSide: Side,
  kind: AttackKind,
  defenseSide: Side,
  scheme: DefenseScheme,
): void => {
  state.attackHistory.push({ side: attackSide, kind })
  state.defenseHistory.push({ side: defenseSide, scheme })
  if (state.attackHistory.length > 12) state.attackHistory.shift()
  if (state.defenseHistory.length > 12) state.defenseHistory.shift()
}

const resetFormation = (state: MatchState): void => {
  for (const player of state.players) {
    const target = state.formation[player.id]
    if (target) player.cell = { ...target }
  }
}

const awardPoint = (
  state: MatchState,
  side: Side,
  reason: 'ace' | 'error' | 'attack' | 'block' | 'cap',
): MatchEvent[] => {
  state.score[side] += 1
  state.server = side
  state.possession = side
  state.ap = 0
  state.defenseTechniqueUsed = false
  state.passQuality = 0
  state.setQuality = 0
  state.attackerId = null
  state.hiddenAttack = null
  state.hiddenScheme = null
  state.rallyAttacks = 0
  state.rallyNumber += 1

  const events: MatchEvent[] = [
    { type: 'POINT', side, reason, score: { ...state.score } },
  ]
  if (state.score[side] >= state.targetScore) {
    state.phase = 'END'
    state.winner = side
    events.push({
      type: 'MATCH_END',
      winner: side,
      score: { ...state.score },
    })
  } else {
    resetFormation(state)
    state.phase = 'SERVE'
  }
  state.ball = { ...designatedServer(state, side).cell }
  return events
}

const startPossession = (
  state: MatchState,
  side: Side,
  ballCell: CourtCell,
  passQuality: Quality,
  ap: number,
): void => {
  const tuning = side === state.playerSide ? 0 : state.ai.apBonus
  state.possession = side
  state.ball = { ...ballCell }
  state.passQuality = passQuality
  state.setQuality = 0
  state.ap = Math.max(0, Math.min(MATCH_AP_MAX, ap + tuning))
  state.attackerId = null
  state.hiddenAttack = null
  state.hiddenScheme = null
}

type ReceiverResult = {
  receiver: CourtPlayer
  value: number
  seam: boolean
}

const receiverForServe = (
  state: MatchState,
  target: CourtCell,
): ReceiverResult | null => {
  const side = otherSide(state.server)
  const roster = playersOf(state, side)
  const occupant = roster.find((player) => sameCell(player.cell, target))
  const seam =
    !occupant &&
    roster.filter((player) => cellDistance(player.cell, target) <= 1).length >= 2
  const candidates = (occupant ? [occupant] : roster)
    .filter((player) => cellDistance(player.cell, target) <= SERVE_REACH)
    .map((player) => ({
      receiver: player,
      value: receptionValue({
        player,
        ballCell: target,
        pressure: 1,
        seam,
      }),
    }))
    .sort(
      (a, b) =>
        b.value - a.value || a.receiver.id.localeCompare(b.receiver.id),
    )
  return candidates.length > 0
    ? { ...candidates[0], seam }
    : null
}

/**
 * Autoarmado: el balón viaja al armador y el ataque queda listo.
 * Devuelve los eventos intermedios y deja `state.phase` en ATTACK o DEFEND.
 */
const autoSet = (
  state: MatchState,
  side: Side,
  lastTouchId: string,
  rng: Rng,
): MatchEvent[] => {
  const setter = designatedSetter(state, side, lastTouchId)
  const distance = manhattan(setter.cell, state.ball)
  const quality = setQuality(state.passQuality, setter, distance)

  if (quality === 0) {
    const events: MatchEvent[] = [
      {
        type: 'SET',
        setterId: setter.id,
        quality,
        to: { ...state.ball },
        outcome: 'error',
      },
    ]
    return [...events, ...awardPoint(state, otherSide(side), 'error')]
  }

  state.ball = { ...setter.cell }
  state.setQuality = quality
  state.attackerId = null
  state.phase = side === state.playerSide ? 'ATTACK' : 'DEFEND'

  const events: MatchEvent[] = [
    {
      type: 'SET',
      setterId: setter.id,
      quality,
      to: { ...setter.cell },
      outcome: 'ok',
    },
  ]

  if (state.phase === 'DEFEND') {
    const plan = chooseAttackPlan(state, rng)
    state.hiddenScheme = null
    state.hiddenAttack = plan
    state.attackerId = plan?.attackerId ?? null
  } else {
    state.hiddenAttack = null
    state.hiddenScheme = chooseDefenseScheme(state, rng)
  }
  return events
}

export type AttackChoice = {
  attackerId?: string
  technique?: TechniqueId
}

export type DefenseChoice = {
  defenderId?: string
  technique?: TechniqueId
}

export type EngineResult = {
  state: MatchState
  events: MatchEvent[]
}

export const serve = (
  state: MatchState,
  target: CourtCell,
  rng: Rng = Math.random,
): EngineResult => {
  assert(state.phase === 'SERVE', 'No es la fase de saque.')
  assert(
    target.side === otherSide(state.server),
    'El saque debe ir al campo rival.',
  )
  const next = cloneState(state)
  const serverPlayer = designatedServer(next, next.server)
  next.ball = { ...serverPlayer.cell }

  const result = receiverForServe(next, target)
  if (!result) {
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: serverPlayer.id,
        target: { ...target },
        receiverId: null,
        quality: null,
        outcome: 'ace',
      },
    ]
    return { state: next, events: [...events, ...awardPoint(next, next.server, 'ace')] }
  }

  const quality = receptionQuality(result.value)
  const from = { ...result.receiver.cell }
  const setter = designatedSetter(next, otherSide(next.server), result.receiver.id)

  if (quality === 0) {
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: serverPlayer.id,
        target: { ...target },
        receiverId: result.receiver.id,
        quality,
        outcome: 'error',
      },
    ]
    return { state: next, events: [...events, ...awardPoint(next, next.server, 'error')] }
  }

  movePlayer(next, result.receiver.id, target)
  startPossession(
    next,
    otherSide(next.server),
    result.receiver.cell,
    quality,
    MATCH_AP_SERVE + (quality === 3 ? MATCH_AP_REFUND : 0),
  )

  const events: MatchEvent[] = [
    {
      type: 'SERVE',
      serverId: serverPlayer.id,
      target: { ...target },
      receiverId: result.receiver.id,
      quality,
      outcome: 'ok',
    },
    {
      type: 'RECEIVE',
      playerId: result.receiver.id,
      from,
      to: { ...setter.cell },
      quality,
    },
  ]

  return { state: next, events: [...events, ...autoSet(next, next.possession, result.receiver.id, rng)] }
}

export const aiServe = (
  state: MatchState,
  rng: Rng = Math.random,
): EngineResult => serve(state, chooseServeTarget(state, rng), rng)

export const attack = (
  state: MatchState,
  kind: AttackKind,
  target: CourtCell,
  rng: Rng = Math.random,
  choice: AttackChoice = {},
): EngineResult => {
  assert(state.phase === 'ATTACK', 'No es la fase de ataque.')
  assert(state.possession === state.playerSide, 'El ataque no es tuyo.')
  const scheme = state.hiddenScheme ?? chooseDefenseScheme(state, rng)
  const attacker = choice.attackerId
    ? playerById(state, choice.attackerId)
    : pickAttackerFor(state, kind, target)
  assert(attacker, 'No hay atacante legal para ese golpe.')
  assert(attacker.side === state.possession, 'Ese atacante no es tuyo.')
  const check = isAttackAllowed({ attacker, kind, target })
  if (!check.ok) throw new MatchError(check.reason)
  const technique = choice.technique ? TECHNIQUES[choice.technique] : null
  assert(
    !technique ||
      (technique.kind === 'attack' && technique.classId === attacker.classId),
    'Técnica inválida para ese atacante.',
  )
  const cost = ATTACK_AP_COST[kind] + (technique?.cost ?? 0)
  assert(state.ap >= cost, 'No hay energía para ese ataque.')

  const next = cloneState(state)
  if (next.rallyAttacks >= MATCH_RALLY_CAP) {
    return { state: next, events: awardPoint(next, otherSide(next.playerSide), 'cap') }
  }

  const resolution = resolveDuel({
    attacker,
    kind,
    target,
    setQuality: next.setQuality,
    defending: playersOf(next, otherSide(attacker.side)),
    scheme,
    attackTechnique: technique?.id,
  })
  next.ap = Math.max(0, next.ap - cost)
  next.rallyAttacks += 1
  next.attackerId = attacker.id
  next.hiddenScheme = null
  pushHistory(next, attacker.side, kind, otherSide(attacker.side), scheme)

  const events: MatchEvent[] = [
    {
      type: 'ATTACK',
      attackerId: attacker.id,
      kind,
      target: { ...target },
      resolution,
    },
  ]

  if (resolution.outcome === 'point') {
    return {
      state: next,
      events: [...events, ...awardPoint(next, attacker.side, 'attack')],
    }
  }
  if (resolution.outcome === 'blocked') {
    return {
      state: next,
      events: [
        ...events,
        ...awardPoint(next, otherSide(attacker.side), 'block'),
      ],
    }
  }

  const defender = playerById(next, resolution.defenderId)
  assert(defender, 'La defensa no tiene defensor.')
  const digQuality = resolution.digQuality ?? 1
  const defenderFrom = { ...defender.cell }
  const setter = designatedSetter(next, defender.side, defender.id)
  movePlayer(next, defender.id, target)
  startPossession(
    next,
    defender.side,
    target,
    digQuality,
    MATCH_AP_START + (digQuality === 3 ? MATCH_AP_REFUND : 0),
  )
  const digEvent: MatchEvent = {
    type: 'DIG',
    defenderId: defender.id,
    from: defenderFrom,
    to: { ...setter.cell },
    quality: digQuality,
  }
  return {
    state: next,
    events: [
      ...events,
      digEvent,
      ...autoSet(next, defender.side, defender.id, rng),
    ],
  }
}

export const defend = (
  state: MatchState,
  scheme: DefenseScheme,
  rng: Rng = Math.random,
  choice: DefenseChoice = {},
): EngineResult => {
  assert(state.phase === 'DEFEND', 'No es la fase defensiva.')
  assert(state.hiddenAttack, 'La IA todavía no eligió su ataque.')
  const plan: AttackPlan = state.hiddenAttack
  const attacker = playerById(state, plan.attackerId)
  assert(attacker, 'El atacante rival no existe.')
  const check = isAttackAllowed({
    attacker,
    kind: plan.kind,
    target: plan.target,
  })
  if (!check.ok) throw new MatchError(check.reason)

  const candidates = defenseCandidates(state, scheme)
  const autoDefender = schemeDefender(
    playersOf(state, state.playerSide),
    scheme,
    plan.target,
    plan.kind === 'quick',
  ).player
  const defender = choice.defenderId
    ? playerById(state, choice.defenderId)
    : autoDefender
  assert(defender, 'Tu defensa no tiene defensor.')
  assert(
    !choice.defenderId ||
      candidates.some((candidate) => candidate.id === defender.id),
    'Ese jugador no entra en el esquema.',
  )
  const technique = choice.technique ? TECHNIQUES[choice.technique] : null
  assert(
    !technique ||
      (technique.kind === 'defense' && technique.classId === defender.classId),
    'Técnica inválida para ese defensor.',
  )
  assert(
    !technique || !state.defenseTechniqueUsed,
    'Ya usaste tu técnica defensiva en este rally.',
  )
  const attackTechnique = plan.technique
    ? TECHNIQUES[plan.technique]
    : null
  const cost = ATTACK_AP_COST[plan.kind] + (attackTechnique?.cost ?? 0)

  const next = cloneState(state)
  if (next.rallyAttacks >= MATCH_RALLY_CAP) {
    return { state: next, events: awardPoint(next, next.playerSide, 'cap') }
  }

  const resolution = resolveDuel({
    attacker,
    kind: plan.kind,
    target: plan.target,
    setQuality: next.setQuality,
    defending: playersOf(next, next.playerSide),
    scheme,
    defenderId: defender.id,
    defenseTechnique: technique?.id,
    attackTechnique: plan.technique,
  })
  next.ap = Math.max(0, next.ap - cost)
  next.defenseTechniqueUsed =
    next.defenseTechniqueUsed || Boolean(technique)
  next.rallyAttacks += 1
  next.attackerId = attacker.id
  next.hiddenAttack = null
  pushHistory(next, attacker.side, plan.kind, next.playerSide, scheme)

  const events: MatchEvent[] = [
    {
      type: 'ATTACK',
      attackerId: attacker.id,
      kind: plan.kind,
      target: { ...plan.target },
      resolution,
    },
  ]

  if (resolution.outcome === 'point') {
    return {
      state: next,
      events: [...events, ...awardPoint(next, attacker.side, 'attack')],
    }
  }
  if (resolution.outcome === 'blocked') {
    return {
      state: next,
      events: [
        ...events,
        ...awardPoint(next, next.playerSide, 'block'),
      ],
    }
  }

  const dugBy = playerById(next, resolution.defenderId)
  assert(dugBy, 'Tu defensa no tiene defensor.')
  const digQuality = resolution.digQuality ?? 1
  const defenderFrom = { ...dugBy.cell }
  const setter = designatedSetter(next, next.playerSide, dugBy.id)
  movePlayer(next, dugBy.id, plan.target)
  startPossession(
    next,
    next.playerSide,
    plan.target,
    digQuality,
    MATCH_AP_START + (digQuality === 3 ? MATCH_AP_REFUND : 0),
  )
  return {
    state: next,
    events: [
      ...events,
      {
        type: 'DIG',
        defenderId: dugBy.id,
        from: defenderFrom,
        to: { ...setter.cell },
        quality: digQuality,
      },
      ...autoSet(next, next.playerSide, dugBy.id, rng),
    ],
  }
}

export const legalServeTargets = (state: MatchState): CourtCell[] =>
  cellsOfSide(otherSide(state.server))

export const nextDecision = (
  state: MatchState,
): 'serve' | 'attack' | 'defend' | 'wait' | 'end' => {
  if (state.phase === 'END') return 'end'
  if (state.phase === 'SERVE') {
    return state.server === state.playerSide ? 'serve' : 'wait'
  }
  if (state.phase === 'ATTACK') return 'attack'
  return 'defend'
}

export const attackerForPlan = (
  state: MatchState,
  plan: AttackPlan | null,
): CourtPlayer | undefined =>
  plan ? playerById(state, plan.attackerId) : undefined

export const currentAttackOptions = attackOptions
