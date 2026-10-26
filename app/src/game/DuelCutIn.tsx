import { useEffect, useMemo, useState } from 'react'
import { zoneOf } from '../engine'
import {
  ATTACK_LABEL,
  SCHEME_LABEL,
  qualityLabel,
} from '../engine'
import type { GameState } from '../engine'
import type { DuelReveal } from './store'
import PixelPortrait from './PixelPortrait'
import { playSfx } from './sound'

type Props = {
  game: GameState
  duel: DuelReveal
  onClose: () => void
}

const DuelCutIn = ({ game, duel, onClose }: Props) => {
  const event = duel.event
  const attacker = game.players.find((player) => player.id === event.playerId)
  const defender = game.players.find(
    (player) => player.id === event.resolution.defenderId,
  )
  const playerAttacked = attacker?.side === game.playerSide
  const zone = zoneOf(event.target.row, event.target.col)
  const resolution = event.resolution

  const lines = useMemo(() => {
    const attackerName = attacker?.name ?? 'Atacante'
    const defenderName = defender?.name ?? 'Defensa'
    const first = `${attackerName} ataca con ${ATTACK_LABEL[event.kind]} a la zona ${zone}.`
    const second = playerAttacked
      ? `El rival responde: ${SCHEME_LABEL[event.scheme]}.`
      : `Vos respondés: ${SCHEME_LABEL[event.scheme]}.`

    if (resolution.outcome === 'point') {
      return [
        first,
        second,
        playerAttacked
          ? 'El ataque encuentra el hueco: ¡punto tuyo!'
          : 'El ataque encuentra el hueco: punto rival.',
      ]
    }
    if (resolution.outcome === 'blocked') {
      return [
        first,
        second,
        playerAttacked
          ? 'La defensa cierra el ataque: punto rival.'
          : 'La defensa cierra el ataque: ¡punto tuyo!',
      ]
    }
    return [
      first,
      second,
      `${defenderName} salva la bola: pase ${qualityLabel(
        resolution.digQuality ?? 0,
      )}.`,
    ]
  }, [
    attacker?.name,
    defender?.name,
    event.kind,
    event.scheme,
    playerAttacked,
    resolution.digQuality,
    resolution.outcome,
    zone,
  ])

  const text = lines.join('\n')
  const [chars, setChars] = useState(0)

  useEffect(() => {
    playSfx('reveal')
    const timer = window.setInterval(() => {
      setChars((current) => {
        if (current >= text.length) {
          window.clearInterval(timer)
          return current
        }
        return Math.min(text.length, current + 2)
      })
    }, 18)
    return () => window.clearInterval(timer)
  }, [text])

  const complete = chars >= text.length
  const advance = () => {
    if (!complete) {
      setChars(text.length)
      return
    }
    onClose()
  }

  const stamp = (() => {
    if (resolution.outcome === 'point') {
      return {
        text: playerAttacked ? '¡PUNTO!' : 'PUNTO RIVAL',
        tone: playerAttacked ? 'stamp-good' : 'stamp-bad',
      }
    }
    if (resolution.outcome === 'blocked') {
      return {
        text: playerAttacked ? 'BLOQUEO RIVAL' : '¡BLOQUEO!',
        tone: playerAttacked ? 'stamp-bad' : 'stamp-good',
      }
    }
    return {
      text: `DIG Q${resolution.digQuality ?? 0}`,
      tone: 'stamp-dig',
    }
  })()

  return (
    <div
      className="cutin-overlay scanlines"
      role="button"
      tabIndex={0}
      onClick={advance}
      onKeyDown={(eventKey) => {
        if (eventKey.key === 'Enter' || eventKey.key === ' ') advance()
      }}
    >
      <div className="cutin-top">
        <span className="cutin-kicker">DUELO OCULTO</span>
        <span className="cutin-score">
          {duel.score.home} — {duel.score.away}
        </span>
        <span className="cutin-rally">RALLY {duel.rallyNumber}</span>
      </div>

      <div className="cutin-stage">
        <div className="cutin-fighter">
          <span className="cutin-side">ATAQUE</span>
          {attacker && (
            <PixelPortrait
              classId={attacker.classId}
              side={attacker.side}
              size={104}
            />
          )}
          <span className="cutin-name">{attacker?.name ?? 'Atacante'}</span>
          <span className="cutin-tag">{ATTACK_LABEL[event.kind]}</span>
        </div>
        <div className="cutin-vs">VS</div>
        <div className="cutin-fighter">
          <span className="cutin-side">DEFENSA</span>
          {defender && (
            <PixelPortrait
              classId={defender.classId}
              side={defender.side}
              size={104}
            />
          )}
          <span className="cutin-name">{defender?.name ?? 'Defensa'}</span>
          <span className="cutin-tag">{SCHEME_LABEL[event.scheme]}</span>
        </div>
      </div>

      <div className="cutin-text">
        <p className="cutin-scene">
          Zona {zone} · {SCHEME_LABEL[event.scheme]} vs {ATTACK_LABEL[event.kind]}
        </p>
        <p className="cutin-dialogue">{text.slice(0, chars)}</p>
        {complete && (
          <div className={`cutin-stamp ${stamp.tone}`}>{stamp.text}</div>
        )}
      </div>

      <div className="cutin-footer">
        {complete ? (
          <span className="cutin-advance">
            <span className="blink">▶</span> TOCÁ PARA SEGUIR
          </span>
        ) : (
          <span className="typing">...</span>
        )}
      </div>
    </div>
  )
}

export default DuelCutIn
