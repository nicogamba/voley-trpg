import { useState } from 'react'
import PixelPortrait from '../game/PixelPortrait'
import { Flag } from './TeamBadge'
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

export type SituationOption = {
  id: string
  label: string
  note: string
  disabled: boolean
}

type Props = {
  actor: CourtPlayer
  opponent: CourtTeam
  title: string
  action: string
  coreLabel: string
  coreDetail: string
  rivalLabel: string
  rivalDetail: string
  resource?: { label: string; value: string | number }
  context?: string
  narration: string
  tell: Tell
  options: SituationOption[]
  onConfirm: (id: string) => void
}

export const CourtSituationModal = ({
  actor,
  opponent,
  title,
  action,
  coreLabel,
  coreDetail,
  rivalLabel,
  rivalDetail,
  resource,
  context,
  narration,
  tell,
  options,
  onConfirm,
}: Props) => {
  const first = options.find((option) => !option.disabled)
  const [selectedId, setSelectedId] = useState(first?.id ?? '')

  const selected = options.find((option) => option.id === selectedId)

  return (
    <div
      className="court-duel-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Situación de armado"
    >
      <div className="court-duel is-set">
        <header className="court-duel-head">
          <span className="court-duel-kicker">SITUACIÓN</span>
          <strong>{title}</strong>
          {resource && (
            <span className="court-duel-ap">
              {resource.label} {resource.value}
            </span>
          )}
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
            <PixelPortrait classId={actor.classId} side={actor.side} size={76} />
            <b>{actor.name}</b>
            <small>{ROLE[actor.classId]}</small>
            <span className="court-duel-stats">
              {STATS.map(([key, short]) => (
                <i key={key}>
                  {short}
                  {actor.stats[key]}
                </i>
              ))}
            </span>
          </div>

          <div className="court-duel-core">
            <span className="court-duel-label">{coreLabel}</span>
            <strong>VS</strong>
            <span className="court-duel-detail">{coreDetail}</span>
          </div>

          <div className="court-duel-side is-rival">
            <span className="court-duel-role">RIVAL</span>
            <span className="court-duel-hidden" aria-hidden="true">
              <Flag team={opponent} />
              <b>?</b>
            </span>
            <b>{rivalLabel}</b>
            <small>{rivalDetail}</small>
          </div>
        </div>

        <div
          className="court-duel-techs is-plays"
          role="group"
          aria-label="Elegí el armado"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`court-duel-tech${
                option.id === selectedId ? ' is-selected' : ''
              }`}
              aria-pressed={option.id === selectedId}
              disabled={option.disabled}
              onClick={() => setSelectedId(option.id)}
            >
              <b>{option.label}</b>
              <small>{option.note}</small>
            </button>
          ))}
        </div>

        <footer className="court-duel-foot">
          <span className="court-duel-pick">
            {selected ? selected.label : 'ELEGÍ UN JUEGO'}
          </span>
          <button
            type="button"
            className="pixel-btn primary"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.id)}
          >
            {action}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default CourtSituationModal
