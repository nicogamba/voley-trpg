import CourtCanvas from '../court/CourtCanvas'
import type { CourtCell, CourtPlayer, CourtTeam, Side } from '../court/types'

type Props = {
  players: CourtPlayer[]
  teams: Record<Side, CourtTeam>
  ball: CourtCell
  label?: string
  muted?: boolean
}

/**
 * La cancha continua de v2 dentro de la mitad superior de CT1.
 * El guion va vacío: acá solo se muestra la posición, la acción va aparte.
 */
export const FieldView = ({ players, teams, ball, label, muted }: Props) => (
  <div className="ct1-field">
    <CourtCanvas
      players={players}
      script={[]}
      initialBall={ball}
      teams={teams}
      muted={muted}
      onCaption={() => {}}
    />
    {label && (
      <span className="ct1-field-label">
        <i className="ct1-live-dot" /> {label}
      </span>
    )}
  </div>
)

export default FieldView
