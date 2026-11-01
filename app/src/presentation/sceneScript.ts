import type { Quality } from '../engine'
import { otherSide } from '../court/geometry'
import { schemeLabel, serveZoneLabel } from '../court/match'
import type { MatchEvent, MatchState } from '../court/match'
import type { CourtPlayer, CourtTeam, Side } from '../court/types'
import {
  attackLabel,
  attackLine,
  digLine,
  endLine,
  freeBallLine,
  matchPointLine,
  pointLine,
  receiveLine,
  serveLine,
  setLine,
  teammateLine,
} from './content/commentary'
import type { Scene, SceneMeta, ScenePose, ShotId } from './types'

type Options = {
  meta?: SceneMeta
}

const playerById = (
  state: MatchState,
  id: string | null | undefined,
): CourtPlayer | undefined =>
  id ? state.players.find((player) => player.id === id) : undefined

const celebrationPlayer = (
  state: MatchState,
  side: Side,
): CourtPlayer | undefined =>
  state.players.find(
    (player) => player.side === side && player.classId === 'opposite',
  ) ??
  state.players.find(
    (player) => player.side === side && player.classId !== 'libero',
  ) ??
  state.players.find((player) => player.side === side)

const scoreOf = (event: Extract<MatchEvent, { type: 'POINT' }>) =>
  event.score

/**
 * Traduce los eventos puros del motor a escenas de presentación.
 * El motor decide; este módulo elige qué imagen y qué relato cuenta.
 */
export const sceneScript = (
  pre: MatchState,
  events: MatchEvent[],
  _post: MatchState,
  teams: Record<Side, CourtTeam>,
  options: Options = {},
): Scene[] => {
  const scenes: Scene[] = []
  const meta = options.meta
  let lastServerId: string | undefined
  let lastAttackerId: string | undefined
  let lastDefenderId: string | undefined
  let lastErrorShot: ShotId | undefined

  const push = (scene: Scene) => {
    scenes.push(scene)
  }

  events.forEach((event, index) => {
    const seed =
      pre.rallyNumber * 37 +
      pre.score.home * 11 +
      pre.score.away * 7 +
      index

    switch (event.type) {
      case 'SERVE': {
        const server = playerById(pre, event.serverId)
        const side = server?.side ?? pre.server
        const zoneLabel = event.zone ? serveZoneLabel(event.zone) : undefined
        const banner = zoneLabel ? `SAQUE ${zoneLabel}` : 'SAQUE'
        const lineOutcome =
          event.outcome === 'net' || event.outcome === 'out'
            ? event.outcome
            : event.outcome === 'ace'
              ? 'ace'
              : 'ok'
        push({
          id: `serve-${index}`,
          frame: {
            mode: 'closeup',
            actorId: event.serverId,
            banner,
            pose: 'serve',
            effect: 'speed',
            tone: side,
            shot: 'serve',
          },
          line: serveLine(
            server?.name ?? 'El sacador',
            lineOutcome,
            seed,
            zoneLabel,
          ),
        })
        lastServerId = event.serverId
        if (event.outcome === 'net') lastErrorShot = 'errorNet'
        else if (event.outcome === 'out') lastErrorShot = 'error'
        break
      }

      case 'RECEIVE': {
        const receiver = playerById(pre, event.playerId)
        const side = receiver?.side ?? otherSide(pre.server)
        const dig = event.dig ?? false
        const teammate = event.teammate ?? false
        const name = receiver?.name ?? 'El receptor'
        push({
          id: `receive-${index}`,
          frame: {
            mode: 'closeup',
            actorId: event.playerId,
            banner: dig ? '¡DIG!' : 'RECEPCIÓN',
            pose: dig ? 'dig' : 'receive',
            effect: 'dust',
            tone: side,
            shot: dig
              ? 'dig'
              : receiver?.side === 'away'
                ? 'receiveAlt'
                : 'receive',
          },
          line: dig
            ? digLine(name, event.quality, seed)
            : teammate
              ? teammateLine(name, seed)
              : receiveLine(name, event.quality, seed),
        })
        break
      }

      case 'FREE_BALL': {
        const to = teams[event.toSide]
        push({
          id: `free-ball-${index}`,
          frame: {
            mode: 'closeup',
            banner: '¡FREE BALL!',
            effect: 'speed',
            tone: event.toSide,
            shot: 'freeBall',
          },
          line: freeBallLine(to.short, seed),
        })
        break
      }

      case 'SET': {
        const setter = playerById(pre, event.setterId)
        const side = setter?.side ?? pre.possession
        const quality: Quality = event.quality
        push({
          id: `set-${index}`,
          frame: {
            mode: 'closeup',
            actorId: event.setterId,
            banner:
              event.outcome === 'error' ? '¡ARMADO ERRADO!' : 'ARMADO',
            pose: 'set',
            effect: event.outcome === 'error' ? 'flash' : undefined,
            tone: side,
            shot: 'set',
          },
          line: setLine(
            setter?.name ?? 'El armador',
            quality,
            event.outcome,
            seed,
          ),
        })
        if (event.outcome === 'error') lastErrorShot = 'errorNet'
        break
      }

      case 'ATTACK': {
        const attacker = playerById(pre, event.attackerId)
        const defender = playerById(pre, event.resolution.defenderId)
        const side = attacker?.side ?? pre.possession
        const scheme = meta?.defenseScheme
        const banner = scheme
          ? `${schemeLabel(scheme)} vs ${attackLabel(event.kind)}`
          : attackLabel(event.kind)
        push({
          id: `attack-${index}`,
          frame: {
            mode: 'duel',
            actorId: event.attackerId,
            rivalId: event.resolution.defenderId,
            banner,
            pose: 'spike',
            effect: 'impact',
            tone: side,
            shot: 'duel',
          },
          line: attackLine(
            attacker?.name ?? defender?.name ?? 'El atacante',
            event.kind,
            seed,
          ),
        })
        lastAttackerId = event.attackerId
        lastDefenderId = event.resolution.defenderId
        if (event.resolution.outcome === 'fault') {
          lastErrorShot =
            event.resolution.fault === 'net' ? 'errorNet' : 'error'
        }
        break
      }

      case 'DIG': {
        const defender = playerById(pre, event.defenderId)
        const side = defender?.side ?? otherSide(pre.possession)
        push({
          id: `dig-${index}`,
          frame: {
            mode: 'closeup',
            actorId: event.defenderId,
            banner: '¡DIG!',
            pose: 'dig',
            effect: 'dust',
            tone: side,
            shot: 'dig',
          },
          line: digLine(
            defender?.name ?? 'La defensa',
            event.quality,
            seed,
          ),
        })
        lastDefenderId = event.defenderId
        break
      }

      case 'POINT': {
        const side = event.side
        const score = scoreOf(event)
        const reason = event.reason
        let actorId: string | undefined
        let pose: ScenePose = 'celebrate'

        if (reason === 'block') {
          actorId = lastDefenderId
          pose = 'block'
        } else if (reason === 'ace') {
          actorId = lastServerId
          pose = 'celebrate'
        } else if (reason === 'attack') {
          actorId = lastAttackerId
          pose = 'celebrate'
        } else {
          actorId = celebrationPlayer(pre, side)?.id
          pose = 'celebrate'
        }

        const stamp =
          reason === 'block'
            ? '¡BLOQUEO!'
            : reason === 'ace'
              ? '¡ACE!'
              : reason === 'error'
                ? '¡ERROR!'
                : reason === 'cap'
                  ? '¡RALLY LARGO!'
                  : '¡PUNTO!'

        const lead = score[side] - score[otherSide(side)]
        const isMatchPoint =
          score[side] >= pre.targetScore - 1 && lead > 0
        const base = pointLine(side, teams, score, reason, seed)
        const text = isMatchPoint
          ? `${base.text} ${matchPointLine(side, teams).text}`
          : base.text

        push({
          id: `point-${index}`,
          frame: {
            mode: 'result',
            actorId,
            banner: teams[side].short,
            stamp,
            pose,
            effect: 'flash',
            tone: side,
            shot:
              reason === 'block'
                ? 'block'
                : reason === 'attack' || reason === 'cap'
                  ? 'point'
                  : reason === 'ace'
                    ? 'serve'
                    : (lastErrorShot ?? 'error'),
          },
          line: {
            ...base,
            text,
            expression: isMatchPoint ? 'shocked' : base.expression,
          },
          score: { ...score },
        })
        break
      }

      case 'MATCH_END': {
        const winner = event.winner
        const actor = celebrationPlayer(pre, winner)
        push({
          id: `end-${index}`,
          frame: {
            mode: 'result',
            actorId: actor?.id,
            banner: teams[winner].name,
            stamp: winner === pre.playerSide ? '¡VICTORIA!' : '¡DERROTA!',
            pose: 'celebrate',
            effect: 'flash',
            tone: winner,
            shot: winner === pre.playerSide ? 'celebrate' : 'defeat',
          },
          line: endLine(winner, teams, event.score),
          score: { ...event.score },
        })
        break
      }
    }
  })

  // Evita que un evento raro deje una escena sin imagen.
  return scenes.map((scene, index) => ({
    ...scene,
    id: scene.id || `scene-${index}`,
  }))
}

export const stageTeams = (
  home: CourtTeam,
  away: CourtTeam,
): Record<Side, CourtTeam> => ({ home, away })
