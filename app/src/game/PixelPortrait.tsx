import type { CSSProperties } from 'react'
import { portraitFor } from '../court/sprites'
import type { ClassId, Side } from '../engine'

type PixelPortraitProps = {
  classId: ClassId
  side: Side
  size?: number
  className?: string
}

const PixelPortrait = ({
  classId,
  side,
  size = 72,
  className = '',
}: PixelPortraitProps) => {
  const src = portraitFor(side, classId)
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
