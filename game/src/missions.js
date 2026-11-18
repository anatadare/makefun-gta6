// The story: seven jobs from Lena the fixer and Otis the garage owner, then
// repeatable fares for money. A mission is a list of steps, each one a kind
// the updater checks: reach a place, steal a car, lose the cops, beat a
// clock, wreck a number of cop cars. The world owns the player and the
// police; this module only reads them through the context the world passes
// in, and reports progress back as events.

import { MISSIONS, POLICE } from './config.js';
import { PLACES } from './city.js';

const FARE_PLACES = ['taxiStand', 'marinaHotel', 'garage', 'docks', 'hideout', 'hospital', 'beach', 'policeStation'];

const DEFS = [
  {
    id: 'fare',
    title: 'First Fare',
    reward: 150,
    intro: 'LENA: Mars, I need a driver. Taxi stand, downtown. Now.',
    outro: 'LENA: Clean run. $150 is yours.',
    steps: [
      { kind: 'goto', place: 'taxiStand', text: 'Pick up the fare at the Taxi Stand' },
      { kind: 'wait', seconds: 1.5, text: 'Passenger getting in...' },
      { kind: 'goto', place: 'marinaHotel', text: 'Drop the passenger at the Marina Hotel' },
    ],
  },
  {
    id: 'wheels',
    title: 'Hot Wheels',
    reward: 300,
    intro: 'OTIS: A Fuego is parked by the docks. Bring it to my garage. Few scratches.',
    outro: 'OTIS: Beautiful. $300, and the garage is open to you.',
    steps: [
      { kind: 'goto', place: 'docks', text: 'Find the Fuego at the Docks' },
      { kind: 'steal', text: 'Steal the Fuego' },
      { kind: 'goto', place: 'garage', text: "Deliver the Fuego to Otis's Garage" },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    reward: 500,
    intro: 'LENA: The job went loud. Three stars on you. Reach the hideout and lie low.',
    outro: 'LENA: They lost you. $500. You drive like the wind, Mars.',
    steps: [
      { kind: 'goto', place: 'hideout', text: 'Reach the Hideout in Palm Heights' },
      { kind: 'lose', text: 'Stay out of sight until the heat dies down' },
    ],
  },
  {
    id: 'drops',
    title: 'Three Drops',
    reward: 700,
    intro: 'OTIS: Three packages, three stops, no dawdling. Docks first, then the station, the hospital, the hideout.',
    outro: 'OTIS: All three delivered. $700. You are getting fast, Mars.',
    steps: [
      { kind: 'goto', place: 'docks', text: 'Pick up the packages at the Docks' },
      { kind: 'timed', place: 'policeStation', seconds: 60, text: 'Drop one at the Police Station' },
      { kind: 'timed', place: 'hospital', seconds: 60, text: 'Drop one at Solmara General' },
      { kind: 'timed', place: 'hideout', seconds: 60, text: 'Drop the last one at the Hideout' },
    ],
  },
  {
    id: 'delivery',
    title: 'The Last Delivery',
    reward: 800,
    intro: 'OTIS: One package at the docks, one buyer in Palm Heights. Ninety seconds.',
    outro: 'OTIS: Done. $800. One more job after this, and we are square.',
    steps: [
      { kind: 'goto', place: 'docks', text: 'Pick up the package at the Docks' },
      { kind: 'timed', place: 'hideout', seconds: 90, text: 'Deliver to Palm Heights before the clock runs out' },
    ],
  },
  {
    id: 'sprint',
    title: 'The Solmara Sprint',
    reward: 1200,
    intro: 'LENA: One last job. A sprint across the whole town, five stops, beat the clock at every one. Show them what you can do.',
    outro: 'LENA: That is the whole town, Mars. $1,200. Solmara is yours now.',
    steps: [
      { kind: 'timed', place: 'garage', seconds: 40, text: "Sprint: Otis's Garage" },
      { kind: 'timed', place: 'policeStation', seconds: 30, text: 'Sprint: Police Station' },
      { kind: 'timed', place: 'hospital', seconds: 30, text: 'Sprint: Solmara General' },
      { kind: 'timed', place: 'marinaHotel', seconds: 40, text: 'Sprint: Marina Hotel' },
      { kind: 'timed', place: 'beach', seconds: 30, text: 'Sprint: Seabreeze Beach' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    reward: 1500,
    intro: 'OTIS: The PD impounded my best car. Wreck two of their Interceptors, then come see me. Do not get caught.',
    outro: 'OTIS: That is for my car. $1,500. Now we are square, Mars. Really square.',
    steps: [
      { kind: 'wreck', count: 2, text: 'Wreck 2 police Interceptors' },
      { kind: 'goto', place: 'garage', text: "Get back to Otis's Garage" },
    ],
  },
];

export const MISSION_COUNT = DEFS.length;

export function createMissions(savedIndex) {
  const index = Math.max(0, Math.min(savedIndex || 0, DEFS.length));
  return {
    index,
    step: 0,
    active: false,
    timer: 0,
    waitLeft: 0,
    wrecks: 0,
    targetCar: null,
    fare: null,
    fareCooldown: 0,
    storyDone: index >= DEFS.length,
  };
}

export function currentMission(missions) {
  return missions.index < DEFS.length ? DEFS[missions.index] : null;
}

export function currentStep(missions) {
  if (missions.fare) return missions.fare.steps[missions.step] ?? null;
  const mission = currentMission(missions);
  if (!mission || !missions.active) return null;
  return mission.steps[missions.step] ?? null;
}

// What the HUD and minimap show: the objective text and its map position.
export function missionObjective(missions) {
  const step = currentStep(missions);
  if (!step) return null;
  const out = { text: step.text, x: null, y: null, timer: null };
  if (step.place) {
    const place = PLACES[step.place];
    out.x = place.x;
    out.y = place.y;
  }
  if (step.kind === 'timed') {
    out.timer = Math.max(0, Math.ceil(missions.timer));
    out.timerTotal = step.seconds;
  }
  if (step.kind === 'wreck') out.text = `${step.text} (${Math.min(missions.wrecks, step.count)}/${step.count})`;
  if (step.kind === 'steal' && missions.targetCar) {
    out.x = missions.targetCar.x;
    out.y = missions.targetCar.y;
  }
  return out;
}

// The world calls this when a cop car burns out; it only counts while a
// wreck step is live.
export function countWreck(missions) {
  const step = currentStep(missions);
  if (step && step.kind === 'wreck') missions.wrecks += 1;
}

function missionCarSpot() {
  return { x: PLACES.docks.x + 30, y: PLACES.docks.y - 40 };
}

export function startMission(missions, ctx) {
  const mission = currentMission(missions);
  if (!mission) return [];
  missions.active = true;
  missions.step = 0;
  missions.timer = 0;
  missions.waitLeft = 0;
  missions.wrecks = 0;
  const events = [{ type: 'message', text: mission.intro }];
  if (mission.id === 'wheels') {
    const spot = missionCarSpot();
    missions.targetCar = ctx.spawnMissionCar('fuego', spot.x, spot.y, '#ffd23f');
  }
  if (mission.id === 'getaway' || mission.id === 'payback') {
    ctx.setHeat(POLICE.starThresholds[3]);
  }
  return events;
}

function completeMission(missions, ctx) {
  const mission = currentMission(missions);
  const events = [{ type: 'message', text: mission.outro }, { type: 'complete', mission }];
  missions.index += 1;
  missions.active = false;
  missions.step = 0;
  missions.targetCar = null;
  if (missions.index >= DEFS.length) {
    missions.storyDone = true;
    missions.fareCooldown = 6;
    events.push({ type: 'message', text: 'STORY COMPLETE: Solmara is yours. Fares keep coming.' });
  }
  return events;
}

function failMission(missions) {
  const mission = currentMission(missions);
  missions.step = 0;
  missions.timer = 0;
  missions.waitLeft = 0;
  missions.wrecks = 0;
  return [
    { type: 'message', text: 'OTIS: Too late. The buyer walked. Try again.' },
    { type: 'failed', mission },
  ];
}

function startFare(missions, ctx) {
  const from = ctx.random.pick(FARE_PLACES);
  let to = ctx.random.pick(FARE_PLACES);
  while (to === from) to = ctx.random.pick(FARE_PLACES);
  const reward = ctx.random.int(50, 120);
  missions.fare = {
    from,
    to,
    reward,
    steps: [
      { kind: 'goto', place: from, text: `Fare waiting at ${PLACES[from].label}` },
      { kind: 'goto', place: to, text: `Drop the fare at ${PLACES[to].label}` },
    ],
  };
  missions.step = 0;
  return [{ type: 'message', text: `LENA: Fare at ${PLACES[from].label}, going to ${PLACES[to].label}. $${reward}.` }];
}

function atPlace(player, place, radius) {
  const p = PLACES[place];
  return Math.hypot(player.x - p.x, player.y - p.y) < radius;
}

// Advance one step of the active job; returns the events the world should
// act on (messages, completion, fares). A step that finishes hands over to
// the next one, or completes the mission when it was the last.
function advanceStep(missions, ctx) {
  missions.step += 1;
  if (missions.fare) {
    if (missions.step < missions.fare.steps.length) return [];
    const reward = missions.fare.reward;
    missions.fare = null;
    missions.fareCooldown = 5;
    return [{ type: 'message', text: `Fare done. +$${reward}.` }, { type: 'fare', reward }];
  }
  if (missions.step < currentMission(missions).steps.length) return [];
  return completeMission(missions, ctx);
}

export function updateMissions(missions, dt, ctx) {
  const events = [];
  const player = ctx.player;

  // After the story, fares chain themselves with a short breather between.
  if (missions.storyDone && !missions.fare) {
    missions.fareCooldown -= dt;
    if (missions.fareCooldown <= 0) events.push(...startFare(missions, ctx));
  }

  const step = currentStep(missions);
  if (!step) return events;
  const radius = player.onFoot ? 70 : 110;

  if (step.kind === 'goto') {
    if (atPlace(player, step.place, radius)) events.push(...advanceStep(missions, ctx));
    return events;
  }
  if (step.kind === 'wait') {
    if (missions.waitLeft <= 0) missions.waitLeft = step.seconds;
    missions.waitLeft -= dt;
    if (missions.waitLeft <= 0) events.push(...advanceStep(missions, ctx));
    return events;
  }
  if (step.kind === 'steal') {
    if (player.car === missions.targetCar) {
      events.push(...advanceStep(missions, ctx));
      ctx.addHeat(POLICE.crimeCarTheft);
      events.push({ type: 'message', text: 'OTIS: The cops saw that. Lose them or outrun them.' });
    }
    return events;
  }
  if (step.kind === 'lose') {
    if (ctx.police.stars === 0) events.push(...completeMission(missions, ctx));
    return events;
  }
  if (step.kind === 'wreck') {
    if (missions.wrecks >= step.count) events.push(...advanceStep(missions, ctx));
    return events;
  }
  if (step.kind === 'timed') {
    if (missions.timer <= 0) missions.timer = step.seconds;
    missions.timer -= dt;
    if (atPlace(player, step.place, radius)) {
      missions.timer = 0;
      events.push(...advanceStep(missions, ctx));
    } else if (missions.timer <= 0) {
      events.push(...failMission(missions));
    }
    return events;
  }
  return events;
}

export { MISSIONS };
