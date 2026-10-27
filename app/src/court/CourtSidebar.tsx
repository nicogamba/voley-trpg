import { Flag } from './TeamBadge'
import type { CourtPlayer, CourtTeam, Side } from './types'

const ROLE: Record<CourtPlayer['classId'], string> = {
  setter: 'ARM',
  middle: 'CEN',
  opposite: 'OPU',
  libero: 'LÍB',
}

const ROLE_NAME: Record<CourtPlayer['classId'], string> = {
  setter: 'Armador',
  middle: 'Central',
  opposite: 'Opuesto',
  libero: 'Líbero',
}

const STATS = [
  ['tecnica', 'TEC'],
  ['potencia', 'POT'],
  ['velocidad', 'VEL'],
  ['lectura', 'LEC'],
] as const

type Props = {
  side: Side
  team: CourtTeam
  players: CourtPlayer[]
  kicker: string
  note: string
  commentary?: string
}

export const CourtSidebar = ({
  side,
  team,
  players,
  kicker,
  note,
  commentary,
}: Props) => (
  <aside className={`court-side court-side-${side}`}>
    <p className="court-side-kicker">{kicker}</p>
    <div className="court-side-head">
      <Flag team={team} />
      <h2>{team.name}</h2>
    </div>
    <p className="court-side-note">{note}</p>

    <ul className="court-roster">
      {players.map((player) => (
        <li key={player.id} className="court-roster-row">
          <span
            className={`court-roster-role is-${player.classId}`}
            title={ROLE_NAME[player.classId]}
          >
            {ROLE[player.classId]}
          </span>
          <b>{player.name}</b>
          <span className="court-roster-stats">
            {STATS.map(([key, label]) => (
              <i key={key} title={`${label} ${player.stats[key]}`}>
                {label.slice(0, 1)}
                {player.stats[key]}
              </i>
            ))}
          </span>
        </li>
      ))}
    </ul>

    {commentary && (
      <div className="court-commentary">
        <span>COMENTARISTA</span>
        <p>{commentary}</p>
      </div>
    )}
  </aside>
)

export default CourtSidebar
