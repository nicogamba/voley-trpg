import { useEffect, useState } from 'react'

type Props = {
  text: string
  speed?: number
  /** Muestra el texto completo de una vez (primer toque). */
  skip?: boolean
  /** Avisa cuando el texto terminó de escribirse solo. */
  onDone?: () => void
}

/** Relato con efecto de máquina de escribir; el contenedor lo remonta por key. */
export const Typewriter = ({
  text,
  speed = 12,
  skip = false,
  onDone,
}: Props) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (skip) return
    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          window.clearInterval(timer)
          return current
        }
        return current + 1
      })
    }, speed)
    return () => window.clearInterval(timer)
  }, [text, speed, skip])

  useEffect(() => {
    if (skip || count >= text.length) onDone?.()
  }, [count, skip, text.length, onDone])

  if (skip) return <>{text}</>
  return <>{text.slice(0, count)}</>
}

export default Typewriter
