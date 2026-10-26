import { useEffect, useMemo, useState } from 'react'
import {
  ATTACK_AP_COST,
  ATTACK_LABEL,
  ATTACK_SHORT,
  CLASS_LETTERS,
  DEFENSE_SCHEMES,
  PRESSURE_VALUE,
  SCHEME_LABEL,
  SCHEME_SHORT,
  attackKindsFor,
  isSeam,
  legalReceivers,
  moveDistance,
  playersOf,
  qualityLabel,
  receptionQuality,
  receptionValue,
  setQuality,
} from '../engine'
import type {
  AttackKind,
  Command,
  GameState,
  Player,
  Quality,
} from '../engine'
import type { Tell } from '../engine'

type Props = {
  game: GameState
  tells: Tell[]
  playerTurn: boolean
  attackKind: AttackKind | null
  onAttackKind: (kind: AttackKind | null) => void
  onCommand: (command: Command) => void
  onContinue: () => void
  onRestart: () => void
}

const classPriority = (player: Player): number => {
  switch (player.classId) {
    case 'setter':
      return 0
    case 'libero':
      return 1
    case 'middle':
      return 2
    case 'opposite':
      return 3
  }
}

const RECEIVE_TEXT: Record<Quality, string> = {
  0: 'No controla · punto rival',
  1: 'Pase malo',
  2: 'Pase bueno',
  3: 'Pase perfecto · +1 energía',
}

const PhaseBar = ({ step, label }: { step: string; label: string }) => (
  <div className="command-head">
    <span className="command-step">{step}</span>
    <span className="command-label">{label}</span>
  </div>
)

const TellBox = ({ tells }: { tells: Tell[] }) => (
  <div className="tell-box">
    <div className="tell-head">
      <span>PISTA DEL RIVAL</span>
      <span>{tells.length}/2</span>
    </div>
    {tells.map((tell) => (
      <p key={tell.id} className="tell-line">
        <span className="tell-arrow">▸</span> {tell.text}
      </p>
    ))}
    {tells.length === 0 && (
      <p className="tell-line opacity-60">El rival todavía no se movió.</p>
    )}
  </div>
)

const RIVAL_PHASE: Partial<
  Record<GameState['phase'], { label: string; copy: string }>
> = {
  SERVE: {
    label: 'SAQUE RIVAL',
    copy: 'El rival prepara el saque. Mirá dónde va antes de recibir.',
  },
  RECEIVE: {
    label: 'RECEPCIÓN RIVAL',
    copy: 'El rival acomoda la recepción. Su pase define el armado.',
  },
  SET: {
    label: 'ARMADO RIVAL',
    copy: 'El rival elige a su atacante. Después te toca defender.',
  },
}

const RivalTurn = ({
  game,
  onContinue,
}: {
  game: GameState
  onContinue: () => void
}) => {
  const info = RIVAL_PHASE[game.phase] ?? {
    label: 'TURNO RIVAL',
    copy: 'El rival juega su carta.',
  }
  const narration = game.log.at(-1)?.text
  /** Evita que un doble toque se lleve dos carteles sin leerlos. */
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 350)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <section className="command-panel rival-turn">
      <PhaseBar step="RIVAL" label={info.label} />
      <p className="command-copy">{info.copy}</p>
      {narration && (
        <div className="beat-line">
          <span className="beat-tag">ÚLTIMO MOVIMIENTO</span>
          <p>{narration}</p>
        </div>
      )}
      <button
        type="button"
        className="pixel-btn primary rival-continue"
        disabled={!ready}
        onClick={onContinue}
      >
        CONTINUAR ▶
      </button>
      <p className="command-hint">Leé el cartel y tocá CONTINUAR.</p>
    </section>
  )
}

const CommandMenu = ({
  game,
  tells,
  playerTurn,
  attackKind,
  onAttackKind,
  onCommand,
  onContinue,
  onRestart,
}: Props) => {
  const team = useMemo(() => playersOf(game, game.playerSide), [game])
  const attacker = game.attackerId
    ? game.players.find((player) => player.id === game.attackerId)
    : undefined

  const receivers = useMemo(() => {
    if (game.phase !== 'RECEIVE' || game.possession !== game.playerSide) {
      return []
    }
    const seam = isSeam(game.players, game.ball.cell, game.playerSide)
    return legalReceivers(game)
      .map((player) => {
        const value = receptionValue(
          player,
          game.ball.cell,
          PRESSURE_VALUE[game.ball.pressure],
          seam,
        )
        return {
          player,
          value,
          quality: receptionQuality(value),
        }
      })
      .sort(
        (a, b) =>
          b.quality - a.quality ||
          b.value - a.value ||
          a.player.id.localeCompare(b.player.id),
      )
  }, [game])

  const setInfo = useMemo(() => {
    if (game.phase !== 'SET' || game.possession !== game.playerSide) {
      return null
    }
    const candidates = team.filter(
      (player) => player.id !== game.ball.lastTouchId,
    )
    const ranked = candidates
      .map((player) => {
        const distance = moveDistance(player.cell, game.ball.cell)
        return {
          player,
          distance,
          quality: setQuality(game.passQuality, player, distance),
        }
      })
      .sort(
        (a, b) =>
          b.quality - a.quality ||
          classPriority(a.player) - classPriority(b.player) ||
          a.distance - b.distance ||
          a.player.id.localeCompare(b.player.id),
      )
    const best = ranked[0]
    if (!best) return null
    const setter = best.player
    const quality = best.quality
    const targets = team.filter(
      (player) =>
        player.id !== setter.id &&
        player.classId !== 'libero' &&
        attackKindsFor(player).length > 0,
    )
    return { setter, quality, targets }
  }, [game, team])

  if (game.phase === 'MATCH_END') {
    const won = game.winner === game.playerSide
    return (
      <section className="command-panel">
        <PhaseBar step="FIN" label={won ? 'GANASTE EL SET' : 'SET RIVAL'} />
        <div className="result-box">
          <p className={won ? 'result-win' : 'result-lose'}>
            {won ? '¡VICTORIA!' : 'DERROTA'}
          </p>
          <p className="result-score">
            {game.score[game.playerSide]} —{' '}
            {game.score[game.playerSide === 'home' ? 'away' : 'home']}
          </p>
        </div>
        <button type="button" className="pixel-btn primary" onClick={onRestart}>
          JUGAR OTRO SET
        </button>
      </section>
    )
  }

  if (!playerTurn) {
    return (
      <RivalTurn
        key={`${game.phase}-${game.log.length}`}
        game={game}
        onContinue={onContinue}
      />
    )
  }

  if (game.phase === 'SERVE') {
    return (
      <section className="command-panel">
        <PhaseBar step="1/3" label="TU SAQUE" />
        <p className="command-copy">
          Tocá una zona del campo rival. Buscá dónde el rival reciba peor.
        </p>
        <div className="command-hint">
          Las seis zonas están marcadas con <span className="gold">◎</span>.
        </div>
      </section>
    )
  }

  if (game.phase === 'RECEIVE') {
    return (
      <section className="command-panel">
        <PhaseBar step="1/3" label="RECEPCIÓN" />
        <p className="command-copy">Elegí quién recibe el saque.</p>
        <div className="command-list">
          {receivers.map(({ player, quality, value }) => (
            <button
              key={player.id}
              type="button"
              className={`pixel-btn command-row ${
                quality === 0 ? 'danger' : ''
              }`}
              onClick={() =>
                onCommand({ type: 'RECEIVE', playerId: player.id })
              }
            >
              <span className="command-letter">
                {CLASS_LETTERS[player.classId]}
              </span>
              <span className="command-main">
                <span className="command-title">{player.name}</span>
                <span className="command-sub">
                  {RECEIVE_TEXT[quality]} · R{value}
                </span>
              </span>
            </button>
          ))}
          {receivers.length === 0 && (
            <p className="command-copy danger-text">
              Nadie llega: el saque sería ace.
            </p>
          )}
        </div>
        <button
          type="button"
          className="pixel-btn ghost"
          onClick={() => onCommand({ type: 'RECEIVE', playerId: null })}
        >
          DEJAR PASAR EL SAQUE (ACE)
        </button>
      </section>
    )
  }

  if (game.phase === 'SET' && setInfo) {
    return (
      <section className="command-panel">
        <PhaseBar step="2/3" label="ARMADO" />
        <p className="command-copy">
          <span className="gold">{setInfo.setter.name}</span> reparte · pase{' '}
          {qualityLabel(setInfo.quality as Quality)}
        </p>
        {setInfo.quality === 0 && (
          <p className="command-copy danger-text">
            El armado se queda corto: si tocás un atacante, el punto es rival.
          </p>
        )}
        <div className="command-list">
          {setInfo.targets.map((target) => {
            const kinds = attackKindsFor(target)
            return (
              <button
                key={target.id}
                type="button"
                className={`pixel-btn command-row ${
                  setInfo.quality === 0 ? 'danger' : ''
                }`}
                onClick={() =>
                  onCommand({
                    type: 'SET',
                    setterId: setInfo.setter.id,
                    targetId: target.id,
                  })
                }
              >
                <span className="command-letter">
                  {CLASS_LETTERS[target.classId]}
                </span>
                <span className="command-main">
                  <span className="command-title">{target.name}</span>
                  <span className="command-sub">
                    {kinds.map((kind) => ATTACK_LABEL[kind]).join(' · ')}
                  </span>
                </span>
              </button>
            )
          })}
          {setInfo.targets.length === 0 && (
            <p className="command-copy danger-text">
              No hay atacante legal. El armado se queda sin opciones.
            </p>
          )}
        </div>
      </section>
    )
  }

  if (game.phase === 'ATTACK' && attacker) {
    const available = attackKindsFor(attacker)
    return (
      <section className="command-panel">
        <PhaseBar step="3/3" label="TU JUGADA" />
        <TellBox tells={tells} />
        <div className="attack-context">
          <span>
            Ataca <b>{attacker.name}</b>
          </span>
          <span>
            armado <b>{qualityLabel(game.setQuality)}</b> · energía{' '}
            <b>{game.ap}</b>
          </span>
        </div>
        {attackKind ? (
          <div className="target-prompt">
            <p>
              <span className="gold">{ATTACK_LABEL[attackKind]}</span> · tocá
              una zona del campo rival.
            </p>
            <button
              type="button"
              className="pixel-btn ghost"
              onClick={() => onAttackKind(null)}
            >
              CAMBIAR JUGADA
            </button>
          </div>
        ) : (
          <div className="kind-grid">
            {available.map((kind) => {
              const cost = ATTACK_AP_COST[kind]
              const enabled = game.ap >= cost
              return (
                <button
                  key={kind}
                  type="button"
                  className="pixel-btn kind-btn"
                  disabled={!enabled}
                  onClick={() => onAttackKind(kind)}
                >
                  <span className="command-title">{ATTACK_LABEL[kind]}</span>
                  <span className="command-sub">{ATTACK_SHORT[kind]}</span>
                  <span className="kind-cost">
                    {cost > 0 ? `${cost} ENERGÍA` : 'GRATIS'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  if (game.phase === 'DEFEND') {
    return (
      <section className="command-panel">
        <PhaseBar step="3/3" label="TU DEFENSA" />
        <TellBox tells={tells} />
        <p className="command-copy">
          El rival ya eligió su ataque. Elegí cómo defender.
        </p>
        <div className="scheme-grid">
          {DEFENSE_SCHEMES.map((scheme) => (
            <button
              key={scheme}
              type="button"
              className="pixel-btn scheme-btn"
              onClick={() => onCommand({ type: 'DEFEND', scheme })}
            >
              <span className="command-title">{SCHEME_LABEL[scheme]}</span>
              <span className="command-sub">{SCHEME_SHORT[scheme]}</span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="command-panel">
      <PhaseBar step="…" label="ESPERA" />
      <div className="waiting-box">EL TABLERO SE ACOMODA…</div>
    </section>
  )
}

export default CommandMenu
