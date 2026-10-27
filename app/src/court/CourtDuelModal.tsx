import { useState } from 'react'
import PixelPortrait from '../game/PixelPortrait'
import { Flag } from './TeamBadge'
import { techniquesFor, type Technique, type TechniqueId } from './techniques'
import type { CourtPlayer, CourtTeam } from './types'

const ROLE: Record<CourtPlayer['classId'], string> = {
  setter: 'ARMADOR',
  middle: 'CENTRAL',
  opposite: 'OPUESTO',
  libero: 'LÍBERO',
}

const STATS = [
  ['tecnica', 'T'],
  ['potencia', 'P'],
  ['velocidad', 'V'],
  ['lectura', 'L'],
] as const

export type DuelChoice = {
  playerId: string
  technique?: TechniqueId
}

type Props = {
  mode: 'attack' | 'defense'
  players: CourtPlayer[]
  opponent: CourtTeam
  label: string
  detail: string
  resourceLabel: string
  resourceValue: number
  baseCost: number
  techniquesLocked?: boolean
  onCancel: () => void
  onConfirm: (choice: DuelChoice) => void
}

export const CourtDuelModal = ({
  mode,
  players,
  opponent,
  label,
  detail,
  resourceLabel,
  resourceValue,
  baseCost,
  techniquesLocked = false,
  onCancel,
  onConfirm,
}: Props) => {
  const [selectedId, setSelectedId] = useState(players[0]?.id ?? '')
  const [technique, setTechnique] = useState<TechniqueId | null>(null)

  const selected =
    players.find((player) => player.id === selectedId) ?? players[0]
  if (!selected) return null

  const techniques = techniquesFor(selected.classId, mode)
  const normalCost = mode === 'attack' ? baseCost : 0
  const normalAffordable =
    mode === 'attack' ? resourceValue >= normalCost : true

  const choosePlayer = (player: CourtPlayer) => {
    setSelectedId(player.id)
    setTechnique(null)
  }

  const chooseTechnique = (next: Technique) => {
    const affordable =
      mode === 'attack'
        ? resourceValue >= normalCost + next.cost
        : !techniquesLocked
    if (!affordable) return
    setTechnique((current) => (current === next.id ? null : next.id))
  }

  return (
    <div className="court-duel-backdrop" role="dialog" aria-modal="true" aria-label="Duelo">
      <div className={`court-duel is-${mode}`}>
        <header className="court-duel-head">
          <span className="court-duel-kicker">DUELO</span>
          <strong>{mode === 'attack' ? 'ATAQUE' : 'DEFENSA'}</strong>
          <span className="court-duel-ap">
            {resourceLabel}{' '}
            {mode === 'defense'
              ? resourceValue > 0
                ? 'LISTA'
                : 'USADA'
              : resourceValue}
          </span>
        </header>

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
            <span className="court-duel-label">{label}</span>
            <strong>VS</strong>
            <span className="court-duel-detail">{detail}</span>
          </div>

          <div className="court-duel-side is-rival">
            <span className="court-duel-role">RIVAL</span>
            <span className="court-duel-hidden" aria-hidden="true">
              <Flag team={opponent} />
              <b>?</b>
            </span>
            <b>{mode === 'attack' ? 'DEFENSA' : 'ATAQUE'}</b>
            <small>{mode === 'attack' ? 'ESQUEMA OCULTO' : 'ZONA OCULTA'}</small>
          </div>
        </div>

        {players.length > 1 && (
          <div
            className="court-duel-candidates"
            role="group"
            aria-label="Elegí jugador"
          >
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                className={`court-duel-player${
                  player.id === selected.id ? ' is-selected' : ''
                }`}
                aria-pressed={player.id === selected.id}
                onClick={() => choosePlayer(player)}
              >
                <span>{ROLE[player.classId]}</span>
                <b>{player.name}</b>
              </button>
            ))}
          </div>
        )}

        <div
          className="court-duel-techs"
          role="group"
          aria-label="Elegí técnica"
        >
          <button
            type="button"
            className={`court-duel-tech${technique === null ? ' is-selected' : ''}`}
            aria-pressed={technique === null}
            disabled={!normalAffordable}
            onClick={() => setTechnique(null)}
          >
            <b>NORMAL</b>
            <small>{mode === 'attack' ? `${baseCost} EN` : 'sin costo'}</small>
          </button>
          {techniques.map((tech) => {
            const affordable =
              mode === 'attack'
                ? resourceValue >= normalCost + tech.cost
                : !techniquesLocked
            return (
              <button
                key={tech.id}
                type="button"
                className={`court-duel-tech${
                  technique === tech.id ? ' is-selected' : ''
                }`}
                aria-pressed={technique === tech.id}
                disabled={!affordable}
                onClick={() => chooseTechnique(tech)}
              >
                <b>{tech.label}</b>
                <small>
                  {tech.note} ·{' '}
                  {tech.oncePerRally ? '1 por rally' : `${tech.cost} EN`}
                </small>
              </button>
            )
          })}
        </div>

        <footer className="court-duel-foot">
          <button
            type="button"
            className="pixel-btn ghost"
            onClick={onCancel}
          >
            VOLVER
          </button>
          <button
            type="button"
            className="pixel-btn primary"
            onClick={() =>
              onConfirm({
                playerId: selected.id,
                technique: technique ?? undefined,
              })
            }
          >
            {mode === 'attack' ? 'ATACAR' : 'DEFENDER'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default CourtDuelModal
