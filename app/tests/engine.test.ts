import { describe, expect, it } from 'vitest'
import {
  AP_MAX,
  AP_PER_POSSESSION,
  ATTACK_AP_COST,
  CLASS_STATS,
  DEFENSE_SCHEMES,
  SCHEME_EDGE,
  SCHEME_STAT,
  attackKindsFor,
  attackValue,
  cell,
  createMatch,
  createPlayers,
  isAttackAllowed,
  isSeam,
  mulberry32,
  receptionQuality,
  receptionValue,
  resolveDuel,
  schemeDefender,
  setQuality,
  tellsFor,
  withHiddenChoice,
} from '../src/engine'
import type {
  AttackKind,
  DefenseScheme,
  GameState,
  Player,
  Quality,
  Side,
} from '../src/engine'

const roster = createPlayers()
const of = (side: Side, classId: Player['classId']): Player =>
  roster.find((player) => player.side === side && player.classId === classId)!

const home = roster.filter((player) => player.side === 'home')
const homeMiddle = of('home', 'middle')
const homeSetter = of('home', 'setter')
const homeLibero = of('home', 'libero')
const homeOpposite = of('home', 'opposite')
const awayPlayers = roster.filter((player) => player.side === 'away')

const synthetic = (
  id: string,
  classId: Player['classId'],
  row: 0 | 1,
  col: 0 | 1 | 2,
): Player => ({
  id,
  side: 'away',
  classId,
  name: id,
  stats: { tecnica: 3, potencia: 3, velocidad: 3, lectura: 3 },
  cell: { side: 'away', row, col },
})

const defense: Player[] = [
  synthetic('d0', 'middle', 0, 0),
  synthetic('d1', 'setter', 0, 1),
  synthetic('d2', 'libero', 1, 1),
  synthetic('d3', 'opposite', 1, 2),
]

const attacker: Player = {
  id: 'a0',
  side: 'home',
  classId: 'middle',
  name: 'Atacante',
  stats: { tecnica: 3, potencia: 3, velocidad: 3, lectura: 3 },
  cell: { side: 'home', row: 0, col: 1 },
}

const target = cell('away', 0, 0)

const duel = (
  scheme: DefenseScheme,
  kind: AttackKind,
  setQ: Quality,
  who: Player = attacker,
) =>
  resolveDuel({
    attacker: who,
    kind,
    target,
    setQuality: setQ,
    defending: defense,
    scheme,
  })

describe('formación y stats', () => {
  it('arma cuatro jugadores por lado con la formación espejada', () => {
    expect(roster).toHaveLength(8)
    expect(home).toHaveLength(4)
    expect(homeMiddle.cell).toEqual({ side: 'home', row: 0, col: 0 })
    expect(homeSetter.cell).toEqual({ side: 'home', row: 0, col: 1 })
    expect(homeOpposite.cell).toEqual({ side: 'home', row: 1, col: 2 })
    expect(homeLibero.cell).toEqual({ side: 'home', row: 1, col: 1 })
    expect(of('away', 'middle').cell).toEqual({ side: 'away', row: 0, col: 2 })
    expect(of('away', 'opposite').cell).toEqual({
      side: 'away',
      row: 1,
      col: 0,
    })
  })

  it('mantiene los stats 1-5 por clase', () => {
    expect(CLASS_STATS.setter).toEqual({
      tecnica: 5,
      potencia: 2,
      velocidad: 3,
      lectura: 4,
    })
    expect(CLASS_STATS.middle.lectura).toBe(5)
    expect(CLASS_STATS.opposite.potencia).toBe(5)
    expect(CLASS_STATS.libero.velocidad).toBe(5)
  })
})

describe('recepción', () => {
  it('convierte valor en calidad 0-3', () => {
    expect(receptionQuality(6)).toBe(3)
    expect(receptionQuality(5)).toBe(2)
    expect(receptionQuality(4)).toBe(2)
    expect(receptionQuality(3)).toBe(1)
    expect(receptionQuality(2)).toBe(1)
    expect(receptionQuality(1)).toBe(0)
    expect(receptionQuality(0)).toBe(0)
  })

  it('premia al líbero en su propia celda y castiga la costura', () => {
    const ball = cell('home', 1, 1)
    expect(receptionValue(homeLibero, ball, 1, false)).toBe(6)
    expect(receptionValue(homeLibero, ball, 1, true)).toBe(5)
    expect(
      receptionValue(homeLibero, ball, 1, true, { ignoresSeam: true }),
    ).toBe(6)
  })

  it('castiga la recepción fuera de celda salvo velocidad alta', () => {
    const ball = cell('home', 0, 1)
    expect(receptionValue(homeMiddle, ball, 0, false)).toBe(1)
    expect(receptionValue(homeOpposite, ball, 0, false)).toBe(2)
  })

  it('detecta costuras solo en celdas vacías con dos receptores', () => {
    expect(isSeam(home, cell('home', 0, 0), 'home')).toBe(false)
    expect(isSeam(home, cell('home', 1, 0), 'home')).toBe(true)
  })
})

describe('armado', () => {
  it('baja la calidad por distancia, clase y técnica', () => {
    expect(setQuality(3, homeSetter, 1)).toBe(3)
    expect(setQuality(1, homeSetter, 1)).toBe(1)
    expect(setQuality(3, homeSetter, 2)).toBe(3)
    expect(setQuality(3, homeSetter, 3)).toBe(2)
    expect(setQuality(3, homeMiddle, 1)).toBe(0)
    expect(setQuality(1, homeLibero, 2)).toBe(1)
    expect(setQuality(3, homeLibero, 2)).toBe(3)
    expect(setQuality(0, homeSetter, 1)).toBe(0)
  })
})

describe('valor de ataque', () => {
  it('suma potencia, armado, bonus y resta columna lejana', () => {
    expect(attackValue(homeMiddle, 'power', 2, cell('away', 0, 0))).toBe(11)
    expect(attackValue(homeMiddle, 'power', 2, cell('away', 0, 2))).toBe(10)
    expect(attackValue(homeMiddle, 'quick', 2, cell('away', 0, 1))).toBe(11)
    expect(attackValue(homeMiddle, 'placement', 2, cell('away', 0, 1))).toBe(9)
  })

  it('da bonus de esquina a colocación y finta', () => {
    expect(attackValue(homeMiddle, 'placement', 2, cell('away', 0, 0))).toBe(11)
    expect(attackValue(homeMiddle, 'placement', 2, cell('away', 0, 1))).toBe(9)
    expect(attackValue(homeMiddle, 'tip', 2, cell('away', 0, 0))).toBe(11)
  })
})

describe('legalidad de ataques', () => {
  it('el líbero no puede atacar', () => {
    const check = isAttackAllowed({
      attacker: homeLibero,
      kind: 'power',
      target: cell('away', 0, 0),
    })
    expect(check.ok).toBe(false)
    expect(attackKindsFor(homeLibero)).toEqual([])
  })

  it('el rápido es solo del central y el pipe solo del opuesto de fondo', () => {
    expect(
      isAttackAllowed({
        attacker: homeSetter,
        kind: 'quick',
        target: cell('away', 0, 1),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: homeMiddle,
        kind: 'quick',
        target: cell('away', 0, 1),
      }).ok,
    ).toBe(true)
    expect(
      isAttackAllowed({
        attacker: homeOpposite,
        kind: 'pipe',
        target: cell('away', 0, 1),
      }).ok,
    ).toBe(true)
    expect(
      isAttackAllowed({
        attacker: homeMiddle,
        kind: 'pipe',
        target: cell('away', 0, 1),
      }).ok,
    ).toBe(false)
  })

  it('el rápido entra por el centro y la finta cae al fondo', () => {
    expect(
      isAttackAllowed({
        attacker: homeMiddle,
        kind: 'quick',
        target: cell('away', 0, 0),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: homeMiddle,
        kind: 'quick',
        target: cell('away', 1, 1),
      }).ok,
    ).toBe(true)
    expect(
      isAttackAllowed({
        attacker: homeSetter,
        kind: 'tip',
        target: cell('away', 0, 0),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: homeSetter,
        kind: 'tip',
        target: cell('away', 1, 2),
      }).ok,
    ).toBe(true)
  })

  it('un jugador de fondo no ataca desde la red y el ataque va al rival', () => {
    const netOpposite: Player = {
      ...homeOpposite,
      cell: { side: 'home', row: 0, col: 2 },
    }
    expect(
      isAttackAllowed({
        attacker: netOpposite,
        kind: 'power',
        target: cell('away', 0, 0),
      }).ok,
    ).toBe(false)
    expect(
      isAttackAllowed({
        attacker: homeMiddle,
        kind: 'power',
        target: cell('home', 0, 0),
      }).ok,
    ).toBe(false)
  })

  it('lista los ataques legales por clase y posición', () => {
    expect(attackKindsFor(homeMiddle).sort()).toEqual(
      ['placement', 'power', 'quick', 'tip', 'wipe'].sort(),
    )
    expect(attackKindsFor(homeOpposite).sort()).toEqual(
      ['placement', 'pipe', 'power', 'tip', 'wipe'].sort(),
    )
    expect(attackKindsFor(homeSetter).sort()).toEqual(
      ['placement', 'power', 'tip', 'wipe'].sort(),
    )
  })
})

describe('duelo oculto', () => {
  it('elige al defensor que lidera cada esquema', () => {
    expect(schemeDefender(defense, 'wall', target).player.id).toBe('d0')
    expect(schemeDefender(defense, 'spread', target).player.id).toBe('d0')
    expect(schemeDefender(defense, 'deep', target).player.id).toBe('d2')
    expect(schemeDefender(defense, 'libero', target).player.id).toBe('d2')
  })

  it('el rápido no deja acomodar al defensor', () => {
    const positioned = schemeDefender(defense, 'wall', target)
    const quick = schemeDefender(defense, 'wall', target, true)
    expect(quick.value).toBe(positioned.value - 1)
    expect(quick.player.id).toBe(positioned.player.id)
  })

  it('aplica el matchup del esquema contra cada ataque', () => {
    for (const scheme of DEFENSE_SCHEMES) {
      for (const kind of [
        'power',
        'placement',
        'quick',
        'pipe',
        'wipe',
        'tip',
      ] as AttackKind[]) {
        expect(duel(scheme, kind, 2).edge).toBe(SCHEME_EDGE[scheme][kind])
      }
    }
  })

  it('convierte el delta en punto, bloqueo o dig', () => {
    const point = duel('spread', 'power', 2)
    expect(point.A).toBe(10)
    expect(point.D).toBe(6)
    expect(point.outcome).toBe('point')
    expect(point.digQuality).toBeNull()

    const dig = duel('wall', 'power', 2)
    expect(dig.A).toBe(10)
    expect(dig.D).toBe(11)
    expect(dig.outcome).toBe('dig')
    expect(dig.digQuality).toBe(1)
    expect(dig.defenderId).toBe('d0')

    const blocked = duel('wall', 'power', 0)
    expect(blocked.outcome).toBe('blocked')
    expect(blocked.digQuality).toBeNull()
    expect(blocked.blockerIds).toEqual(['d0', 'd1'])
  })

  it('solo bloquean los esquemas de red; el resto hace dig', () => {
    const weak: Player = {
      ...attacker,
      stats: { ...attacker.stats, potencia: 1 },
    }
    const deep = duel('deep', 'power', 0, weak)
    expect(deep.outcome).toBe('dig')
    expect(deep.digQuality).toBe(3)
    expect(deep.blockerIds).toEqual([])
  })

  it('usa la stat que corresponde a cada esquema', () => {
    expect(SCHEME_STAT.wall).toBe('lectura')
    expect(SCHEME_STAT.spread).toBe('velocidad')
    expect(SCHEME_STAT.deep).toBe('lectura')
    expect(SCHEME_STAT.libero).toBe('tecnica')
  })
})

describe('pistas y apuesta oculta', () => {
  const base = createMatch({ playerSide: 'home' })

  const attackState = (
    attackerId: string,
    scheme: DefenseScheme,
  ): GameState => ({
    ...base,
    phase: 'ATTACK',
    possession: 'home',
    attackerId,
    hiddenChoice: { type: 'defense', side: 'away', scheme },
  })

  const defendState = (planKind: AttackKind, targetCell: GameState['ball']['cell']) =>
    ({
      ...base,
      phase: 'DEFEND',
      possession: 'away',
      attackerId: 'away-middle',
      hiddenChoice: {
        type: 'attack',
        side: 'away',
        plan: { kind: planKind, target: targetCell },
      },
    }) as GameState

  it('da dos pistas con Lectura 4 o más y una con menos', () => {
    const smart = tellsFor(attackState('home-middle', 'wall'))
    expect(smart).toHaveLength(2)
    expect(smart[0].text).toContain('Dos manos se levantan')

    const normal = tellsFor(attackState('home-opposite', 'wall'))
    expect(normal).toHaveLength(1)
    expect(normal[0].text).toContain('Dos manos se levantan')
  })

  it('no revela el resultado ni el nombre del esquema', () => {
    const tells = tellsFor(attackState('home-middle', 'spread'))
    const all = tells.map((tell) => tell.text).join(' ')
    expect(all).not.toContain('Bloqueo abierto')
    expect(all).not.toContain('punto')
    expect(all).not.toContain('dig')
  })

  it('describe el ataque rival sin mostrar probabilidades', () => {
    const tells = tellsFor(defendState('pipe', cell('home', 1, 0)))
    expect(tells).toHaveLength(2)
    expect(tells[0].text).toContain('Pipe')
    expect(tells[1].text).toContain('zona 5')
    expect(tells.map((tell) => tell.text).join(' ')).not.toContain('%')
  })

  it('no devuelve pistas sin apuesta oculta', () => {
    expect(tellsFor(base)).toEqual([])
  })

  it('compromete a la IA antes de la elección del jugador', () => {
    const state: GameState = {
      ...base,
      phase: 'ATTACK',
      possession: 'home',
      attackerId: 'home-middle',
      setQuality: 2,
      ap: 2,
    }
    const next = withHiddenChoice(state, mulberry32(7))
    expect(next.hiddenChoice?.type).toBe('defense')
    if (next.hiddenChoice?.type === 'defense') {
      expect(next.hiddenChoice.side).toBe('away')
      expect(DEFENSE_SCHEMES).toContain(next.hiddenChoice.scheme)
    }
    expect(withHiddenChoice(next, mulberry32(7))).toBe(next)
  })

  it('compromete un ataque legal cuando el jugador defiende', () => {
    const state: GameState = {
      ...base,
      phase: 'DEFEND',
      possession: 'away',
      attackerId: 'away-middle',
      setQuality: 2,
      ap: 2,
    }
    const next = withHiddenChoice(state, mulberry32(9))
    expect(next.hiddenChoice?.type).toBe('attack')
    if (next.hiddenChoice?.type === 'attack') {
      const plan = next.hiddenChoice.plan
      const awayAttacker = awayPlayers.find(
        (player) => player.id === next.attackerId,
      )!
      expect(next.hiddenChoice.side).toBe('away')
      expect(
        isAttackAllowed({
          attacker: awayAttacker,
          kind: plan.kind,
          target: plan.target,
        }).ok,
      ).toBe(true)
      expect(ATTACK_AP_COST[plan.kind]).toBeLessThanOrEqual(state.ap)
    }
  })

  it('limpia la apuesta oculta fuera de ataque/defensa', () => {
    const state: GameState = {
      ...base,
      hiddenChoice: { type: 'defense', side: 'away', scheme: 'wall' },
    }
    expect(withHiddenChoice(state, mulberry32(1)).hiddenChoice).toBeNull()
  })
})

describe('economía de energía', () => {
  it('arranca en 2, tope 3 y costos por ataque', () => {
    expect(AP_PER_POSSESSION).toBe(2)
    expect(AP_MAX).toBe(3)
    expect(ATTACK_AP_COST).toEqual({
      power: 2,
      placement: 0,
      quick: 0,
      pipe: 3,
      wipe: 2,
      tip: 0,
    })
  })
})
