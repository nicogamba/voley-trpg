import type { ReactNode } from 'react'
import { Flag } from '../court/TeamBadge'
import type { CourtTeam, Side } from '../court/types'

type Props = {
  teams: Record<Side, CourtTeam>
  score: Record<Side, number>
  targetScore: number
  server: Side
  onBack: () => void
  top: ReactNode
  bottom: ReactNode
  muted?: boolean
  onToggleMuted?: () => void
}

export const PresentationShell = ({
  teams,
  score,
  targetScore,
  server,
  onBack,
  top,
  bottom,
  muted,
  onToggleMuted,
}: Props) => (
  <div className="ct1-screen">
    <div className="ct1-top">
      <header className="ct1-scoreboard">
        <div className="ct1-score-team">
          <Flag team={teams.home} />
          <div>
            <strong>{teams.home.short}</strong>
            <span>{teams.home.name}</span>
          </div>
        </div>

        <div className="ct1-score-core">
          <div className="ct1-score-line">
            <span>{score.home}</span>
            <i>×</i>
            <span>{score.away}</span>
          </div>
          <p>
            SET DECISIVO · A {targetScore} · SAQUE {teams[server].short}
          </p>
        </div>

        <div className="ct1-score-team is-away">
          <div>
            <strong>{teams.away.short}</strong>
            <span>{teams.away.name}</span>
          </div>
          <Flag team={teams.away} />
        </div>

        <div className="ct1-score-actions">
          {onToggleMuted && (
            <button
              type="button"
              className="ct1-icon-btn"
              onClick={onToggleMuted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          )}
          <button
            type="button"
            className="ct1-icon-btn"
            onClick={onBack}
            aria-label="Salir del modo CT1"
          >
            ✕
          </button>
        </div>
      </header>

      <section className="ct1-stage" aria-label="Acción del partido">
        {top}
      </section>
    </div>

    <section className="ct1-bottom" aria-label="Relato y comandos">
      {bottom}
    </section>
  </div>
)

export default PresentationShell
