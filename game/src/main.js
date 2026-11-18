// main.js — the game itself: state, the frame loop, mode transitions
// (title, playing, dialogue, pause, wasted, busted, complete), menu input,
// prompts, events and the debug hook the playtests use.

import { VIEW, DEFAULT_SEED, SECONDS_PER_GAME_HOUR, ECONOMY, PLAYER } from './config.js';
import { makeRand, distance } from './random.js';
import { buildCity } from './world.js';
import * as worldMod from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createVehicle } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import * as police from './police.js';
import * as combat from './combat.js';
import { createPlayer, updatePlayer, nearestCar, exitCar } from './player.js';
import * as missions from './missions.js';
import * as save from './save.js';
import { createTaxiState, updateTaxi, spawnPassengers, waitingPassengerNear } from './taxi.js';
import { drawWorld, updateCamera } from './render.js';
import { drawHUD, drawDialogue, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const sharedInput = createInput();
sharedInput.attach();
const sharedAudio = createAudio();

function createState(seed) {
  const city = buildCity(seed);
  const rand = makeRand(seed + 4242);
  const state = {
    seed,
    rand,
    city,
    time: 0,
    clock: 9.0,
    money: ECONOMY.startMoney,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    weapon: 'fists',
    ammo: 0,
    player: createPlayer(1280, 1000),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    camera: { x: 640, y: 640, sx: 0, sy: 0 },
    mission: null,
    missionsDone: [],
    taxi: createTaxiState(),
    stats: {
      playTime: 0, moneyEarned: 0, distance: 0, carsStolen: 0,
      shotsFired: 0, kills: 0, missionsDone: 0, maxWanted: 0,
    },
    mode: 'title',
    endKind: null,
    dialogue: null,
    message: null,
    objective: '',
    prompt: '',
    events: [],
    input: sharedInput,
    audio: sharedAudio,
    fx: createEffects(),
    mouseWorld: { x: 0, y: 0 },
    aimAngle: -Math.PI / 2,
    uiButtons: [],
    showHelp: false,
    // Module namespaces the systems reach through state, so no module
    // has to import the ones that import it.
    world: worldMod,
    combat,
    police,
    missions,
    save,
  };

  // Parked cars along the curbs.
  const spots = [...city.parkedSpots];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const parkedTypes = ['sedan', 'sedan', 'hatch', 'hatch', 'van', 'truck'];
  let placed = 0;
  for (const spot of spots) {
    if (placed >= 26) break;
    if (!rand.chance(0.55)) continue;
    let type = rand.pick(parkedTypes);
    if (placed === 3) type = 'cometa';
    if (placed === 7 || placed === 8) type = 'taxi';
    const car = createVehicle(type, spot.x, spot.y, spot.angle, { driver: 'parked' });
    state.cars.push(car);
    placed += 1;
  }
  // A Cometa muscle car waits by the stadium for whoever finds it.
  state.cars.push(createVehicle('cometa', 2990, 860, Math.PI / 2, { driver: 'parked' }));

  state.cars.push(...spawnTraffic(city, seed, 16));
  state.peds.push(...spawnPeds(city, seed));
  spawnPassengers(state, 5);
  return state;
}

let state = createState(DEFAULT_SEED);

// URL params: ?seed= for a different city, ?shot= for a staged screenshot.
const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
if (Number.isFinite(seedParam)) {
  state = createState(seedParam);
}
const shotParam = params.get('shot');
if (shotParam) {
  applyShot(state, shotParam);
}

window.__solmara = {
  get state() {
    return state;
  },
  version: 1,
};

function updateMouse() {
  const rect = canvas.getBoundingClientRect();
  const sx = VIEW.width / rect.width;
  const sy = VIEW.height / rect.height;
  const m = state.input.mouse;
  m.canvasX = (m.x - rect.left) * sx;
  m.canvasY = (m.y - rect.top) * sy;
  state.mouseWorld.x = m.canvasX + state.camera.x - state.camera.sx;
  state.mouseWorld.y = m.canvasY + state.camera.y - state.camera.sy;
}

function newGame() {
  const seed = state.seed;
  state = createState(seed);
  state.mode = 'playing';
  state.message = { text: 'Welcome to Solmara. Find the gold ! marker to start.', timer: 5 };
  state.audio.missionStart();
}

function continueGame() {
  const data = save.loadSave();
  if (!data) return;
  state = createState(state.seed);
  save.applySave(state, data);
  state.mode = 'playing';
  state.message = { text: 'Welcome back to Solmara.', timer: 3 };
}

function quitToTitle() {
  save.saveGame(state);
  state.audio.engine(0, false);
  state.audio.siren(false, 0);
  state.mode = 'title';
  state.dialogue = null;
  state.endKind = null;
}

function handleWasted() {
  missions.failMission(state, 'you were wasted');
  if (!state.player.onFoot) exitCar(state, true);
  const fine = Math.min(state.money, ECONOMY.wastedBill);
  state.money -= fine;
  state.wanted = 0;
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  state.cops = [];
  state.enemies = [];
  state.audio.wasted();
  state.audio.engine(0, false);
  state.audio.siren(false, 0);
  state.endKind = 'wasted';
  state.mode = 'wasted';
}

function handleBusted() {
  missions.failMission(state, 'you were busted');
  if (!state.player.onFoot) exitCar(state, true);
  const fine = Math.min(state.money, ECONOMY.bustedFine);
  state.money -= fine;
  state.wanted = 0;
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  state.cops = [];
  state.enemies = [];
  state.audio.wasted();
  state.audio.engine(0, false);
  state.audio.siren(false, 0);
  state.endKind = 'busted';
  state.mode = 'busted';
}

function respawnAfterEnd() {
  const place = state.endKind === 'wasted'
    ? state.city.places.hospital
    : state.city.places.policeHQ;
  state.player.x = place.x;
  state.player.y = place.y;
  state.player.onFoot = true;
  state.player.car = null;
  state.player.vx = 0;
  state.player.vy = 0;
  state.health = 100;
  state.wanted = 0;
  state.camera.x = Math.max(0, place.x - VIEW.width / 2);
  state.camera.y = Math.max(0, place.y - VIEW.height / 2);
  state.mode = 'playing';
  state.endKind = null;
  state.message = { text: 'Back on the streets.', timer: 2.5 };
}

function processEvents() {
  for (const e of state.events) {
    if (e.type === 'wasted') handleWasted();
    else if (e.type === 'busted') handleBusted();
    else if (e.type === 'gameComplete') {
      state.audio.engine(0, false);
      state.audio.siren(false, 0);
      state.endKind = 'complete';
      state.mode = 'complete';
    }
  }
  state.events.length = 0;
}

function computePrompt() {
  const p = state.player;
  if (state.dialogue || state.mission && state.mode !== 'playing') return '';
  if (!p.onFoot) {
    if (p.car && p.car.type === 'taxi' && waitingPassengerNear(state, 90)) {
      return 'E — Pick up passenger';
    }
    return Math.abs(p.car.speed) < 40 ? 'E — Exit car' : '';
  }
  const marker = missions.missionStartPoint(state);
  if (marker && distance(p.x, p.y, marker.x, marker.y) < 80) {
    return `E — Start mission: ${marker.def.name}`;
  }
  for (const ped of state.peds) {
    if (ped.kind === 'vendor' && !ped.down && distance(p.x, p.y, ped.x, ped.y) < 70) {
      return 'E — Buy a snack ($5, +25 health)';
    }
  }
  const car = nearestCar(state, PLAYER.enterCarRange);
  if (car) return `E — Enter ${car.label}`;
  return '';
}

function clickedButton() {
  const m = state.input.mouse;
  if (!m.clicked) return null;
  for (const b of state.uiButtons) {
    if (!b.enabled) continue;
    if (m.canvasX >= b.x && m.canvasX <= b.x + b.w && m.canvasY >= b.y && m.canvasY <= b.y + b.h) {
      state.audio.uiClick();
      return b.id;
    }
  }
  return null;
}

function updateTitle(dt) {
  state.time += dt;
  // A slow drift over downtown behind the title.
  const cam = state.camera;
  cam.x = 1000 + Math.sin(state.time * 0.07) * 500;
  cam.y = 700 + Math.cos(state.time * 0.05) * 350;
  cam.x = Math.max(0, Math.min(cam.x, 3600 - VIEW.width));
  cam.y = Math.max(0, Math.min(cam.y, 2700 - VIEW.height));
  state.fx.update(dt);

  const btn = clickedButton();
  if (btn === 'continue') continueGame();
  else if (btn === 'new') newGame();
  else if (btn === 'help') state.showHelp = !state.showHelp();
  if (state.input.wasPressed('Enter')) {
    if (save.hasSave()) continueGame();
    else newGame();
  }
}

function updatePlaying(dt) {
  state.time += dt;
  state.stats.playTime += dt;
  state.clock = (state.clock + dt / SECONDS_PER_GAME_HOUR) % 24;
  if (state.message) {
    state.message.timer -= dt;
    if (state.message.timer <= 0) state.message = null;
  }

  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  police.updatePolice(state, dt);
  missions.updateMissions(state, dt);
  missions.updateEnemies(state, dt);
  combat.updateBullets(state, dt);
  combat.updatePickups(state, dt);
  updateTaxi(state, dt);
  state.fx.update(dt);
  updateCamera(state, dt);
  state.prompt = computePrompt();

  // Siren while the heat is on and a unit is close.
  const sirenOn = state.wanted > 0 && police.nearestCopDistance(state) < 800;
  state.audio.siren(sirenOn, dt);
  if (state.player.onFoot) state.audio.engine(0, false);

  if (state.input.wasPressed('p') || state.input.wasPressed('Escape')) {
    state.audio.engine(0, false);
    state.audio.siren(false, 0);
    state.mode = 'paused';
  }
  processEvents();
}

function updateDialogue(dt) {
  state.fx.update(dt);
  const input = state.input;
  if (input.wasPressed('e') || input.wasPressed('Enter') || input.mouse.clicked) {
    missions.advanceDialogue(state);
  }
}

function updatePaused(dt) {
  const btn = clickedButton();
  if (btn === 'resume') state.mode = 'playing';
  else if (btn === 'save') {
    save.saveGame(state);
    state.message = { text: 'Game saved', timer: 2 };
    state.mode = 'playing';
  } else if (btn === 'mute') state.audio.toggleMute();
  else if (btn === 'title') quitToTitle();
  if (state.input.wasPressed('p') || state.input.wasPressed('Escape')) {
    state.mode = 'playing';
  }
}

function updateEnd(dt) {
  state.fx.update(dt);
  const btn = clickedButton();
  const enter = state.input.wasPressed('Enter');
  if (btn === 'retry' || (enter && state.endKind !== 'complete')) respawnAfterEnd();
  else if (btn === 'freeroam' || (enter && state.endKind === 'complete')) {
    state.mode = 'playing';
    state.endKind = null;
  } else if (btn === 'title') quitToTitle();
}

function update(dt) {
  updateMouse();
  const input = state.input;
  if (input.mouse.clicked || Object.keys(input.pressed).length > 0) {
    state.audio.unlock();
  }
  if (input.wasPressed('m')) {
    const muted = state.audio.toggleMute();
    state.message = { text: muted ? 'Sound muted' : 'Sound on', timer: 1.5 };
  }
  if (state.mode === 'title') updateTitle(dt);
  else if (state.mode === 'playing') updatePlaying(dt);
  else if (state.mode === 'dialogue') updateDialogue(dt);
  else if (state.mode === 'paused') updatePaused(dt);
  else updateEnd(dt);
}

function render() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (state.mode === 'title') {
    drawWorld(ctx, state);
    state.uiButtons = drawTitle(ctx, state, state.showHelp);
  } else if (state.mode === 'playing' || state.mode === 'dialogue') {
    drawWorld(ctx, state);
    drawHUD(ctx, state);
    if (state.dialogue) drawDialogue(ctx, state);
    state.fx.drawOverlay(ctx, VIEW.width, VIEW.height);
  } else if (state.mode === 'paused') {
    drawWorld(ctx, state);
    state.uiButtons = drawPause(ctx, state);
  } else {
    drawWorld(ctx, state);
    state.uiButtons = drawEndScreen(ctx, state, state.endKind);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
    render();
  } catch (err) {
    // One bad frame must never freeze the game: log it and keep going.
    console.error('frame error:', err && err.message ? err.message : err);
  }
  state.input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
