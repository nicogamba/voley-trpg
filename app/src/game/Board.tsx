import { cellKey, sameCell, zoneOf } from '../engine'
import type { AttackKind, Cell, ClassId, GameState, Player } from '../engine'

export type CellPreview = {
  tone: 'point' | 'dig' | 'block' | 'info'
  label: string
  detail?: string
}

const CLASS_STYLE: Record<ClassId, string> = {
  setter: 'bg-emerald-400 text-emerald-950 ring-emerald-200',
  middle: 'bg-amber-400 text-amber-950 ring-amber-200',
  opposite: 'bg-rose-400 text-rose-950 ring-rose-200',
  libero: 'bg-cyan-400 text-cyan-950 ring-cyan-200',
}

const CLASS_LETTER: Record<ClassId, string> = {
  setter: 'A',
  middle: 'C',
  opposite: 'O',
  libero: 'L',
}

type BoardProps = {
  game: GameState
  selectedId: string | null
  hintIds: Set<string>
  hintCells: Set<string>
  previews: Map<string, CellPreview>
  attackKind: AttackKind | null
  flashCell: string | null
  onCell: (cell: Cell) => void
}

const playerAt = (game: GameState, cell: Cell): Player | undefined =>
  game.players.find((player) => sameCell(player.cell, cell))

const PlayerToken = ({
  player,
  selected,
  hasBall,
}: {
  player: Player
  selected: boolean
  hasBall: boolean
}) => (
  <div className="animate-pop flex flex-col items-center gap-0.5">
    <div
      className={`player-token relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ring-2 shadow-lg shadow-black/30 transition ${CLASS_STYLE[player.classId]} ${
        selected ? 'scale-110 ring-4 ring-white' : ''
      }`}
      title={`${player.name} · T${player.stats.tecnica} P${player.stats.potencia} V${player.stats.velocidad} L${player.stats.lectura}`}
    >
      {CLASS_LETTER[player.classId]}
      {hasBall && (
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-yellow-300 shadow" />
      )}
    </div>
    <span className="player-name max-w-16 truncate text-[9px] font-semibold uppercase tracking-wide text-white/70">
      {player.name}
    </span>
  </div>
)

const CellButton = ({
  game,
  cell,
  side,
  selectedId,
  hintIds,
  hintCells,
  previews,
  attackKind,
  flashCell,
  onCell,
}: BoardProps & { cell: Cell; side: 'home' | 'away' }) => {
  const occupant = playerAt(game, cell)
  const preview = previews.get(cellKey(cell))
  const hasBall = sameCell(game.ball.cell, cell)
  const isSelected = occupant?.id === selectedId
  const isHint = occupant ? hintIds.has(occupant.id) : false
  const isMoveHint = !occupant && hintCells.has(cellKey(cell))
  const clickable = Boolean(preview || isHint || occupant || isMoveHint)

  const toneClass: Record<CellPreview['tone'], string> = {
    point: 'border-emerald-300/80 bg-emerald-400/15 text-emerald-100',
    dig: 'border-amber-300/80 bg-amber-400/15 text-amber-100',
    block: 'border-rose-300/80 bg-rose-400/15 text-rose-100',
    info: 'border-indigo-300/60 bg-indigo-400/10 text-indigo-100',
  }

  return (
    <button
      type="button"
      data-cell={`${cell.side}-${cell.row}-${cell.col}`}
      data-player={occupant?.id}
      onClick={() => onCell(cell)}
      className={`relative flex h-[var(--cell-h)] flex-col items-center justify-center rounded-2xl border transition active:scale-[0.97] ${
        preview ? 'pb-7' : ''
      } ${
        side === 'away'
          ? 'border-rose-300/15 bg-rose-500/10'
          : 'border-indigo-300/20 bg-indigo-500/12'
      } ${clickable ? 'hover:border-white/40' : 'cursor-default'} ${
        preview ? toneClass[preview.tone] : ''
      } ${isHint && !occupant ? 'ring-2 ring-white/40' : ''} ${
        isMoveHint ? 'ring-2 ring-cyan-300/60' : ''
      }`}
    >
      <span className="absolute left-1.5 top-1 text-[9px] font-bold tabular-nums text-white/35">
        Z{zoneOf(cell.row, cell.col)}
      </span>
      {flashCell === cellKey(cell) && (
        <span
          key={`flash-${game.rallyNumber}-${cellKey(cell)}`}
          className="animate-cell-flash pointer-events-none absolute inset-0 rounded-2xl bg-white/30"
        />
      )}
      {occupant ? (
        <PlayerToken
          key={`${occupant.id}-${occupant.cell.row}-${occupant.cell.col}`}
          player={occupant}
          selected={isSelected}
          hasBall={hasBall}
        />
      ) : hasBall ? (
        <span
          key={cellKey(cell)}
          className="animate-pop h-6 w-6 rounded-full border-2 border-slate-950 bg-yellow-300 shadow-lg shadow-yellow-300/40"
        />
      ) : (
        <span className="text-[10px] font-medium text-white/20">
          {attackKind ? 'objetivo' : 'libre'}
        </span>
      )}
      {preview && (
        <span
          className={`absolute inset-x-1 bottom-1 rounded-lg border px-1 py-0.5 text-[9px] font-bold leading-tight ${toneClass[preview.tone]}`}
        >
          {preview.label}
          {preview.detail && (
            <span className="block font-medium opacity-80">{preview.detail}</span>
          )}
        </span>
      )}
    </button>
  )
}

const Board = (props: BoardProps) => {
  const { game } = props

  const renderSide = (side: 'home' | 'away') => {
    const rows = side === 'away' ? ([1, 0] as const) : ([0, 1] as const)
    return (
      <div className={`grid gap-1.5 ${side === 'away' ? 'mb-2' : 'mt-2'}`}>
        {rows.map((row) => (
          <div key={`${side}-${row}`} className="grid grid-cols-3 gap-1.5">
            {([0, 1, 2] as const).map((col) => {
              const cell = { side, row, col } as Cell
              return (
                <CellButton
                  key={cellKey(cell)}
                  {...props}
                  cell={cell}
                  side={side}
                />
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="board-frame rounded-3xl border border-white/10 bg-slate-950/60 p-2 shadow-2xl shadow-indigo-950/50">
      <div className="board-side-label mb-1 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200/70">
        <span>Rival</span>
        <span>{game.phase === 'MATCH_END' ? 'fin' : 'red'}</span>
      </div>
      {renderSide('away')}
      <div className="board-net relative flex h-5 items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <span className="relative rounded-full border border-white/30 bg-slate-950 px-2 text-[8px] font-black uppercase tracking-[0.3em] text-white/60">
          red
        </span>
      </div>
      {renderSide('home')}
      <div className="board-side-label mt-1 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200/70">
        <span>Vos</span>
        <span>{game.phase === 'MATCH_END' ? 'fin' : 'red'}</span>
      </div>
    </div>
  )
}

export default Board
