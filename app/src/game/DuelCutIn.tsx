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
  /** Una repetición arranca directamente en el resultado. */
  startAtResult?: boolean
  onClose: () => void
}

/** Tiempo mínimo que el resultado queda en pantalla antes de poder cerrar. */
const RESULT_LOCK_MS = 700
/** Velocidad de tipeo: legible, y siempre se puede completar con un toque. */
const TYPE_MS = 24

const DuelCutIn = ({ game, duel, startAtResult = false, onClose }: Props) => {
  const event = duel.event
  const attacker = game.players.find((player) => player.id === event.playerId)
  const defender = game.players.find(
    (player) => player.id === event.resolution.defenderId,
  )
  const playerAttacked = attacker?.side === game.playerSide
  const zone = zoneOf(event.target.row, event.target.col)
  const resolution = event.resolution

  const { playText, outcomeText } = useMemo(() => {
    const attackerName = attacker?.name ?? 'Atacante'
    const defenderName = defender?.name ?? 'Defensa'
    const first = `${attackerName} ataca con ${ATTACK_LABEL[event.kind]} a la zona ${zone}.`
    const second = playerAttacked
      ? `El rival responde: ${SCHEME_LABEL[event.scheme]}.`
      : `Vos respondés: ${SCHEME_LABEL[event.scheme]}.`

    let outcome: string
    if (resolution.outcome === 'point') {
      outcome = playerAttacked
        ? 'El ataque encuentra el hueco: ¡punto tuyo!'
        : 'El ataque encuentra el hueco: punto rival.'
    } else if (resolution.outcome === 'blocked') {
      outcome = playerAttacked
        ? 'La defensa cierra el ataque: punto rival.'
        : 'La defensa cierra el ataque: ¡punto tuyo!'
    } else {
      outcome = `${defenderName} salva la bola: pase ${qualityLabel(
        resolution.digQuality ?? 0,
      )}.`
    }

    return {
      playText: [first, second].join('\n'),
      outcomeText: outcome,
    }
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

  const [beat, setBeat] = useState<'play' | 'result'>(
    startAtResult ? 'result' : 'play',
  )
  const [chars, setChars] = useState(startAtResult ? playText.length : 0)
  const [resultReady, setResultReady] = useState(false)
  const complete = chars >= playText.length

  useEffect(() => {
    playSfx('reveal')
  }, [])

  useEffect(() => {
    if (beat !== 'play') return
    const timer = window.setInterval(() => {
      setChars((current) => {
        if (current >= playText.length) {
          window.clearInterval(timer)
          return current
        }
        return Math.min(playText.length, current + 1)
      })
    }, TYPE_MS)
    return () => window.clearInterval(timer)
  }, [beat, playText])

  useEffect(() => {
    if (beat !== 'result') return
    const timer = window.setTimeout(
      () => setResultReady(true),
      RESULT_LOCK_MS,
    )
    return () => window.clearTimeout(timer)
  }, [beat])

  const goToResult = () => {
    if (beat !== 'play') return
    playSfx('click')
    setResultReady(false)
    setBeat('result')
  }

  /** Tocar el fondo solo completa el tipeo o pasa al resultado. Nunca cierra. */
  const tapBackdrop = () => {
    if (beat !== 'play') return
    if (!complete) {
      setChars(playText.length)
      return
    }
    goToResult()
  }

  const finish = () => {
    if (beat !== 'result' || !resultReady) return
    playSfx('click')
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
    <div className="cutin-overlay scanlines" onClick={tapBackdrop}>
      <div className="cutin-top">
        <span className="cutin-kicker">
          {startAtResult ? 'REPETICIÓN' : 'DUELO OCULTO'}
        </span>
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
        {beat === 'play' ? (
          <p className="cutin-dialogue">{playText.slice(0, chars)}</p>
        ) : (
          <>
            <p className="cutin-dialogue">{outcomeText}</p>
            <div className={`cutin-stamp ${stamp.tone}`}>{stamp.text}</div>
          </>
        )}
      </div>

      <div className="cutin-footer">
        {beat === 'play' ? (
          complete ? (
            <button
              type="button"
              className="pixel-btn primary cutin-next"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                goToResult()
              }}
            >
              VER EL RESULTADO ▶
            </button>
          ) : (
            <span className="typing">TOCÁ PARA COMPLETAR…</span>
          )
        ) : (
          <button
            type="button"
            className="pixel-btn primary cutin-next"
            disabled={!resultReady}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              finish()
            }}
          >
            {resultReady ? 'CONTINUAR ▶' : 'LEÉ EL RESULTADO…'}
          </button>
        )}
      </div>
    </div>
  )
}

export default DuelCutIn
