// shots.js — deterministic scenes for the entry's screenshots. A URL like
// ?shot=chase starts the game straight into a staged moment (a police
// chase, a taxi fare, a shootout) so the screenshots show the real game,
// its HUD and its systems, with no hand editing afterwards.

import { MISSIONS, spawnEnemies } from './missions.js';
import { createVehicle } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

export const SHOT_NAMES = ['title', 'drive', 'foot', 'chase'];

function putPlayerInCar(state, type, x, y, angle, speed) {
  const car = createVehicle(type, x, y, angle, { driver: 'player' });
  car.headlights = true;
  car.speed = speed || 0;
  state.cars.push(car);
  state.player.onFoot = false;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

export function applyShot(state, name) {
  state.message = null;
  state.prompt = '';
  if (name === 'title') {
    state.mode = 'title';
    return true;
  }
  state.mode = 'playing';

  if (name === 'drive') {
    // Daytime taxi fare through downtown, traffic all around.
    state.clock = 10.2;
    putPlayerInCar(state, 'taxi', 920, 1280, 0, 320);
    state.taxi.active = true;
    state.taxi.passenger = null;
    state.taxi.dest = { x: 3030, y: 820 };
    state.taxi.fare = 22;
    state.taxi.rush = false;
    state.objective = 'Fare: take them to the Stadium Gate';
    state.money = 486;
    return true;
  }

  if (name === 'foot') {
    // On foot at the stadium gate, scattergun out, Venn's crew closing in.
    state.clock = 15.0;
    state.player.x = 2960;
    state.player.y = 900;
    state.player.onFoot = true;
    state.player.car = null;
    state.weapon = 'scattergun';
    state.ammo = 24;
    state.health = 100;
    const def = MISSIONS[6];
    state.mission = { def, stepIndex: 0, killsLeft: 4, startedAt: state.time };
    state.objective = def.steps[0].label;
    spawnEnemies(state, def.steps[0]);
    for (const e of state.enemies) e.alerted = true;
    state.aimAngle = Math.atan2(state.enemies[0].y - state.player.y, state.enemies[0].x - state.player.x);
    scarePeds(state, state.player.x, state.player.y, 300);
    return true;
  }

  if (name === 'chase') {
    // Dusk getaway: three stars, interceptors on the tail, downtown.
    state.clock = 18.4;
    putPlayerInCar(state, 'cometa', 1500, 1280, 0, 430);
    state.wanted = 3;
    state.stats.maxWanted = 3;
    const def = MISSIONS[5];
    state.mission = { def, stepIndex: 1, killsLeft: 0, startedAt: state.time };
    state.objective = def.steps[1].label;
    const spots = [
      { type: 'cruiser', x: 1290, y: 1240, angle: 0 },
      { type: 'cruiser', x: 1330, y: 1330, angle: 0 },
      { type: 'veteran', x: 1180, y: 1280, angle: 0 },
    ];
    for (const s of spots) {
      const car = createVehicle(s.type, s.x, s.y, s.angle, { driver: 'police' });
      car.headlights = true;
      car.speed = 420;
      car.veteran = s.type === 'veteran';
      state.cars.push(car);
    }
    state.money = 1240;
    return true;
  }

  return false;
}
