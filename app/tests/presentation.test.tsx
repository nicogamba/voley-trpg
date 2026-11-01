import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DEMO_PLAYERS, DEMO_TEAMS } from '../src/court/demo'
import { LADDER } from '../src/court/ladder'
import { TEAM_PORTRAITS, teamPortraitFor } from '../src/court/sprites'
import ActionFrame from '../src/presentation/ActionFrame'
import CommandBox from '../src/presentation/CommandBox'
import CommentBox from '../src/presentation/CommentBox'
import Ct1Screen from '../src/presentation/Ct1Screen'
import type {
  ActionFrameSpec,
  CommentaryLine,
  CommandOption,
} from '../src/presentation/types'

const line: CommentaryLine = {
  speaker: 'comentador',
  expression: 'excited',
  text: '¡Qué remate de Molina!',
}

const options: CommandOption[] = [
  {
    id: 'power',
    label: 'POTENCIA',
    note: '2 EN · FONDO',
    actor: DEMO_PLAYERS[2],
  },
  {
    id: 'placement',
    label: 'COLOCACIÓN',
    note: '0 EN · FONDO',
    actor: DEMO_PLAYERS[2],
  },
]

const frame: ActionFrameSpec = {
  mode: 'result',
  actorId: 'home-opposite',
  banner: 'ARG',
  stamp: '¡PUNTO!',
  pose: 'celebrate',
  effect: 'flash',
  tone: 'home',
}

describe('presentación CT1', () => {
  it('renderiza la pantalla partida con el saque rival y el marcador 17-19', () => {
    const html = renderToString(
      <Ct1Screen
        stage={LADDER[LADDER.length - 1]}
        muted
        onBack={() => {}}
        onFinish={() => {}}
      />,
    )
    expect(html).toContain('ct1-screen')
    expect(html).toContain('ct1-scoreboard')
    expect(html).toContain('ct1-stage')
    expect(html).toContain('ct1-bottom')
    expect(html).toContain('SET DECISIVO')
    expect(html).toContain('COMIENZA EL PARTIDO')
    expect(html).toContain('SAQUE LOCAL')
    expect(html).toContain('16')
    expect(html).toContain('20')
    expect(html).toContain('ARG')
    expect(html).toContain('BRA')
    expect(html).toContain('NANDO')
    expect(html).toContain('COMPLETAR')
    expect(html).toContain('ct1-frame-image')
    expect(html).toContain('data-text')
  })

  it('renderiza el menú de comandos con stats y confirmación', () => {
    const html = renderToString(
      <CommandBox
        title="TU ATAQUE"
        hint="PISTA: Bloqueo a la red."
        options={options}
        onSelect={() => {}}
        tension={60}
        muted
      />,
    )
    expect(html).toContain('TU ATAQUE')
    expect(html).toContain('PISTA: Bloqueo a la red.')
    expect(html).toContain('POTENCIA')
    expect(html).toContain('COLOCACIÓN')
    expect(html).toContain('MOLINA')
    expect(html).toContain('OPUESTO')
    expect(html).toContain('T2')
    expect(html).toContain('P5')
    expect(html).toContain('ELEGIR')
    expect(html).toContain('ct1-tension')
    expect(html).toContain('60')
  })

  it('renderiza el relator, la secuencia y el botón de completar', () => {
    const html = renderToString(
      <CommentBox
        line={line}
        onNext={() => {}}
        title="REMATE"
        trail={['SAQUE', 'REMATE']}
        log={['El rival sacó.']}
        muted
      />,
    )
    expect(html).toContain('NANDO')
    expect(html).toContain('RELATOR')
    expect(html).toContain('data-text="¡Qué remate de Molina!"')
    expect(html).toContain('ct1-trail')
    expect(html).toContain('SAQUE')
    expect(html).toContain('REMATE')
    expect(html).toContain('ct1-log')
    expect(html).toContain('El rival sacó.')
    expect(html).toContain('COMPLETAR')
  })

  it('renderiza el cuadro de acción con banner, sello y sprite', () => {
    const html = renderToString(
      <ActionFrame
        frame={frame}
        players={DEMO_PLAYERS}
        teams={DEMO_TEAMS}
        muted
      />,
    )
    expect(html).toContain('ARG')
    expect(html).toContain('¡PUNTO!')
    expect(html).toContain('MOLINA')
    expect(html).toContain('ct1-sprite')
    expect(html).toContain('ct1-frame-stamp')
  })

  it('tiene retratos propios por equipo y rol', () => {
    expect(TEAM_PORTRAITS['arg-setter']).toBeDefined()
    expect(TEAM_PORTRAITS['bra-libero']).toBeDefined()
    expect(TEAM_PORTRAITS['arg-wing-1']).toBeDefined()
    expect(TEAM_PORTRAITS['bra-wing-2']).toBeDefined()
    expect(teamPortraitFor('arg', 'opposite')).toBeDefined()
    expect(teamPortraitFor('bra', 'middle')).toBeDefined()
  })

  it('usa el plano de impacto cuando la escena trae un shot', () => {
    const html = renderToString(
      <ActionFrame
        frame={{
          mode: 'closeup',
          shot: 'serve',
          banner: 'TU SAQUE',
          effect: 'speed',
        }}
        players={DEMO_PLAYERS}
        teams={DEMO_TEAMS}
        muted
      />,
    )
    expect(html).toContain('ct1-frame-image')
    expect(html).toContain('TU SAQUE')
    expect(html).not.toContain('ct1-sprite')
  })
})
