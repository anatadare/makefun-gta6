// traffic.js — the background cars that keep the city moving. Each traffic
// car follows the road grid: it drives along its road to the next
// intersection, sometimes turns, and slows when another car is ahead of it.

import { TRAFFIC, WORLD, ROAD_X, ROAD_Y } from './config.js';
import { makeRand, distance, clamp } from './random.js';
import { createVehicle, driveVehicle, steerToward, vehicleDef } from './vehicles.js';
import { randomRoadPoint } from './world.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'hatch', 'hatch', 'van', 'truck', 'taxi'];

function pickRouteTarget(rand, car) {
  // Drive to a random intersection, then pick a new one there.
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  if (vertical) {
    const ry = rand.pick(ROAD_Y);
    return { x: car.x, y: ry };
  }
  const rx = rand.pick(ROAD_X);
  return { x: rx, y: car.y };
}

export function spawnTraffic(city, seed, count) {
  const rand = makeRand(seed + 77);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rand);
    const type = rand.pick(TRAFFIC_TYPES);
    const car = createVehicle(type, p.x, p.y, p.angle, { driver: 'traffic' });
    car.speed = rand.float(TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.cruise = rand.float(TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.route = pickRouteTarget(rand, car);
    car.headlights = true;
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(state, dt) {
  const { city, cars, player } = state;
  const rand = state.rand;
  const px = player.x;
  const py = player.y;

  for (const car of cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    car.sirenPhase += dt;

    // Reached the route target: pick a new heading at the intersection.
    if (!car.route || distance(car.x, car.y, car.route.x, car.route.y) < 40) {
      car.route = pickRouteTarget(rand, car);
      car.stuckTimer = 0;
    }

    // Slow down for the car ahead.
    let targetSpeed = car.cruise;
    for (const other of cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < TRAFFIC.followGap && side < 26) {
        targetSpeed = Math.min(targetSpeed, other.speed * 0.9);
      }
    }

    const steer = steerToward(car, car.route.x, car.route.y);
    let throttle = 0;
    if (car.speed < targetSpeed) throttle = 1;
    else if (car.speed > targetSpeed + 20) throttle = -0.5;
    const res = driveVehicle(city, car, throttle, steer, dt, state.fx);
    if (res.crashed && res.impact > 200) state.audio.crash();

    // Unstick: if barely moving for a while, reverse briefly.
    if (Math.abs(car.speed) < 12 && throttle > 0) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 2.5) {
        car.route = pickRouteTarget(rand, car);
        car.stuckTimer = 0;
        driveVehicle(city, car, -1, -steer, dt, state.fx);
      }
    } else {
      car.stuckTimer = 0;
    }

    // Recycle cars that drifted far from the player to a road near them.
    if (distance(car.x, car.y, px, py) > 1500) {
      const p = randomRoadPoint(rand);
      const near = { x: clamp(px + (p.x - 1800), 120, WORLD.width - 120), y: clamp(py + (p.y - 1350), 120, 2400) };
      const snap = nearestRoad(car, near);
      car.x = snap.x;
      car.y = snap.y;
      car.angle = p.angle;
      car.route = pickRouteTarget(rand, car);
      car.health = 100;
      car.dead = false;
    }
  }
}

function nearestRoad(car, p) {
  let best = { x: p.x, y: p.y };
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(p.x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y: p.y };
    }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(p.y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x: p.x, y: ry };
    }
  }
  return best;
}

export function trafficCount(state) {
  return state.cars.filter((c) => c.driver === 'traffic' && !c.dead).length;
}
