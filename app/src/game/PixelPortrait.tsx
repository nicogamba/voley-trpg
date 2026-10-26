import type { CSSProperties } from 'react'
import type { ClassId, Side } from '../engine'

const BASE: string[] = [
  '....HHHH....',
  '..HHHHHHHH..',
  '.HHHHHHHHHH.',
  '.HHSSSSSSHH.',
  '.HSSSSSSSSH.',
  '.HSESSSSESH.',
  '.HSSSSSSSSH.',
  '..SSSMMSSS..',
  '...SSSSSS...',
  '..UUUUUUUU..',
  '.UUUUUUUUUU.',
  '.UU.AAAA.UU.',
]

const MAPS: Record<ClassId, string[]> = {
  setter: [
    '....HHHH....',
    '..HHHHHHHH..',
    '.HHHHHHHHHH.',
    '.HAAAAAAAAH.',
    '.HSSSSSSSSH.',
    '.HSESSSSESH.',
    '.HSSSSSSSSH.',
    '..SSSMMSSS..',
    '...SSSSSS...',
    '..UUUUUUUU..',
    '.UUUUUUUUUU.',
    '.UU.AAAA.UU.',
  ],
  middle: [
    '...HHHHHH...',
    '..HHHHHHHH..',
    '.HHHHHHHHHH.',
    '.HHSSSSSSHH.',
    '.HSSSSSSSSH.',
    '.HSESSSSESH.',
    '.HSSSSSSSSH.',
    '..SSSMMSSS..',
    '...SSSSSS...',
    '..UUUUUUUU..',
    '.UUUUUUUUUU.',
    '.UU.AAAA.UU.',
  ],
  opposite: [
    '.H..H..H..H.',
    '..HHHHHHHH..',
    '.HHHHHHHHHH.',
    '.HHSSSSSSHH.',
    '.HSSSSSSSSH.',
    '.HSESSSSESH.',
    '.HSSSSSSSSH.',
    '..SSSMMSSS..',
    '...SSSSSS...',
    '..UUUUUUUU..',
    '.UUUUUUUUUU.',
    '.UU.AAAA.UU.',
  ],
  libero: [
    '....AAAA....',
    '..AAAAAAAA..',
    '.AAAAAAAAAA.',
    '.AASSSSSSAA.',
    '.HSSSSSSSSH.',
    '.HSESSSSESH.',
    '.HSSSSSSSSH.',
    '..SSSMMSSS..',
    '...SSSSSS...',
    '..UUUUUUUU..',
    '.UUUUUUUUUU.',
    '.UU.AAAA.UU.',
  ],
}

const colorFor = (pixel: string, side: Side): string => {
  switch (pixel) {
    case 'H':
      return '#241812'
    case 'S':
      return '#e9b58a'
    case 'E':
      return '#16121f'
    case 'M':
      return '#8a4a4a'
    case 'A':
      return '#ffd166'
    case 'W':
      return '#f7f0dc'
    case 'U':
      return side === 'home' ? '#5b8cff' : '#ff5d73'
    default:
      return 'transparent'
  }
}

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
  const map = MAPS[classId] ?? BASE
  const style = {
    width: size,
    height: size,
    gridTemplateColumns: 'repeat(12, 1fr)',
    gridTemplateRows: 'repeat(12, 1fr)',
  } satisfies CSSProperties

  return (
    <div
      className={`pixel-portrait ${className}`}
      style={style}
      aria-hidden="true"
    >
      {map.flatMap((row, y) =>
        [...row].map((pixel, x) => (
          <span
            key={`${x}-${y}`}
            style={{ background: colorFor(pixel, side) }}
          />
        )),
      )}
    </div>
  )
}

export default PixelPortrait
