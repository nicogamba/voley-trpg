import { useEffect, useState } from 'react'
import { playCue } from '../court/audio'
import Typewriter from '../court/Typewriter'
import { RELATOR_NAME } from './content/commentary'
import { NANDO_PORTRAITS } from './nando'
import type { CommentaryLine } from './types'

type Props = {
  line: CommentaryLine
  onNext: () => void
  nextLabel?: string
  title?: string
  hint?: string
  progress?: string
  trail?: string[]
  log?: string[]
  muted?: boolean
}

export const CommentBox = ({
  line,
  onNext,
  nextLabel = 'CONTINUAR ▶',
  title,
  hint,
  progress,
  trail,
  log,
  muted,
}: Props) => {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!muted) playCue('blip')
  }, [line.text, muted])

  return (
    <div className="ct1-comment">
      <div className="ct1-comment-head">
        <span className={`ct1-relator is-${line.expression}`}>
          <img
            className="ct1-relator-img"
            src={NANDO_PORTRAITS[line.expression]}
            alt=""
            width={52}
            height={52}
          />
        </span>
        <div className="ct1-relator-info">
          <strong>{RELATOR_NAME}</strong>
          <span>
            <i className="ct1-live-dot" /> RELATOR
          </span>
        </div>
        {title && <span className="ct1-comment-title">{title}</span>}
        {progress && <span className="ct1-comment-progress">{progress}</span>}
      </div>

      {hint && <p className="ct1-hint">{hint}</p>}

      <p className="ct1-comment-text" data-text={line.text}>
        <span>
          <Typewriter
            key={line.text}
            text={line.text}
            speed={14}
            skip={revealed}
            onDone={() => setRevealed(true)}
          />
        </span>
      </p>

      {log && log.length > 0 && (
        <div className="ct1-log" aria-label="Relato anterior">
          {log.slice(-3).map((entry, index) => (
            <p key={`${entry}-${index}`}>{entry}</p>
          ))}
        </div>
      )}

      {trail && trail.length > 0 && (
        <div className="ct1-trail" aria-label="Secuencia del rally">
          {trail.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={index === trail.length - 1 ? 'is-current' : ''}
            >
              {item}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="ct1-next"
        onClick={() => {
          if (!revealed) {
            setRevealed(true)
            return
          }
          onNext()
        }}
      >
        {revealed ? nextLabel : 'COMPLETAR ▶'}
      </button>
    </div>
  )
}

export default CommentBox
