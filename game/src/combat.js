// combat.js — bullets, melee swings and the scattergun. Bullets fly until
// they hit a building, a car, a person or the edge of their range; a melee
// swing hits everything in an arc in front of the attacker. Kills feed the
// wanted system, the mission tracker and the pickup drops.

import { WEAPONS, WANTED, ECONOMY } from './config.js';
import { distance } from './random.js';
import { circleHitsBuilding } from './world.js';
import { damageVehicle } from './vehicles.js';
import { scarePeds } from './pedestrians.js';
import { addWanted, damageCop } from './police.js';

export function fireBullet(state, x, y, angle, opts) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * (opts.speed || 900),
    vy: Math.sin(angle) * (opts.speed || 900),
    damage: opts.damage || 10,
    range: opts.range || 320,
    traveled: 0,
    owner: opts.owner || 'player', // player | enemy | cop
    life: 1.2,
  });
}

export function fireScattergun(state, x, y, angle) {
  const w = WEAPONS.scattergun;
  for (let i = 0; i < w.pellets; i++) {
    const a = angle + (Math.random() - 0.5) * w.spread * 2;
    fireBullet(state, x, y, a, { damage: w.damage, range: w.range, owner: 'player', speed: 850 });
  }
  state.fx.muzzle(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, angle);
  state.fx.addShake(2.5);
  state.audio.shot();
  state.stats.shotsFired += 1;
  scarePeds(state, x, y, 320);
  // Firing where a cop can see it draws heat.
  if (state.wanted > 0 || state.police.nearestCopDistance(state) < WANTED.sightRange) {
    addWanted(state, WANTED.shootNearCop, '');
  }
}

export function enemyShoot(state, x, y, angle, owner, damage) {
  fireBullet(state, x, y, angle, { damage: damage || 6, range: 340, owner, speed: 780 });
  state.fx.muzzle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, angle);
  state.audio.shot();
}

// A melee swing: everyone in the arc in front of the attacker takes damage.
export function meleeAttack(state, x, y, angle, range, arc, damage, owner) {
  const hits = [];
  const inArc = (tx, ty) => {
    const d = distance(x, y, tx, ty);
    if (d > range + 12) return false;
    const a = Math.atan2(ty - y, tx - x);
    let dd = a - angle;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    return Math.abs(dd) < arc;
  };
  if (owner === 'player') {
    for (const ped of state.peds) {
      if (!ped.down && inArc(ped.x, ped.y)) {
        damagePed(state, ped, damage);
        hits.push(ped);
      }
    }
    for (const cop of state.cops) {
      if (!cop.down && inArc(cop.x, cop.y)) {
        damageCop(state, cop, damage);
        hits.push(cop);
      }
    }
    for (const e of state.enemies) {
      if (!e.down && inArc(e.x, e.y)) {
        damageEnemy(state, e, damage);
        hits.push(e);
      }
    }
    if (hits.length > 0) {
      state.audio.punch();
      state.fx.addShake(1.5);
    }
  }
  return hits;
}

export function damagePed(state, ped, amount) {
  if (ped.down) return;
  ped.health -= amount;
  state.fx.blood(ped.x, ped.y);
  if (ped.health <= 0) {
    ped.down = true;
    ped.state = 'wait';
    addWanted(state, WANTED.killPed, 'Pedestrian down!');
    state.stats.kills += 1;
    if (Math.random() < 0.4) dropPickup(state, ped.x, ped.y, 'cash');
    scarePeds(state, ped.x, ped.y, 300);
  } else {
    ped.state = 'flee';
    ped.stateTimer = 4;
    ped.fleeFrom = { x: state.player.x, y: state.player.y };
  }
}

export function damageEnemy(state, enemy, amount) {
  if (enemy.down) return;
  enemy.health -= amount;
  state.fx.blood(enemy.x, enemy.y);
  if (enemy.health <= 0) {
    enemy.down = true;
    enemy.downTimer = 10;
    state.stats.kills += 1;
    if (Math.random() < 0.6) dropPickup(state, enemy.x, enemy.y, 'ammo');
    else if (Math.random() < 0.4) dropPickup(state, enemy.x, enemy.y, 'health');
    state.missions.onEnemyKilled(state, enemy);
  } else {
    enemy.alerted = true;
  }
}

export function dropPickup(state, x, y, kind) {
  state.pickups.push({
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 20,
    kind, // cash | ammo | health
    life: 30,
    bob: Math.random() * 10,
  });
}

export function updateBullets(state, dt) {
  const { player } = state;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.life -= dt;
    const step = Math.hypot(b.vx, b.vy) * dt;
    b.traveled += step;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.traveled >= b.range;
    if (!dead && circleHitsBuilding(state.city, b.x, b.y, 2)) {
      state.fx.sparks(b.x, b.y);
      dead = true;
    }
    if (!dead && b.owner === 'player') {
      // Peds, cops, enemies, then cars.
      for (const ped of state.peds) {
        if (!ped.down && distance(b.x, b.y, ped.x, ped.y) < 12) {
          damagePed(state, ped, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (!cop.down && distance(b.x, b.y, cop.x, cop.y) < 12) {
            damageCop(state, cop, b.damage);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const e of state.enemies) {
          if (!e.down && distance(b.x, b.y, e.x, e.y) < 13) {
            damageEnemy(state, e, b.damage);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.dead) continue;
          const dx = b.x - car.x;
          const dy = b.y - car.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < 26 && Math.abs(localY) < 14) {
            damageVehicle(car, b.damage);
            state.fx.sparks(b.x, b.y);
            dead = true;
            break;
          }
        }
      }
    } else if (!dead && (b.owner === 'enemy' || b.owner === 'cop')) {
      if (player.car) {
        const car = player.car;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
        const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
        if (Math.abs(localX) < 26 && Math.abs(localY) < 14) {
          damageVehicle(car, b.damage);
          state.fx.sparks(b.x, b.y);
          dead = true;
        }
      } else if (distance(b.x, b.y, player.x, player.y) < 13) {
        state.police.hurtPlayer(state, b.damage);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

export function updatePickups(state, dt) {
  const { player } = state;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    p.life -= dt;
    p.bob += dt * 4;
    if (p.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    if (player.onFoot && distance(p.x, p.y, player.x, player.y) < 24) {
      if (p.kind === 'cash') {
        const amount = 10 + Math.floor(Math.random() * 20);
        state.money += amount;
        state.stats.moneyEarned += amount;
        state.message = { text: `+$${amount}`, timer: 1.5 };
        state.audio.cash();
      } else if (p.kind === 'ammo') {
        state.ammo = Math.min(WEAPONS.scattergun.maxAmmo, state.ammo + ECONOMY.ammoPickup);
        state.message = { text: `+${ECONOMY.ammoPickup} shells`, timer: 1.5 };
        state.audio.pickup();
      } else if (p.kind === 'health') {
        state.health = Math.min(100, state.health + ECONOMY.healthPickup);
        state.message = { text: `+${ECONOMY.healthPickup} health`, timer: 1.5 };
        state.audio.pickup();
      }
      state.fx.cashPop(p.x, p.y);
      state.pickups.splice(i, 1);
    }
  }
}

export function drawBullets(ctx, state) {
  ctx.fillStyle = '#ffe27a';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPickups(ctx, state) {
  for (const p of state.pickups) {
    const y = p.y + Math.sin(p.bob) * 2;
    ctx.save();
    ctx.translate(p.x, y);
    if (p.kind === 'cash') {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('$', -3, 4);
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(-4, -4, 3, 8);
      ctx.fillRect(1, -4, 3, 8);
    } else {
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    }
    ctx.restore();
  }
}
