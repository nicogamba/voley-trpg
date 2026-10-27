import type { BeatSpec, CourtCell, CourtPlayer, CourtTeam } from './types'
import { cell } from './geometry'
import { TEAMS, buildRoster } from './teams'

export const DEMO_TEAMS: Record<'home' | 'away', CourtTeam> = {
  home: TEAMS.arg,
  away: TEAMS.bra,
}

export const DEMO_PLAYERS: CourtPlayer[] = [
  ...buildRoster('arg', 'home'),
  ...buildRoster('bra', 'away'),
]

export const INITIAL_BALL: CourtCell = cell('home', 2, 3)

/**
 * Rally de demostración: Argentina saca, Brasil responde con un rápido,
 * Sosa defiende y Argentina cierra el punto. Sirve para validar movimiento,
 * arcos de pelota, tiempos y lectura en pantalla chica.
 */
export const DEMO_RALLY: BeatSpec[] = [
  {
    kind: 'serve',
    duration: 900,
    caption: 'SAQUE · MOLINA',
    actorId: 'home-opposite',
    pose: 'serve',
    ball: {
      to: cell('away', 2, 2),
      arc: 52,
      zFrom: 46,
      zTo: 22,
      duration: 620,
      delay: 240,
      kind: 'serve',
    },
    fx: 'hit',
  },
  {
    kind: 'receive',
    duration: 700,
    caption: 'RECEPCIÓN · SOUZA',
    actorId: 'away-libero',
    pose: 'receive',
    ball: {
      to: cell('away', 0, 2),
      arc: 32,
      zFrom: 20,
      zTo: 24,
      duration: 500,
      delay: 100,
      kind: 'pass',
    },
  },
  {
    kind: 'set',
    duration: 650,
    caption: 'ARMADO · RIBEIRO',
    actorId: 'away-setter',
    pose: 'set',
    ball: {
      to: cell('away', 0, 3),
      arc: 28,
      zFrom: 24,
      zTo: 26,
      duration: 420,
      delay: 100,
      kind: 'set',
    },
  },
  {
    kind: 'spike',
    duration: 900,
    caption: 'REMATE · COSTA',
    actorId: 'away-middle',
    pose: 'spike',
    moves: [
      {
        playerId: 'home-middle',
        to: cell('home', 0, 2),
        duration: 460,
        jump: 18,
        pose: 'block',
      },
      {
        playerId: 'home-setter',
        to: cell('home', 0, 1),
        duration: 420,
        jump: 16,
        pose: 'block',
      },
      {
        playerId: 'home-libero',
        to: cell('home', 1, 2),
        duration: 540,
        pose: 'run',
      },
    ],
    ball: {
      to: cell('home', 1, 2),
      arc: 8,
      zFrom: 34,
      zTo: 16,
      duration: 430,
      delay: 220,
      kind: 'spike',
    },
    fx: 'hit',
  },
  {
    kind: 'dig',
    duration: 750,
    caption: '¡DEFENSA · SOSA!',
    actorId: 'home-libero',
    pose: 'dig',
    ball: {
      to: cell('home', 0, 1),
      arc: 42,
      zFrom: 14,
      zTo: 24,
      duration: 520,
      delay: 110,
      kind: 'pass',
    },
    fx: 'hit',
  },
  {
    kind: 'set',
    duration: 650,
    caption: 'ARMADO · PEREYRA',
    actorId: 'home-setter',
    pose: 'set',
    ball: {
      to: cell('home', 0, 2),
      arc: 26,
      zFrom: 24,
      zTo: 26,
      duration: 420,
      delay: 100,
      kind: 'set',
    },
  },
  {
    kind: 'spike',
    duration: 850,
    caption: 'REMATE · QUINTANA',
    actorId: 'home-middle',
    pose: 'spike',
    moves: [
      {
        playerId: 'away-libero',
        to: cell('away', 1, 1),
        duration: 460,
        pose: 'run',
      },
      {
        playerId: 'away-middle',
        to: cell('away', 0, 2),
        duration: 380,
        jump: 18,
        pose: 'block',
      },
    ],
    ball: {
      to: cell('away', 1, 0),
      arc: 6,
      zFrom: 34,
      zTo: 0,
      duration: 400,
      delay: 220,
      kind: 'spike',
    },
    fx: 'hit',
  },
  {
    kind: 'point',
    duration: 1500,
    caption: 'PUNTO DE ARGENTINA · 1-0',
    point: 'home',
    moves: [
      {
        playerId: 'home-setter',
        to: cell('home', 0, 1),
        duration: 620,
        jump: 5,
        pose: 'celebrate',
      },
      {
        playerId: 'home-middle',
        to: cell('home', 0, 0),
        duration: 620,
        jump: 5,
        pose: 'celebrate',
      },
      {
        playerId: 'home-opposite',
        to: cell('home', 2, 3),
        duration: 620,
        jump: 5,
        pose: 'celebrate',
      },
      {
        playerId: 'home-libero',
        to: cell('home', 2, 1),
        duration: 620,
        jump: 5,
        pose: 'celebrate',
      },
    ],
    fx: 'floor',
  },
]
