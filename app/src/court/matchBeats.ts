import { ATTACK_LABEL } from '../engine'
import type { AttackKind } from '../engine'
import { cell, sameCell } from './geometry'
import { DEMO_TEAMS } from './demo'
import type { MatchEvent, MatchState } from './match'
import type { BeatSpec, CourtCell, CourtPlayer, MoveSpec, Pose, Side } from './types'

const teamName = (side: Side): string => DEMO_TEAMS[side].name

const playerName = (player: CourtPlayer | undefined, fallback: string): string =>
  player?.name ?? fallback

const cloneCell = (target: CourtCell): CourtCell => ({ ...target })

/**
 * Traduce los eventos puros del motor a la línea de tiempo de la cancha.
 * El motor decide; este módulo solo cuenta la jugada.
 */
export const matchBeats = (
  pre: MatchState,
  events: MatchEvent[],
  post: MatchState,
): BeatSpec[] => {
  const beats: BeatSpec[] = []
  const roster = new Map(pre.players.map((player) => [player.id, player]))
  const at: Record<string, CourtCell> = Object.fromEntries(
    pre.players.map((player) => [player.id, cloneCell(player.cell)]),
  )
  const final = events.some((event) => event.type === 'MATCH_END')

  const getPlayer = (id: string | null): CourtPlayer | undefined =>
    id
      ? roster.get(id) ?? post.players.find((player) => player.id === id)
      : undefined

  const move = (
    playerId: string,
    to: CourtCell,
    pose: Pose,
    duration: number,
    jump = 0,
  ): MoveSpec | null => {
    const player = getPlayer(playerId)
    if (!player) return null
    at[playerId] = cloneCell(to)
    return {
      playerId,
      to: cloneCell(to),
      duration,
      pose,
      jump,
    }
  }

  const inPlace = (
    playerId: string,
    pose: Pose,
    duration: number,
    jump = 0,
  ): MoveSpec | null => {
    const player = getPlayer(playerId)
    if (!player) return null
    return {
      playerId,
      to: cloneCell(at[playerId]),
      duration,
      pose,
      jump,
    }
  }

  const push = (spec: BeatSpec) => {
    beats.push(spec)
  }

  const addPoint = (
    side: Side,
    score: Record<Side, number>,
    reason: string,
    ballCell: CourtCell,
  ) => {
    const moves = pre.players
      .filter((player) => player.side === side)
      .map((player) => inPlace(player.id, 'celebrate', 560, 5))
      .filter((entry): entry is MoveSpec => entry !== null)
    const base = final
      ? `¡${teamName(side)} GANA ${score.home}-${score.away}!`
      : `PUNTO DE ${teamName(side)} · ${score.home}-${score.away}`
    const caption =
      reason === 'block'
        ? `¡BLOQUEO! ${base}`
        : reason === 'cap'
          ? `RALLY LARGO · ${base}`
          : base
    push({
      kind: 'point',
      duration: final ? 1700 : 1200,
      caption,
      point: side,
      fx: 'floor',
      moves,
      ball: {
        to: cloneCell(ballCell),
        zFrom: 6,
        zTo: 0,
        arc: 6,
        duration: 280,
      },
    })
  }

  let lastBall: CourtCell = pre.ball
  let digTarget: CourtCell | null = null

  for (const event of events) {
    switch (event.type) {
      case 'SERVE': {
        const server = getPlayer(event.serverId)
        const receiver = getPlayer(event.receiverId)
        const receiverMove =
          receiver && !sameCell(receiver.cell, event.target)
            ? move(event.receiverId!, event.target, 'receive', 420)
            : null

        push({
          kind: 'serve',
          duration: 860,
          caption:
            event.outcome === 'ace'
              ? `ACE · ${playerName(server, 'SAQUE')}`
              : `SAQUE · ${playerName(server, 'SAQUE')}`,
          actorId: event.serverId,
          pose: 'serve',
          fx: 'hit',
          moves: receiverMove ? [receiverMove] : [],
          ball: {
            to: cloneCell(event.target),
            arc: 54,
            zFrom: 46,
            zTo: 22,
            duration: 560,
            delay: 240,
            kind: 'serve',
          },
        })
        lastBall = cloneCell(event.target)
        break
      }

      case 'RECEIVE': {
        const receiver = getPlayer(event.playerId)
        push({
          kind: 'receive',
          duration: 640,
          caption: `RECEPCIÓN · ${playerName(receiver, 'DEFENSA')}`,
          actorId: event.playerId,
          pose: 'receive',
          fx: 'hit',
          ball: {
            to: cloneCell(event.to),
            arc: 30,
            zFrom: 16,
            zTo: 28,
            duration: 420,
            delay: 120,
            kind: 'pass',
          },
        })
        lastBall = cloneCell(event.to)
        break
      }

      case 'SET': {
        const setter = getPlayer(event.setterId)
        push({
          kind: 'set',
          duration: event.outcome === 'error' ? 760 : 600,
          caption:
            event.outcome === 'error'
              ? `ARMADO FALLIDO · ${playerName(setter, 'ARMADOR')}`
              : `ARMADO · ${playerName(setter, 'ARMADOR')}`,
          actorId: event.setterId,
          pose: 'set',
          fx: event.outcome === 'error' ? 'floor' : undefined,
          ball: {
            to: cloneCell(event.to),
            arc: event.outcome === 'error' ? 6 : 18,
            zFrom: 28,
            zTo: event.outcome === 'error' ? 0 : 32,
            duration: 320,
            delay: 90,
            kind: 'set',
          },
        })
        lastBall = cloneCell(event.to)
        break
      }

      case 'ATTACK': {
        const attacker = getPlayer(event.attackerId)
        const resolution = event.resolution
        const label = ATTACK_LABEL[event.kind as AttackKind] ?? 'ATAQUE'
        const isBlocked = resolution.outcome === 'blocked'
        const isPoint = resolution.outcome === 'point'
        const blockerIds = new Set(resolution.blockerIds)
        const moves: MoveSpec[] = resolution.blockerIds
          .map((id) => inPlace(id, 'block', 360, 18))
          .filter((entry): entry is MoveSpec => entry !== null)

        const defender = getPlayer(resolution.defenderId)
        if (defender && !blockerIds.has(defender.id)) {
          if (!isBlocked && !isPoint) {
            // El dig se mueve en su propio beat; acá solo marcamos el destino.
            digTarget = cloneCell(event.target)
          } else if (isPoint) {
            const chase = move(
              defender.id,
              event.target,
              'dig',
              440,
            )
            if (chase) moves.push(chase)
          }
        }
        if (defender && blockerIds.has(defender.id) && !isBlocked && !isPoint) {
          digTarget = cloneCell(event.target)
        }

        const blockedDrop = isBlocked
          ? cell(attacker?.side ?? 'away', 1, event.target.col)
          : event.target

        push({
          kind: 'spike',
          duration: 900,
          caption: `${label.toUpperCase()} · ${playerName(attacker, 'ATAQUE')}`,
          actorId: event.attackerId,
          pose: 'spike',
          fx: isBlocked ? 'block' : 'hit',
          moves,
          ball: {
            to: cloneCell(blockedDrop),
            arc: isBlocked ? 18 : 8,
            zFrom: 34,
            zTo: isBlocked ? 12 : isPoint ? 0 : 14,
            duration: 380,
            delay: 180,
            kind: 'spike',
          },
        })
        lastBall = cloneCell(blockedDrop)
        break
      }

      case 'DIG': {
        const defender = getPlayer(event.defenderId)
        const arrive = digTarget
          ? move(event.defenderId, digTarget, 'dig', 320)
          : null
        digTarget = null
        push({
          kind: 'dig',
          duration: 760,
          caption: `¡DEFENSA · ${playerName(defender, 'LÍBERO')}!`,
          actorId: event.defenderId,
          pose: 'dig',
          fx: 'hit',
          moves: arrive ? [arrive] : [],
          ball: {
            to: cloneCell(event.to),
            arc: 36,
            zFrom: 12,
            zTo: 26,
            duration: 480,
            delay: 110,
            kind: 'pass',
          },
        })
        lastBall = cloneCell(event.to)
        break
      }

      case 'POINT': {
        addPoint(event.side, event.score, event.reason, lastBall)
        break
      }

      case 'MATCH_END':
        break
    }
  }

  if (!final && post.phase === 'SERVE') {
    const server = post.players.find(
      (player) =>
        player.side === post.server && player.classId === 'opposite',
    )
    const resetMoves = post.players
      .map((player) =>
        sameCell(at[player.id], player.cell)
          ? null
          : move(player.id, player.cell, 'run', 420),
      )
      .filter((entry): entry is MoveSpec => entry !== null)
    push({
      kind: 'wait',
      duration: 620,
      caption: `SAQUE · ${playerName(server, teamName(post.server))}`,
      moves: resetMoves,
      ball: {
        to: cloneCell(post.ball),
        arc: 26,
        zFrom: 0,
        zTo: 46,
        duration: 420,
        delay: 100,
        kind: 'free',
      },
    })
  }

  return beats
}
