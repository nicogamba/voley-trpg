import { describe, expect, it } from 'vitest'
import { createPlayers } from '../src/engine/state'
import {
  cell,
  cellsOfSide,
  moveDistance,
  reaches,
  zoneOf,
} from '../src/engine/geometry'
import {
  attackBase,
  attackValue,
  blockValue,
  blockersFor,
  defenseValue,
  evaluateAttack,
  isAttackAllowed,
  receptionQuality,
  receptionValue,
  setQuality,
} from '../src/engine/resolve'
import type { Player, Quality, Side } from '../src/engine/types'

const roster = createPlayers()
const of = (side: Side, classId: Player['classId']): Player =>
  roster.find((p) => p.side === side && p.classId === classId)!
const home = roster.filter((p) => p.side === 'home')
const homeMiddle = of('home', 'middle')
const homeSetter = of('home', 'setter')
const homeLibero = of('home', 'libero')
const homeOpposite = of('home', 'opposite')

const bestReception = (
  ballCell: ReturnType<typeof cell>,
  players: Player[],
  side: Side,
): { player: Player; value: number; quality: Quality } => {
  const receivers = players.filter(
    (p) => p.side === side && reaches(p.cell, ballCell),
  )
  const occupied = players.some(
    (p) => p.side === ballCell.side && p.cell.row === ballCell.row && p.cell.col === ballCell.col,
  )
  const seam = !occupied && receivers.length >= 2
  const scored = receivers.map((player) => {
    const value = receptionValue(player, ballCell, 1, seam)
    return { player, value, quality: receptionQuality(value) }
  })
  scored.sort((a, b) => b.value - a.value)
  return scored[0]
}

describe('geometría', () => {
  it('alcanza la celda propia y las ortogonales, nunca la diagonal', () => {
    const origin = cell('home', 1, 1)
    expect(reaches(origin, cell('home', 1, 1))).toBe(true)
    expect(reaches(origin, cell('home', 0, 1))).toBe(true)
    expect(reaches(origin, cell('home', 1, 0))).toBe(true)
    expect(reaches(origin, cell('home', 0, 0))).toBe(false)
    expect(reaches(origin, cell('home', 0, 2))).toBe(false)
    expect(reaches(origin, cell('away', 1, 1))).toBe(false)
  })

  it('mapea las seis zonas oficiales', () => {
    expect([zoneOf(0, 0), zoneOf(0, 1), zoneOf(0, 2)]).toEqual([4, 3, 2])
    expect([zoneOf(1, 0), zoneOf(1, 1), zoneOf(1, 2)]).toEqual([5, 6, 1])
  })

  it('mide el movimiento en pasos ortogonales', () => {
    expect(moveDistance(cell('home', 0, 0), cell('home', 1, 2))).toBe(3)
    expect(moveDistance(cell('home', 0, 0), cell('home', 0, 2))).toBe(2)
  })

  it('produce las seis celdas de un lado', () => {
    expect(cellsOfSide('home')).toHaveLength(6)
  })
})

describe('recepción', () => {
  it('el líbero en su celda contra saque llega a pase perfecto', () => {
    const value = receptionValue(homeLibero, homeLibero.cell, 1, false)
    expect(value).toBe(6)
    expect(receptionQuality(value)).toBe(3)
  })

  it('el armador en celda adyacente pierde calidad', () => {
    const value = receptionValue(homeSetter, cell('home', 0, 0), 1, false)
    expect(value).toBe(3)
    expect(receptionQuality(value)).toBe(1)
  })

  it('la costura resta uno', () => {
    const clean = receptionValue(homeSetter, homeSetter.cell, 1, false)
    const seam = receptionValue(homeSetter, homeSetter.cell, 1, true)
    expect(seam).toBe(clean - 1)
  })

  it('Velocidad >= 4 ignora la penalización por celda adyacente', () => {
    const fast = receptionValue(homeOpposite, cell('home', 1, 1), 1, false)
    expect(fast).toBe(1)
    expect(homeOpposite.stats.velocidad).toBeGreaterThanOrEqual(4)
  })

  it('sin velocidad, recibir fuera de la celda resta uno', () => {
    const slow = receptionValue(homeMiddle, cell('home', 1, 0), 1, false)
    expect(slow).toBe(0)
  })

  it('reproduce la tabla de recepción base de la hoja de números', () => {
    const expected: Record<number, Quality> = {
      1: 2,
      2: 1,
      3: 2,
      4: 1,
      5: 2,
      6: 3,
    }
    for (const target of cellsOfSide('home')) {
      const best = bestReception(target, home, 'home')
      expect(best.quality, `zona ${zoneOf(target.row, target.col)}`).toBe(
        expected[zoneOf(target.row, target.col)],
      )
    }
  })
})

describe('armado', () => {
  it('el armador preserva la calidad del pase', () => {
    expect(setQuality(3, homeSetter, 0)).toBe(3)
    expect(setQuality(2, homeSetter, 1)).toBe(2)
    expect(setQuality(1, homeSetter, 1)).toBe(1)
    expect(setQuality(0, homeSetter, 1)).toBe(0)
  })

  it('a distancia 2 pierde un punto de calidad', () => {
    expect(setQuality(3, homeSetter, 2)).toBe(2)
    expect(setQuality(2, homeSetter, 2)).toBe(1)
  })

  it('el no-armador destruye la jugada', () => {
    expect(setQuality(3, homeLibero, 0)).toBe(1)
    expect(setQuality(3, homeMiddle, 0)).toBe(0)
  })
})

describe('bloqueo', () => {
  it('reproduce la tabla de valores de bloqueo', () => {
    expect(blockValue([])).toBe(0)
    expect(blockValue([homeSetter])).toBe(4)
    expect(blockValue([homeMiddle])).toBe(6)
    expect(blockValue([homeMiddle, homeSetter])).toBe(7)
  })

  it('solo cuenta al bloqueador de la misma columna', () => {
    expect(
      blockersFor(home, cell('home', 1, 0)).map((p) => p.classId),
    ).toEqual(['middle'])
    expect(
      blockersFor(home, cell('home', 1, 1)).map((p) => p.classId),
    ).toEqual(['setter'])
    expect(blockersFor(home, cell('home', 1, 2))).toEqual([])
  })
})

describe('defensa', () => {
  it('reproduce la tabla de valores de defensa', () => {
    expect(defenseValue(homeLibero, true, false)).toBe(7)
    expect(defenseValue(homeLibero, false, false)).toBe(6)
    expect(defenseValue(homeMiddle, true, false)).toBe(6)
    expect(defenseValue(homeMiddle, false, false)).toBe(5)
    expect(defenseValue(homeSetter, true, false)).toBe(5)
    expect(defenseValue(homeSetter, false, false)).toBe(4)
    expect(defenseValue(homeOpposite, true, false)).toBe(4)
    expect(defenseValue(homeOpposite, false, false)).toBe(3)
  })

  it('la finta suma uno al defensor', () => {
    expect(defenseValue(homeLibero, true, true)).toBe(8)
  })
})

describe('ataque', () => {
  const attacker = of('away', 'opposite')

  it('el ataque de potencia sin bloqueo usa Potencia + armado + 1', () => {
    expect(attackBase(attacker, 'power', 2, 1)).toBe(8)
    expect(attackValue(attacker, 'power', 2, 1, 0)).toBe(8)
  })

  it('cada bloqueador resta 2', () => {
    expect(attackValue(attacker, 'power', 2, 1, 1)).toBe(6)
    expect(attackValue(attacker, 'power', 2, 1, 2)).toBe(4)
  })

  it('atacar a dos columnas de distancia resta uno', () => {
    expect(attackBase(attacker, 'power', 2, 2)).toBe(7)
  })

  it('wipe y finta ignoran la penalización por bloqueo', () => {
    expect(attackValue(attacker, 'wipe', 2, 1, 2)).toBe(6)
    expect(attackValue(attacker, 'tip', 2, 1, 2)).toBe(6)
  })

  it('reproduce los escenarios de la hoja de números', () => {
    const onlyLibero = [homeLibero]
    const onlyOpposite = [homeOpposite]
    const oppositeInCell = {
      ...homeOpposite,
      cell: cell('home', 1, 1),
    }

    const powerVsLibero = evaluateAttack(
      attacker,
      2,
      'power',
      cell('home', 1, 1),
      onlyLibero,
    )
    expect(powerVsLibero).toMatchObject({
      A: 8,
      B: 0,
      A_pass: 8,
      D: 7,
      outcome: 'dig',
      digQuality: 0,
    })

    const powerVsOpposite = evaluateAttack(
      attacker,
      2,
      'power',
      cell('home', 1, 1),
      [oppositeInCell],
    )
    expect(powerVsOpposite).toMatchObject({ outcome: 'point' })

    const powerVsMiddle = evaluateAttack(
      attacker,
      2,
      'power',
      cell('home', 1, 0),
      [homeMiddle],
    )
    expect(powerVsMiddle).toMatchObject({ A: 6, B: 6, outcome: 'blocked' })

    const quickVsLibero = evaluateAttack(
      of('away', 'middle'),
      2,
      'quick',
      cell('home', 1, 1),
      onlyLibero,
    )
    expect(quickVsLibero).toMatchObject({
      A: 8,
      A_pass: 8,
      D: 7,
      outcome: 'dig',
      digQuality: 0,
    })

    const tipVsLibero = evaluateAttack(
      attacker,
      2,
      'tip',
      cell('home', 1, 1),
      onlyLibero,
    )
    expect(tipVsLibero).toMatchObject({
      A: 6,
      A_pass: 6,
      D: 8,
      outcome: 'dig',
      digQuality: 2,
    })

    const tipVsOpposite = evaluateAttack(
      attacker,
      2,
      'tip',
      cell('home', 1, 1),
      [oppositeInCell],
    )
    expect(tipVsOpposite).toMatchObject({
      A: 6,
      D: 5,
      outcome: 'dig',
      digQuality: 0,
    })

    const wipeVsLibero = evaluateAttack(
      attacker,
      2,
      'wipe',
      cell('home', 1, 1),
      onlyLibero,
    )
    expect(wipeVsLibero).toMatchObject({
      A: 6,
      A_pass: 6,
      D: 7,
      outcome: 'dig',
      digQuality: 1,
    })

    const placementVsOpposite = evaluateAttack(
      of('away', 'setter'),
      2,
      'placement',
      cell('home', 1, 2),
      onlyOpposite,
    )
    expect(placementVsOpposite).toMatchObject({
      A: 4,
      D: 4,
      outcome: 'dig',
      digQuality: 1,
    })
  })
})

describe('validación de ataques', () => {
  const defending = home

  it('el líbero no ataca', () => {
    const check = isAttackAllowed({
      attacker: of('away', 'libero'),
      kind: 'placement',
      tempo: 'high',
      target: cell('home', 1, 1),
      defending,
    })
    expect(check.ok).toBe(false)
  })

  it('el rápido es solo del central', () => {
    const check = isAttackAllowed({
      attacker: of('away', 'opposite'),
      kind: 'quick',
      tempo: 'quick',
      target: cell('home', 1, 1),
      defending,
    })
    expect(check.ok).toBe(false)
  })

  it('el pipe exige al opuesto desde el fondo', () => {
    const ok = isAttackAllowed({
      attacker: of('away', 'opposite'),
      kind: 'pipe',
      tempo: 'back',
      target: cell('home', 1, 1),
      defending,
    })
    expect(ok.ok).toBe(true)

    const forward = { ...of('away', 'opposite'), cell: cell('away', 0, 1) }
    const bad = isAttackAllowed({
      attacker: forward,
      kind: 'pipe',
      tempo: 'back',
      target: cell('home', 1, 1),
      defending,
    })
    expect(bad.ok).toBe(false)
  })

  it('el wipe necesita un bloqueador en la columna', () => {
    const withBlocker = isAttackAllowed({
      attacker: of('away', 'opposite'),
      kind: 'wipe',
      tempo: 'high',
      target: cell('home', 1, 0),
      defending,
    })
    expect(withBlocker.ok).toBe(true)

    const emptyColumn = isAttackAllowed({
      attacker: of('away', 'opposite'),
      kind: 'wipe',
      tempo: 'high',
      target: cell('home', 1, 1),
      defending: [homeLibero],
    })
    expect(emptyColumn.ok).toBe(false)
  })
})
