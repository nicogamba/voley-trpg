import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { playCue, primeAudio } from '../court/audio'
import { sheetFor } from '../court/sprites'
import type { CourtPlayer, CourtTeam, Side } from '../court/types'
import {
  CLASS_LETTER,
  framePosition,
  teamColor,
} from './content/frames'
import { SHOT_IMAGES } from './shots'
import type { ActionFrameSpec, ScenePose } from './types'

type Props = {
  frame: ActionFrameSpec
  players: CourtPlayer[]
  teams: Record<Side, CourtTeam>
  muted?: boolean
}

const CUE_BY_POSE: Record<
  ScenePose,
  'toss' | 'receive' | 'set' | 'spike' | 'block' | 'dig' | 'point'
> = {
  serve: 'toss',
  receive: 'receive',
  set: 'set',
  spike: 'spike',
  block: 'block',
  dig: 'dig',
  celebrate: 'point',
}

const Sprite = ({
  player,
  teams,
  pose,
  mirrored = false,
}: {
  player: CourtPlayer
  teams: Record<Side, CourtTeam>
  pose: ScenePose
  mirrored?: boolean
}) => {
  const sheet = sheetFor(teams[player.side].id, player.classId)
  if (!sheet) {
    return (
      <span className="ct1-sprite is-fallback" aria-hidden="true">
        {CLASS_LETTER[player.classId]}
      </span>
    )
  }
  return (
    <span
      className={`ct1-sprite${mirrored ? ' is-mirrored' : ''}`}
      style={{
        backgroundImage: `url(${sheet})`,
        backgroundPosition: framePosition(pose),
      }}
      aria-hidden="true"
    />
  )
}

export const ActionFrame = ({ frame, players, teams, muted }: Props) => {
  const actor = players.find((player) => player.id === frame.actorId)
  const rival = players.find((player) => player.id === frame.rivalId)
  const tone: Side =
    frame.tone === 'neutral' || !frame.tone
      ? (actor?.side ?? 'home')
      : frame.tone
  const team = teams[tone]
  const pose = frame.pose ?? 'celebrate'

  useEffect(() => {
    if (muted || !frame.pose) return
    primeAudio()
    playCue(CUE_BY_POSE[frame.pose])
  }, [frame.pose, frame.actorId, frame.stamp, muted])

  const style = {
    '--ct1-team': teamColor(team),
    '--ct1-team-soft': team.kit.shorts,
  } as CSSProperties
  const shotImage = frame.shot ? SHOT_IMAGES[frame.shot] : undefined

  if (shotImage) {
    return (
      <div
        className="ct1-frame is-shot"
        data-mode={frame.mode}
        data-effect={frame.effect ?? 'none'}
        style={style}
      >
        <img className="ct1-frame-image" src={shotImage} alt="" />
        <span className="ct1-frame-vignette" aria-hidden="true" />
        {frame.banner && (
          <span className="ct1-frame-banner">{frame.banner}</span>
        )}
        {frame.stamp && (
          <span className="ct1-frame-stamp" key={frame.stamp}>
            {frame.stamp}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className="ct1-frame"
      data-mode={frame.mode}
      data-effect={frame.effect ?? 'none'}
      data-pose={pose}
      style={style}
    >
      <span className="ct1-frame-speed" aria-hidden="true" />
      <span className="ct1-frame-vignette" aria-hidden="true" />

      {frame.banner && <span className="ct1-frame-banner">{frame.banner}</span>}

      <div className="ct1-frame-actors">
        {frame.mode === 'duel' ? (
          <>
            {actor && (
              <span className="ct1-frame-side is-actor">
                <Sprite player={actor} teams={teams} pose={pose} />
                <b>{actor.name}</b>
              </span>
            )}
            <span className="ct1-vs">VS</span>
            {rival && (
              <span className="ct1-frame-side is-rival">
                <Sprite
                  player={rival}
                  teams={teams}
                  pose={pose === 'spike' ? 'block' : 'dig'}
                  mirrored
                />
                <b>{rival.name}</b>
              </span>
            )}
          </>
        ) : actor ? (
          <span className="ct1-frame-side is-actor">
            <Sprite player={actor} teams={teams} pose={pose} />
            <b>{actor.name}</b>
          </span>
        ) : (
          <span className="ct1-frame-empty">ZONA 3</span>
        )}
      </div>

      <span className="ct1-ball" data-ball={pose} aria-hidden="true" />

      {frame.stamp && (
        <span className="ct1-frame-stamp" key={frame.stamp}>
          {frame.stamp}
        </span>
      )}
    </div>
  )
}

export default ActionFrame
