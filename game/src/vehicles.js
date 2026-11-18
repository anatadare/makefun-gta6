// vehicles.js — car definitions, arcade driving physics, collisions and
// drawing. Every car in the city, parked, traffic, police or the player's,
// is one of these; the driver (player, traffic AI, police AI) only feeds
// it throttle and steering.

import { VEHICLE_TYPES } from './config.js';
import { clamp, angleDelta } from './random.js';
import { collideCircle } from './world.js';

let nextId = 1;

export function createVehicle(type, x, y, angle, opts = {}) {
  const def = VEHICLE_TYPES[type];
  return {
    id: nextId++,
    type,
    label: def.label,
    x, y,
    angle,
    speed: 0,
    color: opts.color || def.colors[Math.floor(Math.random() * def.colors.length)],
    health: 100,
    driver: opts.driver || 'parked', // parked | player | traffic | police | mission
    occupants: opts.occupants || 0,
    siren: type === 'cruiser' || type === 'veteran',
    sirenPhase: Math.random() * 10,
    headlights: false,
    brakeLights: false,
    smoke: 0,
    dead: false,
    route: opts.route || null,
    routeIndex: 0,
    stuckTimer: 0,
    fare: null,
  };
}

export function vehicleDef(car) {
  return VEHICLE_TYPES[car.type];
}

// Arcade car physics: throttle along the heading, steering that bites
// harder at speed, grip that pulls velocity toward the heading.
export function driveVehicle(city, car, throttle, steer, dt, fx) {
  const def = vehicleDef(car);
  const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
  if (throttle !== 0) {
    const accel = forward > 0 ? def.accel : def.accel * 0.7;
    car.speed += forward * accel * dt;
  } else {
    car.speed *= Math.max(0, 1 - 0.6 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const maxFwd = def.topSpeed;
  const maxRev = def.reverseSpeed;
  car.speed = clamp(car.speed, -maxRev, maxFwd);

  const speedFactor = clamp(Math.abs(car.speed) / 220, 0, 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * def.turnRate * speedFactor * dir * dt;

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  const nx = car.x + vx * dt;
  const ny = car.y + vy * dt;
  const r = def.length * 0.42;
  const resolved = collideCircle(city, nx, ny, r);
  const hitWall = Math.abs(resolved.x - nx) > 0.5 || Math.abs(resolved.y - ny) > 0.5;
  if (hitWall) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    if (impact > 260) {
      damageVehicle(car, impact / 60);
      if (fx) {
        fx.sparks(resolved.x, resolved.y);
        fx.addShake(Math.min(6, impact / 120));
      }
      return { crashed: true, impact };
    }
  }
  car.x = resolved.x;
  car.y = resolved.y;

  // Skid marks and smoke when sliding hard or damaged.
  if (fx && Math.abs(steer) > 0.7 && Math.abs(car.speed) > 300) {
    fx.skid(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, car.angle);
  }
  if (car.health < 40 && fx && Math.random() < dt * 8) {
    fx.exhaust(car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18, car.angle);
  }
  return { crashed: false, impact: 0 };
}

export function damageVehicle(car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
  }
}

// Simple circle push between two cars; returns true when they touched.
export function separateCars(a, b) {
  const da = vehicleDef(a);
  const db = vehicleDef(b);
  const ra = da.length * 0.42;
  const rb = db.length * 0.42;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = ra + rb;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const rel = Math.abs(a.speed - b.speed);
  a.speed *= 0.8;
  b.speed *= 0.8;
  if (rel > 200) {
    damageVehicle(a, rel / 90);
    damageVehicle(b, rel / 90);
  }
  return true;
}

export function drawVehicle(ctx, car, night) {
  const def = vehicleDef(car);
  const L = def.length;
  const W = def.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L, W);

  // Headlight cones at night.
  if (night && car.headlights && !car.dead) {
    const grad = ctx.createRadialGradient(L / 2, 0, 4, L / 2 + 90, 0, 110);
    grad.addColorStop(0, 'rgba(255, 240, 170, 0.35)');
    grad.addColorStop(1, 'rgba(255, 240, 170, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(L / 2, -W / 2 + 3);
    ctx.lineTo(L / 2 + 110, -W / 2 - 22);
    ctx.lineTo(L / 2 + 110, W / 2 + 22);
    ctx.lineTo(L / 2, W / 2 - 3);
    ctx.closePath();
    ctx.fill();
  }

  // Body.
  ctx.fillStyle = car.dead ? '#2b2b2b' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cabin and windows.
  ctx.fillStyle = car.dead ? '#1a1a1a' : '#20262e';
  roundRect(ctx, -L / 2 + L * 0.28, -W / 2 + 4, L * 0.4, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.5)';
  roundRect(ctx, -L / 2 + L * 0.3, -W / 2 + 6, L * 0.16, W - 12, 3);
  ctx.fill();

  // Taxi sign and police markings.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111111';
    ctx.fillRect(-4, -W / 2 - 2, 14, 5);
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 5px sans-serif';
    ctx.fillText('TAXI', -3, -W / 2 + 2);
  }
  if (car.type === 'cruiser') {
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 5);
    ctx.fillRect(-L / 2 + 4, W / 2 - 7, L - 8, 5);
    drawLightbar(ctx, car);
  }
  if (car.type === 'veteran') {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-L / 2 + 4, -2, L - 8, 4);
    drawLightbar(ctx, car);
  }
  if (car.type === 'cometa') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-L / 2 + 2, -3, L - 4, 6);
  }

  // Headlights and tail lights.
  ctx.fillStyle = night ? '#fff6b0' : '#e8e8c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
  ctx.fillStyle = car.brakeLights ? '#ff2d20' : '#a93226';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);

  // Damage smoke.
  if (car.health < 40 && !car.dead) {
    ctx.fillStyle = 'rgba(90,90,90,0.6)';
    ctx.beginPath();
    ctx.arc(L / 2 - 6, 0, 6 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightbar(ctx, car) {
  const phase = Math.floor(car.sirenPhase * 4) % 2 === 0;
  ctx.fillStyle = phase ? '#ff2d20' : '#2d7bff';
  ctx.fillRect(-6, -8, 12, 5);
  ctx.fillStyle = phase ? '#2d7bff' : '#ff2d20';
  ctx.fillRect(-6, 3, 12, 5);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Steering input that turns a car toward a target point.
export function steerToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const d = angleDelta(car.angle, want);
  return clamp(d * 2.2, -1, 1);
}
