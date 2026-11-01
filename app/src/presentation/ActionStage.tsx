import type { CourtCell, CourtPlayer, CourtTeam, Side } from '../court/types'
import ActionFrame from './ActionFrame'
import FieldView from './FieldView'
import type { ActionFrameSpec } from './types'

type Props = {
  frame: ActionFrameSpec
  players: CourtPlayer[]
  teams: Record<Side, CourtTeam>
  ball: CourtCell
  fieldLabel?: string
  muted?: boolean
}

export const ActionStage = ({
  frame,
  players,
  teams,
  ball,
  fieldLabel,
  muted,
}: Props) =>
  frame.mode === 'field' ? (
    <FieldView
      players={players}
      teams={teams}
      ball={ball}
      label={fieldLabel}
      muted={muted}
    />
  ) : (
    <ActionFrame
      frame={frame}
      players={players}
      teams={teams}
      muted={muted}
    />
  )

export default ActionStage
