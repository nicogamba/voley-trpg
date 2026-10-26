import { describe, expect, it } from 'vitest'
import {
  EngineError,
  reduce,
} from '../src/engine/commands'
import {
  cell,
  createMatch,
  legalReceivers,
  mulberry32,
  withHiddenChoice,
} from '../src/engine'
import type {
  AttackKind,
  Cell,
  Command,
  DefenseScheme,
  GameState,
  Quality,
} from '../src/engine'

const run = (state: GameState, command: Command): GameState =>
  reduce(state, command).state

const start = (server: 'home' | 'away' = 'home', targetScore = 7) =>
  createMatch({ server, playerSide: 'home', targetScore })

const withScheme = (state: GameState, scheme: DefenseScheme): GameState => ({
  ...state,
  hiddenChoice: { type: 'defense', side: 'away', scheme },
})

const toHomeAttack = (
  targetScore = 7,
  setQualityOverride?: Quality,
): GameState => {
  let state = start('away', targetScore)
  state = run(state, { type: 'SERVE', target: cell('home', 1, 1) })
  state = run(state, { type: 'RECEIVE', playerId: 'home-libero' })
  state = run(state, {
    type: 'SET',
    setterId: 'home-setter',
    targetId: 'home-middle',
  })
  state = withHiddenChoice(state, mulberry32(1))
  if (setQualityOverride !== undefined) {
    state = { ...state, setQuality: setQualityOverride }
  }
  return state
}

const toHomePipeAttack = (): GameState => {
  let state = start('away')
  state = run(state, { type: 'SERVE', target: cell('home', 1, 1) })
  state = run(state, { type: 'RECEIVE', playerId: 'home-libero' })
  state = run(state, {
    type: 'SET',
    setterId: 'home-setter',
    targetId: 'home-opposite',
  })
  return withHiddenChoice(state, mulberry32(2))
}

const toHomeDefense = (planKind: AttackKind, target: Cell): GameState => {
  let state = start('home')
  state = run(state, { type: 'SERVE', target: cell('away', 1, 1) })
  state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
  state = run(state, {
    type: 'SET',
    setterId: 'away-setter',
    targetId: 'away-middle',
  })
  return {
    ...state,
    hiddenChoice: {
      type: 'attack',
      side: 'away',
      plan: { kind: planKind, target },
    },
  }
}

const attackEvent = (events: ReturnType<typeof reduce>['events']) => {
  const event = events.find((item) => item.type === 'ATTACK')
  expect(event).toBeDefined()
  if (event?.type !== 'ATTACK') throw new Error('Sin evento de ataque')
  return event
}

describe('estado inicial', () => {
  it('arranca con cuatro jugadores por lado y saque local', () => {
    const state = start()
    expect(state.phase).toBe('SERVE')
    expect(state.server).toBe('home')
    expect(state.playerSide).toBe('home')
    expect(state.players).toHaveLength(8)
    expect(state.score).toEqual({ home: 0, away: 0 })
    expect(state.ap).toBe(0)
    expect(state.hiddenChoice).toBeNull()
  })
})

describe('flujo de una posesión', () => {
  it('recorre saque → recepción → armado → ataque oculto', () => {
    let state = start('away')
    state = run(state, { type: 'SERVE', target: cell('home', 1, 1) })
    expect(state.phase).toBe('RECEIVE')
    expect(state.possession).toBe('home')
    expect(state.ap).toBe(2)

    state = run(state, { type: 'RECEIVE', playerId: 'home-libero' })
    expect(state.phase).toBe('SET')
    expect(state.passQuality).toBe(3)
    expect(state.ap).toBe(3)
    expect(state.ball.lastTouchId).toBe('home-libero')

    state = run(state, {
      type: 'SET',
      setterId: 'home-setter',
      targetId: 'home-middle',
    })
    expect(state.phase).toBe('ATTACK')
    expect(state.attackerId).toBe('home-middle')
    expect(state.setQuality).toBe(3)
    expect(state.ap).toBe(3)

    state = withHiddenChoice(state, mulberry32(1))
    expect(state.hiddenChoice?.type).toBe('defense')
    if (state.hiddenChoice?.type === 'defense') {
      expect(state.hiddenChoice.side).toBe('away')
    }
  })

  it('el saque debe ir al campo rival', () => {
    expect(() =>
      run(start(), { type: 'SERVE', target: cell('home', 0, 0) }),
    ).toThrow(EngineError)
  })

  it('lista los receptores legales después del saque', () => {
    let state = start('away')
    state = run(state, { type: 'SERVE', target: cell('home', 1, 1) })
    expect(legalReceivers(state).map((player) => player.id)).toEqual([
      'home-setter',
      'home-opposite',
      'home-libero',
    ])
  })
})

describe('errores de recepción y armado', () => {
  it('dejar pasar el saque da ace al sacador', () => {
    let state = start('home')
    state = run(state, { type: 'SERVE', target: cell('away', 1, 1) })
    const result = reduce(state, { type: 'RECEIVE', playerId: null })
    expect(result.state.score.home).toBe(1)
    expect(result.state.phase).toBe('SERVE')
    const event = result.events.find((item) => item.type === 'RECEIVE')
    expect(event).toBeDefined()
    if (event?.type !== 'RECEIVE') throw new Error('Sin recepción')
    expect(event.outcome).toBe('ace')
  })

  it('una recepción en costura puede ser error y punto rival', () => {
    let state = start('home')
    state = run(state, { type: 'SERVE', target: cell('away', 0, 0) })
    const result = reduce(state, {
      type: 'RECEIVE',
      playerId: 'away-opposite',
    })
    expect(result.state.score.home).toBe(1)
    const event = result.events.find((item) => item.type === 'RECEIVE')
    expect(event).toBeDefined()
    if (event?.type !== 'RECEIVE') throw new Error('Sin recepción')
    expect(event.outcome).toBe('error')
    expect(event.quality).toBe(0)
  })

  it('si el armador recibe, el líbero arma de emergencia', () => {
    let state = start('away')
    state = run(state, { type: 'SERVE', target: cell('home', 0, 2) })
    state = run(state, { type: 'RECEIVE', playerId: 'home-setter' })
    expect(state.phase).toBe('SET')
    expect(state.passQuality).toBe(1)
    const result = reduce(state, {
      type: 'SET',
      setterId: 'home-libero',
      targetId: 'home-middle',
    })
    expect(result.state.phase).toBe('ATTACK')
    expect(result.state.setQuality).toBe(1)
    expect(result.state.score).toEqual({ home: 0, away: 0 })
    const event = result.events.find((item) => item.type === 'SET')
    expect(event).toBeDefined()
    if (event?.type !== 'SET') throw new Error('Sin armado')
    expect(event.setterId).toBe('home-libero')
    expect(event.outcome).toBe('ok')
  })
})

describe('ataque y defensa oculta', () => {
  it('exige que la defensa rival se haya comprometido', () => {
    const state = toHomeAttack()
    expect(() =>
      reduce(
        { ...state, hiddenChoice: null },
        {
          type: 'ATTACK',
          playerId: 'home-middle',
          kind: 'power',
          target: cell('away', 0, 0),
        },
      ),
    ).toThrow('La defensa rival todavía no se comprometió.')
  })

  it('un ataque que gana el duelo da punto y reinicia el saque', () => {
    const state = withScheme(toHomeAttack(), 'spread')
    const result = reduce(state, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 0),
    })
    const event = attackEvent(result.events)
    expect(event.resolution.outcome).toBe('point')
    expect(result.state.score.home).toBe(1)
    expect(result.state.phase).toBe('SERVE')
    expect(result.state.server).toBe('home')
    expect(result.state.attackHistory).toHaveLength(1)
    expect(result.state.defenseHistory[0].scheme).toBe('spread')
  })

  it('un ataque contra el muro puede terminar en bloqueo y punto rival', () => {
    const state = withScheme(toHomeAttack(7, 1), 'wall')
    const result = reduce(state, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 2),
    })
    const event = attackEvent(result.events)
    expect(event.resolution.outcome).toBe('blocked')
    expect(event.resolution.blockerIds.length).toBeGreaterThan(0)
    expect(result.state.score.away).toBe(1)
    expect(result.state.phase).toBe('SERVE')
    expect(result.state.server).toBe('away')
  })

  it('un dig mantiene el rally y pasa la posesión al defensor', () => {
    const state = withScheme(toHomeAttack(), 'wall')
    const result = reduce(state, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 0),
    })
    const event = attackEvent(result.events)
    expect(event.resolution.outcome).toBe('dig')
    expect(event.resolution.digQuality).toBe(1)
    expect(result.state.phase).toBe('SET')
    expect(result.state.possession).toBe('away')
    expect(result.state.ball.lastTouchId).toBe(event.resolution.defenderId)
    expect(result.state.ap).toBe(2)
    expect(result.state.score).toEqual({ home: 0, away: 0 })
  })

  it('después de un dig el rival puede armar y atacar', () => {
    const state = withScheme(toHomeAttack(), 'wall')
    let next = run(state, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 0),
    })
    expect(next.phase).toBe('SET')
    next = run(next, {
      type: 'SET',
      setterId: 'away-setter',
      targetId: 'away-opposite',
    })
    expect(next.phase).toBe('DEFEND')
    expect(next.attackerId).toBe('away-opposite')
  })

  it('el jugador defiende con un esquema contra un plan ya elegido', () => {
    const state = toHomeDefense('power', cell('home', 0, 0))
    expect(state.phase).toBe('DEFEND')
    const result = reduce(state, { type: 'DEFEND', scheme: 'wall' })
    const event = attackEvent(result.events)
    expect(event.playerId).toBe('away-middle')
    expect(event.kind).toBe('power')
    expect(event.resolution.outcome).toBe('blocked')
    expect(result.state.score.home).toBe(1)
    expect(result.state.phase).toBe('SERVE')
  })

  it('exige que el ataque rival se haya comprometido para defender', () => {
    const state = toHomeDefense('power', cell('home', 0, 0))
    expect(() =>
      reduce({ ...state, hiddenChoice: null }, { type: 'DEFEND', scheme: 'wall' }),
    ).toThrow('El ataque rival todavía no se comprometió.')
  })

  it('no permite atacar fuera del campo rival', () => {
    const state = withScheme(toHomeAttack(), 'spread')
    expect(() =>
      reduce(state, {
        type: 'ATTACK',
        playerId: 'home-middle',
        kind: 'power',
        target: cell('home', 0, 0),
      }),
    ).toThrow(EngineError)
  })
})

describe('energía', () => {
  it('el pipe cuesta 3 y falla con 2 de energía', () => {
    const state = toHomePipeAttack()
    expect(state.phase).toBe('ATTACK')
    expect(state.ap).toBe(3)
    const withSpread = withScheme(state, 'spread')
    expect(() =>
      reduce(withSpread, {
        type: 'ATTACK',
        playerId: 'home-opposite',
        kind: 'pipe',
        target: cell('away', 0, 0),
      }),
    ).not.toThrow()

    expect(() =>
      reduce(
        { ...withSpread, ap: 2 },
        {
          type: 'ATTACK',
          playerId: 'home-opposite',
          kind: 'pipe',
          target: cell('away', 0, 0),
        },
      ),
    ).toThrow('No hay energía para ese ataque.')
  })

  it('colocación, rápido y finta son gratis', () => {
    const state = withScheme(toHomeAttack(), 'spread')
    expect(() =>
      reduce(
        { ...state, ap: 0 },
        {
          type: 'ATTACK',
          playerId: 'home-middle',
          kind: 'placement',
          target: cell('away', 0, 1),
        },
      ),
    ).not.toThrow()
  })
})

describe('fin del set', () => {
  it('el punto 7 cierra el partido y marca ganador', () => {
    const state = withScheme(toHomeAttack(1), 'spread')
    const result = reduce(state, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 0),
    })
    expect(result.state.phase).toBe('MATCH_END')
    expect(result.state.winner).toBe('home')
    expect(result.state.score.home).toBe(1)
    expect(result.events.some((event) => event.type === 'MATCH_END')).toBe(true)
  })
})
