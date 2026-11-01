import { useEffect, useMemo, useRef } from 'react'
import { COURT } from './geometry'
import {
  beatAt,
  buildTimeline,
  sampleBall,
  samplePlayer,
} from './choreography'
import type {
  BallSample,
  PlayerSample,
  TimelineBeat,
} from './choreography'
import { BALL_SHEET, loadImage, sheetFor } from './sprites'
import { playCue } from './audio'
import type {
  BeatSpec,
  CourtCell,
  CourtPlayer,
  CourtTeam,
  CutInSpec,
  Pose,
  Side,
} from './types'

const CLASS_ACCENT: Record<CourtPlayer['classId'], string> = {
  setter: '#65d68a',
  middle: '#ffd166',
  opposite: '#ff8fa3',
  libero: '#67d8ef',
  wing: '#c9a0ff',
}

const CLASS_LETTER: Record<CourtPlayer['classId'], string> = {
  setter: 'A',
  middle: 'C',
  opposite: 'O',
  libero: 'L',
  wing: 'P',
}

const ART_W = 48
const ART_H = 58
const ART_COLS = 5
const ART_FEET = 56

/**
 * Frames de las hojas generadas. 0-1 reposo, 2-6 caminar/correr,
 * 7-8 recepción, 9-10 y 14 bloqueo, 11-13 remate, 15-16 zambullida,
 * 17-18 festejo.
 */
const artFrameFor = (pose: Pose, progress: number, time: number): number => {
  switch (pose) {
    case 'idle':
      return Math.floor(time / 520) % 2
    case 'run':
      return 2 + (Math.floor(time / 90) % 5)
    case 'jump':
      return 13
    case 'serve':
      return progress < 0.55 ? 11 : 12
    case 'receive':
      return progress < 0.5 ? 7 : 8
    case 'set':
      return progress < 0.5 ? 9 : 10
    case 'spike':
      return progress < 0.42 ? 11 : progress < 0.8 ? 12 : 13
    case 'dig':
      return progress < 0.55 ? 15 : 16
    case 'block':
      return [9, 10, 14][Math.floor(time / 140) % 3]
    case 'celebrate':
      return 17 + (Math.floor(time / 220) % 2)
  }
}

const drawArtPlayer = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: number,
  x: number,
  groundY: number,
  jump: number,
) => {
  const col = frame % ART_COLS
  const row = Math.floor(frame / ART_COLS)
  const dx = Math.round(x - ART_W / 2)
  const dy = Math.round(groundY - jump - ART_H + (ART_H - ART_FEET))
  ctx.drawImage(
    image,
    col * ART_W,
    row * ART_H,
    ART_W,
    ART_H,
    dx,
    dy,
    ART_W,
    ART_H,
  )
}

const drawActiveRing = (
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
) => {
  ctx.save()
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x, groundY + 1, 12, 4, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
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
  onCutIn?: (cutin: CutInSpec, duration: number) => void
  muted?: boolean
}

const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const drawCourt = (
  ctx: CanvasRenderingContext2D,
  teams: Record<Side, CourtTeam>,
) => {
  const left = COURT.left
  const top = COURT.top
  const width = COURT.cellW * 4
  const height = COURT.cellH * 6
  const right = left + width
  const bottom = top + height

  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, COURT.width, COURT.height)

  // Luz de estadio y marco de la cancha.
  const glow = ctx.createRadialGradient(
    COURT.width / 2,
    COURT.netY,
    30,
    COURT.width / 2,
    COURT.netY,
    280,
  )
  glow.addColorStop(0, 'rgba(91, 140, 255, 0.12)')
  glow.addColorStop(1, 'rgba(5, 7, 13, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, COURT.width, COURT.height)

  // Mitad rival y mitad propia.
  ctx.fillStyle = '#170d18'
  ctx.fillRect(left, top, width, COURT.cellH * 3)
  ctx.fillStyle = '#0b1830'
  ctx.fillRect(left, COURT.netY, width, COURT.cellH * 3)

  // Zonas de equipo.
  const awayZone = ctx.createLinearGradient(0, top, 0, top + COURT.cellH * 2)
  awayZone.addColorStop(0, withAlpha(teams.away.kit.shirt, 0.18))
  awayZone.addColorStop(1, withAlpha(teams.away.kit.shirt, 0))
  ctx.fillStyle = awayZone
  ctx.fillRect(left, top, width, COURT.cellH * 2)
  const homeZone = ctx.createLinearGradient(
    0,
    bottom - COURT.cellH * 2,
    0,
    bottom,
  )
  homeZone.addColorStop(0, withAlpha(teams.home.kit.shirt, 0))
  homeZone.addColorStop(1, withAlpha(teams.home.kit.shirt, 0.18))
  ctx.fillStyle = homeZone
  ctx.fillRect(left, bottom - COURT.cellH * 2, width, COURT.cellH * 2)

  // Reflejos diagonales del piso.
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, width, height)
  ctx.clip()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.022)'
  for (let x = -height; x < width; x += 56) {
    ctx.beginPath()
    ctx.moveTo(left + x, top)
    ctx.lineTo(left + x + 16, top)
    ctx.lineTo(left + x + 16 + height, bottom)
    ctx.lineTo(left + x + height, bottom)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Haces de luz.
  const beam = ctx.createLinearGradient(0, 0, 0, 330)
  beam.addColorStop(0, 'rgba(103, 216, 239, 0.06)')
  beam.addColorStop(1, 'rgba(103, 216, 239, 0)')
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.moveTo(26, 10)
  ctx.lineTo(112, 330)
  ctx.lineTo(248, 330)
  ctx.lineTo(334, 10)
  ctx.closePath()
  ctx.fill()

  // Carteles LED del perímetro.
  ctx.fillStyle = '#070b14'
  ctx.fillRect(0, 0, COURT.width, 10)
  ctx.fillRect(0, COURT.height - 10, COURT.width, 10)
  ctx.fillRect(0, top, 8, height)
  ctx.fillRect(right, top, 8, height)
  ctx.fillStyle = 'rgba(103, 216, 239, 0.22)'
  ctx.fillRect(0, 9, COURT.width, 1)
  ctx.fillRect(0, COURT.height - 10, COURT.width, 1)
  ctx.font = '700 6px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = withAlpha(teams.away.kit.trim, 0.9)
  ctx.fillText(teams.away.short, 24, 5)
  ctx.fillStyle = '#67d8ef'
  ctx.fillText('ZONA 3 · CANCHA CENTRAL', COURT.width / 2, 5)
  ctx.fillStyle = withAlpha(teams.home.kit.trim, 0.9)
  ctx.fillText(teams.home.short, COURT.width - 24, 5)
  ctx.fillStyle = 'rgba(255, 209, 102, 0.8)'
  ctx.fillText('VÓLEY 4V4 · COPA ZONA 3', COURT.width / 2, 479)

  for (let y = top + 6; y < bottom; y += 18) {
    ctx.fillStyle = withAlpha(teams.away.kit.shirt, 0.3)
    ctx.fillRect(2, y, 4, 9)
    ctx.fillStyle = withAlpha(teams.home.kit.shirt, 0.3)
    ctx.fillRect(right + 2, y, 4, 9)
  }

  // Líneas de cancha.
  ctx.strokeStyle = '#3a4a70'
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)

  // Línea de ataque (3 metros) de cada lado.
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = 'rgba(180, 200, 240, 0.34)'
  for (const y of [top + COURT.cellH * 2, COURT.netY + COURT.cellH]) {
    ctx.beginPath()
    ctx.moveTo(left, y + 0.5)
    ctx.lineTo(right, y + 0.5)
    ctx.stroke()
  }
  ctx.setLineDash([])

  drawNet(ctx, teams)
}

const drawNet = (
  ctx: CanvasRenderingContext2D,
  teams: Record<Side, CourtTeam>,
) => {
  const left = COURT.left
  const right = COURT.left + COURT.cellW * 4

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.fillRect(left, COURT.netY + 5, right - left, 4)

  ctx.fillStyle = 'rgba(5, 7, 13, 0.62)'
  ctx.fillRect(left, COURT.netY - 6, right - left, 12)

  // Malla.
  ctx.strokeStyle = 'rgba(207, 216, 238, 0.22)'
  ctx.lineWidth = 1
  for (let x = left + 4; x < right; x += 8) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, COURT.netY - 5)
    ctx.lineTo(x + 0.5, COURT.netY + 5)
    ctx.stroke()
  }
  for (const y of [COURT.netY - 3, COURT.netY, COURT.netY + 3]) {
    ctx.beginPath()
    ctx.moveTo(left, y + 0.5)
    ctx.lineTo(right, y + 0.5)
    ctx.stroke()
  }

  // Cinta superior e inferior.
  ctx.fillStyle = '#e8eefc'
  ctx.fillRect(left, COURT.netY - 2, right - left, 2)
  ctx.fillStyle = 'rgba(232, 238, 252, 0.55)'
  ctx.fillRect(left, COURT.netY + 4, right - left, 1)

  // Postes.
  ctx.fillStyle = '#05070d'
  ctx.fillRect(left - 7, COURT.netY - 15, 6, 30)
  ctx.fillRect(right + 1, COURT.netY - 15, 6, 30)
  ctx.fillStyle = '#cfd8ee'
  ctx.fillRect(left - 6, COURT.netY - 14, 4, 28)
  ctx.fillRect(right + 2, COURT.netY - 14, 4, 28)
  ctx.fillStyle = teams.away.kit.trim
  ctx.fillRect(left - 6, COURT.netY - 14, 4, 3)
  ctx.fillStyle = teams.home.kit.trim
  ctx.fillRect(right + 2, COURT.netY - 14, 4, 3)

  ctx.font = '700 7px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(232, 238, 252, 0.82)'
  ctx.fillText('RED', COURT.width / 2, COURT.netY - 9)
}

const drawShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
) => {
  ctx.save()
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
  ctx.beginPath()
  ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const gradient = ctx.createRadialGradient(
    COURT.width / 2,
    COURT.height / 2,
    130,
    COURT.width / 2,
    COURT.height / 2,
    300,
  )
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.34)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, COURT.width, COURT.height)
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

type Camera = {
  x: number
  y: number
  zoom: number
}

const FULL_CAMERA: Camera = {
  x: COURT.width / 2,
  y: COURT.height / 2,
  zoom: 1,
}

const clampAxis = (value: number, size: number, view: number): number => {
  if (view >= size - 4) return size / 2
  return Math.min(size - view / 2 - 2, Math.max(view / 2 + 2, value))
}

const clampCamera = (camera: Camera): Camera => {
  const viewW = COURT.width / camera.zoom
  const viewH = COURT.height / camera.zoom
  return {
    x: clampAxis(camera.x, COURT.width, viewW),
    y: clampAxis(camera.y, COURT.height, viewH),
    zoom: camera.zoom,
  }
}

/** La cámara se acerca al contacto y vuelve a la cancha completa al cerrar. */
const cameraTarget = (
  beat: TimelineBeat | null,
  actor: PlayerSample | null,
  ball: BallSample,
): Camera => {
  if (!beat) return FULL_CAMERA

  switch (beat.kind) {
    case 'serve': {
      const zoom = 1.45 + Math.min(1, Math.max(0, (ball.z - 22) / 36)) * 0.15
      return {
        x: ball.groundX,
        y: ball.groundY - ball.z * 0.55 - 6,
        zoom,
      }
    }
    case 'receive': {
      if (!actor) return FULL_CAMERA
      const ballY = ball.groundY - ball.z * 0.35 - 6
      return {
        x: actor.x * 0.65 + ball.groundX * 0.35,
        y: (actor.groundY - 18) * 0.65 + ballY * 0.35,
        zoom: 1.55,
      }
    }
    case 'set': {
      if (!actor) return FULL_CAMERA
      const ballY = ball.groundY - ball.z * 0.35 - 6
      return {
        x: actor.x * 0.62 + ball.groundX * 0.38,
        y: (actor.groundY - 20) * 0.62 + ballY * 0.38,
        zoom: 1.4,
      }
    }
    case 'spike': {
      if (!actor) return FULL_CAMERA
      const blend = Math.min(
        1,
        Math.max(0, (ball.progress - 0.2) / 0.55),
      )
      return {
        x: actor.x + (ball.groundX - actor.x) * blend,
        y:
          actor.groundY -
          20 +
          (ball.groundY - ball.z * 0.35 - 4 - (actor.groundY - 20)) *
            blend,
        zoom: 1.65,
      }
    }
    case 'dig': {
      if (!actor) return FULL_CAMERA
      const ballY = ball.groundY - ball.z * 0.35 - 4
      return {
        x: actor.x * 0.62 + ball.groundX * 0.38,
        y: (actor.groundY - 12) * 0.62 + ballY * 0.38,
        zoom: 1.55,
      }
    }
    case 'point':
      return { x: COURT.width / 2, y: COURT.height / 2, zoom: 1.06 }
    default:
      return FULL_CAMERA
  }
}

const drawBall = (
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  z: number,
  time: number,
  phase: number,
  art: HTMLImageElement | null,
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

  if (art) {
    const frame = ((phase % 4) + 4) % 4
    ctx.drawImage(
      art,
      frame * 16,
      0,
      16,
      16,
      Math.round(x - 8),
      Math.round(groundY - z - 16),
      16,
      16,
    )
    return
  }

  const ballX = Math.round(x - 4)
  const ballY = Math.round(groundY - z - 8)
  rect(ctx, ballX, ballY, 8, 8, '#ffffff')
  rect(ctx, ballX + 1, ballY + 1, 6, 6, '#f6e6a8')
  // La franja azul se corre para simular el giro.
  const shift = [0, 1, 1, 0][phase % 4]
  rect(ctx, ballX + 2 + shift, ballY + 1, 2, 6, '#5b8cff')
  rect(ctx, ballX + 5 - shift, ballY + 2, 1, 4, '#f6e6a8')
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
  progress: number,
  moving: boolean,
) => {
  const team = kit
  const accent = CLASS_ACCENT[player.classId]
  const lunge = pose === 'dig' && moving ? Math.sin(Math.PI * progress) : 0
  let feet = groundY - jump
  const bob = pose === 'idle' ? Math.sin(time * 0.004 + x) * 0.9 : 0
  feet += bob

  if (pose === 'receive' || pose === 'dig') feet += 4 + lunge * 3

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

  // Torso. En la zambullida se estira en horizontal.
  const torsoW = pose === 'dig' ? 12 + Math.round(lunge * 6) : 12
  const torsoX =
    pose === 'spike' ? x - 5 : x - Math.floor(torsoW / 2)
  rect(ctx, torsoX, torsoTop, torsoW, 14, team.shirt)
  rect(ctx, torsoX + 1, torsoTop + 1, torsoW - 2, 3, team.trim)
  rect(ctx, torsoX + Math.floor(torsoW / 2) - 2, torsoTop + 6, 4, 4, accent)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1
  ctx.strokeRect(
    Math.round(torsoX) + 0.5,
    Math.round(torsoTop) + 0.5,
    torsoW - 1,
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
    if (progress < 0.42) {
      // Armado del remate: brazo atacante atrás y arriba.
      rect(ctx, x - 9, headTop - 3, 3, 13, SKIN)
      rect(ctx, x + 5, headTop - 7, 3, 14, SKIN)
    } else {
      // Contacto y follow-through.
      rect(ctx, x - 10, headTop + 1, 3, 12, SKIN)
      rect(ctx, x + 6, armTop + 2, 3, 8, SKIN)
    }
  } else if (pose === 'set') {
    rect(ctx, x - 4, headTop - 7, 3, 10, SKIN)
    rect(ctx, x + 2, headTop - 7, 3, 10, SKIN)
  } else if (pose === 'receive') {
    rect(ctx, x - 7, armTop + 5, 14, 3, SKIN)
  } else if (pose === 'dig') {
    rect(
      ctx,
      x - 7 - lunge * 7,
      armTop + 5 + lunge * 2,
      14 + lunge * 9,
      3,
      SKIN,
    )
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

const drawDust = (
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  progress: number,
) => {
  const alpha = Math.max(0, 1 - progress)
  ctx.fillStyle = `rgba(214, 224, 244, ${0.5 * alpha})`
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.PI / 4 + (i / 5) * (Math.PI / 2)
    const distance = 4 + progress * 14
    ctx.fillRect(
      Math.round(x + Math.cos(angle) * distance) - 1,
      Math.round(groundY + Math.sin(angle) * distance * 0.35) - 1,
      2,
      2,
    )
  }
}

const CONFETTI = ['#ffd166', '#67d8ef', '#ff7a8a', '#8ef0a4', '#ffffff']

const drawConfetti = (
  ctx: CanvasRenderingContext2D,
  local: number,
  side: Side,
) => {
  if (local < 0 || local > 1100) return
  ctx.save()
  for (let i = 0; i < 36; i += 1) {
    const seed =
      Math.sin(i * 12.9898 + (side === 'home' ? 4.1 : 7.3)) * 43758.5453
    const rnd = seed - Math.floor(seed)
    const delay = (i % 6) * 55
    const progress = (local - delay) / 800
    if (progress < 0 || progress > 1) continue
    const x =
      12 + rnd * (COURT.width - 24) + Math.sin(progress * 9 + i) * 8
    const y = -10 + progress * (COURT.height + 24)
    ctx.globalAlpha = Math.min(1, (1 - progress) * 1.6)
    ctx.fillStyle = CONFETTI[i % CONFETTI.length]
    ctx.fillRect(Math.round(x), Math.round(y), 2, 3)
  }
  ctx.restore()
}

export const CourtCanvas = ({
  players,
  script,
  initialBall,
  teams,
  onCaption,
  onPoint,
  onEnd,
  onCutIn,
  muted = false,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const callbacks = useRef({ onCaption, onPoint, onEnd, onCutIn })
  const mutedRef = useRef(muted)

  useEffect(() => {
    callbacks.current = { onCaption, onPoint, onEnd, onCutIn }
  }, [onCaption, onPoint, onEnd, onCutIn])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

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
    let lastBeatStart = -1
    let lastCutIn = ''
    let lastFrame = performance.now()
    let artWaitFrames = 0
    const camera: Camera = { ...FULL_CAMERA }
    const started = performance.now()
    const animated = timeline.total > 0
    const held = timeline.balls.length === 0
    const tail =
      script.length === 1 && script[0]?.kind === 'move' ? 100 : 350

    const frame = (now: number) => {
      const t = Math.max(0, now - started)
      const beat = beatAt(timeline, t)
      const live = beat && t >= beat.start && t < beat.end ? beat : null
      const ball = sampleBall(timeline, t)
      const active = beat?.caption ?? ''
      let waitingForArt = false

      const samples = players.map((player) => ({
        player,
        sample: samplePlayer(timeline, player.id, t),
      }))
      samples.sort((a, b) => a.sample.groundY - b.sample.groundY)
      const actor = beat?.actorId
        ? (samples.find(({ player }) => player.id === beat.actorId)?.sample ??
          null)
        : null

      const wanted = clampCamera(cameraTarget(live, actor, ball))
      const dt = Math.max(1, Math.min(48, now - lastFrame))
      lastFrame = now
      const cameraEase = 1 - Math.exp(-dt / 110)
      camera.x += (wanted.x - camera.x) * cameraEase
      camera.y += (wanted.y - camera.y) * cameraEase
      camera.zoom += (wanted.zoom - camera.zoom) * cameraEase

      if (live?.cutin) {
        const key = `${live.start}:${live.cutin.kind}:${live.cutin.leftId}`
        if (key !== lastCutIn) {
          lastCutIn = key
          callbacks.current.onCutIn?.(live.cutin, live.end - live.start)
        }
      }

      if (live && live.start !== lastBeatStart) {
        lastBeatStart = live.start
        if (!mutedRef.current) {
          switch (live.kind) {
            case 'serve':
              playCue(live.fx === 'hit' ? 'hit' : 'toss')
              break
            case 'receive':
              playCue('receive')
              break
            case 'set':
              playCue('set')
              break
            case 'spike':
              playCue(live.fx === 'block' ? 'block' : 'spike')
              break
            case 'dig':
              playCue('dig')
              break
            case 'point':
              playCue('point')
              break
            case 'wait':
              playCue('whistle')
              break
            default:
              break
          }
        }
      }

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
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, COURT.width, COURT.height)
      ctx.translate(shakeX, shakeY)
      ctx.translate(COURT.width / 2, COURT.height / 2)
      ctx.scale(camera.zoom, camera.zoom)
      ctx.translate(-camera.x, -camera.y)
      drawCourt(ctx, teams)

      for (const { player, sample } of samples) {
        const active = live?.caption.includes(player.name) ?? false
        const sheet = loadImage(sheetFor(teams[player.side].id, player.classId))
        if (sheet) {
          drawShadow(
            ctx,
            sample.x,
            sample.groundY + 1,
            sample.jump > 4 ? 16 : 20,
            5,
            0.42,
          )
          drawArtPlayer(
            ctx,
            sheet,
            artFrameFor(sample.pose, sample.progress, t),
            sample.x,
            sample.groundY,
            sample.jump,
          )
          if (active) drawActiveRing(ctx, sample.x, sample.groundY)
        } else {
          waitingForArt = true
          drawPlayer(
            ctx,
            player,
            teams[player.side].kit,
            sample.x,
            sample.groundY,
            sample.jump,
            sample.pose,
            t,
            active,
            sample.progress,
            sample.moving,
          )
        }
        if (
          (sample.pose === 'dig' && sample.progress > 0.32) ||
          (sample.pose === 'spike' && sample.progress > 0.94)
        ) {
          const local =
            sample.pose === 'dig'
              ? (sample.progress - 0.32) / 0.5
              : (sample.progress - 0.94) / 0.06
          drawDust(ctx, sample.x, sample.groundY, Math.min(1, local))
        }
      }

      // Nombres al piso: no se mueven con el salto.
      for (const { player, sample } of samples) {
        drawName(
          ctx,
          player,
          sample.x,
          sample.groundY,
          live?.caption.includes(player.name) ?? false,
        )
      }

      // Rastro de la pelota.
      if (ball.segment) {
        const strong =
          ball.segment.kind === 'spike' || ball.segment.kind === 'serve'
        for (let index = 1; index <= 6; index += 1) {
          const past = sampleBall(timeline, t - index * 28)
          const size = Math.max(1, 4 - Math.floor(index / 2))
          ctx.fillStyle = `rgba(255, 255, 255, ${
            (strong ? 0.3 : 0.18) / index
          })`
          ctx.fillRect(
            Math.round(past.groundX) - Math.floor(size / 2),
            Math.round(past.groundY - past.z - 6),
            size,
            size,
          )
        }
      }

      const spinSpeed =
        ball.segment?.kind === 'spike'
          ? 12
          : ball.segment?.kind === 'serve'
            ? 8
            : 5
      const spinPhase = Math.floor(
        (ball.segment ? ball.progress : 0) * spinSpeed,
      )

      const ballArt = loadImage(BALL_SHEET)
      if (!ballArt) waitingForArt = true
      drawBall(
        ctx,
        ball.groundX + (held ? 11 : 0),
        ball.groundY,
        ball.z,
        t,
        spinPhase,
        ballArt,
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

      if (beat?.point) {
        drawConfetti(ctx, t - beat.start, beat.point)
      }

      if (beat?.point && t - beat.start < 100) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.fillRect(0, 0, COURT.width, COURT.height)
      }

      ctx.restore()
      drawVignette(ctx)

      if (active && active !== lastCaption) {
        lastCaption = active
        callbacks.current.onCaption(active)
      }
      if (beat?.point && !pointFired) {
        pointFired = true
        callbacks.current.onPoint?.(beat.point)
      }

      if (!animated) {
        if (waitingForArt && artWaitFrames < 120) {
          artWaitFrames += 1
          raf = requestAnimationFrame(frame)
        }
        return
      }

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
