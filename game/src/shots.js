// The screenshot scenes behind ?shot=chase|drive|foot|start. Each one plays
// the real rules forward from a fresh world for a few seconds, steered by a
// simple autopilot (hold the road ahead, swing around whatever is in front),
// so the frame is what a short game really looks like and the same seed
// always gives the same frame. The cover shot is the chase: four stars, a
// red Cometa, three Interceptors on its tail, a job running.

import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { enterCar, WEAPON_SCATTER } from './player.js';
import { fireSpread } from './combat.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const IDLE = {
  move: () => ({ x: 0, y: 0 }),
  throttle: () => 0,
  steer: () => 0,
  sprint: () => false,
  handbrake: () => false,
  mouse: { x: 0, y: 0, down: false },
};

// Drive the player's car down the road it is on, swinging into the next
// lane to pass whatever is ahead instead of stopping behind it.
function roadPilot(world) {
  const car = world.state.player.car;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let aimX = car.x + fx * 600;
  let aimY = car.y + fy * 600;
  let throttle = 0.85;
  const ahead = [...world.state.traffic.cars, ...world.state.police.copCars];
  for (const other of ahead) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * fx + dy * fy;
    const side = -dx * fy + dy * fx;
    if (forward <= 0 || forward >= 150 || Math.abs(side) >= 42) continue;
    // Overtake on the far side of the car ahead, staying on the asphalt.
    const dodge = Math.sign(side || 1);
    const perpX = -fy;
    const perpY = fx;
    aimX = car.x + fx * 260 - perpX * 38 * dodge;
    aimY = car.y + fy * 260 - perpY * 38 * dodge;
    throttle = 0.6;
    break;
  }
  let diff = Math.atan2(aimY - car.y, aimX - car.x) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    ...IDLE,
    throttle: () => throttle,
    steer: () => Math.max(-1, Math.min(1, diff * 2.2)),
    mouse: { x: 0, y: 0, down: false },
  };
}

// Take the parked and passing cars out of a stretch of road, so the staged
// drive has a clear run and the frame is not a traffic jam.
function clearCorridor(world, x0, x1, y, halfHeight) {
  const inside = (car) => car.x > x0 && car.x < x1 && Math.abs(car.y - y) < halfHeight;
  world.state.traffic.cars = world.state.traffic.cars.filter((car) => !inside(car));
  world.state.traffic.parked = world.state.traffic.parked.filter((car) => !inside(car) || car.driver === 'player');
}

function driveFor(world, seconds, corridor) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    // Keep the staged stretch clear: traffic keeps wandering into it.
    if (corridor) clearCorridor(world, corridor.x0, corridor.x1, corridor.y, corridor.halfHeight);
    const aim = { x: world.state.player.x + 400, y: world.state.player.y };
    world.step(STEP, roadPilot(world), 0, aim, null);
  }
  if (corridor) clearCorridor(world, corridor.x0, corridor.x1, corridor.y, corridor.halfHeight);
}

function stageChase(world) {
  // The cover: four stars, three cop cars on the player's tail, a mission
  // running, a red Cometa mid-drift down the avenue.
  world.reset();
  world.setMissionIndex(2);
  world.beginPlay();
  const player = world.state.player;
  const car = createCar('cometa', 500, 1400, 0, '#e74c3c', 'player');
  car.vx = 340;
  world.state.traffic.parked.push(car);
  enterCar(player, car);
  world.state.police.heat = 280;
  world.state.police.stars = 4;
  world.state.police.lastSeenAt = 0;
  const cops = [
    createCar('interceptor', 360, 1400, 0, '#f2f2f2', 'cop'),
    createCar('interceptor', 300, 1352, 0, '#f2f2f2', 'cop'),
    createCar('interceptor', 330, 1448, 0, '#f2f2f2', 'cop'),
  ];
  for (const cop of cops) cop.vx = 310;
  world.state.police.copCars.push(...cops);
  driveFor(world, 4, { x0: 400, x1: 2600, y: 1400, halfHeight: 90 });
  return { screen: SCREEN_PLAY, camera: null };
}

function stageDrive(world) {
  // A yellow taxi cruising the beachfront avenue, traffic and palms around.
  world.reset();
  world.beginPlay();
  const player = world.state.player;
  const car = createCar('taxi', 420, 2300, 0, '#f1c40f', 'player');
  car.vx = 300;
  world.state.traffic.parked.push(car);
  enterCar(player, car);
  driveFor(world, 3.5, { x0: 200, x1: 2800, y: 2300, halfHeight: 170 });
  // A peaceful cruise: any heat the drive picked up is wiped for the frame.
  world.state.police.heat = 0;
  world.state.police.stars = 0;
  world.state.police.copCars.length = 0;
  world.state.police.footCops.length = 0;
  return { screen: SCREEN_PLAY, camera: null };
}

function stageFoot(world) {
  // On foot on the avenue by the taxi stand, one star, a cop closing in
  // down the open road, a scattergun blast mid-flight.
  world.reset();
  world.beginPlay();
  const player = world.state.player;
  player.x = 820;
  player.y = 1000;
  player.weapon = WEAPON_SCATTER;
  world.state.police.footCops.push({
    x: 920,
    y: 1000,
    angle: Math.PI,
    speed: 245,
    health: 50,
    shootAt: 0,
    dead: false,
    downUntil: 0,
  });
  const car = createCar('duna', 880, 1040, 0, '#c0392b', 'parked');
  world.state.traffic.parked.push(car);
  const cop = world.state.police.footCops[0];
  // Walk west, away from the stand, so the pickup objective stays live.
  for (let i = 0; i < 0.5 / STEP; i += 1) {
    const input = {
      ...IDLE,
      move: () => ({ x: -0.6, y: 0 }),
      mouse: { x: 0, y: 0, down: false },
    };
    world.step(STEP, input, 0, { x: cop.x, y: cop.y }, null);
  }
  // A scattergun blast straight at the cop while he is closing in, so the
  // fan of tracers is mid-flight when the frame lands.
  const angle = Math.atan2(cop.y - player.y, cop.x - player.x);
  fireSpread(world.state.combat, player.x, player.y, angle, 'player', 16, 5, 0.22);
  for (let i = 0; i < 0.05 / STEP; i += 1) {
    world.step(STEP, IDLE, 0, { x: cop.x, y: cop.y }, null);
  }
  // The wanted level is set last, so the staged shots never raise it further.
  world.state.police.heat = 30;
  world.state.police.stars = 1;
  world.state.police.lastSeenAt = world.state.time;
  // Zoomed in: on foot, the people are the subject, not the whole street.
  return { screen: SCREEN_PLAY, camera: null, zoom: 1.35 };
}

function stageStart(world) {
  // The title screen over the beachfront: palms, sand and sea.
  world.reset();
  for (let i = 0; i < 3 / STEP; i += 1) {
    world.step(STEP, IDLE, 0, { x: 1700, y: 2250 }, null);
  }
  return { screen: SCREEN_TITLE, camera: { x: 1700, y: 2200 } };
}

export function stageShot(name, world) {
  if (name === 'chase') return stageChase(world);
  if (name === 'drive') return stageDrive(world);
  if (name === 'foot') return stageFoot(world);
  return stageStart(world);
}
