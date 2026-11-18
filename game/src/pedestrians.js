// Pedestrians: the people of Solmara. They walk the sidewalks, turn at
// crossings, pause now and then to look around, scatter when shots ring out,
// and go down when a car hits them. A few lie on the sand by the umbrellas,
// soaking up the sun until trouble finds them.

import { PEDS, PED_SHIRTS, ROADS } from './config.js';
import { randomRoadPoint, resolveCircle } from './city.js';

const SIDEWALK_OFFSET = ROADS.halfWidth + 13;

function randomSidewalkLine(random) {
  const side = random.sign();
  if (random.chance(0.5)) {
    const road = random.pick(ROADS.vertical);
    return { axis: 'v', road, side, x: road + side * SIDEWALK_OFFSET, y: random.range(80, 2320) };
  }
  const road = random.pick(ROADS.horizontal);
  return { axis: 'h', road, side, x: random.range(80, 3320), y: road + side * SIDEWALK_OFFSET };
}

function makePed(city, random, nearX, nearY) {
  const spot = randomRoadPoint(random, nearX, nearY, 120, PEDS.spawnDistance);
  const line = randomSidewalkLine(random);
  const ped = {
    x: spot.x,
    y: spot.y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(PEDS.walkMin, PEDS.walkMax),
    shirt: random.pick(PED_SHIRTS),
    axis: line.axis,
    road: line.road,
    side: line.side,
    dir: random.sign(),
    kind: 'walk',
    state: 'walk',
    fleeUntil: 0,
    downUntil: 0,
    idleUntil: 0,
    seed: random.range(0, 100),
  };
  snapToSidewalk(ped);
  return ped;
}

function snapToSidewalk(ped) {
  if (ped.axis === 'v') ped.x = ped.road + ped.side * SIDEWALK_OFFSET;
  else ped.y = ped.road + ped.side * SIDEWALK_OFFSET;
}

// Sunbathers: one per umbrella, lying still on the sand.
function makeSunbathers(city, random) {
  const out = [];
  const spots = [...city.umbrellas];
  for (let i = 0; i < PEDS.sunbathers && spots.length > 0; i += 1) {
    const spot = spots.splice(Math.floor(random.next() * spots.length), 1)[0];
    out.push({
      x: spot.x + 16,
      y: spot.y + 12,
      angle: spot.angle,
      speed: random.range(PEDS.walkMin, PEDS.walkMax),
      shirt: random.pick(PED_SHIRTS),
      axis: 'h',
      road: 2300,
      side: 1,
      dir: random.sign(),
      kind: 'sun',
      state: 'sun',
      fleeUntil: 0,
      downUntil: 0,
      idleUntil: 0,
      seed: random.range(0, 100),
    });
  }
  return out;
}

export function createPedestrians(city, random) {
  return { peds: makeSunbathers(city, random), city, random };
}

function maybeTurn(ped, random) {
  // At a crossing, sometimes turn onto the road that crosses this one.
  const crossings = ped.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
  const along = ped.axis === 'v' ? ped.y : ped.x;
  for (const c of crossings) {
    if (Math.abs(along - c) < 12 && random.chance(0.35)) {
      ped.axis = ped.axis === 'v' ? 'h' : 'v';
      ped.road = c;
      ped.side = random.sign();
      ped.dir = random.sign();
      snapToSidewalk(ped);
      return;
    }
  }
}

export function scarePeds(peds, x, y, radius, now) {
  for (const ped of peds.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) >= radius) continue;
    ped.kind = 'walk';
    ped.state = 'flee';
    ped.fleeUntil = now + 3;
    ped.fleeAngle = Math.atan2(ped.y - y, ped.x - x);
  }
}

// A car ran one down: they stay on the ground a while, then get up and run.
export function knockDown(ped, now) {
  if (ped.state === 'down') return;
  ped.kind = 'walk';
  ped.state = 'down';
  ped.downUntil = now + 4;
}

function walkStep(ped, dt) {
  const step = ped.speed * dt;
  if (ped.axis === 'v') {
    ped.y += ped.dir * step;
    if (ped.y < 40) { ped.y = 40; ped.dir = 1; }
    if (ped.y > 2340) { ped.y = 2340; ped.dir = -1; }
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ped.x += ped.dir * step;
    if (ped.x < 40) { ped.x = 40; ped.dir = 1; }
    if (ped.x > 3360) { ped.x = 3360; ped.dir = -1; }
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
  }
}

export function updatePedestrians(peds, dt, now, player) {
  const { city, random } = peds;
  let walkers = 0;
  for (const p of peds.peds) if (p.kind !== 'sun') walkers += 1;
  while (walkers < PEDS.count) {
    peds.peds.push(makePed(city, random, player.x, player.y));
    walkers += 1;
  }
  for (let i = peds.peds.length - 1; i >= 0; i -= 1) {
    const ped = peds.peds[i];
    const dPlayer = Math.hypot(ped.x - player.x, ped.y - player.y);
    // Sunbathers stay on their patch of sand; walkers recycle with distance.
    if (ped.kind !== 'sun' && dPlayer > PEDS.despawnDistance) {
      peds.peds.splice(i, 1);
      continue;
    }
    if (ped.state === 'sun') continue;
    if (ped.state === 'down') {
      if (now > ped.downUntil) {
        ped.state = 'flee';
        ped.fleeUntil = now + 2.5;
        ped.fleeAngle = Math.atan2(ped.y - player.y, ped.x - player.x);
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.x += Math.cos(ped.fleeAngle) * PEDS.fleeSpeed * dt;
      ped.y += Math.sin(ped.fleeAngle) * PEDS.fleeSpeed * dt;
      ped.angle = ped.fleeAngle;
      resolveCircle(city, ped, 10);
      if (now > ped.fleeUntil) {
        ped.state = 'walk';
        const spot = randomRoadPoint(random, ped.x, ped.y, 0, 200);
        ped.x = spot.x;
        ped.y = spot.y;
        snapToSidewalk(ped);
      }
      continue;
    }
    if (ped.state === 'idle') {
      if (now > ped.idleUntil) ped.state = 'walk';
      continue;
    }
    // Walking the sidewalk, with the odd pause to look around.
    walkStep(ped, dt);
    maybeTurn(ped, random);
    if (random.chance(PEDS.idleChance * dt)) {
      ped.state = 'idle';
      ped.idleUntil = now + random.range(PEDS.idleMin, PEDS.idleMax);
    }
    ped.x = Math.max(20, Math.min(3380, ped.x));
    ped.y = Math.max(20, Math.min(2500, ped.y));
  }
}
