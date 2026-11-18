// Pedestrians: the people of Solmara. They walk the sidewalks, turn at
// crossings, pause now and then to look around, scatter when shots ring
// out, and go down when a car hits them. A few lie on the sand by the
// umbrellas, soaking up the sun until trouble finds them. The market
// stalls have vendors who mind their counters all day, and joggers run
// the beachfront path at a pace no walker keeps up with.

import { PEDS, PED_SHIRTS, ROADS } from './config.js';
import { randomRoadPoint, resolveCircle } from './city.js';

const SIDEWALK_OFFSET = ROADS.halfWidth + 13;

// Pick a sidewalk to walk: a road, a side of it, and a starting point.
function randomSidewalkLine(random) {
  const side = random.sign();
  if (random.chance(0.5)) {
    const road = random.pick(ROADS.vertical);
    return { axis: 'v', road, side, x: road + side * SIDEWALK_OFFSET, y: random.range(80, 2320) };
  }
  const road = random.pick(ROADS.horizontal);
  return { axis: 'h', road, side, x: random.range(80, 3320), y: road + side * SIDEWALK_OFFSET };
}

function basePed(random, x, y) {
  const angle = random.range(0, Math.PI * 2);
  const speed = random.range(PEDS.walkMin, PEDS.walkMax);
  const shirt = random.pick(PED_SHIRTS);
  const dir = random.sign();
  const seed = random.range(0, 100);
  return {
    x,
    y,
    angle,
    speed,
    shirt,
    axis: 'h',
    road: 2300,
    side: 1,
    dir,
    kind: 'walk',
    state: 'walk',
    fleeUntil: 0,
    downUntil: 0,
    idleUntil: 0,
    seed,
  };
}

function makePed(city, random, nearX, nearY) {
  const spot = randomRoadPoint(random, nearX, nearY, 120, PEDS.spawnDistance);
  const line = randomSidewalkLine(random);
  const ped = basePed(random, spot.x, spot.y);
  ped.axis = line.axis;
  ped.road = line.road;
  ped.side = line.side;
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
    const ped = basePed(random, spot.x + 16, spot.y + 12);
    ped.angle = spot.angle;
    ped.kind = 'sun';
    ped.state = 'sun';
    out.push(ped);
  }
  return out;
}

// Vendors: one behind each of the first few market stalls, minding the
// counter. They stand their ground until trouble scares them off.
function makeVendors(city, random) {
  const out = [];
  const market = city.blocks.find((b) => b.kind === 'market');
  if (!market || !market.stalls) return out;
  for (let i = 0; i < PEDS.vendors && i < market.stalls.length; i += 1) {
    const stall = market.stalls[i];
    const ped = basePed(random, stall.x + stall.w / 2, stall.y + stall.h + 14);
    ped.angle = -Math.PI / 2;
    ped.speed = 0;
    ped.kind = 'vendor';
    ped.state = 'idle';
    ped.idleUntil = Infinity;
    out.push(ped);
  }
  return out;
}

// Joggers: fast runners on the beachfront path, out for their morning run.
function makeJoggers(city, random) {
  const out = [];
  for (let i = 0; i < PEDS.joggers; i += 1) {
    const ped = basePed(random, random.range(120, 3280), 0);
    ped.axis = 'h';
    ped.road = 2300;
    ped.side = -1;
    ped.speed = random.range(PEDS.jogMin, PEDS.jogMax);
    ped.kind = 'jog';
    ped.state = 'walk';
    snapToSidewalk(ped);
    out.push(ped);
  }
  return out;
}

export function createPedestrians(city, random) {
  return {
    peds: [...makeSunbathers(city, random), ...makeVendors(city, random), ...makeJoggers(city, random)],
    city,
    random,
  };
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
    if (ped.y < 40) {
      ped.y = 40;
      ped.dir = 1;
    }
    if (ped.y > 2340) {
      ped.y = 2340;
      ped.dir = -1;
    }
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ped.x += ped.dir * step;
    if (ped.x < 40) {
      ped.x = 40;
      ped.dir = 1;
    }
    if (ped.x > 3360) {
      ped.x = 3360;
      ped.dir = -1;
    }
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
  }
}

export function updatePedestrians(peds, dt, now, player) {
  const { city, random } = peds;
  let walkers = 0;
  for (const p of peds.peds) {
    if (p.kind === 'walk' || p.kind === 'jog') walkers += 1;
  }
  while (walkers < PEDS.count) {
    peds.peds.push(makePed(city, random, player.x, player.y));
    walkers += 1;
  }
  for (let i = peds.peds.length - 1; i >= 0; i -= 1) {
    const ped = peds.peds[i];
    const dPlayer = Math.hypot(ped.x - player.x, ped.y - player.y);
    // Sunbathers and vendors stay on their patch; walkers recycle with distance.
    if (ped.kind !== 'sun' && ped.kind !== 'vendor' && dPlayer > PEDS.despawnDistance) {
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
      // A vendor's idle never ends on its own: they mind the stall.
      if (now > ped.idleUntil) ped.state = 'walk';
      continue;
    }
    // Walking the sidewalk, with the odd pause to look around. Joggers
    // never pause: the run is the point.
    walkStep(ped, dt);
    maybeTurn(ped, random);
    if (ped.kind !== 'jog' && random.chance(PEDS.idleChance * dt)) {
      ped.state = 'idle';
      ped.idleUntil = now + random.range(PEDS.idleMin, PEDS.idleMax);
    }
    ped.x = Math.max(20, Math.min(3380, ped.x));
    ped.y = Math.max(20, Math.min(2500, ped.y));
  }
}
