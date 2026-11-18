// Traffic: the cars that drive the streets and the parked cars waiting to
// be stolen. A traffic car runs between intersections, steering for the
// next crossing, braking for whatever is ahead, and pulling over when a
// siren closes in behind it. Cars far from the player are recycled so the
// streets always feel alive near the camera. Taxis are everywhere; the
// muscle car is a rare sight, worth stealing when you spot one.

import { CAR_COLORS, ROADS, TRAFFIC } from './config.js';
import { nearestIntersection, pointOnRoad, randomRoadPoint } from './city.js';
import { carRadius, carSpeed, coastCar, collideCarPair, createCar, driveCar } from './vehicles.js';

// Weighted by repetition: taxis are common, the Cometa is rare.
const TRAFFIC_TYPES = ['duna', 'brisa', 'tortuga', 'camino', 'taxi', 'taxi', 'cometa'];
const PARKED_V = ROADS.vertical;
const PARKED_H = [200, 600, 1000, 1400, 1800, 2200];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// From an intersection, the next stop is another crossing on one of the two
// roads through it. The car keeps its direction when it can and only turns
// back when the road ends.
function pickNextWaypoint(city, random, from, prev) {
  const options = [];
  for (const p of city.intersections) {
    if (p === from) continue;
    if (p.x === from.x || p.y === from.y) options.push(p);
  }
  if (options.length === 0) return from;
  const forward = prev ? options.filter((p) => p !== prev) : options;
  return random.pick(forward.length > 0 ? forward : options);
}

function spawnTrafficCar(traffic, city, random, nearX, nearY) {
  const spot = randomRoadPoint(random, nearX, nearY, TRAFFIC.spawnDistance * 0.4, TRAFFIC.spawnDistance);
  const typeId = random.pick(TRAFFIC_TYPES);
  const color = typeId === 'taxi' ? '#f1c40f' : random.pick(CAR_COLORS);
  const car = createCar(typeId, spot.x, spot.y, random.range(0, Math.PI * 2), color, 'traffic');
  const start = nearestIntersection(city, spot.x, spot.y);
  car.waypoint = pickNextWaypoint(city, random, start, null);
  car.cruise = random.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
  traffic.cars.push(car);
  return car;
}

function parkOne(traffic, city, random) {
  const vertical = random.chance(0.5);
  let x;
  let y;
  let angle;
  if (vertical) {
    // Parked at the curb (52 units off centre), clear of the driving lane.
    x = random.pick(PARKED_V) + random.sign() * 52;
    y = random.range(120, 2240);
    angle = random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = random.range(120, 3280);
    y = random.pick(PARKED_H) + random.sign() * 52;
    angle = random.chance(0.5) ? 0 : Math.PI;
  }
  if (!pointOnRoad(city, x, y)) return false;
  const cross = nearestIntersection(city, x, y);
  if (Math.hypot(cross.x - x, cross.y - y) < 100) return false;
  if (traffic.parked.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) return false;
  const typeId = random.pick(TRAFFIC_TYPES);
  const color = typeId === 'taxi' ? '#f1c40f' : random.pick(CAR_COLORS);
  traffic.parked.push(createCar(typeId, x, y, angle, color, 'parked'));
  return true;
}

export function createTraffic(city, random) {
  const traffic = { cars: [], parked: [] };
  let guard = 0;
  while (traffic.parked.length < TRAFFIC.parkedCars && guard < 200) {
    guard += 1;
    parkOne(traffic, city, random);
  }
  return traffic;
}

// Anything close ahead on the car's nose?
function blockedAhead(car, others) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of others) {
    if (other === car) continue;
    if (other.dead && !other.burnt) continue; // A burnt wreck still blocks the road.
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 0 || ahead > 110) continue;
    if (Math.abs(dy * fx - dx * fy) < carRadius(other) + 14) return true;
  }
  return false;
}

// A cop car with its siren up, closing in from behind: time to pull over.
function sirenBehind(car, allCars) {
  for (const other of allCars) {
    if (other.typeId !== 'interceptor' || other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    if (Math.hypot(dx, dy) > TRAFFIC.yieldDistance) continue;
    const behind = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (behind < 0) return true;
  }
  return false;
}

export function updateTraffic(traffic, dt, city, random, player, allCars) {
  while (traffic.cars.length < TRAFFIC.cars) {
    spawnTrafficCar(traffic, city, random, player.x, player.y);
  }
  for (let i = traffic.cars.length - 1; i >= 0; i -= 1) {
    const car = traffic.cars[i];
    if (Math.hypot(car.x - player.x, car.y - player.y) > TRAFFIC.despawnDistance) {
      traffic.cars.splice(i, 1);
      continue;
    }
    const wp = car.waypoint;
    if (Math.hypot(wp.x - car.x, wp.y - car.y) < 46) {
      car.waypoint = pickNextWaypoint(city, random, wp, car.prevWaypoint);
      car.prevWaypoint = wp;
      continue;
    }
    const diff = angleDiff(Math.atan2(wp.y - car.y, wp.x - car.x), car.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const speed = carSpeed(car);
    let throttle = 0.7;
    if (Math.abs(diff) > 1.1) throttle = 0.25;
    if (speed > car.cruise) throttle = 0;
    if (car.backUp > 0) {
      // Backing out of a jam: reverse briefly, steering the other way.
      car.backUp -= dt;
      driveCar(car, dt, -0.8, -steer, false, city);
    } else if (sirenBehind(car, allCars)) {
      // Pull to the right and slow down for the law.
      driveCar(car, dt, 0.15, 0.6, false, city);
    } else {
      if (blockedAhead(car, allCars)) {
        throttle = 0;
        car.blocked = (car.blocked || 0) + dt;
        if (car.blocked > 2.5) {
          car.blocked = 0;
          car.backUp = 0.8;
        }
      } else {
        car.blocked = 0;
      }
      driveCar(car, dt, throttle, steer, false, city);
    }
    // A car wedged in a jam for too long gives up and reappears elsewhere,
    // so the streets never gridlock for good.
    if (speed < 20) {
      car.stuck = (car.stuck || 0) + dt;
      if (car.stuck > 3) traffic.cars.splice(i, 1);
    } else {
      car.stuck = 0;
    }
  }
  for (const car of traffic.parked) {
    if (car.driver !== 'player') coastCar(car, dt, city);
  }
  // A burnt wreck gets towed away after half a minute.
  for (let i = traffic.parked.length - 1; i >= 0; i -= 1) {
    const car = traffic.parked[i];
    if (!car.burnt) continue;
    car.wreckLife -= dt;
    if (car.wreckLife <= 0) traffic.parked.splice(i, 1);
  }
  // Cars bump into each other: traffic, cops and the player's ride alike.
  for (let i = 0; i < allCars.length; i += 1) {
    for (let j = i + 1; j < allCars.length; j += 1) {
      collideCarPair(allCars[i], allCars[j]);
    }
  }
}

// The nearest car the player could steal, parked or in traffic.
export function nearestStealable(traffic, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  const consider = (car) => {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  };
  for (const car of traffic.parked) {
    if (car.burnt) continue; // A burnt wreck is no ride at all.
    if (car.driver !== 'parked' && car.driver !== 'none') continue;
    consider(car);
  }
  for (const car of traffic.cars) consider(car);
  return best;
}
