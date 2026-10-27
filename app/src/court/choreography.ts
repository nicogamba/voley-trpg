import { cellCenter, ease, lerp } from './geometry'
import type {
  BeatKind,
  BeatSpec,
  CourtCell,
  CourtPlayer,
  Pose,
  Side,
  Vec,
} from './types'

export type PlayerSegment = {
  start: number
  duration: number
  from: Vec
  to: Vec
  pose: Pose
  jump: number
}

export type BallSegment = {
  start: number
  duration: number
  from: Vec
  to: Vec
  zFrom: number
  zTo: number
  arc: number
  kind: 'serve' | 'pass' | 'set' | 'spike' | 'free'
}

export type TimelineBeat = {
  start: number
  end: number
  kind: BeatKind
  caption: string
  point?: Side
  fx?: BeatSpec['fx']
}

export type Timeline = {
  initialPlayers: Record<string, Vec>
  initialBall: Vec
  initialBallZ: number
  players: Record<string, PlayerSegment[]>
  balls: BallSegment[]
  beats: TimelineBeat[]
  total: number
  lastBall: Vec
  lastBallZ: number
}

const pushSegment = (
  timeline: Timeline,
  playerId: string,
  segment: PlayerSegment,
) => {
  const list = timeline.players[playerId] ?? []
  list.push(segment)
  timeline.players[playerId] = list
}

const poseDuration = (beat: BeatSpec): number => {
  if (beat.kind === 'spike' || beat.kind === 'serve') {
    return Math.min(beat.duration, 680)
  }
  return beat.duration
}

export const buildTimeline = (
  players: CourtPlayer[],
  script: BeatSpec[],
  initialBallCell: CourtCell,
): Timeline => {
  const initialPlayers: Record<string, Vec> = {}
  const positions: Record<string, Vec> = {}
  for (const player of players) {
    const center = cellCenter(player.cell)
    initialPlayers[player.id] = center
    positions[player.id] = center
  }

  const timeline: Timeline = {
    initialPlayers,
    initialBall: cellCenter(initialBallCell),
    initialBallZ: 46,
    players: {},
    balls: [],
    beats: [],
    total: 0,
    lastBall: cellCenter(initialBallCell),
    lastBallZ: 46,
  }

  let cursor = 0
  let ballPos = timeline.initialBall
  let ballZ = timeline.initialBallZ

  for (const beat of script) {
    const start = cursor
    const end = start + beat.duration
    const moved = new Set<string>()

    for (const move of beat.moves ?? []) {
      const from = positions[move.playerId]
      if (!from) continue
      const to = cellCenter(move.to)
      const duration = Math.min(move.duration ?? beat.duration, beat.duration)
      const pose = move.pose ?? 'run'
      pushSegment(timeline, move.playerId, {
        start,
        duration,
        from,
        to,
        pose,
        jump: move.jump ?? 0,
      })
      positions[move.playerId] = to
      moved.add(move.playerId)
      if (pose !== 'celebrate') {
        pushSegment(timeline, move.playerId, {
          start: start + duration,
          duration: 0,
          from: to,
          to,
          pose: 'idle',
          jump: 0,
        })
      }
    }

    if (beat.actorId && !moved.has(beat.actorId)) {
      const from = positions[beat.actorId]
      if (from) {
        const duration = beat.pose ? poseDuration(beat) : beat.duration
        const pose = beat.pose ?? 'idle'
        const jump =
          beat.kind === 'spike' ? 28 : beat.kind === 'serve' ? 4 : 0
        pushSegment(timeline, beat.actorId, {
          start,
          duration,
          from,
          to: from,
          pose,
          jump,
        })
        if (pose !== 'celebrate') {
          pushSegment(timeline, beat.actorId, {
            start: start + duration,
            duration: 0,
            from,
            to: from,
            pose: 'idle',
            jump: 0,
          })
        }
      }
    }

    if (beat.ball) {
      const from = ballPos
      const to = cellCenter(beat.ball.to)
      const delay = beat.ball.delay ?? 0
      const duration = Math.max(
        120,
        beat.ball.duration ?? Math.max(120, beat.duration - delay),
      )
      const zFrom = beat.ball.zFrom ?? ballZ
      const zTo = beat.ball.zTo ?? 20
      timeline.balls.push({
        start: start + delay,
        duration,
        from,
        to,
        zFrom,
        zTo,
        arc: beat.ball.arc ?? 26,
        kind: beat.ball.kind ?? 'free',
      })
      ballPos = to
      ballZ = zTo
    }

    timeline.beats.push({
      start,
      end,
      kind: beat.kind,
      caption: beat.caption,
      point: beat.point,
      fx: beat.fx,
    })
    cursor = end
  }

  timeline.total = cursor
  timeline.lastBall = ballPos
  timeline.lastBallZ = ballZ
  return timeline
}

export type PlayerSample = {
  x: number
  y: number
  groundY: number
  pose: Pose
  jump: number
  moving: boolean
  /** Progreso dentro del segmento actual, 0..1. */
  progress: number
}

export const samplePlayer = (
  timeline: Timeline,
  playerId: string,
  t: number,
): PlayerSample => {
  const base = timeline.initialPlayers[playerId] ?? { x: 0, y: 0 }
  const segments = timeline.players[playerId] ?? []
  let x = base.x
  let y = base.y
  let pose: Pose = 'idle'
  let jump = 0
  let moving = false
  let progress = 1

  for (const segment of segments) {
    if (t < segment.start) break
    pose = segment.pose
    const length = Math.max(1, segment.duration)
    if (t <= segment.start + segment.duration) {
      const raw = (t - segment.start) / length
      const p = ease(raw)
      progress = Math.min(1, Math.max(0, raw))
      x = lerp(segment.from.x, segment.to.x, p)
      y = lerp(segment.from.y, segment.to.y, p)
      jump = Math.sin(Math.PI * p) * segment.jump
      moving =
        segment.from.x !== segment.to.x || segment.from.y !== segment.to.y
      break
    }
    x = segment.to.x
    y = segment.to.y
    jump = 0
    moving = false
    progress = 1
  }

  return { x, y, groundY: y, pose, jump, moving, progress }
}

export type BallSample = {
  groundX: number
  groundY: number
  z: number
  segment: BallSegment | null
  /** Progreso dentro del segmento actual, 0..1. */
  progress: number
}

export const sampleBall = (timeline: Timeline, t: number): BallSample => {
  let x = timeline.initialBall.x
  let y = timeline.initialBall.y
  let z = timeline.initialBallZ
  let segment: BallSegment | null = null

  for (const current of timeline.balls) {
    if (t < current.start) break
    segment = current
    const length = Math.max(1, current.duration)
    if (t <= current.start + current.duration) {
      const raw = (t - current.start) / length
      const p = ease(raw)
      x = lerp(current.from.x, current.to.x, p)
      y = lerp(current.from.y, current.to.y, p)
      z = lerp(current.zFrom, current.zTo, p) + Math.sin(Math.PI * p) * current.arc
      return { groundX: x, groundY: y, z, segment: current, progress: raw }
    }
    x = current.to.x
    y = current.to.y
    z = current.zTo
  }

  return {
    groundX: x,
    groundY: y,
    z,
    segment,
    progress: segment ? 1 : 0,
  }
}

export const beatAt = (
  timeline: Timeline,
  t: number,
): TimelineBeat | null => {
  const first = timeline.beats[0]
  if (!first) return null
  if (t < first.start) return first
  for (const beat of timeline.beats) {
    if (t >= beat.start && t < beat.end) return beat
  }
  return timeline.beats.at(-1) ?? null
}
