// player.js — the player character: walking and sprinting on foot, driving
// with the arcade car model, stealing cars, punching, shooting, and every
// interaction (missions, taxi passengers, vendors) the E key triggers.

import { PLAYER, WEAPONS, WANTED, ECONOMY } from './config.js';
import { clamp, distance } from './random.js';
import { collideCircle } from './world.js';
import { driveVehicle, damageVehicle } from './vehicles.js';
import { addWanted, nearestCopDistance } from './police.js';
import { meleeAttack, fireScattergun, fireBullet } from './combat.js';
import { scarePeds } from './pedestrians.js';
import { tryPickup as tryTaxiPickup, cancel as cancelFare } from './taxi.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    vx: 0, vy: 0,
    onFoot: true,
    car: null,
    moving: false,
    running: false,
    meleeTimer: 0,
    shootTimer: 0,
    bobPhase: 0,
  };
}

export function updatePlayer(state, dt) {
  const { player, input } = state;
  player.meleeTimer = Math.max(0, player.meleeTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);

  if (player.onFoot) {
    updateOnFoot(state, dt);
  } else {
    updateDriving(state, dt);
  }

  // Weapon swap.
  if (input.wasPressed('q')) {
    if (state.weapon === 'fists' && state.ammo > 0) {
      state.weapon = 'scattergun';
      state.message = { text: 'Scattergun', timer: 1.2 };
    } else {
      state.weapon = 'fists';
      state.message = { text: 'Fists', timer: 1.2 };
    }
    state.audio.uiClick();
  }

  // Time skip.
  if (input.wasPressed('n')) {
    state.clock = (state.clock + 2) % 24;
    state.fx.setFlash('#0b1026', 0.6, 0.8);
    state.message = { text: '2 hours later...', timer: 2 };
    state.audio.uiClick();
  }

  // Melee on foot.
  if (player.onFoot && input.wasPressed(' ') && player.meleeTimer <= 0) {
    player.meleeTimer = WEAPONS.fists.cooldown;
    meleeAttack(state, player.x, player.y, player.angle, WEAPONS.fists.range, WEAPONS.fists.arc || 1.15, WEAPONS.fists.damage, 'player');
  }

  // Shooting: mouse click or F, on foot with the scattergun.
  const wantShoot = input.mouse.clicked || input.wasPressed('f');
  if (player.onFoot && wantShoot && state.weapon === 'scattergun' && player.shootTimer <= 0) {
    if (state.ammo > 0) {
      state.ammo -= 1;
      player.shootTimer = WEAPONS.scattergun.cooldown;
      const aim = state.aimAngle;
      fireScattergun(state, player.x + Math.cos(aim) * 16, player.y + Math.sin(aim) * 16, aim);
    } else {
      state.message = { text: 'Out of shells — find ammo', timer: 1.5 };
      state.audio.denied();
      state.weapon = 'fists';
    }
  }

  // Interact.
  if (input.wasPressed('e')) {
    tryInteract(state);
  }

  // Update the aim angle from the mouse.
  if (player.onFoot) {
    const mx = state.mouseWorld.x;
    const my = state.mouseWorld.y;
    if (distance(mx, my, player.x, player.y) > 8) {
      state.aimAngle = Math.atan2(my - player.y, mx - player.x);
    }
  }
}

function updateOnFoot(state, dt) {
  const { player, input } = state;
  const mv = input.moveVector();
  const sprint = input.isDown('Shift');
  const maxSpeed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.running = sprint && (mv.x !== 0 || mv.y !== 0);
  player.vx += mv.x * PLAYER.accel * dt;
  player.vy += mv.y * PLAYER.accel * dt;
  const drag = Math.max(0, 1 - PLAYER.friction * dt);
  if (mv.x === 0) player.vx *= drag;
  if (mv.y === 0) player.vy *= drag;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }
  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  const resolved = collideCircle(state.city, nx, ny, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  player.moving = speed > 20;
  if (player.moving) {
    player.angle = Math.atan2(player.vy, player.vx);
    player.bobPhase += dt * (player.running ? 13 : 9);
    if (Math.random() < dt * 3) state.fx.dust(player.x, player.y + 8);
  }
  state.stats.distance += speed * dt * 0.004;
}

function updateDriving(state, dt) {
  const { player, input } = state;
  const car = player.car;
  if (!car) {
    player.onFoot = true;
    return;
  }
  // The player's car follows the player object: the car IS the player.
  const mv = input.moveVector();
  const throttle = mv.y < 0 ? 1 : mv.y > 0 ? -1 : 0;
  const steer = mv.x;
  const handbrake = input.isDown('Shift') || input.isDown(' ');
  if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  const res = driveVehicle(state.city, car, throttle, steer, dt, state.fx);
  if (res.crashed && res.impact > 220) {
    state.audio.crash();
    state.fx.addShake(Math.min(5, res.impact / 130));
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.vx = Math.cos(car.angle) * car.speed;
  player.vy = Math.sin(car.angle) * car.speed;
  player.moving = Math.abs(car.speed) > 10;
  car.headlights = true;
  car.brakeLights = throttle < 0 || handbrake;
  state.stats.distance += Math.abs(car.speed) * dt * 0.004;
  state.audio.engine(Math.abs(car.speed) / 680, true);

  // A wrecked car throws the player out.
  if (car.dead) {
    state.audio.crash();
    state.fx.burst(car.x, car.y, '#ff7b2d', 24, 260);
    state.fx.addShake(8);
    exitCar(state, true);
    state.police.hurtPlayer(state, 20);
  }
}

export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.dead || car.driver === 'police') continue;
    const d = distance(car.x, car.y, state.player.x, state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(state, car) {
  const { player } = state;
  player.onFoot = false;
  player.car = car;
  player.vx = 0;
  player.vy = 0;
  const wasParked = car.driver === 'parked' || car.driver === 'traffic';
  car.driver = 'player';
  car.headlights = true;
  state.audio.uiClick();
  if (wasParked) {
    state.stats.carsStolen += 1;
    if (nearestCopDistance(state) < WANTED.sightRange) {
      addWanted(state, WANTED.stealCar, 'Car stolen in view of the cops!');
    } else {
      state.message = { text: `Stole a ${car.label}`, timer: 1.5 };
    }
  }
  // A fare can only run in a taxi.
  if (car.type !== 'taxi' && state.taxi.active) {
    cancelFare(state, 'Left the taxi — fare cancelled');
  }
}

export function exitCar(state, wrecked) {
  const { player } = state;
  const car = player.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed *= 0.4;
  car.brakeLights = false;
  const side = Math.PI / 2;
  const px = car.x + Math.cos(car.angle + side) * 30;
  const py = car.y + Math.sin(car.angle + side) * 30;
  const resolved = collideCircle(state.city, px, py, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  player.vx = 0;
  player.vy = 0;
  player.onFoot = true;
  player.car = null;
  state.audio.engine(0, false);
  if (!wrecked) state.audio.uiClick();
}

function tryInteract(state) {
  const { player } = state;
  if (!player.onFoot) {
    // In a taxi, E picks up a waiting passenger before it exits the car.
    if (player.car.type === 'taxi' && tryTaxiPickup(state)) return;
    exitCar(state, false);
    return;
  }
  // Mission marker first.
  if (state.missions.tryStartAt(state)) return;
  // Taxi passenger waiting nearby.
  // Vendor snack: a cheap heal.
  const vendor = nearestVendor(state, PLAYER.interactRange);
  if (vendor) {
    if (state.money >= 5 && state.health < 100) {
      state.money -= 5;
      state.health = Math.min(100, state.health + 25);
      state.message = { text: 'Snack +25 health (-$5)', timer: 1.5 };
      state.audio.pickup();
    } else if (state.health >= 100) {
      state.message = { text: 'Already full health', timer: 1.2 };
    } else {
      state.message = { text: 'Need $5 for a snack', timer: 1.2 };
      state.audio.denied();
    }
    return;
  }
  // Otherwise: the nearest car.
  const car = nearestCar(state, PLAYER.enterCarRange);
  if (car) enterCar(state, car);
}

function nearestVendor(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of state.peds) {
    if (ped.kind !== 'vendor' || ped.down) continue;
    const d = distance(ped.x, ped.y, state.player.x, state.player.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

export function drawPlayer(ctx, state) {
  const { player } = state;
  if (!player.onFoot) return;
  const bob = player.moving ? Math.sin(player.bobPhase) * 2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-5, -2 + bob, 4, 11);
  ctx.fillRect(1, -2 - bob, 4, 11);
  // Teal jacket.
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath();
  ctx.ellipse(0, -3, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a5e5d';
  ctx.fillRect(-8, -6, 16, 4);
  // Arms; the gun arm points forward when armed.
  ctx.fillStyle = '#e8b98a';
  if (state.weapon === 'scattergun') {
    ctx.fillRect(-3, -20, 6, 12);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-2, -26, 4, 14);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(-2, -14, 4, 5);
  } else {
    ctx.fillRect(-10, -6 + bob, 3, 9);
    ctx.fillRect(7, -6 - bob, 3, 9);
  }
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -12, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -14, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Direction tick so the facing is readable at a glance.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(24, -4);
  ctx.lineTo(24, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
