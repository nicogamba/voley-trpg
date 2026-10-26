import { describe, expect, it } from 'vitest'
import { EngineError, reduce } from '../src/engine/commands'
import { cell } from '../src/engine/geometry'
import { createMatch } from '../src/engine/state'
import type { Command, GameState } from '../src/engine/types'

const run = (state: GameState, command: Command): GameState => {
  return reduce(state, command).state
}

const start = (): GameState => createMatch({ server: 'home' })

const serveTo = (state: GameState, target: ReturnType<typeof cell>): GameState =>
  run(state, { type: 'SERVE', target })

describe('estado inicial', () => {
  it('arranca con cuatro jugadores por lado y saque local', () => {
    const state = start()
    expect(state.phase).toBe('SERVE')
    expect(state.server).toBe('home')
    expect(state.players).toHaveLength(8)
    expect(state.score).toEqual({ home: 0, away: 0 })
  })

  it('la formación local usa las seis zonas esperadas', () => {
    const state = start()
    const home = state.players.filter((p) => p.side === 'home')
    expect(home.find((p) => p.classId === 'setter')!.cell).toEqual(
      cell('home', 0, 1),
    )
    expect(home.find((p) => p.classId === 'middle')!.cell).toEqual(
      cell('home', 0, 0),
    )
    expect(home.find((p) => p.classId === 'opposite')!.cell).toEqual(
      cell('home', 1, 2),
    )
    expect(home.find((p) => p.classId === 'libero')!.cell).toEqual(
      cell('home', 1, 1),
    )
  })
})

describe('saque y recepción', () => {
  it('el saque pasa la pelota al rival y abre la recepción', () => {
    const state = serveTo(start(), cell('away', 1, 1))
    expect(state.phase).toBe('RECEIVE')
    expect(state.possession).toBe('away')
    expect(state.ap).toBe(3)
    expect(state.ball.cell).toEqual(cell('away', 1, 1))
    expect(state.ball.pressure).toBe('serve')
  })

  it('el líbero en su celda recibe perfecto y el AP queda tope 3', () => {
    const state = run(serveTo(start(), cell('away', 1, 1)), {
      type: 'RECEIVE',
      playerId: 'away-libero',
    })
    expect(state.phase).toBe('SET')
    expect(state.passQuality).toBe(3)
    expect(state.ap).toBe(3)
    expect(state.ball.lastTouchId).toBe('away-libero')
  })

  it('un movimiento gasta AP y el pase perfecto lo devuelve', () => {
    let state = serveTo(start(), cell('away', 1, 2))
    state = run(state, {
      type: 'MOVE',
      playerId: 'away-libero',
      to: cell('away', 1, 2),
    })
    expect(state.ap).toBe(2)
    state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
    expect(state.passQuality).toBe(3)
    expect(state.ap).toBe(3)
  })

  it('no se puede mover a una celda ocupada', () => {
    const state = serveTo(start(), cell('away', 1, 2))
    expect(() =>
      reduce(state, {
        type: 'MOVE',
        playerId: 'away-middle',
        to: cell('away', 0, 1),
      }),
    ).toThrow(EngineError)
  })
})

describe('armado', () => {
  const received = (): GameState =>
    run(serveTo(start(), cell('away', 1, 1)), {
      type: 'RECEIVE',
      playerId: 'away-libero',
    })

  it('el armador conserva la calidad y el rápido cuesta 1 AP', () => {
    const state = run(received(), {
      type: 'SET',
      setterId: 'away-setter',
      targetId: 'away-middle',
      tempo: 'quick',
    })
    expect(state.phase).toBe('BLOCK_COMMIT')
    expect(state.setQuality).toBe(3)
    expect(state.ap).toBe(2)
    expect(state.tempo).toBe('quick')
    expect(state.attackerId).toBe('away-middle')
    expect(state.reactionAp).toBe(2)
  })

  it('el que recibió no puede armar el toque siguiente', () => {
    let state = serveTo(start(), cell('away', 0, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-setter' })
    expect(() =>
      reduce(state, {
        type: 'SET',
        setterId: 'away-setter',
        targetId: 'away-middle',
        tempo: 'high',
      }),
    ).toThrow(/dos veces/)
  })

  it('si el armador recibe, el armado alternativo se queda corto', () => {
    let state = serveTo(start(), cell('away', 0, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-setter' })
    state = run(state, {
      type: 'SET',
      setterId: 'away-libero',
      targetId: 'away-middle',
      tempo: 'high',
    })
    expect(state.phase).toBe('SERVE')
    expect(state.score.home).toBe(1)
  })

  it('no permite armar a un atacante sin ataque legal', () => {
    let state = serveTo(start(), cell('away', 1, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
    state = run(state, {
      type: 'MOVE',
      playerId: 'away-opposite',
      to: cell('away', 0, 0),
    })
    expect(() =>
      reduce(state, {
        type: 'SET',
        setterId: 'away-setter',
        targetId: 'away-opposite',
        tempo: 'high',
      }),
    ).toThrow(/ataque legal/)
  })

  it('el rápido solo puede ir al central', () => {
    const state = received()
    expect(() =>
      reduce(state, {
        type: 'SET',
        setterId: 'away-setter',
        targetId: 'away-opposite',
        tempo: 'quick',
      }),
    ).toThrow(/central/)
  })
})

describe('ataque, bloqueo y defensa', () => {
  const readyToAttack = (): GameState => {
    let state = serveTo(start(), cell('away', 1, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
    state = run(state, {
      type: 'SET',
      setterId: 'away-setter',
      targetId: 'away-middle',
      tempo: 'quick',
    })
    return run(state, { type: 'COMMIT_BLOCK' })
  }

  it('el rápido a la columna del central rival termina en bloqueo', () => {
    const state = run(readyToAttack(), {
      type: 'ATTACK',
      playerId: 'away-middle',
      kind: 'quick',
      target: cell('home', 1, 0),
    })
    expect(state.phase).toBe('SERVE')
    expect(state.score.home).toBe(1)
    expect(state.score.away).toBe(0)
    expect(state.server).toBe('home')
  })

  it('el rápido a la columna del armador pasa y el líbero defiende', () => {
    const state = run(readyToAttack(), {
      type: 'ATTACK',
      playerId: 'away-middle',
      kind: 'quick',
      target: cell('home', 1, 1),
    })
    expect(state.phase).toBe('SET')
    expect(state.possession).toBe('home')
    expect(state.passQuality).toBe(1)
    expect(state.ap).toBe(3)
    expect(state.score).toEqual({ home: 0, away: 0 })
    expect(state.ball.lastTouchId).toBe('home-libero')
  })

  it('tras el dig el otro equipo arma y ataca', () => {
    let state = run(readyToAttack(), {
      type: 'ATTACK',
      playerId: 'away-middle',
      kind: 'quick',
      target: cell('home', 1, 1),
    })
    state = run(state, {
      type: 'SET',
      setterId: 'home-setter',
      targetId: 'home-opposite',
      tempo: 'high',
    })
    expect(state.setQuality).toBe(1)
    state = run(state, {
      type: 'ATTACK',
      playerId: 'home-opposite',
      kind: 'tip',
      target: cell('away', 1, 1),
    })
    expect(state.phase).toBe('SET')
    expect(state.possession).toBe('away')
    expect(state.passQuality).toBe(3)
  })

  it('el atacante debe ser el que recibió el armado', () => {
    const state = readyToAttack()
    expect(() =>
      reduce(state, {
        type: 'ATTACK',
        playerId: 'away-opposite',
        kind: 'power',
        target: cell('home', 1, 1),
      }),
    ).toThrow(EngineError)
  })
})

describe('puntuación', () => {
  it('un bloqueo da el punto a la defensa', () => {
    let state = start()
    state = serveTo(state, cell('away', 1, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
    state = run(state, {
      type: 'SET',
      setterId: 'away-setter',
      targetId: 'away-middle',
      tempo: 'quick',
    })
    state = run(state, {
      type: 'ATTACK',
      playerId: 'away-middle',
      kind: 'quick',
      target: cell('home', 1, 0),
    })
    expect(state.score.home).toBe(1)
    expect(state.phase).toBe('SERVE')
    expect(state.rallyNumber).toBe(2)
  })

  it('el saque del ganador abre el rally siguiente', () => {
    let state = start()
    state = serveTo(state, cell('away', 1, 1))
    state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
    state = run(state, {
      type: 'SET',
      setterId: 'away-setter',
      targetId: 'away-middle',
      tempo: 'quick',
    })
    state = run(state, {
      type: 'ATTACK',
      playerId: 'away-middle',
      kind: 'quick',
      target: cell('home', 1, 0),
    })
    expect(state.server).toBe('home')
    expect(state.ball.cell.side).toBe('home')
  })
})
