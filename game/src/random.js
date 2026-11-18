// The game's dice: one seeded stream every system draws from in turn.
// Same seed, same city, same traffic, same staged screenshot scenes, so
// a shot is repeatable frame for frame. The stream is mulberry32, a small
// fast generator with a long period; nothing here touches Math.random.
// The only unseeded randomness in the game is cosmetic dust and smoke.

const SEED_STEP = 0x6d2b79f5;

export function createRandom(seed) {
  // A zero seed would lock the stream, so it falls back to the step itself.
  let cursor = (seed >>> 0) || SEED_STEP;

  // The next float in [0, 1): advance the state, scramble it, scale it.
  function next() {
    cursor = (cursor + SEED_STEP) >>> 0;
    let mix = cursor;
    mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  }

  // A float in [min, max).
  function range(min, max) {
    return min + (max - min) * next();
  }

  // An integer in [min, max], both ends included.
  function int(min, max) {
    return min + Math.floor(next() * (max + 1 - min));
  }

  // A random member of a list.
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  // True with probability p.
  function chance(p) {
    return next() < p;
  }

  // Either -1 or 1, evenly.
  function sign() {
    return next() < 0.5 ? -1 : 1;
  }

  return { next, range, int, pick, chance, sign };
}
