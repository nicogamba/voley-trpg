import { create } from 'zustand'
import {
  chooseCommand,
  createMatch,
  EngineError,
  mulberry32,
  otherSide,
  reduce,
} from '../engine'
import type { Command, EngineEvent, GameState, Side } from '../engine'
import { playSfx, setSfxMuted, unlockAudio } from './sound'

export const PLAYER_SIDE: Side = 'home'

export type Screen = 'title' | 'game'

export const actingSide = (state: GameState): Side | null => {
  if (state.phase === 'MATCH_END') return null
  if (state.phase === 'SERVE') return state.server
  if (state.phase === 'BLOCK_COMMIT') return otherSide(state.possession)
  return state.possession
}

export const isPlayerTurn = (state: GameState): boolean =>
  actingSide(state) === PLAYER_SIDE

type AttackEvent = Extract<EngineEvent, { type: 'ATTACK' }>

type GameStore = {
  game: GameState
  screen: Screen
  tutorial: boolean
  muted: boolean
  lastEvent: EngineEvent | null
  lastAttack: AttackEvent | null
  toast: string | null
  playerPast: GameState[]
  aiRng: () => number
  startGame: (options?: { tutorial?: boolean }) => void
  finishTutorial: () => void
  skipTutorial: () => void
  backToTitle: () => void
  toggleMuted: () => void
  dispatch: (command: Command, actor: 'player' | 'ai') => void
  aiStep: () => void
  undo: () => void
  reset: () => void
  clearToast: () => void
}

const newGame = () => createMatch({ server: PLAYER_SIDE })

const feedback = (events: EngineEvent[]) => {
  const point = events.find((event) => event.type === 'POINT')
  const end = events.find((event) => event.type === 'MATCH_END')
  if (end && end.type === 'MATCH_END') {
    playSfx(end.winner === PLAYER_SIDE ? 'win' : 'lose')
    return
  }
  if (point && point.type === 'POINT') {
    playSfx(point.side === PLAYER_SIDE ? 'point' : 'lose')
    return
  }
  const attack = events.find((event) => event.type === 'ATTACK')
  if (attack && attack.type === 'ATTACK') {
    playSfx(
      attack.resolution.outcome === 'blocked'
        ? 'block'
        : attack.resolution.outcome === 'dig'
          ? 'dig'
          : 'attack',
    )
    return
  }
  const last = events[events.length - 1]
  if (!last) return
  switch (last.type) {
    case 'SERVE':
      playSfx('serve')
      break
    case 'RECEIVE':
      playSfx('receive')
      break
    case 'SET':
      playSfx('set')
      break
    case 'MOVE':
    case 'SHIFT':
      playSfx('move')
      break
  }
}

export const useGame = create<GameStore>((set, get) => ({
  game: newGame(),
  screen: 'title',
  tutorial: false,
  muted: false,
  lastEvent: null,
  lastAttack: null,
  toast: null,
  playerPast: [],
  aiRng: mulberry32(20261026),
  startGame: (options = {}) => {
    unlockAudio()
    playSfx('click')
    set({
      game: newGame(),
      screen: 'game',
      tutorial: options.tutorial ?? false,
      lastEvent: null,
      lastAttack: null,
      toast: null,
      playerPast: [],
      aiRng: mulberry32(Date.now() % 1_000_000),
    })
  },
  finishTutorial: () => {
    set({
      game: newGame(),
      screen: 'game',
      tutorial: false,
      lastEvent: null,
      lastAttack: null,
      toast: null,
      playerPast: [],
      aiRng: mulberry32(Date.now() % 1_000_000),
    })
  },
  skipTutorial: () => {
    playSfx('click')
    set({ tutorial: false })
  },
  backToTitle: () => {
    playSfx('click')
    set({
      game: newGame(),
      screen: 'title',
      tutorial: false,
      lastEvent: null,
      lastAttack: null,
      toast: null,
      playerPast: [],
    })
  },
  toggleMuted: () => {
    const muted = !get().muted
    setSfxMuted(muted)
    set({ muted })
    if (!muted) playSfx('click')
  },
  dispatch: (command, actor) => {
    const current = get().game
    try {
      const result = reduce(current, command)
      const attack = result.events.find(
        (event): event is AttackEvent => event.type === 'ATTACK',
      )
      feedback(result.events)
      set({
        game: result.state,
        lastEvent: result.events[result.events.length - 1] ?? null,
        lastAttack: attack ?? null,
        playerPast:
          actor === 'player'
            ? [...get().playerPast, current].slice(-8)
            : [],
        toast: null,
      })
    } catch (error) {
      playSfx('click')
      set({
        toast:
          error instanceof EngineError
            ? error.message
            : 'Esa acción no es posible.',
      })
    }
  },
  aiStep: () => {
    const { game, aiRng } = get()
    if (game.phase === 'MATCH_END') return
    try {
      const command = chooseCommand(game, aiRng)
      get().dispatch(command, 'ai')
    } catch (error) {
      set({
        toast:
          error instanceof Error ? error.message : 'La IA no encontró jugada.',
      })
    }
  },
  undo: () => {
    const past = get().playerPast
    const previous = past[past.length - 1]
    if (!previous) return
    playSfx('click')
    set({
      game: previous,
      playerPast: past.slice(0, -1),
      toast: null,
      lastEvent: null,
      lastAttack: null,
    })
  },
  reset: () => {
    playSfx('click')
    set({
      game: newGame(),
      lastEvent: null,
      lastAttack: null,
      toast: null,
      playerPast: [],
      aiRng: mulberry32(Date.now() % 1_000_000),
    })
  },
  clearToast: () => set({ toast: null }),
}))
