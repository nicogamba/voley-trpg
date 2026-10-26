import { useEffect, useMemo, useState } from 'react'
import Board from './game/Board'
import type { CellPreview } from './game/Board'
import { isPlayerTurn, useGame } from './game/store'
import {
  Coach,
  HelpSheet,
  TitleScreen,
  TutorialComplete,
} from './game/Tutorial'
import {
  ATTACK_AP_COST,
  PRESSURE_VALUE,
  TEMPO_AP_COST,
  TEMPO_ATTACKS,
  cellKey,
  cellsOfSide,
  evaluateAttack,
  isAttackAllowed,
  isOccupied,
  isSeam,
  moveDistance,
  orthogonalNeighborCells,
  playersOf,
  qualityLabel,
  reaches,
  receptionQuality,
  receptionValue,
  sameCell,
  setQuality,
} from './engine'
import type {
  AttackKind,
  Cell,
  Command,
  Player,
  Quality,
  Tempo,
} from './engine'

const KIND_LABEL: Record<AttackKind, string> = {
  power: 'Potencia',
  placement: 'Colocación',
  quick: 'Rápido',
  pipe: 'Pipe',
  wipe: 'Wipe',
  tip: 'Finta',
}

const TEMPO_LABEL: Record<Tempo, string> = {
  high: 'Alto',
  quick: 'Rápido',
  back: 'Espalda',
}

const PHASE_LABEL: Record<string, string> = {
  SERVE: 'Saque',
  RECEIVE: 'Recepción',
  SET: 'Armado',
  BLOCK_COMMIT: 'Lectura',
  ATTACK: 'Remate',
  MATCH_END: 'Fin',
}

const REASON_LABEL: Record<string, string> = {
  ace: 'ace',
  error: 'error rival',
  block: 'bloqueo',
  attack: 'remate',
  cap: 'rally eterno',
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

const toneForQuality = (quality: Quality): CellPreview['tone'] =>
  quality >= 3 ? 'block' : quality <= 1 ? 'point' : 'info'

const App = () => {
  const game = useGame((state) => state.game)
  const screen = useGame((state) => state.screen)
  const tutorial = useGame((state) => state.tutorial)
  const muted = useGame((state) => state.muted)
  const lastEvent = useGame((state) => state.lastEvent)
  const lastAttack = useGame((state) => state.lastAttack)
  const toast = useGame((state) => state.toast)
  const dispatch = useGame((state) => state.dispatch)
  const aiStep = useGame((state) => state.aiStep)
  const undo = useGame((state) => state.undo)
  const reset = useGame((state) => state.reset)
  const startGame = useGame((state) => state.startGame)
  const finishTutorial = useGame((state) => state.finishTutorial)
  const skipTutorial = useGame((state) => state.skipTutorial)
  const backToTitle = useGame((state) => state.backToTitle)
  const toggleMuted = useGame((state) => state.toggleMuted)
  const canUndo = useGame((state) => state.playerPast.length > 0)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [attackKind, setAttackKind] = useState<AttackKind | null>(null)
  const [tempo, setTempo] = useState<Tempo>('high')
  const [helpOpen, setHelpOpen] = useState(false)

  const playerTurn = isPlayerTurn(game)
  const home = useMemo(() => playersOf(game, 'home'), [game])
  const away = useMemo(() => playersOf(game, 'away'), [game])
  const attacker = game.attackerId
    ? game.players.find((player) => player.id === game.attackerId)
    : undefined
  const tutorialDone =
    tutorial && (game.rallyNumber > 2 || game.phase === 'MATCH_END')

  useEffect(() => {
    if (
      screen !== 'game' ||
      playerTurn ||
      tutorialDone ||
      helpOpen ||
      game.phase === 'MATCH_END'
    ) {
      return
    }
    const timer = window.setTimeout(() => aiStep(), 620)
    return () => window.clearTimeout(timer)
  }, [game, playerTurn, aiStep, screen, tutorialDone, helpOpen])

  const act = (command: Command) => {
    dispatch(command, 'player')
    setSelectedId(null)
    if (command.type === 'SET') setTempo('high')
    if (command.type === 'ATTACK') setAttackKind(null)
  }

  const restart = () => {
    reset()
    setSelectedId(null)
    setAttackKind(null)
    setTempo('high')
  }

  const selected = home.find((player) => player.id === selectedId)
  const flashCell = lastAttack ? cellKey(lastAttack.target) : null
  const banner = (() => {
    if (lastEvent?.type === 'POINT') {
      const mine = lastEvent.side === 'home'
      return {
        key: `point-${game.score.home}-${game.score.away}`,
        text: mine ? '¡Punto tuyo!' : 'Punto rival',
        detail: REASON_LABEL[lastEvent.reason] ?? '',
        tone: mine ? 'text-emerald-200' : 'text-rose-200',
      }
    }
    if (lastEvent?.type === 'MATCH_END') {
      const mine = lastEvent.winner === 'home'
      return {
        key: `end-${game.score.home}-${game.score.away}`,
        text: mine ? '¡Set para vos!' : 'Set rival',
        detail: 'fin del set',
        tone: mine ? 'text-emerald-200' : 'text-rose-200',
      }
    }
    return null
  })()

  const moveTargets = useMemo(() => {
    const targets = new Set<string>()
    if (!selected) return targets
    const canMove =
      (game.phase === 'RECEIVE' || game.phase === 'SET') &&
      game.possession === 'home' &&
      game.ap >= 1
    const canShift =
      game.phase === 'BLOCK_COMMIT' &&
      game.possession === 'away' &&
      game.reactionAp >= 1
    if (!canMove && !canShift) return targets
    for (const destination of orthogonalNeighborCells(selected.cell)) {
      if (canShift && destination.row !== selected.cell.row) continue
      if (isOccupied(game, destination, selected.id)) continue
      targets.add(cellKey(destination))
    }
    return targets
  }, [game, selected])

  const receivers = useMemo(() => {
    if (game.phase !== 'RECEIVE' || game.possession !== 'home') return []
    const seam = isSeam(game.players, game.ball.cell, 'home')
    return home
      .filter((player) => reaches(player.cell, game.ball.cell))
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
      .sort((a, b) => b.quality - a.quality || b.value - a.value)
  }, [game, home])

  const setter = useMemo(() => {
    if (game.phase !== 'SET' || game.possession !== 'home') return undefined
    return home
      .filter((player) => player.id !== game.ball.lastTouchId)
      .sort(
        (a, b) =>
          classPriority(a) - classPriority(b) ||
          moveDistance(a.cell, game.ball.cell) -
            moveDistance(b.cell, game.ball.cell),
      )[0]
  }, [game, home])

  const setValue = setter
    ? setQuality(game.passQuality, setter, moveDistance(setter.cell, game.ball.cell))
    : 0

  const setTargets = useMemo(() => {
    if (!setter || game.phase !== 'SET' || game.possession !== 'home') return []
    if (game.ap < TEMPO_AP_COST[tempo]) return []
    return home.filter((player) => {
      if (player.id === setter.id) return false
      if (player.classId === 'libero') return false
      if (tempo === 'quick' && player.classId !== 'middle') return false
      if (tempo === 'back' && (player.classId !== 'opposite' || player.cell.row !== 1)) {
        return false
      }
      return cellsOfSide('away').some((target) =>
        TEMPO_ATTACKS[tempo].some(
          (kind) =>
            isAttackAllowed({
              attacker: player,
              kind,
              tempo,
              target,
              defending: away,
            }).ok,
        ),
      )
    })
  }, [away, game, home, setter, tempo])

  const attackKinds = useMemo(() => {
    if (game.phase !== 'ATTACK' || game.possession !== 'home' || !game.tempo) {
      return []
    }
    return TEMPO_ATTACKS[game.tempo]
  }, [game])

  const previews = useMemo(() => {
    const map = new Map<string, CellPreview>()

    if (game.phase === 'SERVE' && playerTurn) {
      for (const target of cellsOfSide('away')) {
        const seam = isSeam(game.players, target, 'away')
        const options = away
          .filter((player) => reaches(player.cell, target))
          .map((player) =>
            receptionQuality(
              receptionValue(player, target, PRESSURE_VALUE.serve, seam),
            ),
          )
        const best = options.length > 0 ? Math.max(...options) : -1
        map.set(cellKey(target), {
          tone: best < 0 ? 'point' : toneForQuality(best as Quality),
          label: best < 0 ? 'ACE' : `Q${best}`,
          detail: best < 0 ? 'nadie llega' : `pase ${qualityLabel(best as Quality)}`,
        })
      }
      return map
    }

    if (
      game.phase === 'ATTACK' &&
      playerTurn &&
      attackKind &&
      attacker &&
      game.tempo
    ) {
      for (const target of cellsOfSide('away')) {
        const check = isAttackAllowed({
          attacker,
          kind: attackKind,
          tempo: game.tempo,
          target,
          defending: away,
        })
        if (!check.ok) continue
        const resolution = evaluateAttack(
          attacker,
          game.setQuality,
          attackKind,
          target,
          away,
        )
        const label =
          resolution.outcome === 'point'
            ? 'Punto'
            : resolution.outcome === 'blocked'
              ? 'Bloqueo'
              : `Dig Q${resolution.digQuality}`
        map.set(cellKey(target), {
          tone:
            resolution.outcome === 'blocked'
              ? 'block'
              : resolution.outcome,
          label,
          detail: `A${resolution.A} B${resolution.B} D${resolution.D}`,
        })
      }
    }

    return map
  }, [attackKind, attacker, away, game, playerTurn])

  const hintIds = useMemo(
    () => new Set(receivers.map((entry) => entry.player.id)),
    [receivers],
  )

  const onCell = (cell: Cell) => {
    if (!playerTurn) return

    if (game.phase === 'SERVE') {
      if (cell.side === 'away') act({ type: 'SERVE', target: cell })
      return
    }

    if (game.phase === 'ATTACK' && attackKind && attacker && game.tempo) {
      if (cell.side !== 'away') return
      const check = isAttackAllowed({
        attacker,
        kind: attackKind,
        tempo: game.tempo,
        target: cell,
        defending: away,
      })
      if (!check.ok) return
      act({
        type: 'ATTACK',
        playerId: attacker.id,
        kind: attackKind,
        target: cell,
      })
      return
    }

    if (
      game.phase === 'RECEIVE' ||
      game.phase === 'SET' ||
      (game.phase === 'BLOCK_COMMIT' && game.possession === 'away')
    ) {
      const own = home.find((player) => sameCell(player.cell, cell))
      if (own) {
        setSelectedId(own.id === selectedId ? null : own.id)
        return
      }
      if (!selected) return
      if (!moveTargets.has(cellKey(cell))) return
      if (game.phase === 'BLOCK_COMMIT') {
        act({ type: 'SHIFT', playerId: selected.id, to: cell })
      } else {
        act({ type: 'MOVE', playerId: selected.id, to: cell })
      }
      setSelectedId(null)
    }
  }

  const serve = (playerId: string | null) =>
    act({ type: 'RECEIVE', playerId })

  const chooseSet = (targetId: string) => {
    if (!setter) return
    act({
      type: 'SET',
      setterId: setter.id,
      targetId,
      tempo,
    })
  }

  const canUndoNow = canUndo && playerTurn && game.phase !== 'MATCH_END'

  const statusText = (() => {
    if (game.phase === 'MATCH_END') {
      return game.winner === 'home' ? 'Ganaste' : 'Perdiste'
    }
    if (game.phase === 'SERVE') {
      return game.server === 'home' ? 'Vos sacás' : 'Rival saca'
    }
    if (game.phase === 'RECEIVE') {
      return game.possession === 'home' ? 'Vos recibís' : 'Rival recibe'
    }
    if (game.phase === 'SET') {
      return game.possession === 'home' ? 'Vos armás' : 'Rival arma'
    }
    if (game.phase === 'BLOCK_COMMIT') {
      return game.possession === 'away' ? 'Vos leés' : 'Rival lee'
    }
    return game.possession === 'home' ? 'Vos rematás' : 'Rival remata'
  })()

  const instruction = (() => {
    if (game.phase === 'MATCH_END') {
      return `${game.winner === 'home' ? 'Ganaste' : 'Perdiste'} el set`
    }
    if (!playerTurn) return 'El rival está jugando…'
    switch (game.phase) {
      case 'SERVE':
        return 'Tu saque: tocá una zona del campo rival.'
      case 'RECEIVE':
        return 'Recepción: elegí quién recibe. Podés moverte antes (1 AP).'
      case 'SET':
        return 'Armado: elegí tempo y atacante.'
      case 'BLOCK_COMMIT':
        return 'Lectura defensiva: mové tus bloqueadores y confirmá.'
      case 'ATTACK':
        return attackKind
          ? 'Remate: tocá la zona objetivo.'
          : 'Remate: elegí el tipo de ataque.'
      default:
        return ''
    }
  })()

  if (screen === 'title') {
    return (
      <>
        <TitleScreen
          muted={muted}
          onPlay={() => startGame()}
          onTutorial={() => startGame({ tutorial: true })}
          onToggleMuted={toggleMuted}
          onHelp={() => setHelpOpen(true)}
        />
        {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
      </>
    )
  }

  return (
    <div className="game-shell mx-auto flex min-h-svh w-full max-w-md flex-col gap-2.5 px-3 pb-5 pt-3">
      <header className="game-header rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-2.5 shadow-xl shadow-indigo-950/40">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={backToTitle}
            className="text-left transition hover:opacity-80"
            aria-label="Volver al inicio"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300/80">
              ZONA 3
            </p>
            <p className="text-xs text-white/50">Set a {game.targetScore}</p>
          </button>
          <div className="flex items-end gap-2 font-black tabular-nums">
            <span
              key={`home-${game.score.home}`}
              className="animate-pop inline-block text-3xl text-indigo-200"
            >
              {game.score.home}
            </span>
            <span className="pb-1 text-lg text-white/30">—</span>
            <span
              key={`away-${game.score.away}`}
              className="animate-pop inline-block text-3xl text-rose-200"
            >
              {game.score.away}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              {PHASE_LABEL[game.phase]}
            </p>
            <p className="text-xs font-semibold text-white/70">
              {statusText}
            </p>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
              AP
            </span>
            {[0, 1, 2].map((index) => {
              const active =
                game.phase === 'BLOCK_COMMIT' && game.possession === 'away'
                  ? index < game.reactionAp
                  : index < game.ap
              return (
                <span
                  key={index}
                  className={`h-2.5 w-6 rounded-full transition ${
                    active ? 'bg-cyan-300 shadow shadow-cyan-300/50' : 'bg-white/10'
                  }`}
                />
              )
            })}
            <span className="ml-1 text-[10px] font-semibold text-white/50">
              {game.phase === 'BLOCK_COMMIT' && game.possession === 'away'
                ? `${game.reactionAp} reacción`
                : `${game.ap} / 3`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Cómo se juega"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[11px] font-black text-white/60 transition hover:border-white/40 hover:text-white"
            >
              ?
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[11px] leading-none text-white/60 transition hover:border-white/40 hover:text-white"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndoNow}
              aria-label="Deshacer"
              className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 transition enabled:hover:border-white/40 enabled:hover:text-white disabled:opacity-25"
            >
              <span className="max-[430px]:hidden">Deshacer</span>
              <span className="hidden max-[430px]:inline">↶</span>
            </button>
            <button
              type="button"
              onClick={restart}
              aria-label="Reiniciar partido"
              className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/60 transition hover:border-white/40 hover:text-white"
            >
              <span className="max-[430px]:hidden">Reiniciar</span>
              <span className="hidden max-[430px]:inline">↺</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative">
        <Board
          game={game}
          selectedId={selectedId}
          hintIds={hintIds}
          hintCells={moveTargets}
          previews={previews}
          attackKind={attackKind}
          flashCell={flashCell}
          onCell={onCell}
        />
        {banner && (
          <div
            key={banner.key}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="animate-point-banner rounded-2xl border border-white/15 bg-slate-950/90 px-5 py-3 text-center shadow-2xl shadow-black/50">
              <p className={`text-lg font-black ${banner.tone}`}>
                {banner.text}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                {banner.detail}
              </p>
            </div>
          </div>
        )}
      </div>

      <section className="game-panel rounded-3xl border border-white/10 bg-slate-950/70 px-3 py-3 shadow-xl shadow-indigo-950/40">
        {!(game.phase === 'SET' && playerTurn) && (
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="game-instruction text-sm font-bold text-white/90">
              {instruction}
            </p>
            {!playerTurn && game.phase !== 'MATCH_END' && (
              <span className="mt-0.5 flex gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300"
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
        )}

        {game.phase === 'RECEIVE' && game.possession === 'home' && (
          <div className="grid gap-1.5">
            {receivers.length === 0 && (
              <p className="text-xs text-rose-200/80">
                Nadie llega: el saque sería ace.
              </p>
            )}
            {receivers.map(({ player, value, quality }) => (
              <button
                key={player.id}
                type="button"
                onClick={() => serve(player.id)}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
              >
                <span className="text-sm font-bold text-white/90">
                  {player.name}
                </span>
                <span className="text-xs text-white/60">
                  {quality === 0
                    ? 'no controla · punto rival'
                    : `pase ${qualityLabel(quality)} · R${value}`}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => serve(null)}
              className="rounded-2xl border border-rose-300/20 px-3 py-1.5 text-xs font-semibold text-rose-200/70 transition hover:border-rose-300/50"
            >
              Dejar pasar el saque (ace)
            </button>
          </div>
        )}

        {game.phase === 'SET' && game.possession === 'home' && setter && (
          <div className="grid gap-2">
            <p className="text-xs text-white/50">
              Arma <span className="font-bold text-white/80">{setter.name}</span>
              {' · '}
              calidad {qualityLabel(setValue as Quality)}
              {moveDistance(setter.cell, game.ball.cell) > 1 && (
                <span className="text-amber-200/80">
                  {' '}
                  · lejos del balón (-1)
                </span>
              )}
            </p>
            {setValue === 0 && (
              <p className="text-xs text-rose-200/80">
                El armado falla: mové al armador.
              </p>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {(['high', 'quick', 'back'] as Tempo[]).map((option) => {
                const cost = TEMPO_AP_COST[option]
                const enabled = game.ap >= cost
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTempo(option)}
                    disabled={!enabled}
                    className={`rounded-2xl border px-2 py-1.5 text-xs font-bold transition ${
                      tempo === option
                        ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100'
                        : 'border-white/10 bg-white/5 text-white/60'
                    } disabled:opacity-30`}
                  >
                    {TEMPO_LABEL[option]}
                    <span className="block text-[9px] font-medium opacity-70">
                      {cost} AP
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid gap-1.5">
              {setTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => chooseSet(target.id)}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-indigo-300/60 hover:bg-indigo-300/10"
                >
                  <span className="text-sm font-bold text-white/90">
                    {target.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {target.classId === 'middle'
                      ? 'rápido'
                      : target.classId === 'opposite'
                        ? 'pipe / potencia'
                        : 'potencia'}
                  </span>
                </button>
              ))}
              {setTargets.length === 0 && (
                <p className="text-xs text-amber-200/80">
                  No hay atacante legal para ese tempo. Movete o elegí otro.
                </p>
              )}
            </div>
          </div>
        )}

        {game.phase === 'BLOCK_COMMIT' && game.possession === 'away' && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-white/50">
              Tocá un jugador y una celda libre de su fila para ajustar.
            </p>
            <button
              type="button"
              onClick={() => act({ type: 'COMMIT_BLOCK' })}
              className="shrink-0 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-black text-cyan-950 shadow shadow-cyan-300/30 transition hover:bg-cyan-200"
            >
              Listo
            </button>
          </div>
        )}

        {game.phase === 'ATTACK' && game.possession === 'home' && attacker && (
          <div className="grid gap-2">
            <p className="text-xs text-white/50">
              Ataca <span className="font-bold text-white/80">{attacker.name}</span>
              {' · '}armado {qualityLabel(game.setQuality)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {attackKinds.map((kind) => {
                const cost = ATTACK_AP_COST[kind]
                const enabled = game.ap >= cost
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setAttackKind(kind)}
                    disabled={!enabled}
                    className={`rounded-2xl border px-3 py-1.5 text-xs font-bold transition ${
                      attackKind === kind
                        ? 'border-rose-300 bg-rose-300/15 text-rose-100'
                        : 'border-white/10 bg-white/5 text-white/60'
                    } disabled:opacity-30`}
                  >
                    {KIND_LABEL[kind]}
                    <span className="ml-1 text-[9px] font-medium opacity-70">
                      {cost} AP
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/35">
              El preview muestra A / B / D antes de confirmar. Sin RNG.
            </p>
            {attackKind && previews.size === 0 && (
              <p className="text-xs text-amber-200/80">
                No hay zona legal para ese ataque. Elegí otro tipo.
              </p>
            )}
          </div>
        )}

        {game.phase === 'MATCH_END' && (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-lg font-black text-white">
                {game.winner === 'home' ? '¡Ganaste el set!' : 'El rival ganó el set'}
              </p>
              <p className="text-xs text-white/50">
                {game.score.home} — {game.score.away}
              </p>
            </div>
            <button
              type="button"
              onClick={restart}
              className="rounded-2xl bg-indigo-300 px-4 py-2 text-sm font-black text-indigo-950 transition hover:bg-indigo-200"
            >
              Jugar otro
            </button>
          </div>
        )}
      </section>

      {tutorial && !tutorialDone ? (
        <Coach game={game} onSkip={skipTutorial} />
      ) : (
        <footer className="game-log rounded-3xl border border-white/5 bg-slate-950/40 px-3 py-2">
          <div className="space-y-1">
            {game.log.slice(-2).reverse().map((entry, index) => (
              <p
                key={`${entry.text}-${index}`}
                className={`truncate text-[11px] leading-snug ${
                  entry.tone === 'good'
                    ? 'text-emerald-200/80'
                    : entry.tone === 'bad'
                      ? 'text-rose-200/80'
                      : 'text-white/45'
                }`}
              >
                {entry.text}
              </p>
            ))}
            {game.log.length === 0 && (
              <p className="text-[11px] text-white/30">
                Un set a 7. Vos sacás primero.
              </p>
            )}
          </div>
        </footer>
      )}

      {toast && (
        <button
          type="button"
          onClick={() => useGame.getState().clearToast()}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-rose-300/40 bg-rose-950/95 px-4 py-3 text-left text-sm font-semibold text-rose-100 shadow-2xl"
        >
          {toast}
        </button>
      )}

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}

      {tutorialDone && (
        <TutorialComplete game={game} onFinish={finishTutorial} />
      )}
    </div>
  )
}

export default App
