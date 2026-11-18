// world.js — builds the city of Solmara from a seed: the road grid, the
// districts, the buildings, the stadium, the harbor, the trees and lamps,
// and every collision and spawn helper the other systems use.

import { WORLD, ROAD_X, ROAD_Y, DISTRICTS, PALETTE } from './config.js';
import { makeRand, clamp, distance } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function isOnRoad(x, y, margin = 0) {
  const half = WORLD.roadWidth / 2 + margin;
  for (const rx of ROAD_X) {
    if (Math.abs(x - rx) <= half) return true;
  }
  for (const ry of ROAD_Y) {
    if (Math.abs(y - ry) <= half) return true;
  }
  return false;
}

export function isInWater(x, y) {
  return y > WORLD.waterLine;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y, vertical: true };
    }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x, y: ry, vertical: false };
    }
  }
  return best;
}

function blockRects() {
  const rects = [];
  for (let i = 0; i < ROAD_X.length - 1; i++) {
    for (let j = 0; j < ROAD_Y.length - 1; j++) {
      const x0 = ROAD_X[i] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const x1 = ROAD_X[i + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      const y0 = ROAD_Y[j] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const y1 = ROAD_Y[j + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      rects.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }
  return rects;
}

function buildBlockBuildings(rand, rect) {
  const district = districtAt(rect.cx, rect.cy);
  const buildings = [];
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  if (district.style === 'harbor') return buildings;

  if (district.style === 'downtown') {
    // One or two towers filling most of the block.
    const split = rand.chance(0.45);
    if (split && w > 180) {
      const cut = w * rand.float(0.42, 0.58);
      buildings.push(makeTower(rand, rect.x0 + 8, rect.y0 + 8, cut - 16, h - 16));
      buildings.push(makeTower(rand, rect.x0 + cut + 8, rect.y0 + 8, w - cut - 16, h - 16));
    } else {
      buildings.push(makeTower(rand, rect.x0 + 10, rect.y0 + 10, w - 20, h - 20));
    }
    return buildings;
  }

  if (district.style === 'stadium') {
    // The arena block stays open; a couple of low stands instead.
    if (rand.chance(0.6)) {
      buildings.push({
        x: rect.x0 + 20, y: rect.y0 + 20, w: w - 40, h: h - 40,
        roof: '#9aa5b1', floors: 1, style: 'stand', rot: 0,
      });
    }
    return buildings;
  }

  // Suburbs and marina: small houses, sometimes a park instead.
  if (rand.chance(0.22)) return buildings; // park block
  const cols = rand.int(1, 2);
  const rows = rand.int(1, 2);
  const cw = w / cols;
  const ch = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rand.chance(0.15)) continue;
      const bw = cw * rand.float(0.5, 0.68);
      const bh = ch * rand.float(0.5, 0.68);
      buildings.push({
        x: rect.x0 + c * cw + (cw - bw) / 2,
        y: rect.y0 + r * ch + (ch - bh) / 2,
        w: bw, h: bh,
        roof: rand.pick(PALETTE.roofSuburb),
        floors: rand.int(1, 2),
        style: 'house',
        rot: 0,
      });
    }
  }
  return buildings;
}

function makeTower(rand, x, y, w, h) {
  return {
    x, y, w, h,
    roof: rand.pick(PALETTE.roofDowntown),
    floors: rand.int(3, 9),
    style: 'tower',
    rot: 0,
  };
}

function buildTrees(rand, rects) {
  const trees = [];
  for (const rect of rects) {
    const district = districtAt(rect.cx, rect.cy);
    if (district.style === 'harbor') continue;
    const park = district.style === 'suburb' && rand.chance(0.3);
    const count = park ? rand.int(6, 12) : rand.int(0, 3);
    for (let i = 0; i < count; i++) {
      trees.push({
        x: rand.float(rect.x0 + 12, rect.x1 - 12),
        y: rand.float(rect.y0 + 12, rect.y1 - 12),
        r: rand.float(9, 15),
      });
    }
  }
  // Street trees along the marina and the beach promenade.
  for (let x = 120; x < WORLD.width - 100; x += 90) {
    if (rand.chance(0.7)) trees.push({ x: x + rand.float(-8, 8), y: 2400, r: rand.float(10, 14) });
  }
  return trees;
}

function buildLamps() {
  const lamps = [];
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y: ry - WORLD.roadWidth / 2 - 8 });
      lamps.push({ x: rx - WORLD.roadWidth / 2 - 8, y: ry + WORLD.roadWidth / 2 + 8 });
    }
  }
  return lamps;
}

function buildParkedSpots(rand) {
  const spots = [];
  for (const rx of ROAD_X) {
    for (let y = 300; y < WORLD.waterLine - 120; y += 180) {
      if (!rand.chance(0.5)) continue;
      const side = rand.chance(0.5) ? 1 : -1;
      spots.push({
        x: rx + side * (WORLD.roadWidth / 2 - 14),
        y: y + rand.float(-30, 30),
        angle: side > 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  }
  for (const ry of ROAD_Y) {
    for (let x = 300; x < WORLD.width - 100; x += 200) {
      if (!rand.chance(0.4)) continue;
      const side = rand.chance(0.5) ? 1 : -1;
      spots.push({
        x: x + rand.float(-30, 30),
        y: ry + side * (WORLD.roadWidth / 2 - 14),
        angle: side > 0 ? Math.PI : 0,
      });
    }
  }
  return spots;
}

export function buildCity(seed) {
  const rand = makeRand(seed);
  const rects = blockRects();
  const buildings = [];
  for (const rect of rects) {
    buildings.push(...buildBlockBuildings(rand, rect));
  }

  // The stadium: one big arena on the east side, drawn as a landmark.
  const stadium = { x: 2820, y: 460, w: 420, h: 300, roof: PALETTE.stadium, floors: 2, style: 'stadium', rot: 0 };
  buildings.push(stadium);
  // Remove any small buildings overlapping the arena footprint.
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b === stadium) continue;
    if (b.x < stadium.x + stadium.w && b.x + b.w > stadium.x &&
        b.y < stadium.y + stadium.h && b.y + b.h > stadium.y) {
      buildings.splice(i, 1);
    }
  }

  const trees = buildTrees(rand, rects);
  const lamps = buildLamps();
  const parkedSpots = buildParkedSpots(rand);

  // Harbor docks: piers reaching into the water, plus containers and cranes.
  const docks = [];
  for (let i = 0; i < 4; i++) {
    docks.push({ x: 420 + i * 820, y: WORLD.waterLine - 30, w: 150, h: 170 });
  }
  const containers = [];
  for (let i = 0; i < 18; i++) {
    containers.push({
      x: rand.float(120, WORLD.width - 200),
      y: rand.float(2160, 2380),
      w: rand.float(46, 70), h: 26,
      color: rand.pick(['#b03a2e', '#1e8449', '#2e86c1', '#b7950b', '#7d3c98']),
    });
  }

  // Named places the missions and the taxi system use.
  const places = {
    salGarage: { x: 1280, y: 920, label: "Sal's Garage" },
    harborWarehouse: { x: 920, y: 2200, label: 'Harbor Warehouse' },
    stadiumGate: { x: 3030, y: 820, label: 'Stadium Gate' },
    marinaPier: { x: 2720, y: 2360, label: 'Marina Pier' },
    downtownPlaza: { x: 1640, y: 1280, label: 'Downtown Plaza' },
    oldTownMarket: { x: 560, y: 560, label: 'Old Town Market' },
    southsideAlley: { x: 560, y: 2000, label: 'Southside Alley' },
    northLookout: { x: 2000, y: 200, label: 'North Lookout' },
    hospital: { x: 2000, y: 1640, label: 'Solmara General' },
    policeHQ: { x: 1640, y: 560, label: 'Police HQ' },
  };

  // Street vendors set up near busy spots.
  const vendorSpots = [
    { x: 1300, y: 1210, kind: 'tacos' },
    { x: 3030, y: 880, kind: 'dogs' },
    { x: 580, y: 620, kind: 'fruit' },
    { x: 2380, y: 2380, kind: 'ice' },
    { x: 1660, y: 1340, kind: 'coffee' },
  ];

  const city = {
    seed,
    buildings,
    trees,
    lamps,
    parkedSpots,
    docks,
    containers,
    stadium,
    places,
    vendorSpots,
  };
  return city;
}

// Push a circle out of every solid thing: buildings, water, world bounds.
// Returns the corrected position; the caller keeps its own velocity.
export function collideCircle(city, x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = clamp(nx, b.x, b.x + b.w);
    const cy = clamp(ny, b.y, b.y + b.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // Center inside the building: push out along the smallest overlap.
        const left = nx - b.x;
        const right = b.x + b.w - nx;
        const top = ny - b.y;
        const bottom = b.y + b.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = b.x - r;
        else if (m === right) nx = b.x + b.w + r;
        else if (m === top) ny = b.y - r;
        else ny = b.y + b.h + r;
      }
    }
  }
  // Containers are solid too.
  for (const c of city.containers) {
    const cx = clamp(nx, c.x, c.x + c.w);
    const cy = clamp(ny, c.y, c.y + c.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    }
  }
  if (ny + r > WORLD.waterLine) ny = WORLD.waterLine - r;
  nx = clamp(nx, r, WORLD.width - r);
  ny = clamp(ny, r, WORLD.height - r);
  return { x: nx, y: ny };
}

export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

// A point on a random road, with a heading along it, for spawning cars.
export function randomRoadPoint(rand) {
  if (rand.chance(0.5)) {
    const rx = rand.pick(ROAD_X);
    const y = rand.float(120, WORLD.waterLine - 160);
    return { x: rx, y, angle: rand.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }
  const ry = rand.pick(ROAD_Y);
  const x = rand.float(120, WORLD.width - 120);
  return { x, y: ry, angle: rand.chance(0.5) ? 0 : Math.PI };
}

// A point on a sidewalk beside a road, for spawning pedestrians.
export function randomSidewalkPoint(rand) {
  if (rand.chance(0.5)) {
    const rx = rand.pick(ROAD_X);
    const side = rand.chance(0.5) ? 1 : -1;
    return {
      x: rx + side * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2),
      y: rand.float(120, WORLD.waterLine - 160),
    };
  }
  const ry = rand.pick(ROAD_Y);
  const side = rand.chance(0.5) ? 1 : -1;
  return {
    x: rand.float(120, WORLD.width - 120),
    y: ry + side * (WORLD.roadWidth / 2 + WORLD.sidewalk / 2),
  };
}

export function randomDestination(rand, fromX, fromY, minDist = 700) {
  for (let i = 0; i < 24; i++) {
    const p = randomRoadPoint(rand);
    if (distance(p.x, p.y, fromX, fromY) >= minDist) return p;
  }
  return { x: 1640, y: 1280, angle: 0 };
}
