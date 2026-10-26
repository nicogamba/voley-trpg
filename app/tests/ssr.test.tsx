import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import Board from '../src/game/Board'
import CommandMenu from '../src/game/CommandMenu'
import DuelCutIn from '../src/game/DuelCutIn'
import { Coach } from '../src/game/Tutorial'
import {
  cell,
  cellKey,
  createMatch,
  mulberry32,
  reduce,
  tellsFor,
  withHiddenChoice,
} from '../src/engine'
import type {
  AttackKind,
  Cell,
  Command,
  DefenseScheme,
  GameState,
} from '../src/engine'

const run = (state: GameState, command: Command): GameState =>
  reduce(state, command).state

const withScheme = (state: GameState, scheme: DefenseScheme): GameState => ({
  ...state,
  hiddenChoice: { type: 'defense', side: 'away', scheme },
})

const toHomeAttack = (): GameState => {
  let state = createMatch({ server: 'away', playerSide: 'home' })
  state = run(state, { type: 'SERVE', target: cell('home', 1, 1) })
  state = run(state, { type: 'RECEIVE', playerId: 'home-libero' })
  state = run(state, {
    type: 'SET',
    setterId: 'home-setter',
    targetId: 'home-middle',
  })
  return withHiddenChoice(state, mulberry32(1))
}

const toHomeDefense = (
  kind: AttackKind,
  target: Cell,
): GameState => {
  let state = createMatch({ server: 'home', playerSide: 'home' })
  state = run(state, { type: 'SERVE', target: cell('away', 1, 1) })
  state = run(state, { type: 'RECEIVE', playerId: 'away-libero' })
  state = run(state, {
    type: 'SET',
    setterId: 'away-setter',
    targetId: 'away-middle',
  })
  return {
    ...state,
    hiddenChoice: {
      type: 'attack',
      side: 'away',
      plan: { kind, target },
    },
  }
}

const noop = () => {}

describe('UI', () => {
  it('renderiza la pantalla de título sin errores', () => {
    const html = renderToString(<App />)
    expect(html).toContain('VÓLEY TÁCTICO POR TURNOS')
    expect(html).toContain('ZONA')
    expect(html).toContain('JUGAR EL TUTORIAL')
    expect(html).toContain('PARTIDO RÁPIDO')
    expect(html).toContain('CÓMO SE JUEGA')
    expect(html).toContain('El rival ya eligió.')
  })

  it('renderiza el tablero con los dos equipos y la zona objetivo', () => {
    const game = createMatch({ server: 'home' })
    const targets = new Set([cellKey(cell('home', 0, 0))])
    const html = renderToString(
      <Board
        game={game}
        targets={targets}
        activeId={null}
        flashCell={null}
        onCell={noop}
      />,
    )
    expect(html).toContain('RIVAL')
    expect(html).toContain('VOS')
    expect(html).toContain('data-cell="home-0-1"')
    expect(html).toContain('target-cell')
    expect(html).toContain('objetivo')
  })

  it('no marca objetivos cuando el jugador no puede tocar el tablero', () => {
    const game = createMatch({ server: 'home' })
    const html = renderToString(
      <Board
        game={game}
        targets={new Set()}
        activeId={null}
        flashCell={null}
        onCell={noop}
      />,
    )
    expect(html).not.toContain('target-cell')
  })

  it('muestra la pista del tutorial del saque', () => {
    const game = createMatch({ server: 'home' })
    const html = renderToString(<Coach game={game} onSkip={noop} />)
    const text = html.replace(/<!-- -->/g, '')
    expect(text).toContain('TUTORIAL · RALLY 1 DE 2')
    expect(text).toContain('Tocá una zona del campo rival')
  })

  it('la ventana de ataque muestra pistas pero no la defensa oculta', () => {
    const game = withScheme(toHomeAttack(), 'wall')
    const html = renderToString(
      <CommandMenu
        game={game}
        tells={tellsFor(game)}
        attackKind={null}
        onAttackKind={noop}
        onCommand={noop}
        onRestart={noop}
      />,
    )
    expect(html).toContain('TU JUGADA')
    expect(html).toContain('PISTA DEL RIVAL')
    expect(html).toContain('Dos manos se levantan en la red.')
    expect(html).not.toContain('Muro')
    expect(html).not.toContain('DIG Q')
    expect(html).not.toContain('PUNTO')
  })

  it('la ventana de defensa muestra los cuatro esquemas y la pista rival', () => {
    const game = toHomeDefense('quick', cell('home', 0, 1))
    const html = renderToString(
      <CommandMenu
        game={game}
        tells={tellsFor(game)}
        attackKind={null}
        onAttackKind={noop}
        onCommand={noop}
        onRestart={noop}
      />,
    )
    expect(html).toContain('TU DEFENSA')
    expect(html).toContain('El central va por el medio, rápido.')
    expect(html).toContain('Rápido')
    expect(html).toContain('zona 3')
    expect(html).toContain('Muro')
    expect(html).toContain('Bloqueo abierto')
    expect(html).toContain('Defensa profunda')
    expect(html).toContain('Líbero atento')
    expect(html).not.toContain('DIG Q')
    expect(html).not.toContain('PUNTO')
  })

  it('el cut-in revela ataque, esquema y resultado', () => {
    const before = withScheme(toHomeAttack(), 'spread')
    const result = reduce(before, {
      type: 'ATTACK',
      playerId: 'home-middle',
      kind: 'power',
      target: cell('away', 0, 0),
    })
    const event = result.events.find((item) => item.type === 'ATTACK')
    expect(event).toBeDefined()
    if (event?.type !== 'ATTACK') throw new Error('Sin ataque')
    const html = renderToString(
      <DuelCutIn
        game={before}
        duel={{
          event,
          rallyNumber: before.rallyNumber,
          score: result.state.score,
        }}
        onClose={noop}
      />,
    )
    const text = html.replace(/<!-- -->/g, '')
    expect(text).toContain('DUELO OCULTO')
    expect(text).toContain('VS')
    expect(text).toContain('RALLY 1')
    expect(text).toContain('1 — 0')
    expect(text).toContain('Potencia')
    expect(text).toContain('Bloqueo abierto')
    expect(text).toContain('Central')
  })
})
