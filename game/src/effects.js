// Effects: the juice. Particles (explosion fire, dust, smoke, tire smoke),
// skid marks left by hard braking and drifting, expanding shockwave rings
// from a wreck, and the screen shake that sells an impact. The world spawns
// them, the renderer draws them, nothing here knows about the canvas.

const MAX_PARTICLES = 400;
const MAX_SKIDS = 220;

export function createEffects() {
  return { particles: [], skids: [], rings: [], shake: 0 };
}

function addParticle(effects, x, y, vx, vy, life, size, color) {
  if (effects.particles.length >= MAX_PARTICLES) effects.particles.shift();
  effects.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
}

function burst(effects, x, y, count, speedMin, speedMax, lifeMin, lifeMax, sizeMin, sizeMax, colors, lift) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    addParticle(
      effects,
      x,
      y,
      Math.cos(a) * speed,
      Math.sin(a) * speed + (lift || 0),
      lifeMin + Math.random() * (lifeMax - lifeMin),
      sizeMin + Math.random() * (sizeMax - sizeMin),
      colors[i % colors.length],
    );
  }
}

// A car wreck: fire, smoke, flying debris, a shockwave ring and a hard shake.
export function spawnExplosion(effects, x, y) {
  burst(effects, x, y, 26, 60, 320, 0.4, 0.9, 4, 11, ['#ff9a3d', '#ffc93d', '#ff5a3d', '#ffdd55'], 0);
  burst(effects, x, y, 14, 20, 90, 0.9, 1.8, 8, 18, ['#5a5a5a'], -30);
  effects.rings.push({ x, y, radius: 10, maxRadius: 90, life: 0.45, maxLife: 0.45 });
  effects.shake = Math.min(16, effects.shake + 12);
}

// Dust kicked up by a car leaving the asphalt.
export function spawnDust(effects, x, y) {
  if (effects.particles.length >= MAX_PARTICLES) return;
  addParticle(effects, x, y, (Math.random() - 0.5) * 40, -20 - Math.random() * 30, 0.5 + Math.random() * 0.4, 5 + Math.random() * 6, '#c9b896');
}

// White tire smoke from a hard drift.
export function spawnTireSmoke(effects, x, y) {
  if (effects.particles.length >= MAX_PARTICLES) return;
  addParticle(effects, x, y, (Math.random() - 0.5) * 24, -14 - Math.random() * 22, 0.5 + Math.random() * 0.4, 6 + Math.random() * 6, '#e8e8e8');
}

// A puff of smoke from a battered engine.
export function spawnEngineSmoke(effects, x, y) {
  if (effects.particles.length >= MAX_PARTICLES) return;
  addParticle(effects, x, y, (Math.random() - 0.5) * 20, -30 - Math.random() * 20, 0.7 + Math.random() * 0.5, 6 + Math.random() * 5, '#777777');
}

// A skid mark: a short dark streak along the car's heading.
export function addSkid(effects, x, y, angle) {
  if (effects.skids.length >= MAX_SKIDS) effects.skids.shift();
  effects.skids.push({ x, y, angle, life: 4 });
}

export function addShake(effects, amount) {
  effects.shake = Math.min(16, effects.shake + amount);
}

// Age a list in place, dropping the dead by swapping with the tail.
function ageOut(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].life -= dt;
    if (list[i].life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
    }
  }
}

export function updateEffects(effects, dt) {
  for (const p of effects.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx -= p.vx * 1.8 * dt;
    p.vy -= p.vy * 1.8 * dt;
  }
  ageOut(effects.particles, dt);
  ageOut(effects.skids, dt);
  for (const ring of effects.rings) {
    ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, 10 * dt);
  }
  ageOut(effects.rings, dt);
  effects.shake = Math.max(0, effects.shake - 26 * dt);
}
