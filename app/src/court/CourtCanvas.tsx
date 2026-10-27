import { useEffect, useMemo, useRef } from 'react'
import { COURT } from './geometry'
import {
  beatAt,
  buildTimeline,
  sampleBall,
  samplePlayer,
} from './choreography'
import type {
  BeatSpec,
  CourtCell,
  CourtPlayer,
  CourtTeam,
  Pose,
  Side,
} from './types'

const CLASS_ACCENT: Record<CourtPlayer['classId'], string> = {
  setter: '#65d68a',
  middle: '#ffd166',
  opposite: '#ff8fa3',
  libero: '#67d8ef',
}

const CLASS_LETTER: Record<CourtPlayer['classId'], string> = {
  setter: 'A',
  middle: 'C',
  opposite: 'O',
  libero: 'L',
}

const SKIN = '#e8b98a'
const HAIR = '#241a2b'
const OUTLINE = '#05070d'

type Props = {
  players: CourtPlayer[]
  script: BeatSpec[]
  initialBall: CourtCell
  teams: Record<Side, CourtTeam>
  onCaption: (caption: string) => void
  onPoint?: (side: Side) => void
  onEnd?: () => void
}

const drawCourt = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, COURT.width, COURT.height)

  // Mitad rival y mitad propia.
  ctx.fillStyle = '#170d18'
  ctx.fillRect(COURT.left, COURT.top, COURT.cellW * 4, COURT.cellH * 3)
  ctx.fillStyle = '#0b1830'
  ctx.fillRect(
    COURT.left,
    COURT.netY,
    COURT.cellW * 4,
    COURT.cellH * 3,
  )

  // Grilla tenue para leer el movimiento.
  ctx.strokeStyle = 'rgba(120, 150, 210, 0.08)'
  ctx.lineWidth = 1
  for (let col = 0; col <= 4; col += 1) {
    const x = COURT.left + col * COURT.cellW + 0.5
    ctx.beginPath()
    ctx.moveTo(x, COURT.top)
    ctx.lineTo(x, COURT.top + COURT.cellH * 6)
    ctx.stroke()
  }
  for (let row = 0; row <= 6; row += 1) {
    const y = COURT.top + row * COURT.cellH + 0.5
    ctx.beginPath()
    ctx.moveTo(COURT.left, y)
    ctx.lineTo(COURT.left + COURT.cellW * 4, y)
    ctx.stroke()
  }

  // Líneas de cancha.
  ctx.strokeStyle = '#3a4a70'
  ctx.strokeRect(
    COURT.left + 0.5,
    COURT.top + 0.5,
    COURT.cellW * 4 - 1,
    COURT.cellH * 6 - 1,
  )

  // Línea de ataque (3 metros) de cada lado.
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = 'rgba(180, 200, 240, 0.34)'
  for (const y of [
    COURT.top + COURT.cellH * 2,
    COURT.netY + COURT.cellH,
  ]) {
    ctx.beginPath()
    ctx.moveTo(COURT.left, y + 0.5)
    ctx.lineTo(COURT.left + COURT.cellW * 4, y + 0.5)
    ctx.stroke()
  }
  ctx.setLineDash([])

  drawNet(ctx)
}

const drawNet = (ctx: CanvasRenderingContext2D) => {
  const left = COURT.left
  const right = COURT.left + COURT.cellW * 4

  ctx.fillStyle = 'rgba(5, 7, 13, 0.55)'
  ctx.fillRect(left, COURT.netY - 4, right - left, 8)

  ctx.strokeStyle = 'rgba(207, 216, 238, 0.28)'
  ctx.lineWidth = 1
  for (let x = left + 4; x < right; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, COURT.netY - 4)
    ctx.lineTo(x + 0.5, COURT.netY + 4)
    ctx.stroke()
  }

  ctx.fillStyle = '#e8eefc'
  ctx.fillRect(left, COURT.netY - 1, right - left, 2)

  // Postes.
  ctx.fillStyle = '#cfd8ee'
  ctx.fillRect(left - 4, COURT.netY - 11, 3, 22)
  ctx.fillRect(right + 1, COURT.netY - 11, 3, 22)
  ctx.fillStyle = '#ffd166'
  ctx.fillRect(left - 4, COURT.netY - 11, 3, 3)
  ctx.fillRect(right + 1, COURT.netY - 11, 3, 3)

  ctx.font = '700 8px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(232, 238, 252, 0.9)'
  ctx.fillText('RED', COURT.width / 2, COURT.netY - 8)
}

const drawShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
) => {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
  ctx.fillRect(x - width / 2, y - height / 2, width, height)
}

const rect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
) => {
  ctx.fillStyle = fill
  ctx.fillRect(Math.round(x), Math.round(y), width, height)
}

const drawBall = (
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  z: number,
  time: number,
) => {
  const shadowScale = Math.max(0.35, 1 - z / 110)
  drawShadow(
    ctx,
    x,
    groundY + 2,
    10 * shadowScale,
    4 * shadowScale,
    0.42,
  )

  const ballX = Math.round(x - 4)
  const ballY = Math.round(groundY - z - 8)
  rect(ctx, ballX, ballY, 8, 8, '#ffffff')
  rect(ctx, ballX + 1, ballY + 1, 6, 6, '#f6e6a8')
  rect(ctx, ballX + 3, ballY + 1, 2, 6, '#5b8cff')
  rect(ctx, ballX + 1, ballY + 3, 6, 2, '#ffffff')
  // Brillo pixelado.
  const glint = Math.sin(time * 0.012) > 0.2 ? '#ffffff' : '#fff6cc'
  rect(ctx, ballX + 1, ballY + 1, 2, 2, glint)
}

const drawPlayer = (
  ctx: CanvasRenderingContext2D,
  player: CourtPlayer,
  kit: CourtTeam['kit'],
  x: number,
  groundY: number,
  jump: number,
  pose: Pose,
  time: number,
  active: boolean,
) => {
  const team = kit
  const accent = CLASS_ACCENT[player.classId]
  let feet = groundY - jump
  const bob = pose === 'idle' ? Math.sin(time * 0.004 + x) * 0.9 : 0
  feet += bob

  if (pose === 'receive' || pose === 'dig') feet += 4

  drawShadow(ctx, x, groundY + 1, jump > 4 ? 16 : 20, 5, 0.42)

  const legTop = feet - 9
  const torsoTop = feet - 23
  const headTop = feet - 33

  // Piernas.
  if (pose === 'run') {
    const swing = Math.sin(time * 0.018)
    rect(ctx, x - 7 - swing * 2, legTop + 1, 4, 9, team.shorts)
    rect(ctx, x + 3 + swing * 2, legTop, 4, 9, team.shorts)
  } else if (pose === 'jump' || pose === 'spike' || pose === 'block') {
    rect(ctx, x - 6, legTop + 3, 4, 6, team.shorts)
    rect(ctx, x + 2, legTop + 2, 4, 7, team.shorts)
  } else if (pose === 'receive' || pose === 'dig') {
    rect(ctx, x - 7, legTop + 2, 5, 6, team.shorts)
    rect(ctx, x + 2, legTop + 2, 5, 6, team.shorts)
  } else {
    rect(ctx, x - 6, legTop, 4, 9, team.shorts)
    rect(ctx, x + 2, legTop, 4, 9, team.shorts)
  }

  // Torso.
  const torsoX = pose === 'spike' ? x - 5 : x - 6
  rect(ctx, torsoX, torsoTop, 12, 14, team.shirt)
  rect(ctx, torsoX + 1, torsoTop + 1, 10, 3, team.trim)
  rect(ctx, torsoX + 4, torsoTop + 6, 4, 4, accent)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1
  ctx.strokeRect(
    Math.round(torsoX) + 0.5,
    Math.round(torsoTop) + 0.5,
    11,
    13,
  )

  // Cabeza y pelo.
  rect(ctx, x - 4, headTop, 8, 8, SKIN)
  rect(ctx, x - 4, headTop - 1, 8, 3, HAIR)
  rect(ctx, x - 5, headTop - 1, 10, 1, HAIR)
  ctx.strokeRect(Math.round(x - 4) + 0.5, Math.round(headTop) + 0.5, 7, 7)

  // Brazos según la pose.
  const armTop = torsoTop + 1
  const armHeight = 10
  if (pose === 'block') {
    rect(ctx, x - 8, headTop - 6, 3, 13, SKIN)
    rect(ctx, x + 5, headTop - 6, 3, 13, SKIN)
  } else if (pose === 'spike') {
    rect(ctx, x - 10, headTop - 5, 3, 14, SKIN)
    rect(ctx, x + 6, armTop + 2, 3, 8, SKIN)
  } else if (pose === 'set') {
    rect(ctx, x - 4, headTop - 7, 3, 10, SKIN)
    rect(ctx, x + 2, headTop - 7, 3, 10, SKIN)
  } else if (pose === 'receive' || pose === 'dig') {
    rect(ctx, x - 7, armTop + 5, 14, 3, SKIN)
  } else if (pose === 'serve') {
    rect(ctx, x + 6, headTop - 4, 3, 13, SKIN)
    rect(ctx, x - 8, armTop + 4, 3, 8, SKIN)
  } else if (pose === 'celebrate') {
    rect(ctx, x - 9, headTop - 5, 3, 12, SKIN)
    rect(ctx, x + 6, headTop - 5, 3, 12, SKIN)
  } else if (pose === 'run') {
    const swing = Math.sin(time * 0.018)
    rect(ctx, x - 8 + swing * 2, armTop, 3, armHeight, SKIN)
    rect(ctx, x + 6 - swing * 2, armTop, 3, armHeight, SKIN)
  } else {
    rect(ctx, x - 8, armTop, 3, armHeight, SKIN)
    rect(ctx, x + 6, armTop, 3, armHeight, SKIN)
  }

  // Distintivo de clase.
  const badge =
    pose === 'block' || pose === 'spike' || pose === 'set'
      ? headTop - 16
      : feet - 44
  rect(ctx, x - 5, badge, 10, 10, OUTLINE)
  rect(ctx, x - 4, badge + 1, 8, 8, accent)
  if (active) {
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 2
    ctx.strokeRect(Math.round(x - 5) + 1, Math.round(badge) + 1, 8, 8)
  }
  ctx.fillStyle = '#111318'
  ctx.font = '700 7px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(CLASS_LETTER[player.classId], x, badge + 5.5)
}

const drawName = (
  ctx: CanvasRenderingContext2D,
  player: CourtPlayer,
  x: number,
  groundY: number,
  active: boolean,
) => {
  ctx.font = '700 7px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillText(player.name, x + 1, groundY + 13)
  ctx.fillStyle = active
    ? '#ffd166'
    : player.side === 'home'
      ? 'rgba(185, 200, 234, 0.9)'
      : 'rgba(231, 185, 194, 0.9)'
  ctx.fillText(player.name, x, groundY + 12)
}

const drawImpact = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
) => {
  const alpha = Math.max(0, 1 - progress)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.65 * alpha})`
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i
    const distance = 6 + progress * 18
    const px = x + Math.cos(angle) * distance
    const py = y + Math.sin(angle) * distance
    ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3)
  }
}

export const CourtCanvas = ({
  players,
  script,
  initialBall,
  teams,
  onCaption,
  onPoint,
  onEnd,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const callbacks = useRef({ onCaption, onPoint, onEnd })

  useEffect(() => {
    callbacks.current = { onCaption, onPoint, onEnd }
  }, [onCaption, onPoint, onEnd])

  const timeline = useMemo(
    () => buildTimeline(players, script, initialBall),
    [players, script, initialBall],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let lastCaption = ''
    let pointFired = false
    let ended = false
    const started = performance.now()
    const animated = timeline.total > 0
    const held = timeline.balls.length === 0
    const tail =
      script.length === 1 && script[0]?.kind === 'move' ? 100 : 350

    const frame = (now: number) => {
      const t = Math.max(0, now - started)
      const beat = beatAt(timeline, t)
      const ball = sampleBall(timeline, t)
      const active = beat?.caption ?? ''

      let shakeX = 0
      let shakeY = 0
      if (beat?.kind === 'spike') {
        const local = t - beat.start
        if (local > 180 && local < 520) {
          shakeX = Math.sin(t * 0.09) * 2
          shakeY = Math.cos(t * 0.11) * 1
        }
      }

      ctx.save()
      ctx.clearRect(0, 0, COURT.width, COURT.height)
      ctx.translate(shakeX, shakeY)
      drawCourt(ctx)

      const samples = players.map((player) => ({
        player,
        sample: samplePlayer(timeline, player.id, t),
      }))
      samples.sort((a, b) => a.sample.groundY - b.sample.groundY)

      for (const { player, sample } of samples) {
        drawPlayer(
          ctx,
          player,
          teams[player.side].kit,
          sample.x,
          sample.groundY,
          sample.jump,
          sample.pose,
          t,
          beat?.caption.includes(player.name) ?? false,
        )
      }

      // Nombres al piso: no se mueven con el salto.
      for (const { player, sample } of samples) {
        drawName(
          ctx,
          player,
          sample.x,
          sample.groundY,
          beat?.caption.includes(player.name) ?? false,
        )
      }

      // Rastro de la pelota.
      if (ball.segment) {
        for (let index = 1; index <= 4; index += 1) {
          const past = sampleBall(timeline, t - index * 34)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.16 / index})`
          ctx.fillRect(
            Math.round(past.groundX) - 2,
            Math.round(past.groundY - past.z - 6),
            4,
            4,
          )
        }
      }

      drawBall(
        ctx,
        ball.groundX + (held ? 11 : 0),
        ball.groundY,
        ball.z,
        t,
      )

      if (
        ball.segment?.kind === 'spike' &&
        ball.progress > 0.82 &&
        ball.progress < 0.99
      ) {
        drawImpact(
          ctx,
          ball.groundX,
          ball.groundY - ball.z - 4,
          (ball.progress - 0.82) / 0.17,
        )
      }

      if (beat?.fx === 'floor') {
        const local = (t - beat.start) / 400
        if (local < 1) {
          const alpha = 1 - local
          ctx.fillStyle = `rgba(255, 209, 102, ${0.5 * alpha})`
          for (let i = 0; i < 6; i += 1) {
            const angle = (Math.PI / 3) * i
            const distance = 6 + local * 26
            ctx.fillRect(
              Math.round(ball.groundX + Math.cos(angle) * distance) - 1,
              Math.round(ball.groundY + Math.sin(angle) * distance * 0.4) - 1,
              3,
              2,
            )
          }
        }
      }

      if (beat?.point && t - beat.start < 100) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.fillRect(0, 0, COURT.width, COURT.height)
      }

      ctx.restore()

      if (active && active !== lastCaption) {
        lastCaption = active
        callbacks.current.onCaption(active)
      }
      if (beat?.point && !pointFired) {
        pointFired = true
        callbacks.current.onPoint?.(beat.point)
      }

      if (!animated) return

      if (t < timeline.total + tail) {
        raf = requestAnimationFrame(frame)
      } else if (!ended) {
        ended = true
        callbacks.current.onEnd?.()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [timeline, players, script, teams])

  return (
    <canvas
      ref={canvasRef}
      width={COURT.width}
      height={COURT.height}
      className="court-canvas"
      aria-label={`Cancha de vóley animada. ${teams.home.name} contra ${teams.away.name}.`}
    />
  )
}

export default CourtCanvas
