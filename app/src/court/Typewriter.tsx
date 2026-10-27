import { useEffect, useState } from 'react'

type Props = {
  text: string
  speed?: number
}

/** Relato con efecto de máquina de escribir; el contenedor lo remonta por key. */
export const Typewriter = ({ text, speed = 12 }: Props) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
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
  }, [text, speed])

  return <>{text.slice(0, count)}</>
}

export default Typewriter
