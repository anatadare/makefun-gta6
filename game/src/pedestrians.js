// pedestrians.js — the people of Solmara: walkers on the sidewalks, joggers
// on the promenade, vendors at their carts, and taxi passengers waiting for
// a ride. They flee from gunfire and near misses, and they keep the city
// feeling alive between the action.

import { PEDS, WORLD } from './config.js';
import { makeRand, distance, clamp } from './random.js';
import { randomSidewalkPoint, collideCircle, isOnRoad } from './world.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#fd79a8', '#00b894'];
const PANTS = ['#2c3e50', '#7f8c8d', '#5d4037', '#37474f', '#4a235a'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

let nextPedId = 1;

export function createPed(x, y, kind) {
  return {
    id: nextPedId++,
    kind: kind || 'walker', // walker | jogger | vendor | passenger
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    target: null,
    state: 'walk', // walk | flee | wait | ride | down
    stateTimer: 0,
    shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    pants: PANTS[Math.floor(Math.random() * PANTS.length)],
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    hair: Math.random() < 0.5 ? '#2c1e12' : '#6b4a2f',
    health: 30,
    down: false,
    bobPhase: Math.random() * 10,
    cart: null,
    fare: null,
  };
}

export function spawnPeds(city, seed) {
  const rand = makeRand(seed + 991);
  const peds = [];
  for (let i = 0; i < PEDS.count; i++) {
    const p = randomSidewalkPoint(rand);
    const ped = createPed(p.x, p.y, rand.chance(0.12) ? 'jogger' : 'walker');
    ped.target = randomSidewalkPoint(rand);
    ped.speed = ped.kind === 'jogger'
      ? PEDS.jogSpeed
      : rand.float(PEDS.walkMin, PEDS.walkMax);
    peds.push(ped);
  }
  // Vendors stand at their carts.
  for (const spot of city.vendorSpots) {
    const ped = createPed(spot.x, spot.y + 16, 'vendor');
    ped.cart = spot.kind;
    ped.state = 'wait';
    ped.angle = -Math.PI / 2;
    peds.push(ped);
  }
  // A few joggers run the beach promenade.
  for (let i = 0; i < 4; i++) {
    const ped = createPed(rand.float(200, WORLD.width - 200), 2405, 'jogger');
    ped.target = { x: rand.float(200, WORLD.width - 200), y: 2405 };
    ped.speed = PEDS.jogSpeed;
    peds.push(ped);
  }
  return peds;
}

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down || ped.kind === 'vendor') continue;
    if (distance(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.stateTimer = 3 + Math.random() * 2;
      ped.fleeFrom = { x, y };
    }
  }
}

export function updatePeds(state, dt) {
  const { city, peds, player } = state;
  for (const ped of peds) {
    if (ped.down) continue;
    ped.bobPhase += dt * (ped.state === 'flee' ? 14 : ped.kind === 'jogger' ? 12 : 7);

    if (ped.state === 'wait' || ped.kind === 'vendor') {
      // Vendors and waiting passengers stand still, watching the street.
      ped.angle += Math.sin(ped.bobPhase * 0.3) * dt * 0.2;
      continue;
    }

    if (ped.state === 'flee') {
      ped.stateTimer -= dt;
      const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      ped.angle = away;
      movePed(state, ped, PEDS.fleeSpeed, dt);
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.target = randomSidewalkPoint(state.rand);
      }
      continue;
    }

    // Walkers and joggers head for their target, then pick a new one.
    if (!ped.target || distance(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
      ped.target = ped.kind === 'jogger' && ped.y > 2350
        ? { x: state.rand.float(200, WORLD.width - 200), y: 2405 }
        : randomSidewalkPoint(state.rand);
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    let d = want - ped.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ped.angle += clamp(d, -3 * dt, 3 * dt);
    movePed(state, ped, ped.speed, dt);

    // A car bearing down on a pedestrian makes them dive out of the way.
    for (const car of state.cars) {
      if (car.dead || Math.abs(car.speed) < 60) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 130 && side < 30) {
        ped.state = 'flee';
        ped.stateTimer = 2.5;
        ped.fleeFrom = { x: car.x, y: car.y };
        break;
      }
    }

    // Recycle walkers that wandered far from the player.
    if (distance(ped.x, ped.y, player.x, player.y) > 1600 && ped.kind !== 'vendor') {
      const p = randomSidewalkPoint(state.rand);
      ped.x = clamp(player.x + (p.x - 1800) * 0.4, 60, WORLD.width - 60);
      ped.y = clamp(player.y + (p.y - 1350) * 0.4, 60, 2400);
      ped.target = randomSidewalkPoint(state.rand);
    }
  }
}

function movePed(state, ped, speed, dt) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const resolved = collideCircle(state.city, nx, ny, 10);
  ped.x = resolved.x;
  ped.y = resolved.y;
  // Walkers avoid standing in the road: nudge them toward the sidewalk.
  if (ped.kind === 'walker' && isOnRoad(ped.x, ped.y, -6)) {
    ped.target = randomSidewalkPoint(state.rand);
  }
}

export function drawPed(ctx, ped, night) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  const bob = Math.sin(ped.bobPhase) * (ped.state === 'flee' || ped.kind === 'jogger' ? 2.5 : 1.2);

  if (ped.kind === 'vendor' && ped.cart) {
    drawCart(ctx, ped);
  }

  ctx.rotate(ped.angle + Math.PI / 2);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-5, -2 + bob, 4, 10);
  ctx.fillRect(1, -2 - bob, 4, 10);
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -3, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms.
  ctx.fillStyle = ped.skin;
  ctx.fillRect(-9, -6 + bob, 3, 8);
  ctx.fillRect(6, -6 - bob, 3, 8);
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.hair;
  ctx.beginPath();
  ctx.arc(0, -13, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Passenger marker: a waving hand.
  if (ped.kind === 'passenger') {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('TAXI?', -16, -22);
  }
  ctx.restore();

  if (ped.down) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(169,50,38,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCart(ctx, ped) {
  const colors = { tacos: '#e67e22', dogs: '#c0392b', fruit: '#27ae60', ice: '#85c1e9', coffee: '#6e4b2a' };
  ctx.fillStyle = colors[ped.cart] || '#e67e22';
  ctx.fillRect(-14, -26, 28, 14);
  ctx.fillStyle = '#f8f9f9';
  ctx.fillRect(-14, -26, 28, 4);
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-9, -10, 3, 0, Math.PI * 2);
  ctx.arc(9, -10, 3, 0, Math.PI * 2);
  ctx.fill();
}
