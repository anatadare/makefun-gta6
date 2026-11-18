// SOLMARA — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, wasted and busted. Progress saves after
// every job, and once more when the tab hides, so a closed window never
// loses a payday.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|drive|foot|start (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_SAVED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { stageShot } from './shots.js';
import { loadSave, saveGame } from './save.js';
import { createAudio, playEnd, toggleMute, unlockAudio } from './audio.js';

const MAX_FRAME = 0.25;
const HINT_SECONDS = 22;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const save = loadSave();
const world = createWorld(seed, save);
const renderer = createRenderer(canvas);
const audio = createAudio();

// No keys, no mouse: the input the world gets while the title shows.
const IDLE_INPUT = {
  move: () => ({ x: 0, y: 0 }),
  throttle: () => 0,
  steer: () => 0,
  sprint: () => false,
  handbrake: () => false,
  mouse: { x: 0, y: 0, down: false },
};

function runShot(name) {
  const scene = stageShot(name, world);
  const player = world.state.player;
  if (scene.camera) renderer.setCamera(scene.camera.x, scene.camera.y);
  else renderer.setCamera(player.x, player.y);
  if (scene.zoom) renderer.setZoomOverride(scene.zoom);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, save, world.state.penalty, world.state.time, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let penalty = 0;
  let playSeconds = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.beginPlay();
    screen = SCREEN_PLAY;
    unlockAudio(audio);
    announce('Playing Solmara. Your first job is on the map.');
  }

  function respawn(kind) {
    world.respawn(kind);
    screen = SCREEN_PLAY;
    announce(kind === 'station' ? 'Back on the street.' : 'Back on your feet.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = toggleMute(audio);
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE && actions & ACTION_CONFIRM) startGame();
    else if (screen === SCREEN_PLAY && actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if ((screen === SCREEN_OVER || screen === SCREEN_BUSTED) && actions & (ACTION_RESTART | ACTION_CONFIRM)) {
      respawn(screen === SCREEN_BUSTED ? 'station' : 'hospital');
    }
  }

  function stepWorld(dt, actions) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
      const events = world.step(STEP, input, actions, aim, audio);
      actions = 0;
      accumulator -= STEP;
      if (events & EVENT_WASTED) {
        penalty = world.state.penalty;
        screen = SCREEN_OVER;
        playEnd(audio, 'wasted');
        announce('Wasted. The doctors patched you up.');
        return;
      }
      if (events & EVENT_BUSTED) {
        penalty = world.state.penalty;
        screen = SCREEN_BUSTED;
        playEnd(audio, 'busted');
        announce('Busted. The police let you go with a fine.');
        return;
      }
      if (events & EVENT_SAVED) saveGame(save);
    }
  }

  function stepAttract(dt) {
    // The title's living backdrop: the city runs while nobody plays.
    accumulator += dt;
    while (accumulator >= STEP) {
      world.step(STEP, IDLE_INPUT, 0, { x: world.state.player.x, y: world.state.player.y }, null);
      accumulator -= STEP;
    }
    const t = world.state.time;
    renderer.updateCamera(1600 + Math.sin(t * 0.05) * 320, 1300 + Math.cos(t * 0.04) * 220, dt);
  }

  function followPlayer(dt) {
    // The camera follows the player, leaning into their motion.
    const player = world.state.player;
    const look = player.car ? 0.3 : 0.12;
    const lx = player.car ? player.car.vx * look : Math.cos(player.angle) * player.speed * look;
    const ly = player.car ? player.car.vy * look : Math.sin(player.angle) * player.speed * look;
    renderer.updateCamera(player.x + lx, player.y + ly, dt);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);

    if (screen === SCREEN_TITLE) {
      stepAttract(dt);
    } else if (screen === SCREEN_PLAY) {
      playSeconds += dt;
      stepWorld(dt, actions);
      if (screen === SCREEN_PLAY) followPlayer(dt);
    } else {
      accumulator = 0;
    }

    const hintAlpha = screen === SCREEN_PLAY ? Math.max(0, Math.min(1, (HINT_SECONDS - playSeconds) / 4)) : 0;
    renderer.draw(world.state, screen, save, penalty, world.state.time, hintAlpha);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(save);
      announce('Paused.');
    }
  });

  announce('Solmara. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
