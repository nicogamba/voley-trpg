import { describe, expect, it } from 'vitest'
import {
  formatReport,
  playMatch,
  simulateMatches,
} from '../src/engine/simulate'
import type { AttackKind, DefenseScheme } from '../src/engine'

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0)

describe('simulador', () => {
  it('un partido termina a 7 y es reproducible', () => {
    const first = playMatch(42)
    const second = playMatch(42)
    expect(first.winner).toBe(second.winner)
    expect(first.score).toEqual(second.score)
    expect(first.commands).toBe(second.commands)
    expect(first.metrics).toEqual(second.metrics)
    expect(first.score[first.winner]).toBe(7)
    expect(first.score[first.winner === 'home' ? 'away' : 'home']).toBeLessThan(
      7,
    )
    expect(first.commands).toBeGreaterThan(0)
  })

  it('100 partidos se juegan sin comandos ilegales', () => {
    const report = simulateMatches(100, 1000)
    console.log('\n' + formatReport(report))

    expect(report.matches).toBe(100)
    expect(report.homeWins + report.awayWins).toBe(100)
    expect(report.attacks).toBeGreaterThan(0)
    expect(report.contestedAttacks).toBeGreaterThan(0)
    expect(report.digs).toBeGreaterThan(0)
    expect(report.attackPoints).toBeGreaterThan(0)
    expect(report.avgRallies).toBeGreaterThan(0)
    expect(report.avgCommands).toBeGreaterThan(0)

    expect(sum(Object.values(report.attackKinds))).toBe(report.attacks)
    expect(sum(Object.values(report.defenseSchemes))).toBe(report.attacks)
    expect(report.attacks).toBe(
      report.blocks + report.digs + report.attackPoints,
    )
    expect(sum(report.digDistribution)).toBe(report.digs)
    expect(report.serves).toBe(
      report.aces + report.receiveErrors + report.receptions,
    )
    expect(sum(report.passDistribution)).toBe(report.receptions)
    expect(sum(report.setDistribution) + report.setErrors).toBe(
      report.receptions + report.digs,
    )
    expect(
      report.blockRate + report.digRate + report.pointRate,
    ).toBeCloseTo(1, 10)
    expect(report.perfectPassRate).toBeGreaterThanOrEqual(0)
    expect(report.perfectPassRate).toBeLessThanOrEqual(1)
    expect(report.contestedRate).toBeLessThanOrEqual(1)
  })

  it('todos los tipos de ataque y esquemas aparecen en una muestra grande', () => {
    const report = simulateMatches(60, 7)
    const kinds: AttackKind[] = [
      'power',
      'placement',
      'quick',
      'pipe',
      'wipe',
      'tip',
    ]
    const schemes: DefenseScheme[] = ['wall', 'spread', 'deep', 'libero']
    for (const kind of kinds) {
      expect(report.attackKinds[kind]).toBeGreaterThan(0)
    }
    for (const scheme of schemes) {
      expect(report.defenseSchemes[scheme]).toBeGreaterThan(0)
    }
  })

  it('el reporte resume las métricas del GDD', () => {
    const text = formatReport(simulateMatches(5, 3))
    expect(text).toContain('Partidos: 5')
    expect(text).toContain('Rallies por partido')
    expect(text).toContain('Duelos con matchup')
    expect(text).toContain('Digs por calidad')
  })
})
