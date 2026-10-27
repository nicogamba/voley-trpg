import { useEffect, useMemo, useRef, useState } from 'react'
import { ATTACK_AP_COST, ATTACK_LABEL } from '../engine'
import type { AttackKind, DefenseScheme } from '../engine'
import CourtCanvas from './CourtCanvas'
import CourtCutIn from './CourtCutIn'
import CourtDuelModal, { type DuelChoice } from './CourtDuelModal'
import CourtSidebar from './CourtSidebar'
import { primeAudio } from './audio'
import { COURT, cellDistance, cellsOfSide, cellOrigin, sameCell, zoneOf } from './geometry'
import type { LadderStage } from './ladder'
import {
  attackCandidates,
  attackOptions,
  defenseCandidates,
  schemeHint,
  schemeLabel,
  type MatchEvent,
  type MatchState,
} from './match'
import {
  aiServe,
  attack,
  createMatch,
  defend,
  legalServeTargets,
  nextDecision,
  serve,
  type EngineResult,
} from './matchEngine'
import { matchBeats } from './matchBeats'
import { mulberry32, type Rng } from './matchAi'
import { TEAMS, buildRoster } from './teams'
import { TeamBlock } from './TeamBadge'
import type {
  BeatSpec,
  CourtCell,
  CourtPlayer,
  CourtTeam,
  CutInSpec,
  Side,
} from './types'

type Props = {
  stage: LadderStage
  onBack: () => void
  onFinish: (won: boolean) => void
  muted: boolean
  onToggleMuted: () => void
}

type UiPhase =
  | 'setup'
  | 'moving'
  | 'serve'
  | 'attack'
  | 'defend'
  | 'wait'
  | 'anim'
  | 'ended'

type Move = {
  playerId: string
  name: string
  from: CourtCell
  to: CourtCell
}

type Animation = {
  pre: MatchState
  post: MatchState
  events: MatchEvent[]
  beats: BeatSpec[]
}

type DuelWindow =
  | {
      mode: 'attack'
      kind: AttackKind
      target: CourtCell
      candidates: CourtPlayer[]
      baseCost: number
      label: string
      detail: string
    }
  | {
      mode: 'defense'
      scheme: DefenseScheme
      candidates: CourtPlayer[]
      baseCost: number
      label: string
      detail: string
    }

const SERVER_ID = 'home-opposite'
const SETUP_HINT = 'ORDENÁ · TOCÁ UN JUGADOR'

const cloneCell = (target: CourtCell): CourtCell => ({ ...target })

const cloneRoster = (players: CourtPlayer[]): CourtPlayer[] =>
  players.map((player) => ({
    ...player,
    stats: { ...player.stats },
    cell: cloneCell(player.cell),
  }))

const buildTeams = (stage: LadderStage): Record<Side, CourtTeam> => ({
  home: TEAMS.arg,
  away: TEAMS[stage.rival],
})

const buildSetupRoster = (stage: LadderStage): CourtPlayer[] => [
  ...buildRoster('arg', 'home'),
  ...buildRoster(stage.rival, 'away', stage.boost, stage.techBoost),
]

const buildMoveScript = (move: Move): BeatSpec[] => {
  const beat: BeatSpec = {
    kind: 'move',
    duration: 320,
    caption: `MUEVE · ${move.name}`,
    moves: [
      {
        playerId: move.playerId,
        to: move.to,
        duration: 300,
        pose: 'run',
      },
    ],
  }
  if (move.playerId === SERVER_ID) {
    beat.ball = {
      to: move.to,
      arc: 10,
      zFrom: 46,
      zTo: 46,
      duration: 300,
    }
  }
  return [beat]
}

const cellPosition = (target: CourtCell) => {
  const origin = cellOrigin(target)
  return {
    left: `${(origin.x / COURT.width) * 100}%`,
    top: `${(origin.y / COURT.height) * 100}%`,
    width: `${(COURT.cellW / COURT.width) * 100}%`,
    height: `${(COURT.cellH / COURT.height) * 100}%`,
  }
}

export const CourtScreen = ({
  stage,
  onBack,
  onFinish,
  muted,
  onToggleMuted,
}: Props) => {
  const teams = useMemo(() => buildTeams(stage), [stage])
  const [roster, setRoster] = useState<CourtPlayer[]>(() =>
    buildSetupRoster(stage),
  )
  const [match, setMatch] = useState<MatchState>(() =>
    createMatch({
      roster: buildSetupRoster(stage),
      playerSide: 'home',
      server: 'home',
      targetScore: stage.targetScore,
      ai: stage.ai,
    }),
  )
  const [ui, setUi] = useState<UiPhase>('setup')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [move, setMove] = useState<Move | null>(null)
  const [setupSeq, setSetupSeq] = useState(0)
  const [runId, setRunId] = useState(0)
  const [caption, setCaption] = useState(SETUP_HINT)
  const [shownScore, setShownScore] = useState<Record<Side, number>>({
    home: 0,
    away: 0,
  })
  const [animation, setAnimation] = useState<Animation | null>(null)
  const [attackKind, setAttackKind] = useState<AttackKind | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cutin, setCutin] = useState<{
    spec: CutInSpec
    duration: number
  } | null>(null)
  const [stamp, setStamp] = useState<{
    key: number
    title: string
    side: Side
  } | null>(null)
  const [duel, setDuel] = useState<DuelWindow | null>(null)
  const rngRef = useRef<Rng>(mulberry32(0x20261027))
  const cutinTimer = useRef<number | null>(null)
  const stampTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (cutinTimer.current !== null) {
        window.clearTimeout(cutinTimer.current)
      }
      if (stampTimer.current !== null) {
        window.clearTimeout(stampTimer.current)
      }
    },
    [],
  )

  const clearCutIn = () => {
    if (cutinTimer.current !== null) {
      window.clearTimeout(cutinTimer.current)
      cutinTimer.current = null
    }
    setCutin(null)
  }

  const clearStamp = () => {
    if (stampTimer.current !== null) {
      window.clearTimeout(stampTimer.current)
      stampTimer.current = null
    }
    setStamp(null)
  }

  const showCutIn = (spec: CutInSpec, duration: number) => {
    const ms = Math.min(1200, Math.max(680, duration))
    if (cutinTimer.current !== null) {
      window.clearTimeout(cutinTimer.current)
    }
    setCutin({ spec, duration: ms })
    cutinTimer.current = window.setTimeout(() => {
      cutinTimer.current = null
      setCutin(null)
    }, ms)
  }

  const homeCells = useMemo(() => cellsOfSide('home'), [])

  const selected =
    roster.find((player) => player.id === selectedId) ?? null

  const setupServer =
    roster.find((player) => player.id === SERVER_ID) ?? roster[0]
  const setupBall = setupServer.cell

  /** Durante un movimiento, el jugador arranca en la celda vieja. */
  const displayPlayers = useMemo(() => {
    if (!move) return roster
    return roster.map((player) =>
      player.id === move.playerId
        ? { ...player, cell: move.from }
        : player,
    )
  }, [move, roster])

  const moveScript = useMemo(
    () => (move ? buildMoveScript(move) : []),
    [move],
  )

  const options = useMemo(
    () => (ui === 'attack' ? attackOptions(match) : []),
    [match, ui],
  )

  const selectedOption =
    options.find((option) => option.kind === attackKind) ?? null

  const attackHint =
    selectedOption && attackKind
      ? `ATAQUE · ${ATTACK_LABEL[attackKind]} · ELEGÍ LA ZONA`
      : 'ATAQUE · ELEGÍ EL GOLPE'

  const won = match.winner === 'home'

  const beginMatch = (formation: CourtPlayer[]) => {
    const fresh = createMatch({
      roster: cloneRoster(formation),
      playerSide: 'home',
      server: 'home',
      targetScore: stage.targetScore,
      ai: stage.ai,
    })
    setRoster(cloneRoster(formation))
    setMatch(fresh)
    setShownScore(fresh.score)
    setAnimation(null)
    setSelectedId(null)
    setMove(null)
    setAttackKind(null)
    setCaption(SETUP_HINT)
    setNotice(null)
    setDuel(null)
    clearCutIn()
    clearStamp()
    setSetupSeq((value) => value + 1)
    setRunId((value) => value + 1)
    setUi(nextDecision(fresh) === 'serve' ? 'serve' : 'wait')
  }

  const applyPost = (next: MatchState) => {
    setMatch(next)
    setShownScore(next.score)
    setAnimation(null)
    setAttackKind(null)
    setSelectedId(null)
    setMove(null)
    setDuel(null)
    clearCutIn()
    clearStamp()
    const decision = nextDecision(next)
    setUi(decision === 'end' ? 'ended' : decision)
    setRunId((value) => value + 1)
  }

  const play = (result: EngineResult) => {
    const beats = matchBeats(match, result.events, result.state, teams)
    if (beats.length === 0) {
      applyPost(result.state)
      return
    }
    setAnimation({
      pre: match,
      post: result.state,
      events: result.events,
      beats,
    })
    setUi('anim')
    setAttackKind(null)
    setSelectedId(null)
    setMove(null)
    setDuel(null)
    clearCutIn()
    clearStamp()
    setCaption(beats[0]?.caption ?? '')
    setRunId((value) => value + 1)
  }

  const run = (action: () => EngineResult) => {
    setNotice(null)
    try {
      play(action())
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'JUGADA INVÁLIDA'
      setNotice(message)
      setCaption(message)
    }
  }

  const finishAnimation = () => {
    if (!animation) return
    applyPost(animation.post)
  }

  const handlePoint = () => {
    const point = animation?.events.find((event) => event.type === 'POINT')
    if (point?.type !== 'POINT') return
    setShownScore(point.score)
    const title =
      point.reason === 'block'
        ? '¡BLOQUEO!'
        : point.reason === 'ace'
          ? '¡ACE!'
          : point.reason === 'cap'
            ? '¡RALLY LARGO!'
            : point.reason === 'error'
              ? `¡ERROR DE ${
                  teams[point.side === 'home' ? 'away' : 'home'].short
                }!`
              : '¡PUNTO!'
    if (stampTimer.current !== null) {
      window.clearTimeout(stampTimer.current)
    }
    setStamp({ key: Date.now(), title, side: point.side })
    stampTimer.current = window.setTimeout(() => {
      stampTimer.current = null
      setStamp(null)
    }, 1100)
  }

  const selectCell = (target: CourtCell) => {
    if (ui !== 'setup') return

    const occupant = roster.find((player) => sameCell(player.cell, target))
    if (occupant) {
      setSelectedId((current) =>
        current === occupant.id ? null : occupant.id,
      )
      return
    }

    if (!selected) return
    if (cellDistance(selected.cell, target) !== 1) {
      setSelectedId(null)
      return
    }

    setMove({
      playerId: selected.id,
      name: selected.name,
      from: selected.cell,
      to: target,
    })
    setSelectedId(null)
    setSetupSeq((value) => value + 1)
    setUi('moving')
  }

  const finishMove = () => {
    if (!move) return
    setRoster((current) =>
      current.map((player) =>
        player.id === move.playerId
          ? { ...player, cell: move.to }
          : player,
      ),
    )
    setMove(null)
    setUi('setup')
    setSetupSeq((value) => value + 1)
  }

  const resetPositions = () => {
    setRoster(buildSetupRoster(stage))
    setSelectedId(null)
    setMove(null)
    setSetupSeq((value) => value + 1)
  }

  const commitServe = (target: CourtCell) => {
    if (ui !== 'serve') return
    run(() => serve(match, target, rngRef.current))
  }

  const commitAttack = (target: CourtCell) => {
    if (ui !== 'attack' || !attackKind) return
    const candidates = attackCandidates(match, attackKind, target)
    if (candidates.length === 0) {
      setNotice('NO HAY ATACANTE PARA ESA ZONA')
      return
    }
    setDuel({
      mode: 'attack',
      kind: attackKind,
      target,
      candidates,
      baseCost: ATTACK_AP_COST[attackKind],
      label: ATTACK_LABEL[attackKind],
      detail: `ZONA ${zoneOf('away', target.row, target.col)} · ${ATTACK_AP_COST[attackKind]} EN`,
    })
  }

  const commitDefense = (scheme: DefenseScheme) => {
    if (ui !== 'defend') return
    setDuel({
      mode: 'defense',
      scheme,
      candidates: defenseCandidates(match, scheme),
      baseCost: 0,
      label: schemeLabel(scheme),
      detail: schemeHint(scheme).toUpperCase(),
    })
  }

  const confirmDuel = (choice: DuelChoice) => {
    const pending = duel
    setDuel(null)
    if (!pending) return
    if (pending.mode === 'attack') {
      run(() =>
        attack(match, pending.kind, pending.target, rngRef.current, {
          attackerId: choice.playerId,
          technique: choice.technique,
        }),
      )
      return
    }
    run(() =>
      defend(match, pending.scheme, rngRef.current, {
        defenderId: choice.playerId,
        technique: choice.technique,
      }),
    )
  }

  const continueAiServe = () => {
    if (ui !== 'wait') return
    run(() => aiServe(match, rngRef.current))
  }

  const captionText = (() => {
    if (notice) return notice
    if (ui === 'setup') {
      return selected ? `${selected.name} · ELEGÍ UNA ZONA` : SETUP_HINT
    }
    if (ui === 'moving' && move) return `MUEVE · ${move.name}`
    if (ui === 'serve') {
      return `SAQUE · ${teams.home.short} · ELEGÍ LA ZONA`
    }
    if (ui === 'attack') return attackHint
    if (ui === 'defend') return 'DEFENSA · ELEGÍ EL ESQUEMA'
    if (ui === 'wait') return 'SAQUE RIVAL · CONTINUAR'
    if (ui === 'ended') {
      return won
        ? `¡${teams.home.name} GANA · ${match.score.home}-${match.score.away}!`
        : `¡${teams.away.name} GANA · ${match.score.home}-${match.score.away}!`
    }
    return caption
  })()

  const canvasKey =
    ui === 'anim'
      ? `anim-${runId}`
      : ui === 'setup'
        ? `setup-${setupSeq}`
        : ui === 'moving'
          ? `move-${setupSeq}`
          : `still-${runId}-${ui}`

  const canvasPlayers = animation
    ? animation.pre.players
    : ui === 'moving'
      ? displayPlayers
      : ui === 'setup'
        ? roster
        : match.players

  const canvasScript = animation
    ? animation.beats
    : ui === 'moving'
      ? moveScript
      : []

  const canvasBall = animation
    ? animation.pre.ball
    : ui === 'setup' || ui === 'moving'
      ? setupBall
      : match.ball

  const renderSetupOverlay = () => (
    <div
      className="court-hit-layer"
      role="group"
      aria-label="Ordená tus jugadores"
    >
      {homeCells.map((target) => {
        const occupant = roster.find((player) =>
          sameCell(player.cell, target),
        )
        const zone = zoneOf('home', target.row, target.col)
        const isSelected = occupant?.id === selectedId
        const isDest =
          Boolean(selected) &&
          !occupant &&
          cellDistance(selected!.cell, target) === 1

        return (
          <button
            key={`${target.row}-${target.col}`}
            type="button"
            style={cellPosition(target)}
            className={[
              'court-hit',
              occupant ? 'court-hit-player' : '',
              isSelected ? 'court-hit-selected' : '',
              isDest ? 'court-hit-dest' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={
              occupant
                ? `Zona ${zone}, ${occupant.name}, ${
                    isSelected ? 'seleccionado' : 'elegir para mover'
                  }`
                : `Zona ${zone}, libre${isDest ? ', destino' : ''}`
            }
            aria-pressed={isSelected}
            onClick={() => selectCell(target)}
          />
        )
      })}
    </div>
  )

  const renderServeOverlay = () => (
    <div
      className="court-hit-layer"
      role="group"
      aria-label="Elegí la zona del saque"
    >
      {legalServeTargets(match).map((target) => {
        const zone = zoneOf('away', target.row, target.col)
        return (
          <button
            key={`${target.row}-${target.col}`}
            type="button"
            style={cellPosition(target)}
            className="court-hit court-hit-valid court-hit-serve"
            aria-label={`Sacar a la zona ${zone}`}
            onClick={() => commitServe(target)}
          >
            <span className="court-zone-tag">Z{zone}</span>
          </button>
        )
      })}
    </div>
  )

  const renderAttackOverlay = () => {
    if (!selectedOption) return null
    return (
      <div
        className="court-hit-layer"
        role="group"
        aria-label="Elegí la zona del ataque"
      >
        {cellsOfSide('away').map((target) => {
          const valid = selectedOption.targets.some((option) =>
            sameCell(option, target),
          )
          const zone = zoneOf('away', target.row, target.col)
          return (
            <button
              key={`${target.row}-${target.col}`}
              type="button"
              style={cellPosition(target)}
              className={[
                'court-hit',
                valid ? 'court-hit-valid court-hit-attack' : 'court-hit-off',
              ].join(' ')}
              aria-label={`Atacar a la zona ${zone}${
                valid ? '' : ', no disponible'
              }`}
              disabled={!valid}
              onClick={() => commitAttack(target)}
            >
              {valid && (
                <span className="court-zone-tag">Z{zone}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const renderOverlay = () => {
    if (ui === 'setup') return renderSetupOverlay()
    if (ui === 'serve') return renderServeOverlay()
    if (ui === 'attack') return renderAttackOverlay()
    return null
  }

  const renderPanel = () => {
    if (ui === 'setup') {
      return (
        <div className="court-panel">
          <button
            type="button"
            onClick={() => beginMatch(roster)}
            className="pixel-btn primary"
          >
            ▶ EMPEZAR PARTIDO
          </button>
          <div className="court-panel-stack">
            <button
              type="button"
              onClick={resetPositions}
              className="pixel-btn secondary"
            >
              REINICIAR
            </button>
            <button
              type="button"
              onClick={onBack}
              className="pixel-btn ghost"
            >
              VOLVER
            </button>
          </div>
        </div>
      )
    }

    if (ui === 'serve') {
      return (
        <div className="court-panel court-panel-single">
          <div className="court-hint">
            TOCÁ UNA ZONA DEL RIVAL PARA SACAR
          </div>
        </div>
      )
    }

    if (ui === 'attack') {
      return (
        <div className="court-actions" role="group" aria-label="Elegí el ataque">
          {options.map((option) => (
            <button
              key={option.kind}
              type="button"
              className={[
                'court-action',
                option.kind === attackKind ? 'is-selected' : '',
                option.affordable ? '' : 'is-locked',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={option.kind === attackKind}
              disabled={!option.affordable}
              onClick={() => {
                setNotice(null)
                setAttackKind((current) =>
                  current === option.kind ? null : option.kind,
                )
              }}
            >
              <span>{ATTACK_LABEL[option.kind]}</span>
              <b>{ATTACK_AP_COST[option.kind]}</b>
            </button>
          ))}
        </div>
      )
    }

    if (ui === 'defend') {
      return (
        <div className="court-schemes" role="group" aria-label="Elegí la defensa">
          {(
            [
              ['wall', 'MURO', 'Cierra la red'],
              ['spread', 'ABIERTO', 'Cubre el ancho'],
              ['deep', 'PROFUNDO', 'Espera atrás'],
              ['libero', 'LÍBERO', 'Lee las manos'],
            ] as const
          ).map(([scheme, label, hint]) => (
            <button
              key={scheme}
              type="button"
              className="court-scheme"
              onClick={() => commitDefense(scheme)}
            >
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </div>
      )
    }

    if (ui === 'wait') {
      return (
        <div className="court-panel court-panel-single">
          <button
            type="button"
            onClick={continueAiServe}
            className="pixel-btn primary"
          >
            CONTINUAR · SAQUE RIVAL
          </button>
        </div>
      )
    }

    if (ui === 'ended') {
      return (
        <div className="court-panel">
          <button
            type="button"
            onClick={() =>
              won ? onFinish(true) : beginMatch(roster)
            }
            className="pixel-btn primary"
          >
            {won ? 'SIGUIENTE ▶' : '↻ REINTENTAR'}
          </button>
          <button type="button" onClick={onBack} className="pixel-btn ghost">
            SALIR
          </button>
        </div>
      )
    }

    return (
      <div className="court-panel court-panel-single">
        <div className="court-hint">EN JUEGO…</div>
      </div>
    )
  }

  const showExit = ui !== 'setup' && ui !== 'ended'
  const homeRoster = match.players.filter((player) => player.side === 'home')
  const awayRoster = match.players.filter((player) => player.side === 'away')

  return (
    <>
      <div className="court-arena">
        <CourtSidebar
        side="home"
        team={teams.home}
        players={homeRoster}
        kicker={`${stage.round} · ${stage.city}`}
        note={`A ${stage.targetScore} PUNTOS`}
      />

      <div
        className="court-shell scanlines"
        onPointerDown={() => {
          if (!muted) primeAudio()
        }}
      >
        <header className="court-hud">
        <TeamBlock team={teams.home} side="home" />

        <div className="court-score">
          <div
            className="court-score-line"
            key={`${shownScore.home}-${shownScore.away}`}
          >
            <span className="court-score-num">{shownScore.home}</span>
            <span className="court-score-sep">×</span>
            <span className="court-score-num">{shownScore.away}</span>
          </div>
          <p className="court-score-label">
            {`A ${stage.targetScore} · ${stage.round}`}
          </p>
          <div
            className={`court-energy${
              match.possession !== match.playerSide ? ' is-rival' : ''
            }`}
            aria-label={`Energía ${
              match.possession === match.playerSide ? 'tuya' : 'rival'
            } ${match.ap} de 3`}
          >
            {[0, 1, 2].map((pip) => (
              <i key={pip} className={pip < match.ap ? 'is-on' : ''} />
            ))}
          </div>
        </div>

        <TeamBlock team={teams.away} side="away" />
      </header>

      <div className="court-stage">
        <div className="court-center">
          <div className="court-frame">
            <CourtCanvas
              key={canvasKey}
              players={canvasPlayers}
              script={canvasScript}
              initialBall={canvasBall}
              teams={teams}
              muted={muted}
              onCaption={setCaption}
              onPoint={animation ? handlePoint : undefined}
              onCutIn={showCutIn}
              onEnd={
                animation
                  ? finishAnimation
                  : ui === 'moving'
                    ? finishMove
                    : undefined
              }
            />

            {cutin && (
              <CourtCutIn
                cutin={cutin.spec}
                players={animation?.pre.players ?? match.players}
                duration={cutin.duration}
                onSkip={clearCutIn}
              />
            )}

            {stamp && (
              <div
                key={stamp.key}
                className={`court-stamp is-${stamp.side}`}
                aria-hidden="true"
              >
                <strong>{stamp.title}</strong>
                <span>{teams[stamp.side].short}</span>
              </div>
            )}

            {renderOverlay()}
          </div>

          <div className="court-caption-bar">
            <p
              className={`court-caption${
                ui === 'ended' ? ' is-ended' : ''
              }`}
              aria-live="polite"
            >
              {captionText}
            </p>
            <button
              type="button"
              className="court-chip court-chip-icon"
              onClick={onToggleMuted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {showExit && (
              <button
                type="button"
                className="court-chip"
                onClick={onBack}
              >
                SALIR
              </button>
            )}
          </div>
        </div>
      </div>

      {renderPanel()}
      </div>

        <CourtSidebar
          side="away"
          team={teams.away}
          players={awayRoster}
          kicker="RIVAL"
          note={`ESTILO ${TEAMS[stage.rival].style}`}
          commentary={captionText}
        />
      </div>

      {duel && (
        <CourtDuelModal
          mode={duel.mode}
          players={duel.candidates}
          opponent={teams.away}
          label={duel.label}
          detail={duel.detail}
          resourceLabel={duel.mode === 'attack' ? 'ENERGÍA' : 'TÉCNICA'}
          resourceValue={
            duel.mode === 'attack'
              ? match.ap
              : match.defenseTechniqueUsed
                ? 0
                : 1
          }
          baseCost={duel.baseCost}
          techniquesLocked={
            duel.mode === 'defense' && match.defenseTechniqueUsed
          }
          onCancel={() => setDuel(null)}
          onConfirm={confirmDuel}
        />
      )}
    </>
  )
}

export default CourtScreen
