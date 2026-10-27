import { ATTACK_LABEL } from '../engine'
import type { AttackKind, DefenseScheme } from '../engine'
import type { AttackPlan, MatchState } from './match'

export type Tell = {
  text: string
  truthful: boolean
}

const SCHEME_TELL: Record<DefenseScheme, string> = {
  wall: 'Bloqueo a la red.',
  spread: 'Cubren el ancho.',
  deep: 'Esperan atrás.',
  libero: 'El líbero lee.',
}

const KIND_TELL: Record<AttackKind, string> = {
  power: 'Viene con potencia.',
  placement: 'Buscan el hueco.',
  quick: 'Rápido por el centro.',
  pipe: 'Pipe desde el fondo.',
  wipe: 'Usan tus manos.',
  tip: 'Finta al fondo.',
}

const randomOther = <T,>(items: T[], current: T, rng: () => number): T => {
  const rest = items.filter((item) => item !== current)
  if (rest.length === 0) return current
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))]
}

/** Pista del bloqueo rival: a veces acierta y a veces es una celada. */
export const attackTell = (
  scheme: DefenseScheme,
  rng: () => number,
): Tell => {
  const truthful = rng() < 0.68
  const picked = truthful
    ? scheme
    : randomOther(
        Object.keys(SCHEME_TELL) as DefenseScheme[],
        scheme,
        rng,
      )
  return { text: SCHEME_TELL[picked], truthful }
}

/** Pista del ataque rival: el tipo de golpe que insinúa. */
export const defenseTell = (
  plan: AttackPlan | null,
  rng: () => number,
): Tell => {
  if (!plan) {
    return { text: 'El rival todavía no se movió.', truthful: false }
  }
  const truthful = rng() < 0.68
  const picked = truthful
    ? plan.kind
    : randomOther(
        Object.keys(KIND_TELL) as AttackKind[],
        plan.kind,
        rng,
      )
  return { text: KIND_TELL[picked], truthful }
}

/** Pista de recepción: señala a un rival, sin garantizar que sea el blanco. */
export const serveTell = (
  state: MatchState,
  rng: () => number,
): Tell => {
  const rivals = state.players.filter(
    (player) => player.side !== state.playerSide,
  )
  if (rivals.length === 0) {
    return { text: 'El rival espera.', truthful: false }
  }
  const libero =
    rivals.find((player) => player.classId === 'libero') ?? rivals[0]
  const truthful = rng() < 0.68
  const target = truthful
    ? libero
    : rivals[Math.min(rivals.length - 1, Math.floor(rng() * rivals.length))]
  return {
    text: `${target.name} cuida su zona.`,
    truthful,
  }
}

export const schemeLine = (scheme: DefenseScheme): string =>
  ({
    wall: 'MURO',
    spread: 'ABIERTO',
    deep: 'PROFUNDO',
    libero: 'LÍBERO',
  })[scheme]

export const attackLine = (kind: AttackKind): string => ATTACK_LABEL[kind]
