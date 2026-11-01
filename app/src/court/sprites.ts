import type { ClassId } from '../engine'
import type { Side } from './types'

/** Hojas de sprites recortadas por `tools/prepare-sprites.py`. */
const playerFiles = import.meta.glob('../assets/sprites/players/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const portraitFiles = import.meta.glob('../assets/sprites/portraits/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const teamPortraitFiles = import.meta.glob(
  '../assets/sprites/portraits/teams/*.png',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>

const ballFiles = import.meta.glob('../assets/sprites/ball.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const keyOf = (path: string): string =>
  path.split('/').pop()?.replace('.png', '') ?? ''

const byKey = (files: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [keyOf(path), url]),
  )

export const PLAYER_SHEETS = byKey(playerFiles)
export const PORTRAITS = byKey(portraitFiles)
export const TEAM_PORTRAITS = byKey(teamPortraitFiles)
export const BALL_SHEET = Object.values(ballFiles)[0]

export const sheetFor = (
  team: string,
  classId: ClassId,
): string | undefined =>
  PLAYER_SHEETS[`${team}-${classId}`] ??
  // Los puntas todavía no tienen hoja propia: usan el cuerpo del opuesto.
  (classId === 'wing' ? PLAYER_SHEETS[`${team}-opposite`] : undefined)

export const portraitFor = (
  side: Side,
  classId: ClassId,
): string | undefined => PORTRAITS[`${side}-${classId}`]

/** Retrato propio del equipo y rol; cae al genérico si falta. */
export const teamPortraitFor = (
  teamId: string,
  role: string,
): string | undefined => TEAM_PORTRAITS[`${teamId}-${role}`]

const cache = new Map<string, HTMLImageElement | null>()

/**
 * Carga una imagen una sola vez. Devuelve null mientras baja o si el
 * entorno no tiene DOM (SSR), así el canvas cae al sprite geométrico.
 */
export const loadImage = (src: string | undefined): HTMLImageElement | null => {
  if (!src || typeof Image === 'undefined') return null
  const cached = cache.get(src)
  if (cached !== undefined) {
    return cached && cached.complete && cached.naturalWidth > 0 ? cached : null
  }
  const image = new Image()
  image.src = src
  cache.set(src, image)
  image.onerror = () => cache.set(src, null)
  return null
}
