import { describe, expect, it } from 'vitest'
import { DEMO_PLAYERS } from '../src/court/demo'
import { cell, cellsOfSide } from '../src/court/geometry'
import {
  MATCH_TARGET,
  attackOptions,
  isAttackAllowed,
  type MatchState,
} from '../src/court/match'
import {
  aiServe,
  attack,
  createMatch,
  defend,
  legalServeTargets,
  nextDecision,
  serve,
} from '../src/court/matchEngine'
import { matchBeats } from '../src/court/matchBeats'
import { DEMO_TEAMS } from '../src/court/demo'
import { mulberry32 } from '../src/court/matchAi'

const create = () =>
  createMatch({
    roster: DEMO_PLAYERS,
    playerSide: 'home',
    server: 'home',
    targetScore: MATCH_TARGET,
  })

describe('motor de partido v2', () => {
  it('arranca en saque con la pelota en el sacador', () => {
    const state = create()
    expect(state.phase).toBe('SERVE')
    expect(state.server).toBe('home')
    expect(nextDecision(state)).toBe('serve')
    expect(legalServeTargets(state).every((target) => target.side === 'away')).toBe(
      true,
    )
    expect(state.ball).toEqual(
      state.players.find((player) => player.id === 'home-opposite')!.cell,
    )
  })

  it('resuelve saque, recepción y armado y espera la defensa', () => {
    const state = create()
    const result = serve(state, cell('away', 1, 2), mulberry32(1))
    expect(result.events[0]?.type).toBe('SERVE')
    expect(result.state.possession).toBe('away')
    expect(result.state.phase).toBe('DEFEND')
    expect(result.state.hiddenAttack).not.toBeNull()
    expect(result.state.ap).toBeGreaterThanOrEqual(1)
    expect(
      result.events.some((event) => event.type === 'RECEIVE'),
    ).toBe(true)
    expect(result.events.some((event) => event.type === 'SET')).toBe(true)
    expect(nextDecision(result.state)).toBe('defend')
  })

  it('traduce el saque a beats con pelota, recepción y armado', () => {
    const pre = create()
    const result = serve(pre, cell('away', 1, 2), mulberry32(2))
    const beats = matchBeats(pre, result.events, result.state, DEMO_TEAMS)
    expect(beats.map((beat) => beat.kind)).toEqual(
      expect.arrayContaining(['serve', 'receive', 'set']),
    )
    expect(beats[0].ball?.kind).toBe('serve')
    expect(beats[0].caption).toContain('SAQUE')
  })

  it('permite atacar con un jugador legal y aplica el costo de energía', () => {
    const pre = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
    })
    const served = aiServe(pre, mulberry32(3))
    const state = served.state
    expect(state.phase).toBe('ATTACK')
    const options = attackOptions(state)
    expect(options.length).toBeGreaterThan(0)
    expect(state.hiddenScheme).not.toBeNull()

    const placement = options.find((option) => option.kind === 'placement')!
    const target = placement.targets[0]
    expect(
      isAttackAllowed({
        attacker: placement.attacker,
        kind: 'placement',
        target,
      }).ok,
    ).toBe(true)

    const result = attack(state, 'placement', target, mulberry32(4))
    expect(result.events[0].type).toBe('ATTACK')
    expect(result.state.attackHistory.length).toBe(1)
    expect(result.state.ap).toBeLessThanOrEqual(state.ap)
    expect(
      ['SERVE', 'DEFEND', 'ATTACK', 'END'].includes(result.state.phase),
    ).toBe(true)
  })

  it('deja atacar al jugador cuando la IA saca', () => {
    const pre = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
    })
    const served = aiServe(pre, mulberry32(5))
    expect(served.state.playerSide).toBe('home')
    expect(['ATTACK', 'DEFEND', 'SERVE', 'END']).toContain(served.state.phase)
    if (served.state.phase === 'ATTACK') {
      const options = attackOptions(served.state).filter(
        (option) => option.affordable,
      )
      const option = options[0]
      const result = attack(
        served.state,
        option.kind,
        option.targets[0],
        mulberry32(6),
      )
      expect(result.events[0].type).toBe('ATTACK')
    }
  })

  it('resuelve la defensa del jugador ante el ataque rival', () => {
    const pre = create()
    const served = serve(pre, cell('away', 1, 2), mulberry32(10))
    expect(served.state.phase).toBe('DEFEND')
    const result = defend(served.state, 'wall', mulberry32(11))
    expect(result.events[0].type).toBe('ATTACK')
    expect(result.state.defenseHistory.length).toBe(1)
    expect(
      ['SERVE', 'ATTACK', 'DEFEND', 'END'].includes(result.state.phase),
    ).toBe(true)
  })

  it('termina el set a 7 sin colgarse', () => {    let state: MatchState = create()
    const rng = mulberry32(42)
    let steps = 0
    while (state.phase !== 'END' && steps < 400) {
      steps += 1
      if (state.phase === 'SERVE') {
        const target = legalServeTargets(state)[
          Math.floor(rng() * legalServeTargets(state).length)
        ]
        state = serve(state, target, rng).state
        continue
      }
      if (state.phase === 'ATTACK') {
        const options = attackOptions(state).filter(
          (option) => option.affordable,
        )
        const option = options[Math.floor(rng() * options.length)]
        const target = option.targets[Math.floor(rng() * option.targets.length)]
        state = attack(state, option.kind, target, rng).state
        continue
      }
      if (state.phase === 'DEFEND') {
        const schemes = ['wall', 'spread', 'deep', 'libero'] as const
        state = defend(
          state,
          schemes[Math.floor(rng() * schemes.length)],
          rng,
        ).state
      }
    }
    expect(state.phase).toBe('END')
    expect(state.winner).not.toBeNull()
    expect(state.score[state.winner!]).toBeGreaterThanOrEqual(MATCH_TARGET)
    expect(steps).toBeLessThan(400)
  })

  it('mueve al receptor a la celda del saque cuando llega desde lejos', () => {
    const state = create()
    const target = cell('away', 0, 0)
    const result = serve(state, target, mulberry32(7))
    const receiver = result.state.players.find(
      (player) => player.side === 'away' && player.cell.row === 0 && player.cell.col === 0,
    )
    if (result.events[1]?.type === 'RECEIVE') {
      expect(receiver).toBeDefined()
    }
  })

  it('solo permite ataques legales en la grilla 4x3', () => {
    const state = create()
    const middle = state.players.find((player) => player.id === 'home-middle')!
    const opposite = state.players.find((player) => player.id === 'home-opposite')!
    const libero = state.players.find((player) => player.id === 'home-libero')!
    expect(
      isAttackAllowed({
        attacker: middle,
        kind: 'quick',
        target: cell('away', 1, 1),
      }).ok,
    ).toBe(true)
    expect(
      isAttackAllowed({
        attacker: middle,
        kind: 'quick',
        target: cell('away', 1, 0),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: opposite,
        kind: 'pipe',
        target: cell('away', 2, 2),
      }).ok,
    ).toBe(true)
    expect(
      isAttackAllowed({
        attacker: libero,
        kind: 'power',
        target: cell('away', 1, 1),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: { ...opposite, cell: cell('home', 0, 3) },
        kind: 'power',
        target: cell('away', 1, 1),
      }).ok,
    ).toBe(false)
    expect(cellsOfSide('away')).toHaveLength(12)
  })
})
