// police.js — the wanted system and the cops who enforce it. Stars rise
// when the player commits crimes in sight of the law and fade when the
// player stays out of sight. Cop cars chase and ram; foot cops chase, shoot
// and arrest; at four stars and up the black veteran interceptors join in.

import { WANTED, COPS } from './config.js';
import { distance, clamp, angleDelta } from './random.js';
import { createVehicle, driveVehicle, steerToward, damageVehicle, vehicleDef } from './vehicles.js';
import { nearestRoadPoint } from './world.js';
import { scarePeds } from './pedestrians.js';

export function addWanted(state, amount, reason) {
  if (amount <= 0) return;
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, WANTED.maxStars);
  state.wantedTimer = 0;
  state.stats.maxWanted = Math.max(state.stats.maxWanted, state.wanted);
  if (state.wanted > before) {
    state.audio.denied();
    if (reason) state.message = { text: reason, timer: 2.5 };
  }
}

export function copCars(state) {
  return state.cars.filter((c) => c.driver === 'police' && !c.dead);
}

export function footCops(state) {
  return state.cops.filter((c) => !c.down);
}

export function nearestCopDistance(state) {
  let best = Infinity;
  const px = state.player.x;
  const py = state.player.y;
  for (const car of copCars(state)) {
    best = Math.min(best, distance(car.x, car.y, px, py));
  }
  for (const cop of footCops(state)) {
    best = Math.min(best, distance(cop.x, cop.y, px, py));
  }
  return best;
}

function spawnCopCar(state, veteran) {
  const px = state.player.x;
  const py = state.player.y;
  const angle = Math.random() * Math.PI * 2;
  const dist = COPS.spawnDistance + Math.random() * 200;
  const raw = { x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist };
  const road = nearestRoadPoint(
    clamp(raw.x, 100, 3500),
    clamp(raw.y, 100, 2400),
  );
  const car = createVehicle(veteran ? 'veteran' : 'cruiser', road.x, road.y, 0, { driver: 'police' });
  car.veteran = veteran;
  car.headlights = true;
  car.speed = 200;
  state.cars.push(car);
  return car;
}

function spawnFootCop(state, x, y, veteran) {
  const cop = {
    x, y,
    angle: Math.atan2(state.player.y - y, state.player.x - x),
    speed: veteran ? 230 : 195,
    health: veteran ? 70 : COPS.footCopHealth,
    veteran,
    shootTimer: 1 + Math.random(),
    down: false,
    bustedTimer: 0,
    bobPhase: Math.random() * 10,
  };
  state.cops.push(cop);
  return cop;
}

export function updatePolice(state, dt) {
  const { player } = state;

  // Wanted decay: out of every cop's sight long enough and the heat fades.
  if (state.wanted > 0) {
    if (nearestCopDistance(state) > WANTED.sightRange) {
      state.wantedTimer += dt;
      if (state.wantedTimer > WANTED.decayDelay + WANTED.decayInterval) {
        state.wanted -= 1;
        state.wantedTimer = WANTED.decayDelay;
        state.message = { text: 'The heat is dying down...', timer: 2 };
        if (state.wanted <= 0) {
          state.wanted = 0;
          state.message = { text: 'You lost the cops.', timer: 2.5 };
        }
      }
    } else {
      state.wantedTimer = Math.min(state.wantedTimer, WANTED.decayDelay);
    }
  }

  // Spawn pressure: the more stars, the more units on the street.
  // Timers, not pure chance, so the response is steady and predictable.
  if (state.wanted > 0) {
    const wantCars = Math.min(COPS.maxCars, 1 + state.wanted);
    const cars = copCars(state);
    state.copSpawnTimer = (state.copSpawnTimer || 0) + dt;
    if (cars.length < wantCars && state.copSpawnTimer > 1.2) {
      state.copSpawnTimer = 0;
      const veteran = state.wanted >= COPS.veteranAtStars && Math.random() < 0.4;
      spawnCopCar(state, veteran);
    }
    const wantFoot = state.wanted >= 2 ? Math.min(COPS.maxFoot, state.wanted - 1) : 0;
    const foot = footCops(state);
    state.footSpawnTimer = (state.footSpawnTimer || 0) + dt;
    if (foot.length < wantFoot && !player.car && state.footSpawnTimer > 2.0) {
      state.footSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const x = player.x + Math.cos(angle) * 420;
      const y = player.y + Math.sin(angle) * 420;
      spawnFootCop(state, x, y, state.wanted >= COPS.veteranAtStars && Math.random() < 0.5);
    }
  }

  // Cop cars chase the player and ram.
  for (const car of copCars(state)) {
    car.sirenPhase += dt;
    const d = distance(car.x, car.y, player.x, player.y);
    const steer = steerToward(car, player.x, player.y);
    let throttle = 1;
    if (d < 60) throttle = 0.4;
    if (car.speed < 20 && car.stuckTimer > 1.5) {
      throttle = -1;
      car.stuckTimer = 0;
    }
    if (Math.abs(car.speed) < 12 && throttle > 0) car.stuckTimer += dt;
    else car.stuckTimer = 0;
    const res = driveVehicle(state.city, car, throttle, steer, dt, state.fx);
    if (res.crashed && res.impact > 200) state.audio.crash();

    // Ramming the player's car hurts it; ramming the player hurts them.
    if (player.car) {
      const pc = player.car;
      const cd = distance(car.x, car.y, pc.x, pc.y);
      if (cd < 46) {
        damageVehicle(pc, COPS.ramDamage * dt * 4);
        state.fx.addShake(2 * dt * 10);
        if (Math.random() < dt * 2) state.audio.crash();
      }
    } else if (d < 34 && Math.abs(car.speed) > 80) {
      hurtPlayer(state, 12);
      state.fx.blood(player.x, player.y);
      scarePeds(state, player.x, player.y, 260);
    }

    // Close enough on foot: an officer gets out and gives chase.
    if (!player.car && d < 120 && footCops(state).length < COPS.maxFoot && Math.random() < dt * 0.4) {
      spawnFootCop(state, car.x, car.y, car.veteran);
    }

    // Despawn far away once the heat is off.
    if (state.wanted === 0 && d > COPS.despawnDistance) {
      car.dead = true;
      car.driver = 'gone';
    }
  }

  // Foot cops run the player down, shoot, and arrest.
  for (const cop of state.cops) {
    if (cop.down) continue;
    cop.bobPhase += dt * 12;
    const d = distance(cop.x, cop.y, player.x, player.y);
    const want = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = want;

    if (player.car) {
      // A foot cop can't catch a car: they hold position and shoot.
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0 && d < COPS.shootRange) {
        cop.shootTimer = COPS.shootCooldown * (cop.veteran ? 0.7 : 1);
        state.combat.enemyShoot(state, cop.x, cop.y, want + (Math.random() - 0.5) * 0.2, 'cop', cop.veteran ? 8 : COPS.shootDamage);
      }
      continue;
    }

    // On foot: run at the player.
    const step = cop.speed * dt;
    const nx = cop.x + Math.cos(cop.angle) * step;
    const ny = cop.y + Math.sin(cop.angle) * step;
    const resolved = state.world.collideCircle(state.city, nx, ny, 11);
    cop.x = resolved.x;
    cop.y = resolved.y;

    // Arrest: close and the player is barely moving.
    const playerSpeed = Math.hypot(player.vx, player.vy);
    if (d < WANTED.bustedRange && playerSpeed < 60) {
      cop.bustedTimer += dt;
      if (cop.bustedTimer >= WANTED.bustedTime) {
        state.events.push({ type: 'busted' });
        return;
      }
    } else {
      cop.bustedTimer = 0;
    }

    // Shoot when in range.
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0 && d < COPS.shootRange && d > 60) {
      cop.shootTimer = COPS.shootCooldown * (cop.veteran ? 0.7 : 1);
      state.combat.enemyShoot(state, cop.x, cop.y, want + (Math.random() - 0.5) * 0.25, 'cop', cop.veteran ? 8 : COPS.shootDamage);
    }
  }

  // Clean up downed cops and departed cars.
  state.cops = state.cops.filter((c) => !c.down || c.downTimer > 0);
  for (const cop of state.cops) {
    if (cop.down) cop.downTimer -= dt;
  }
  state.cars = state.cars.filter((c) => !(c.driver === 'gone'));
}

export function hurtPlayer(state, amount) {
  if (state.mode !== 'playing' && state.mode !== 'dialogue') return;
  state.health -= amount;
  state.fx.setFlash('#a93226', 0.25, 0.25);
  state.fx.addShake(3);
  if (state.health <= 0) {
    state.health = 0;
    state.events.push({ type: 'wasted' });
  }
}

export function damageCop(state, cop, amount) {
  cop.health -= amount;
  state.fx.blood(cop.x, cop.y);
  if (cop.health <= 0 && !cop.down) {
    cop.down = true;
    cop.downTimer = 12;
    addWanted(state, WANTED.killCop, 'Officer down!');
    state.stats.kills += 1;
  }
}

export function drawFootCop(ctx, cop) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle + Math.PI / 2);
  const bob = Math.sin(cop.bobPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cop.veteran ? '#1a1a1a' : '#1a3a5c';
  ctx.fillRect(-5, -2 + bob, 4, 10);
  ctx.fillRect(1, -2 - bob, 4, 10);
  ctx.fillStyle = cop.veteran ? '#222' : '#274e7d';
  ctx.beginPath();
  ctx.ellipse(0, -3, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cop.veteran ? '#111' : '#1a3a5c';
  ctx.beginPath();
  ctx.arc(0, -13, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(-2, -17, 4, 2);
  ctx.restore();
}
