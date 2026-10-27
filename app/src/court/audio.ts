/**
 * SFX de la cancha v2. Todo se sintetiza con WebAudio: no hay archivos
 * de audio ni samples de terceros.
 */
export type Cue =
  | 'toss'
  | 'hit'
  | 'receive'
  | 'set'
  | 'spike'
  | 'block'
  | 'dig'
  | 'point'
  | 'crowd'
  | 'whistle'

let audio: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

const createContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  const ctor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext
  if (!ctor) return null
  try {
    audio = new ctor()
  } catch {
    return null
  }
  noiseBuffer = null
  return audio
}

const getContext = (): AudioContext | null => {
  const context = audio ?? createContext()
  if (!context) return null
  if (context.state === 'suspended') void context.resume()
  return context
}

const getNoise = (context: AudioContext): AudioBuffer => {
  if (noiseBuffer) return noiseBuffer
  const buffer = context.createBuffer(
    1,
    Math.floor(context.sampleRate * 0.6),
    context.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

type ToneOptions = {
  frequency: number
  endFrequency?: number
  duration: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

const tone = (context: AudioContext, options: ToneOptions) => {
  const {
    frequency,
    endFrequency,
    duration,
    type = 'square',
    gain = 0.04,
    delay = 0,
  } = options
  const start = context.currentTime + delay
  const oscillator = context.createOscillator()
  const amp = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      start + duration,
    )
  }
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(amp).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

type NoiseOptions = {
  duration: number
  gain?: number
  delay?: number
  frequency?: number
  type?: BiquadFilterType
}

const noise = (context: AudioContext, options: NoiseOptions) => {
  const {
    duration,
    gain = 0.035,
    delay = 0,
    frequency = 1200,
    type = 'highpass',
  } = options
  const start = context.currentTime + delay
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const amp = context.createGain()
  source.buffer = getNoise(context)
  filter.type = type
  filter.frequency.value = frequency
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(amp).connect(context.destination)
  source.start(start)
  source.stop(start + duration + 0.02)
}

const crowd = (context: AudioContext) => {
  const start = context.currentTime
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const amp = context.createGain()
  source.buffer = getNoise(context)
  filter.type = 'lowpass'
  filter.frequency.value = 900
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.linearRampToValueAtTime(0.05, start + 0.18)
  amp.gain.linearRampToValueAtTime(0.0001, start + 0.85)
  source.connect(filter).connect(amp).connect(context.destination)
  source.start(start)
  source.stop(start + 0.9)
}

/** Desbloquea el audio en el primer toque del usuario. */
export const primeAudio = () => {
  getContext()
}

export const playCue = (cue: Cue) => {
  const context = getContext()
  if (!context) return
  switch (cue) {
    case 'toss':
      tone(context, {
        frequency: 480,
        endFrequency: 760,
        duration: 0.08,
        type: 'triangle',
        gain: 0.025,
      })
      break
    case 'hit':
      noise(context, { duration: 0.06, gain: 0.05, frequency: 900 })
      tone(context, {
        frequency: 140,
        endFrequency: 70,
        duration: 0.1,
        type: 'sine',
        gain: 0.055,
      })
      break
    case 'receive':
      noise(context, {
        duration: 0.05,
        gain: 0.03,
        frequency: 700,
        type: 'lowpass',
      })
      tone(context, {
        frequency: 320,
        endFrequency: 220,
        duration: 0.07,
        type: 'triangle',
        gain: 0.025,
      })
      break
    case 'set':
      tone(context, {
        frequency: 620,
        endFrequency: 920,
        duration: 0.06,
        type: 'triangle',
        gain: 0.02,
      })
      break
    case 'spike':
      noise(context, { duration: 0.13, gain: 0.07, frequency: 650 })
      tone(context, {
        frequency: 95,
        endFrequency: 45,
        duration: 0.16,
        type: 'sawtooth',
        gain: 0.06,
      })
      break
    case 'block':
      noise(context, {
        duration: 0.08,
        gain: 0.055,
        frequency: 420,
        type: 'lowpass',
      })
      tone(context, {
        frequency: 190,
        endFrequency: 120,
        duration: 0.1,
        type: 'square',
        gain: 0.04,
      })
      break
    case 'dig':
      noise(context, {
        duration: 0.1,
        gain: 0.045,
        frequency: 580,
        type: 'lowpass',
      })
      tone(context, {
        frequency: 260,
        endFrequency: 160,
        duration: 0.08,
        type: 'triangle',
        gain: 0.03,
      })
      break
    case 'point': {
      const notes = [523, 659, 784, 1046]
      notes.forEach((frequency, index) => {
        tone(context, {
          frequency,
          duration: 0.1,
          type: 'square',
          gain: 0.035,
          delay: index * 0.075,
        })
      })
      crowd(context)
      break
    }
    case 'crowd':
      crowd(context)
      break
    case 'whistle':
      tone(context, {
        frequency: 1180,
        endFrequency: 1560,
        duration: 0.12,
        type: 'square',
        gain: 0.035,
      })
      tone(context, {
        frequency: 1180,
        endFrequency: 1560,
        duration: 0.12,
        type: 'square',
        gain: 0.03,
        delay: 0.15,
      })
      break
  }
}
