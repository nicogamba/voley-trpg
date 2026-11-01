import { describe, expect, it } from 'vitest'
import { DEMO_PLAYERS, DEMO_TEAMS } from '../src/court/demo'
import { cell } from '../src/court/geometry'
import type { MatchEvent, MatchState } from '../src/court/match'
import { createMatch, serve } from '../src/court/matchEngine'
import { mulberry32 } from '../src/court/matchAi'
import { sceneScript } from '../src/presentation/sceneScript'

const create = (startScore?: Record<'home' | 'away', number>) =>
  createMatch({
    roster: DEMO_PLAYERS,
    playerSide: 'home',
    server: 'home',
    targetScore: 25,
    startScore,
  })

describe('guion de escenas CT1', () => {
  it('arranca con el marcador inicial y lo conserva en el estado', () => {
    const state = create({ home: 17, away: 19 })
    expect(state.score).toEqual({ home: 17, away: 19 })
    expect(state.targetScore).toBe(25)
  })

  it('convierte un saque ace en acción y resultado, sin spoilear el primer cuadro', () => {
    const pre = create({ home: 24, away: 24 })
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: 'home-opposite',
        target: cell('away', 0, 0),
        receiverId: null,
        quality: null,
        outcome: 'ace',
      },
      {
        type: 'POINT',
        side: 'home',
        reason: 'ace',
        score: { home: 25, away: 24 },
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS)
    expect(scenes).toHaveLength(2)
    expect(scenes[0].frame.mode).toBe('closeup')
    expect(scenes[0].frame.banner).toBe('SAQUE')
    expect(scenes[0].frame.shot).toBe('serve')
    expect(scenes[0].line.text).not.toContain('ACE')
    expect(scenes[1].frame.stamp).toBe('¡ACE!')
    expect(scenes[1].score).toEqual({ home: 25, away: 24 })
    expect(scenes[1].line.text).toContain('ACE')
  })

  it('muestra el duelo, el dig y el armado como tres cuadros', () => {
    const pre = create()
    const events: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: 'away-opposite',
        kind: 'power',
        target: cell('home', 2, 0),
        resolution: {
          A: 6,
          D: 4,
          edge: 2,
          zone: 2,
          outcome: 'dig',
          digQuality: 2,
          defenderId: 'home-libero',
          blockerIds: [],
          scheme: 'spread',
        },
      },
      {
        type: 'DIG',
        defenderId: 'home-libero',
        from: cell('home', 2, 1),
        to: cell('home', 0, 1),
        quality: 2,
      },
      {
        type: 'SET',
        setterId: 'home-setter',
        quality: 2,
        to: cell('home', 0, 1),
        outcome: 'ok',
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS, {
      meta: { defenseScheme: 'wall' },
    })
    expect(scenes.map((scene) => scene.frame.mode)).toEqual([
      'duel',
      'closeup',
      'closeup',
    ])
    expect(scenes[0].frame.banner).toBe('MURO vs POTENCIA')
    expect(scenes[0].frame.shot).toBe('duel')
    expect(scenes[1].frame.banner).toBe('¡DIG!')
    expect(scenes[1].frame.shot).toBe('dig')
    expect(scenes[1].line.text).toContain('SOSA')
    expect(scenes[2].frame.banner).toBe('ARMADO')
    expect(scenes[2].frame.shot).toBe('set')
  })

  it('muestra el bloqueo con el bloqueador como protagonista', () => {
    const pre = create()
    const events: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: 'home-opposite',
        kind: 'power',
        target: cell('away', 2, 0),
        resolution: {
          A: 4,
          D: 7,
          edge: -3,
          zone: 2,
          outcome: 'blocked',
          digQuality: null,
          defenderId: 'away-middle',
          blockerIds: ['away-middle'],
          scheme: 'wall',
        },
      },
      {
        type: 'POINT',
        side: 'away',
        reason: 'block',
        score: { home: 0, away: 1 },
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS)
    expect(scenes[1].frame.stamp).toBe('¡BLOQUEO!')
    expect(scenes[1].frame.actorId).toBe('away-middle')
    expect(scenes[1].frame.shot).toBe('block')
    expect(scenes[1].score).toEqual({ home: 0, away: 1 })
  })

  it('usa el plano de punto y el de cierre según el ganador', () => {
    const pre = create()
    const pointEvents: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: 'home-opposite',
        kind: 'power',
        target: cell('away', 2, 0),
        resolution: {
          A: 7,
          D: 4,
          edge: 3,
          zone: 2,
          outcome: 'point',
          digQuality: null,
          defenderId: 'away-middle',
          blockerIds: [],
          scheme: 'wall',
        },
      },
      {
        type: 'POINT',
        side: 'home',
        reason: 'attack',
        score: { home: 1, away: 0 },
      },
    ]
    const pointScenes = sceneScript(pre, pointEvents, pre, DEMO_TEAMS)
    expect(pointScenes[1].frame.shot).toBe('point')

    const endHome: MatchEvent[] = [
      { type: 'MATCH_END', winner: 'home', score: { home: 25, away: 20 } },
    ]
    expect(sceneScript(pre, endHome, pre, DEMO_TEAMS)[0].frame.shot).toBe(
      'celebrate',
    )

    const endAway: MatchEvent[] = [
      { type: 'MATCH_END', winner: 'away', score: { home: 20, away: 25 } },
    ]
    expect(sceneScript(pre, endAway, pre, DEMO_TEAMS)[0].frame.shot).toBe(
      'defeat',
    )
  })

  it('muestra la free ball y la recepción cómoda del rival', () => {
    const pre = create()
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: 'home-opposite',
        target: cell('away', 2, 0),
        receiverId: 'away-opposite',
        quality: 1,
        outcome: 'ok',
        zone: 1,
      },
      {
        type: 'RECEIVE',
        playerId: 'away-opposite',
        from: cell('away', 2, 0),
        to: cell('home', 2, 1),
        quality: 1,
        freeBall: true,
      },
      { type: 'FREE_BALL', fromSide: 'away', toSide: 'home' },
      {
        type: 'RECEIVE',
        playerId: 'home-libero',
        from: cell('home', 2, 1),
        to: cell('home', 0, 1),
        quality: 3,
      },
      {
        type: 'SET',
        setterId: 'home-setter',
        quality: 3,
        to: cell('home', 0, 1),
        outcome: 'ok',
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS)
    expect(scenes[0].frame.banner).toBe('SAQUE ZONA 1')
    expect(scenes[0].line.text).toContain('zona 1')
    expect(scenes[1].frame.shot).toBe('receiveAlt')
    expect(scenes[2].frame.shot).toBe('freeBall')
    expect(scenes[2].frame.banner).toBe('¡FREE BALL!')
    expect(scenes[3].frame.shot).toBe('receive')
    expect(scenes[3].line.text).toContain('Pase perfecto')
    expect(scenes[4].frame.shot).toBe('set')
  })

  it('usa los planos de dig y compañero en la recepción', () => {
    const pre = create()
    const digEvents: MatchEvent[] = [
      {
        type: 'RECEIVE',
        playerId: 'home-libero',
        from: cell('home', 2, 1),
        to: cell('home', 0, 1),
        quality: 2,
        dig: true,
      },
    ]
    const digScenes = sceneScript(pre, digEvents, pre, DEMO_TEAMS)
    expect(digScenes[0].frame.shot).toBe('dig')
    expect(digScenes[0].frame.banner).toBe('¡DIG!')

    const mateEvents: MatchEvent[] = [
      {
        type: 'RECEIVE',
        playerId: 'away-opposite',
        from: cell('away', 2, 0),
        to: cell('away', 1, 1),
        quality: 1,
        teammate: true,
      },
    ]
    const mateScenes = sceneScript(pre, mateEvents, pre, DEMO_TEAMS)
    expect(mateScenes[0].frame.shot).toBe('receiveAlt')
    expect(mateScenes[0].line.text).toContain('compañero')
  })

  it('muestra el ataque afuera y el punto', () => {
    const pre = create()
    const events: MatchEvent[] = [
      {
        type: 'ATTACK',
        attackerId: 'home-opposite',
        kind: 'power',
        target: cell('away', 2, 0),
        resolution: {
          A: 0,
          D: 0,
          edge: 0,
          zone: 0,
          outcome: 'fault',
          fault: 'out',
          digQuality: null,
          defenderId: 'away-middle',
          blockerIds: [],
          scheme: 'wall',
        },
      },
      {
        type: 'POINT',
        side: 'away',
        reason: 'error',
        score: { home: 0, away: 1 },
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS)
    expect(scenes[0].frame.shot).toBe('duel')
    expect(scenes[1].frame.shot).toBe('error')
    expect(scenes[1].frame.stamp).toBe('¡ERROR!')
  })

  it('muestra el error de red y el punto del rival', () => {
    const pre = create()
    const events: MatchEvent[] = [
      {
        type: 'SERVE',
        serverId: 'home-opposite',
        target: cell('away', 0, 1),
        receiverId: null,
        quality: null,
        outcome: 'net',
        zone: 'short',
      },
      {
        type: 'POINT',
        side: 'away',
        reason: 'error',
        score: { home: 0, away: 1 },
      },
    ]
    const scenes = sceneScript(pre, events, pre, DEMO_TEAMS)
    expect(scenes[0].frame.banner).toBe('SAQUE CORTO')
    expect(scenes[0].line.text).toContain('red')
    expect(scenes[1].frame.shot).toBe('errorNet')
    expect(scenes[1].frame.stamp).toBe('¡ERROR!')
    expect(scenes[1].score).toEqual({ home: 0, away: 1 })
  })

  it('produce escenas con id y relato para un evento real del motor', () => {
    const pre: MatchState = create()
    const result = serve(pre, cell('away', 0, 0), mulberry32(3))
    const scenes = sceneScript(pre, result.events, result.state, DEMO_TEAMS)
    expect(scenes.length).toBeGreaterThan(0)
    for (const scene of scenes) {
      expect(scene.id.length).toBeGreaterThan(0)
      expect(scene.line.text.length).toBeGreaterThan(0)
      expect(scene.frame.mode).not.toBe('field')
    }
  })
})
