import { cellsOfSide, isSeam, moveDistance, otherSide, reaches, zoneOf } from './geometry'
import {
  ATTACK_AP_COST,
  DEFENSE_SCHEMES,
  PRESSURE_VALUE,
  SCHEME_LABEL,
  ATTACK_LABEL,
} from './rules'
import {
  attackKindsFor,
  isAttackAllowed,
  receptionQuality,
  receptionValue,
  resolveDuel,
  setQuality,
} from './resolve'
import { playerById, playersOf } from './state'
import type {
  AttackKind,
  AttackPlan,
  Cell,
  Command,
  DefenseScheme,
  DuelResolution,
  GameState,
  Player,
  Quality,
} from './types'

export type Rng = () => number

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(items: T[], rng: Rng): T =>
  items[Math.floor(rng() * items.length)]

const pickWeighted = <T>(
  items: { item: T; weight: number }[],
  rng: Rng,
): T => {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return pick(items, rng).item
  let roll = rng() * total
  for (const entry of items) {
    roll -= entry.weight
    if (roll <= 0) return entry.item
  }
  return items[items.length - 1].item
}

const classPriority = (player: Player): number => {
  switch (player.classId) {
    case 'setter':
      return 0
    case 'libero':
      return 1
    case 'middle':
      return 2
    case 'opposite':
      return 3
  }
}

export type AttackOption = {
  kind: AttackKind
  target: Cell
  score: number
}

const pickNearBest = <T extends { score: number }>(
  options: T[],
  rng: Rng,
  tolerance: number,
): T => {
  const maximum = Math.max(...options.map((option) => option.score))
  const pool = options.filter((option) => maximum - option.score <= tolerance)
  return pick(pool, rng)
}

const scoreResolution = (resolution: DuelResolution): number => {
  const margin =
    resolution.outcome === 'point'
      ? resolution.A - resolution.D
      : resolution.D - resolution.A
  if (resolution.outcome === 'point') return 10 + Math.min(margin, 4) * 0.35
  if (resolution.outcome === 'blocked') return 0.5 + Math.min(margin, 4) * 0.1
  return 5 - (3 - resolution.digQuality!) + Math.min(margin, 4) * 0.15
}

type SchemeWeights = Record<DefenseScheme, number>

const uniformWeights = (): SchemeWeights => ({
  wall: 1,
  spread: 1,
  deep: 1,
  libero: 1,
})

/** La IA ataca donde el rival suele sentirse cómodo. */
const schemeWeightsFor = (
  state: GameState,
  defendingSide: GameState['playerSide'],
): SchemeWeights => {
  const weights = uniformWeights()
  const recent = state.defenseHistory
    .filter((record) => record.side === defendingSide)
    .slice(-8)
  for (const record of recent) weights[record.scheme] += 0.8
  return weights
}

const expectedAttackScore = (
  attacker: Player,
  kind: AttackKind,
  target: Cell,
  setQ: Quality,
  defending: Player[],
  weights: SchemeWeights,
): number => {
  let total = 0
  let weightSum = 0
  for (const scheme of DEFENSE_SCHEMES) {
    const resolution = resolveDuel({
      attacker,
      kind,
      target,
      setQuality: setQ,
      defending,
      scheme,
    })
    total += weights[scheme] * scoreResolution(resolution)
    weightSum += weights[scheme]
  }
  return weightSum > 0 ? total / weightSum : 0
}

export const attackOptionsFor = (params: {
  attacker: Player
  setQuality: Quality
  defending: Player[]
  ap: number
  weights?: SchemeWeights
}): AttackOption[] => {
  const {
    attacker,
    setQuality: setQ,
    defending,
    ap,
    weights = uniformWeights(),
  } = params
  const targetSide = otherSide(attacker.side)
  const options: AttackOption[] = []
  for (const kind of attackKindsFor(attacker)) {
    const cost = ATTACK_AP_COST[kind]
    if (ap < cost) continue
    for (const target of cellsOfSide(targetSide)) {
      const check = isAttackAllowed({ attacker, kind, target })
      if (!check.ok) continue
      const open = defending.every((player) => !reaches(player.cell, target))
      const score =
        expectedAttackScore(attacker, kind, target, setQ, defending, weights) -
        cost * 0.1 +
        (open ? 0.25 : 0)
      options.push({ kind, target, score })
    }
  }
  return options
}

const bestAttackScore = (
  attacker: Player,
  setQ: Quality,
  defending: Player[],
  ap: number,
  weights: SchemeWeights,
): number => {
  const options = attackOptionsFor({
    attacker,
    setQuality: setQ,
    defending,
    ap,
    weights,
  })
  if (options.length === 0) return -Infinity
  return Math.max(...options.map((option) => option.score))
}

const chooseServe = (state: GameState, rng: Rng): Command => {
  const receiving = otherSide(state.server)
  const receivingPlayers = playersOf(state, receiving)
  const targets = cellsOfSide(receiving).map((target) => {
    const receivers = receivingPlayers.filter((p) => reaches(p.cell, target))
    if (receivers.length === 0) return { target, score: 0 }
    const seam = isSeam(receivingPlayers, target, receiving)
    const best = Math.max(
      ...receivers.map((player) =>
        receptionQuality(
          receptionValue(player, target, PRESSURE_VALUE.serve, seam),
        ),
      ),
    )
    return { target, score: best }
  })
  // Apunta al pasador más débil, pero no siempre: un saque previsible
  // regala pases perfectos y vuelve el partido una sola jugada.
  const pool = targets.map((entry) => ({
    item: entry.target,
    weight: 1 + Math.max(0, 3 - entry.score) * 1.1,
  }))
  return { type: 'SERVE', target: pickWeighted(pool, rng) }
}

const chooseReceive = (state: GameState, rng: Rng): Command => {
  const side = state.possession
  const teammates = playersOf(state, side)
  const ballCell = state.ball.cell
  const pressure = PRESSURE_VALUE[state.ball.pressure]

  if (teammates.every((player) => !reaches(player.cell, ballCell))) {
    return { type: 'RECEIVE', playerId: null }
  }

  const seam = isSeam(teammates, ballCell, side)
  const plans = teammates
    .filter((player) => reaches(player.cell, ballCell))
    .map((player) => {
      const value = receptionValue(player, ballCell, pressure, seam)
      const quality = receptionQuality(value)
      const nextSetter = teammates
        .filter((mate) => mate.id !== player.id)
        .sort(
          (a, b) =>
            classPriority(a) - classPriority(b) ||
            moveDistance(a.cell, player.cell) - moveDistance(b.cell, player.cell),
        )[0]
      const nextSet = nextSetter
        ? setQuality(quality, nextSetter, moveDistance(nextSetter.cell, player.cell))
        : 0
      return {
        player,
        value,
        score: quality * 10 + nextSet * 3,
      }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.value - a.value ||
        a.player.id.localeCompare(b.player.id),
    )

  const best = plans[0]
  const pool = plans.filter((plan) => Math.abs(plan.score - best.score) < 1e-9)
  return { type: 'RECEIVE', playerId: pick(pool, rng).player.id }
}

const chooseSet = (state: GameState, rng: Rng): Command => {
  const side = state.possession
  const teammates = playersOf(state, side)
  const ballCell = state.ball.cell
  const candidates = teammates.filter(
    (player) => player.id !== state.ball.lastTouchId,
  )
  if (candidates.length === 0) {
    throw new Error('No hay armador disponible.')
  }

  const setters = candidates
    .map((player) => ({
      player,
      distance: moveDistance(player.cell, ballCell),
      quality: setQuality(
        state.passQuality,
        player,
        moveDistance(player.cell, ballCell),
      ),
    }))
    .sort(
      (a, b) =>
        b.quality - a.quality ||
        classPriority(a.player) - classPriority(b.player) ||
        a.distance - b.distance ||
        a.player.id.localeCompare(b.player.id),
    )
  const setter = setters[0]
  const setQ = setter.quality

  const defendingSide = otherSide(side)
  const defending = playersOf(state, defendingSide)
  const weights = schemeWeightsFor(state, defendingSide)
  const options = teammates
    .filter(
      (player) =>
        player.id !== setter.player.id &&
        player.classId !== 'libero' &&
        attackKindsFor(player).length > 0,
    )
    .map((player) => ({
      target: player,
      score: bestAttackScore(
        player,
        setQ,
        defending,
        state.ap,
        weights,
      ),
    }))
    .filter((option) => Number.isFinite(option.score))
    .sort(
      (a, b) =>
        b.score - a.score || a.target.id.localeCompare(b.target.id),
    )

  if (options.length === 0) {
    const fallback = teammates.find(
      (player) =>
        player.id !== setter.player.id && player.classId !== 'libero',
    )
    if (!fallback) throw new Error('No hay atacante disponible.')
    return {
      type: 'SET',
      setterId: setter.player.id,
      targetId: fallback.id,
    }
  }

  const target = pickNearBest(options, rng, 1)
  return {
    type: 'SET',
    setterId: setter.player.id,
    targetId: target.target.id,
  }
}

/**
 * La IA elige su esquema antes de ver la jugada del jugador.
 * Usa clase de atacante, calidad del armado y el historial rival.
 */
export const chooseDefenseScheme = (
  state: GameState,
  rng: Rng,
): DefenseScheme => {
  const defendingSide = otherSide(state.possession)
  const attacker = playerById(state, state.attackerId)
  const weights = uniformWeights()

  if (attacker) {
    if (attacker.classId === 'middle') {
      weights.wall += 0.6
      weights.spread += 0.2
    }
    if (attacker.classId === 'opposite') {
      weights.deep += 0.6
      weights.wall += 0.3
    }
    if (attacker.classId === 'setter') {
      weights.libero += 0.6
      weights.spread += 0.3
    }
    if (attacker.cell.row === 1) {
      weights.wall += 0.5
    }
  }

  if (state.setQuality <= 1) {
    weights.wall += 0.5
    weights.spread += 0.4
  } else if (state.setQuality >= 3) {
    weights.deep += 0.7
    weights.libero += 0.4
  }

  const recent = state.attackHistory
    .filter((record) => record.side === state.possession)
    .slice(-6)
  for (const record of recent) {
    switch (record.kind) {
      case 'power':
        weights.wall += 0.3
        weights.deep += 0.25
        break
      case 'quick':
        weights.wall += 0.3
        weights.deep += 0.15
        break
      case 'tip':
        weights.spread += 0.3
        weights.libero += 0.3
        break
      case 'wipe':
        weights.deep += 0.3
        break
      case 'pipe':
        weights.deep += 0.3
        weights.wall += 0.2
        break
      case 'placement':
        weights.spread += 0.3
        weights.libero += 0.3
        break
    }
  }

  const last = state.defenseHistory
    .filter((record) => record.side === defendingSide)
    .slice(-1)[0]
  if (last) weights[last.scheme] -= 0.9

  let best: DefenseScheme = 'wall'
  let bestScore = -Infinity
  for (const scheme of DEFENSE_SCHEMES) {
    // El ruido deja margen para sorprender: si no, la IA repite el
    // mismo esquema todo el partido apenas encuentra uno cómodo.
    const score = weights[scheme] + rng() * 1.35
    if (score > bestScore) {
      best = scheme
      bestScore = score
    }
  }
  return best
}

/** El atacante de la IA se compromete sin conocer el esquema del jugador. */
export const chooseAttackPlan = (
  state: GameState,
  rng: Rng,
): AttackPlan => {
  const attacker = playerById(state, state.attackerId)
  if (!attacker) throw new Error('No hay atacante para elegir plan.')
  const defendingSide = otherSide(attacker.side)
  const defending = playersOf(state, defendingSide)
  const weights = schemeWeightsFor(state, defendingSide)
  const options = attackOptionsFor({
    attacker,
    setQuality: state.setQuality,
    defending,
    ap: state.ap,
    weights,
  })
  if (options.length === 0) {
    throw new Error('No hay ataque legal disponible.')
  }
  const choice = pickNearBest(options, rng, 0.8)
  return { kind: choice.kind, target: { ...choice.target } }
}

/**
 * Después de un armado, la IA rival hace su apuesta oculta:
 * - Si el jugador ataca, la IA elige esquema defensivo.
 * - Si el jugador defiende, la IA elige tipo y zona de ataque.
 */
export const withHiddenChoice = (
  state: GameState,
  rng: Rng,
): GameState => {
  if (state.phase !== 'ATTACK' && state.phase !== 'DEFEND') {
    return state.hiddenChoice === null
      ? state
      : { ...state, hiddenChoice: null }
  }
  if (state.hiddenChoice) return state

  if (state.phase === 'ATTACK') {
    const scheme = chooseDefenseScheme(state, rng)
    return {
      ...state,
      hiddenChoice: {
        type: 'defense',
        side: otherSide(state.possession),
        scheme,
      },
    }
  }

  const plan = chooseAttackPlan(state, rng)
  return {
    ...state,
    hiddenChoice: {
      type: 'attack',
      side: state.possession,
      plan,
    },
  }
}

export const chooseCommand = (state: GameState, rng: Rng): Command => {
  switch (state.phase) {
    case 'SERVE':
      return chooseServe(state, rng)
    case 'RECEIVE':
      return chooseReceive(state, rng)
    case 'SET':
      return chooseSet(state, rng)
    case 'ATTACK': {
      if (!state.attackerId) throw new Error('No hay atacante definido.')
      const plan = chooseAttackPlan(state, rng)
      return {
        type: 'ATTACK',
        playerId: state.attackerId,
        kind: plan.kind,
        target: plan.target,
      }
    }
    case 'DEFEND':
      return {
        type: 'DEFEND',
        scheme: chooseDefenseScheme(state, rng),
      }
    case 'MATCH_END':
      throw new Error('El partido ya terminó.')
  }
}

export type Tell = {
  id: string
  text: string
}

const SCHEME_TELLS: Record<DefenseScheme, [string, string]> = {
  wall: [
    'Dos manos se levantan en la red.',
    'La zona de red está bien cubierta.',
  ],
  spread: [
    'La defensa se reparte por todo el ancho.',
    'No hay una zona especialmente cargada.',
  ],
  deep: [
    'El fondo se llena de camisetas.',
    'La red queda con espacios.',
  ],
  libero: [
    'El líbero se ubica en el centro.',
    'El centro está cubierto.',
  ],
}

const ATTACK_TELLS: Record<AttackKind, string> = {
  power: 'El golpe viene fuerte y alto.',
  placement: 'Buscan el hueco, no la fuerza.',
  quick: 'El central va por el medio, rápido.',
  pipe: 'El opuesto viene de atrás.',
  wipe: 'Van a usar tus manos para sacarla.',
  tip: 'Amanuellan la bola por encima del bloqueo.',
}

const bestReader = (players: Player[]): Player | undefined =>
  [...players].sort(
    (a, b) =>
      b.stats.lectura - a.stats.lectura || a.id.localeCompare(b.id),
  )[0]

const readingPlayer = (state: GameState): Player | undefined => {
  const team = playersOf(state, state.playerSide)
  if (state.phase === 'ATTACK') {
    const attacker = playerById(state, state.attackerId)
    if (attacker?.side === state.playerSide) return attacker
  }
  return bestReader(team)
}

/**
 * Pistas veraces sobre la apuesta oculta. La Lectura del jugador
 * desbloquea una segunda pista; nunca revela el resultado.
 */
export const tellsFor = (state: GameState): Tell[] => {
  const hidden = state.hiddenChoice
  if (!hidden) return []
  const reader = readingPlayer(state)
  const count = (reader?.stats.lectura ?? 0) >= 4 ? 2 : 1

  if (hidden.type === 'defense') {
    return SCHEME_TELLS[hidden.scheme]
      .slice(0, count)
      .map((text, index) => ({ id: `scheme-${index}`, text }))
  }

  const zone = zoneOf(hidden.plan.target.row, hidden.plan.target.col)
  return [
    {
      id: 'attack-kind',
      text: `${ATTACK_TELLS[hidden.plan.kind]} (${ATTACK_LABEL[hidden.plan.kind]})`,
    },
    {
      id: 'attack-zone',
      text: `Apuntan a la zona ${zone}.`,
    },
  ].slice(0, count)
}

export const schemeTell = (scheme: DefenseScheme): string =>
  SCHEME_LABEL[scheme]
