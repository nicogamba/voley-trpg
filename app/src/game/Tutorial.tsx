import type { GameState, Phase } from '../engine'

type TitleProps = {
  muted: boolean
  onPlay: () => void
  onTutorial: () => void
  onToggleMuted: () => void
  onHelp: () => void
}

const CourtMark = () => (
  <div className="relative mx-auto mt-6 w-full max-w-[280px]">
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={`h-9 rounded-xl border ${
            index < 3
              ? 'border-rose-300/20 bg-rose-500/10'
              : 'border-indigo-300/25 bg-indigo-500/12'
          }`}
        />
      ))}
    </div>
    <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/60" />
      <span className="mx-2 h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-lg shadow-yellow-300/60" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/60" />
    </div>
    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-1.5">
      <div className="col-start-2 row-start-1 flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950 ring-2 ring-emerald-200">
          A
        </span>
      </div>
      <div className="col-start-1 row-start-2 flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950 ring-2 ring-amber-200">
          C
        </span>
      </div>
      <div className="col-start-3 row-start-2 flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-400 text-xs font-black text-rose-950 ring-2 ring-rose-200">
          O
        </span>
      </div>
      <div className="col-start-2 row-start-2 flex items-center justify-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-cyan-950 ring-2 ring-cyan-200">
          L
        </span>
      </div>
    </div>
  </div>
)

export const TitleScreen = ({
  muted,
  onPlay,
  onTutorial,
  onToggleMuted,
  onHelp,
}: TitleProps) => (
  <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-8">
    <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-indigo-950/60">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300/80">
            Vóley táctico
          </p>
          <h1 className="mt-1 text-5xl font-black leading-none tracking-tight text-white">
            ZONA<span className="text-cyan-300"> 3</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={onToggleMuted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-base text-white/70 transition hover:border-white/40 hover:text-white"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <p className="mt-3 text-sm leading-snug text-white/60">
        Un set a 7. Armá la jugada, leé el bloqueo y defendé tu zona. Cinco
        minutos, decisiones perfectas: no hay dados.
      </p>

      <CourtMark />

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          onClick={onTutorial}
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-cyan-950 shadow-lg shadow-cyan-300/20 transition hover:bg-cyan-200 active:scale-[0.98]"
        >
          Tutorial · 2 rallies
        </button>
        <button
          type="button"
          onClick={onPlay}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:border-white/35 hover:text-white active:scale-[0.98]"
        >
          Partido rápido
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="rounded-2xl px-4 py-1.5 text-xs font-semibold text-white/45 transition hover:text-white/80"
        >
          Cómo se juega
        </button>
      </div>
    </div>
    <p className="mt-4 text-center text-[10px] uppercase tracking-[0.3em] text-white/25">
      Mobile · un set · 4v4
    </p>
  </div>
)

type HelpProps = {
  onClose: () => void
}

const HELP_CARDS = [
  {
    title: 'Tu turno empieza con el saque',
    body: 'Tocá una zona del campo rival. El número del preview es la calidad de pase que consigue: más alta, mejor para vos.',
  },
  {
    title: 'La calidad es tu moneda',
    body: 'Un pase perfecto devuelve 1 AP. El armador (A) reparte: Alto habilita potencia y colocación; Rápido solo al central.',
  },
  {
    title: 'Leé antes de rematar',
    body: 'El preview muestra A (ataque), B (bloqueo) y D (defensa). Si A no supera a B, te bloquean. Finta y wipe ignoran el bloqueo.',
  },
  {
    title: 'Defender también es jugar',
    body: 'En la lectura defensiva movés bloqueadores dentro de su fila. Condicionás el ataque rival; después el líbero (L) hace el resto.',
  },
]

export const HelpSheet = ({ onClose }: HelpProps) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center">
    <div className="animate-slide-up w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300/80">
            Cómo se juega
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Cuatro ideas</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-white/40 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="mt-4 grid gap-2.5">
        {HELP_CARDS.map((card, index) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
          >
            <p className="text-sm font-bold text-white/90">
              <span className="mr-1.5 text-cyan-300">{index + 1}.</span>
              {card.title}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-white/55">
              {card.body}
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-cyan-950 transition hover:bg-cyan-200"
      >
        Entendido
      </button>
    </div>
  </div>
)

const HINTS: Partial<Record<Phase, { title: string; body: string }>> = {
  SERVE: {
    title: 'Saque',
    body: 'Tocá una zona del campo rival. El preview muestra el pase que consigue: buscá una zona débil, no la más cómoda.',
  },
  RECEIVE: {
    title: 'Recepción',
    body: 'Elegí quién recibe. El líbero (L) es el mejor. Si no llega, movelo antes con 1 AP: la celda exacta da +1.',
  },
  SET: {
    title: 'Armado',
    body: 'El armador (A) reparte. Alto habilita potencia y colocación; Rápido solo al central y cuesta 1 AP.',
  },
  BLOCK_COMMIT: {
    title: 'Lectura defensiva',
    body: 'Movés bloqueadores dentro de su fila con 2 AP de reacción. No siempre bloquean: condicionan hacia dónde ataca el rival.',
  },
  ATTACK: {
    title: 'Remate',
    body: 'Elegí tipo y tocá la zona. El preview dice punto, dig o bloqueo antes de confirmar. Finta y wipe ignoran el bloqueo; el líbero los lee.',
  },
}

type CoachProps = {
  game: GameState
  onSkip: () => void
}

export const Coach = ({ game, onSkip }: CoachProps) => {
  const hint = HINTS[game.phase]
  if (!hint) return null
  const rally = Math.min(game.rallyNumber, 2)
  return (
    <div className="game-coach animate-slide-up rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 shadow-lg shadow-cyan-950/30">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">
          Tutorial · rally {rally} de 2
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="text-[10px] font-semibold text-white/40 underline-offset-2 transition hover:text-white/70 hover:underline"
        >
          Saltar
        </button>
      </div>
      <p className="mt-0.5 text-xs font-bold text-white/85">{hint.title}</p>
      <p className="text-[11px] leading-snug text-white/55">{hint.body}</p>
    </div>
  )
}

type CompleteProps = {
  game: GameState
  onFinish: () => void
}

export const TutorialComplete = ({ game, onFinish }: CompleteProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
    <div className="animate-pop w-full max-w-sm rounded-[2rem] border border-cyan-300/30 bg-slate-950 p-5 text-center shadow-2xl shadow-cyan-950/50">
      <p className="text-4xl">🏐</p>
      <h2 className="mt-2 text-2xl font-black text-white">
        Tutorial completado
      </h2>
      <p className="mt-2 text-sm leading-snug text-white/55">
        Ya sabés sacar, recibir, armar y rematar. Ahora jugá un set completo a 7
        contra la IA.
      </p>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200/70">
        Marcador {game.score.home} — {game.score.away}
      </p>
      <button
        type="button"
        onClick={onFinish}
        className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-cyan-950 transition hover:bg-cyan-200"
      >
        Jugar el partido
      </button>
    </div>
  </div>
)
