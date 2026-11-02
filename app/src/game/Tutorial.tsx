import type { GameState, Phase } from '../engine'
import PixelPortrait from './PixelPortrait'

type TitleProps = {
  muted: boolean
  onPlay: () => void
  onTutorial: () => void
  onToggleMuted: () => void
  onHelp: () => void
  onCourt: () => void
  onCt1: () => void
}

const CourtMark = () => (
  <div className="title-court" aria-hidden="true">
    <div className="title-court-side title-court-away">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
    <div className="title-court-net" />
    <div className="title-court-side title-court-home">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  </div>
)

export const TitleScreen = ({
  muted,
  onPlay,
  onTutorial,
  onToggleMuted,
  onHelp,
  onCourt,
  onCt1,
}: TitleProps) => (
  <div className="title-shell">
    <div className="title-card scanlines">
      <div className="title-top">
        <div>
          <p className="title-kicker">VÓLEY TÁCTICO POR TURNOS</p>
          <h1 className="title-logo">
            ZONA<span>3</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={onToggleMuted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="pixel-btn icon-btn"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="title-hero">
        <PixelPortrait classId="setter" side="home" size={76} />
        <div className="title-hero-text">
          <p className="title-claim">
            El rival ya eligió.
            <br />
            <span>Leé la jugada y ganá el duelo.</span>
          </p>
          <p className="title-sub">
            Un set decisivo a 25 · 6v6 · 5-8 minutos. Sin dados: stats y lectura.
          </p>
        </div>
        <PixelPortrait classId="libero" side="away" size={76} />
      </div>

      <CourtMark />

      <div className="title-actions">
        <button type="button" onClick={onCt1} className="pixel-btn primary big">
          <span className="blink-arrow">▶</span> CAMPAÑA CT1 · 5 ETAPAS
        </button>
        <button type="button" onClick={onCourt} className="pixel-btn secondary">
          MODO V2 · CANCHA
        </button>
        <button type="button" onClick={onPlay} className="pixel-btn ghost">
          PARTIDO RÁPIDO · V1
        </button>
        <button type="button" onClick={onTutorial} className="pixel-btn ghost">
          TUTORIAL · V1
        </button>
        <button type="button" onClick={onHelp} className="pixel-btn ghost">
          CÓMO SE JUEGA · CT1
        </button>
      </div>
    </div>
    <p className="title-footer">MOBILE · 6V6 · COPA ZONA 3</p>
  </div>
)

type HelpProps = {
  onClose: () => void
  /** Manual de la campaña CT1 o del modo v2. */
  mode?: 'v2' | 'ct1'
}

const HELP_CARDS_V2 = [
  {
    title: 'Tres pasos, una jugada',
    body: 'Cada posesión es recepción → armado → ataque. Elegís una acción por paso. El tablero te dice dónde tocar.',
  },
  {
    title: 'El rival ya se comprometió',
    body: 'Cuando atacás, la defensa rival ya eligió su esquema, pero está oculta. Cuando defendés, su ataque ya está elegido.',
  },
  {
    title: 'Las pistas nunca mienten',
    body: 'Antes de elegir ves pistas veraces sobre la apuesta rival. Con Lectura 4 o más ves dos pistas; con menos, una.',
  },
  {
    title: 'El cut-in revela el duelo',
    body: 'Recién al final ves qué eligió el rival y cómo se resolvió. No hay dados: cuentan stats, esquema y zona.',
  },
  {
    title: 'Energía',
    body: 'Empezás con 2 de energía. Un pase perfecto te lleva a 3. Potencia y Wipe cuestan 2; Pipe cuesta 3; Colocación, Rápido y Finta son gratis.',
  },
  {
    title: 'Cada ataque tiene su zona',
    body: 'El Rápido solo entra por el centro. La Finta solo cae al fondo, y busca las esquinas. El Pipe exige al opuesto desde el fondo. Colocación y Finta pegan mejor en las esquinas.',
  },
  {
    title: 'Cuatro formas de defender',
    body: 'Muro frena potencia y rápidos. Bloqueo abierto frena finas y colocaciones. Defensa profunda aguanta el fondo. Líbero atento lee las manos y cubre el centro.',
  },
]

const HELP_CARDS_CT1 = [
  {
    title: 'Campaña CT1',
    body: 'Cinco etapas hasta la final. Cada una es un set a 25 con ventaja de 2 y arranca cerca del cierre (18-18, 17-18, 17-19, 16-19, 16-20). Si perdés, reintentás la misma etapa.',
  },
  {
    title: 'El partido es por turnos',
    body: 'Elegís un comando y después ves la jugada. El texto se escribe solo: si ya terminó, un toque avanza; si todavía está escribiendo, el primero completa y el segundo avanza.',
  },
  {
    title: 'Saque por zonas',
    body: 'Elegís zona 1, 5, 6 o corto. El destino es una intención: el saque puede irse a la red o afuera. El líbero y los compañeros cubren, así que no hay ace garantizado.',
  },
  {
    title: 'Recepción y armado',
    body: 'La recepción es automática: perfecta, buena o exigida. El armador elige al atacante y el lado (por 2 o por 4). El menú de ataque muestra solo los golpes de ese atacante.',
  },
  {
    title: 'Ataque',
    body: 'Potencia, colocación, rápido, pipe, wipe y finta. Cada uno tiene su costo de tensión y su riesgo de red o afuera. El rápido es del central; el pipe del opuesto desde el fondo.',
  },
  {
    title: 'Defensa y bloqueo',
    body: 'Elegís MURO, ABIERTO, PROFUNDO o LÍBERO. Si el ataque toca el bloqueo, puede morir en el piso (stuff), irse afuera o quedar vivo para que la defensa lo levante.',
  },
  {
    title: 'Tensión',
    body: 'Arranca en 30/100. Sube con buenas recepciones y puntos; baja al perder el punto. Paga potencia, wipe, pipe y las técnicas defensivas. No es energía por rally.',
  },
  {
    title: 'Cada punto se festeja',
    body: 'Después del resultado aparece el festejo del equipo que ganó. Al ganar la final, la gira termina con Argentina campeón.',
  },
]

export const HelpSheet = ({ onClose, mode = 'v2' }: HelpProps) => {
  const cards = mode === 'ct1' ? HELP_CARDS_CT1 : HELP_CARDS_V2
  return (
    <div className="sheet-overlay">
      <div className="sheet-card scanlines">
        <div className="sheet-head">
          <div>
            <p className="sheet-kicker">
              {mode === 'ct1' ? 'MANUAL CT1' : 'MANUAL DE BOLSILLO'}
            </p>
            <h2 className="sheet-title">
              {mode === 'ct1' ? 'CÓMO SE JUEGA · CT1' : 'CÓMO SE JUEGA'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="pixel-btn icon-btn"
          >
            ×
          </button>
        </div>
        <div className="sheet-list">
          {cards.map((card, index) => (
            <div key={card.title} className="sheet-item">
              <p className="sheet-item-title">
                <span>{index + 1}.</span> {card.title}
              </p>
              <p className="sheet-item-body">{card.body}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="pixel-btn primary">
          ENTENDIDO
        </button>
      </div>
    </div>
  )
}

const HINTS: Partial<Record<Phase, { title: string; body: string }>> = {
  SERVE: {
    title: 'Saque',
    body: 'Tocá una zona del campo rival. Buscá dónde el rival reciba peor.',
  },
  RECEIVE: {
    title: 'Recepción',
    body: 'Elegí quién recibe. El líbero es el más seguro y deja al armador cerca.',
  },
  SET: {
    title: 'Armado',
    body: 'Elegí atacante. El armador reparte según la calidad del pase.',
  },
  ATTACK: {
    title: 'Tu jugada',
    body: 'El rival ya eligió su defensa. Mirá las pistas y elegí tipo de ataque.',
  },
  DEFEND: {
    title: 'Tu defensa',
    body: 'El rival ya eligió su ataque. Mirá las pistas y elegí un esquema.',
  },
}

type CoachProps = {
  game: GameState
  playerTurn: boolean
  onSkip: () => void
}

const RIVAL_HINTS: Partial<Record<Phase, { title: string; body: string }>> = {
  SERVE: {
    title: 'Saque rival',
    body: 'El rival saca. Leé el cartel y tocá CONTINUAR cuando estés listo.',
  },
  RECEIVE: {
    title: 'Recepción rival',
    body: 'El rival recibe tu saque. Tocá CONTINUAR para ver qué arma.',
  },
  SET: {
    title: 'Armado rival',
    body: 'El rival elige atacante. Tocá CONTINUAR cuando lo hayas leído.',
  },
}

export const Coach = ({ game, playerTurn, onSkip }: CoachProps) => {
  const hint = playerTurn
    ? HINTS[game.phase]
    : (RIVAL_HINTS[game.phase] ?? HINTS[game.phase])
  if (!hint) return null
  const rally = Math.min(game.rallyNumber, 2)
  return (
    <div className="coach-box">
      <div className="coach-head">
        <span>TUTORIAL · RALLY {rally} DE 2</span>
        <button type="button" onClick={onSkip} className="coach-skip">
          SALTAR
        </button>
      </div>
      <p className="coach-title">{hint.title}</p>
      <p className="coach-body">{hint.body}</p>
    </div>
  )
}

type CompleteProps = {
  game: GameState
  onFinish: () => void
}

export const TutorialComplete = ({ game, onFinish }: CompleteProps) => (
  <div className="sheet-overlay">
    <div className="sheet-card scanlines complete-card">
      <p className="complete-icon">🏐</p>
      <p className="sheet-kicker">ENTRENAMIENTO LISTO</p>
      <h2 className="sheet-title">YA SABÉS LEER EL DUELO</h2>
      <p className="complete-copy">
        Viste cómo el rival se compromete antes que vos y cómo las pistas te
        ayudan a elegir. Ahora jugá un set completo a 7.
      </p>
      <p className="complete-score">
        {game.score[game.playerSide]} — {game.score[game.playerSide === 'home' ? 'away' : 'home']}
      </p>
      <button type="button" onClick={onFinish} className="pixel-btn primary">
        JUGAR EL PARTIDO
      </button>
    </div>
  </div>
)
