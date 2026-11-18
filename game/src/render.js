// Drawing only: the city, its cars and people, the effects, then the HUD.
// The camera follows the player with a little lookahead and is clamped to
// the city, so the beach and the water stay in frame at the south edge.
// Cloud shadows drift over the world, slow and soft, so the noon sun feels
// alive even when the street is still.

import { BEACH, CLOUDS, PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { missionObjective } from './missions.js';
import { drawHud, drawScreenPanel, SCREEN_PLAY } from './hud.js';

const SKIN = '#e8b98a';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1, zoomOverride: null };
  let lastTime = 0;

  // Cloud shadows: seeded positions, drifting east, wrapping around the map.
  const clouds = [];
  {
    let s = 1234567;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < CLOUDS.count; i += 1) {
      clouds.push({
        x: rnd() * WORLD.width,
        y: rnd() * WORLD.height,
        rx: CLOUDS.minR + rnd() * (CLOUDS.maxR - CLOUDS.minR),
        ry: 0,
        speed: CLOUDS.speedMin + rnd() * (CLOUDS.speedMax - CLOUDS.speedMin),
      });
      clouds[i].ry = clouds[i].rx * (0.55 + rnd() * 0.3);
    }
  }

  function setZoomOverride(zoom) {
    camera.zoomOverride = zoom;
    camera.zoom = zoom;
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function updateCamera(targetX, targetY, dt) {
    const k = Math.min(1, 4.5 * dt);
    camera.x += (targetX - camera.x) * k;
    camera.y += (targetY - camera.y) * k;
    camera.x = Math.max(VIEW.width / 2 - 160, Math.min(WORLD.width - VIEW.width / 2 + 160, camera.x));
    camera.y = Math.max(VIEW.height / 2 - 160, Math.min(WORLD.height - VIEW.height / 2 + 160, camera.y));
  }

  function setCamera(x, y) {
    camera.x = x;
    camera.y = y;
  }

  // Canvas CSS pixels (from the mouse) into world coordinates.
  function screenToWorld(cx, cy) {
    const px = cx * view.ratio;
    const py = cy * view.ratio;
    const z = camera.zoom;
    const centreX = view.x + (VIEW.width * view.scale) / 2;
    const centreY = view.y + (VIEW.height * view.scale) / 2;
    return { x: (px - centreX) / (view.scale * z) + camera.x, y: (py - centreY) / (view.scale * z) + camera.y };
  }

  function inView(x, y, margin) {
    const halfW = VIEW.width / 2 / camera.zoom;
    const halfH = VIEW.height / 2 / camera.zoom;
    return x > camera.x - halfW - margin && x < camera.x + halfW + margin
      && y > camera.y - halfH - margin && y < camera.y + halfH + margin;
  }

  function drawGround(state, time) {
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    for (const block of state.city.blocks) {
      if (!inView(block.x + block.w / 2, block.y + block.h / 2, Math.max(block.w, block.h))) continue;
      if (block.kind === 'park') {
        context.fillStyle = PALETTE.grass;
        context.fillRect(block.x, block.y, block.w, block.h);
        context.fillStyle = PALETTE.water;
        context.beginPath();
        context.arc(block.pond.x, block.pond.y, block.pond.r, 0, Math.PI * 2);
        context.fill();
      } else if (block.kind === 'plaza') {
        context.fillStyle = '#e3dcc8';
        context.fillRect(block.x, block.y, block.w, block.h);
        context.fillStyle = PALETTE.water;
        context.beginPath();
        context.arc(block.fountain.x, block.fountain.y, block.fountain.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#c9bfa5';
        context.beginPath();
        context.arc(block.fountain.x, block.fountain.y, block.fountain.r * 0.45, 0, Math.PI * 2);
        context.fill();
      } else if (block.kind === 'docks') {
        context.fillStyle = '#b8a888';
        context.fillRect(block.x, block.y, block.w, block.h);
      } else if (block.kind === 'market') {
        context.fillStyle = '#d8c49a';
        context.fillRect(block.x, block.y, block.w, block.h);
      } else {
        context.fillStyle = PALETTE.pavement;
        context.fillRect(block.x, block.y, block.w, block.h);
      }
    }
    // Beach sand and the sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH.sandY, WORLD.width, BEACH.waterY - BEACH.sandY);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH.waterY, WORLD.width, WORLD.height - BEACH.waterY);
    // Drifting wave lines and sun glints on the water.
    context.strokeStyle = PALETTE.wave;
    context.lineWidth = 3;
    for (let row = 0; row < 3; row += 1) {
      const wy = BEACH.waterY + 14 + row * 22;
      context.beginPath();
      for (let x = 0; x <= WORLD.width; x += 60) {
        const wobble = Math.sin(x / 90 + time * 1.4 + row * 2) * 4;
        if (x === 0) context.moveTo(x, wy + wobble);
        else context.lineTo(x, wy + wobble);
      }
      context.stroke();
    }
    context.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = 40; x < WORLD.width; x += 90) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + x * 0.37);
      if (twinkle < 0.55) continue;
      const gy = BEACH.waterY + 10 + ((x * 13) % 60);
      if (!inView(x, gy, 20)) continue;
      context.globalAlpha = (twinkle - 0.5) * 1.2;
      context.fillRect(x, gy, 10, 2);
    }
    context.globalAlpha = 1;
  }

  function drawRoads(state) {
    const hw = ROADS.halfWidth;
    // Sidewalks first, then asphalt, so the kerb shows around every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS.vertical) context.fillRect(x - hw - ROADS.sidewalk, 0, (hw + ROADS.sidewalk) * 2, WORLD.height);
    for (const y of ROADS.horizontal) context.fillRect(0, y - hw - ROADS.sidewalk, WORLD.width, (hw + ROADS.sidewalk) * 2);
    context.fillStyle = PALETTE.road;
    for (const x of ROADS.vertical) context.fillRect(x - hw, 0, hw * 2, WORLD.height);
    for (const y of ROADS.horizontal) context.fillRect(0, y - hw, WORLD.width, hw * 2);
    // Centre dashes.
    context.strokeStyle = PALETTE.dash;
    context.lineWidth = 4;
    context.setLineDash([26, 30]);
    context.beginPath();
    for (const x of ROADS.vertical) {
      context.moveTo(x, 0);
      context.lineTo(x, WORLD.height);
    }
    for (const y of ROADS.horizontal) {
      context.moveTo(0, y);
      context.lineTo(WORLD.width, y);
    }
    context.stroke();
    context.setLineDash([]);
    // Crosswalks at every crossing.
    context.fillStyle = PALETTE.crosswalk;
    for (const p of state.city.intersections) {
      if (!inView(p.x, p.y, 120)) continue;
      for (let i = -2; i <= 2; i += 1) {
        context.fillRect(p.x + i * 16 - 5, p.y - hw - 16, 10, 12);
        context.fillRect(p.x + i * 16 - 5, p.y + hw + 4, 10, 12);
        context.fillRect(p.x - hw - 16, p.y + i * 16 - 5, 12, 10);
        context.fillRect(p.x + hw + 4, p.y + i * 16 - 5, 12, 10);
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      // A soft shadow thrown to the south-east; taller blocks throw it further.
      const shX = 6 + (b.height || 1) * 4;
      const shY = 8 + (b.height || 1) * 5;
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + shX, b.y + shY, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(b.x, b.y, b.w, 10);
      context.fillRect(b.x, b.y, 10, b.h);
      // Rooftop: a paler inset with a few vents, placed by the building's seed.
      context.fillStyle = 'rgba(255,255,255,0.28)';
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      const vents = 2 + (b.seed % 3);
      for (let i = 0; i < vents; i += 1) {
        const vx = b.x + 18 + ((b.seed * 37 + i * 53) % Math.max(20, b.w - 44));
        const vy = b.y + 18 + ((b.seed * 91 + i * 29) % Math.max(20, b.h - 44));
        context.fillRect(vx, vy, 14, 10);
      }
      // One building in seven has a rooftop pool.
      if (b.seed % 7 === 0 && b.w > 90 && b.h > 70) {
        context.fillStyle = '#4db2d8';
        context.beginPath();
        context.roundRect(b.x + b.w * 0.55, b.y + b.h * 0.3, b.w * 0.32, b.h * 0.4, 8);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillRect(b.x + b.w * 0.58, b.y + b.h * 0.33, b.w * 0.26, 5);
      }
    }
    for (const block of state.city.blocks) {
      if (block.crates) {
        for (const c of block.crates) {
          if (!inView(c.x, c.y, 60)) continue;
          context.fillStyle = 'rgba(0,0,0,0.2)';
          context.fillRect(c.x + 4, c.y + 5, c.w, c.h);
          context.fillStyle = c.color;
          context.fillRect(c.x, c.y, c.w, c.h);
          context.strokeStyle = 'rgba(0,0,0,0.25)';
          context.lineWidth = 2;
          context.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        }
      }
      if (block.stalls) {
        for (const s of block.stalls) {
          if (!inView(s.x, s.y, 60)) continue;
          context.fillStyle = 'rgba(0,0,0,0.18)';
          context.fillRect(s.x + 3, s.y + 4, s.w, s.h);
          // The stall counter, then a striped awning over it.
          context.fillStyle = '#8a6f4d';
          context.fillRect(s.x, s.y + 8, s.w, s.h - 8);
          context.fillStyle = s.color;
          context.fillRect(s.x, s.y, s.w, 12);
          context.fillStyle = 'rgba(255,255,255,0.6)';
          for (let stripe = 0; stripe * 14 < s.w; stripe += 2) {
            context.fillRect(s.x + stripe * 14, s.y, 7, 12);
          }
        }
      }
    }
  }

  function drawPalm(x, y, s, time, seed) {
    if (!inView(x, y, 60)) return;
    const sway = Math.sin(time * 0.9 + seed) * 0.08;
    const topX = x + Math.sin(sway) * 6;
    const topY = y - 14 * s;
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.ellipse(x + 6, y + 8, 16 * s, 7 * s, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.palmTrunk;
    context.lineWidth = 4 * s;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(topX, topY);
    context.stroke();
    context.fillStyle = PALETTE.palmLeaf;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + sway;
      context.save();
      context.translate(topX, topY);
      context.rotate(a);
      context.beginPath();
      context.ellipse(11 * s, 0, 12 * s, 4.5 * s, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.fillStyle = '#6fbf6a';
    context.beginPath();
    context.arc(topX, topY, 4 * s, 0, Math.PI * 2);
    context.fill();
  }

  function drawUmbrella(u) {
    if (!inView(u.x, u.y, 50)) return;
    // A towel beside it, then the pole and the striped canopy.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.save();
    context.translate(u.x + 16, u.y + 12);
    context.rotate(u.angle);
    context.fillRect(-11, -6, 22, 12);
    context.restore();
    context.fillStyle = 'rgba(0,0,0,0.15)';
    context.beginPath();
    context.ellipse(u.x + 5, u.y + 6, 20, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#8a6b45';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(u.x, u.y);
    context.lineTo(u.x, u.y - 4);
    context.stroke();
    context.fillStyle = u.color;
    context.beginPath();
    context.arc(u.x, u.y - 4, 17, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i += 1) {
      const a0 = u.angle + (i / 4) * Math.PI * 2;
      context.beginPath();
      context.moveTo(u.x, u.y - 4);
      context.arc(u.x, u.y - 4, 17, a0, a0 + Math.PI / 4);
      context.closePath();
      context.fill();
    }
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.arc(u.x, u.y - 4, 3, 0, Math.PI * 2);
    context.fill();
  }

  function drawStashes(state, time) {
    for (const s of state.stashes) {
      if (!inView(s.x, s.y, 60)) continue;
      const pulse = 1 + Math.sin(time * 3 + s.x) * 0.15;
      // A soft green glow, then the cash bag.
      context.fillStyle = 'rgba(80,220,120,0.25)';
      context.beginPath();
      context.arc(s.x, s.y, 22 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2e9e4f';
      context.beginPath();
      context.roundRect(s.x - 11, s.y - 9, 22, 18, 5);
      context.fill();
      context.strokeStyle = '#1d6b34';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#eafff0';
      context.font = 'bold 15px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('$', s.x, s.y + 1);
    }
  }

  function drawMarker(state, time) {
    const obj = missionObjective(state.missions);
    if (!obj || obj.x === null) return;
    if (!inView(obj.x, obj.y, 160)) return;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    // A beam of light and a ring on the ground.
    const grad = context.createLinearGradient(0, obj.y - 150, 0, obj.y);
    grad.addColorStop(0, 'rgba(255,210,63,0)');
    grad.addColorStop(1, 'rgba(255,210,63,0.35)');
    context.fillStyle = grad;
    context.fillRect(obj.x - 14, obj.y - 150, 28, 150);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.ellipse(obj.x, obj.y, 34 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.save();
    context.translate(obj.x, obj.y - 60 - Math.sin(time * 3) * 8);
    context.rotate(Math.PI / 4);
    context.fillRect(-9, -9, 18, 18);
    context.restore();
  }

  function drawSkids(state) {
    for (const s of state.effects.skids) {
      if (!inView(s.x, s.y, 40)) continue;
      context.strokeStyle = `rgba(20,20,20,${0.35 * Math.min(1, s.life / 2)})`;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      context.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.effects.particles) {
      if (!inView(p.x, p.y, 40)) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      context.globalAlpha = alpha;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (0.6 + 0.4 * alpha), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const ring of state.effects.rings) {
      const alpha = Math.max(0, ring.life / ring.maxLife);
      context.strokeStyle = `rgba(255,180,80,${0.7 * alpha})`;
      context.lineWidth = 4 * alpha + 1;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawCloudShadows(dt) {
    for (const cloud of clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x - cloud.rx > WORLD.width) cloud.x = -cloud.rx;
      if (!inView(cloud.x, cloud.y, cloud.rx)) continue;
      const grad = context.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.rx);
      grad.addColorStop(0, `rgba(20,40,60,${CLOUDS.alpha})`);
      grad.addColorStop(1, 'rgba(20,40,60,0)');
      context.fillStyle = grad;
      context.save();
      context.translate(cloud.x, cloud.y);
      context.scale(1, cloud.ry / cloud.rx);
      context.translate(-cloud.x, -cloud.y);
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.rx, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawCar(car, time) {
    if (!inView(car.x, car.y, 80)) return;
    const t = car.type;
    const half = t.length / 2;
    const wide = t.width / 2;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.roundRect(-half + 4, -wide + 6, t.length, t.width, 8);
    context.fill();
    // Wheels.
    context.fillStyle = '#1a1a1a';
    context.fillRect(-half + 6, -wide - 2, 12, 6);
    context.fillRect(-half + 6, wide - 4, 12, 6);
    context.fillRect(half - 18, -wide - 2, 12, 6);
    context.fillRect(half - 18, wide - 4, 12, 6);
    // Body. A burnt wreck is charred black with no shine left.
    context.fillStyle = car.burnt ? '#26262a' : car.color;
    context.beginPath();
    context.roundRect(-half, -wide, t.length, t.width, 9);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    context.lineWidth = 1.5;
    context.stroke();
    if (car.burnt) {
      context.fillStyle = 'rgba(255,120,40,0.25)';
      context.beginPath();
      context.roundRect(-half + 6, -wide + 4, t.length - 12, t.width - 8, 6);
      context.fill();
      context.restore();
      // A wrecked car keeps smoking until the tow truck takes it.
      for (let i = 0; i < 2; i += 1) {
        const drift = ((time * 24 + i * 30) % 60) - 30;
        context.fillStyle = `rgba(90,90,90,${0.3 - Math.abs(drift) / 120})`;
        context.beginPath();
        context.arc(car.x + drift * 0.2, car.y - 8 - Math.abs(drift) * 0.5, 5 + Math.abs(drift) * 0.1, 0, Math.PI * 2);
        context.fill();
      }
      return;
    }
    if (car.typeId === 'interceptor') {
      // Black hood and boot, white middle, like a patrol car.
      context.fillStyle = '#1c2733';
      context.beginPath();
      context.roundRect(-half, -wide, 14, t.width, [9, 0, 0, 9]);
      context.fill();
      context.beginPath();
      context.roundRect(half - 14, -wide, 14, t.width, [0, 9, 9, 0]);
      context.fill();
    }
    // Windshield, rear window and roof.
    context.fillStyle = '#9fc6d8';
    context.fillRect(half - 24, -wide + 4, 10, t.width - 8);
    context.fillRect(-half + 12, -wide + 4, 8, t.width - 8);
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.fillRect(-half + 22, -wide + 5, t.length - 50, t.width - 10);
    // Each kind reads at a glance: the van's long roof, the pickup's bed,
    // the sports car's spoiler.
    if (t.kind === 'van') {
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(-half + 8, -wide + 6, t.length - 30, t.width - 12);
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.fillRect(-half + 12, -wide + 8, t.length - 38, 6);
    } else if (t.kind === 'pickup') {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(-half + 4, -wide + 4, 16, t.width - 8);
    } else if (t.kind === 'sports') {
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(-half - 1, -wide + 2, 5, t.width - 4);
    }
    // Headlights and brake lights.
    context.fillStyle = '#fff6b0';
    context.beginPath();
    context.arc(half - 3, -wide + 5, 3, 0, Math.PI * 2);
    context.arc(half - 3, wide - 5, 3, 0, Math.PI * 2);
    context.fill();
    if (car.brake) {
      context.fillStyle = '#ff2222';
      context.beginPath();
      context.arc(-half + 3, -wide + 5, 3.5, 0, Math.PI * 2);
      context.arc(-half + 3, wide - 5, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    // The police light bar flashes red and blue.
    if (car.typeId === 'interceptor') {
      const phase = Math.floor(car.siren * 6) % 2 === 0;
      context.fillStyle = phase ? '#ff2b2b' : '#2b6bff';
      context.fillRect(-6, -wide + 3, 12, 8);
      context.fillStyle = phase ? '#2b6bff' : '#ff2b2b';
      context.fillRect(-6, wide - 11, 12, 8);
    }
    context.restore();
    // Smoke from a dying engine.
    if (car.health < 30 && !car.dead) {
      for (let i = 0; i < 3; i += 1) {
        const drift = ((time * 30 + i * 22) % 60) - 30;
        context.fillStyle = `rgba(120,120,120,${0.35 - Math.abs(drift) / 100})`;
        context.beginPath();
        context.arc(car.x + Math.cos(car.angle) * 14 + drift * 0.3, car.y - 10 - Math.abs(drift) * 0.6, 6 + Math.abs(drift) * 0.12, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPerson(x, y, angle, shirt, down, gunAngle, highlight, hat) {
    if (!inView(x, y, 60)) return;
    if (down) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath();
      context.ellipse(x + 3, y + 4, 14, 7, angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(x, y, 13, 7, angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = SKIN;
      context.beginPath();
      context.arc(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, 5, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(x + 3, y + 4, 11, 6, 0, 0, Math.PI * 2);
    context.fill();
    if (highlight) {
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 17, 0, Math.PI * 2);
      context.stroke();
    }
    // Legs, body, head — a person seen from above.
    context.fillStyle = '#2c2c34';
    context.beginPath();
    context.arc(x - Math.cos(angle) * 3, y - Math.sin(angle) * 3, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(x, y, 9.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = SKIN;
    context.beginPath();
    context.arc(x + Math.cos(angle) * 2, y + Math.sin(angle) * 2, 5.5, 0, Math.PI * 2);
    context.fill();
    if (hat) {
      // A white cap, so a cop reads at a glance on dark asphalt.
      context.fillStyle = '#f2f2f2';
      context.beginPath();
      context.arc(x - Math.cos(angle) * 1.5, y - Math.sin(angle) * 1.5, 4.5, 0, Math.PI * 2);
      context.fill();
    }
    if (gunAngle !== null && gunAngle !== undefined) {
      context.strokeStyle = '#222222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x + Math.cos(gunAngle) * 8, y + Math.sin(gunAngle) * 8);
      context.lineTo(x + Math.cos(gunAngle) * 20, y + Math.sin(gunAngle) * 20);
      context.stroke();
    }
  }

  // A sunbather: a bright towel on the sand, a body lying on it.
  function drawSunbather(ped) {
    if (!inView(ped.x, ped.y, 60)) return;
    context.save();
    context.translate(ped.x, ped.y);
    context.rotate(ped.angle);
    context.fillStyle = ped.shirt;
    context.fillRect(-16, -9, 32, 18);
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.fillRect(-16, -9, 32, 5);
    context.restore();
    drawPerson(ped.x, ped.y, ped.angle, '#e8b98a', true, null, false, false);
  }

  function drawEffects(state) {
    for (const b of state.combat.bullets) {
      if (!b.active) continue;
      context.strokeStyle = '#fff2a0';
      context.lineWidth = 3.5;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.035, b.y - b.vy * 0.035);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const s of state.combat.sparks) {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + s.until * 20;
        context.beginPath();
        context.moveTo(s.x, s.y);
        context.lineTo(s.x + Math.cos(a) * 9, s.y + Math.sin(a) * 9);
        context.stroke();
      }
    }
    for (const f of state.combat.flashes) {
      context.fillStyle = 'rgba(255,220,90,0.9)';
      context.save();
      context.translate(f.x, f.y);
      context.rotate(f.angle);
      context.beginPath();
      context.moveTo(0, -5);
      context.lineTo(16, 0);
      context.lineTo(0, 5);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawWorld(state, time, dt) {
    const z = camera.zoom;
    const shake = state.effects.shake;
    const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    context.setTransform(view.scale * z, 0, 0, view.scale * z, view.x + (VIEW.width * view.scale) / 2, view.y + (VIEW.height * view.scale) / 2);
    context.translate(-camera.x + shX, -camera.y + shY);
    drawGround(state, time);
    drawRoads(state);
    drawSkids(state);
    drawBuildings(state);
    for (const palm of state.city.palms) drawPalm(palm.x, palm.y, palm.s, time, palm.x);
    for (const u of state.city.umbrellas) drawUmbrella(u);
    drawMarker(state, time);
    drawStashes(state, time);
    // Cars, people and the player, sorted so nearer things draw over farther ones.
    const actors = [];
    const queueCar = (car) => actors.push({ y: car.y, draw: () => drawCar(car, time) });
    for (const car of state.traffic.cars) queueCar(car);
    for (const car of state.traffic.parked) queueCar(car);
    for (const car of state.police.copCars) queueCar(car);
    if (state.missionCar) queueCar(state.missionCar);
    for (const ped of state.peds.peds) {
      if (ped.state === 'sun') actors.push({ y: ped.y, draw: () => drawSunbather(ped) });
      else actors.push({ y: ped.y, draw: () => drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.state === 'down', null, false) });
    }
    for (const cop of state.police.footCops) {
      actors.push({ y: cop.y, draw: () => drawPerson(cop.x, cop.y, cop.angle, PALETTE.cop, cop.dead, cop.angle, false, true) });
    }
    const player = state.player;
    if (player.onFoot) {
      actors.push({
        y: player.y,
        draw: () => drawPerson(player.x, player.y, player.angle, PALETTE.player, false, player.aimAngle, true),
      });
    } else if (player.car) {
      queueCar(player.car);
    }
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) actor.draw();
    drawEffects(state);
    drawParticles(state);
    drawCloudShadows(dt);
  }

  function draw(state, screen, save, penalty, time, hintAlpha) {
    // The camera pulls back a little at speed, so the road ahead stays visible.
    // A staged shot can pin the zoom instead.
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    if (camera.zoomOverride !== null) {
      camera.zoom = camera.zoomOverride;
    } else {
      const player = state.player;
      const speed = player.car ? Math.hypot(player.car.vx, player.car.vy) : 0;
      const targetZoom = 1 - Math.min(0.12, (speed / 540) * 0.12);
      camera.zoom += (targetZoom - camera.zoom) * Math.min(1, 2.5 * dt);
    }
    lastTime = time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(state, time, dt);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY) drawHud(context, state, time, hintAlpha);
    drawScreenPanel(context, screen, state, save, penalty, time);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, updateCamera, setCamera, setZoomOverride, screenToWorld, camera };
}
