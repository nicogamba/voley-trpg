import { useState } from 'react'
import PixelPortrait from '../game/PixelPortrait'
import { Flag } from './TeamBadge'
import { areaLabel } from './geometry'
import type { Tell } from './narration'
import type { CourtPlayer, CourtTeam } from './types'
import Typewriter from './Typewriter'

const ROLE: Record<CourtPlayer['classId'], string> = {
  setter: 'ARMADOR',
  middle: 'CENTRAL',
  opposite: 'OPUESTO',
  libero: 'LÍBERO',
  wing: 'PUNTA',
}

const STATS = [
  ['tecnica', 'T'],
  ['potencia', 'P'],
  ['velocidad', 'V'],
  ['lectura', 'L'],
] as const

type Props = {
  players: CourtPlayer[]
  server: CourtPlayer
  opponent: CourtTeam
  context?: string
  narration: string
  tell: Tell
  onConfirm: (playerId: string) => void
}

export const CourtReceptionModal = ({
  players,
  server,
  opponent,
  context,
  narration,
  tell,
  onConfirm,
}: Props) => {
  const initial =
    players.find((player) => player.classId === 'libero') ?? players[0]
  const [selectedId, setSelectedId] = useState(initial?.id ?? '')
  const selected =
    players.find((player) => player.id === selectedId) ?? players[0]

  if (!selected) return null

  return (
    <div
      className="court-duel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Situación de recepción"
    >
      <div className="court-duel is-reception">
        <header className="court-duel-head">
          <span className="court-duel-kicker">SITUACIÓN</span>
          <strong>RECEPCIÓN</strong>
          <span className="court-duel-ap">SAQUE RIVAL</span>
        </header>

        {context && <p className="court-duel-context">{context}</p>}

        <p className="court-duel-narration">
            <Typewriter key={narration} text={narration} />
          </p>
        <p className="court-duel-tell">
          <span>PISTA</span> {tell.text}
        </p>

        <div className="court-duel-stage">
          <div className="court-duel-side">
            <span className="court-duel-role">VOS</span>
            <PixelPortrait
              classId={selected.classId}
              side={selected.side}
              size={76}
            />
            <b>{selected.name}</b>
            <small>{ROLE[selected.classId]}</small>
            <span className="court-duel-stats">
              {STATS.map(([key, short]) => (
                <i key={key}>
                  {short}
                  {selected.stats[key]}
                </i>
              ))}
            </span>
          </div>

          <div className="court-duel-core">
            <span className="court-duel-label">RECEPCIÓN</span>
            <strong>VS</strong>
            <span className="court-duel-detail">SAQUE</span>
          </div>

          <div className="court-duel-side is-rival">
            <span className="court-duel-role">RIVAL</span>
            <PixelPortrait
              classId={server.classId}
              side={server.side}
              size={76}
            />
            <b>{server.name}</b>
            <small>SAQUE</small>
            <span className="court-duel-stats">
              <Flag team={opponent} />
            </span>
          </div>
        </div>

        <div
          className="court-duel-candidates"
          role="group"
          aria-label="Elegí quién recibe"
        >
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`court-duel-player${
                player.id === selected.id ? ' is-selected' : ''
              }`}
              aria-pressed={player.id === selected.id}
              onClick={() => setSelectedId(player.id)}
            >
              <span>
                {ROLE[player.classId]} · {areaLabel(player.cell)}
              </span>
              <b>{player.name}</b>
            </button>
          ))}
        </div>

        <footer className="court-duel-foot">
          <span className="court-duel-pick">
            {selected.name} · {ROLE[selected.classId]} · {areaLabel(selected.cell)}
          </span>
          <button
            type="button"
            className="pixel-btn primary"
            onClick={() => onConfirm(selected.id)}
          >
            RECIBIR
          </button>
        </footer>
      </div>
    </div>
  )
}

export default CourtReceptionModal
