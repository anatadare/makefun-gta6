// Cars and how they move. A car keeps a velocity vector; each step splits it
// into the part along the heading and the sideways slide. Throttle and drag
// work on the forward part, grip kills the slide, so a car slides a little
// through a turn and a lot with the handbrake on. Off the asphalt the ground
// drags: sand and grass are slow going, which is why the roads matter.

import { CAR_TYPES } from './config.js';
import { pointOnRoad, resolveCircle } from './city.js';

const OFFROAD_DRAG = 1.4;

export function createCar(typeId, x, y, angle, color, driver) {
  return {
    typeId,
    type: CAR_TYPES[typeId],
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    color,
    driver, // 'player' | 'traffic' | 'cop' | 'parked' | 'none'
    health: 100,
    siren: 0,
    brake: false,
    dead: false,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function carRadius(car) {
  return car.type.length * 0.42;
}

// Split a car's velocity into forward speed and sideways slide, relative to
// its heading; the inverse puts them back together after the step.
function splitVelocity(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  return { forward: car.vx * fx + car.vy * fy, lateral: -car.vx * fy + car.vy * fx };
}

function joinVelocity(car, forward, lateral) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  car.vx = fx * forward - fy * lateral;
  car.vy = fy * forward + fx * lateral;
}

// Bounce a car off whatever resolveCircle pushed it out of. Returns the
// impact speed, 0 when the car was moving away from the wall already.
function bounceOff(car, push) {
  if (!push) return 0;
  const into = car.vx * push.nx + car.vy * push.ny;
  if (into >= 0) return 0;
  car.vx -= push.nx * into * 1.4;
  car.vy -= push.ny * into * 1.4;
  return -into;
}

// Drive one step. throttle -1..1, steer -1..1, handbrake true/false.
// Returns the impact speed when the car hit something solid this step.
export function driveCar(car, dt, throttle, steer, handbrake, city) {
  const spec = car.type;
  let { forward, lateral } = splitVelocity(car);

  if (throttle > 0) forward += spec.accel * throttle * dt;
  else if (throttle < 0) {
    // Braking while rolling forward; reversing once nearly stopped.
    const braking = forward > 5 ? 1.6 : 0.55;
    forward += spec.accel * braking * throttle * dt;
  }
  const drag = (handbrake ? 1.1 : 0.35) + (pointOnRoad(city, car.x, car.y) ? 0 : OFFROAD_DRAG);
  forward -= forward * drag * dt;
  forward = Math.max(-spec.reverse, Math.min(spec.topSpeed, forward));

  // Steering bites with speed and flips when reversing; a slow car can
  // still creep around a corner, so the bite never quite reaches zero.
  const bite = Math.max(0.35, Math.min(1, Math.abs(forward) / 110));
  car.angle += steer * spec.turn * bite * Math.sign(forward || 1) * dt;

  const grip = handbrake ? 2.2 : spec.grip;
  lateral *= Math.max(0, 1 - grip * dt);
  joinVelocity(car, forward, lateral);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.brake = throttle < 0 && forward > 5;

  const impact = bounceOff(car, resolveCircle(city, car, carRadius(car)));
  if (impact > 0) {
    // Cars are tough: a hard shunt costs a few points, not the car.
    car.health -= impact * 0.006;
  }
  return impact;
}

// A car nobody drives rolls to a stop.
export function coastCar(car, dt, city) {
  car.vx -= car.vx * 2.2 * dt;
  car.vy -= car.vy * 2.2 * dt;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  bounceOff(car, resolveCircle(city, car, carRadius(car)));
}

// Push two overlapping cars apart and trade some of their speed. Returns
// the impact speed, 0 when they were already parting.
export function collideCarPair(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = carRadius(a) + carRadius(b) - 6;
  if (dist === 0 || dist >= min) return 0;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (min - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (closing >= 0) return 0;
  const push = -closing * 0.7;
  a.vx -= nx * push;
  a.vy -= ny * push;
  b.vx += nx * push;
  b.vy += ny * push;
  a.health -= push * 0.005;
  b.health -= push * 0.005;
  return push;
}
