import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import CourtScreen from '../src/court/CourtScreen'
import {
  beatAt,
  buildTimeline,
  sampleBall,
  samplePlayer,
} from '../src/court/choreography'
import { DEMO_PLAYERS, DEMO_RALLY, INITIAL_BALL } from '../src/court/demo'
import { cell, cellCenter, reaches } from '../src/court/geometry'

import type { BeatSpec } from '../src/court/types'

const timeline = buildTimeline(DEMO_PLAYERS, DEMO_RALLY, INITIAL_BALL)

describe('geometría de la cancha v2', () => {
  it('reparte 12 celdas por lado y el centro cae dentro de la cancha', () => {
    for (const side of ['home', 'away'] as const) {
      for (const row of [0, 1, 2] as const) {
        for (const col of [0, 1, 2, 3] as const) {
          const center = cellCenter(cell(side, row, col))
          expect(center.x).toBeGreaterThan(0)
          expect(center.x).toBeLessThan(360)
          expect(center.y).toBeGreaterThan(0)
          expect(center.y).toBeLessThan(484)
        }
      }
    }
  })

  it('alcanza la celda propia y las vecinas, no la diagonal lejana', () => {
    const from = cell('home', 1, 1)
    expect(reaches(from, from)).toBe(true)
    expect(reaches(from, cell('home', 0, 1))).toBe(true)
    expect(reaches(from, cell('home', 2, 2))).toBe(true)
    expect(reaches(from, cell('home', 0, 3))).toBe(false)
    expect(reaches(from, cell('away', 1, 1))).toBe(false)
  })
})

describe('coreografía del rally demo', () => {
  it('encadena los beats sin huecos y suma la duración total', () => {
    let cursor = 0
    for (const beat of timeline.beats) {
      expect(beat.start).toBe(cursor)
      expect(beat.end).toBeGreaterThan(beat.start)
      cursor = beat.end
    }
    const total = DEMO_RALLY.reduce((sum, beat) => sum + beat.duration, 0)
    expect(timeline.total).toBe(total)
    expect(cursor).toBe(total)
  })

  it('no regala un punto antes de tiempo', () => {
    const early = beatAt(timeline, -50)
    expect(early?.kind).toBe('serve')
    expect(early?.point).toBeUndefined()
    expect(beatAt(timeline, 0)?.kind).toBe('serve')
    expect(beatAt(timeline, 1000)?.kind).toBe('receive')
  })

  it('cierra con el punto de Argentina', () => {
    const last = beatAt(timeline, timeline.total - 1)
    expect(last?.kind).toBe('point')
    expect(last?.point).toBe('home')
    expect(beatAt(timeline, timeline.total + 500)?.point).toBe('home')
  })

  it('mueve la pelota de una celda a otra con arco', () => {
    const first = timeline.balls[0]
    const start = sampleBall(timeline, first.start)
    const middle = sampleBall(timeline, first.start + first.duration / 2)
    const end = sampleBall(timeline, first.start + first.duration)
    expect(start.z).toBeCloseTo(first.zFrom)
    expect(end.z).toBeCloseTo(first.zTo)
    expect(middle.z).toBeGreaterThan(Math.max(first.zFrom, first.zTo))
    expect(end.groundX).toBeCloseTo(first.to.x)
    expect(end.groundY).toBeCloseTo(first.to.y)
  })

  it('mantiene a cada jugador en su celda hasta que le toca moverse', () => {
    const molina = DEMO_PLAYERS.find((player) => player.name === 'MOLINA')
    expect(molina).toBeDefined()
    const atStart = samplePlayer(timeline, molina!.id, 0)
    const home = cellCenter(molina!.cell)
    expect(atStart.x).toBeCloseTo(home.x)
    expect(atStart.y).toBeCloseTo(home.y)

    const middle = DEMO_PLAYERS.find((player) => player.name === 'QUINTANA')!
    const before = samplePlayer(timeline, middle.id, 2200)
    const after = samplePlayer(timeline, middle.id, 3000)
    const blockCell = cellCenter(cell('home', 0, 2))
    expect(before.x).toBeCloseTo(cellCenter(middle.cell).x)
    expect(after.x).toBeCloseTo(blockCell.x)
    expect(after.y).toBeCloseTo(blockCell.y)
  })

  it('anima un movimiento suelto y lleva la pelota con el sacador', () => {
    const molina = DEMO_PLAYERS.find((player) => player.name === 'MOLINA')!
    const target = cell('home', 1, 3)
    const move: BeatSpec[] = [
      {
        kind: 'move',
        duration: 320,
        caption: 'MUEVE · MOLINA',
        moves: [
          {
            playerId: molina.id,
            to: target,
            duration: 300,
            pose: 'run',
          },
        ],
        ball: {
          to: target,
          arc: 10,
          zFrom: 46,
          zTo: 46,
          duration: 300,
        },
      },
    ]
    const moveTimeline = buildTimeline(DEMO_PLAYERS, move, molina.cell)
    const origin = cellCenter(molina.cell)
    const destination = cellCenter(target)

    const start = samplePlayer(moveTimeline, molina.id, 0)
    const middle = samplePlayer(moveTimeline, molina.id, 150)
    const end = samplePlayer(moveTimeline, molina.id, 320)

    expect(start.x).toBeCloseTo(origin.x)
    expect(middle.pose).toBe('run')
    expect(middle.moving).toBe(true)
    expect(end.x).toBeCloseTo(destination.x)
    expect(end.pose).toBe('idle')

    const ballEnd = sampleBall(moveTimeline, 320)
    expect(ballEnd.groundX).toBeCloseTo(destination.x)
    expect(ballEnd.groundY).toBeCloseTo(destination.y)
    expect(ballEnd.z).toBeCloseTo(46)
  })

  it('deja una cancha quieta cuando el guion está vacío', () => {
    const still = buildTimeline(DEMO_PLAYERS, [], INITIAL_BALL)
    expect(still.total).toBe(0)
    expect(still.beats).toHaveLength(0)
    expect(still.balls).toHaveLength(0)
    expect(beatAt(still, 0)).toBeNull()

    const molina = DEMO_PLAYERS.find((player) => player.name === 'MOLINA')!
    const sample = samplePlayer(still, molina.id, 500)
    expect(sample.pose).toBe('idle')
    expect(sample.x).toBeCloseTo(cellCenter(molina.cell).x)
    expect(sampleBall(still, 500).z).toBe(46)
  })
})

describe('pantalla de cancha v2', () => {
  it('renderiza HUD, caption y controles', () => {
    const html = renderToString(<CourtScreen onBack={() => {}} />)
    expect(html).toContain('ARG')
    expect(html).toContain('BRA')
    expect(html).toContain('SAQUE · MOLINA')
    expect(html).toContain('REPETIR RALLY')
    expect(html).toContain('ORDENAR')
    expect(html).toContain('VOLVER')
    expect(html).toContain('court-canvas')
  })
})
