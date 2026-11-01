import block from '../assets/action/shared/block.png'
import celebrate from '../assets/action/shared/celebrate.png'
import defeat from '../assets/action/shared/defeat.png'
import dig from '../assets/action/shared/dig.png'
import duel from '../assets/action/shared/duel.png'
import error from '../assets/action/shared/error.png'
import errorNet from '../assets/action/shared/error-net.png'
import freeBall from '../assets/action/shared/free-ball.png'
import point from '../assets/action/shared/point.png'
import receive from '../assets/action/shared/receive.png'
import receiveAlt from '../assets/action/shared/receive-alt.png'
import serve from '../assets/action/shared/serve.png'
import set from '../assets/action/shared/set.png'
import type { ShotId } from './types'

/** Planos sin equipo: manos, pelota, silueta y red. Sirven para todos. */
export const SHOT_IMAGES: Record<ShotId, string> = {
  serve,
  duel,
  block,
  receive,
  receiveAlt,
  set,
  dig,
  point,
  error,
  errorNet,
  freeBall,
  celebrate,
  defeat,
}
