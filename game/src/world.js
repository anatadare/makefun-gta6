// The world: everything together. It owns the city, the player, traffic,
// pedestrians, police, missions and combat, and steps them all in fixed
// 1/60 s slices. The loop in main.js feeds it input; the renderer reads its
// state. Events come back as bit flags so the loop can react (save, respawn).
// Each slice runs in the same order: the player, the street, the law, the
// bullets, the jobs, then the loose ends (stashes, the garage, the prompt).

import { CAR_TYPES, PLAYER, POLICE } from './config.js';
import { buildCity, PLACES, pointOnRoad, STASHES } from './city.js';
import { ACTION_ENTER, ACTION_PUNCH } from './input.js';
import { createRandom } from './random.js';
import { createPlayer, enterCar, exitCar, healPlayer, hurtPlayer, canFire, canPunch, walkPlayer } from './player.js';
import { createTraffic, nearestStealable, updateTraffic } from './traffic.js';
import { createPedestrians, knockDown, scarePeds, updatePedestrians } from './pedestrians.js';
import { addHeat, clearWanted, createPolice, starsFromHeat, updatePolice } from './police.js';
import { createCombat, fireBullet, meleeTarget, updateBullets } from './combat.js';
import { countWreck, createMissions, currentMission, MISSION_COUNT, startMission, updateMissions } from './missions.js';
import { carRadius, carSpeed, createCar, driveCar } from './vehicles.js';
import { addShake, addSkid, createEffects, spawnDust, spawnEngineSmoke, spawnExplosion, spawnTireSmoke, updateEffects } from './effects.js';
import { playCrash, playExplosion, playPayday, playPickup, playShot, playSkid, playWanted, setEngine, setSiren } from './audio.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_SAVED = 4;

const MESSAGE_SECONDS = 6;
const ENTER_RANGE = 74;
const STASH_RANGE = 60;
const GARAGE_RANGE = 120;

export function createWorld(seed, save) {
  const state = {
    seed,
    save,
    city: null,
    player: null,
    traffic: null,
    peds: null,
    police: null,
    missions: null,
    combat: null,
    effects: null,
    random: null,
    time: 0,
    messages: [],
    prompt: '',
    missionCar: null,
    penalty: 0,
    stashes: [],
    garageCooldown: 0,
    garageParked: 0,
    skidAt: 0,
    lastStars: 0,
  };

  function addMessage(text) {
    state.messages.push({ text, until: state.time + MESSAGE_SECONDS });
    if (state.messages.length > 4) state.messages.shift();
  }

  function build() {
    const random = createRandom(seed);
    state.random = random;
    state.city = buildCity(random);
    state.player = createPlayer(PLACES.start.x, PLACES.start.y);
    state.player.money = save.money || 0;
    state.traffic = createTraffic(state.city, random);
    state.peds = createPedestrians(state.city, random);
    state.police = createPolice(state.city, random);
    state.missions = createMissions(save.missionIndex || 0);
    state.combat = createCombat();
    state.effects = createEffects();
    state.time = 0;
    state.messages = [];
    state.prompt = '';
    state.missionCar = null;
    state.penalty = 0;
    state.garageCooldown = 0;
    state.garageParked = 0;
    state.skidAt = 0;
    state.lastStars = 0;
    // Stashes the player has not found yet.
    const found = new Set(save.stashes || []);
    state.stashes = STASHES.map((s, i) => ({ ...s, index: i })).filter((s) => !found.has(s.index));
  }

  function allCars() {
    const list = new Set();
    for (const car of state.traffic.cars) list.add(car);
    for (const car of state.traffic.parked) list.add(car);
    for (const car of state.police.copCars) list.add(car);
    if (state.player.car) list.add(state.player.car);
    if (state.missionCar) list.add(state.missionCar);
    return [...list];
  }

  function nearestCopDistance() {
    let best = Infinity;
    const player = state.player;
    for (const car of state.police.copCars) {
      best = Math.min(best, Math.hypot(car.x - player.x, car.y - player.y));
    }
    for (const cop of state.police.footCops) {
      if (cop.dead) continue;
      best = Math.min(best, Math.hypot(cop.x - player.x, cop.y - player.y));
    }
    return best;
  }

  function spawnMissionCar(typeId, x, y, color) {
    const car = createCar(typeId, x, y, -Math.PI / 2, color, 'parked');
    state.missionCar = car;
    return car;
  }

  function missionContext() {
    return {
      player: state.player,
      police: state.police,
      random: state.random,
      spawnMissionCar,
      setHeat(points) {
        state.police.heat = points;
        state.police.stars = starsFromHeat(points);
        state.police.lastSeenAt = state.time;
      },
      addHeat(points) {
        addHeat(state.police, points, state.time);
      },
    };
  }

  function beginPlay() {
    if (state.missions.storyDone || state.missions.active) return;
    if (!currentMission(state.missions)) return;
    const events = startMission(state.missions, missionContext());
    for (const e of events) if (e.type === 'message') addMessage(e.text);
  }

  function respawn(kind) {
    const place = kind === 'station' ? PLACES.policeStation : PLACES.hospital;
    const player = state.player;
    if (player.car) {
      const car = player.car;
      exitCar(player, state.city);
      if (!state.traffic.parked.includes(car)) state.traffic.parked.push(car);
    }
    player.x = place.x;
    player.y = place.y;
    player.health = PLAYER.health;
    player.onFoot = true;
    clearWanted(state.police);
  }

  // Burn a car out: explosion, smoke, a wreck that stays on the street
  // until the tow truck takes it.
  function wreckCar(car, audio) {
    car.dead = true;
    car.burnt = true;
    car.wreckLife = 30;
    car.driver = 'none';
    spawnExplosion(state.effects, car.x, car.y);
    if (audio) playExplosion(audio);
    if (!state.traffic.parked.includes(car)) state.traffic.parked.push(car);
  }

  function handleOnFoot(dt, input, actions, aimWorld, audio, now) {
    const player = state.player;
    const police = state.police;
    walkPlayer(player, dt, input.move(), input.sprint(), aimWorld.x, aimWorld.y, state.city);
    if (player.sprinting && Math.random() < dt * 6) {
      spawnDust(state.effects, player.x, player.y + 8);
    }
    if (input.mouse.down && canFire(player, now)) {
      player.fireAt = now;
      fireBullet(state.combat, player.x, player.y, player.aimAngle, 'player', PLAYER.bulletDamage);
      if (audio) playShot(audio);
      scarePeds(state.peds, player.x, player.y, 320, now);
      if (nearestCopDistance() < 600 || police.stars > 0) addHeat(police, POLICE.crimeShoot, now);
    }
    if (actions & ACTION_PUNCH && canPunch(player, now)) {
      player.punchAt = now;
      const targets = [];
      for (const ped of state.peds.peds) {
        if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, radius: 14, kind: 'ped', ref: ped });
      }
      for (const cop of police.footCops) {
        if (!cop.dead) targets.push({ x: cop.x, y: cop.y, radius: 14, kind: 'cop', ref: cop });
      }
      const hit = meleeTarget(player, player.aimAngle, PLAYER.punchRange, targets);
      if (hit && hit.kind === 'ped') {
        knockDown(hit.ref, now);
        addHeat(police, POLICE.crimeHitPed, now);
      } else if (hit) {
        hit.ref.health -= PLAYER.punchDamage;
        addHeat(police, POLICE.crimeHitCop, now);
        if (hit.ref.health <= 0) {
          hit.ref.dead = true;
          hit.ref.downUntil = now + 6;
          addHeat(police, POLICE.crimeKillCop, now);
        }
      }
    }
    if (actions & ACTION_ENTER) {
      const car = nearestStealable(state.traffic, player.x, player.y, ENTER_RANGE);
      const mission = state.missionCar && state.missionCar !== player.car
        && Math.hypot(state.missionCar.x - player.x, state.missionCar.y - player.y) < ENTER_RANGE
        ? state.missionCar
        : null;
      const target = mission ?? car;
      if (target) {
        const fromTraffic = state.traffic.cars.indexOf(target);
        if (fromTraffic !== -1) state.traffic.cars.splice(fromTraffic, 1);
        const fromParked = state.traffic.parked.indexOf(target);
        if (fromParked !== -1) state.traffic.parked.splice(fromParked, 1);
        enterCar(player, target);
        save.carsStolen = (save.carsStolen || 0) + 1;
        if (audio) playPickup(audio);
        if (nearestCopDistance() < 600) addHeat(police, POLICE.crimeCarTheft, now);
      }
    }
  }

  function handleDriving(dt, input, actions, audio, now) {
    const player = state.player;
    const police = state.police;
    const car = player.car;
    const impact = driveCar(car, dt, input.throttle(), input.steer(), input.handbrake(), state.city);
    if (impact > 120 && audio) playCrash(audio, impact);
    if (impact > 150) addShake(state.effects, Math.min(10, impact / 30));
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Skids, tire smoke, dust and engine smoke follow the drive.
    const speed = carSpeed(car);
    const lateral = Math.abs(-car.vx * Math.sin(car.angle) + car.vy * Math.cos(car.angle));
    const drifting = input.handbrake() && speed > 150;
    const sliding = lateral > 130 && speed > 200;
    if (drifting || sliding) {
      const bx = car.x - Math.cos(car.angle) * (car.type.length / 2 - 6);
      const by = car.y - Math.sin(car.angle) * (car.type.length / 2 - 6);
      addSkid(state.effects, bx, by, car.angle);
      if (drifting && Math.random() < dt * 10) spawnTireSmoke(state.effects, bx, by);
      if (audio && drifting && now - (state.skidAt || 0) > 0.3) {
        state.skidAt = now;
        playSkid(audio);
      }
    }
    if (speed > 150 && !pointOnRoad(state.city, car.x, car.y)) {
      spawnDust(state.effects, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
    }
    if (car.health < 40 && Math.random() < dt * 8) {
      spawnEngineSmoke(state.effects, car.x + Math.cos(car.angle) * 16, car.y + Math.sin(car.angle) * 16);
    }
    if (car.health <= 0 && !car.dead) {
      wreckCar(car, audio);
      exitCar(player, state.city);
      addMessage('Your car is wrecked. Find another ride.');
    } else if (actions & ACTION_ENTER) {
      exitCar(player, state.city);
      if (!state.traffic.parked.includes(car)) state.traffic.parked.push(car);
    }
    // Running people down is a crime, and the crowd notices.
    if (speed > 60) {
      for (const ped of state.peds.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < carRadius(car) + 8) {
          knockDown(ped, now);
          addHeat(police, speed > 300 ? POLICE.crimeKillPed : POLICE.crimeHitPed, now);
          scarePeds(state.peds, ped.x, ped.y, 260, now);
        }
      }
    }
  }

  // Any car beaten to zero health burns out where it stands.
  function checkWrecks(audio) {
    for (let i = state.traffic.cars.length - 1; i >= 0; i -= 1) {
      const car = state.traffic.cars[i];
      if (car.health <= 0 && !car.dead) {
        state.traffic.cars.splice(i, 1);
        wreckCar(car, audio);
      }
    }
    for (let i = state.police.copCars.length - 1; i >= 0; i -= 1) {
      const car = state.police.copCars[i];
      if (car.health <= 0 && !car.dead) {
        state.police.copCars.splice(i, 1);
        wreckCar(car, audio);
        countWreck(state.missions);
      }
    }
    const missionCar = state.missionCar;
    if (missionCar && missionCar !== state.player.car && missionCar.health <= 0 && !missionCar.dead) {
      wreckCar(missionCar, audio);
    }
  }

  function handleBullets(dt, audio, now) {
    const player = state.player;
    const police = state.police;
    const targets = [];
    for (const ped of state.peds.peds) {
      if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, radius: 13, kind: 'ped', ref: ped, dead: false });
    }
    for (const cop of police.footCops) {
      targets.push({ x: cop.x, y: cop.y, radius: 13, kind: 'cop', ref: cop, dead: cop.dead });
    }
    if (player.onFoot) targets.push({ x: player.x, y: player.y, radius: PLAYER.radius, kind: 'player', ref: player, dead: false });
    for (const car of allCars()) {
      if (car === player.car) continue;
      targets.push({ x: car.x, y: car.y, radius: carRadius(car), kind: 'car', ref: car, dead: car.dead });
    }
    updateBullets(state.combat, dt, state.city, targets, (target, damage, from) => {
      if (target.kind === 'ped') {
        knockDown(target.ref, now);
        if (from === 'player') addHeat(police, POLICE.crimeHitPed, now);
      } else if (target.kind === 'cop') {
        target.ref.health -= damage;
        if (from === 'player') addHeat(police, POLICE.crimeHitCop, now);
        if (target.ref.health <= 0 && !target.ref.dead) {
          target.ref.dead = true;
          target.ref.downUntil = now + 6;
          if (from === 'player') addHeat(police, POLICE.crimeKillCop, now);
        }
      } else if (target.kind === 'player') {
        hurtPlayer(player, damage, now);
      } else if (target.kind === 'car') {
        target.ref.health -= damage * 0.6;
        if (target.ref.health <= 0) target.ref.dead = true;
      }
    });
  }

  function handleMissions(dt) {
    let events = 0;
    const player = state.player;
    // A wrecked mission car is replaced at the docks and the job restarts.
    if (state.missions.targetCar && state.missions.targetCar.dead && state.missions.active) {
      state.missions.targetCar = spawnMissionCar('fuego', PLACES.docks.x + 30, PLACES.docks.y - 40, '#ffd23f');
      state.missions.step = 0;
      addMessage('OTIS: You wrecked it! There is another Fuego at the docks.');
    }
    const missionEvents = updateMissions(state.missions, dt, missionContext());
    for (const e of missionEvents) {
      if (e.type === 'message') addMessage(e.text);
      else if (e.type === 'complete') {
        player.money += e.mission.reward;
        save.totalEarned = (save.totalEarned || 0) + e.mission.reward;
        save.money = player.money;
        save.missionIndex = state.missions.index;
        events |= EVENT_SAVED;
      } else if (e.type === 'fare') {
        player.money += e.reward;
        save.totalEarned = (save.totalEarned || 0) + e.reward;
        save.money = player.money;
        events |= EVENT_SAVED;
      }
    }
    return events;
  }

  function handleStashes(audio) {
    let events = 0;
    const player = state.player;
    for (let i = state.stashes.length - 1; i >= 0; i -= 1) {
      const stash = state.stashes[i];
      if (Math.hypot(player.x - stash.x, player.y - stash.y) >= STASH_RANGE) continue;
      state.stashes.splice(i, 1);
      player.money += 100;
      save.money = player.money;
      save.totalEarned = (save.totalEarned || 0) + 100;
      save.stashes = [...(save.stashes || []), stash.index];
      const found = STASHES.length - state.stashes.length;
      addMessage(`Found a stash! +$100. (${found}/${STASHES.length})`);
      if (audio) playPickup(audio);
      events |= EVENT_SAVED;
    }
    return events;
  }

  // Otis's Garage opens once Hot Wheels is done ("the garage is open to
  // you"). Park a battered car or a hot wanted level there and he sorts it
  // out, for a price. One visit every few seconds at most.
  function handleGarage(dt, audio) {
    const player = state.player;
    const police = state.police;
    state.garageCooldown = Math.max(0, state.garageCooldown - dt);
    const atGarage = player.car && !player.onFoot
      && Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y) < GARAGE_RANGE
      && state.missions.index >= 2;
    if (atGarage && carSpeed(player.car) < 10) state.garageParked += dt;
    else state.garageParked = 0;
    if (!atGarage || state.garageParked <= 1 || state.garageCooldown > 0) return;
    const car = player.car;
    let served = false;
    if (car.health < 90 && player.money >= 50) {
      player.money -= 50;
      car.health = 100;
      car.burnt = false;
      addMessage('OTIS: Fixed her up. Good as new. $50.');
      if (audio) playPickup(audio);
      served = true;
    } else if (car.health < 90) {
      addMessage('OTIS: Bring $50 and I will fix her up.');
      served = true;
    }
    if (police.stars > 0 && player.money >= 150) {
      player.money -= 150;
      clearWanted(police);
      addMessage('OTIS: Clean ride. The cops forgot your face. $150.');
      if (audio) playPickup(audio);
      served = true;
    } else if (police.stars > 0) {
      addMessage('OTIS: $150 and the cops forget you.');
      served = true;
    }
    if (served) {
      save.money = player.money;
      state.garageCooldown = 5;
      state.garageParked = 0;
    }
  }

  function updatePrompt() {
    const player = state.player;
    if (player.onFoot) {
      const car = nearestStealable(state.traffic, player.x, player.y, ENTER_RANGE)
        ?? (state.missionCar && Math.hypot(state.missionCar.x - player.x, state.missionCar.y - player.y) < ENTER_RANGE ? state.missionCar : null);
      state.prompt = car ? `Press E to steal the ${car.type.name}` : '';
    } else if (player.car) {
      state.prompt = `Press E to exit the ${player.car.type.name}`;
    } else {
      state.prompt = '';
    }
  }

  function updateSound(audio) {
    if (!audio) return;
    const player = state.player;
    const driving = !player.onFoot && !!player.car;
    const speed01 = driving ? Math.min(1, carSpeed(player.car) / CAR_TYPES.fuego.topSpeed) : 0;
    setEngine(audio, speed01, driving);
    const nearest = nearestCopDistance();
    setSiren(audio, nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 800));
    // The sting when the heat climbs a star.
    if (state.police.stars > state.lastStars) playWanted(audio);
    state.lastStars = state.police.stars;
  }

  function step(dt, input, actions, aimWorld, audio) {
    let events = 0;
    const now = state.time + dt;
    state.time = now;
    const player = state.player;
    const police = state.police;

    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      if (state.messages[i].until <= now) state.messages.splice(i, 1);
    }

    if (player.onFoot) handleOnFoot(dt, input, actions, aimWorld, audio, now);
    else if (player.car) handleDriving(dt, input, actions, audio, now);

    updateTraffic(state.traffic, dt, state.city, state.random, player, allCars());
    updatePedestrians(state.peds, dt, now, player);
    checkWrecks(audio);
    updateEffects(state.effects, dt);

    updatePolice(police, dt, now, player, player.car, allCars(), {
      onCopShot(cop, angle) {
        fireBullet(state.combat, cop.x, cop.y, angle, 'cop', POLICE.copShotDamage);
        if (audio) playShot(audio);
      },
      onBusted() {
        state.penalty = Math.min(player.money, 100);
        player.money -= state.penalty;
        events |= EVENT_BUSTED;
      },
    });

    handleBullets(dt, audio, now);
    const missionEvents = handleMissions(dt);
    events |= missionEvents;
    if (missionEvents & EVENT_SAVED && audio) playPayday(audio);

    healPlayer(player, dt, now);
    if (player.health <= 0) {
      state.penalty = Math.min(player.money, 150);
      player.money -= state.penalty;
      events |= EVENT_WASTED;
    }

    events |= handleStashes(audio);
    handleGarage(dt, audio);
    updatePrompt();
    updateSound(audio);

    return events;
  }

  function reset() {
    build();
  }

  build();
  return {
    state,
    reset,
    step,
    beginPlay,
    respawn,
    addMessage,
    setMissionIndex(index) {
      state.missions.index = index;
      state.missions.storyDone = index >= MISSION_COUNT;
    },
  };
}
