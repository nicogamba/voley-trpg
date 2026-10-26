import {
  moveDistance,
  otherSide,
  reaches,
  sameCell,
  sideName,
  cellsOfSide,
  zoneLabel,
} from './geometry'
import {
  AP_PER_POSSESSION,
  ATTACK_AP_COST,
  MAX_RALLY_ATTACKS,
  PERFECT_PASS_AP_REFUND,
  PRESSURE_VALUE,
  REACTION_AP,
  TEMPO_AP_COST,
  TEMPO_ATTACKS,
} from './rules'
import {
  bestDefenderFor,
  isAttackAllowed,
  evaluateAttack,
  receptionQuality,
  receptionValue,
  setQuality,
} from './resolve'
import {
  isOccupied,
  playerById,
  playersOf,
  resetForServe,
  startPossession,
} from './state'
import type {
  Cell,
  Command,
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
    side === 'home' ? 'good' : 'bad',
  )
  const events: EngineEvent[] = [
    { type: 'POINT', side, reason, score: { ...state.score } },
  ]
  if (state.score[side] >= state.targetScore) {
    state.phase = 'MATCH_END'
    state.winner = side
    addLog(state, `¡${sideName(side)} gana el set!`, side === 'home' ? 'good' : 'bad')
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

const movePlayer = (
  state: GameState,
  player: Player,
  to: Cell,
  cost: number,
): void => {
  state.ap = Math.max(0, state.ap - cost)
  const index = state.players.findIndex((p) => p.id === player.id)
  state.players[index] = {
    ...state.players[index],
    cell: { ...to },
  }
}

const validateReactionShift = (
  state: GameState,
  player: Player,
  to: Cell,
): void => {
  assert(
    state.phase === 'BLOCK_COMMIT',
    'La reacción solo ocurre antes del ataque.',
  )
  assert(
    player.side === otherSide(state.possession),
    'Solo reacciona el equipo defensor.',
  )
  assert(state.reactionAp >= 1, 'No quedan AP de reacción.')
  assert(to.side === player.side, 'No se puede cruzar la red.')
  assert(to.row === player.cell.row, 'La reacción se mueve dentro de la misma fila.')
  assert(!sameCell(player.cell, to), 'El jugador ya está en esa celda.')
  assert(moveDistance(player.cell, to) === 1, 'Cada movimiento cuesta 1 AP.')
  assert(!isOccupied(state, to, player.id), 'La celda está ocupada.')
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
      next.reactionAp = 0
      next.passQuality = 0
      next.setQuality = 0
      next.tempo = null
      next.attackerId = null
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

    case 'MOVE': {
      assert(
        state.phase === 'RECEIVE' || state.phase === 'SET',
        'No se puede mover en esta fase.',
      )
      const player = playerById(state, command.playerId)
      assert(player, 'Jugador inexistente.')
      assert(player.side === state.possession, 'Solo mueve el equipo en posesión.')
      assert(command.to.side === player.side, 'No se puede cruzar la red.')
      assert(!sameCell(player.cell, command.to), 'El jugador ya está ahí.')
      assert(
        moveDistance(player.cell, command.to) === 1,
        'Cada movimiento cuesta 1 AP y es de una celda.',
      )
      assert(!isOccupied(state, command.to, player.id), 'La celda está ocupada.')
      assert(state.ap >= 1, 'No quedan AP.')

      const next = clone(state)
      const from = { ...player.cell }
      movePlayer(next, player, command.to, 1)
      addLog(next, `${sideName(player.side)} mueve al ${player.name}.`)
      return {
        state: next,
        events: [
          {
            type: 'MOVE',
            playerId: player.id,
            from,
            to: { ...command.to },
            phase: state.phase,
          },
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

      const refund =
        quality === 3 ? PERFECT_PASS_AP_REFUND : 0
      next.ap = Math.min(AP_PER_POSSESSION, next.ap + refund)
      next.ball = {
        cell: { ...receiver.cell },
        pressure: 'free',
        quality,
        lastTouchId: receiver.id,
      }
      next.passQuality = quality
      next.touches = 1
      next.phase = 'SET'
      addLog(
        next,
        `${receiver.name} recibe: pase ${qualityText(quality)}${refund ? ' (+1 AP)' : ''}.`,
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

      const tempoCost = TEMPO_AP_COST[command.tempo]
      assert(state.ap >= tempoCost, 'No hay AP para ese tempo.')
      if (command.tempo === 'quick') {
        assert(target.classId === 'middle', 'El ataque rápido es para el central.')
      }
      if (command.tempo === 'back') {
        assert(target.classId === 'opposite', 'El pipe es para el opuesto.')
        assert(target.cell.row === 1, 'El opuesto debe atacar desde el fondo.')
      }

      const defendingTeam = playersOf(state, otherSide(side))
      const hasLegalAttack = cellsOfSide(otherSide(side)).some((cell) =>
        TEMPO_ATTACKS[command.tempo].some(
          (kind) =>
            isAttackAllowed({
              attacker: target,
              kind,
              tempo: command.tempo,
              target: cell,
              defending: defendingTeam,
            }).ok,
        ),
      )
      assert(
        hasLegalAttack,
        'Ese atacante no tiene un ataque legal desde su posición.',
      )

      const distance = moveDistance(setter.cell, state.ball.cell)
      const quality = setQuality(state.passQuality, setter, distance)
      const next = clone(state)
      next.ap -= tempoCost

      if (quality === 0) {
        addLog(next, `El armado de ${setter.name} se queda corto.`, 'bad')
        const events: EngineEvent[] = [
          {
            type: 'SET',
            setterId: setter.id,
            targetId: target.id,
            tempo: command.tempo,
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
      next.tempo = command.tempo
      next.attackerId = target.id
      next.touches = 2
      next.reactionAp = REACTION_AP
      next.phase = 'BLOCK_COMMIT'
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
            tempo: command.tempo,
            quality,
            outcome: 'ok',
          },
          { type: 'PHASE', phase: 'BLOCK_COMMIT' },
        ],
      }
    }

    case 'SHIFT': {
      const player = playerById(state, command.playerId)
      assert(player, 'Jugador inexistente.')
      validateReactionShift(state, player, command.to)
      const next = clone(state)
      next.reactionAp -= 1
      const from = { ...player.cell }
      const index = next.players.findIndex((p) => p.id === player.id)
      next.players[index] = { ...next.players[index], cell: { ...command.to } }
      addLog(next, `${sideName(player.side)} ajusta al ${player.name}.`)
      return {
        state: next,
        events: [
          {
            type: 'SHIFT',
            playerId: player.id,
            from,
            to: { ...command.to },
          },
        ],
      }
    }

    case 'COMMIT_BLOCK': {
      assert(state.phase === 'BLOCK_COMMIT', 'No es la fase de reacción.')
      const next = clone(state)
      next.phase = 'ATTACK'
      return {
        state: next,
        events: [{ type: 'PHASE', phase: 'ATTACK' }],
      }
    }

    case 'ATTACK': {
      assert(
        state.phase === 'ATTACK' || state.phase === 'BLOCK_COMMIT',
        'No es la fase de ataque.',
      )
      const side = state.possession
      const attacker = playerById(state, command.playerId)
      assert(attacker, 'Jugador inexistente.')
      assert(attacker.id === state.attackerId, 'Ese jugador no recibió el armado.')
      assert(attacker.side === side, 'El atacante debe ser del equipo en posesión.')
      assert(state.tempo, 'No hay tempo definido.')

      const defending = playersOf(state, otherSide(side))
      const check = isAttackAllowed({
        attacker,
        kind: command.kind,
        tempo: state.tempo,
        target: command.target,
        defending,
      })
      if (!check.ok) throw new EngineError(check.reason)

      const cost = ATTACK_AP_COST[command.kind]
      assert(state.ap >= cost, 'No hay AP para ese ataque.')

      if (state.rallyAttacks >= MAX_RALLY_ATTACKS) {
        const next = clone(state)
        addLog(next, 'El rally se estira demasiado: se cierra el punto.', 'neutral')
        return {
          state: next,
          events: awardPoint(next, otherSide(side), 'cap'),
        }
      }

      const resolution = evaluateAttack(
        attacker,
        state.setQuality,
        command.kind,
        command.target,
        defending,
      )
      const next = clone(state)
      next.ap -= cost
      next.touches = 3
      next.rallyAttacks += 1

      const events: EngineEvent[] = [
        {
          type: 'ATTACK',
          playerId: attacker.id,
          kind: command.kind,
          target: { ...command.target },
          resolution,
        },
      ]

      if (resolution.outcome === 'blocked') {
        addLog(
          next,
          `${attacker.name} ataca y el bloqueo la devuelve. Punto rival.`,
          'bad',
        )
        return {
          state: next,
          events: [...events, ...awardPoint(next, otherSide(side), 'block')],
        }
      }

      if (resolution.outcome === 'point') {
        addLog(
          next,
          `${attacker.name} ataca a la ${zoneLabel(command.target)}: ¡punto!`,
          'good',
        )
        return {
          state: next,
          events: [...events, ...awardPoint(next, side, 'attack')],
        }
      }

      const defender = playerById(next, resolution.defenderId)
      assert(defender, 'El dig no tiene defensor.')
      const digQuality = resolution.digQuality!
      addLog(
        next,
        `${defender.name} defiende: dig ${qualityText(digQuality)}.`,
        digQuality >= 2 ? 'good' : 'neutral',
      )
      startPossession(
        next,
        otherSide(side),
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
          AP_PER_POSSESSION,
          next.ap + PERFECT_PASS_AP_REFUND,
        )
      }
      return {
        state: next,
        events: [...events, { type: 'PHASE', phase: 'SET' }],
      }
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

export const defendReach = (
  state: GameState,
  target: Cell,
): { player: Player | null; value: number } =>
  bestDefenderFor(playersOf(state, otherSide(state.possession)), target, false)
