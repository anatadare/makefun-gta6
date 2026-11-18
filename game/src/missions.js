// missions.js — the story of Solmara: eight missions from Sal Ferraro's
// garage to the finale heist, each a chain of steps (go, drive, fight,
// escape) with step-through dialogue, plus the enemy gang members the
// combat missions spawn and the dialogue box the whole game shares.

import { MISSION_REWARDS, STORY } from './config.js';
import { distance } from './random.js';

const SAL = STORY.fixerName;
const RIKO = STORY.playerName;
const VENN = STORY.rivalName;

export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Wheels',
    startAt: 'salGarage',
    reward: MISSION_REWARDS[0],
    intro: [
      { who: SAL, text: 'Riko! You made it to Solmara. Good. I need wheels, and I need them now.' },
      { who: RIKO, text: 'Hello to you too, Sal. What kind of wheels?' },
      { who: SAL, text: 'Any kind. Borrow one, bring it to the plaza. Do not let the cops see you take it.' },
    ],
    steps: [
      { type: 'enterCar', label: 'Steal a car (E next to one)' },
      { type: 'driveTo', at: 'downtownPlaza', radius: 90, label: 'Drive to Downtown Plaza' },
    ],
    outro: [
      { who: SAL, text: 'Clean work. You drive like you mean it. There will be more.' },
    ],
  },
  {
    id: 'm2',
    name: 'Delivery Run',
    startAt: 'harborWarehouse',
    reward: MISSION_REWARDS[1],
    intro: [
      { who: SAL, text: 'A crate came in at the harbor. Pick it up, drop it at the market, then the stadium.' },
      { who: RIKO, text: 'What is in the crate?' },
      { who: SAL, text: 'Less questions, more driving. The stadium crowd waits for no one.' },
    ],
    steps: [
      { type: 'pickup', at: 'harborWarehouse', radius: 70, label: 'Pick up the crate at the harbor' },
      { type: 'driveTo', at: 'oldTownMarket', radius: 90, label: 'Deliver to Old Town Market' },
      { type: 'driveTo', at: 'stadiumGate', radius: 90, label: 'Deliver to the Stadium Gate' },
    ],
    outro: [
      { who: SAL, text: 'On time, both stops. The stadium crew owes me one now.' },
    ],
  },
  {
    id: 'm3',
    name: 'The Informant',
    startAt: 'southsideAlley',
    reward: MISSION_REWARDS[2],
    intro: [
      { who: SAL, text: 'My informant in Southside has word on Venn. Meet him in the alley. Go alone.' },
      { who: RIKO, text: 'Venn. The name keeps coming up.' },
      { who: SAL, text: 'He runs the docks and he hates my guts. Watch your back down there.' },
    ],
    steps: [
      { type: 'goto', at: 'southsideAlley', radius: 70, label: 'Meet the informant in Southside Alley' },
      { type: 'talk', lines: [
        { who: 'Informant', text: 'Venn is moving guns through the marina tonight. Big shipment.' },
        { who: RIKO, text: 'Tonight? Then we hit it first.' },
        { who: 'Informant', text: 'Wait. Those are his boys, over there. They followed me!' },
      ], label: 'Talk to the informant' },
      { type: 'kill', count: 3, at: 'southsideAlley', spread: 120, label: 'Fight off Venn\u2019s thugs (3)' },
      { type: 'goto', at: 'salGarage', radius: 80, label: 'Report back to Sal' },
    ],
    outro: [
      { who: SAL, text: 'Guns through the marina. Venn is getting bold. We will answer that.' },
    ],
  },
  {
    id: 'm4',
    name: 'Payback',
    startAt: 'marinaPier',
    reward: MISSION_REWARDS[3],
    intro: [
      { who: SAL, text: 'Venn hit one of my drivers last night. Time to answer. His crew is at the marina pier.' },
      { who: RIKO, text: 'How many?' },
      { who: SAL, text: 'Five, maybe six. I left you a scattergun in the trunk of my car. Take it.' },
    ],
    steps: [
      { type: 'arm', label: 'Pick up the scattergun (+24 shells)' },
      { type: 'kill', count: 5, at: 'marinaPier', spread: 150, label: 'Clear Venn\u2019s crew from the pier (5)' },
    ],
    outro: [
      { who: SAL, text: 'The marina is ours again. Venn will hear about this before sunset.' },
    ],
  },
  {
    id: 'm5',
    name: 'Harbor Lights',
    startAt: 'harborWarehouse',
    reward: MISSION_REWARDS[4],
    intro: [
      { who: SAL, text: 'One more crate, this one at night. Venn has guards on it. Quiet would be nice.' },
      { who: RIKO, text: 'Quiet is not my best skill, Sal.' },
      { who: SAL, text: 'Then be loud and be fast. Get the crate to my garage.' },
    ],
    steps: [
      { type: 'night', label: 'Night falls over the harbor...' },
      { type: 'kill', count: 3, at: 'harborWarehouse', spread: 130, label: 'Deal with the warehouse guards (3)' },
      { type: 'pickup', at: 'harborWarehouse', radius: 70, label: 'Take the crate' },
      { type: 'driveTo', at: 'salGarage', radius: 90, label: 'Bring the crate to Sal\u2019s Garage' },
    ],
    outro: [
      { who: SAL, text: 'Beautiful. Whatever is in here pays for a lot of quiet nights.' },
    ],
  },
  {
    id: 'm6',
    name: 'The Getaway',
    startAt: 'downtownPlaza',
    reward: MISSION_REWARDS[5],
    intro: [
      { who: SAL, text: 'Venn tipped off the cops about the plaza deal. They are coming for you, Riko.' },
      { who: RIKO, text: 'Three stars already? I just got here!' },
      { who: SAL, text: 'Lose them, then meet me at the North Lookout. Drive like your life depends on it.' },
    ],
    steps: [
      { type: 'heat', stars: 3, label: 'The cops are on you!' },
      { type: 'loseWanted', label: 'Lose the cops (drop to 0 stars)' },
      { type: 'driveTo', at: 'northLookout', radius: 90, label: 'Drive to the North Lookout' },
    ],
    outro: [
      { who: SAL, text: 'You outran half the force. Venn cannot buy that kind of driving.' },
    ],
  },
  {
    id: 'm7',
    name: 'Inside Man',
    startAt: 'stadiumGate',
    reward: MISSION_REWARDS[6],
    intro: [
      { who: SAL, text: 'The Big One needs plans. Venn keeps the Exchange blueprints at the stadium.' },
      { who: RIKO, text: 'The Exchange? Sal, that is the biggest vault in Solmara.' },
      { who: SAL, text: 'Which is why we need the plans first. Get in, get them, get out.' },
    ],
    steps: [
      { type: 'kill', count: 4, at: 'stadiumGate', spread: 140, label: 'Get past the stadium guards (4)' },
      { type: 'pickup', at: 'stadiumGate', radius: 70, label: 'Take the blueprints' },
      { type: 'driveTo', at: 'salGarage', radius: 90, label: 'Bring the plans to Sal' },
    ],
    outro: [
      { who: SAL, text: 'These plans are the real thing. One more job, Riko. The big one.' },
    ],
  },
  {
    id: 'm8',
    name: 'The Big One',
    startAt: 'downtownPlaza',
    reward: MISSION_REWARDS[7],
    intro: [
      { who: SAL, text: 'Tonight we hit the Solmara Exchange. Guards, vault, everything. You in?' },
      { who: RIKO, text: 'Two thousand dollars says I am in.' },
      { who: SAL, text: 'Then go. Take the loot, lose the heat, and meet me at the garage. No mistakes.' },
    ],
    steps: [
      { type: 'goto', at: 'downtownPlaza', radius: 80, label: 'Reach the Solmara Exchange' },
      { type: 'kill', count: 6, at: 'downtownPlaza', spread: 160, label: 'Take down the Exchange guards (6)' },
      { type: 'pickup', at: 'downtownPlaza', radius: 70, label: 'Grab the loot' },
      { type: 'heat', stars: 4, label: 'Four stars! The whole city is coming!' },
      { type: 'loseWanted', label: 'Lose the cops (drop to 0 stars)' },
      { type: 'driveTo', at: 'salGarage', radius: 90, label: 'Escape to Sal\u2019s Garage' },
    ],
    outro: [
      { who: SAL, text: 'Two thousand. Clean. You are a legend in this city now, Riko Vale.' },
      { who: RIKO, text: 'Legend? I am just getting started.' },
    ],
  },
];

export function nextMissionId(state) {
  for (const m of MISSIONS) {
    if (!state.missionsDone.includes(m.id)) return m.id;
  }
  return null;
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function missionStartPoint(state) {
  const id = nextMissionId(state);
  if (!id || state.mission) return null;
  const def = missionById(id);
  const place = state.city.places[def.startAt];
  return { x: place.x, y: place.y, def };
}

export function tryStartAt(state) {
  if (state.mission) return false;
  const marker = missionStartPoint(state);
  if (!marker) return false;
  if (distance(state.player.x, state.player.y, marker.x, marker.y) > 80) return false;
  startMission(state, marker.def.id);
  return true;
}

export function startMission(state, id) {
  const def = missionById(id);
  if (!def) return;
  state.mission = { def, stepIndex: 0, killsLeft: 0, startedAt: state.time };
  state.objective = def.steps[0].label;
  state.audio.missionStart();
  state.message = { text: `Mission: ${def.name}`, timer: 3 };
  startDialogue(state, def.intro, () => {
    beginStep(state);
  });
}

function beginStep(state) {
  const m = state.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) {
    completeMission(state);
    return;
  }
  state.objective = step.label;
  if (step.type === 'kill') {
    spawnEnemies(state, step);
    m.killsLeft = step.count;
  } else if (step.type === 'arm') {
    state.ammo = Math.min(48, state.ammo + 24);
    state.weapon = 'scattergun';
    state.message = { text: 'Scattergun equipped (+24 shells)', timer: 2.5 };
    advanceStep(state);
  } else if (step.type === 'night') {
    state.clock = 21.5;
    state.fx.setFlash('#0b1026', 0.7, 1.2);
    advanceStep(state);
  } else if (step.type === 'heat') {
    state.wanted = step.stars;
    state.wantedTimer = 0;
    state.message = { text: `${step.stars} stars! Lose the cops!`, timer: 2.5 };
    advanceStep(state);
  } else if (step.type === 'talk') {
    startDialogue(state, step.lines, () => advanceStep(state));
  }
}

function advanceStep(state) {
  const m = state.mission;
  if (!m) return;
  m.stepIndex += 1;
  if (m.stepIndex >= m.def.steps.length) {
    completeMission(state);
    return;
  }
  beginStep(state);
}

function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  const def = m.def;
  state.missionsDone.push(def.id);
  state.stats.missionsDone += 1;
  state.money += def.reward;
  state.stats.moneyEarned += def.reward;
  state.audio.missionDone();
  state.fx.cashPop(state.player.x, state.player.y);
  state.mission = null;
  state.objective = '';
  state.enemies = state.enemies.filter((e) => e.down);
  startDialogue(state, def.outro, () => {
    state.save.autosave(state);
    if (state.missionsDone.length >= MISSIONS.length) {
      state.events.push({ type: 'gameComplete' });
    } else {
      const next = missionById(nextMissionId(state));
      if (next) state.message = { text: `Next mission: ${next.name} — find the gold ! marker`, timer: 4 };
    }
  });
}

export function failMission(state, reason) {
  if (!state.mission) return;
  const name = state.mission.def.name;
  state.mission = null;
  state.objective = '';
  state.enemies = [];
  state.message = { text: `Mission failed: ${name} — ${reason}`, timer: 4 };
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  const p = state.player;

  if (step.type === 'goto' || step.type === 'pickup') {
    const place = state.city.places[step.at];
    if (distance(p.x, p.y, place.x, place.y) < step.radius) {
      if (step.type === 'pickup') state.audio.pickup();
      advanceStep(state);
    }
  } else if (step.type === 'driveTo') {
    const place = state.city.places[step.at];
    if (!p.onFoot && distance(p.x, p.y, place.x, place.y) < step.radius) {
      advanceStep(state);
    }
  } else if (step.type === 'enterCar') {
    if (!p.onFoot) advanceStep(state);
  } else if (step.type === 'loseWanted') {
    if (state.wanted === 0) advanceStep(state);
  } else if (step.type === 'kill') {
    if (m.killsLeft <= 0) advanceStep(state);
  }
}

export function onEnemyKilled(state, enemy) {
  const m = state.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  if (step && step.type === 'kill') {
    m.killsLeft = Math.max(0, m.killsLeft - 1);
    state.objective = `${step.label.split('(')[0].trim()} (${m.killsLeft} left)`;
  }
}

export function currentTarget(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.def.steps[m.stepIndex];
  if (!step) return null;
  if (step.at) {
    const place = state.city.places[step.at];
    return { x: place.x, y: place.y, radius: step.radius || 70 };
  }
  return null;
}

// ---- enemies ----

export function spawnEnemies(state, step) {
  const place = state.city.places[step.at];
  const spread = step.spread || 120;
  for (let i = 0; i < step.count; i++) {
    const angle = (i / step.count) * Math.PI * 2;
    const d = 40 + Math.random() * spread;
    state.enemies.push({
      x: place.x + Math.cos(angle) * d,
      y: place.y + Math.sin(angle) * d,
      angle: Math.random() * Math.PI * 2,
      health: 50,
      speed: 150,
      shootTimer: 1 + Math.random() * 1.5,
      alerted: false,
      down: false,
      downTimer: 0,
      bobPhase: Math.random() * 10,
      shirt: i % 2 === 0 ? '#5b2c6f' : '#7b241c',
    });
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.down) {
      e.downTimer -= dt;
      continue;
    }
    e.bobPhase += dt * 11;
    const d = distance(e.x, e.y, p.x, p.y);
    if (!e.alerted && d < 420) e.alerted = true;
    if (!e.alerted) {
      // Idle guards pace around their post.
      e.angle += Math.sin(e.bobPhase * 0.2) * dt;
      continue;
    }
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = want;
    // Close in until in shooting range, then stand and fire.
    if (d > 260) {
      const nx = e.x + Math.cos(want) * e.speed * dt;
      const ny = e.y + Math.sin(want) * e.speed * dt;
      const resolved = state.world.collideCircle(state.city, nx, ny, 11);
      e.x = resolved.x;
      e.y = resolved.y;
    } else {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.2 + Math.random() * 0.6;
        state.combat.enemyShoot(state, e.x, e.y, want + (Math.random() - 0.5) * 0.3, 'enemy', 6);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.down || e.downTimer > 0);
}

export function drawEnemy(ctx, e) {
  if (e.down) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.PI / 2);
  const bob = Math.sin(e.bobPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(-5, -2 + bob, 4, 10);
  ctx.fillRect(1, -2 - bob, 4, 10);
  ctx.fillStyle = e.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -3, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.fillRect(-3, -20, 6, 12);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-2, -26, 4, 14);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(0, -13, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Health bar.
  if (e.health < 50) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 26, 28, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 26, 28 * (e.health / 50), 4);
  }
}

// ---- dialogue ----

export function startDialogue(state, lines, onDone) {
  if (!lines || lines.length === 0) {
    if (onDone) onDone();
    return;
  }
  state.dialogue = { lines, index: 0, onDone };
  state.mode = 'dialogue';
}

export function advanceDialogue(state) {
  const d = state.dialogue;
  if (!d) return;
  d.index += 1;
  state.audio.uiClick();
  if (d.index >= d.lines.length) {
    const done = d.onDone;
    state.dialogue = null;
    state.mode = 'playing';
    if (done) done();
  }
}
