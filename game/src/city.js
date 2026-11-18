// Solmara's city, grown from a seed: streets on a grid, blocks holding
// buildings, a park, a plaza, the docks, a market and a stadium, palms
// along the walks, umbrellas on the sand. The generator runs once per
// world; every other module asks this one where things are and what is
// solid. The generator draws from the seeded stream in a fixed order, so
// the same seed always grows the same city.

import { BEACH, BUILDING_COLORS, ROADS, STALL_COLORS, WORLD } from './config.js';

// Named places, all on roads, so a mission marker is somewhere a car can go.
export const PLACES = {
  start: { x: 1000, y: 1400, label: 'Downtown' },
  taxiStand: { x: 1000, y: 960, label: 'Taxi Stand' },
  marinaHotel: { x: 2600, y: 2300, label: 'Marina Hotel' },
  garage: { x: 600, y: 1800, label: "Otis's Garage" },
  docks: { x: 200, y: 2200, label: 'The Docks' },
  hideout: { x: 3000, y: 200, label: 'Palm Heights Hideout' },
  policeStation: { x: 1400, y: 600, label: 'Police Station' },
  hospital: { x: 2200, y: 1000, label: 'Solmara General' },
  beach: { x: 1800, y: 2440, label: 'Seabreeze Beach' },
  stadium: { x: 2600, y: 800, label: 'Solmara Stadium' },
};

// Eight hidden cash stashes, $100 each, at fixed spots for explorers.
// The order matters: saves remember found stashes by index.
export const STASHES = [
  { x: 1560, y: 1160 },
  { x: 480, y: 2050 },
  { x: 1500, y: 2460 },
  { x: 1250, y: 850 },
  { x: 3050, y: 250 },
  { x: 2250, y: 950 },
  { x: 1350, y: 650 },
  { x: 2550, y: 2250 },
];

const KERB = ROADS.halfWidth + ROADS.sidewalk;

// The special blocks: park, plaza, docks, market and stadium, keyed by
// the crossing at the block's top-left corner.
const SPECIAL_BLOCKS = {
  '1400,1000': 'park',
  '1000,600': 'plaza',
  '200,1800': 'docks',
  '2200,1400': 'market',
  '2600,600': 'stadium',
};

// One block's inner rectangle, inside the sidewalks.
function blockInner(x0, x1, y0, y1) {
  return {
    x: x0 + KERB,
    y: y0 + KERB,
    w: x1 - x0 - KERB * 2,
    h: y1 - y0 - KERB * 2,
  };
}

// How a block's buildings are laid out: one big footprint, two side by
// side, or four in quadrants. Each cell is [x, y, w, h] in fractions.
const LAYOUTS = [
  [[0, 0, 1, 1]],
  [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
];

// Fill a block with buildings on a jittered sub-grid.
function placeBuildings(random, rect, seedBase) {
  const out = [];
  const inset = 14;
  const gap = 12;
  const height = random.int(1, 3);
  const cells = LAYOUTS[random.int(0, 2)];
  for (let i = 0; i < cells.length; i += 1) {
    const [cx, cy, cw, ch] = cells[i];
    const baseW = rect.w * cw - inset * 2 - gap * (cw < 1 ? 0.5 : 0);
    const baseH = rect.h * ch - inset * 2 - gap * (ch < 1 ? 0.5 : 0);
    out.push({
      x: rect.x + rect.w * cx + inset + (cx > 0 ? gap / 2 : 0),
      y: rect.y + rect.h * cy + inset + (cy > 0 ? gap / 2 : 0),
      w: baseW * random.range(0.85, 1),
      h: baseH * random.range(0.7, 1),
      color: random.pick(BUILDING_COLORS),
      seed: seedBase + i,
      height,
    });
  }
  return out;
}

// Crates stacked around the docks: cover in a shootout, solid to a car.
function stackCrates(random, rect) {
  const colors = ['#b5651d', '#5d7fa3', '#7a9b57', '#a35d8c'];
  const crates = [];
  for (let i = 0; i < 9; i += 1) {
    crates.push({
      x: rect.x + 16 + random.range(0, Math.max(1, rect.w - 70)),
      y: rect.y + 16 + random.range(0, Math.max(1, rect.h - 70)),
      w: random.range(28, 52),
      h: random.range(28, 52),
      color: random.pick(colors),
    });
  }
  return crates;
}

// Market stalls: two rows of little awnings with a walkway between them.
function setUpStalls(random, rect) {
  const stalls = [];
  const cols = 4;
  const rows = 2;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      stalls.push({
        x: rect.x + 20 + c * ((rect.w - 40) / cols) + random.range(-4, 4),
        y: rect.y + 24 + r * ((rect.h - 60) / Math.max(1, rows - 1)) + random.range(-4, 4),
        w: (rect.w - 40) / cols - 18,
        h: 30,
        color: random.pick(STALL_COLORS),
      });
    }
  }
  return stalls;
}

// The stadium: an oval running track around a green pitch, with stands on
// the long sides. The track is flat ground (cars can cut across it); the
// stands are solid.
function layOutStadium(rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const track = { x: cx, y: cy, rx: rect.w / 2 - 8, ry: rect.h / 2 - 8 };
  const pitch = { x: cx, y: cy, rx: track.rx * 0.62, ry: track.ry * 0.55 };
  const stands = [
    { x: rect.x + 14, y: rect.y + 10, w: rect.w - 28, h: 22 },
    { x: rect.x + 14, y: rect.y + rect.h - 32, w: rect.w - 28, h: 22 },
  ];
  return { track, pitch, stands };
}

function plantPalms(random, rect, count, palms) {
  for (let i = 0; i < count; i += 1) {
    palms.push({
      x: rect.x + random.range(14, Math.max(15, rect.w - 14)),
      y: rect.y + random.range(14, Math.max(15, rect.h - 14)),
      s: random.range(0.8, 1.2),
    });
  }
}

export function buildCity(random) {
  const blocks = [];
  const buildings = [];
  const palms = [];
  const verticals = ROADS.vertical;
  // The 2300 avenue sits too close to 2200 for a block between them, so
  // streets closer than 200 apart collapse into one.
  const horizontals = [];
  for (const y of ROADS.horizontal) {
    if (horizontals.length === 0 || y - horizontals[horizontals.length - 1] >= 200) {
      horizontals.push(y);
    }
  }

  let index = 0;
  for (let vi = 0; vi < verticals.length - 1; vi += 1) {
    for (let hi = 0; hi < horizontals.length - 1; hi += 1) {
      const vx = verticals[vi];
      const hy = horizontals[hi];
      const rect = blockInner(vx, verticals[vi + 1], hy, horizontals[hi + 1]);
      if (rect.w < 120 || rect.h < 120) continue;
      index += 1;
      const kind = SPECIAL_BLOCKS[`${vx},${hy}`] || 'buildings';
      const block = { ...rect, kind, index };
      if (kind === 'park') {
        block.pond = { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.55, r: 42 };
        plantPalms(random, rect, 7, palms);
      } else if (kind === 'plaza') {
        block.fountain = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, r: 30 };
        plantPalms(random, rect, 6, palms);
      } else if (kind === 'docks') {
        block.crates = stackCrates(random, rect);
      } else if (kind === 'market') {
        block.stalls = setUpStalls(random, rect);
        plantPalms(random, rect, 3, palms);
      } else if (kind === 'stadium') {
        const ground = layOutStadium(rect);
        block.track = ground.track;
        block.pitch = ground.pitch;
        block.stands = ground.stands;
        plantPalms(random, rect, 2, palms);
      } else {
        block.buildings = placeBuildings(random, rect, index * 7 + 1);
        buildings.push(...block.buildings);
      }
      blocks.push(block);
    }
  }

  // Palms along both sidewalks of every street, skipping the crossings.
  for (const x of verticals) {
    for (let y = 120; y < WORLD.height - 200; y += 150) {
      if (horizontals.some((h) => Math.abs(h - y) < 90)) continue;
      for (const side of [-1, 1]) {
        if (random.chance(0.6)) {
          palms.push({
            x: x + side * (ROADS.halfWidth + 13),
            y: y + random.range(-20, 20),
            s: random.range(0.8, 1.15),
          });
        }
      }
    }
  }
  for (let x = 80; x < WORLD.width; x += 130) {
    palms.push({
      x: x + random.range(-20, 20),
      y: BEACH.sandY + 26,
      s: random.range(0.9, 1.3),
    });
  }

  // Beach umbrellas and towels scattered down the sand.
  const umbrellas = [];
  const umbrellaColors = ['#ff5a5a', '#5a9bff', '#ffd23f', '#5ad67a', '#c95aff', '#ff8a3d'];
  let ux = 100;
  while (ux < WORLD.width - 60) {
    umbrellas.push({
      x: ux + random.range(-30, 30),
      y: BEACH.sandY + random.range(50, BEACH.waterY - BEACH.sandY - 40),
      color: random.pick(umbrellaColors),
      angle: random.range(0, Math.PI * 2),
    });
    ux += random.range(140, 260);
  }

  const intersections = [];
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) intersections.push({ x, y });
  }

  // Every solid rectangle, flattened once: collision checks run hot.
  const solids = [...buildings];
  for (const block of blocks) {
    if (block.crates) solids.push(...block.crates);
    if (block.stalls) solids.push(...block.stalls);
    if (block.stands) solids.push(...block.stands);
  }

  return { blocks, buildings, palms, umbrellas, intersections, places: PLACES, solids };
}

export function isWater(x, y) {
  return y >= BEACH.waterY;
}

export function pointOnRoad(city, x, y) {
  const hw = ROADS.halfWidth;
  for (const rx of ROADS.vertical) {
    if (x >= rx - hw && x <= rx + hw && y >= 0 && y <= WORLD.height) return true;
  }
  for (const ry of ROADS.horizontal) {
    if (y >= ry - hw && y <= ry + hw && x >= 0 && x <= WORLD.width) return true;
  }
  return false;
}

export function circleHitsSolid(city, x, y, r) {
  for (const b of city.solids) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of solid rectangles, the water and the world edge.
// Returns the push direction {nx, ny} when anything pushed back, else null.
export function resolveCircle(city, entity, r) {
  let pushed = null;
  const solid = circleHitsSolid(city, entity.x, entity.y, r);
  if (solid) {
    const cx = Math.max(solid.x, Math.min(entity.x, solid.x + solid.w));
    const cy = Math.max(solid.y, Math.min(entity.y, solid.y + solid.h));
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      // Dead centre inside the box: leave by the nearest face.
      const left = entity.x - solid.x;
      const right = solid.x + solid.w - entity.x;
      const top = entity.y - solid.y;
      const bottom = solid.y + solid.h - entity.y;
      const nearest = Math.min(left, right, top, bottom);
      if (nearest === left) {
        entity.x = solid.x - r;
        pushed = { nx: -1, ny: 0 };
      } else if (nearest === right) {
        entity.x = solid.x + solid.w + r;
        pushed = { nx: 1, ny: 0 };
      } else if (nearest === top) {
        entity.y = solid.y - r;
        pushed = { nx: 0, ny: -1 };
      } else {
        entity.y = solid.y + solid.h + r;
        pushed = { nx: 0, ny: 1 };
      }
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      entity.x = cx + nx * r;
      entity.y = cy + ny * r;
      pushed = { nx, ny };
    }
  }
  // The water and the world edge clamp the position too, but only the
  // first push of the step is reported back.
  if (entity.y + r > BEACH.waterY) {
    entity.y = BEACH.waterY - r;
    if (!pushed) pushed = { nx: 0, ny: -1 };
  }
  if (entity.x - r < 0) {
    entity.x = r;
    if (!pushed) pushed = { nx: 1, ny: 0 };
  }
  if (entity.x + r > WORLD.width) {
    entity.x = WORLD.width - r;
    if (!pushed) pushed = { nx: -1, ny: 0 };
  }
  if (entity.y - r < 0) {
    entity.y = r;
    if (!pushed) pushed = { nx: 0, ny: 1 };
  }
  return pushed;
}

export function nearestIntersection(city, x, y) {
  let best = city.intersections[0];
  let bestD = Infinity;
  for (const p of city.intersections) {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// A random point on a road, within a ring around (cx, cy). After a few
// misses it gives up and returns the nearest crossing instead.
export function randomRoadPoint(random, cx, cy, minDist, maxDist) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let x;
    let y;
    if (random.chance(0.5)) {
      x = random.pick(ROADS.vertical);
      y = random.range(60, WORLD.height - 260);
    } else {
      x = random.range(60, WORLD.width - 60);
      y = random.pick(ROADS.horizontal);
    }
    const d = Math.hypot(x - cx, y - cy);
    if (d >= minDist && d <= maxDist) return { x, y };
  }
  let best = null;
  let bestD = Infinity;
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}
