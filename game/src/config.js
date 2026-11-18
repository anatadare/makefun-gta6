// config.js — every tuning number, color and vehicle definition for Solmara.
// One place for the constants the other modules share, so balancing the game
// never means hunting through the systems that use them.

export const VIEW = { width: 1280, height: 720 };

export const WORLD = {
  width: 3600,
  height: 2700,
  roadGap: 360,
  roadWidth: 76,
  sidewalk: 14,
  waterLine: 2520,
  beachLine: 2440,
};

// The road grid: vertical roads at these x centers, horizontal at these y centers.
export const ROAD_X = [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080, 3440];
export const ROAD_Y = [200, 560, 920, 1280, 1640, 2000, 2360];

export const DEFAULT_SEED = 1337;
export const SAVE_KEY = 'solmara-save-v1';

// A game hour passes every 60 real seconds; N skips ahead two hours.
export const SECONDS_PER_GAME_HOUR = 60;
export const TIME_SKIP_HOURS = 2;

// Day phases drive the sky tint, the streetlights and the headlights.
export const DAY = {
  dawnStart: 5.5,
  dayStart: 7.5,
  duskStart: 17.5,
  nightStart: 19.5,
  nightEnd: 5.5,
};

export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 265,
  accel: 1400,
  friction: 9,
  radius: 13,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchArc: 1.15,
  punchCooldown: 0.38,
  enterCarRange: 56,
  interactRange: 70,
};

export const VEHICLE_TYPES = {
  sedan: {
    label: 'Sedan', length: 46, width: 22, topSpeed: 520, accel: 300,
    reverseSpeed: 170, grip: 5.2, turnRate: 2.5, mass: 1.0,
    colors: ['#c94f3d', '#3d6fc9', '#c9c9c9', '#3d3d3d', '#4f8a4f', '#c9a23d'],
  },
  hatch: {
    label: 'Hatchback', length: 40, width: 21, topSpeed: 470, accel: 320,
    reverseSpeed: 160, grip: 5.6, turnRate: 2.8, mass: 0.9,
    colors: ['#7fb3d5', '#e08e79', '#a9dfbf', '#f9e79f', '#d2b4de'],
  },
  taxi: {
    label: 'Taxi', length: 46, width: 22, topSpeed: 500, accel: 300,
    reverseSpeed: 170, grip: 5.2, turnRate: 2.5, mass: 1.0,
    colors: ['#f5c518'],
  },
  cometa: {
    label: 'Cometa', length: 48, width: 23, topSpeed: 680, accel: 420,
    reverseSpeed: 190, grip: 4.4, turnRate: 2.3, mass: 1.1,
    colors: ['#8e1f2f', '#1f2a8e', '#101010', '#e8e8e8'],
  },
  van: {
    label: 'Van', length: 54, width: 24, topSpeed: 400, accel: 230,
    reverseSpeed: 140, grip: 5.8, turnRate: 2.0, mass: 1.4,
    colors: ['#e8e8e8', '#5d6d7e', '#7e5109'],
  },
  truck: {
    label: 'Truck', length: 62, width: 26, topSpeed: 360, accel: 200,
    reverseSpeed: 130, grip: 6.0, turnRate: 1.8, mass: 1.8,
    colors: ['#b03a2e', '#1e8449', '#2e4053'],
  },
  cruiser: {
    label: 'Police Cruiser', length: 47, width: 23, topSpeed: 600, accel: 380,
    reverseSpeed: 180, grip: 5.0, turnRate: 2.6, mass: 1.1,
    colors: ['#f2f3f4'],
  },
  veteran: {
    label: 'Veteran Interceptor', length: 48, width: 23, topSpeed: 720, accel: 470,
    reverseSpeed: 200, grip: 4.6, turnRate: 2.5, mass: 1.1,
    colors: ['#14181d'],
  },
};

export const WEAPONS = {
  fists: { label: 'Fists', damage: 12, range: 34, cooldown: 0.38, ammo: Infinity },
  scattergun: {
    label: 'Scattergun', damage: 11, pellets: 6, spread: 0.34,
    range: 300, cooldown: 0.85, ammo: 24, maxAmmo: 48,
  },
};

export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPed: 1,
  killPed: 2,
  shootNearCop: 1,
  killCop: 1,
  // Seconds out of every cop's sight before a star fades.
  decayDelay: 9,
  decayInterval: 8,
  sightRange: 620,
  bustedRange: 42,
  bustedTime: 2.0,
};

export const COPS = {
  maxCars: 6,
  maxFoot: 4,
  spawnDistance: 700,
  despawnDistance: 1100,
  ramDamage: 6,
  shootRange: 320,
  shootCooldown: 1.1,
  shootDamage: 5,
  veteranAtStars: 4,
  footCopHealth: 40,
  carHealth: 100,
};

export const TRAFFIC = {
  count: 16,
  speedMin: 130,
  speedMax: 210,
  followGap: 70,
};

export const PEDS = {
  count: 42,
  walkMin: 34,
  walkMax: 62,
  jogSpeed: 150,
  fleeSpeed: 190,
  fleeRadius: 220,
};

export const TAXI = {
  fareMin: 8,
  fareMax: 25,
  rushChance: 0.35,
  rushBonusMin: 30,
  rushBonusMax: 60,
  rushTimePerPx: 0.0042,
  waitRadius: 900,
};

export const ECONOMY = {
  startMoney: 150,
  bustedFine: 60,
  wastedBill: 80,
  ammoPickup: 12,
  healthPickup: 35,
};

export const MISSION_REWARDS = [150, 200, 250, 300, 350, 400, 500, 2000];

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1000, y1: 1000, style: 'suburb' },
  { name: 'Northgate', x0: 1000, y0: 0, x1: 2600, y1: 300, style: 'suburb' },
  { name: 'Uptown', x0: 2600, y0: 0, x1: 3600, y1: 300, style: 'suburb' },
  { name: 'Westside', x0: 0, y0: 1000, x1: 1000, y1: 1600, style: 'suburb' },
  { name: 'Downtown', x0: 1000, y0: 300, x1: 2300, y1: 1600, style: 'downtown' },
  { name: 'Stadium District', x0: 2600, y0: 300, x1: 3600, y1: 1100, style: 'stadium' },
  { name: 'Eastside', x0: 2300, y0: 300, x1: 3600, y1: 1600, style: 'suburb' },
  { name: 'Harbor', x0: 0, y0: 2100, x1: 3600, y1: 2700, style: 'harbor' },
  { name: 'Southside', x0: 0, y0: 1600, x1: 1100, y1: 2100, style: 'suburb' },
  { name: 'Midtown', x0: 1100, y0: 1600, x1: 2300, y1: 2100, style: 'suburb' },
  { name: 'Marina Bay', x0: 2300, y0: 1600, x1: 3600, y1: 2100, style: 'marina' },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e8d9a0',
  water: '#2e6f9e',
  waterDeep: '#245a82',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  lane: '#d8d8d8',
  sidewalk: '#9aa0a6',
  block: '#8a8f7a',
  roofDowntown: ['#7d8590', '#6b7a8d', '#8d8578', '#5d6d7e'],
  roofSuburb: ['#a0522d', '#8b4513', '#6e7f80', '#b5651d'],
  stadium: '#c9c9c9',
  stadiumTrim: '#2e86c1',
  dock: '#8d6e63',
  tree: '#2f7d32',
  treeDark: '#256b29',
  lampGlow: 'rgba(255, 214, 120, 0.55)',
};

export const CONTROLS = [
  ['W A S D / Arrows', 'Move / drive'],
  ['Shift', 'Sprint on foot / handbrake in car'],
  ['E', 'Enter / exit car, interact, advance dialogue'],
  ['Space', 'Melee attack / handbrake'],
  ['Q', 'Swap weapon (fists / scattergun)'],
  ['Mouse click / F', 'Shoot'],
  ['N', 'Skip time +2 hours'],
  ['M', 'Mute sound'],
  ['P / Esc', 'Pause'],
];

export const STORY = {
  playerName: 'Riko Vale',
  fixerName: 'Sal Ferraro',
  rivalName: 'Dario Venn',
  cityName: 'Solmara',
};
