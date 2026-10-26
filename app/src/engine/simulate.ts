import { chooseCommand, mulberry32 } from './ai'
import { reduce } from './commands'
import { createMatch } from './state'
import type {
  AttackKind,
  AttackOutcome,
  EngineEvent,
  Quality,
  Side,
} from './types'

export type AttackRecord = {
  kind: AttackKind
  outcome: AttackOutcome
  A: number
  B: number
  D: number
  digQuality: Quality | null
}

export type MatchMetrics = {
  serves: number
  aces: number
  receptions: number
  receiveErrors: number
  passQualities: Quality[]
  setQualities: Quality[]
  setErrors: number
  attacks: AttackRecord[]
  rallies: number
  attacksPerRally: number[]
}

export type MatchReport = {
  seed: number
  winner: Side
  score: Record<Side, number>
  commands: number
  events: EngineEvent[]
  metrics: MatchMetrics
}

const analyze = (events: EngineEvent[]): MatchMetrics => {
  const metrics: MatchMetrics = {
    serves: 0,
    aces: 0,
    receptions: 0,
    receiveErrors: 0,
    passQualities: [],
    setQualities: [],
    setErrors: 0,
    attacks: [],
    rallies: 0,
    attacksPerRally: [],
  }
  let attacksInRally = 0

  for (const event of events) {
    switch (event.type) {
      case 'SERVE':
        metrics.serves += 1
        break
      case 'RECEIVE':
        if (event.outcome === 'ok') {
          metrics.receptions += 1
          metrics.passQualities.push(event.quality)
        } else if (event.outcome === 'ace') {
          metrics.aces += 1
        } else {
          metrics.receiveErrors += 1
        }
        break
      case 'SET':
        if (event.outcome === 'ok') {
          metrics.setQualities.push(event.quality)
        } else {
          metrics.setErrors += 1
        }
        break
      case 'ATTACK':
        metrics.attacks.push({
          kind: event.kind,
          outcome: event.resolution.outcome,
          A: event.resolution.A,
          B: event.resolution.B,
          D: event.resolution.D,
          digQuality: event.resolution.digQuality,
        })
        attacksInRally += 1
        break
      case 'POINT':
        metrics.rallies += 1
        metrics.attacksPerRally.push(attacksInRally)
        attacksInRally = 0
        break
      default:
        break
    }
  }

  return metrics
}

export type PlayMatchOptions = {
  targetScore?: number
  maxCommands?: number
  server?: Side
}

export const playMatch = (
  seed: number,
  options: PlayMatchOptions = {},
): MatchReport => {
  const rng = mulberry32(seed)
  let state = createMatch({
    targetScore: options.targetScore,
    server: options.server,
  })
  const events: EngineEvent[] = []
  const maxCommands = options.maxCommands ?? 3000
  let commands = 0

  while (state.phase !== 'MATCH_END') {
    if (commands >= maxCommands) {
      throw new Error(
        `El partido ${seed} no terminó en ${maxCommands} comandos.`,
      )
    }
    const result = reduce(state, chooseCommand(state, rng))
    state = result.state
    events.push(...result.events)
    commands += 1
  }

  return {
    seed,
    winner: state.winner!,
    score: state.score,
    commands,
    events,
    metrics: analyze(events),
  }
}

export type AggregateReport = {
  matches: number
  homeWins: number
  awayWins: number
  avgRallies: number
  avgCommands: number
  serves: number
  aces: number
  receptions: number
  receiveErrors: number
  passDistribution: [number, number, number, number]
  setDistribution: [number, number, number, number]
  setErrors: number
  attacks: number
  blocks: number
  digs: number
  contestedAttacks: number
  attackPoints: number
  blockPoints: number
  errorPoints: number
  capPoints: number
  attackKinds: Record<AttackKind, number>
  digDistribution: [number, number, number, number]
  avgAttacksPerRally: number
  blockRate: number
  digRate: number
  pointRate: number
  contestedRate: number
  perfectPassRate: number
}

export type SimulateOptions = {
  /** 'alternate' reparte el primer saque entre los dos equipos. */
  server?: Side | 'alternate'
}

export const simulateMatches = (
  count: number,
  baseSeed = 1,
  options: SimulateOptions = {},
): AggregateReport => {
  const aggregate: AggregateReport = {
    matches: count,
    homeWins: 0,
    awayWins: 0,
    avgRallies: 0,
    avgCommands: 0,
    serves: 0,
    aces: 0,
    receptions: 0,
    receiveErrors: 0,
    passDistribution: [0, 0, 0, 0],
    setDistribution: [0, 0, 0, 0],
    setErrors: 0,
    attacks: 0,
    blocks: 0,
    digs: 0,
    contestedAttacks: 0,
    attackPoints: 0,
    blockPoints: 0,
    errorPoints: 0,
    capPoints: 0,
    attackKinds: {
      power: 0,
      placement: 0,
      quick: 0,
      pipe: 0,
      wipe: 0,
      tip: 0,
    },
    digDistribution: [0, 0, 0, 0],
    avgAttacksPerRally: 0,
    blockRate: 0,
    digRate: 0,
    pointRate: 0,
    contestedRate: 0,
    perfectPassRate: 0,
  }

  let rallies = 0
  let commands = 0
  let attacksPerRally = 0

  for (let index = 0; index < count; index += 1) {
    const server =
      options.server === undefined || options.server === 'alternate'
        ? index % 2 === 0
          ? 'home'
          : 'away'
        : options.server
    const report = playMatch(baseSeed + index, { server })
    if (report.winner === 'home') aggregate.homeWins += 1
    else aggregate.awayWins += 1
    rallies += report.metrics.rallies
    commands += report.commands
    aggregate.serves += report.metrics.serves
    aggregate.aces += report.metrics.aces
    aggregate.receptions += report.metrics.receptions
    aggregate.receiveErrors += report.metrics.receiveErrors
    aggregate.setErrors += report.metrics.setErrors

    for (const quality of report.metrics.passQualities) {
      aggregate.passDistribution[quality] += 1
    }
    for (const quality of report.metrics.setQualities) {
      aggregate.setDistribution[quality] += 1
    }

    for (const attack of report.metrics.attacks) {
      aggregate.attacks += 1
      aggregate.attackKinds[attack.kind] += 1
      if (attack.B > 0) aggregate.contestedAttacks += 1
      if (attack.outcome === 'blocked') aggregate.blocks += 1
      if (attack.outcome === 'dig') {
        aggregate.digs += 1
        aggregate.digDistribution[attack.digQuality!] += 1
      }
    }

    for (const attempt of report.metrics.attacksPerRally) {
      attacksPerRally += attempt
    }

    for (const event of report.events) {
      if (event.type === 'POINT') {
        if (event.reason === 'block') aggregate.blockPoints += 1
        if (event.reason === 'attack') aggregate.attackPoints += 1
        if (event.reason === 'error') aggregate.errorPoints += 1
        if (event.reason === 'cap') aggregate.capPoints += 1
      }
    }
  }

  const totalPasses = aggregate.passDistribution.reduce(
    (sum, value) => sum + value,
    0,
  )
  aggregate.avgRallies = count > 0 ? rallies / count : 0
  aggregate.avgCommands = count > 0 ? commands / count : 0
  aggregate.avgAttacksPerRally = rallies > 0 ? attacksPerRally / rallies : 0
  aggregate.blockRate =
    aggregate.attacks > 0 ? aggregate.blocks / aggregate.attacks : 0
  aggregate.digRate =
    aggregate.attacks > 0 ? aggregate.digs / aggregate.attacks : 0
  aggregate.pointRate =
    aggregate.attacks > 0 ? aggregate.attackPoints / aggregate.attacks : 0
  aggregate.contestedRate =
    aggregate.attacks > 0 ? aggregate.contestedAttacks / aggregate.attacks : 0
  aggregate.perfectPassRate =
    totalPasses > 0 ? aggregate.passDistribution[3] / totalPasses : 0

  return aggregate
}

export const formatReport = (report: AggregateReport): string => {
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`
  return [
    `Partidos: ${report.matches} (local ${report.homeWins} / rival ${report.awayWins})`,
    `Rallies por partido: ${report.avgRallies.toFixed(1)}`,
    `Comandos por partido: ${report.avgCommands.toFixed(1)}`,
    `Ataques por rally: ${report.avgAttacksPerRally.toFixed(2)}`,
    `Saques: ${report.serves} | aces: ${report.aces} | errores de recepción: ${report.receiveErrors}`,
    `Pases: ${report.passDistribution.join(' / ')} (perfectos ${percent(report.perfectPassRate)})`,
    `Armados: ${report.setDistribution.join(' / ')} | errores: ${report.setErrors}`,
    `Ataques: ${report.attacks} | bloqueos ${percent(report.blockRate)} | digs ${percent(report.digRate)} | puntos ${percent(report.pointRate)}`,
    `Ataques con bloqueo delante: ${percent(report.contestedRate)}`,
    `Tipos: ${Object.entries(report.attackKinds)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(', ')}`,
    `Digs por calidad: ${report.digDistribution.join(' / ')}`,
    `Puntos: ataque ${report.attackPoints}, bloqueo ${report.blockPoints}, error ${report.errorPoints}, tope ${report.capPoints}`,
  ].join('\n')
}
