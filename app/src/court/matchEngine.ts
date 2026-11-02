import { ATTACK_AP_COST } from '../engine'
import type { AttackKind, DefenseScheme, Quality } from '../engine'
import {
  MATCH_AP_MAX,
  MATCH_AP_REFUND,
  MATCH_AP_SERVE,
  MATCH_AP_START,
  MATCH_RALLY_CAP,
  MATCH_TARGET,
  ROTATION_CELLS,
  SERVE_REACH,
  AI_STANDARD,
  attackFault,
  attackKindsFor,
  attackOptions,
  attackValue,
  attackZoneForCell,
  cloneState,
  defenseCandidates,
  designatedServer,
  designatedSetter,
  isAttackAllowed,
  movePlayer,
  pickAttackerFor,
  playerById,
  playersOf,
  receiverForServe,
  receptionQuality,
  receptionSaveChance,
  receptionValue,
  resolveBlockOutcome,
  resolveDuel,
  schemeDefender,
  serveFault,
  servePressure,
  serveZoneForTarget,
  setQuality,
  type AttackPlan,
  type AiTuning,
  type DuelResolution,
  type MatchEvent,
  type MatchState,
  type PointReason,
  type ServeZone,
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

const rotationFromPlayers = (state: MatchState, side: Side): string[] => {
  const roster = playersOf(state, side)
  const used = new Set<string>()
  const rotation = ROTATION_CELLS[side].map((target) => {
    const player = roster.find(
      (candidate) =>
        !used.has(candidate.id) && sameCell(candidate.cell, target),
    )
    if (player) {
      used.add(player.id)
      return player.id
    }
    return ''
  })
  const remaining = roster.filter((player) => !used.has(player.id))
  return rotation.map((id) => id || remaining.shift()?.id || '')
}

export type CreateMatchOptions = {
  roster: CourtPlayer[]
  playerSide?: Side
  server?: Side
  targetScore?: number
  /** Marcador con el que arranca el set (por ejemplo, 17-19). */
  startScore?: Partial<Record<Side, number>>
  /** En CT1 la tensión reemplaza la energía por rally. */
  useTension?: boolean
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
    score: {
      home: options.startScore?.home ?? 0,
      away: options.startScore?.away ?? 0,
    },
    tension: { home: 30, away: 30 },
    useTension: options.useTension ?? false,
    ap: 0,
    defenseTechniqueUsed: false,
    players,
    formation: Object.fromEntries(
      players.map((player) => [player.id, { ...player.cell }]),
    ),
    rotation: { home: [], away: [] },
    ball: { ...players[0].cell },
    passQuality: 0,
    setQuality: 0,
    setAttackerId: null,
    setZone: null,
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
  state.rotation.home = rotationFromPlayers(state, 'home')
  state.rotation.away = rotationFromPlayers(state, 'away')
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
  for (const side of ['home', 'away'] as const) {
    const rotation = state.rotation[side]
    if (rotation.length === 6) {
      const cells = ROTATION_CELLS[side]
      rotation.forEach((id, index) => {
        const player = playerById(state, id)
        if (player) player.cell = { ...cells[index] }
      })
      continue
    }
    for (const player of state.players.filter(
      (candidate) => candidate.side === side,
    )) {
      const target = state.formation[player.id]
      if (target) player.cell = { ...target }
    }
  }
}

/**
 * Rotación de side-out: el equipo que gana el saque rota en sentido
 * horario. Si el líbero queda en la red, se intercambia con un jugador
 * de fondo para que siga cubriendo la zaga.
 */
export const rotateSide = (state: MatchState, side: Side): void => {
  const rotation = state.rotation[side]
  if (rotation.length !== 6) return
  const next = [
    rotation[1],
    rotation[2],
    rotation[3],
    rotation[4],
    rotation[5],
    rotation[0],
  ]
  const back = new Set([0, 4, 5])
  const liberoIndex = next.findIndex(
    (id) => playerById(state, id)?.classId === 'libero',
  )
  if (liberoIndex !== -1 && !back.has(liberoIndex)) {
    let swapIndex = next.findIndex(
      (id, index) =>
        back.has(index) && playerById(state, id)?.classId === 'middle',
    )
    if (swapIndex === -1) {
      swapIndex = next.findIndex(
        (id, index) =>
          back.has(index) && playerById(state, id)?.classId !== 'libero',
      )
    }
    if (swapIndex !== -1) {
      const temp = next[liberoIndex]
      next[liberoIndex] = next[swapIndex]
      next[swapIndex] = temp
    }
  }
  state.rotation[side] = next
}

const awardPoint = (
  state: MatchState,
  side: Side,
  reason: PointReason,
): MatchEvent[] => {
  const previousServer = state.server
  state.score[side] += 1
  if (state.useTension) {
    state.tension[side] = Math.min(100, state.tension[side] + 10)
    const other = otherSide(side)
    state.tension[other] = Math.max(0, state.tension[other] - 5)
  }
  if (side !== previousServer) rotateSide(state, side)
  state.server = side
  state.possession = side
  state.ap = 0
  state.defenseTechniqueUsed = false
  state.passQuality = 0
  state.setQuality = 0
  state.setAttackerId = null
  state.setZone = null
  state.attackerId = null
  state.hiddenAttack = null
  state.hiddenScheme = null
  state.rallyAttacks = 0
  state.rallyNumber += 1

  const events: MatchEvent[] = [
    { type: 'POINT', side, reason, score: { ...state.score } },
  ]
  const lead = state.score[side] - state.score[otherSide(side)]
  if (state.score[side] >= state.targetScore && lead >= 2) {
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
  if (state.useTension) {
    const gain =
      passQuality === 3 ? 10 : passQuality === 2 ? 5 : passQuality === 1 ? 2 : 0
    state.tension[side] = Math.min(100, state.tension[side] + gain)
  }
  state.attackerId = null
  state.setAttackerId = null
  state.setZone = null
  state.hiddenAttack = null
  state.hiddenScheme = null
}

/**
 * Elige a quién arma el setter en CT1. Puntúa el mejor ataque disponible
 * de cada atacante y elige entre los mejores para que el armado varíe.
 */
const chooseSetTarget = (
  state: MatchState,
  side: Side,
  rng: Rng,
): CourtPlayer | null => {
  const targets = cellsOfSide(otherSide(side))
  const scored = playersOf(state, side)
    .filter(
      (player) =>
        player.classId !== 'setter' && player.classId !== 'libero',
    )
    .map((player) => {
      let value = Number.NEGATIVE_INFINITY
      for (const kind of attackKindsFor(player)) {
        for (const target of targets) {
          if (!isAttackAllowed({ attacker: player, kind, target }).ok) {
            continue
          }
          value = Math.max(
            value,
            attackValue(player, kind, state.setQuality, target),
          )
        }
      }
      return { player, value }
    })
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value)

  if (scored.length === 0) return null
  const best = scored[0].value
  const pool = scored.filter((entry) => best - entry.value <= 2.2)
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
    .player
}

/**
 * Autoarmado: el balón viaja al atacante elegido y el ataque queda listo.
 * Devuelve los eventos intermedios y deja `state.phase` en ATTACK o DEFEND.
 */
const autoSet = (
  state: MatchState,
  side: Side,
  lastTouchId: string,
  rng: Rng,
): MatchEvent[] => {
  const setter = designatedSetter(state, side, lastTouchId)
  let distance = manhattan(setter.cell, state.ball)
  // El armador corre a la pelota: una buena cobertura no debe terminar
  // en error de armado solo por la distancia.
  if (distance > 2) {
    setter.cell = { ...state.ball }
    distance = 0
  }
  const quality = setQuality(state.passQuality, setter, distance)

  if (quality === 0) {
    state.setAttackerId = null
    state.setZone = null
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

  state.setQuality = quality
  state.phase = side === state.playerSide ? 'ATTACK' : 'DEFEND'

  let setTarget: CourtPlayer | null = null
  if (state.phase === 'DEFEND') {
    const plan = chooseAttackPlan(state, rng)
    state.hiddenScheme = null
    state.hiddenAttack = plan
    state.attackerId = plan?.attackerId ?? null
    if (state.useTension && plan) {
      setTarget = playerById(state, plan.attackerId) ?? null
    }
  } else {
    state.attackerId = null
    state.hiddenAttack = null
    state.hiddenScheme = chooseDefenseScheme(state, rng)
    if (state.useTension) setTarget = chooseSetTarget(state, side, rng)
  }

  state.setAttackerId = setTarget?.id ?? null
  state.setZone = setTarget
    ? attackZoneForCell(setTarget.side, setTarget.cell.col)
    : null
  state.ball = setTarget ? { ...setTarget.cell } : { ...setter.cell }

  return [
    {
      type: 'SET',
      setterId: setter.id,
      quality,
      to: { ...state.ball },
      outcome: 'ok',
    },
  ]
}

export type ReceptionChoice = {
  receiverId?: string
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
  choice: ReceptionChoice = {},
  pressure = 1,
  zone?: ServeZone,
): EngineResult => {
  assert(state.phase === 'SERVE', 'No es la fase de saque.')
  assert(
    target.side === otherSide(state.server),
    'El saque debe ir al campo rival.',
  )
  const next = cloneState(state)
  const serverPlayer = designatedServer(next, next.server)
  next.ball = { ...serverPlayer.cell }
  next.setAttackerId = null
  next.setZone = null

  // El destino elegido puede fallar: corto a la red, fondo afuera.
  if (zone) {
    const fault = serveFault(serverPlayer, zone, rng())
    if (fault) {
      const events: MatchEvent[] = [
        {
          type: 'SERVE',
          serverId: serverPlayer.id,
          target: { ...target },
          receiverId: null,
          quality: null,
          outcome: fault,
          zone,
        },
      ]
      return {
        state: next,
        events: [
          ...events,
          ...awardPoint(next, otherSide(next.server), 'error'),
        ],
      }
    }
  }

  const receivingSide = otherSide(next.server)
  const result = receiverForServe(
    next,
    receivingSide,
    target,
    pressure,
  )
  if (!result) {
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: serverPlayer.id,
        target: { ...target },
        receiverId: null,
        quality: null,
        outcome: 'ace',
        zone,
      },
    ]
    return {
      state: next,
      events: [...events, ...awardPoint(next, next.server, 'ace')],
    }
  }

  const requested = choice.receiverId
    ? playerById(next, choice.receiverId)
    : undefined
  const requestedInReach =
    requested &&
    requested.side === receivingSide &&
    cellDistance(requested.cell, target) <= SERVE_REACH
  const receiver = requestedInReach ? requested : result.receiver
  const value = requestedInReach
    ? receptionValue({
        player: receiver,
        ballCell: target,
        pressure,
        seam: result.seam,
      })
    : result.value - (requested ? 1 : 0)
  const effectiveValue = value
  const rawQuality = receptionQuality(effectiveValue)
  const saved =
    rawQuality === 0 &&
    next.useTension &&
    rng() < receptionSaveChance(receiver)
  const quality: Quality = saved ? 1 : rawQuality
  const from = { ...receiver.cell }
  const setter = designatedSetter(next, receivingSide, receiver.id)
  const dig =
    saved ||
    (pressure >= 2 &&
      (receiver.classId === 'libero' ||
        (receiver.stats.velocidad >= 4 && receiver.stats.tecnica < 4)))

  if (quality === 0) {
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: serverPlayer.id,
        target: { ...target },
        receiverId: receiver.id,
        quality,
        outcome: 'ace',
        zone,
      },
    ]
    return {
      state: next,
      events: [...events, ...awardPoint(next, next.server, 'ace')],
    }
  }

  movePlayer(next, receiver.id, target)

  // La exigida se parte según el valor: queda para un compañero o se va
  // como free ball. Solo aplica al flujo CT1 (con destino elegido).
  const freeBall =
    zone !== undefined && quality === 1 && effectiveValue < 3
  const teammate =
    zone !== undefined && quality === 1 && effectiveValue >= 3

  if (freeBall) {
    const opponent = otherSide(receivingSide)
    const freeReceiver =
      playersOf(next, opponent).find(
        (player) => player.classId === 'libero',
      ) ??
      playersOf(next, opponent).find(
        (player) => player.classId !== 'setter',
      ) ??
      playersOf(next, opponent)[0]
    assert(freeReceiver, 'El rival no tiene receptor para la free ball.')
    const freeSetter = designatedSetter(next, opponent, freeReceiver.id)
    const freeFrom = { ...freeReceiver.cell }
    startPossession(
      next,
      opponent,
      freeReceiver.cell,
      3,
      MATCH_AP_START + MATCH_AP_REFUND,
    )
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: serverPlayer.id,
        target: { ...target },
        receiverId: receiver.id,
        quality,
        outcome: 'ok',
        zone,
      },
      {
        type: 'RECEIVE',
        playerId: receiver.id,
        from,
        to: { ...freeReceiver.cell },
        quality,
        freeBall: true,
        dig,
      },
      {
        type: 'FREE_BALL',
        fromSide: receivingSide,
        toSide: opponent,
      },
      {
        type: 'RECEIVE',
        playerId: freeReceiver.id,
        from: freeFrom,
        to: { ...freeSetter.cell },
        quality: 3,
      },
    ]
    return {
      state: next,
      events: [
        ...events,
        ...autoSet(next, opponent, freeReceiver.id, rng),
      ],
    }
  }

  startPossession(
    next,
    receivingSide,
    receiver.cell,
    quality,
    MATCH_AP_SERVE + (quality === 3 ? MATCH_AP_REFUND : 0),
  )

  const events: MatchEvent[] = [
    {
      type: 'SERVE',
      serverId: serverPlayer.id,
      target: { ...target },
      receiverId: receiver.id,
      quality,
      outcome: 'ok',
      zone,
    },
    {
      type: 'RECEIVE',
      playerId: receiver.id,
      from,
      to: { ...setter.cell },
      quality,
      teammate,
      dig,
    },
  ]

  return {
    state: next,
    events: [
      ...events,
      ...autoSet(next, next.possession, receiver.id, rng),
    ],
  }
}

export const aiServe = (
  state: MatchState,
  rng: Rng = Math.random,
  choice: ReceptionChoice = {},
): EngineResult => serve(state, chooseServeTarget(state, rng), rng, choice)

/** Saque de la IA con destino/zona, para el flujo CT1. */
export const aiServeCt1 = (
  state: MatchState,
  rng: Rng = Math.random,
  choice: ReceptionChoice = {},
): EngineResult => {
  const target = chooseServeTarget(state, rng)
  const server = designatedServer(state, state.server)
  const zone = serveZoneForTarget(state.server, target)
  return serve(state, target, rng, choice, servePressure(server), zone)
}

export type ServeType = 'power' | 'float' | 'short'

const serveTargetForType = (
  state: MatchState,
  type: ServeType,
): CourtCell => {
  const side = otherSide(state.server)
  const pressure = servePressure(designatedServer(state, state.server))
  const scored = cellsOfSide(side).map((target) => {
    const result = receiverForServe(state, side, target, pressure)
    const value = result?.value ?? -2
    const seam = result?.seam ? 1 : 0
    let score: number
    if (type === 'power') {
      score = -value + seam * 0.5
    } else if (type === 'float') {
      score = seam * 4 - value * 0.4
    } else {
      score = (target.row === 2 ? 4 : 0) + seam - value * 0.2
    }
    return { target, score }
  })
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.target.row - b.target.row ||
      a.target.col - b.target.col,
  )
  return scored[0]?.target ?? cellsOfSide(side)[5]
}

/** Saque por tipo: el destino lo resuelve el sistema, no el jugador. */
export const serveAuto = (
  state: MatchState,
  type: ServeType,
  rng: Rng = Math.random,
  choice: ReceptionChoice = {},
): EngineResult => {
  const target = serveTargetForType(state, type)
  return serve(
    state,
    target,
    rng,
    choice,
    type === 'power' ? 2 : 1,
  )
}

type BlockDigResult = {
  digger: CourtPlayer
  quality: Quality
  blockCell: CourtCell
}

/** Elige al defensa de fondo que levanta un bloqueo que quedó vivo. */
const resolveBlockDig = (
  state: MatchState,
  side: Side,
  resolution: DuelResolution,
): BlockDigResult | null => {
  const blocker = playerById(state, resolution.defenderId)
  const blockCell = blocker
    ? { ...blocker.cell }
    : { ...state.ball }
  const backRow = playersOf(state, side).filter(
    (player) => player.cell.row === 2,
  )
  const pool = backRow.length > 0 ? backRow : playersOf(state, side)
  const best = pool
    .map((player) => ({
      digger: player,
      value: receptionValue({
        player,
        ballCell: blockCell,
        pressure: 2,
        seam: false,
      }),
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.digger.id.localeCompare(b.digger.id),
    )[0]
  if (!best) return null
  const quality = receptionQuality(best.value)
  if (quality === 0) return null
  return { digger: best.digger, quality, blockCell }
}

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
  const kindCost = ATTACK_AP_COST[kind]
  const techniqueCost = technique?.cost ?? 0
  const cost = kindCost + techniqueCost
  const tensionCost = kindCost * 15 + techniqueCost * 10
  assert(
    state.useTension
      ? state.tension[state.playerSide] >= tensionCost
      : state.ap >= cost,
    'No hay energía para ese ataque.',
  )

  const next = cloneState(state)
  if (next.rallyAttacks >= MATCH_RALLY_CAP) {
    return { state: next, events: awardPoint(next, otherSide(next.playerSide), 'cap') }
  }

  if (next.useTension) {
    next.tension[next.playerSide] = Math.max(
      0,
      next.tension[next.playerSide] - tensionCost,
    )
  } else {
    next.ap = Math.max(0, next.ap - cost)
  }

  const fault = attackFault(attacker, kind, next.setQuality, rng())
  if (fault) {
    const defending = playersOf(next, otherSide(attacker.side))
    const defender =
      schemeDefender(defending, scheme, target, kind === 'quick').player ??
      defending[0]
    assert(defender, 'No hay defensor para el fault.')
    const resolution: DuelResolution = {
      A: 0,
      D: 0,
      edge: 0,
      zone: 0,
      outcome: 'fault',
      fault,
      digQuality: null,
      defenderId: defender.id,
      blockerIds: [],
      scheme,
    }
    next.rallyAttacks += 1
    next.attackerId = attacker.id
    next.hiddenScheme = null
    const events: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: attacker.id,
        kind,
        target: { ...target },
        resolution,
      },
    ]
    return {
      state: next,
      events: [
        ...events,
        ...awardPoint(next, otherSide(attacker.side), 'error'),
      ],
    }
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
  if (resolution.outcome === 'blocked') {
    const blocker = playerById(next, resolution.defenderId)
    assert(blocker, 'El bloqueo no tiene protagonista.')
    resolution.block = resolveBlockOutcome(
      resolution,
      blocker,
      kind,
      rng,
    )
  }
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
    const defendingSide = otherSide(attacker.side)
    const block = resolution.block ?? 'stuff'
    if (block === 'stuff') {
      return {
        state: next,
        events: [...events, ...awardPoint(next, defendingSide, 'block')],
      }
    }
    if (block === 'out') {
      return {
        state: next,
        events: [...events, ...awardPoint(next, attacker.side, 'blockOut')],
      }
    }
    const dig = resolveBlockDig(next, defendingSide, resolution)
    if (!dig) {
      return {
        state: next,
        events: [...events, ...awardPoint(next, attacker.side, 'blockDown')],
      }
    }
    const setter = designatedSetter(next, defendingSide, dig.digger.id)
    const digFrom = { ...dig.digger.cell }
    movePlayer(next, dig.digger.id, dig.blockCell)
    startPossession(
      next,
      defendingSide,
      dig.blockCell,
      dig.quality,
      MATCH_AP_START + (dig.quality === 3 ? MATCH_AP_REFUND : 0),
    )
    const blockDigEvent: MatchEvent = {
      type: 'DIG',
      defenderId: dig.digger.id,
      from: digFrom,
      to: { ...setter.cell },
      quality: dig.quality,
    }
    return {
      state: next,
      events: [
        ...events,
        blockDigEvent,
        ...autoSet(next, defendingSide, dig.digger.id, rng),
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
  const kindCost = ATTACK_AP_COST[plan.kind]
  const attackTechniqueCost = attackTechnique?.cost ?? 0
  const cost = kindCost + attackTechniqueCost
  const defenseTensionCost = (technique?.cost ?? 0) * 10
  assert(
    !state.useTension ||
      state.tension[state.playerSide] >= defenseTensionCost,
    'No hay tensión para la técnica defensiva.',
  )

  const next = cloneState(state)
  if (next.rallyAttacks >= MATCH_RALLY_CAP) {
    return { state: next, events: awardPoint(next, next.playerSide, 'cap') }
  }

  // El ataque rival usa su energía por rally; la tensión del jugador paga
  // solo la técnica defensiva.
  next.ap = Math.max(0, next.ap - cost)
  if (next.useTension) {
    next.tension[next.playerSide] = Math.max(
      0,
      next.tension[next.playerSide] - defenseTensionCost,
    )
  }

  const fault = attackFault(attacker, plan.kind, next.setQuality, rng())
  if (fault) {
    const defending = playersOf(next, next.playerSide)
    const autoDefender =
      schemeDefender(defending, scheme, plan.target, plan.kind === 'quick')
        .player ?? defending[0]
    assert(autoDefender, 'No hay defensor para el fault.')
    const resolution: DuelResolution = {
      A: 0,
      D: 0,
      edge: 0,
      zone: 0,
      outcome: 'fault',
      fault,
      digQuality: null,
      defenderId: autoDefender.id,
      blockerIds: [],
      scheme,
    }
    next.rallyAttacks += 1
    next.attackerId = attacker.id
    next.hiddenAttack = null
    const events: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: attacker.id,
        kind: plan.kind,
        target: { ...plan.target },
        resolution,
      },
    ]
    return {
      state: next,
      events: [...events, ...awardPoint(next, next.playerSide, 'error')],
    }
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
  if (resolution.outcome === 'blocked') {
    const blocker = playerById(next, resolution.defenderId)
    assert(blocker, 'El bloqueo no tiene protagonista.')
    resolution.block = resolveBlockOutcome(
      resolution,
      blocker,
      plan.kind,
      rng,
    )
  }
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
    const block = resolution.block ?? 'stuff'
    if (block === 'stuff') {
      return {
        state: next,
        events: [
          ...events,
          ...awardPoint(next, next.playerSide, 'block'),
        ],
      }
    }
    if (block === 'out') {
      return {
        state: next,
        events: [
          ...events,
          ...awardPoint(next, attacker.side, 'blockOut'),
        ],
      }
    }
    const blockDig = resolveBlockDig(next, next.playerSide, resolution)
    if (!blockDig) {
      return {
        state: next,
        events: [
          ...events,
          ...awardPoint(next, attacker.side, 'blockDown'),
        ],
      }
    }
    const blockSetter = designatedSetter(
      next,
      next.playerSide,
      blockDig.digger.id,
    )
    const blockDigFrom = { ...blockDig.digger.cell }
    movePlayer(next, blockDig.digger.id, blockDig.blockCell)
    startPossession(
      next,
      next.playerSide,
      blockDig.blockCell,
      blockDig.quality,
      MATCH_AP_START + (blockDig.quality === 3 ? MATCH_AP_REFUND : 0),
    )
    return {
      state: next,
      events: [
        ...events,
        {
          type: 'DIG',
          defenderId: blockDig.digger.id,
          from: blockDigFrom,
          to: { ...blockSetter.cell },
          quality: blockDig.quality,
        },
        ...autoSet(next, next.playerSide, blockDig.digger.id, rng),
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
