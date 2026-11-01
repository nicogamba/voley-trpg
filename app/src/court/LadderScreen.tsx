import { useMemo } from 'react'
import { CLASS_LETTERS, CLASS_NAMES } from '../engine'
import { Flag } from './TeamBadge'
import {
  LADDER,
  isLadderComplete,
  stageAt,
  type LadderProgress,
} from './ladder'
import { TEAMS, buildRoster } from './teams'
import type { ClassId } from '../engine'

type Props = {
  progress: LadderProgress
  onPlay: () => void
  onBack: () => void
  onReset: () => void
  /** Muestra el formato CT1: set a 25 con marcador inicial. */
  ct1?: boolean
}

const STAT_KEYS = ['tecnica', 'potencia', 'velocidad', 'lectura'] as const
const STAT_LABELS = ['TÉCNICA', 'POTENCIA', 'VELOCIDAD', 'LECTURA'] as const

const STYLE_NOTE: Record<string, string> = {
  ORDEN: 'JUEGA SEGURO Y BUSCA EL HUECO',
  MURO: 'CIERRA LA RED ANTES DEL GOLPE',
  RITMO: 'CORRE TODO Y DEVUELVE LO IMPOSIBLE',
  POTENCIA: 'GOLPEA FUERTE POR LAS PUNTAS',
  'JOGO BONITO': 'NO REGALA NADA Y DEFIENDE TODO',
}

const RosterCard = ({
  entries,
}: {
  entries: ReturnType<typeof buildRoster>
}) => (
  <ul className="ladder-roster">
    {entries.map((player) => (
      <li key={player.id} className="ladder-player">
        <span
          className={`ladder-class ladder-class-${player.classId}`}
          title={CLASS_NAMES[player.classId as ClassId]}
        >
          {CLASS_LETTERS[player.classId as ClassId]}
        </span>
        <div className="ladder-player-body">
          <span className="ladder-player-name">{player.name}</span>
          <div className="ladder-stats">
            {STAT_KEYS.map((key, index) => (
              <span
                key={key}
                className="ladder-stat"
                title={`${STAT_LABELS[index]} ${player.stats[key]}`}
              >
                <i style={{ width: `${Math.min(100, player.stats[key] * 14)}%` }} />
              </span>
            ))}
          </div>
        </div>
      </li>
    ))}
  </ul>
)

export const LadderScreen = ({
  progress,
  onPlay,
  onBack,
  onReset,
  ct1 = false,
}: Props) => {
  const complete = isLadderComplete(progress)
  const stage = stageAt(progress)
  const rival = stage ? TEAMS[stage.rival] : TEAMS.bra
  const rivalRoster = useMemo(
    () =>
      stage
        ? buildRoster(stage.rival, 'away', stage.boost, stage.techBoost)
        : buildRoster('bra', 'away'),
    [stage],
  )
  const scout = useMemo(
    () =>
      STAT_KEYS.map((key) => ({
        key,
        value:
          rivalRoster.reduce((sum, player) => sum + player.stats[key], 0) /
          rivalRoster.length,
      })),
    [rivalRoster],
  )

  return (
    <div className="ladder-shell scanlines">
      <header className="ladder-head">
        <button type="button" className="court-chip" onClick={onBack}>
          SALIR
        </button>
        <div className="ladder-title">
          <span>GIRA MUNDIAL</span>
          <b>
            {complete
              ? 'COMPLETA'
              : `ETAPA ${progress.stage + 1}/${LADDER.length}`}
          </b>
        </div>
        <span className="ladder-badge">
          {`${progress.cleared}/${LADDER.length}`}
        </span>
      </header>

      <div className="ladder-main">
        <ol className="ladder-route" aria-label="Etapas de la gira">
          {LADDER.map((item, index) => {
            const team = TEAMS[item.rival]
            const done = index < progress.stage
            const current = index === progress.stage
            return (
              <li
                key={item.id}
                className={[
                  'ladder-node',
                  done ? 'is-done' : '',
                  current ? 'is-current' : '',
                  item.final ? 'is-final' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={current ? 'step' : undefined}
              >
                <span className="ladder-node-flag">
                  <Flag team={team} />
                  {done && <i className="ladder-check">✓</i>}
                </span>
                <b>{team.short}</b>
                <span>{done ? 'OK' : item.round}</span>
              </li>
            )
          })}
        </ol>

        {complete ? (
          <section className="ladder-champion">
            <div className="ladder-cup" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>ARGENTINA CAMPEÓN</h2>
            <p>5 PAÍSES · 5 PARTIDOS</p>
            <div className="ladder-champion-score">
              {`${progress.cleared}/${LADDER.length} ETAPAS`}
            </div>
            <button
              type="button"
              className="pixel-btn primary big"
              onClick={onReset}
            >
              ↻ VOLVER A JUGAR
            </button>
          </section>
        ) : (
          <section className="ladder-rival">
            <header className="ladder-rival-head">
              <div
                className="ladder-rival-kit"
                style={{
                  background: rival.kit.shirt,
                  borderColor: rival.kit.trim,
                }}
                aria-hidden="true"
              >
                <i style={{ background: rival.kit.shorts }} />
              </div>
              <div className="ladder-rival-text">
                <span className="ladder-round">
                  {`${stage?.final ? '★ FINAL' : stage?.round} · ${stage?.city}`}
                </span>
                <h2>{rival.name}</h2>
                <span className="ladder-style">{`ESTILO ${rival.style}`}</span>
              </div>
              <Flag team={rival} />
            </header>

            <div className="ladder-scout">
              {scout.map((stat, index) => (
                <div key={stat.key} className="ladder-scout-row">
                  <span>{STAT_LABELS[index]}</span>
                  <div className="ladder-scout-bar">
                    <i
                      style={{
                        width: `${Math.min(100, (stat.value / 7) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{stat.value.toFixed(1)}</b>
                </div>
              ))}
              <p className="ladder-note">{STYLE_NOTE[rival.style] ?? ''}</p>
            </div>

            <RosterCard entries={rivalRoster} />

            {progress.attempts > 0 && progress.lastResult === 'loss' && (
              <p className="ladder-retry">
                {`DERROTA CON ${TEAMS[stage!.rival].short} · REINTENTÁS LA ETAPA`}
              </p>
            )}
          </section>
        )}
      </div>

      {!complete && (
        <footer className="ladder-foot">
          <button
            type="button"
            className="pixel-btn primary big"
            onClick={onPlay}
          >
            {`▶ JUGAR ${stage?.final ? 'LA FINAL' : `CON ${rival.short}`}`}
          </button>
          <p className="ladder-tip">
            {ct1 && stage
              ? `SET A 25 · INICIO ${stage.startScore.home}-${stage.startScore.away}`
              : `GANÁ ${stage?.targetScore} PUNTOS PARA AVANZAR`}
          </p>
        </footer>
      )}
    </div>
  )
}

export default LadderScreen
