import { cellKey, sameCell, zoneOf } from '../engine'
import { CLASS_LETTERS } from '../engine'
import type { Cell, ClassId, GameState, Player, Side } from '../engine'

const CLASS_ACCENT: Record<ClassId, string> = {
  setter: '#65d68a',
  middle: '#ffd166',
  opposite: '#ff8fa3',
  libero: '#67d8ef',
}

type BoardProps = {
  game: GameState
  targets: Set<string>
  activeId: string | null
  flashCell: string | null
  onCell: (cell: Cell) => void
}

const playerAt = (game: GameState, cell: Cell): Player | undefined =>
  game.players.find((player) => sameCell(player.cell, cell))

const PlayerToken = ({
  player,
  active,
  hasBall,
}: {
  player: Player
  active: boolean
  hasBall: boolean
}) => (
  <div className="flex flex-col items-center gap-0.5">
    <div
      className={`player-token relative flex h-8 w-8 items-center justify-center text-sm font-black text-white ${
        active ? 'player-token-active' : ''
      }`}
      style={{
        background: player.side === 'home' ? '#3e63c7' : '#b3344b',
        borderColor: CLASS_ACCENT[player.classId],
      }}
      title={`${player.name} · T${player.stats.tecnica} P${player.stats.potencia} V${player.stats.velocidad} L${player.stats.lectura}`}
    >
      {CLASS_LETTERS[player.classId]}
      {hasBall && <span className="ball-badge" />}
    </div>
    <span className="player-name max-w-16 truncate text-[8px] font-bold uppercase tracking-wide text-white/60">
      {player.name}
    </span>
  </div>
)

const CellButton = ({
  game,
  cell,
  targets,
  activeId,
  flashCell,
  onCell,
}: BoardProps & { cell: Cell }) => {
  const occupant = playerAt(game, cell)
  const key = cellKey(cell)
  const isTarget = targets.has(key)
  const hasBall = sameCell(game.ball.cell, cell)
  const active = occupant?.id === activeId

  return (
    <button
      type="button"
      data-cell={`${cell.side}-${cell.row}-${cell.col}`}
      data-player={occupant?.id}
      onClick={() => onCell(cell)}
      disabled={!isTarget}
      aria-label={`Zona ${zoneOf(cell.row, cell.col)}${
        occupant ? `, ${occupant.name}` : ', libre'
      }${isTarget ? ', objetivo' : ''}`}
      className={`board-cell relative flex flex-col items-center justify-center ${
        cell.side === 'home' ? 'board-cell-home' : 'board-cell-away'
      } ${isTarget ? 'target-cell' : ''}`}
    >
      <span className="zone-tag">Z{zoneOf(cell.row, cell.col)}</span>
      {flashCell === key && (
        <span
          key={`flash-${game.rallyNumber}-${key}`}
          className="animate-cell-flash pointer-events-none absolute inset-0"
        />
      )}
      {occupant ? (
        <PlayerToken
          key={`${occupant.id}-${occupant.cell.row}-${occupant.cell.col}`}
          player={occupant}
          active={active}
          hasBall={hasBall}
        />
      ) : hasBall ? (
        <span className="ball-standalone" />
      ) : (
        <span className="cell-empty">·</span>
      )}
      {isTarget && <span className="target-mark">◎</span>}
    </button>
  )
}

const Board = (props: BoardProps) => {
  const renderSide = (side: Side) => {
    const rows = side === 'away' ? ([1, 0] as const) : ([0, 1] as const)
    return (
      <div className="grid gap-1">
        {rows.map((row) => (
          <div key={`${side}-${row}`} className="grid grid-cols-3 gap-1">
            {([0, 1, 2] as const).map((col) => {
              const cell = { side, row, col } as Cell
              return (
                <CellButton
                  key={cellKey(cell)}
                  {...props}
                  cell={cell}
                />
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="board-frame">
      <div className="board-label">
        <span>RIVAL</span>
        <span>RED</span>
      </div>
      {renderSide('away')}
      <div className="board-net">
        <span className="net-line" />
        <span className="net-tag">RED</span>
      </div>
      {renderSide('home')}
      <div className="board-label board-label-home">
        <span>VOS</span>
        <span>ZONA 3</span>
      </div>
    </div>
  )
}

export default Board
