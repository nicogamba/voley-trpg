/** Semilla fija para demos y tests reproducibles. */
export const DEMO_SEED = 0x20261027

/** Usa la semilla pedida o genera una distinta por partida. */
export const resolveMatchSeed = (seed?: number): number =>
  seed ?? Math.floor(Math.random() * 0x100000000)
