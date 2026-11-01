import { useEffect, useState } from 'react'
import PixelPortrait from '../game/PixelPortrait'
import { playCue } from '../court/audio'
import type { CourtTeam, Side } from '../court/types'
import { CLASS_ROLE } from './content/frames'
import type { CommandOption } from './types'

type Props = {
  title: string
  hint?: string
  options: CommandOption[]
  onSelect: (id: string) => void
  tension?: number
  maxTension?: number
  notice?: string | null
  teams?: Record<Side, CourtTeam>
  muted?: boolean
}

const STATS = [
  ['tecnica', 'T'],
  ['potencia', 'P'],
  ['velocidad', 'V'],
  ['lectura', 'L'],
] as const

export const CommandBox = ({
  title,
  hint,
  options,
  onSelect,
  tension,
  maxTension = 100,
  notice,
  teams,
  muted,
}: Props) => {
  const first = options.find((option) => !option.disabled)?.id ?? ''
  const [selectedId, setSelectedId] = useState(first)
  const signature = options
    .map((option) => `${option.id}:${option.disabled ? 1 : 0}`)
    .join('|')

  useEffect(() => {
    setSelectedId(options.find((option) => !option.disabled)?.id ?? '')
    // La firma evita reiniciar el cursor cuando el padre re-renderiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const selected =
    options.find((option) => option.id === selectedId) ?? options[0]
  const actor = selected?.actor

  const choose = (option: CommandOption) => {
    if (option.disabled) return
    if (!muted) playCue('blip')
    setSelectedId(option.id)
  }

  return (
    <div className="ct1-command">
      <div className="ct1-command-head">
        <span>{title}</span>
        {typeof tension === 'number' && (
          <span
            className="ct1-tension"
            aria-label={`Tensión ${tension} de ${maxTension}`}
          >
            <span className="ct1-tension-track">
              <i
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (tension / maxTension) * 100),
                  )}%`,
                }}
              />
            </span>
            <b>{tension}</b>
          </span>
        )}
      </div>

      {hint && <p className="ct1-hint">{hint}</p>}

      {actor && (
        <div className="ct1-stats">
          <PixelPortrait
            classId={actor.classId}
            side={actor.side}
            teamId={teams?.[actor.side].id}
            playerId={actor.id}
            size={38}
          />
          <div className="ct1-stats-name">
            <b>{actor.name}</b>
            <span>{CLASS_ROLE[actor.classId]}</span>
          </div>
          <div className="ct1-stats-values">
            {STATS.map(([key, short]) => (
              <i key={key} title={key}>
                {`${short}${actor.stats[key]}`}
              </i>
            ))}
          </div>
        </div>
      )}

      {notice && <p className="ct1-notice">{notice}</p>}

      <div className="ct1-options" role="listbox" aria-label={title}>
        {options.map((option) => {
          const active = option.id === selectedId
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={active}
              disabled={option.disabled}
              className={`ct1-option${active ? ' is-selected' : ''}`}
              onClick={() => choose(option)}
            >
              <span className="ct1-option-cursor" aria-hidden="true">
                {active ? '▶' : '·'}
              </span>
              <span className="ct1-option-label">{option.label}</span>
              {option.note && (
                <span className="ct1-option-note">{option.note}</span>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="ct1-confirm"
        disabled={!selected || selected.disabled}
        onClick={() => selected && onSelect(selected.id)}
      >
        ELEGIR ▶
      </button>
    </div>
  )
}

export default CommandBox
