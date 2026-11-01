import excited from '../assets/sprites/commentator/nando-excited.png'
import neutral from '../assets/sprites/commentator/nando-neutral.png'
import shocked from '../assets/sprites/commentator/nando-shocked.png'
import triumphant from '../assets/sprites/commentator/nando-triumphant.png'
import worried from '../assets/sprites/commentator/nando-worried.png'
import type { Expression } from './types'

/** Nando, el relator, con una cara por expresión. */
export const NANDO_PORTRAITS: Record<Expression, string> = {
  neutral,
  excited,
  shocked,
  worried,
  triumphant,
}
