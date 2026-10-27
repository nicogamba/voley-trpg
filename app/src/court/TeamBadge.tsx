import type { CourtTeam, Side } from './types'

export const Flag = ({ team }: { team: CourtTeam }) => (
  <span className="court-flag" aria-hidden="true">
    {team.flag.map((color, index) => (
      <span key={index} style={{ background: color }} />
    ))}
  </span>
)

export const TeamBlock = ({
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

export default Flag
