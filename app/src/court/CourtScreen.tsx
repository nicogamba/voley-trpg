import { useMemo, useState } from 'react'
import CourtCanvas from './CourtCanvas'
import { DEMO_PLAYERS, DEMO_RALLY, DEMO_TEAMS } from './demo'
import {
  COURT,
  cellDistance,
  cellsOfSide,
  cellOrigin,
  sameCell,
} from './geometry'
import type {
  BeatSpec,
  CourtCell,
  CourtPlayer,
  CourtTeam,
  Side,
} from './types'

type Props = {
  onBack: () => void
}

type Phase = 'setup' | 'moving' | 'rally' | 'ended'

type Move = {
  playerId: string
  name: string
  from: CourtCell
  to: CourtCell
}

const SERVER_ID = 'home-opposite'
const HOME_CELLS = cellsOfSide('home')
const EMPTY_SCRIPT: BeatSpec[] = []
const SETUP_HINT = 'ORDENÁ · TOCÁ UN JUGADOR'

const cloneRoster = (): CourtPlayer[] =>
  DEMO_PLAYERS.map((player) => ({
    ...player,
    cell: { ...player.cell },
  }))

const buildMoveScript = (move: Move): BeatSpec[] => {
  const beat: BeatSpec = {
    kind: 'move',
    duration: 320,
    caption: `MUEVE · ${move.name}`,
    moves: [
      {
        playerId: move.playerId,
        to: move.to,
        duration: 300,
        pose: 'run',
      },
    ],
  }
  if (move.playerId === SERVER_ID) {
    beat.ball = {
      to: move.to,
      arc: 10,
      zFrom: 46,
      zTo: 46,
      duration: 300,
    }
  }
  return [beat]
}

const Flag = ({ team }: { team: CourtTeam }) => (
  <span className="court-flag" aria-hidden="true">
    {team.flag.map((color, index) => (
      <span key={index} style={{ background: color }} />
    ))}
  </span>
)

const TeamBlock = ({
  team,
  side,
}: {
  team: CourtTeam
  side: Side
}) => (
  <div className={`court-team court-team-${side}`}>
    <Flag team={team} />
    <div className="court-team-text">
      <span className="court-team-code">{team.short}</span>
      <span className="court-team-name">{team.name}</span>
    </div>
  </div>
)

const cellPosition = (cell: CourtCell) => {
  const origin = cellOrigin(cell)
  return {
    left: `${(origin.x / COURT.width) * 100}%`,
    top: `${(origin.y / COURT.height) * 100}%`,
    width: `${(COURT.cellW / COURT.width) * 100}%`,
    height: `${(COURT.cellH / COURT.height) * 100}%`,
  }
}

export const CourtScreen = ({ onBack }: Props) => {
  const [roster, setRoster] = useState<CourtPlayer[]>(cloneRoster)
  const [phase, setPhase] = useState<Phase>('rally')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [move, setMove] = useState<Move | null>(null)
  const [runId, setRunId] = useState(0)
  const [setupSeq, setSetupSeq] = useState(0)
  const [caption, setCaption] = useState('SAQUE · MOLINA')
  const [score, setScore] = useState<Record<Side, number>>({
    home: 0,
    away: 0,
  })

  const server = roster.find((player) => player.id === SERVER_ID) ?? roster[0]
  const selected =
    roster.find((player) => player.id === selectedId) ?? null

  /** Durante un movimiento, el jugador arranca en la celda vieja. */
  const displayPlayers = useMemo(() => {
    if (!move) return roster
    return roster.map((player) =>
      player.id === move.playerId
        ? { ...player, cell: move.from }
        : player,
    )
  }, [move, roster])

  const moveScript = useMemo(
    () => (move ? buildMoveScript(move) : EMPTY_SCRIPT),
    [move],
  )

  const startRally = () => {
    setSelectedId(null)
    setMove(null)
    setPhase('rally')
    setScore({ home: 0, away: 0 })
    setCaption('SAQUE · MOLINA')
    setRunId((value) => value + 1)
    setSetupSeq((value) => value + 1)
  }

  const openSetup = () => {
    setSelectedId(null)
    setMove(null)
    setPhase('setup')
    setScore({ home: 0, away: 0 })
    setSetupSeq((value) => value + 1)
  }

  const resetPositions = () => {
    setRoster(cloneRoster())
    setSelectedId(null)
    setMove(null)
    setScore({ home: 0, away: 0 })
    setSetupSeq((value) => value + 1)
  }

  const selectCell = (cell: CourtCell) => {
    if (phase !== 'setup') return

    const occupant = roster.find((player) => sameCell(player.cell, cell))
    if (occupant) {
      setSelectedId((current) =>
        current === occupant.id ? null : occupant.id,
      )
      return
    }

    if (!selected) return
    if (cellDistance(selected.cell, cell) !== 1) {
      setSelectedId(null)
      return
    }

    setMove({
      playerId: selected.id,
      name: selected.name,
      from: selected.cell,
      to: cell,
    })
    setSelectedId(null)
    setSetupSeq((value) => value + 1)
    setPhase('moving')
  }

  const finishMove = () => {
    if (!move) return
    setRoster((current) =>
      current.map((player) =>
        player.id === move.playerId
          ? { ...player, cell: move.to }
          : player,
      ),
    )
    setMove(null)
    setPhase('setup')
    setSetupSeq((value) => value + 1)
  }

  const captionText =
    phase === 'setup'
      ? selected
        ? `${selected.name} · ELEGÍ UNA CELDA`
        : SETUP_HINT
      : phase === 'moving' && move
        ? `MUEVE · ${move.name}`
        : phase === 'ended'
          ? 'FIN DEL RALLY · REPETÍ U ORDENÁ'
          : caption

  const canvasKey =
    phase === 'setup'
      ? `setup-${setupSeq}`
      : phase === 'moving'
        ? `move-${setupSeq}`
        : `rally-${runId}`

  return (
    <div className="court-shell scanlines">
      <header className="court-hud">
        <TeamBlock team={DEMO_TEAMS.home} side="home" />

        <div className="court-score">
          <div className="court-score-line">
            <span className="court-score-num">{score.home}</span>
            <span className="court-score-sep">×</span>
            <span className="court-score-num">{score.away}</span>
          </div>
          <p className="court-score-label">RALLY DEMO · V2</p>
        </div>

        <TeamBlock team={DEMO_TEAMS.away} side="away" />
      </header>

      <div className="court-stage">
        <div className="court-center">
          <div className="court-frame">
            <CourtCanvas
              key={canvasKey}
              players={phase === 'moving' ? displayPlayers : roster}
              script={
                phase === 'setup'
                  ? EMPTY_SCRIPT
                  : phase === 'moving'
                    ? moveScript
                    : DEMO_RALLY
              }
              initialBall={server.cell}
              onCaption={setCaption}
              onPoint={(side) =>
                setScore((current) => ({
                  ...current,
                  [side]: current[side] + 1,
                }))
              }
              onEnd={
                phase === 'moving'
                  ? finishMove
                  : phase === 'rally'
                    ? () => setPhase('ended')
                    : undefined
              }
            />

            {phase === 'setup' && (
              <div
                className="court-hit-layer"
                role="group"
                aria-label="Ordená tus jugadores"
              >
                {HOME_CELLS.map((cell) => {
                  const occupant = roster.find((player) =>
                    sameCell(player.cell, cell),
                  )
                  const isSelected = occupant?.id === selectedId
                  const isDest =
                    Boolean(selected) &&
                    !occupant &&
                    cellDistance(selected!.cell, cell) === 1

                  return (
                    <button
                      key={`${cell.row}-${cell.col}`}
                      type="button"
                      style={cellPosition(cell)}
                      className={[
                        'court-hit',
                        occupant ? 'court-hit-player' : '',
                        isSelected ? 'court-hit-selected' : '',
                        isDest ? 'court-hit-dest' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={
                        occupant
                          ? `${occupant.name}, ${
                              isSelected
                                ? 'seleccionado'
                                : 'elegir para mover'
                            }`
                          : `Celda ${cell.row + 1}-${cell.col + 1}`
                      }
                      aria-pressed={isSelected}
                      onClick={() => selectCell(cell)}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div className="court-caption-bar">
            <p
              className={`court-caption${phase === 'ended' ? ' is-ended' : ''}`}
              aria-live="polite"
            >
              {captionText}
            </p>
            {(phase === 'rally' || phase === 'ended') && (
              <button
                type="button"
                className="court-chip"
                onClick={openSetup}
              >
                ORDENAR
              </button>
            )}
            {phase === 'setup' && (
              <button
                type="button"
                className="court-chip"
                onClick={resetPositions}
              >
                REINICIAR
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="court-panel">
        <button
          type="button"
          onClick={startRally}
          disabled={phase === 'moving'}
          className="pixel-btn primary"
        >
          {phase === 'setup' ? '▶ JUGAR RALLY' : '↻ REPETIR RALLY'}
        </button>
        <button type="button" onClick={onBack} className="pixel-btn ghost">
          VOLVER
        </button>
      </div>
    </div>
  )
}

export default CourtScreen
