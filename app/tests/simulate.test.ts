import { describe, expect, it } from 'vitest'
import { playMatch, simulateMatches, formatReport } from '../src/engine/simulate'

describe('simulador', () => {
  it('un partido termina a 7 y es reproducible', () => {
    const first = playMatch(42)
    const second = playMatch(42)
    expect(first.winner).toBe(second.winner)
    expect(first.score).toEqual(second.score)
    expect(first.commands).toBe(second.commands)
    expect(first.score[first.winner]).toBe(7)
    expect(first.score[first.winner === 'home' ? 'away' : 'home']).toBeLessThan(7)
  })

  it('100 partidos se juegan sin comandos ilegales', () => {
    const report = simulateMatches(100, 1000)
    console.log('\n' + formatReport(report))
    expect(report.matches).toBe(100)
    expect(report.homeWins + report.awayWins).toBe(100)
    expect(report.attacks).toBeGreaterThan(0)
    expect(report.contestedAttacks).toBeGreaterThan(0)
    expect(report.blocks).toBeGreaterThanOrEqual(0)
    expect(report.digs).toBeGreaterThan(0)
    expect(report.attackPoints).toBeGreaterThan(0)
    expect(report.avgRallies).toBeGreaterThan(0)
    expect(report.avgCommands).toBeLessThan(3000)
  })

  it('las métricas de resolución quedan dentro de rangos razonables', () => {
    const report = simulateMatches(300, 7)
    expect(report.blockRate).toBeGreaterThanOrEqual(0)
    expect(report.blockRate).toBeLessThanOrEqual(1)
    expect(report.digRate).toBeGreaterThanOrEqual(0)
    expect(report.digRate).toBeLessThanOrEqual(1)
    expect(report.pointRate).toBeGreaterThanOrEqual(0)
    expect(report.pointRate).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        report.blockRate + report.digRate + report.pointRate - 1,
      ),
    ).toBeLessThan(1e-9)
  })
})
