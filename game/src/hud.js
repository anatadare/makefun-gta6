// hud.js — everything drawn on top of the world: the HUD (money, health,
// wanted stars, weapon, clock, objective, minimap), the dialogue box, the
// title screen, the pause menu and the end screens. All canvas, so the
// screenshots capture the whole interface exactly as the player sees it.

import { VIEW, CONTROLS, STORY, WEAPONS, ROAD_X, ROAD_Y } from './config.js';
import { districtAt } from './world.js';

export function formatClock(clock) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtMoney(n) {
  return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#f5c518' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(8, 12, 20, ${alpha || 0.72})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHUD(ctx, state) {
  const W = VIEW.width;
  // Top-left cluster: money, health, weapon.
  panel(ctx, 14, 14, 250, 108, 0.66);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(fmtMoney(state.money), 28, 44);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(28, 56, 180, 12);
  ctx.fillStyle = state.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(28, 56, 180 * Math.max(0, state.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 214, 66);
  // Weapon.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const weaponLabel = state.weapon === 'scattergun'
    ? `Scattergun  ${state.ammo} shells`
    : 'Fists';
  ctx.fillText(weaponLabel, 28, 96);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('[Q] swap weapon', 28, 112);

  // Top-right: wanted stars, clock, district.
  panel(ctx, W - 264, 14, 250, 108, 0.66);
  for (let i = 0; i < 5; i++) {
    star(ctx, W - 238 + i * 32, 40, 12, i < state.wanted);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(state.clock), W - 28, 80);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const district = districtAt(state.player.x, state.player.y);
  ctx.fillText(district.name, W - 28, 100);
  ctx.textAlign = 'left';

  // Objective under the top-left cluster.
  if (state.objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(state.objective).width + 44;
    panel(ctx, 14, 132, w, 36, 0.66);
    ctx.fillStyle = '#f5c518';
    ctx.fillText('◆', 28, 156);
    ctx.fillStyle = '#fff';
    ctx.fillText(state.objective, 48, 156);
  }

  // Mission name banner.
  if (state.mission) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(state.mission.def.name.toUpperCase(), 28, 132 + (state.objective ? 52 : 0));
  }

  // Taxi fare status.
  if (state.taxi.active) {
    const y = 186;
    panel(ctx, 14, y, 250, 52, 0.66);
    ctx.fillStyle = state.taxi.rush ? '#ff6b5e' : '#f5c518';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(state.taxi.rush ? `RUSH FARE — ${Math.ceil(state.taxi.timer)}s` : 'FARE IN PROGRESS', 28, y + 22);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Drop off at the $ marker (+$${state.taxi.fare})`, 28, y + 42);
  }

  // Toast message, center top.
  if (state.message && state.message.timer > 0) {
    const alpha = Math.min(1, state.message.timer);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px system-ui, sans-serif';
    const w = ctx.measureText(state.message.text).width + 40;
    panel(ctx, W / 2 - w / 2, 16, w, 38, 0.8);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message.text, W / 2, 41);
    ctx.restore();
  }

  // Interaction prompt, bottom center.
  if (state.prompt) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const w = ctx.measureText(state.prompt).width + 36;
    panel(ctx, W / 2 - w / 2, VIEW.height - 64, w, 36, 0.75);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, W / 2, VIEW.height - 40);
    ctx.textAlign = 'left';
  }

  // Speedometer while driving.
  if (!state.player.onFoot && state.player.car) {
    const kmh = Math.round(Math.abs(state.player.car.speed) * 0.22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${kmh}`, W - 40, VIEW.height - 176);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h', W - 40, VIEW.height - 158);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, state);
}

export function drawMinimap(ctx, state) {
  const mw = 220;
  const mh = 168;
  const mx = 14;
  const my = VIEW.height - mh - 14;
  const sx = mw / 3600;
  const sy = mh / 2700;
  panel(ctx, mx - 4, my - 4, mw + 8, mh + 8, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(mx, my, mw, mh);
  // Water.
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(mx, my + 2520 * sy, mw, mh - 2520 * sy);
  // Roads.
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 3;
  for (const rx of ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Mission start marker.
  const start = state.missions.missionStartPoint(state);
  if (start) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', mx + start.x * sx, my + start.y * sy + 5);
  }
  // Current objective target.
  const target = state.missions.currentTarget(state);
  if (target) {
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Taxi destination.
  if (state.taxi.active && state.taxi.dest) {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('$', mx + state.taxi.dest.x * sx, my + state.taxi.dest.y * sy + 4);
  }
  // Cops when wanted.
  if (state.wanted > 0) {
    ctx.fillStyle = '#3498db';
    for (const car of state.cars) {
      if (car.driver === 'police' && !car.dead) {
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Enemies.
  ctx.fillStyle = '#e74c3c';
  for (const e of state.enemies) {
    if (!e.down) {
      ctx.beginPath();
      ctx.arc(mx + e.x * sx, my + e.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  ctx.save();
  ctx.translate(mx + state.player.x * sx, my + state.player.y * sy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
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
  ctx.textAlign = 'left';
}

export function drawDialogue(ctx, state) {
  const d = state.dialogue;
  if (!d) return;
  const line = d.lines[d.index];
  const w = 860;
  const h = 130;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - h - 40;
  panel(ctx, x, y, w, h, 0.88);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(line.who, x + 24, y + 32);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  wrapText(ctx, line.text, x + 24, y + 60, w - 48, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`E / Enter to continue  (${d.index + 1}/${d.lines.length})`, x + w - 20, y + h - 14);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawButton(ctx, b, hover) {
  ctx.fillStyle = hover ? '#f5c518' : 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = hover ? '#f5c518' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = hover ? '#111' : b.enabled === false ? 'rgba(255,255,255,0.4)' : '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function isHover(state, b) {
  const m = state.input.mouse;
  return m.canvasX >= b.x && m.canvasX <= b.x + b.w && m.canvasY >= b.y && m.canvasY <= b.y + b.h;
}

export function drawTitle(ctx, state, showHelp) {
  // Dark veil over the drifting city behind.
  ctx.fillStyle = 'rgba(6, 10, 18, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('SOLMARA', VIEW.width / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in the sun-soaked city', VIEW.width / 2, 190);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${STORY.playerName} is new in town. ${STORY.fixerName} has work. ${STORY.rivalName} has other plans.`, VIEW.width / 2, 216);
  ctx.textAlign = 'left';

  const buttons = [];
  const cx = VIEW.width / 2 - 160;
  const bw = 320;
  const bh = 48;
  const defs = [
    { id: 'continue', label: 'Continue', enabled: state.save.hasSave() },
    { id: 'new', label: 'New Game', enabled: true },
    { id: 'help', label: showHelp ? 'Hide Controls' : 'How to Play', enabled: true },
  ];
  defs.forEach((d, i) => {
    const b = { ...d, x: cx, y: 250 + i * 62, w: bw, h: bh };
    drawButton(ctx, b, isHover(state, b));
    buttons.push(b);
  });

  // Controls list, always visible on the title screen: two columns with
  // room for the longest description before the next column starts.
  const cy = 460;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONTROLS', VIEW.width / 2, cy);
  ctx.textAlign = 'left';
  ctx.font = '14px system-ui, sans-serif';
  const colW = 560;
  CONTROLS.forEach((row, i) => {
    const col = i % 2;
    const r = Math.floor(i / 2);
    const x = VIEW.width / 2 - colW + col * colW + 20;
    const y = cy + 28 + r * 22;
    ctx.fillStyle = '#f5c518';
    ctx.fillText(row[0], x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(row[1], x + 180, y);
  });

  if (showHelp) {
    panel(ctx, VIEW.width / 2 - 340, 600, 680, 104, 0.9);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    const tips = [
      'Follow the gold ! marker to start missions. Eight missions, one finale heist: The Big One pays $2,000.',
      'Drive a taxi to pick up fares — rush fares pay a bonus if you beat the clock.',
      'Stars mean heat: stay out of sight and the wanted level fades. Press N to skip 2 hours.',
      'Your progress autosaves after every mission. M mutes the sound.',
    ];
    tips.forEach((t, i) => {
      wrapText(ctx, t, VIEW.width / 2 - 320, 622 + i * 22, 640, 20);
    });
  }
  return buttons;
}

export function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(6, 10, 18, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 150);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`Missions done: ${state.missionsDone.length} / 8    Money: ${fmtMoney(state.money)}`, VIEW.width / 2, 186);
  ctx.textAlign = 'left';

  const buttons = [];
  const cx = VIEW.width / 2 - 160;
  const defs = [
    { id: 'resume', label: 'Resume', enabled: true },
    { id: 'save', label: 'Save Game', enabled: true },
    { id: 'mute', label: state.audio.muted ? 'Unmute Sound' : 'Mute Sound', enabled: true },
    { id: 'title', label: 'Quit to Title', enabled: true },
  ];
  defs.forEach((d, i) => {
    const b = { ...d, x: cx, y: 230 + i * 62, w: 320, h: 48 };
    drawButton(ctx, b, isHover(state, b));
    buttons.push(b);
  });
  return buttons;
}

export function drawEndScreen(ctx, state, kind) {
  const titles = {
    wasted: 'WASTED',
    busted: 'BUSTED',
    complete: 'SOLMARA IS YOURS',
  };
  const subs = {
    wasted: 'Solmara General patched you up. The bill is on you.',
    busted: 'The Solmara PD processed you. Bail is on you.',
    complete: 'All eight missions done. The Big One paid out. Riko Vale runs this city now.',
  };
  ctx.fillStyle = kind === 'complete' ? 'rgba(10, 40, 20, 0.78)' : 'rgba(20, 6, 6, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'complete' ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(titles[kind], VIEW.width / 2, 160);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(subs[kind], VIEW.width / 2, 198);
  ctx.textAlign = 'left';

  // Run stats.
  const s = state.stats;
  const rows = [
    ['Money earned', fmtMoney(s.moneyEarned)],
    ['Missions completed', `${s.missionsDone} / 8`],
    ['Distance driven', `${Math.round(s.distance)} km`],
    ['Cars stolen', `${s.carsStolen}`],
    ['Shots fired', `${s.shotsFired}`],
    ['Highest wanted', `${'★'.repeat(s.maxWanted) || '—'}`],
    ['Taxi fares', `${state.taxi.total}`],
    ['Time played', `${Math.floor(s.playTime / 60)}m ${Math.floor(s.playTime % 60)}s`],
  ];
  const x0 = VIEW.width / 2 - 200;
  ctx.font = '16px system-ui, sans-serif';
  rows.forEach((row, i) => {
    const y = 240 + i * 30;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(row[0], x0, y);
    ctx.fillStyle = '#f5c518';
    ctx.textAlign = 'right';
    ctx.fillText(row[1], x0 + 400, y);
    ctx.textAlign = 'left';
  });

  const buttons = [];
  const defs = kind === 'complete'
    ? [
      { id: 'freeroam', label: 'Keep Playing (Free Roam)', enabled: true },
      { id: 'title', label: 'Quit to Title', enabled: true },
    ]
    : [
      { id: 'retry', label: kind === 'wasted' ? 'Leave Hospital' : 'Pay Bail and Go', enabled: true },
      { id: 'title', label: 'Quit to Title', enabled: true },
    ];
  defs.forEach((d, i) => {
    const b = { ...d, x: VIEW.width / 2 - 160, y: 500 + i * 62, w: 320, h: 48 };
    drawButton(ctx, b, isHover(state, b));
    buttons.push(b);
  });
  return buttons;
}
