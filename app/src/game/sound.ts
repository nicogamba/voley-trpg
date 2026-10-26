type Sfx =
  | 'serve'
  | 'receive'
  | 'set'
  | 'attack'
  | 'dig'
  | 'block'
  | 'point'
  | 'win'
  | 'lose'
  | 'click'
  | 'move'

let context: AudioContext | null = null
let muted = false

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Desbloquea el audio en el primer gesto del usuario. */
export const unlockAudio = () => {
  getContext()
}

export const setSfxMuted = (value: boolean) => {
  muted = value
}

type ToneOptions = {
  freq: number
  duration: number
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
}

const tone = ({
  freq,
  duration,
  type = 'sine',
  gain = 0.06,
  delay = 0,
  slideTo,
}: ToneOptions) => {
  const ctx = getContext()
  if (!ctx) return
  const start = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(freq, start)
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
  }
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(envelope)
  envelope.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

const noise = (duration: number, gain = 0.05, delay = 0) => {
  const ctx = getContext()
  if (!ctx) return
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < frames; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frames)
  }
  const source = ctx.createBufferSource()
  const envelope = ctx.createGain()
  const start = ctx.currentTime + delay
  source.buffer = buffer
  envelope.gain.setValueAtTime(gain, start)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(envelope)
  envelope.connect(ctx.destination)
  source.start(start)
}

export const playSfx = (name: Sfx) => {
  if (muted) return
  switch (name) {
    case 'serve':
      noise(0.09, 0.05)
      tone({ freq: 220, duration: 0.12, type: 'triangle', slideTo: 120 })
      break
    case 'receive':
      noise(0.06, 0.04)
      tone({ freq: 180, duration: 0.1, type: 'sine', gain: 0.05 })
      break
    case 'set':
      tone({ freq: 440, duration: 0.07, type: 'triangle', gain: 0.04 })
      tone({ freq: 660, duration: 0.08, type: 'triangle', gain: 0.035, delay: 0.06 })
      break
    case 'attack':
      noise(0.12, 0.08)
      tone({ freq: 300, duration: 0.16, type: 'sawtooth', gain: 0.05, slideTo: 90 })
      break
    case 'dig':
      noise(0.07, 0.045)
      tone({ freq: 260, duration: 0.1, type: 'square', gain: 0.03 })
      break
    case 'block':
      noise(0.16, 0.06)
      tone({ freq: 120, duration: 0.2, type: 'square', gain: 0.05, slideTo: 70 })
      break
    case 'point':
      tone({ freq: 523, duration: 0.12, type: 'triangle', gain: 0.05 })
      tone({ freq: 659, duration: 0.12, type: 'triangle', gain: 0.05, delay: 0.09 })
      tone({ freq: 784, duration: 0.2, type: 'triangle', gain: 0.05, delay: 0.18 })
      break
    case 'win':
      ;[523, 659, 784, 1046].forEach((freq, index) =>
        tone({
          freq,
          duration: 0.22,
          type: 'triangle',
          gain: 0.06,
          delay: index * 0.12,
        }),
      )
      break
    case 'lose':
      tone({ freq: 330, duration: 0.22, type: 'sine', gain: 0.05 })
      tone({
        freq: 220,
        duration: 0.34,
        type: 'sine',
        gain: 0.05,
        delay: 0.16,
      })
      break
    case 'click':
      tone({ freq: 700, duration: 0.03, type: 'sine', gain: 0.02 })
      break
    case 'move':
      tone({ freq: 520, duration: 0.05, type: 'sine', gain: 0.025 })
      break
  }
}
