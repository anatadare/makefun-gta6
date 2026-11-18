// taxi.js — the taxi side job. Waiting passengers stand at curbs with a
// TAXI? marker; drive a taxi up to one and press E to take the fare. A
// destination appears on the map and the minimap; drop them off for the
// fare, and beat the clock on a rush fare for a bonus.

import { TAXI, ECONOMY } from './config.js';
import { distance, clamp } from './random.js';
import { randomRoadPoint, randomDestination } from './world.js';
import { createPed } from './pedestrians.js';

export function createTaxiState() {
  return {
    active: false,
    passenger: null,
    dest: null,
    fare: 0,
    rush: false,
    timer: 0,
    total: 0,
  };
}

export function spawnPassengers(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(state.rand);
    const side = Math.random() < 0.5 ? 1 : -1;
    const ped = createPed(
      p.x + side * 52,
      p.y + (Math.random() - 0.5) * 40,
      'passenger',
    );
    ped.state = 'wait';
    ped.angle = -Math.PI / 2;
    state.peds.push(ped);
  }
}

function nearestWaitingPassenger(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of state.peds) {
    if (ped.kind !== 'passenger' || ped.down || ped.state !== 'wait') continue;
    const d = distance(ped.x, ped.y, state.player.x, state.player.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

export function waitingPassengerNear(state, maxDist) {
  return nearestWaitingPassenger(state, maxDist) !== null;
}

export function tryPickup(state) {
  const taxi = state.taxi;
  if (taxi.active) return false;
  const player = state.player;
  if (player.onFoot || !player.car || player.car.type !== 'taxi') return false;
  const ped = nearestWaitingPassenger(state, 90);
  if (!ped) return false;
  const dest = randomDestination(state.rand, player.x, player.y, 600);
  const dist = distance(player.x, player.y, dest.x, dest.y);
  const rush = state.rand.chance(TAXI.rushChance);
  taxi.active = true;
  taxi.passenger = ped;
  taxi.dest = dest;
  taxi.fare = TAXI.fareMin + Math.floor(state.rand.float(0, TAXI.fareMax - TAXI.fareMin));
  taxi.rush = rush;
  taxi.timer = rush ? Math.max(25, dist * TAXI.rushTimePerPx) : 0;
  ped.state = 'ride';
  ped.x = player.x;
  ped.y = player.y;
  state.audio.horn();
  state.message = {
    text: rush
      ? `RUSH FARE! $${taxi.fare + 40} if you make it in ${Math.ceil(taxi.timer)}s`
      : `Fare started — take them to the marker ($${taxi.fare})`,
    timer: 3,
  };
  return true;
}

export function cancel(state, reason) {
  const taxi = state.taxi;
  if (!taxi.active) return;
  if (taxi.passenger) {
    taxi.passenger.state = 'wait';
    taxi.passenger.x = state.player.x + 40;
    taxi.passenger.y = state.player.y + 40;
  }
  taxi.active = false;
  taxi.passenger = null;
  taxi.dest = null;
  state.message = { text: reason, timer: 2 };
}

export function updateTaxi(state, dt) {
  const taxi = state.taxi;
  if (!taxi.active) return;
  const player = state.player;
  if (taxi.rush) {
    taxi.timer -= dt;
    if (taxi.timer <= 0) {
      // The rush window closed: the fare still pays, minus the bonus.
      taxi.rush = false;
      state.message = { text: 'Rush window missed — normal fare now', timer: 2 };
    }
  }
  if (player.car && distance(player.x, player.y, taxi.dest.x, taxi.dest.y) < 70) {
    completeFare(state);
  }
}

function completeFare(state) {
  const taxi = state.taxi;
  let payout = taxi.fare;
  if (taxi.rush) payout += TAXI.rushBonusMin + Math.floor(state.rand.float(0, TAXI.rushBonusMax - TAXI.rushBonusMin));
  state.money += payout;
  state.stats.moneyEarned += payout;
  taxi.total += 1;
  state.audio.cash();
  state.fx.cashPop(state.player.x, state.player.y);
  state.message = { text: `Fare complete! +$${payout}`, timer: 2.5 };
  if (taxi.passenger) {
    taxi.passenger.state = 'walk';
    taxi.passenger.target = { x: taxi.dest.x + 60, y: taxi.dest.y + 60 };
    taxi.passenger.kind = 'walker';
  }
  taxi.active = false;
  taxi.passenger = null;
  taxi.dest = null;
  // A new passenger appears somewhere else in the city.
  spawnPassengers(state, 1);
}

export function drawTaxiMarker(ctx, state) {
  const taxi = state.taxi;
  if (!taxi.active || !taxi.dest) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  ctx.save();
  ctx.translate(taxi.dest.x, taxi.dest.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = taxi.rush ? '#e74c3c' : '#f5c518';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 1);
  ctx.restore();
  // A guide line from the player toward the destination.
  ctx.save();
  ctx.strokeStyle = taxi.rush ? 'rgba(231,76,60,0.5)' : 'rgba(245,197,24,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(taxi.dest.x, taxi.dest.y);
  ctx.stroke();
  ctx.restore();
}
