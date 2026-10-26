import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import Board from '../src/game/Board'
import { Coach } from '../src/game/Tutorial'
import { createMatch } from '../src/engine'

describe('UI', () => {
  it('renderiza la pantalla de título sin errores', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Vóley táctico')
    expect(html).toContain('ZONA')
    expect(html).toContain('Tutorial')
    expect(html).toContain('Partido rápido')
  })

  it('renderiza el tablero con los dos equipos', () => {
    const game = createMatch({ server: 'home' })
    const html = renderToString(
      <Board
        game={game}
        selectedId={null}
        hintIds={new Set()}
        hintCells={new Set()}
        previews={new Map()}
        attackKind={null}
        flashCell={null}
        onCell={() => {}}
      />,
    )
    expect(html).toContain('Rival')
    expect(html).toContain('Vos')
    expect(html).toContain('data-cell="home-0-1"')
  })

  it('muestra la pista del tutorial del saque', () => {
    const game = createMatch({ server: 'home' })
    const html = renderToString(<Coach game={game} onSkip={() => {}} />)
    const text = html.replace(/<!-- -->/g, '')
    expect(text).toContain('Tutorial · rally 1 de 2')
    expect(text).toContain('Tocá una zona del campo rival')
  })
})
