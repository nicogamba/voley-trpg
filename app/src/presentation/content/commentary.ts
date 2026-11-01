import { ATTACK_LABEL } from '../../engine'
import type { AttackKind, Quality } from '../../engine'
import type { CommentaryLine, Expression } from '../types'
import type { CourtTeam, Side } from '../../court/types'

export const RELATOR_NAME = 'NANDO'

const pick = (lines: string[], seed: number): string =>
  lines[Math.abs(Math.trunc(seed)) % lines.length]

const line = (
  text: string,
  expression: Expression = 'excited',
): CommentaryLine => ({
  speaker: 'comentador',
  expression,
  text,
})

export const qualityWord = (quality: Quality | null): string =>
  quality === null
    ? ''
    : ['error', 'mala', 'buena', 'perfecta'][quality] ?? ''

const scoreText = (score: Record<Side, number>): string =>
  `${score.home}-${score.away}`

export const kickoffLine = (
  score: Record<Side, number>,
): CommentaryLine =>
  line(
    `El rival saca. Set decisivo ${scoreText(score)}. ¡El estadio está de pie!`,
  )

export const matchIntroLine = (
  homeShort: string,
  awayShort: string,
  score: Record<Side, number>,
  round: string,
  city: string,
): CommentaryLine =>
  line(
    `¡Comienza ${round} en ${city}! Saca ${homeShort} contra ${awayShort}. Marcador ${scoreText(score)}. ¡El estadio está de pie!`,
    'excited',
  )

export const serveLine = (
  name: string,
  outcome: 'ok' | 'ace' | 'net' | 'out',
  seed: number,
  zoneLabel?: string,
): CommentaryLine => {
  const zoneText = zoneLabel
    ? zoneLabel === 'CORTO'
      ? ' corto'
      : ` a la ${zoneLabel.toLowerCase()}`
    : ''
  if (outcome === 'ace') {
    return line(
      pick(
        [
          `¡ACE de ${name}${zoneText}! ¡Nadie la tocó!`,
          `¡Directo al piso! ¡Ace de ${name}${zoneText}!`,
          `¡Qué saque${zoneText}! Imposible de recibir.`,
        ],
        seed,
      ),
      'triumphant',
    )
  }
  if (outcome === 'net') {
    return line(
      `El saque de ${name} se fue a la red. Punto rival.`,
      'worried',
    )
  }
  if (outcome === 'out') {
    return line(
      `El saque de ${name} se fue afuera. Punto rival.`,
      'worried',
    )
  }
  return line(
    pick(
      [
        `¡${name} saca${zoneText}!`,
        `¡Saque de ${name}${zoneText}! El estadio mira.`,
        `¡${name} se hace cargo${zoneText}!`,
      ],
      seed,
    ),
  )
}

export const freeBallLine = (
  teamShort: string,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡Pelota libre para ${teamShort}! Recepción cómoda y armado.`,
        `¡Free ball! ${teamShort} la recibe sin presión.`,
      ],
      seed,
    ),
    'excited',
  )

export const teammateLine = (
  name: string,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡Cayó entre dos compañeros! ${name} la deja jugable.`,
        `¡Se le cruzó a un compañero! La pelota sigue viva.`,
      ],
      seed,
    ),
    'worried',
  )

export const receiveLine = (
  name: string,
  quality: Quality,
  seed: number,
): CommentaryLine => {
  if (quality === 3) {
    return line(
      pick(
        [
          `¡Pase perfecto de ${name}! La dejó servida.`,
          `¡Qué recepción! ${name} la acomodó de lujo.`,
        ],
        seed,
      ),
      'triumphant',
    )
  }
  if (quality === 2) {
    return line(
      pick(
        [`¡${name} la recibe bien!`, `¡${name} controla la pelota!`],
        seed,
      ),
    )
  }
  if (quality === 1) {
    return line(
      pick(
        [
          `¡${name} la salvó como pudo!`,
          `La recepción de ${name} quedó incómoda.`,
        ],
        seed,
      ),
      'worried',
    )
  }
  return line(
    pick(
      [
        `No llegó ${name}. La pelota cayó.`,
        `¡Error de recepción de ${name}!`,
      ],
      seed,
    ),
    'shocked',
  )
}

export const setLine = (
  name: string,
  quality: Quality,
  outcome: 'ok' | 'error',
  seed: number,
): CommentaryLine => {
  if (outcome === 'error' || quality === 0) {
    return line(
      pick(
        [
          `¡Error de armado de ${name}! Punto rival.`,
          `El armado de ${name} se fue largo.`,
        ],
        seed,
      ),
      'shocked',
    )
  }
  if (quality === 3) {
    return line(
      pick(
        [
          `¡${name} arma perfecto! La pelota queda en el aire.`,
          `¡Qué manos las de ${name}! Armado ideal.`,
        ],
        seed,
      ),
      'triumphant',
    )
  }
  if (quality === 2) {
    return line(
      pick([`¡${name} la acomoda!`, `Armado limpio de ${name}.`], seed),
    )
  }
  return line(
    pick(
      [
        `El armado de ${name} quedó incómodo.`,
        `${name} la pelea y la deja jugable.`,
      ],
      seed,
    ),
    'worried',
  )
}

export const attackLine = (
  name: string,
  kind: AttackKind,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡${name} le pega con ${ATTACK_LABEL[kind]}!`,
        `¡Ahí va ${name} con ${ATTACK_LABEL[kind]}!`,
        `¡${name} descarga todo con ${ATTACK_LABEL[kind]}!`,
      ],
      seed,
    ),
  )

export const attackLabel = (kind: AttackKind): string =>
  ATTACK_LABEL[kind].toUpperCase()

export const blockLine = (name: string, seed: number): CommentaryLine =>
  line(
    pick(
      [
        `¡BLOQUEO! ¡${name} le cerró la puerta!`,
        `¡Muro perfecto de ${name}! La pelota vuelve al piso.`,
        `¡No pasó! Bloqueo limpio de ${name}.`,
      ],
      seed,
    ),
    'triumphant',
  )

export const digLine = (
  name: string,
  quality: Quality,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡${name} la sacó de abajo del piso!`,
        `¡Qué defensa de ${name}!`,
        `¡Se barrió y la levantó! ${name} sigue viva.`,
      ],
      seed,
    ),
    quality === 3 ? 'triumphant' : 'excited',
  )

export const pointLine = (
  side: Side,
  teams: Record<Side, CourtTeam>,
  score: Record<Side, number>,
  reason: 'ace' | 'error' | 'attack' | 'block' | 'cap',
  seed: number,
): CommentaryLine => {
  const team = teams[side].short
  if (reason === 'block') {
    return line(`¡BLOQUEO! Punto de ${team}. ${scoreText(score)}`, 'triumphant')
  }
  if (reason === 'ace') {
    return line(`¡ACE! Punto de ${team}. ${scoreText(score)}`, 'triumphant')
  }
  if (reason === 'error') {
    return line(`¡Error rival! Punto de ${team}. ${scoreText(score)}`, 'excited')
  }
  if (reason === 'cap') {
    return line(`¡Rally largo! Punto de ${team}. ${scoreText(score)}`, 'excited')
  }
  return line(
    pick(
      [
        `¡Punto de ${team}! ${scoreText(score)}`,
        `¡La pelota al piso! Punto de ${team}. ${scoreText(score)}`,
        `¡Se lo lleva ${team}! ${scoreText(score)}`,
      ],
      seed,
    ),
    'triumphant',
  )
}

export const setPointLine = (
  side: Side,
  teams: Record<Side, CourtTeam>,
): CommentaryLine =>
  line(
    `¡SET POINT de ${teams[side].short}! Está a un punto del set.`,
    'shocked',
  )

export const matchPointLine = (
  side: Side,
  teams: Record<Side, CourtTeam>,
): CommentaryLine =>
  line(
    `¡MATCH POINT de ${teams[side].short}! Esto se define ahora.`,
    'shocked',
  )

export const endLine = (
  winner: Side,
  teams: Record<Side, CourtTeam>,
  score: Record<Side, number>,
): CommentaryLine =>
  line(
    `¡${teams[winner].name} gana el set ${scoreText(score)}! ¡Qué partido!`,
    'triumphant',
  )

export const defenseLine = (
  scheme: string,
  name: string,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡${name} se planta con ${scheme}!`,
        `${name} elige ${scheme}. La defensa está lista.`,
      ],
      seed,
    ),
    'neutral',
  )

export const errorLine = (
  team: string,
  other: string,
  seed: number,
): CommentaryLine =>
  line(
    pick(
      [
        `¡Error de ${team}! Punto de ${other}.`,
        `${team} regala el punto. ${other} lo aprovecha.`,
      ],
      seed,
    ),
    'shocked',
  )
