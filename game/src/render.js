// render.js — draws Solmara: the ground, the roads, the buildings with
// sun-cast shadows, the stadium and the harbor, then every entity, then
// the day/night lighting. The camera follows the player with a little
// lookahead and shakes when the action calls for it.

import { VIEW, WORLD, ROAD_X, ROAD_Y, DAY, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';
import { drawVehicle } from './vehicles.js';
import { drawPed } from './pedestrians.js';
import { drawFootCop } from './police.js';
import { drawEnemy } from './missions.js';
import { drawPlayer } from './player.js';
import { drawBullets, drawPickups } from './combat.js';
import { drawTaxiMarker } from './taxi.js';

// 0 = full day, 1 = full night, with dawn and dusk ramps.
export function darknessAt(clock) {
  if (clock >= DAY.dayStart && clock < DAY.duskStart) return 0;
  if (clock >= DAY.nightStart || clock < DAY.nightEnd) return 1;
  if (clock >= DAY.duskStart && clock < DAY.nightStart) {
    return (clock - DAY.duskStart) / (DAY.nightStart - DAY.duskStart);
  }
  return 1 - (clock - DAY.dawnStart) / (DAY.dayStart - DAY.dawnStart);
}

export function isNight(clock) {
  return darknessAt(clock) > 0.5;
}

// Sun direction for building shadows: east in the morning, west at dusk.
function sunOffset(clock) {
  const t = ((clock - 6) / 12) * Math.PI;
  const len = 14 + Math.abs(Math.cos(t)) * 26;
  return { x: Math.cos(t) * len, y: 6 + Math.sin(t) * 8 };
}

export function updateCamera(state, dt) {
  const cam = state.camera;
  const p = state.player;
  const look = p.onFoot ? 0 : 0.35;
  const tx = p.x + p.vx * look - VIEW.width / 2;
  const ty = p.y + p.vy * look - VIEW.height / 2;
  const k = 1 - Math.pow(0.001, dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = clamp(cam.x, 0, WORLD.width - VIEW.width);
  cam.y = clamp(cam.y, 0, WORLD.height - VIEW.height);
  const shake = state.fx.shake;
  cam.sx = (Math.random() - 0.5) * shake;
  cam.sy = (Math.random() - 0.5) * shake;
}

export function drawWorld(ctx, state) {
  const cam = state.camera;
  const night = isNight(state.clock);
  const dark = darknessAt(state.clock);
  const sun = sunOffset(state.clock);
  const city = state.city;

  ctx.save();
  ctx.translate(-cam.x + cam.sx, -cam.y + cam.sy);

  const vx0 = cam.x - 60;
  const vy0 = cam.y - 60;
  const vx1 = cam.x + VIEW.width + 60;
  const vy1 = cam.y + VIEW.height + 60;

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Mow stripes on the grass for texture.
  ctx.fillStyle = PALETTE.grassDark;
  for (let y = Math.floor(vy0 / 120) * 120; y < vy1; y += 240) {
    ctx.fillRect(vx0, y, vx1 - vx0, 120);
  }
  // Beach and water.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vx0, WORLD.beachLine, vx1 - vx0, WORLD.waterLine - WORLD.beachLine);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(vx0, WORLD.waterLine, vx1 - vx0, vy1 - WORLD.waterLine);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = Math.floor(vx0 / 180) * 180; x < vx1; x += 180) {
    ctx.fillRect(x, WORLD.waterLine + 40 + Math.sin(state.time * 0.5 + x) * 6, 90, 5);
  }

  // Blocks (pavement under the buildings).
  ctx.fillStyle = PALETTE.block;
  for (let i = 0; i < ROAD_X.length - 1; i++) {
    for (let j = 0; j < ROAD_Y.length - 1; j++) {
      const x0 = ROAD_X[i] + WORLD.roadWidth / 2;
      const x1 = ROAD_X[i + 1] - WORLD.roadWidth / 2;
      const y0 = ROAD_Y[j] + WORLD.roadWidth / 2;
      const y1 = ROAD_Y[j + 1] - WORLD.roadWidth / 2;
      if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROAD_X) {
    ctx.fillRect(rx - WORLD.roadWidth / 2 - WORLD.sidewalk, vy0, WORLD.sidewalk, vy1 - vy0);
    ctx.fillRect(rx + WORLD.roadWidth / 2, vy0, WORLD.sidewalk, vy1 - vy0);
  }
  for (const ry of ROAD_Y) {
    ctx.fillRect(vx0, ry - WORLD.roadWidth / 2 - WORLD.sidewalk, vx1 - vx0, WORLD.sidewalk);
    ctx.fillRect(vx0, ry + WORLD.roadWidth / 2, vx1 - vx0, WORLD.sidewalk);
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROAD_X) {
    ctx.fillRect(rx - WORLD.roadWidth / 2, vy0, WORLD.roadWidth, vy1 - vy0);
  }
  for (const ry of ROAD_Y) {
    ctx.fillRect(vx0, ry - WORLD.roadWidth / 2, vx1 - vx0, WORLD.roadWidth);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const rx of ROAD_X) {
    for (let y = Math.floor(vy0 / 48) * 48; y < vy1; y += 48) {
      ctx.fillRect(rx - 2, y, 4, 24);
    }
  }
  for (const ry of ROAD_Y) {
    for (let x = Math.floor(vx0 / 48) * 48; x < vx1; x += 48) {
      ctx.fillRect(x, ry - 2, 24, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      if (rx < vx0 - 80 || rx > vx1 + 80 || ry < vy0 - 80 || ry > vy1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 10 - 3, ry - WORLD.roadWidth / 2 - 10, 6, 8);
        ctx.fillRect(rx + i * 10 - 3, ry + WORLD.roadWidth / 2 + 2, 6, 8);
      }
    }
  }

  // Harbor docks and containers.
  ctx.fillStyle = PALETTE.dock;
  for (const d of city.docks) {
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = d.y + 12; y < d.y + d.h; y += 24) ctx.fillRect(d.x, y, d.w, 3);
    ctx.fillStyle = PALETTE.dock;
  }
  for (const c of city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(c.x, c.y, c.w, 5);
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings, with shadows thrown by the sun.
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    drawBuilding(ctx, b, sun, dark);
  }

  // Skid marks under the cars.
  state.fx.drawGround(ctx);

  // Mission and taxi markers on the ground.
  drawMarkers(ctx, state);

  // Pickups, then people and cars sorted by y so nearer things overlap.
  drawPickups(ctx, state);
  const drawables = [];
  for (const ped of state.peds) drawables.push({ y: ped.y, fn: () => drawPed(ctx, ped, night) });
  for (const cop of state.cops) drawables.push({ y: cop.y, fn: () => drawFootCop(ctx, cop) });
  for (const e of state.enemies) drawables.push({ y: e.y, fn: () => drawEnemy(ctx, e) });
  for (const car of state.cars) drawables.push({ y: car.y, fn: () => drawVehicle(ctx, car, night) });
  drawables.push({ y: state.player.y, fn: () => drawPlayer(ctx, state) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.fn();

  drawBullets(ctx, state);
  state.fx.drawAir(ctx);
  drawTaxiMarker(ctx, state);

  ctx.restore();

  // Day/night tint and lamp glow.
  if (dark > 0.02) {
    ctx.fillStyle = `rgba(8, 12, 38, ${dark * 0.5})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (night) {
      ctx.save();
      ctx.translate(-cam.x + cam.sx, -cam.y + cam.sy);
      for (const lamp of city.lamps) {
        if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 70);
        g.addColorStop(0, PALETTE.lampGlow);
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 70, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // Dawn/dusk warmth.
  if (dark > 0.02 && dark < 0.98) {
    ctx.fillStyle = `rgba(255, 140, 60, ${(1 - Math.abs(dark - 0.5) * 2) * 0.08})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function drawBuilding(ctx, b, sun, dark) {
  const h = b.floors * 6;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(b.x + sun.x, b.y + sun.y + h * 0.4, b.w, b.h);
  // Walls (the height read).
  ctx.fillStyle = shade(b.roof, -28);
  ctx.fillRect(b.x, b.y + h * 0.4, b.w, b.h);
  ctx.fillRect(b.x + 4, b.y + h * 0.4 + 4, b.w - 8, b.h - 8);
  // Roof.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

  if (b.style === 'stadium') {
    // Arena bowl: an oval field and running track.
    ctx.fillStyle = '#2e86c1';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.42, b.h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.3, b.h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.12, b.h * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (b.style === 'tower') {
    // Rooftop details: AC units and a helipad on the tallest.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const n = Math.min(4, Math.floor(b.w / 50));
    for (let i = 0; i < n; i++) {
      ctx.fillRect(b.x + 12 + i * 26, b.y + 12, 16, 12);
    }
    if (b.floors >= 8) {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(b.x + b.w - 26, b.y + b.h - 26, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w - 26, b.y + b.h - 21);
      ctx.textAlign = 'left';
    }
  } else if (b.style === 'house') {
    // A pitched roof read: a lighter ridge down the middle.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + b.w / 2 - 4, b.y + 4, 8, b.h - 8);
  }
  // Lit windows at night on towers.
  if (dark > 0.5 && b.style === 'tower') {
    ctx.fillStyle = 'rgba(255, 220, 120, 0.85)';
    const cols = Math.floor(b.w / 18);
    const rows = Math.floor(b.h / 18);
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (((cx * 7 + cy * 13 + b.x) % 5) < 2) {
          ctx.fillRect(b.x + 8 + cx * 18, b.y + 8 + cy * 18, 8, 8);
        }
      }
    }
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp255(((n >> 16) & 255) + amount);
  const g = clamp255(((n >> 8) & 255) + amount);
  const b = clamp255((n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function drawMarkers(ctx, state) {
  // Mission start marker: a gold pillar with a !.
  const start = state.missions.missionStartPoint(state);
  if (start) {
    const bob = Math.sin(state.time * 3) * 4;
    ctx.save();
    ctx.translate(start.x, start.y + bob - 30);
    ctx.fillStyle = 'rgba(245,197,24,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 14);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  // Current objective ring.
  const target = state.missions.currentTarget(state);
  if (target) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = 'rgba(245,197,24,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,197,24,0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
