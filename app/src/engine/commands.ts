import {
  moveDistance,
  otherSide,
  reaches,
  sameCell,
  sideName,
  zoneLabel,
} from './geometry'
import {
  AP_MAX,
  AP_PER_POSSESSION,
  ATTACK_AP_COST,
  MAX_RALLY_ATTACKS,
  PERFECT_PASS_AP_REFUND,
  PRESSURE_VALUE,
  SCHEME_LABEL,
} from './rules'
import {
  attackKindsFor,
  isAttackAllowed,
  receptionQuality,
  receptionValue,
  resolveDuel,
  setQuality,
} from './resolve'
import {
  playerById,
  playersOf,
  resetForServe,
  startPossession,
} from './state'
import type {
  AttackKind,
  Cell,
  Command,
  DefenseScheme,
  EngineEvent,
  GameState,
  Player,
  PointReason,
  Quality,
  Side,
} from './types'

export class EngineError extends Error {}

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new EngineError(message)
}

const clone = (state: GameState): GameState => ({
  ...state,
  score: { ...state.score },
  players: state.players.map((player) => ({
    ...player,
    stats: { ...player.stats },
    cell: { ...player.cell },
  })),
  ball: { ...state.ball, cell: { ...state.ball.cell } },
  hiddenChoice:
    state.hiddenChoice?.type === 'attack'
      ? {
          ...state.hiddenChoice,
          plan: {
            ...state.hiddenChoice.plan,
            target: { ...state.hiddenChoice.plan.target },
          },
        }
      : state.hiddenChoice
        ? { ...state.hiddenChoice }
        : null,
  attackHistory: state.attackHistory.map((record) => ({ ...record })),
  defenseHistory: state.defenseHistory.map((record) => ({ ...record })),
  log: [...state.log],
})

const addLog = (
  state: GameState,
  text: string,
  tone: 'neutral' | 'good' | 'bad' = 'neutral',
): void => {
  state.log.push({ text, tone })
  if (state.log.length > 40) state.log.shift()
}

const qualityText = (quality: Quality): string =>
  ['error', 'mala', 'buena', 'perfecta'][quality]

const toneFor = (state: GameState, side: Side): 'good' | 'bad' =>
  side === state.playerSide ? 'good' : 'bad'

const pushHistory = (
  state: GameState,
  attack: { side: Side; kind: AttackKind },
  defense: { side: Side; scheme: DefenseScheme },
): void => {
  state.attackHistory.push(attack)
  state.defenseHistory.push(defense)
  if (state.attackHistory.length > 12) state.attackHistory.shift()
  if (state.defenseHistory.length > 12) state.defenseHistory.shift()
}

const awardPoint = (
  state: GameState,
  side: Side,
  reason: PointReason,
): EngineEvent[] => {
  state.score[side] += 1
  state.server = side
  addLog(
    state,
    `Punto para ${sideName(side)} (${state.score.home}-${state.score.away}).`,
    toneFor(state, side),
  )
  const events: EngineEvent[] = [
    { type: 'POINT', side, reason, score: { ...state.score } },
  ]
  if (state.score[side] >= state.targetScore) {
    state.phase = 'MATCH_END'
    state.winner = side
    addLog(state, `¡${sideName(side)} gana el set!`, toneFor(state, side))
    events.push({
      type: 'MATCH_END',
      winner: side,
      score: { ...state.score },
    })
  } else {
    resetForServe(state, side)
    events.push({ type: 'PHASE', phase: 'SERVE' })
  }
  return events
}

const capRally = (
  state: GameState,
  attacker: Player,
): { state: GameState; events: EngineEvent[] } => {
  const next = clone(state)
  addLog(next, 'El rally se estira demasiado: se cierra el punto.', 'neutral')
  return {
    state: next,
    events: awardPoint(next, otherSide(attacker.side), 'cap'),
  }
}

const applyDuel = (
  state: GameState,
  attacker: Player,
  kind: AttackKind,
  target: Cell,
  scheme: DefenseScheme,
  apCost: number,
): { state: GameState; events: EngineEvent[] } => {
  const defending = playersOf(state, otherSide(attacker.side))
  const resolution = resolveDuel({
    attacker,
    kind,
    target,
    setQuality: state.setQuality,
    defending,
    scheme,
  })
  const next = clone(state)
  next.ap = Math.max(0, next.ap - apCost)
  next.touches = 3
  next.rallyAttacks += 1
  next.hiddenChoice = null
  pushHistory(
    next,
    { side: attacker.side, kind },
    { side: otherSide(attacker.side), scheme },
  )

  const events: EngineEvent[] = [
    {
      type: 'ATTACK',
      playerId: attacker.id,
      kind,
      target: { ...target },
      scheme,
      resolution,
    },
  ]

  if (resolution.outcome === 'blocked') {
    addLog(
      next,
      `${attacker.name} ataca, pero ${SCHEME_LABEL[scheme]} lo frena. Punto rival.`,
      toneFor(next, otherSide(attacker.side)),
    )
    return {
      state: next,
      events: [
        ...events,
        ...awardPoint(next, otherSide(attacker.side), 'block'),
      ],
    }
  }

  if (resolution.outcome === 'point') {
    addLog(
      next,
      `${attacker.name} gana el duelo contra ${SCHEME_LABEL[scheme]}: ¡punto!`,
      toneFor(next, attacker.side),
    )
    return {
      state: next,
      events: [...events, ...awardPoint(next, attacker.side, 'attack')],
    }
  }

  const defender = playerById(next, resolution.defenderId)
  assert(defender, 'El dig no tiene defensor.')
  const digQuality = resolution.digQuality!
  addLog(
    next,
    `${defender.name} salva con ${SCHEME_LABEL[scheme]}: dig ${qualityText(digQuality)}.`,
    digQuality >= 2 ? toneFor(next, defender.side) : 'neutral',
  )
  startPossession(
    next,
    otherSide(attacker.side),
    {
      cell: { ...defender.cell },
      pressure: 'attack',
      quality: digQuality,
      lastTouchId: defender.id,
    },
    digQuality,
  )
  if (digQuality === 3) {
    next.ap = Math.min(
      AP_MAX,
      next.ap + PERFECT_PASS_AP_REFUND,
    )
  }
  return {
    state: next,
    events: [...events, { type: 'PHASE', phase: 'SET' }],
  }
}

export const reduce = (
  state: GameState,
  command: Command,
): { state: GameState; events: EngineEvent[] } => {
  switch (command.type) {
    case 'SERVE': {
      assert(state.phase === 'SERVE', 'No es la fase de saque.')
      assert(
        command.target.side === otherSide(state.server),
        'El saque debe ir al campo rival.',
      )
      const next = clone(state)
      next.ball = {
        cell: { ...command.target },
        pressure: 'serve',
        quality: 0,
        lastTouchId: null,
      }
      next.possession = otherSide(state.server)
      next.ap = AP_PER_POSSESSION
      next.passQuality = 0
      next.setQuality = 0
      next.attackerId = null
      next.hiddenChoice = null
      next.touches = 0
      next.rallyAttacks = 0
      next.phase = 'RECEIVE'
      addLog(
        next,
        `${sideName(state.server)} saca a la ${zoneLabel(command.target)}.`,
      )
      return {
        state: next,
        events: [
          { type: 'SERVE', server: state.server, target: { ...command.target } },
          { type: 'PHASE', phase: 'RECEIVE' },
        ],
      }
    }

    case 'RECEIVE': {
      assert(state.phase === 'RECEIVE', 'No es la fase de recepción.')
      const side = state.possession
      const next = clone(state)
      if (command.playerId === null) {
        addLog(next, 'Nadie llega al saque. ¡Ace!', 'bad')
        const events: EngineEvent[] = [
          {
            type: 'RECEIVE',
            playerId: null,
            value: 0,
            quality: 0,
            outcome: 'ace',
            seam: false,
          },
        ]
        return {
          state: next,
          events: [...events, ...awardPoint(next, otherSide(side), 'ace')],
        }
      }

      const receiver = playerById(state, command.playerId)
      assert(receiver, 'Jugador inexistente.')
      assert(receiver.side === side, 'El receptor debe ser del equipo en posesión.')
      assert(reaches(receiver.cell, state.ball.cell), 'El receptor no llega.')

      const teammates = playersOf(state, side)
      const seam = (() => {
        const occupied = teammates.some((p) => sameCell(p.cell, state.ball.cell))
        if (occupied) return false
        return (
          teammates.filter((p) => reaches(p.cell, state.ball.cell)).length >= 2
        )
      })()

      const value = receptionValue(
        receiver,
        state.ball.cell,
        PRESSURE_VALUE[state.ball.pressure],
        seam,
      )
      const quality = receptionQuality(value)

      if (quality === 0) {
        addLog(
          next,
          `${receiver.name} no puede controlar el saque. Punto rival.`,
          'bad',
        )
        const events: EngineEvent[] = [
          {
            type: 'RECEIVE',
            playerId: receiver.id,
            value,
            quality,
            outcome: 'error',
            seam,
          },
        ]
        return {
          state: next,
          events: [...events, ...awardPoint(next, otherSide(side), 'error')],
        }
      }

      const refund = quality === 3 ? PERFECT_PASS_AP_REFUND : 0
      next.ap = Math.min(AP_MAX, next.ap + refund)
      next.ball = {
        cell: { ...receiver.cell },
        pressure: 'free',
        quality,
        lastTouchId: receiver.id,
      }
      next.passQuality = quality
      next.touches = 1
      next.hiddenChoice = null
      next.phase = 'SET'
      addLog(
        next,
        `${receiver.name} recibe: pase ${qualityText(quality)}${refund ? ' (+1 energía)' : ''}.`,
        quality === 3 ? 'good' : 'neutral',
      )
      return {
        state: next,
        events: [
          {
            type: 'RECEIVE',
            playerId: receiver.id,
            value,
            quality,
            outcome: 'ok',
            seam,
          },
          { type: 'PHASE', phase: 'SET' },
        ],
      }
    }

    case 'SET': {
      assert(state.phase === 'SET', 'No es la fase de armado.')
      const side = state.possession
      const setter = playerById(state, command.setterId)
      const target = playerById(state, command.targetId)
      assert(setter && target, 'Jugador inexistente.')
      assert(
        setter.side === side && target.side === side,
        'El armado es entre jugadores del mismo equipo.',
      )
      assert(
        setter.id !== state.ball.lastTouchId,
        'Nadie puede tocar dos veces seguidas.',
      )
      assert(setter.id !== target.id, 'El armador no puede armarse a sí mismo.')
      assert(target.classId !== 'libero', 'El líbero no puede atacar.')
      assert(
        attackKindsFor(target).length > 0,
        'Ese atacante no tiene un ataque legal desde su posición.',
      )

      const distance = moveDistance(setter.cell, state.ball.cell)
      const quality = setQuality(state.passQuality, setter, distance)
      const next = clone(state)

      if (quality === 0) {
        addLog(next, `El armado de ${setter.name} se queda corto.`, 'bad')
        const events: EngineEvent[] = [
          {
            type: 'SET',
            setterId: setter.id,
            targetId: target.id,
            quality,
            outcome: 'error',
          },
        ]
        return {
          state: next,
          events: [...events, ...awardPoint(next, otherSide(side), 'error')],
        }
      }

      next.ball = {
        cell: { ...target.cell },
        pressure: 'free',
        quality,
        lastTouchId: setter.id,
      }
      next.setQuality = quality
      next.attackerId = target.id
      next.touches = 2
      next.hiddenChoice = null
      next.phase = side === state.playerSide ? 'ATTACK' : 'DEFEND'
      addLog(
        next,
        `${setter.name} arma ${qualityText(quality)} para ${target.name}.`,
        quality === 3 ? 'good' : 'neutral',
      )
      return {
        state: next,
        events: [
          {
            type: 'SET',
            setterId: setter.id,
            targetId: target.id,
            quality,
            outcome: 'ok',
          },
          { type: 'PHASE', phase: next.phase },
        ],
      }
    }

    case 'ATTACK': {
      assert(state.phase === 'ATTACK', 'No es la fase de ataque.')
      const hidden = state.hiddenChoice
      assert(
        hidden?.type === 'defense',
        'La defensa rival todavía no se comprometió.',
      )
      const side = state.possession
      const attacker = playerById(state, command.playerId)
      assert(attacker, 'Jugador inexistente.')
      assert(attacker.id === state.attackerId, 'Ese jugador no recibió el armado.')
      assert(attacker.side === side, 'El atacante debe ser del equipo en posesión.')

      const check = isAttackAllowed({
        attacker,
        kind: command.kind,
        target: command.target,
      })
      if (!check.ok) throw new EngineError(check.reason)

      const cost = ATTACK_AP_COST[command.kind]
      assert(state.ap >= cost, 'No hay energía para ese ataque.')
      if (state.rallyAttacks >= MAX_RALLY_ATTACKS) {
        return capRally(state, attacker)
      }

      return applyDuel(
        state,
        attacker,
        command.kind,
        command.target,
        hidden.scheme,
        cost,
      )
    }

    case 'DEFEND': {
      assert(state.phase === 'DEFEND', 'No es la fase defensiva.')
      const hidden = state.hiddenChoice
      assert(
        hidden?.type === 'attack',
        'El ataque rival todavía no se comprometió.',
      )
      const attacker = playerById(state, state.attackerId)
      assert(attacker, 'El atacante rival no existe.')
      assert(
        attacker.side === state.possession,
        'El atacante debe ser del equipo en posesión.',
      )
      const plan = hidden.plan
      const check = isAttackAllowed({
        attacker,
        kind: plan.kind,
        target: plan.target,
      })
      if (!check.ok) throw new EngineError(check.reason)
      if (state.rallyAttacks >= MAX_RALLY_ATTACKS) {
        return capRally(state, attacker)
      }

      return applyDuel(
        state,
        attacker,
        plan.kind,
        plan.target,
        command.scheme,
        0,
      )
    }

    default: {
      const exhaustive: never = command
      throw new EngineError(`Comando desconocido: ${String(exhaustive)}`)
    }
  }
}

export const legalReceivers = (state: GameState): Player[] =>
  playersOf(state, state.possession).filter((player) =>
    reaches(player.cell, state.ball.cell),
  )
