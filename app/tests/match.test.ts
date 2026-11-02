import { describe, expect, it } from 'vitest'
import { DEMO_PLAYERS } from '../src/court/demo'
import { cell, cellsOfSide } from '../src/court/geometry'
import {
  MATCH_TARGET,
  attackCandidates,
  attackFault,
  attackFaultChance,
  attackOptions,
  attackTargetFor,
  attackZoneForCell,
  defenseCandidates,
  isAttackAllowed,
  pickAttackerFor,
  receptionSaveChance,
  serveFault,
  serveFaultChance,
  serveTargetForZone,
  serveZoneRisk,
  type MatchState,
} from '../src/court/match'
import {
  aiServe,
  attack,
  createMatch,
  defend,
  legalServeTargets,
  nextDecision,
  rotateSide,
  serve,
  serveAuto,
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

/** Deja al receptor como única opción real para probar una rama puntual. */
const isolateReceiver = (state: MatchState, receiverId: string): void => {
  for (const player of state.players) {
    if (player.side !== 'away' || player.id === receiverId) continue
    if (player.classId === 'setter') {
      player.cell = cell('away', 0, 3)
      continue
    }
    player.stats = { ...player.stats, tecnica: -10 }
  }
}

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

  it('permite elegir el receptor cuando la IA saca', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
    })
    const chosen = state.players.find(
      (player) => player.id === 'home-setter',
    )!
    const target = cell('home', 1, 2)
    chosen.cell = { ...target }
    const result = serve(state, target, mulberry32(7), {
      receiverId: chosen.id,
    })
    const event = result.events.find((entry) => entry.type === 'SERVE')
    expect(event?.type).toBe('SERVE')
    if (event?.type === 'SERVE') {
      expect(event.receiverId).toBe(chosen.id)
    }
  })

  it('elige un destino automático para el saque por tipo', () => {
    const result = serveAuto(create(), 'power', mulberry32(13))
    const event = result.events.find((entry) => entry.type === 'SERVE')
    expect(event?.type).toBe('SERVE')
    if (event?.type === 'SERVE') {
      expect(event.target.side).toBe('away')
    }
  })

  it('elige un destino automático y legal para el ataque', () => {
    const state = create()
    state.phase = 'ATTACK'
    state.possession = 'home'
    state.setQuality = 2
    state.hiddenScheme = 'spread'
    const target = attackTargetFor(state, 'placement')
    expect(target.side).toBe('away')
    expect(
      attackCandidates(state, 'placement', target).length,
    ).toBeGreaterThan(0)
  })

  it('permite atacar con un jugador legal y aplica el costo de energía', () => {
    const pre = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
    })
    const served = serve(pre, cell('home', 1, 2), mulberry32(3))
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

  it('permite elegir atacante y técnica, y cobra la energía', () => {
    const state = create()
    state.phase = 'ATTACK'
    state.possession = 'home'
    state.ap = 3
    state.hiddenScheme = 'spread'
    state.setQuality = 2
    const target = cell('away', 1, 2)
    const candidates = attackCandidates(state, 'power', target)
    const attacker = candidates.find((player) => player.classId === 'opposite')
    expect(attacker).toBeTruthy()

    const normal = attack(state, 'power', target, mulberry32(9), {
      attackerId: attacker!.id,
    })
    const special = attack(state, 'power', target, mulberry32(9), {
      attackerId: attacker!.id,
      technique: 'cometa',
    })
    expect(special.events[0]?.type).toBe('ATTACK')
    const normalEvent = normal.events[0]
    const specialEvent = special.events[0]
    expect(normalEvent?.type).toBe('ATTACK')
    expect(specialEvent?.type).toBe('ATTACK')
    if (normalEvent?.type !== 'ATTACK' || specialEvent?.type !== 'ATTACK') {
      throw new Error('La jugada no resolvió un ataque.')
    }
    expect(specialEvent.resolution.attackTechnique).toBe('cometa')
    expect(specialEvent.resolution.A).toBe(normalEvent.resolution.A + 1)
    expect(special.state.ap).toBe(0)

    const beats = matchBeats(state, special.events, special.state, DEMO_TEAMS)
    const spike = beats.find((beat) => beat.kind === 'spike')
    expect(spike?.cutin?.move).toBe('COMETA')
    expect(spike?.caption).toContain('COMETA')
  })

  it('permite elegir defensa y técnica, una vez por rally', () => {
    const served = serve(create(), cell('away', 1, 2), mulberry32(10))
    const state = served.state
    state.ap = 3
    state.defenseTechniqueUsed = false
    const candidates = defenseCandidates(state, 'libero')
    const libero = candidates.find((player) => player.classId === 'libero')
    expect(libero).toBeTruthy()

    const wall = defenseCandidates(state, 'wall')
    expect(wall.length).toBeGreaterThan(0)
    expect(
      wall.every(
        (player) => player.cell.row === 0 && player.classId !== 'libero',
      ),
    ).toBe(true)

    const result = defend(state, 'libero', mulberry32(11), {
      defenderId: libero!.id,
      technique: 'zambullida',
    })
    expect(result.events[0]?.type).toBe('ATTACK')
    const event = result.events[0]
    if (event?.type !== 'ATTACK') {
      throw new Error('La defensa no resolvió un ataque.')
    }
    expect(event.resolution.defenderId).toBe(libero!.id)
    expect(event.resolution.defenseTechnique).toBe('zambullida')
    expect(result.state.defenseTechniqueUsed).toBe(true)

    const spent = {
      ...state,
      defenseTechniqueUsed: true,
      phase: 'DEFEND' as const,
    }
    expect(() =>
      defend(spent, 'libero', mulberry32(12), {
        defenderId: libero!.id,
        technique: 'zambullida',
      }),
    ).toThrow(/técnica defensiva/)
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

  it('exige dos puntos de diferencia para cerrar el set', () => {
    // Recepción rival muy débil: el saque fuerza un error y da el punto.
    const roster = DEMO_PLAYERS.map((player) =>
      player.side === 'away'
        ? {
            ...player,
            stats: { ...player.stats, tecnica: 0 },
          }
        : player,
    )
    const state = createMatch({
      roster,
      playerSide: 'home',
      server: 'home',
      targetScore: 25,
      startScore: { home: 24, away: 24 },
    })
    const target =
      state.players.find((player) => player.id === 'away-setter')?.cell ??
      cell('away', 0, 2)
    const first = serve(state, target, mulberry32(1))
    expect(first.state.score.home).toBe(25)
    expect(first.state.phase).toBe('SERVE')
    expect(first.state.winner).toBeNull()
    expect(first.events.some((event) => event.type === 'MATCH_END')).toBe(false)

    const second = serve(first.state, target, mulberry32(2))
    expect(second.state.score.home).toBe(26)
    expect(second.state.phase).toBe('END')
    expect(second.state.winner).toBe('home')
    expect(second.events.some((event) => event.type === 'MATCH_END')).toBe(
      true,
    )
  })

  it('arma un 6v6 con dos puntas y una rotación de seis', () => {
    const state = create()
    const home = state.players.filter((player) => player.side === 'home')
    expect(home).toHaveLength(6)
    expect(home.map((player) => player.id)).toEqual(
      expect.arrayContaining(['home-wing-1', 'home-wing-2']),
    )
    expect(state.rotation.home).toHaveLength(6)
    expect(state.rotation.home[0]).toBe('home-opposite')
    expect(state.rotation.home[5]).toBe('home-libero')
    expect(state.rotation.away).toHaveLength(6)
  })

  it('rota al ganar el saque y mantiene al líbero en zaga', () => {
    const state = create()
    rotateSide(state, 'home')
    expect(state.rotation.home[0]).toBe('home-wing-1')
    expect(state.rotation.home[5]).toBe('home-opposite')
    expect([0, 4, 5]).toContain(
      state.rotation.home.indexOf('home-libero'),
    )
    rotateSide(state, 'home')
    expect([0, 4, 5]).toContain(
      state.rotation.home.indexOf('home-libero'),
    )
    expect(state.rotation.home).toHaveLength(6)
  })

  it('la tensión paga los ataques y se gana con el punto', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'home',
      targetScore: MATCH_TARGET,
      useTension: true,
    })
    state.phase = 'ATTACK'
    state.possession = 'home'
    state.setQuality = 2
    state.ap = 3
    state.hiddenScheme = 'wall'
    expect(state.tension.home).toBe(30)
    const result = attack(state, 'power', cell('away', 2, 0), () => 0, {
      attackerId: 'home-opposite',
    })
    expect(result.state.tension.home).toBe(0)
    expect(result.state.tension.away).toBe(40)
  })

  it('la recepción suma tensión', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
      useTension: true,
    })
    const result = serve(state, cell('home', 2, 1), mulberry32(1))
    expect(result.state.tension.home).toBeGreaterThan(30)
  })

  it('el armado CT1 fija atacante, zona y pelota', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
      useTension: true,
    })
    const result = serve(state, cell('home', 2, 1), mulberry32(1))
    const next = result.state
    const attacker = next.players.find(
      (player) => player.id === next.setAttackerId,
    )
    expect(attacker).toBeTruthy()
    expect(attacker?.side).toBe('home')
    expect(attacker?.classId).not.toBe('libero')
    expect(attacker?.classId).not.toBe('setter')
    expect(next.setZone).toBe(
      attackZoneForCell(attacker!.side, attacker!.cell.col),
    )
    expect(next.ball).toEqual(attacker!.cell)

    const setEvent = result.events.find((event) => event.type === 'SET')
    expect(setEvent?.type).toBe('SET')
    if (setEvent?.type === 'SET') {
      expect(setEvent.to).toEqual(attacker!.cell)
    }

    const options = attackOptions(next)
    expect(options.length).toBeGreaterThan(0)
    expect(
      options.every((option) => option.attacker.id === attacker!.id),
    ).toBe(true)
    const first = options[0]
    expect(
      pickAttackerFor(next, first.kind, first.targets[0])?.id,
    ).toBe(attacker!.id)
  })

  it('mapea la zona de ataque según el lado', () => {
    expect(attackZoneForCell('home', 3)).toBe(2)
    expect(attackZoneForCell('home', 0)).toBe(4)
    expect(attackZoneForCell('away', 0)).toBe(2)
    expect(attackZoneForCell('away', 3)).toBe(4)
  })

  it('calcula el riesgo de fault de ataque', () => {
    const attacker = DEMO_PLAYERS.find(
      (player) => player.id === 'home-opposite',
    )!
    expect(attackFaultChance(attacker, 'power', 2)).toBeGreaterThan(0.08)
    expect(attackFault(attacker, 'power', 2, 0)).toBe('out')
    expect(attackFault(attacker, 'quick', 2, 0)).toBe('net')
    expect(attackFault(attacker, 'power', 3, 0.99)).toBeNull()
  })

  it('un ataque afuera da el punto al rival', () => {
    const state = create()
    state.phase = 'ATTACK'
    state.possession = 'home'
    state.setQuality = 2
    state.ap = 3
    state.hiddenScheme = 'wall'
    const result = attack(state, 'power', cell('away', 2, 0), () => 0, {
      attackerId: 'home-opposite',
    })
    const attackEvent = result.events.find(
      (event) => event.type === 'ATTACK',
    )
    expect(attackEvent?.type).toBe('ATTACK')
    if (attackEvent?.type === 'ATTACK') {
      expect(attackEvent.resolution.outcome).toBe('fault')
      expect(attackEvent.resolution.fault).toBe('out')
    }
    expect(result.state.score.away).toBe(1)
    expect(result.state.server).toBe('away')
  })

  it('un ataque rival afuera da el punto al jugador', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'away',
      targetScore: MATCH_TARGET,
    })
    state.phase = 'DEFEND'
    state.possession = 'away'
    state.setQuality = 2
    state.ap = 3
    state.hiddenAttack = {
      attackerId: 'away-opposite',
      kind: 'power',
      target: cell('home', 2, 0),
    }
    const result = defend(state, 'wall', () => 0)
    const attackEvent = result.events.find(
      (event) => event.type === 'ATTACK',
    )
    expect(attackEvent?.type).toBe('ATTACK')
    if (attackEvent?.type === 'ATTACK') {
      expect(attackEvent.resolution.outcome).toBe('fault')
      expect(attackEvent.resolution.fault).toBe('out')
    }
    expect(result.state.score.home).toBe(1)
    expect(result.state.server).toBe('home')
  })

  it('mapea los destinos de saque a las zonas del rival', () => {
    expect(serveTargetForZone('home', 1)).toEqual(cell('away', 2, 0))
    expect(serveTargetForZone('home', 5)).toEqual(cell('away', 2, 3))
    expect(serveTargetForZone('home', 6)).toEqual(cell('away', 2, 1))
    expect(serveTargetForZone('home', 'short')).toEqual(cell('away', 0, 1))
    expect(serveTargetForZone('away', 1)).toEqual(cell('home', 2, 3))
    expect(serveTargetForZone('away', 5)).toEqual(cell('home', 2, 0))
  })

  it('calcula el riesgo de saque según stats y destino', () => {
    const server = DEMO_PLAYERS.find(
      (player) => player.id === 'home-opposite',
    )!
    expect(serveFaultChance(server, 'short')).toBeGreaterThan(0.15)
    expect(serveZoneRisk(server, 'short')).toBe('alto')
    expect(serveZoneRisk(server, 6)).toBe('bajo')
    expect(serveFault(server, 'short', 0)).toBe('net')
    expect(serveFault(server, 'short', 0.99)).toBeNull()
    expect(serveFault(server, 1, 0)).toBe('out')
  })

  it('un saque a la red da el punto al que recibe', () => {
    const state = create()
    const server = state.players.find(
      (player) => player.id === 'home-opposite',
    )!
    server.stats = { ...server.stats, tecnica: 0, potencia: 0 }
    const target = serveTargetForZone('home', 'short')
    const result = serve(state, target, () => 0, {}, 2, 'short')
    const serveEvent = result.events.find(
      (event) => event.type === 'SERVE',
    )
    expect(serveEvent?.type).toBe('SERVE')
    if (serveEvent?.type === 'SERVE') {
      expect(serveEvent.outcome).toBe('net')
      expect(serveEvent.zone).toBe('short')
    }
    expect(result.state.score.away).toBe(1)
    expect(result.state.score.home).toBe(0)
    expect(result.state.server).toBe('away')
    expect(result.state.rotation.away[0]).toBe('away-wing-1')
    expect(result.state.phase).toBe('SERVE')
    expect(
      result.events.some(
        (event) =>
          event.type === 'POINT' &&
          event.side === 'away' &&
          event.reason === 'error',
      ),
    ).toBe(true)
  })

  it('una recepción exigida puede irse como free ball', () => {
    const state = create()
    const receiver = state.players.find(
      (player) => player.id === 'away-opposite',
    )!
    receiver.stats = { ...receiver.stats, tecnica: 3 }
    isolateReceiver(state, receiver.id)
    const target = serveTargetForZone('home', 1)
    const result = serve(state, target, () => 0.5, {}, 2, 1)
    expect(result.events.some((event) => event.type === 'FREE_BALL')).toBe(
      true,
    )
    const receives = result.events.filter(
      (event) => event.type === 'RECEIVE',
    )
    expect(receives).toHaveLength(2)
    if (receives[0]?.type === 'RECEIVE') {
      expect(receives[0].freeBall).toBe(true)
    }
    if (receives[1]?.type === 'RECEIVE') {
      expect(receives[1].quality).toBe(3)
    }
    expect(result.state.possession).toBe('home')
    expect(result.state.phase).toBe('ATTACK')
    expect(result.state.ap).toBe(3)
  })

  it('una recepción exigida puede quedar para un compañero', () => {
    const state = create()
    const receiver = state.players.find(
      (player) => player.id === 'away-opposite',
    )!
    receiver.stats = { ...receiver.stats, tecnica: 4 }
    isolateReceiver(state, receiver.id)
    const setter = state.players.find(
      (player) => player.id === 'away-setter',
    )!
    setter.cell = cell('away', 2, 1)
    const target = serveTargetForZone('home', 1)
    const result = serve(state, target, () => 0.5, {}, 2, 1)
    const receive = result.events.find(
      (event) => event.type === 'RECEIVE',
    )
    expect(receive?.type).toBe('RECEIVE')
    if (receive?.type === 'RECEIVE') {
      expect(receive.teammate).toBe(true)
      expect(receive.freeBall).toBeUndefined()
    }
    expect(result.state.possession).toBe('away')
    expect(result.state.phase).toBe('DEFEND')
  })

  it('marca el dig cuando el líbero recibe un saque potente', () => {
    const state = create()
    const target = serveTargetForZone('home', 6)
    const result = serve(state, target, () => 0.5, {}, 2, 6)
    const receive = result.events.find(
      (event) => event.type === 'RECEIVE',
    )
    expect(receive?.type).toBe('RECEIVE')
    if (receive?.type === 'RECEIVE') {
      expect(receive.dig).toBe(true)
    }
  })

  it('una recepción que no se controla es ace del sacador', () => {
    const state = create()
    const receiver = state.players.find(
      (player) => player.id === 'away-opposite',
    )!
    receiver.stats = { ...receiver.stats, tecnica: 0 }
    isolateReceiver(state, receiver.id)
    const target = serveTargetForZone('home', 1)
    const result = serve(state, target, () => 0.5, {}, 2, 1)
    const serveEvent = result.events.find(
      (event) => event.type === 'SERVE',
    )
    expect(serveEvent?.type).toBe('SERVE')
    if (serveEvent?.type === 'SERVE') {
      expect(serveEvent.outcome).toBe('ace')
    }
    expect(result.state.score.home).toBe(1)
    expect(result.state.server).toBe('home')
  })

  it('el líbero cubre la zona 1 y evita el ace automático', () => {
    const state = create()
    const target = serveTargetForZone('home', 1)
    const result = serve(state, target, () => 0.5, {}, 2, 1)
    const receive = result.events.find(
      (event) => event.type === 'RECEIVE',
    )
    expect(receive?.type).toBe('RECEIVE')
    if (receive?.type === 'RECEIVE') {
      expect(receive.playerId).toBe('away-libero')
      expect(receive.quality).toBeGreaterThan(0)
    }
    expect(result.state.score.home).toBe(0)
    expect(result.state.phase).toBe('DEFEND')
  })

  it('una recepción mala puede salvarse con suerte en CT1', () => {
    const state = createMatch({
      roster: DEMO_PLAYERS,
      playerSide: 'home',
      server: 'home',
      targetScore: MATCH_TARGET,
      useTension: true,
    })
    const receiver = state.players.find(
      (player) => player.id === 'away-opposite',
    )!
    receiver.stats = { ...receiver.stats, tecnica: 0 }
    isolateReceiver(state, receiver.id)
    const rolls = [0.5, 0]
    const target = serveTargetForZone('home', 1)
    const result = serve(
      state,
      target,
      () => rolls.shift() ?? 0.5,
      {},
      2,
      1,
    )
    const receive = result.events.find(
      (event) => event.type === 'RECEIVE',
    )
    expect(receive?.type).toBe('RECEIVE')
    if (receive?.type === 'RECEIVE') {
      expect(receive.quality).toBe(1)
      expect(receive.dig).toBe(true)
    }
    expect(result.state.score.home).toBe(0)
  })

  it('la salvada depende de lectura y velocidad', () => {
    const libero = DEMO_PLAYERS.find(
      (player) => player.id === 'away-libero',
    )!
    const opposite = DEMO_PLAYERS.find(
      (player) => player.id === 'away-opposite',
    )!
    expect(receptionSaveChance(libero)).toBeGreaterThan(
      receptionSaveChance(opposite),
    )
  })
})
