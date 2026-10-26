import { useEffect, useMemo, useRef, useState } from 'react'
import Board from './game/Board'
import CommandMenu from './game/CommandMenu'
import DuelCutIn from './game/DuelCutIn'
import { isPlayerTurn, useGame } from './game/store'
import {
  Coach,
  HelpSheet,
  TitleScreen,
  TutorialComplete,
} from './game/Tutorial'
import {
  AP_MAX,
  ATTACK_LABEL,
  cellKey,
  cellsOfSide,
  isAttackAllowed,
  otherSide,
  SCHEME_LABEL,
  tellsFor,
} from './engine'
import type { AttackKind, Cell, Command, GameState, Side } from './engine'

const PHASE_LABEL: Record<GameState['phase'], string> = {
  SERVE: 'SAQUE',
  RECEIVE: 'RECEPCIÓN',
  SET: 'ARMADO',
  ATTACK: 'ATAQUE',
  DEFEND: 'DEFENSA',
  MATCH_END: 'FIN',
}

const statusText = (game: GameState): string => {
  const mine = (side: Side) => (side === game.playerSide ? 'Tu' : 'Rival')
  switch (game.phase) {
    case 'SERVE':
      return game.server === game.playerSide ? 'Tu saque' : 'Saque rival'
    case 'RECEIVE':
      return `${mine(game.possession)} recepción`
    case 'SET':
      return `${mine(game.possession)} armado`
    case 'ATTACK':
      return 'Tu jugada'
    case 'DEFEND':
      return 'Tu defensa'
    case 'MATCH_END':
      return game.winner === game.playerSide ? 'Ganaste' : 'Perdiste'
  }
}

const App = () => {
  const game = useGame((state) => state.game)
  const screen = useGame((state) => state.screen)
  const tutorial = useGame((state) => state.tutorial)
  const muted = useGame((state) => state.muted)
  const duel = useGame((state) => state.duel)
  const lastDuel = useGame((state) => state.lastDuel)
  const duelReplay = useGame((state) => state.duelReplay)
  const toast = useGame((state) => state.toast)
  const dispatch = useGame((state) => state.dispatch)
  const aiStep = useGame((state) => state.aiStep)
  const reset = useGame((state) => state.reset)
  const startGame = useGame((state) => state.startGame)
  const finishTutorial = useGame((state) => state.finishTutorial)
  const skipTutorial = useGame((state) => state.skipTutorial)
  const backToTitle = useGame((state) => state.backToTitle)
  const toggleMuted = useGame((state) => state.toggleMuted)
  const dismissDuel = useGame((state) => state.dismissDuel)
  const reopenDuel = useGame((state) => state.reopenDuel)

  const [attackKind, setAttackKind] = useState<AttackKind | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aiPaused, setAiPaused] = useState(false)
  const holdTimer = useRef<number | null>(null)

  const playerTurn = isPlayerTurn(game)
  const tells = useMemo(() => tellsFor(game), [game])
  const attacker = game.attackerId
    ? game.players.find((player) => player.id === game.attackerId)
    : undefined
  const tutorialDone =
    tutorial && (game.rallyNumber > 2 || game.phase === 'MATCH_END')

  const lastPlay = useMemo(() => {
    if (!lastDuel) return null
    const event = lastDuel.event
    const resolution = event.resolution
    const attackerSide = game.players.find(
      (player) => player.id === event.playerId,
    )?.side
    const mine = attackerSide === game.playerSide
    const result =
      resolution.outcome === 'point'
        ? `PUNTO ${mine ? 'TUYO' : 'RIVAL'}`
        : resolution.outcome === 'blocked'
          ? `BLOQUEO ${mine ? 'RIVAL' : 'TUYO'}`
          : `DIG Q${resolution.digQuality ?? 0}`
    const tone =
      resolution.outcome === 'point'
        ? mine
          ? 'good'
          : 'bad'
        : resolution.outcome === 'blocked'
          ? mine
            ? 'bad'
            : 'good'
          : 'dig'
    return {
      matchup: `${SCHEME_LABEL[event.scheme]} vs ${ATTACK_LABEL[event.kind]}`,
      result,
      tone,
    }
  }, [game.players, game.playerSide, lastDuel])

  const closeDuel = () => {
    dismissDuel()
    setAiPaused(true)
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => setAiPaused(false), 900)
  }

  useEffect(
    () => () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (
      screen !== 'game' ||
      playerTurn ||
      tutorialDone ||
      helpOpen ||
      duel ||
      aiPaused ||
      game.phase === 'MATCH_END'
    ) {
      return
    }
    const timer = window.setTimeout(() => aiStep(), 540)
    return () => window.clearTimeout(timer)
  }, [game, playerTurn, aiStep, screen, tutorialDone, helpOpen, duel, aiPaused])

  const act = (command: Command) => {
    dispatch(command, 'player')
    setAttackKind(null)
  }

  const restart = () => {
    reset()
    setAttackKind(null)
  }

  const targets = useMemo(() => {
    const cells = new Set<string>()
    if (!playerTurn) return cells
    if (game.phase === 'SERVE' && game.server === game.playerSide) {
      for (const cell of cellsOfSide(otherSide(game.playerSide))) {
        cells.add(cellKey(cell))
      }
    }
    if (game.phase === 'ATTACK' && attackKind && attacker) {
      for (const cell of cellsOfSide(otherSide(game.playerSide))) {
        if (isAttackAllowed({ attacker, kind: attackKind, target: cell }).ok) {
          cells.add(cellKey(cell))
        }
      }
    }
    return cells
  }, [attacker, attackKind, game, playerTurn])

  const onCell = (cell: Cell) => {
    if (!playerTurn) return
    if (game.phase === 'SERVE' && game.server === game.playerSide) {
      if (cell.side === otherSide(game.playerSide)) {
        act({ type: 'SERVE', target: cell })
      }
      return
    }
    if (game.phase === 'ATTACK' && attackKind && attacker) {
      if (cell.side !== otherSide(game.playerSide)) return
      const check = isAttackAllowed({
        attacker,
        kind: attackKind,
        target: cell,
      })
      if (!check.ok) return
      act({
        type: 'ATTACK',
        playerId: attacker.id,
        kind: attackKind,
        target: cell,
      })
    }
  }

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          muted={muted}
          onPlay={() => {
            setAttackKind(null)
            startGame()
          }}
          onTutorial={() => {
            setAttackKind(null)
            startGame({ tutorial: true })
          }}
          onToggleMuted={toggleMuted}
          onHelp={() => setHelpOpen(true)}
        />
        {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
      </>
    )
  }

  return (
    <div className="game-shell">
      <header className="hud scanlines">
        <div className="hud-top">
          <button
            type="button"
            onClick={() => {
              setAttackKind(null)
              backToTitle()
            }}
            className="hud-brand"
            aria-label="Volver al inicio"
          >
            <span className="hud-logo">ZONA 3</span>
            <span className="hud-sub">SET A {game.targetScore}</span>
          </button>

          <div className="scoreboard" aria-label="Marcador">
            <span
              key={`home-${game.score.home}`}
              className={`score score-home ${
                game.playerSide === 'home' ? 'score-mine' : ''
              }`}
            >
              {game.score.home}
            </span>
            <span className="score-dash">—</span>
            <span
              key={`away-${game.score.away}`}
              className={`score score-away ${
                game.playerSide === 'away' ? 'score-mine' : ''
              }`}
            >
              {game.score.away}
            </span>
          </div>

          <div className="hud-phase">
            <span className="phase-pill">{PHASE_LABEL[game.phase]}</span>
            <span className="phase-status">{statusText(game)}</span>
          </div>
        </div>

        <div className="hud-bottom">
          <div className="energy" aria-label={`Energía ${game.ap} de ${AP_MAX}`}>
            <span className="energy-label">ENERGÍA</span>
            {Array.from({ length: AP_MAX }, (_, index) => (
              <span
                key={index}
                className={`energy-pip ${index < game.ap ? 'energy-on' : ''}`}
              />
            ))}
            <span className="energy-count">
              {game.ap}/{AP_MAX}
            </span>
          </div>
          <div className="hud-actions">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="pixel-btn icon-btn"
              aria-label="Cómo se juega"
            >
              ?
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              className="pixel-btn icon-btn"
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              onClick={restart}
              className="pixel-btn icon-btn"
              aria-label="Reiniciar partido"
            >
              ↺
            </button>
          </div>
        </div>
      </header>

      <main className="board-wrap">
        <Board
          game={game}
          targets={targets}
          activeId={game.attackerId}
          flashCell={duel ? cellKey(duel.event.target) : null}
          onCell={onCell}
        />
      </main>

      <CommandMenu
        game={game}
        tells={tells}
        attackKind={attackKind}
        onAttackKind={setAttackKind}
        onCommand={act}
        onRestart={restart}
      />

      {tutorial && !tutorialDone ? (
        <Coach game={game} onSkip={skipTutorial} />
      ) : (
        <footer className={`log-line ${lastPlay && !duel ? 'has-last-play' : ''}`}>
          {lastPlay && !duel && (
            <button
              type="button"
              className="last-play"
              onClick={reopenDuel}
              aria-label={`Ver otra vez la última jugada: ${lastPlay.matchup}, ${lastPlay.result}`}
            >
              <span className="last-play-tag">ÚLTIMA</span>
              <span className="last-play-copy">{lastPlay.matchup}</span>
              <span className={`last-play-result is-${lastPlay.tone}`}>
                {lastPlay.result}
              </span>
              <span className="last-play-open" aria-hidden="true">
                ▸
              </span>
            </button>
          )}
          {game.log
            .slice(lastPlay && !duel ? -1 : -2)
            .map((entry, index) => (
              <p
                key={`${entry.text}-${index}`}
                className={`log-entry log-${entry.tone}`}
              >
                {entry.text}
              </p>
            ))}
          {game.log.length === 0 && (
            <p className="log-entry">Un set a 7. Vos sacás primero.</p>
          )}
        </footer>
      )}

      {duel && (
        <DuelCutIn
          game={game}
          duel={duel}
          startAtResult={duelReplay}
          onClose={closeDuel}
        />
      )}

      {toast && (
        <button
          type="button"
          onClick={() => useGame.getState().clearToast()}
          className="toast"
        >
          {toast}
        </button>
      )}

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}

      {tutorialDone && (
        <TutorialComplete game={game} onFinish={finishTutorial} />
      )}
    </div>
  )
}

export default App
