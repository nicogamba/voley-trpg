import { ATTACK_AP_COST, SCHEME_EDGE } from '../engine'
import type { AttackKind, DefenseScheme, Quality } from '../engine'
import {
  MATCH_RALLY_CAP,
  SERVE_REACH,
  attackValue,
  designatedServer,
  isAttackAllowed,
  playersOf,
  receptionQuality,
  receptionValue,
  resolveDuel,
  type AttackPlan,
  type MatchState,
} from './match'
import {
  cellDistance,
  cellsOfSide,
  otherSide,
  sameCell,
} from './geometry'
import type { CourtCell, CourtPlayer, Side } from './types'
import { techniquesFor } from './techniques'

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
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))]

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

const serveSeam = (
  roster: CourtPlayer[],
  target: CourtCell,
): boolean => {
  if (roster.some((player) => sameCell(player.cell, target))) return false
  return roster.filter((player) => cellDistance(player.cell, target) <= 1).length >= 2
}

const receiverForServe = (
  state: MatchState,
  side: Side,
  target: CourtCell,
): { receiver: CourtPlayer; value: number; seam: boolean } | null => {
  const roster = playersOf(state, side)
  const seam = serveSeam(roster, target)
  const candidates = roster
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
    .sort((a, b) => b.value - a.value || a.receiver.id.localeCompare(b.receiver.id))
  if (candidates.length === 0) return null
  return { ...candidates[0], seam }
}

/** La IA busca la recepción más incómoda, con algo de ruido. */
export const chooseServeTarget = (
  state: MatchState,
  rng: Rng = Math.random,
): CourtCell => {
  const side = otherSide(state.server)
  const scored = cellsOfSide(side).map((target) => {
    const result = receiverForServe(state, side, target)
    const value = result ? result.value : -2
    const quality = receptionQuality(value)
    const seam = result?.seam ? 1.4 : 0
    return {
      item: target,
      weight:
        1 +
        Math.max(0, 7 - value) * 0.7 +
        seam +
        (quality === 0 ? 2.4 : 0) +
        rng() * 0.8,
    }
  })
  return pickWeighted(scored, rng)
}

const schemeWeightsFor = (
  state: MatchState,
  defendingSide: Side,
): Record<DefenseScheme, number> => {
  const weights: Record<DefenseScheme, number> = {
    wall: 1,
    spread: 1,
    deep: 1,
    libero: 1,
  }
  const recent = state.defenseHistory
    .filter((record) => record.side === defendingSide)
    .slice(-8)
  for (const record of recent) {
    weights[record.scheme] += 0.4 * state.ai.adapt
  }
  return weights
}

export const chooseDefenseScheme = (
  state: MatchState,
  rng: Rng = Math.random,
): DefenseScheme => {
  const recent = state.attackHistory
    .filter((record) => record.side === state.playerSide)
    .slice(-6)
  const weights: Record<DefenseScheme, number> = {
    wall: 1,
    spread: 1,
    deep: 1,
    libero: 1,
  }
  for (const record of recent) {
    for (const scheme of Object.keys(weights) as DefenseScheme[]) {
      const edge = SCHEME_EDGE[scheme][record.kind]
      if (edge > 0) weights[scheme] += 0.4 * state.ai.adapt
      if (edge < 0) {
        weights[scheme] = Math.max(
          0.4,
          weights[scheme] - 0.15 * state.ai.adapt,
        )
      }
    }
  }
  for (const scheme of Object.keys(weights) as DefenseScheme[]) {
    weights[scheme] += rng() * state.ai.jitter
  }
  return pickWeighted(
    (Object.keys(weights) as DefenseScheme[]).map((scheme) => ({
      item: scheme,
      weight: weights[scheme],
    })),
    rng,
  )
}

const scoreResolution = (params: {
  attacker: CourtPlayer
  kind: AttackKind
  target: CourtCell
  setQ: Quality
  defending: CourtPlayer[]
  scheme: DefenseScheme
}): number => {
  const resolution = resolveDuel({
    attacker: params.attacker,
    kind: params.kind,
    target: params.target,
    setQuality: params.setQ,
    defending: params.defending,
    scheme: params.scheme,
  })
  const margin =
    resolution.outcome === 'point'
      ? resolution.A - resolution.D
      : resolution.D - resolution.A
  if (resolution.outcome === 'point') return 10 + Math.min(margin, 4) * 0.35
  if (resolution.outcome === 'blocked') return 0.5 + Math.min(margin, 4) * 0.1
  return 5 - (3 - (resolution.digQuality ?? 1)) + Math.min(margin, 4) * 0.15
}

type ScoredPlan = AttackPlan & { score: number; cost: number }

const aiPlans = (state: MatchState): ScoredPlan[] => {
  const side = state.possession
  const defending = playersOf(state, otherSide(side))
  const weights = schemeWeightsFor(state, otherSide(side))
  const plans: ScoredPlan[] = []
  for (const attacker of playersOf(state, side)) {
    for (const kind of [
      'power',
      'placement',
      'quick',
      'pipe',
      'wipe',
      'tip',
    ] as AttackKind[]) {
      const cost = ATTACK_AP_COST[kind]
      if (cost > state.ap) continue
      for (const target of cellsOfSide(otherSide(side))) {
        if (!isAttackAllowed({ attacker, kind, target }).ok) continue
        let expected = 0
        let totalWeight = 0
        for (const scheme of Object.keys(weights) as DefenseScheme[]) {
          expected +=
            weights[scheme] *
            scoreResolution({
              attacker,
              kind,
              target,
              setQ: state.setQuality,
              defending,
              scheme,
            })
          totalWeight += weights[scheme]
        }
        if (totalWeight === 0) continue
        plans.push({
          attackerId: attacker.id,
          kind,
          target,
          cost,
          score: expected / totalWeight + attackValue(attacker, kind, state.setQuality, target) * 0.04,
        })
      }
    }
  }
  return plans
}

const withTechnique = (
  state: MatchState,
  plan: AttackPlan,
  rng: Rng,
): AttackPlan => {
  const attacker = playersOf(state, state.possession).find(
    (player) => player.id === plan.attackerId,
  )
  if (!attacker) return plan
  const chance = Math.min(0.55, 0.22 + state.ai.adapt * 0.45)
  if (rng() > chance) return plan
  const options = techniquesFor(attacker.classId, 'attack').filter(
    (technique) =>
      state.ap >= ATTACK_AP_COST[plan.kind] + technique.cost,
  )
  if (options.length === 0) return plan
  return { ...plan, technique: pick(options, rng).id }
}

/** Elige un ataque rival entre los mejores, sin ser siempre el óptimo. */
export const chooseAttackPlan = (
  state: MatchState,
  rng: Rng = Math.random,
): AttackPlan | null => {
  if (state.rallyAttacks >= MATCH_RALLY_CAP) return null
  const plans = aiPlans(state)
  if (plans.length === 0) {
    const attacker = playersOf(state, state.possession).find(
      (player) => player.classId !== 'libero',
    )
    if (!attacker) return null
    const target = cellsOfSide(otherSide(state.possession))[5]
    return { attackerId: attacker.id, kind: 'placement', target }
  }
  if (rng() < state.ai.noise) {
    const wild = pick(plans, rng)
    return withTechnique(
      state,
      {
        attackerId: wild.attackerId,
        kind: wild.kind,
        target: { ...wild.target },
      },
      rng,
    )
  }
  const maximum = Math.max(...plans.map((plan) => plan.score))
  const pool = plans.filter(
    (plan) => maximum - plan.score <= state.ai.tolerance,
  )
  const chosen = pick(pool, rng)
  return withTechnique(
    state,
    {
      attackerId: chosen.attackerId,
      kind: chosen.kind,
      target: { ...chosen.target },
    },
    rng,
  )
}

/** Saque automático de la IA, ya resuelto como evento del motor. */
export const chooseAiServe = (
  state: MatchState,
  rng: Rng = Math.random,
): { serverId: string; target: CourtCell } => ({
  serverId: designatedServer(state, state.server).id,
  target: chooseServeTarget(state, rng),
})
