import { useState } from 'react'
import CourtCanvas from './CourtCanvas'
import {
  DEMO_PLAYERS,
  DEMO_RALLY,
  DEMO_TEAMS,
  INITIAL_BALL,
} from './demo'
import type { CourtTeam, Side } from './types'

type Props = {
  onBack: () => void
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

export const CourtScreen = ({ onBack }: Props) => {
  const [runId, setRunId] = useState(0)
  const [caption, setCaption] = useState('SAQUE · MOLINA')
  const [score, setScore] = useState<Record<Side, number>>({
    home: 0,
    away: 0,
  })
  const [ended, setEnded] = useState(false)

  const replay = () => {
    setScore({ home: 0, away: 0 })
    setCaption('SAQUE · MOLINA')
    setEnded(false)
    setRunId((value) => value + 1)
  }

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
              key={runId}
              players={DEMO_PLAYERS}
              script={DEMO_RALLY}
              initialBall={INITIAL_BALL}
              onCaption={setCaption}
              onPoint={(side) =>
                setScore((current) => ({
                  ...current,
                  [side]: current[side] + 1,
                }))
              }
              onEnd={() => setEnded(true)}
            />
          </div>

          <p
            className={`court-caption${ended ? ' is-ended' : ''}`}
            aria-live="polite"
          >
            {ended ? 'FIN DEL RALLY · REPETÍ O VOLVÉ' : caption}
          </p>
        </div>
      </div>

      <div className="court-panel">
        <button type="button" onClick={replay} className="pixel-btn primary">
          ↻ REPETIR RALLY
        </button>
        <button type="button" onClick={onBack} className="pixel-btn ghost">
          VOLVER
        </button>
      </div>
    </div>
  )
}

export default CourtScreen
