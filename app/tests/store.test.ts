import { describe, expect, it } from 'vitest'
import { createMatch } from '../src/engine'
import { actingSide, isPlayerTurn, PLAYER_SIDE } from '../src/game/store'
import type { GameState } from '../src/engine'

const base = createMatch({ server: 'home', playerSide: 'home' })

const withPhase = (
  phase: GameState['phase'],
  possession: GameState['possession'],
  playerSide: GameState['playerSide'] = 'home',
): GameState => ({ ...base, phase, possession, playerSide })

describe('turnos', () => {
  it('el saque lo actúa el sacador', () => {
    expect(actingSide(base)).toBe('home')
    expect(isPlayerTurn(base)).toBe(true)
    expect(
      isPlayerTurn(createMatch({ server: 'away', playerSide: 'home' })),
    ).toBe(false)
  })

  it('recepción y armado los actúa el equipo en posesión', () => {
    const receiving = withPhase('RECEIVE', 'away')
    expect(actingSide(receiving)).toBe('away')
    expect(isPlayerTurn(receiving)).toBe(false)

    const setting = withPhase('SET', 'home')
    expect(actingSide(setting)).toBe('home')
    expect(isPlayerTurn(setting)).toBe(true)
  })

  it('ataque y defensa los actúa el jugador aunque cambie la posesión', () => {
    expect(actingSide(withPhase('ATTACK', 'home'))).toBe('home')
    expect(actingSide(withPhase('DEFEND', 'away'))).toBe('home')
    expect(isPlayerTurn(withPhase('DEFEND', 'away'))).toBe(true)
  })

  it('respeta un playerSide distinto de home', () => {
    const awayPlayer = withPhase('RECEIVE', 'home', 'away')
    expect(actingSide(awayPlayer)).toBe('home')
    expect(isPlayerTurn(awayPlayer)).toBe(false)
    expect(actingSide(withPhase('ATTACK', 'away', 'away'))).toBe('away')
    expect(isPlayerTurn(withPhase('ATTACK', 'away', 'away'))).toBe(true)
  })

  it('no hay turno cuando el set terminó', () => {
    const ended = withPhase('MATCH_END', 'home')
    expect(actingSide(ended)).toBeNull()
    expect(isPlayerTurn(ended)).toBe(false)
  })

  it('el jugador local es el lado por defecto', () => {
    expect(PLAYER_SIDE).toBe('home')
  })
})
