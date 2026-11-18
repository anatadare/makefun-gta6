// The HUD and the menus: wanted stars, health, money, speed, the minimap,
// the mission objective with its timer bar, phone messages and context
// prompts, plus the title, pause, wasted and busted panels. Everything is
// drawn big and bright: the screenshots shrink, so small text would be lost.

import { FONT, PALETTE, ROADS, VIEW } from './config.js';
import { PLACES, STASHES } from './city.js';
import { MISSION_COUNT, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const MAP = { x: VIEW.width - 226, y: 16, w: 210, h: 158, scale: 0.055 };

// The red flash when the wanted level climbs: remembered across frames.
let lastStarsSeen = 0;
let flashUntil = -1;

const fonts = new Map();
function font(size, weight) {
  const key = `${weight || ''}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
  return fonts.get(key);
}

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, radius) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, fill01, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, fill01)), h - 4);
}

function drawStars(ctx, stars) {
  ctx.font = font(30, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    ctx.fillText(i < stars ? '★' : '☆', 20 + i * 34, 16);
  }
}

function drawMinimap(ctx, state, time) {
  const { x, y, w, h } = MAP;
  panel(ctx, x, y, w, h, 10);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 7);
  ctx.clip();
  ctx.fillStyle = '#cbb98f';
  ctx.fillRect(x, y, w, h);
  const s = MAP.scale;
  const px = (wx) => x + wx * s;
  const py = (wy) => y + wy * s;
  // Water along the bottom edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + 2520 * s, w, h);
  // Roads.
  ctx.strokeStyle = '#8d8d8d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const rx of ROADS.vertical) {
    ctx.moveTo(x + rx * s, y);
    ctx.lineTo(x + rx * s, y + h);
  }
  for (const ry of ROADS.horizontal) {
    ctx.moveTo(x, y + ry * s);
    ctx.lineTo(x + w, y + ry * s);
  }
  ctx.stroke();
  // The garage and the hideout, so the player always knows the way home.
  const places = [
    { at: PLACES.garage, color: '#ff8a3d', size: 5 },
    { at: PLACES.hideout, color: PALETTE.green, size: 5 },
  ];
  for (const p of places) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px(p.at.x), py(p.at.y), p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Traffic as faint dots, cops as flashing blue/red.
  ctx.fillStyle = 'rgba(60,60,60,0.7)';
  for (const car of state.traffic.cars) {
    ctx.fillRect(px(car.x) - 1.5, py(car.y) - 1.5, 3, 3);
  }
  const copColor = Math.floor(time * 2) % 2 === 0 ? PALETTE.blue : PALETTE.red;
  ctx.fillStyle = copColor;
  for (const car of state.police.copCars) {
    ctx.beginPath();
    ctx.arc(px(car.x), py(car.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.police.footCops) {
    if (cop.dead) continue;
    ctx.beginPath();
    ctx.arc(px(cop.x), py(cop.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mission marker pulses yellow.
  const obj = missionObjective(state.missions);
  if (obj && obj.x !== null) {
    const pulse = 5 + Math.sin(time * 5) * 1.5;
    ctx.fillStyle = PALETTE.marker;
    ctx.save();
    ctx.translate(px(obj.x), py(obj.y));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // The player is a white arrow that turns with them.
  const player = state.player;
  ctx.save();
  ctx.translate(px(player.x), py(player.y));
  ctx.rotate(player.onFoot ? player.angle : player.car.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  text(ctx, 'SOLMARA', x + 10, y + h - 8, 13, 'rgba(255,255,255,0.85)', 'left', 'bold');
  text(ctx, 'N', x + w - 14, y + 18, 13, 'rgba(255,255,255,0.85)', 'left', 'bold');
}

function drawMessages(ctx, state, time) {
  const live = state.messages.filter((m) => m.until > time).slice(-2);
  let y = 96;
  for (const m of live) {
    const fade = Math.min(1, (m.until - time) / 1);
    ctx.globalAlpha = fade;
    ctx.font = font(20, 'bold');
    const width = ctx.measureText(m.text).width + 36;
    panel(ctx, (VIEW.width - width) / 2, y, width, 34, 17);
    text(ctx, m.text, VIEW.width / 2, y + 24, 20, PALETTE.text, 'center', 'bold');
    ctx.globalAlpha = 1;
    y += 42;
  }
}

function drawObjective(ctx, state) {
  const obj = missionObjective(state.missions);
  if (!obj) return;
  const player = state.player;
  let label = obj.text;
  if (obj.x !== null) {
    const dist = Math.round(Math.hypot(obj.x - player.x, obj.y - player.y) / 8);
    label += `  ·  ${dist}m`;
  }
  if (obj.timer !== null) label += `  ·  ${obj.timer}s`;
  ctx.font = font(22, 'bold');
  const width = ctx.measureText(label).width + 40;
  const panelX = (VIEW.width - width) / 2;
  panel(ctx, panelX, 16, width, 38, 10);
  ctx.fillStyle = PALETTE.marker;
  ctx.save();
  ctx.translate(panelX + 24, 35);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  text(ctx, label, panelX + 38, 43, 22, PALETTE.text, 'left', 'bold');
  // A timed step gets a draining bar under the panel, so the clock reads
  // at a glance even mid-chase.
  if (obj.timer !== null && obj.timerTotal) {
    bar(ctx, panelX + 8, 58, width - 16, 8, obj.timer / obj.timerTotal, obj.timer <= 10 ? PALETTE.red : PALETTE.gold);
  }
}

function drawBustMeter(ctx, bust) {
  if (bust <= 0.02) return;
  const w = 300;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 84;
  panel(ctx, x, y, w, 30, 8);
  ctx.fillStyle = PALETTE.blue;
  ctx.fillRect(x + 5, y + 5, (w - 10) * bust, 20);
  text(ctx, 'ARREST', VIEW.width / 2, y + 22, 18, PALETTE.text, 'center', 'bold');
}

export function drawHud(ctx, state, time, hintAlpha) {
  const player = state.player;
  const stars = state.police.stars;
  if (stars > lastStarsSeen) flashUntil = time + 0.7;
  lastStarsSeen = stars;

  // A dark panel behind the top-left cluster, so the text reads over sand too.
  panel(ctx, 12, 10, 252, 158, 10);
  drawStars(ctx, stars);
  bar(ctx, 20, 58, 230, 20, player.health / 100, player.health > 35 ? PALETTE.green : PALETTE.red);
  text(ctx, `$${player.money.toLocaleString('en-US')}`, 20, 104, 28, PALETTE.gold, 'left', 'bold');
  if (state.missions.storyDone) text(ctx, 'FREE ROAM', 20, 132, 16, PALETTE.muted, 'left', 'bold');
  else text(ctx, `MISSION ${state.missions.index + 1}/${MISSION_COUNT}`, 20, 132, 16, PALETTE.muted, 'left', 'bold');
  const foundStashes = STASHES.length - state.stashes.length;
  text(ctx, `STASHES ${foundStashes}/${STASHES.length}`, 20, 154, 16, PALETTE.muted, 'left', 'bold');

  drawMinimap(ctx, state, time);
  drawObjective(ctx, state);
  drawMessages(ctx, state, time);

  // Speed, vehicle and its condition, bottom left, on their own dark panel.
  if (!player.onFoot && player.car) {
    panel(ctx, 12, VIEW.height - 112, 176, 100, 10);
    const mph = Math.round(Math.hypot(player.car.vx, player.car.vy) * 0.22);
    text(ctx, `${mph}`, 22, VIEW.height - 62, 44, PALETTE.text, 'left', 'bold');
    text(ctx, 'mph', 98, VIEW.height - 62, 20, PALETTE.muted, 'left', 'bold');
    text(ctx, player.car.type.name, 22, VIEW.height - 34, 20, PALETTE.muted, 'left', 'bold');
    const ch = Math.max(0, player.car.health / 100);
    bar(ctx, 22, VIEW.height - 26, 156, 10, ch, ch > 0.5 ? PALETTE.green : ch > 0.25 ? '#f39c12' : PALETTE.red);
  }
  // Context prompt, bottom centre.
  if (state.prompt) {
    ctx.font = font(22, 'bold');
    const width = ctx.measureText(state.prompt).width + 36;
    panel(ctx, (VIEW.width - width) / 2, VIEW.height - 58, width, 36, 18);
    text(ctx, state.prompt, VIEW.width / 2, VIEW.height - 32, 22, PALETTE.text, 'center', 'bold');
  }
  drawBustMeter(ctx, state.police.bust);

  // Controls hint, bottom right, fading with play time.
  if (hintAlpha > 0) {
    ctx.globalAlpha = hintAlpha;
    text(ctx, 'WASD move/drive · Mouse aim · Click shoot', VIEW.width - 20, VIEW.height - 44, 17, PALETTE.muted, 'right');
    text(ctx, 'E enter car · F punch · Space handbrake · P pause · M mute', VIEW.width - 20, VIEW.height - 20, 17, PALETTE.muted, 'right');
    ctx.globalAlpha = 1;
  }

  // Low-health vignette.
  if (player.health < 35 && player.health > 0) {
    const a = ((35 - player.health) / 35) * 0.45 * (0.7 + 0.3 * Math.sin(time * 6));
    const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // The wanted flash: a red edge pulse when a new star lands.
  if (time < flashUntil) {
    const a = 0.35 * ((flashUntil - time) / 0.7);
    ctx.strokeStyle = `rgba(255,60,60,${a})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
  }
}

function drawTitlePanel(ctx, save, time) {
  ctx.fillStyle = 'rgba(8, 20, 28, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  text(ctx, 'SOLMARA', VIEW.width / 2, 210, 96, PALETTE.gold, 'center', 'bold');
  text(ctx, 'A sun-soaked open-world crime story', VIEW.width / 2, 258, 26, PALETTE.text, 'center');
  text(ctx, 'Mars Delgado is back in town. Drive, steal, run — and stay out of jail.', VIEW.width / 2, 292, 20, PALETTE.muted, 'center');
  const lines = [
    'WASD / Arrows — move on foot, drive a car',
    'Mouse — aim   ·   Click — shoot   ·   F — punch',
    'E — steal / enter / exit a car   ·   Space — handbrake',
    'Shift — sprint   ·   P — pause   ·   M — mute',
  ];
  panel(ctx, (VIEW.width - 620) / 2, 330, 620, 150, 14);
  lines.forEach((line, i) => text(ctx, line, VIEW.width / 2, 368 + i * 32, 21, PALETTE.text, 'center'));
  const saveLine = save.missionIndex > 0 || save.money > 0
    ? `Continue: mission ${Math.min(save.missionIndex + 1, MISSION_COUNT)}/${MISSION_COUNT} · $${save.money.toLocaleString('en-US')} in your pocket`
    : 'A new story in Solmara — your first job is waiting';
  text(ctx, saveLine, VIEW.width / 2, 522, 20, PALETTE.gold, 'center', 'bold');
  // The prompt blinks on world time, phase-shifted so a staged title shot
  // (world time almost exactly 3.0) catches it lit, not on a boundary.
  const blink = Math.floor(time * 2 + 0.5) % 2 === 0;
  if (blink) text(ctx, 'PRESS ENTER OR CLICK TO START', VIEW.width / 2, 580, 26, PALETTE.text, 'center', 'bold');
  text(ctx, 'Progress saves automatically after each job.', VIEW.width / 2, 640, 17, PALETTE.muted, 'center');
}

function drawPausePanel(ctx, state, save) {
  ctx.fillStyle = 'rgba(8, 20, 28, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  text(ctx, 'PAUSED', VIEW.width / 2, 240, 64, PALETTE.text, 'center', 'bold');
  text(ctx, 'Solmara waits for no one. Except now.', VIEW.width / 2, 284, 22, PALETTE.muted, 'center');
  const foundStashes = STASHES.length - state.stashes.length;
  const lines = [
    `Cash in hand: $${state.player.money.toLocaleString('en-US')}  ·  Total earned: $${(save.totalEarned || 0).toLocaleString('en-US')}`,
    state.missions.storyDone
      ? 'Story complete — free roam'
      : `Mission ${state.missions.index + 1} of ${MISSION_COUNT}`,
    `Stashes found: ${foundStashes}/${STASHES.length}  ·  Cars stolen: ${save.carsStolen || 0}`,
  ];
  panel(ctx, (VIEW.width - 560) / 2, 320, 560, 130, 14);
  lines.forEach((line, i) => text(ctx, line, VIEW.width / 2, 358 + i * 36, 21, PALETTE.text, 'center'));
  text(ctx, 'Press P or Enter to get back on the street', VIEW.width / 2, 510, 24, PALETTE.gold, 'center', 'bold');
}

function drawEndPanel(ctx, title, color, lines, prompt) {
  ctx.fillStyle = 'rgba(8, 20, 28, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  text(ctx, title, VIEW.width / 2, 280, 84, color, 'center', 'bold');
  lines.forEach((line, i) => text(ctx, line, VIEW.width / 2, 340 + i * 34, 24, PALETTE.text, 'center'));
  text(ctx, prompt, VIEW.width / 2, 460, 26, PALETTE.gold, 'center', 'bold');
}

export function drawScreenPanel(ctx, screen, state, save, penalty, time) {
  if (screen === SCREEN_TITLE) drawTitlePanel(ctx, save, time);
  else if (screen === SCREEN_PAUSED) drawPausePanel(ctx, state, save);
  else if (screen === SCREEN_OVER) {
    drawEndPanel(ctx, 'WASTED', PALETTE.red, ['The doctors patched you up at Solmara General.', `Hospital bill: $${penalty}.`], 'Press R to get back out there');
  } else if (screen === SCREEN_BUSTED) {
    drawEndPanel(ctx, 'BUSTED', PALETTE.blue, ['The Solmara PD let you go with a fine.', `Fine: $${penalty}.`], 'Press R to walk free');
  }
}
