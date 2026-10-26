import {
  cellsOfSide,
  isSeam,
  moveDistance,
  neighborCells,
  orthogonalNeighborCells,
  otherSide,
  reaches,
} from './geometry'
import {
  ATTACK_AP_COST,
  PRESSURE_VALUE,
  TEMPO_AP_COST,
} from './rules'
import {
  evaluateAttack,
  isAttackAllowed,
  receptionQuality,
  receptionValue,
  setQuality,
} from './resolve'
import { isOccupied, playersOf } from './state'
import type {
  AttackKind,
  AttackResolution,
  Cell,
  Command,
  GameState,
  Player,
  Quality,
  Tempo,
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
  resolution: AttackResolution
  score: number
}

const outcomeScore = (resolution: AttackResolution): number => {
  if (resolution.outcome === 'point') return 10
  if (resolution.outcome === 'blocked') return 0
  return 4 - (3 - resolution.digQuality!)
}

export const attackOptionsFor = (params: {
  attacker: Player
  setQuality: Quality
  tempo: Tempo
  defending: Player[]
  ap: number
}): AttackOption[] => {
  const { attacker, setQuality: setQ, tempo, defending, ap } = params
  const options: AttackOption[] = []
  const kinds: AttackKind[] = [
    'power',
    'placement',
    'quick',
    'pipe',
    'wipe',
    'tip',
  ]
  for (const kind of kinds) {
    const cost = ATTACK_AP_COST[kind]
    if (ap < cost) continue
    for (const target of cellsOfSide(otherSide(attacker.side))) {
      const check = isAttackAllowed({ attacker, kind, tempo, target, defending })
      if (!check.ok) continue
      const resolution = evaluateAttack(attacker, setQ, kind, target, defending)
      options.push({
        kind,
        target,
        resolution,
        score: outcomeScore(resolution) - cost * 0.01,
      })
    }
  }
  return options
}

export const attackOptions = (state: GameState): AttackOption[] => {
  const attacker = state.players.find((p) => p.id === state.attackerId)
  if (!attacker || !state.tempo) return []
  return attackOptionsFor({
    attacker,
    setQuality: state.setQuality,
    tempo: state.tempo,
    defending: playersOf(state, otherSide(attacker.side)),
    ap: state.ap,
  })
}

const bestAttackScore = (state: GameState): number => {
  const options = attackOptions(state)
  if (options.length === 0) return -1
  return Math.max(...options.map((option) => option.score))
}

const chooseServe = (state: GameState, rng: Rng): Command => {
  const receiving = otherSide(state.server)
  const receivingPlayers = playersOf(state, receiving)
  const targets = cellsOfSide(receiving).map((target) => {
    const receivers = receivingPlayers.filter((p) => reaches(p.cell, target))
    if (receivers.length === 0) return { target, score: -1 }
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
  const minimum = Math.min(...targets.map((entry) => entry.score))
  const pool = targets.filter((entry) => entry.score === minimum)
  return { type: 'SERVE', target: pick(pool, rng).target }
}

const chooseReceive = (state: GameState, rng: Rng): Command => {
  const side = state.possession
  const teammates = playersOf(state, side)
  const ballCell = state.ball.cell
  const pressure = PRESSURE_VALUE[state.ball.pressure]

  type Plan = {
    player: Player
    destination: Cell | null
    score: number
  }
  const plans: Plan[] = []

  for (const player of teammates) {
    const destinations: Array<Cell | null> = []
    if (reaches(player.cell, ballCell)) destinations.push(null)
    if (state.ap >= 1) {
      for (const destination of orthogonalNeighborCells(player.cell)) {
        if (isOccupied(state, destination, player.id)) continue
        if (!reaches(destination, ballCell)) continue
        destinations.push(destination)
      }
    }

    for (const destination of destinations) {
      const placed = destination
        ? teammates.map((mate) =>
            mate.id === player.id
              ? { ...mate, cell: destination }
              : mate,
          )
        : teammates
      const seam = isSeam(placed, ballCell, side)
      const at = destination ?? player.cell
      const quality = receptionQuality(
        receptionValue({ ...player, cell: at }, ballCell, pressure, seam),
      )
      // Si el armador recibe, no puede armar: el armado pasa al líbero.
      const expectedSet = player.classId === 'setter' ? Math.max(0, quality - 2) : quality
      const moveCost = destination ? 0.2 : 0
      plans.push({
        player,
        destination,
        score: expectedSet - moveCost,
      })
    }
  }

  plans.sort(
    (a, b) =>
      b.score - a.score ||
      Number(a.destination !== null) - Number(b.destination !== null) ||
      a.player.id.localeCompare(b.player.id),
  )

  const best = plans[0]
  if (best?.destination) {
    return { type: 'MOVE', playerId: best.player.id, to: best.destination }
  }
  if (best) {
    return { type: 'RECEIVE', playerId: best.player.id }
  }

  void rng
  return { type: 'RECEIVE', playerId: null }
}

const stepToward = (
  state: GameState,
  player: Player,
  target: Cell,
): Cell | null => {
  const candidates = orthogonalNeighborCells(player.cell)
    .filter((cell) => !isOccupied(state, cell, player.id))
    .sort(
      (a, b) =>
        moveDistance(a, target) - moveDistance(b, target) ||
        a.row - b.row ||
        a.col - b.col,
    )
  const best = candidates[0]
  if (!best) return null
  if (moveDistance(best, target) >= moveDistance(player.cell, target)) {
    return null
  }
  return best
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
  const setter = [...candidates].sort(
    (a, b) =>
      classPriority(a) - classPriority(b) ||
      moveDistance(a.cell, ballCell) - moveDistance(b.cell, ballCell),
  )[0]

  const distance = moveDistance(setter.cell, ballCell)
  if (distance > 1 && state.ap >= 1) {
    const step = stepToward(state, setter, ballCell)
    if (step) return { type: 'MOVE', playerId: setter.id, to: step }
  }

  const defending = playersOf(state, otherSide(side))
  const options: Array<{
    tempo: Tempo
    target: Player
    score: number
  }> = []

  for (const tempo of ['high', 'quick', 'back'] as Tempo[]) {
    const tempoCost = TEMPO_AP_COST[tempo]
    if (state.ap < tempoCost) continue
    for (const target of teammates) {
      if (target.id === setter.id) continue
      if (target.classId === 'libero') continue
      if (tempo === 'quick' && target.classId !== 'middle') continue
      if (
        tempo === 'back' &&
        (target.classId !== 'opposite' || target.cell.row !== 1)
      ) {
        continue
      }
      const setQ = setQuality(state.passQuality, setter, distance)
      if (setQ === 0) continue
      const attacks = attackOptionsFor({
        attacker: target,
        setQuality: setQ,
        tempo,
        defending,
        ap: state.ap - tempoCost,
      })
      if (attacks.length === 0) continue
      const best = Math.max(...attacks.map((attack) => attack.score))
      options.push({
        tempo,
        target,
        score: best - tempoCost * 0.1,
      })
    }
  }

  if (options.length === 0) {
    const fallback = teammates.find(
      (player) => player.id !== setter.id && player.classId !== 'libero',
    )
    if (!fallback) throw new Error('No hay atacante disponible.')
    return {
      type: 'SET',
      setterId: setter.id,
      targetId: fallback.id,
      tempo: 'high',
    }
  }

  const maximum = Math.max(...options.map((option) => option.score))
  const pool = options.filter(
    (option) => Math.abs(option.score - maximum) < 1e-9,
  )
  const choice = pick(pool, rng)
  return {
    type: 'SET',
    setterId: setter.id,
    targetId: choice.target.id,
    tempo: choice.tempo,
  }
}

const withShift = (
  state: GameState,
  playerId: string,
  to: Cell,
): GameState => ({
  ...state,
  players: state.players.map((player) =>
    player.id === playerId
      ? { ...player, cell: { ...to } }
      : player,
  ),
})

const chooseDefense = (state: GameState, rng: Rng): Command => {
  void rng
  if (state.reactionAp <= 0) return { type: 'COMMIT_BLOCK' }
  const side = otherSide(state.possession)
  const current = bestAttackScore(state)
  let bestMove: { playerId: string; to: Cell } | null = null
  let bestScore = current

  for (const player of playersOf(state, side)) {
    for (const cell of neighborCells(player.cell)) {
      if (cell.row !== player.cell.row) continue
      if (isOccupied(state, cell, player.id)) continue
      const next = withShift(state, player.id, cell)
      const score = bestAttackScore(next)
      if (score < bestScore) {
        bestScore = score
        bestMove = { playerId: player.id, to: cell }
      }
    }
  }

  if (!bestMove) return { type: 'COMMIT_BLOCK' }
  return { type: 'SHIFT', playerId: bestMove.playerId, to: bestMove.to }
}

const chooseAttack = (state: GameState, rng: Rng): Command => {
  const options = attackOptions(state)
  if (options.length === 0 || !state.attackerId) {
    throw new Error('No hay ataque legal disponible.')
  }
  const maximum = Math.max(...options.map((option) => option.score))
  const pool = options.filter(
    (option) => Math.abs(option.score - maximum) < 1e-9,
  )
  const choice = pick(pool, rng)
  return {
    type: 'ATTACK',
    playerId: state.attackerId,
    kind: choice.kind,
    target: choice.target,
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
    case 'BLOCK_COMMIT':
      return chooseDefense(state, rng)
    case 'ATTACK':
      return chooseAttack(state, rng)
    case 'MATCH_END':
      throw new Error('El partido ya terminó.')
  }
}
