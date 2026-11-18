// The game's dice: one seeded stream (mulberry32) that every system draws
// from in turn. Same seed, same city, same traffic, same screenshot scenes,
// so a staged shot is repeatable frame for frame. Nothing here touches
// Math.random; the only unseeded randomness in the game is cosmetic dust.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function chance(p) {
    return next() < p;
  }

  function sign() {
    return next() < 0.5 ? -1 : 1;
  }

  return { next, range, int, pick, chance, sign };
}
