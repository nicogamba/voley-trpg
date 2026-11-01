import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import CourtScreen from '../src/court/CourtScreen'
import CourtCutIn from '../src/court/CourtCutIn'
import CourtDuelModal from '../src/court/CourtDuelModal'
import CourtReceptionModal from '../src/court/CourtReceptionModal'
import LadderScreen from '../src/court/LadderScreen'
import { LADDER, EMPTY_PROGRESS } from '../src/court/ladder'
import {
  beatAt,
  buildTimeline,
  sampleBall,
  samplePlayer,
} from '../src/court/choreography'
import { DEMO_PLAYERS, DEMO_RALLY, DEMO_TEAMS, INITIAL_BALL } from '../src/court/demo'
import { cell, cellCenter, reaches, zoneLabel, zoneOf } from '../src/court/geometry'
import {
  BALL_SHEET,
  PLAYER_SHEETS,
  PORTRAITS,
} from '../src/court/sprites'

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

  it('numera doce zonas por lado desde la red hasta el fondo', () => {
    expect(zoneOf('home', 0, 0)).toBe(1)
    expect(zoneOf('home', 0, 3)).toBe(4)
    expect(zoneOf('home', 1, 0)).toBe(5)
    expect(zoneOf('home', 1, 3)).toBe(8)
    expect(zoneOf('home', 2, 0)).toBe(9)
    expect(zoneOf('home', 2, 3)).toBe(12)
  })

  it('gira la numeración del rival 180 grados', () => {
    expect(zoneOf('away', 2, 0)).toBe(12)
    expect(zoneOf('away', 2, 3)).toBe(9)
    expect(zoneOf('away', 1, 0)).toBe(8)
    expect(zoneOf('away', 1, 3)).toBe(5)
    expect(zoneOf('away', 0, 0)).toBe(4)
    expect(zoneOf('away', 0, 3)).toBe(1)
  })

  it('no repite zonas entre las 24 celdas', () => {
    const home = new Set<number>()
    const away = new Set<number>()
    for (const row of [0, 1, 2] as const) {
      for (const col of [0, 1, 2, 3] as const) {
        home.add(zoneOf('home', row, col))
        away.add(zoneOf('away', row, col))
      }
    }
    expect(home.size).toBe(12)
    expect(away.size).toBe(12)
    expect(zoneLabel(cell('home', 2, 3))).toBe('zona 12')
    expect(zoneLabel(cell('away', 0, 3))).toBe('zona 1')
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
    const html = renderToString(
      <CourtScreen
        stage={LADDER[0]}
        muted={false}
        onToggleMuted={() => {}}
        onBack={() => {}}
        onFinish={() => {}}
      />,
    )
    expect(html).toContain('ARG')
    expect(html).toContain('CHI')
    expect(html).toContain('CHILE')
    expect(html).toContain('EMPEZAR PARTIDO')
    expect(html).toContain('VOLVER')
    expect(html).toContain('ELEGÍ FORMACIÓN')
    expect(html).toContain('BASE')
    expect(html).toContain('RECEPCIÓN')
    expect(html).toContain('BLOQUEO')
    expect(html).toContain('A 5')
    expect(html).toContain('DEBUT')
    expect(html).toContain('court-canvas')
    expect(html).not.toContain('Zona 1,')
    expect(html).not.toContain('court-hit')
  })
})

describe('escalera de países', () => {
  it('muestra la primera etapa y el plantel rival', () => {
    const html = renderToString(
      <LadderScreen
        progress={EMPTY_PROGRESS}
        onPlay={() => {}}
        onBack={() => {}}
        onReset={() => {}}
      />,
    )
    expect(html).toContain('GIRA MUNDIAL')
    expect(html).toContain('ETAPA 1/5')
    expect(html).toContain('CHILE')
    expect(html).toContain('GRIMALT')
    expect(html).toContain('JUGAR CON CHI')
  })

  it('muestra el formato CT1 con el marcador inicial', () => {
    const html = renderToString(
      <LadderScreen
        progress={EMPTY_PROGRESS}
        ct1
        onPlay={() => {}}
        onBack={() => {}}
        onReset={() => {}}
      />,
    )
    expect(html).toContain('SET A 25 · INICIO 18-18')
    expect(html).toContain('ROJAS')
    expect(html).toContain('VIDAL')
  })

  it('corona la gira al completar las cinco etapas', () => {
    const html = renderToString(
      <LadderScreen
        progress={{ stage: LADDER.length, cleared: LADDER.length, attempts: 0, lastResult: 'win' }}
        onPlay={() => {}}
        onBack={() => {}}
        onReset={() => {}}
      />,
    )
    expect(html).toContain('ARGENTINA CAMPEÓN')
    expect(html).toContain('VOLVER A JUGAR')
  })

  it('marca la final como etapa decisiva', () => {
    const html = renderToString(
      <LadderScreen
        progress={{ stage: 4, cleared: 4, attempts: 0, lastResult: null }}
        onPlay={() => {}}
        onBack={() => {}}
        onReset={() => {}}
      />,
    )
    expect(html).toContain('BRASIL')
    expect(html).toContain('JUGAR LA FINAL')
  })
})

describe('cut-in de duelo', () => {
  const cutin = {
    kind: 'serve' as const,
    leftId: 'home-opposite',
    rightId: 'away-libero',
    leftLabel: 'SAQUE',
    rightLabel: 'RECEPCIÓN',
    move: 'SAQUE',
  }

  it('viaja con el beat hasta la línea de tiempo', () => {
    const script: BeatSpec[] = [
      {
        ...DEMO_RALLY[1]!,
        cutin,
      },
    ]
    const cutTimeline = buildTimeline(DEMO_PLAYERS, script, INITIAL_BALL)
    expect(beatAt(cutTimeline, 100)?.cutin).toEqual(cutin)
  })

  it('muestra los dos retratos y el VS', () => {
    const html = renderToString(
      <CourtCutIn
        cutin={cutin}
        players={DEMO_PLAYERS}
        duration={800}
        onSkip={() => {}}
      />,
    )
    expect(html).toContain('SAQUE')
    expect(html).toContain('RECEPCIÓN')
    expect(html).toContain('MOLINA')
    expect(html).toContain('SOUZA')
    expect(html).toContain('VS')
  })
})

describe('situación de recepción', () => {
  it('muestra el saque rival, la pista y los candidatos con zona', () => {
    const home = DEMO_PLAYERS.filter((player) => player.side === 'home')
    const server = DEMO_PLAYERS.find(
      (player) => player.side === 'away' && player.classId === 'opposite',
    )!
    const html = renderToString(
      <CourtReceptionModal
        players={home}
        server={server}
        opponent={DEMO_TEAMS.away}
        narration="Soto toma la pelota."
        tell={{ text: 'El saque apunta a la zona 9.', truthful: true }}
        onConfirm={() => {}}
      />,
    )
    expect(html).toContain('RECEPCIÓN')
    expect(html).toContain('SAQUE RIVAL')
    expect(html).toContain('El saque apunta a la zona 9.')
    expect(html).toContain('SOSA')
    expect(html).toContain('RECIBIR')
    expect(html).toContain('Z')
  })
})

describe('ventana de duelo C', () => {
  it('muestra jugador, técnica y costo en ataque', () => {
    const molina = DEMO_PLAYERS.find((player) => player.id === 'home-opposite')!
    const html = renderToString(
      <CourtDuelModal
        mode="attack"
        players={[molina]}
        opponent={DEMO_TEAMS.away}
        label="POTENCIA"
        detail="ZONA 4 · 2 EN"
        resourceLabel="ENERGÍA"
        resourceValue={3}
        baseCost={2}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(html).toContain('DUELO')
    expect(html).toContain('ATAQUE')
    expect(html).toContain('MARTILLO')
    expect(html).toContain('COMETA')
    expect(html).toContain('ATACAR')
    expect(html).toContain('ENERGÍA')
  })

  it('muestra la técnica defensiva y el estado por rally', () => {
    const sosa = DEMO_PLAYERS.find((player) => player.id === 'home-libero')!
    const html = renderToString(
      <CourtDuelModal
        mode="defense"
        players={[sosa]}
        opponent={DEMO_TEAMS.away}
        label="LÍBERO"
        detail="LEE LAS MANOS"
        resourceLabel="TÉCNICA"
        resourceValue={1}
        baseCost={0}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(html).toContain('DEFENSA')
    expect(html).toContain('ZAMBULLIDA')
    expect(html).toContain('LECTURA')
    expect(html).toContain('TÉCNICA')
    expect(html).toContain('LISTA')
    expect(html).toContain('1 por rally')
  })
})

describe('arte de los jugadores', () => {
  const teams = ['arg', 'chi', 'ita', 'jpn', 'usa', 'bra']
  const classes = ['setter', 'middle', 'opposite', 'libero']

  it('tiene una hoja por equipo y clase', () => {
    expect(Object.keys(PLAYER_SHEETS)).toHaveLength(teams.length * classes.length)
    for (const team of teams) {
      for (const classId of classes) {
        expect(PLAYER_SHEETS[`${team}-${classId}`]).toBeTruthy()
      }
    }
    expect(BALL_SHEET).toBeTruthy()
  })

  it('tiene retratos para cada lado y clase', () => {
    expect(Object.keys(PORTRAITS)).toHaveLength(8)
    for (const side of ['home', 'away']) {
      for (const classId of classes) {
        expect(PORTRAITS[`${side}-${classId}`]).toBeTruthy()
      }
    }
  })
})
