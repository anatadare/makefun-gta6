// Combat: bullets and fists. Bullets fly straight, spark off buildings and
// hurt whatever they touch (people and cars). A punch is a short arc in front
// of the attacker. Bullets live in a ring buffer: firing takes the next slot
// whether it is free or still flying, so a long firefight never runs dry.

import { PLAYER } from './config.js';
import { circleHitsSolid } from './city.js';

const POOL = 48;

export function createCombat() {
  const bullets = [];
  for (let i = 0; i < POOL; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, from: 'player', damage: 0, life: 0 });
  }
  return { bullets, cursor: 0, sparks: [], flashes: [] };
}

export function fireBullet(combat, x, y, angle, from, damage) {
  const b = combat.bullets[combat.cursor];
  combat.cursor = (combat.cursor + 1) % POOL;
  b.active = true;
  b.x = x + Math.cos(angle) * 20;
  b.y = y + Math.sin(angle) * 20;
  b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
  b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
  b.from = from;
  b.damage = damage;
  b.life = 1.1;
  combat.flashes.push({ x: b.x, y: b.y, angle, until: 0.06 });
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Step the bullets. `targets` is a list of {x, y, radius, kind, ref, dead}
// a bullet can hit; the caller's onHit decides what a hit does.
export function updateBullets(combat, dt, city, targets, onHit) {
  for (const b of combat.bullets) {
    if (!b.active) continue;
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) {
      b.active = false;
      continue;
    }
    if (circleHitsSolid(city, b.x, b.y, 2)) {
      b.active = false;
      combat.sparks.push({ x: b.x, y: b.y, until: 0.18 });
      continue;
    }
    for (const t of targets) {
      if (t.dead) continue;
      // Cops do not shoot their own; the player does not shoot themself.
      if (b.from === 'cop' && t.kind === 'cop') continue;
      if (b.from === 'player' && t.kind === 'player') continue;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      if (dx * dx + dy * dy > t.radius * t.radius) continue;
      b.active = false;
      combat.sparks.push({ x: b.x, y: b.y, until: 0.18 });
      onHit(t, b.damage, b.from);
      break;
    }
  }
  for (const list of [combat.sparks, combat.flashes]) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      list[i].until -= dt;
      if (list[i].until <= 0) list.splice(i, 1);
    }
  }
}

// The nearest target inside the attacker's reach and front arc, or null.
export function meleeTarget(attacker, angle, range, targets) {
  let best = null;
  let bestD = range;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - attacker.x;
    const dy = t.y - attacker.y;
    const d = Math.hypot(dx, dy);
    if (d > range + t.radius || d >= bestD) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > 1.1) continue;
    bestD = d;
    best = t;
  }
  return best;
}
