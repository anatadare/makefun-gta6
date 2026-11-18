// SOLMARA's tuning table. Every number the game runs on lives here: the
// size of the world, the street grid, how Mars moves, every car in the
// roster, how the wanted level grows, the palette, and the clock that turns
// day into night. Nothing elsewhere hard-codes a speed, a price, a colour
// or an hour; change it here and the whole game follows.
//
// The world is 3400 x 2600 px. The camera shows a 1280 x 720 slice of it,
// scaled to the browser window. One game day lasts 8 real minutes, starting
// at 10 in the morning, so a long session sees dusk fall and the headlights
// come on.

export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3400, height: 2600 };

// Streets on a 400 px grid. The 2300 avenue runs along the beachfront,
// close enough to 2200 that no block fits between them.
export const ROADS = {
  vertical: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  horizontal: [200, 600, 1000, 1400, 1800, 2200, 2300],
  halfWidth: 55,
  sidewalk: 26,
};

// Sand, then open water, along the south edge of the map.
export const BEACH = { sandY: 2380, waterY: 2520 };

// The clock: how long a day lasts, and what time the story opens at.
export const DAY = { seconds: 480, startHour: 10 };

// The hour of day (0-24) at a given world time, in seconds.
export function hourOfDay(time) {
  const frac = (time / DAY.seconds) % 1;
  return (DAY.startHour + frac * 24) % 24;
}

// How dark it is, 0 at noon to 1 at midnight: 0 through the day, rising
// across dusk (17-19), full at night (19-6), falling across dawn (6-7).
export function nightFactor(time) {
  const h = hourOfDay(time);
  if (h >= 7 && h < 17) return 0;
  if (h >= 17 && h < 19) return (h - 17) / 2;
  if (h >= 19 || h < 6) return 1;
  return 1 - (h - 6);
}

// Mars on foot: fast enough to outrun a cop on a straight sprint, but a car
// is always the better escape.
export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.45,
  fireCooldown: 0.22,
  bulletSpeed: 900,
  bulletDamage: 34,
  regenDelay: 5,
  regenRate: 6,
  // The scattergun: five pellets in a fan, brutal up close, slow to reload.
  scatterCooldown: 0.7,
  scatterPellets: 5,
  scatterDamage: 16,
  scatterSpread: 0.22,
  scatterSpeed: 800,
  scatterLife: 0.6,
};

// Eight cars. speed is px/s, accel px/s^2; grip is how fast sideways slide
// dies. The Cometa is a muscle car: huge pull, loose tail. The taxi is the
// city's workhorse, everywhere at once.
export const CAR_TYPES = {
  duna: { name: 'Duna', kind: 'sedan', topSpeed: 400, accel: 300, reverse: 150, grip: 8.5, turn: 3.3, length: 52, width: 26 },
  brisa: { name: 'Brisa', kind: 'coupe', topSpeed: 460, accel: 350, reverse: 160, grip: 9.5, turn: 3.7, length: 50, width: 25 },
  tortuga: { name: 'Tortuga', kind: 'van', topSpeed: 330, accel: 230, reverse: 130, grip: 7.5, turn: 2.8, length: 58, width: 28 },
  fuego: { name: 'Fuego', kind: 'sports', topSpeed: 540, accel: 430, reverse: 170, grip: 10.5, turn: 4.0, length: 50, width: 25 },
  camino: { name: 'Camino', kind: 'pickup', topSpeed: 380, accel: 280, reverse: 150, grip: 8, turn: 3.2, length: 56, width: 27 },
  taxi: { name: 'Taxi', kind: 'taxi', topSpeed: 420, accel: 330, reverse: 160, grip: 9, turn: 3.5, length: 52, width: 26 },
  cometa: { name: 'Cometa', kind: 'muscle', topSpeed: 520, accel: 460, reverse: 160, grip: 7.5, turn: 3.4, length: 54, width: 27 },
  interceptor: { name: 'Interceptor', kind: 'police', topSpeed: 500, accel: 390, reverse: 170, grip: 10, turn: 3.8, length: 52, width: 26 },
};

export const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#e8e8e8', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#2c3e50'];
export const PED_SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];

// Traffic keeps a dozen cars near the player and a row of parked cars to steal.
export const TRAFFIC = {
  cars: 12,
  speedMin: 110,
  speedMax: 185,
  spawnDistance: 700,
  despawnDistance: 1100,
  parkedCars: 10,
  // A traffic car pulls over when a siren closes in behind it.
  yieldDistance: 210,
  yieldSide: 70,
};

export const PEDS = {
  count: 24,
  walkMin: 45,
  walkMax: 85,
  fleeSpeed: 260,
  spawnDistance: 650,
  despawnDistance: 1000,
  // Sunbathers lying on the sand by the umbrellas; they never despawn.
  sunbathers: 6,
  // Vendors who mind the market stalls, and joggers on the beachfront path.
  vendors: 4,
  joggers: 4,
  jogMin: 150,
  jogMax: 190,
  idleChance: 0.25,
  idleMin: 1,
  idleMax: 3.5,
};

// The wanted model: crimes add heat, stars are thresholds on the total.
export const POLICE = {
  crimeCarTheft: 35,
  crimeHitPed: 25,
  crimeKillPed: 50,
  crimeShoot: 15,
  crimeHitCop: 60,
  crimeKillCop: 120,
  starThresholds: [0, 30, 80, 160, 280, 450],
  maxStars: 5,
  copCarsByStars: [0, 1, 2, 3, 4, 5],
  footCopsByStars: [0, 1, 2, 2, 3, 4],
  heatDecayDelay: 6,
  heatDecayRate: 12,
  bustFillRate: 0.55,
  bustDrainRate: 0.8,
  copShootRange: 420,
  copShotDamage: 6,
  copShotCooldown: 0.9,
  // Pursuit craft: cops aim ahead of a moving target, and the lead grows
  // with the wanted level; close in, they swing for the rear quarter.
  leadBase: 0.35,
  leadPerStar: 0.12,
  pitRange: 115,
  pitOffset: 34,
  footSpeedBase: 245,
  footSpeedPerStar: 10,
  separation: 70,
  // At four stars the veterans take over: steadier aim, tighter groups.
  veteranStars: 4,
  spreadRookie: 0.35,
  spreadVeteran: 0.16,
};

// The story, in order. missions.js holds the steps; this is the short list.
export const MISSIONS = [
  { id: 'fare', title: 'First Fare', reward: 150 },
  { id: 'wheels', title: 'Hot Wheels', reward: 300 },
  { id: 'getaway', title: 'The Getaway', reward: 500 },
  { id: 'drops', title: 'Three Drops', reward: 700 },
  { id: 'delivery', title: 'The Last Delivery', reward: 800 },
  { id: 'sprint', title: 'The Solmara Sprint', reward: 1200 },
  { id: 'payback', title: 'Payback', reward: 1500 },
  { id: 'bigone', title: 'The Big One', reward: 2000 },
];

export const SAVE_KEY = 'solmara.save.v1';

// Drifting cloud shadows: big soft dark patches that crawl over the city.
export const CLOUDS = { count: 6, minR: 160, maxR: 300, speedMin: 6, speedMax: 14, alpha: 0.07 };

export const PALETTE = {
  backdrop: '#0d2b33',
  ground: '#d9c9a3',
  pavement: '#cbb98f',
  sidewalk: '#e6dcc3',
  road: '#3d3a38',
  roadEdge: '#565250',
  dash: '#f5d76e',
  crosswalk: '#e8e2d0',
  sand: '#f2dfa7',
  water: '#1fb6c9',
  wave: '#8fe6ef',
  grass: '#7cb35c',
  grassDark: '#679c4c',
  palmTrunk: '#8a6f4d',
  palmLeaf: '#3f9e4d',
  buildingRoof: '#8a6f4d',
  player: '#ff7a1a',
  playerDark: '#2c2c34',
  cop: '#3b7bff',
  copCar: '#f2f2f2',
  panel: 'rgba(10, 16, 22, 0.78)',
  panelEdge: 'rgba(255, 255, 255, 0.18)',
  text: '#ffffff',
  muted: '#cfd6dd',
  gold: '#ffd23f',
  red: '#ff5252',
  blue: '#4aa8ff',
  green: '#7ed957',
  marker: '#ffd23f',
};

export const BUILDING_COLORS = ['#f4a988', '#f7d794', '#a8d5ba', '#8fb8d8', '#d8a7c8', '#f2e3c9', '#e8b4b8', '#9ad1d4', '#f6c177', '#b8c4a8'];
export const STALL_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
