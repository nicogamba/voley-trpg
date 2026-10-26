import { create } from 'zustand'
import {
  chooseCommand,
  createMatch,
  EngineError,
  mulberry32,
  reduce,
  withHiddenChoice,
} from '../engine'
import type { Command, EngineEvent, GameState, Side } from '../engine'
import { playSfx, setSfxMuted, unlockAudio } from './sound'

export const PLAYER_SIDE: Side = 'home'

export type Screen = 'title' | 'game'

export const actingSide = (state: GameState): Side | null => {
  if (state.phase === 'MATCH_END') return null
  if (state.phase === 'SERVE') return state.server
  if (state.phase === 'ATTACK' || state.phase === 'DEFEND') {
    return state.playerSide
  }
  return state.possession
}

export const isPlayerTurn = (state: GameState): boolean =>
  actingSide(state) === state.playerSide

type AttackEvent = Extract<EngineEvent, { type: 'ATTACK' }>

export type DuelReveal = {
  event: AttackEvent
  rallyNumber: number
  score: Record<Side, number>
}

type GameStore = {
  game: GameState
  screen: Screen
  tutorial: boolean
  muted: boolean
  lastEvent: EngineEvent | null
  duel: DuelReveal | null
  toast: string | null
  aiRng: () => number
  startGame: (options?: { tutorial?: boolean }) => void
  finishTutorial: () => void
  skipTutorial: () => void
  backToTitle: () => void
  toggleMuted: () => void
  dispatch: (command: Command, actor: 'player' | 'ai') => void
  aiStep: () => void
  reset: () => void
  clearToast: () => void
  dismissDuel: () => void
}

const newGame = () =>
  createMatch({ server: PLAYER_SIDE, playerSide: PLAYER_SIDE })

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
  }
}

export const useGame = create<GameStore>((set, get) => ({
  game: newGame(),
  screen: 'title',
  tutorial: false,
  muted: false,
  lastEvent: null,
  duel: null,
  toast: null,
  aiRng: mulberry32(20261026),
  startGame: (options = {}) => {
    unlockAudio()
    playSfx('click')
    set({
      game: newGame(),
      screen: 'game',
      tutorial: options.tutorial ?? false,
      lastEvent: null,
      duel: null,
      toast: null,
      aiRng: mulberry32(Date.now() % 1_000_000),
    })
  },
  finishTutorial: () => {
    set({
      game: newGame(),
      screen: 'game',
      tutorial: false,
      lastEvent: null,
      duel: null,
      toast: null,
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
      duel: null,
      toast: null,
    })
  },
  toggleMuted: () => {
    const muted = !get().muted
    setSfxMuted(muted)
    set({ muted })
    if (!muted) playSfx('click')
  },
  dispatch: (command, actor) => {
    const { game, aiRng } = get()
    try {
      const result = reduce(game, command)
      const next = withHiddenChoice(result.state, aiRng)
      const attack = result.events.find(
        (event): event is AttackEvent => event.type === 'ATTACK',
      )
      feedback(result.events)
      set({
        game: next,
        lastEvent: result.events[result.events.length - 1] ?? null,
        duel: attack
          ? {
              event: attack,
              rallyNumber: game.rallyNumber,
              score: { ...next.score },
            }
          : null,
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
    void actor
  },
  aiStep: () => {
    const { game, aiRng } = get()
    if (game.phase === 'MATCH_END') return
    if (isPlayerTurn(game)) return
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
  reset: () => {
    playSfx('click')
    set({
      game: newGame(),
      lastEvent: null,
      duel: null,
      toast: null,
      aiRng: mulberry32(Date.now() % 1_000_000),
    })
  },
  clearToast: () => set({ toast: null }),
  dismissDuel: () => set({ duel: null }),
}))
