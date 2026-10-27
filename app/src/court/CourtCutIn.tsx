import PixelPortrait from '../game/PixelPortrait'
import type { CourtPlayer, CutInSpec } from './types'

type Props = {
  cutin: CutInSpec
  players: CourtPlayer[]
  duration: number
  onSkip: () => void
}

export const CourtCutIn = ({
  cutin,
  players,
  duration,
  onSkip,
}: Props) => {
  const left = players.find((player) => player.id === cutin.leftId)
  const right = players.find((player) => player.id === cutin.rightId)
  if (!left || !right) return null

  // La banda se ubica del lado contrario al jugador que actúa para no taparlo.
  const focusId = cutin.kind === 'serve' ? cutin.rightId : cutin.leftId
  const focus = players.find((player) => player.id === focusId)
  const position = focus?.side === 'home' ? 'is-top' : 'is-bottom'

  return (
    <button
      type="button"
      className={`court-cutin is-${cutin.kind} ${position}`}
      style={{ animationDuration: `${duration}ms` }}
      onClick={onSkip}
      aria-label={`Duelo: ${left.name} contra ${right.name}. Tocá para seguir.`}
    >
      <span className="court-cutin-side">
        <span className="court-cutin-role">{cutin.leftLabel}</span>
        <PixelPortrait classId={left.classId} side={left.side} size={62} />
        <b>{left.name}</b>
      </span>

      <span className="court-cutin-core">
        <span className="court-cutin-move">{cutin.move}</span>
        <strong>VS</strong>
        <span className="court-cutin-hint">TOCÁ PARA SEGUIR</span>
      </span>

      <span className="court-cutin-side">
        <span className="court-cutin-role">{cutin.rightLabel}</span>
        <PixelPortrait classId={right.classId} side={right.side} size={62} />
        <b>{right.name}</b>
      </span>
    </button>
  )
}

export default CourtCutIn
