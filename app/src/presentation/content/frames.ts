import type { ClassId } from '../../engine'
import type { CourtTeam } from '../../court/types'
import type { ScenePose } from '../types'

/** Las hojas generadas tienen 5 columnas × 4 filas de 48×58. */
export const SHEET_COLS = 5
export const SHEET_ROWS = 4

/**
 * Frame de la hoja para cada pose. Coincide con `artFrameFor` de
 * `CourtCanvas`: idle 0-1, correr 2-6, recepción 7-8, armado 9-10,
 * remate 11-13, bloqueo 14, zambullida 15-16 y festejo 17-18.
 */
export const FRAME_BY_POSE: Record<ScenePose, number> = {
  serve: 11,
  receive: 7,
  set: 9,
  spike: 13,
  block: 14,
  dig: 15,
  celebrate: 17,
}

export const framePosition = (pose: ScenePose): string => {
  const frame = FRAME_BY_POSE[pose] ?? 0
  const col = frame % SHEET_COLS
  const row = Math.floor(frame / SHEET_COLS)
  return `${(col / (SHEET_COLS - 1)) * 100}% ${
    (row / (SHEET_ROWS - 1)) * 100
  }%`
}

export const CLASS_ROLE: Record<ClassId, string> = {
  setter: 'ARMADOR',
  middle: 'CENTRAL',
  opposite: 'OPUESTO',
  libero: 'LÍBERO',
  wing: 'PUNTA',
}

export const CLASS_LETTER: Record<ClassId, string> = {
  setter: 'A',
  middle: 'C',
  opposite: 'O',
  libero: 'L',
  wing: 'P',
}

export const teamColor = (team: CourtTeam): string => team.kit.shirt
