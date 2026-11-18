// The player: Mars Delgado, getaway driver. On foot he runs, aims with
// the mouse and shoots or punches; in a car he is the car. Health, money,
// the car he is driving and the weapon in his hands all live here. The
// aim turns smoothly toward the mouse instead of snapping, so the gun
// feels held rather than glued. Q swaps between the pistol and the
// scattergun.

import { PLAYER } from './config.js';
import { resolveCircle } from './city.js';

export const WEAPON_PISTOL = 'pistol';
export const WEAPON_SCATTER = 'scatter';

export const WEAPON_NAMES = {
  [WEAPON_PISTOL]: 'Pistol',
  [WEAPON_SCATTER]: 'Scattergun',
};

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    money: 0,
    weapon: WEAPON_PISTOL,
    moving: false,
    sprinting: false,
    lastHurtAt: -99,
    punchAt: -99,
    fireAt: -99,
    speed: 0,
  };
}

// Turn `from` toward `to` by at most `maxStep`, taking the short way around.
function turnToward(from, to, maxStep) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

// Move on foot. move is {x, y} in -1..1, sprint a boolean, aim the world
// point the mouse points at. Returns true when the player bumped into
// something solid this step.
export function walkPlayer(player, dt, move, sprint, aimX, aimY, city) {
  const len = Math.hypot(move.x, move.y);
  player.moving = len > 0.1;
  player.sprinting = player.moving && sprint;
  if (player.moving) {
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    player.x += (move.x / len) * speed * dt;
    player.y += (move.y / len) * speed * dt;
    player.speed = speed;
    player.angle = Math.atan2(move.y, move.x);
  } else {
    player.speed = 0;
  }
  const wantAim = Math.atan2(aimY - player.y, aimX - player.x);
  player.aimAngle = turnToward(player.aimAngle, wantAim, 14 * dt);
  return resolveCircle(city, player, PLAYER.radius) !== null;
}

export function enterCar(player, car) {
  player.car = car;
  player.onFoot = false;
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aimAngle = car.angle;
}

export function exitCar(player, city) {
  const car = player.car;
  if (!car) return;
  car.driver = 'none';
  player.car = null;
  player.onFoot = true;
  // Step out on the driver's side, clear of the car.
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.angle = car.angle;
  resolveCircle(city, player, PLAYER.radius);
}

export function hurtPlayer(player, damage, now) {
  player.health = Math.max(0, player.health - damage);
  player.lastHurtAt = now;
}

export function healPlayer(player, dt, now) {
  if (player.health <= 0 || player.health >= PLAYER.health) return;
  if (now - player.lastHurtAt <= PLAYER.regenDelay) return;
  player.health = Math.min(PLAYER.health, player.health + PLAYER.regenRate * dt);
}

// The scattergun is slow to work: each weapon has its own fire rate.
export function fireCooldownFor(player) {
  return player.weapon === WEAPON_SCATTER ? PLAYER.scatterCooldown : PLAYER.fireCooldown;
}

export function canFire(player, now) {
  return now - player.fireAt >= fireCooldownFor(player);
}

export function canPunch(player, now) {
  return now - player.punchAt >= PLAYER.punchCooldown;
}

export function swapWeapon(player) {
  player.weapon = player.weapon === WEAPON_SCATTER ? WEAPON_PISTOL : WEAPON_SCATTER;
  return player.weapon;
}
