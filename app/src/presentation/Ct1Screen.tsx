import { useMemo, useRef, useState } from 'react'
import { ATTACK_LABEL, DEFENSE_SCHEMES } from '../engine'
import type { DefenseScheme } from '../engine'
import type { MatchState } from '../court/match'
import {
  attackOptions,
  defenseCandidates,
  designatedServer,
  schemeHint,
  schemeLabel,
  servePressure,
  serveTargetForZone,
  serveZoneLabel,
  serveZoneRisk,
  type ServeZone,
} from '../court/match'
import {
  aiServeCt1,
  attack,
  createMatch,
  defend,
  nextDecision,
  serve,
} from '../court/matchEngine'
import type { EngineResult } from '../court/matchEngine'
import { areaLabel } from '../court/geometry'
import { mulberry32, type Rng } from '../court/matchAi'
import { attackTell, defenseTell, serveTell } from '../court/narration'
import { applyFormation, buildRoster, TEAMS } from '../court/teams'
import type { LadderStage } from '../court/ladder'
import type { CourtTeam, Side } from '../court/types'
import ActionStage from './ActionStage'
import CommandBox from './CommandBox'
import CommentBox from './CommentBox'
import PresentationShell from './PresentationShell'
import { HelpSheet } from '../game/Tutorial'
import {
  endLine,
  kickoffLine,
  matchIntroLine,
} from './content/commentary'
import { sceneScript } from './sceneScript'
import { resolveMatchSeed } from './seed'
import type { ActionFrameSpec, CommandOption, Scene, SceneMeta } from './types'
import './presentation.css'

const DEMO_TARGET = 25
const DEMO_START = { home: 17, away: 19 }

const SERVE_ZONES: ServeZone[] = [1, 5, 6, 'short']

const tellRng = (state: MatchState, salt: number): Rng =>
  mulberry32(
    (state.rallyNumber * 7919 +
      state.score.home * 131 +
      state.score.away * 17 +
      (state.server === 'home' ? 1 : 2) +
      salt) >>>
      0,
  )

const buildDemoRoster = (stage: LadderStage) =>
  applyFormation(
    [
      ...buildRoster('arg', 'home'),
      ...buildRoster(stage.rival, 'away', stage.boost, stage.techBoost),
    ],
    'base',
  )

const createDemoMatch = (stage: LadderStage): MatchState =>
  createMatch({
    roster: buildDemoRoster(stage),
    playerSide: 'home',
    server: 'home',
    targetScore: DEMO_TARGET,
    startScore: stage.startScore ?? DEMO_START,
    useTension: true,
    ai: stage.ai,
  })

type Props = {
  stage: LadderStage
  muted: boolean
  onBack: () => void
  onFinish: (won: boolean) => void
  onToggleMuted?: () => void
  /** Semilla fija para demos, tests o reproducir una partida. */
  seed?: number
}

export const Ct1Screen = ({
  stage,
  muted,
  onBack,
  onFinish,
  onToggleMuted,
  seed,
}: Props) => {
  const teams = useMemo<Record<Side, CourtTeam>>(
    () => ({ home: TEAMS.arg, away: TEAMS[stage.rival] }),
    [stage.rival],
  )
  const [match, setMatch] = useState<MatchState>(() => createDemoMatch(stage))
  const [scenes, setScenes] = useState<Scene[]>([])
  const [sceneIndex, setSceneIndex] = useState(0)
  const [pending, setPending] = useState<MatchState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [intro, setIntro] = useState(true)
  const [runId, setRunId] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [matchSeed] = useState(() => resolveMatchSeed(seed))
  const rngRef = useRef<Rng>(mulberry32(matchSeed))

  const currentScene = scenes[sceneIndex]
  const decision = nextDecision(match)
  const won = match.winner === 'home'
  const trail = scenes
    .slice(0, sceneIndex + 1)
    .map((scene) => scene.frame.stamp ?? scene.frame.banner ?? 'JUGADA')
  const scored = scenes
    .slice(0, sceneIndex + 1)
    .filter((scene) => scene.score)
    .at(-1)
  const displayScore = scored?.score ?? match.score

  const server = designatedServer(match, 'home')

  const serveOptions = useMemo<CommandOption[]>(
    () =>
      SERVE_ZONES.map((zone) => ({
        id: String(zone),
        label: serveZoneLabel(zone),
        note: `${serveZoneRisk(server, zone).toUpperCase()} · ${
          zone === 'short' ? 'FRENTE' : 'FONDO'
        }`,
        actor: server,
      })),
    [server],
  )

  const attackChoices = useMemo<CommandOption[]>(
    () =>
      attackOptions(match).map((option) => {
        const tensionCost = option.cost * 15
        return {
          id: option.kind,
          label: ATTACK_LABEL[option.kind].toUpperCase(),
          note: `${tensionCost} T · ${areaLabel(option.targets[0])}`,
          disabled: match.tension.home < tensionCost,
          actor: option.attacker,
        }
      }),
    [match],
  )

  const defenseChoices = useMemo<CommandOption[]>(
    () =>
      DEFENSE_SCHEMES.map((scheme) => ({
        id: scheme,
        label: schemeLabel(scheme),
        note: schemeHint(scheme),
        actor: defenseCandidates(match, scheme)[0],
      })),
    [match],
  )

  const attackHint = useMemo(
    () =>
      `PISTA: ${
        attackTell(match.hiddenScheme ?? 'spread', tellRng(match, 3)).text
      }`,
    [match],
  )

  const defenseHint = useMemo(
    () =>
      `PISTA: ${defenseTell(match.hiddenAttack, tellRng(match, 4)).text}`,
    [match],
  )

  const kickoffHint = useMemo(
    () => `PISTA: ${serveTell(match, tellRng(match, 2)).text}`,
    [match],
  )

  const play = (result: EngineResult, meta?: SceneMeta) => {
    setNotice(null)
    const nextScenes = sceneScript(
      match,
      result.events,
      result.state,
      teams,
      { meta },
    )
    if (nextScenes.length === 0) {
      setMatch(result.state)
      return
    }
    setPending(result.state)
    setScenes(nextScenes)
    setSceneIndex(0)
    setRunId((value) => value + 1)
    const firstLine = nextScenes[0]?.line.text
    if (firstLine) {
      setLog((previous) =>
        previous[previous.length - 1] === firstLine
          ? previous
          : [...previous, firstLine].slice(-4),
      )
    }
  }

  const run = (action: () => EngineResult, meta?: SceneMeta) => {
    try {
      play(action(), meta)
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'JUGADA INVÁLIDA',
      )
    }
  }

  const advance = () => {
    if (sceneIndex < scenes.length - 1) {
      const nextIndex = sceneIndex + 1
      const nextScene = scenes[nextIndex]
      setSceneIndex(nextIndex)
      if (nextScene) {
        setLog((previous) =>
          previous[previous.length - 1] === nextScene.line.text
            ? previous
            : [...previous, nextScene.line.text].slice(-4),
        )
      }
      return
    }
    const post = pending
    setScenes([])
    setSceneIndex(0)
    setPending(null)
    if (post) setMatch(post)
  }

  const chooseServe = (id: string) => {
    const zone: ServeZone =
      id === 'short' ? 'short' : (Number(id) as 1 | 5 | 6)
    const target = serveTargetForZone(match.server, zone)
    run(() =>
      serve(
        match,
        target,
        rngRef.current,
        {},
        servePressure(server),
        zone,
      ),
    )
  }

  const chooseAttack = (id: string) => {
    const option = attackOptions(match).find((entry) => entry.kind === id)
    if (!option) return
    run(
      () =>
        attack(match, option.kind, option.targets[0], rngRef.current, {
          attackerId: option.attacker.id,
        }),
      { attackKind: option.kind },
    )
  }

  const chooseDefense = (id: string) => {
    const scheme = id as DefenseScheme
    run(() => defend(match, scheme, rngRef.current), {
      defenseScheme: scheme,
    })
  }

  const playAiServe = () => {
    run(() => aiServeCt1(match, rngRef.current))
  }

  const endFrame: ActionFrameSpec = {
    mode: 'result',
    banner: teams[match.winner ?? 'away'].name,
    stamp: won ? '¡VICTORIA!' : '¡DERROTA!',
    effect: 'flash',
    tone: match.winner ?? 'away',
    shot: won ? 'celebrate' : 'defeat',
  }

  const attackZone = match.setZone ?? 4
  const attackShot: ActionFrameSpec['shot'] =
    attackZone === 2 ? 'attack2' : 'attack4'

  const decisionFrame: ActionFrameSpec =
    decision === 'wait'
      ? {
          mode: 'closeup',
          shot: 'readyToServe',
          banner: 'SAQUE RIVAL',
          tone: 'away',
          mirror: true,
        }
      : decision === 'serve'
        ? {
            mode: 'closeup',
            shot: 'readyToServe',
            banner: 'TU SAQUE',
            tone: 'home',
          }
        : decision === 'attack'
          ? {
              mode: 'closeup',
              shot: attackShot,
              banner: `TU ATAQUE · POR ${attackZone}`,
              tone: 'home',
            }
          : decision === 'defend'
            ? {
                mode: 'closeup',
                shot: 'justInAttack',
                banner: 'TU DEFENSA',
                tone: 'home',
                mirror: match.possession === 'away',
              }
            : { mode: 'field' }

  const introFrame: ActionFrameSpec = {
    mode: 'closeup',
    shot: 'readyToServe',
    banner: 'SAQUE LOCAL',
    tone: 'home',
  }

  const stageFrame: ActionFrameSpec = currentScene
    ? currentScene.frame
    : intro
      ? introFrame
      : decision === 'end'
        ? endFrame
        : decisionFrame

  const top = (
    <ActionStage
      key={
        currentScene
          ? `${runId}-${currentScene.id}`
          : intro
            ? 'intro'
            : decision === 'end'
              ? `${runId}-end`
              : `decision-${decision}-${match.rallyNumber}`
      }
      frame={stageFrame}
      players={match.players}
      teams={teams}
      ball={match.ball}
      muted={muted}
    />
  )

  const bottom = currentScene ? (
    <CommentBox
      key={`${runId}-${currentScene.id}`}
      line={currentScene.line}
      onNext={advance}
      title={currentScene.frame.banner ?? 'ACCIÓN'}
      progress={`${sceneIndex + 1}/${scenes.length}`}
      trail={trail}
      log={log.slice(0, -1)}
      muted={muted}
    />
  ) : intro ? (
    <CommentBox
      key="intro"
      line={matchIntroLine(
        teams.home.short,
        teams.away.short,
        displayScore,
        stage.round,
        stage.city,
      )}
      onNext={() => setIntro(false)}
      title="COMIENZA EL PARTIDO"
      hint={`SET DECISIVO · ${displayScore.home}-${displayScore.away}`}
      progress="PREVIA"
      trail={['SAQUE LOCAL', 'SET A 25']}
      muted={muted}
    />
  ) : decision === 'end' ? (
    <CommentBox
      key="end"
      line={endLine(match.winner ?? 'away', teams, match.score)}
      onNext={() => onFinish(won)}
      nextLabel={won ? 'SIGUIENTE ▶' : 'VOLVER A LA GIRA'}
      title="FIN DEL SET"
      trail={['FIN DEL SET', won ? 'VICTORIA' : 'DERROTA']}
      log={log.slice(0, -1)}
      muted={muted}
    />
  ) : decision === 'wait' ? (
    <CommentBox
      key="kickoff"
      line={kickoffLine(displayScore)}
      onNext={playAiServe}
      title="SAQUE RIVAL"
      hint={notice ?? kickoffHint}
      progress="SET DECISIVO"
      trail={['SAQUE RIVAL', 'SET A 25']}
      muted={muted}
    />
  ) : decision === 'serve' ? (
    <CommandBox
      title="TU SAQUE"
      hint="Elegí a dónde querés sacar. El destino es una intención: Nando cuenta qué pasó."
      options={serveOptions}
      onSelect={chooseServe}
      notice={notice}
      tension={match.tension.home}
      teams={teams}
      muted={muted}
    />
  ) : decision === 'attack' ? (
    <CommandBox
      title="TU ATAQUE"
      hint={attackHint}
      options={attackChoices}
      onSelect={chooseAttack}
      tension={match.tension.home}
      notice={notice}
      teams={teams}
      muted={muted}
    />
  ) : (
    <CommandBox
      title="TU DEFENSA"
      hint={defenseHint}
      options={defenseChoices}
      onSelect={chooseDefense}
      notice={notice}
      tension={match.tension.home}
      teams={teams}
      muted={muted}
    />
  )

  return (
    <>
      <PresentationShell
        teams={teams}
        score={displayScore}
        targetScore={DEMO_TARGET}
        server={match.server}
        onBack={onBack}
        top={top}
        bottom={bottom}
        muted={muted}
        onToggleMuted={onToggleMuted}
        onHelp={() => setHelpOpen(true)}
      />
      {helpOpen && (
        <HelpSheet mode="ct1" onClose={() => setHelpOpen(false)} />
      )}
    </>
  )
}

export default Ct1Screen
