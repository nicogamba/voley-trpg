import type { CSSProperties } from 'react'
import { portraitFor, teamPortraitFor } from '../court/sprites'
import type { ClassId, Side } from '../engine'

type PixelPortraitProps = {
  classId: ClassId
  side: Side
  /** Si se indica, usa el retrato propio del equipo. */
  teamId?: string
  /** Id del jugador para distinguir dos puntas del mismo equipo. */
  playerId?: string
  size?: number
  className?: string
}

const PixelPortrait = ({
  classId,
  side,
  teamId,
  playerId,
  size = 72,
  className = '',
}: PixelPortraitProps) => {
  const role = playerId
    ? playerId.split('-').slice(1).join('-')
    : classId
  const src =
    (teamId ? teamPortraitFor(teamId, role) : undefined) ??
    portraitFor(side, classId)
  const style = {
    width: size,
    height: size,
  } satisfies CSSProperties

  return (
    <div
      className={`pixel-portrait pixel-portrait-art ${className}`}
      style={style}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
        />
      ) : null}
    </div>
  )
}

export default PixelPortrait
