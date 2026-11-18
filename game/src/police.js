// The Solmara PD: a wanted level that grows with crime and fades when the
// player hides, cop cars that chase and ram, and foot cops who run the
// player down, shoot back at high heat, and try to make an arrest up close.
// The pursuit gets sharper with the stars: cops aim further ahead of a
// moving target, swing for the rear quarter up close, and keep out of each
// other's way instead of piling onto the same bumper.

import { POLICE, WORLD } from './config.js';
import { PLACES, randomRoadPoint, resolveCircle } from './city.js';
import { carRadius, carSpeed, createCar, driveCar } from './vehicles.js';

const SEEN_RADIUS = 560;
const DESPAWN_CAR = 1300;
const DESPAWN_FOOT = 1100;

export function starsFromHeat(heat) {
  let stars = 0;
  for (let i = 0; i < POLICE.starThresholds.length; i += 1) {
    if (heat >= POLICE.starThresholds[i]) stars = i;
  }
  return Math.min(POLICE.maxStars, stars);
}

export function createPolice(city, random) {
  return { heat: 0, stars: 0, copCars: [], footCops: [], bust: 0, lastSeenAt: -99, city, random };
}

export function addHeat(police, points, now) {
  police.heat += points;
  police.stars = starsFromHeat(police.heat);
  police.lastSeenAt = now;
}

export function clearWanted(police) {
  police.heat = 0;
  police.stars = 0;
  police.bust = 0;
  police.copCars.length = 0;
  police.footCops.length = 0;
}

function spawnCopCar(police, player) {
  // Outside the seen radius, so a fresh cop never spots the player the
  // instant it appears: the player can break away and hide.
  const spot = randomRoadPoint(police.random, player.x, player.y, 650, 900);
  const car = createCar('interceptor', spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x), '#f2f2f2', 'cop');
  car.stuckAt = 0;
  police.copCars.push(car);
  return car;
}

function spawnFootCop(police, player) {
  const spot = randomRoadPoint(police.random, player.x, player.y, 600, 800);
  const cop = {
    x: spot.x,
    y: spot.y,
    angle: 0,
    speed: POLICE.footSpeedBase,
    health: 50,
    shootAt: 0,
    dead: false,
    downUntil: 0,
  };
  police.footCops.push(cop);
  return cop;
}

function steerAngle(car, tx, ty, gain) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * gain));
}

// Where a chasing cop aims: ahead of the target by its velocity, further
// ahead as the heat rises; close in, at the rear quarter, to spin the car.
function chaseTarget(police, car, player, playerCar) {
  const lead = POLICE.leadBase + POLICE.leadPerStar * police.stars;
  const vx = playerCar ? playerCar.vx : 0;
  const vy = playerCar ? playerCar.vy : 0;
  const tx = player.x + vx * lead;
  const ty = player.y + vy * lead;
  const d = Math.hypot(car.x - player.x, car.y - player.y);
  if (playerCar && d < POLICE.pitRange && carSpeed(playerCar) > 180) {
    const heading = Math.atan2(vy, vx);
    const side = Math.sign((car.x - player.x) * -Math.sin(heading) + (car.y - player.y) * Math.cos(heading)) || 1;
    return {
      x: tx - Math.cos(heading) * POLICE.pitOffset + -Math.sin(heading) * POLICE.pitOffset * side * 0.5,
      y: ty - Math.sin(heading) * POLICE.pitOffset + Math.cos(heading) * POLICE.pitOffset * side * 0.5,
    };
  }
  return { x: tx, y: ty };
}

// A nudge away from the nearest fellow cop car, so the pursuit fans out
// instead of stacking on one bumper.
function separationSteer(police, car) {
  let push = 0;
  for (const other of police.copCars) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > POLICE.separation || d === 0) continue;
    const side = (dx * -Math.sin(car.angle) + dy * Math.cos(car.angle)) / d;
    push += side * (1 - d / POLICE.separation);
  }
  return Math.max(-0.5, Math.min(0.5, push));
}

function searchTarget(police, car, player, now) {
  // The trail is cold: cruise the area instead of driving straight at the
  // hideout, and back off if the search drifted too close.
  const d = Math.hypot(car.x - player.x, car.y - player.y);
  if (d < 350) {
    const away = Math.atan2(car.y - player.y, car.x - player.x);
    return { x: car.x + Math.cos(away) * 500, y: car.y + Math.sin(away) * 500 };
  }
  if (!car.search || now - (car.searchAt || 0) > 6 || Math.hypot(car.search.x - car.x, car.search.y - car.y) < 60) {
    car.search = randomRoadPoint(police.random, player.x, player.y, 500, 900);
    car.searchAt = now;
  }
  return car.search;
}

// One step of the whole police response. `hooks` collects what happened:
// onCopShot(cop, angle) fires a cop's bullet, onBusted() lands the arrest.
export function updatePolice(police, dt, now, player, playerCar, allCars, hooks) {
  const stars = police.stars;
  const wanted = stars > 0;
  // The hideout is a safe house: inside it the cops lose the trail, they
  // cannot spot the player or make an arrest, and the heat fades fast.
  const hidden = Math.hypot(player.x - PLACES.hideout.x, player.y - PLACES.hideout.y) < 250;

  // Keep the response matched to the wanted level.
  const wantCars = wanted ? POLICE.copCarsByStars[stars] : 0;
  const wantFoot = wanted && player.onFoot ? POLICE.footCopsByStars[stars] : 0;
  while (police.copCars.length < wantCars) spawnCopCar(police, player);
  while (police.footCops.length < wantFoot) spawnFootCop(police, player);
  if (!wanted) {
    police.copCars.length = 0;
    police.footCops.length = 0;
  }

  let anyNear = false;

  for (let i = police.copCars.length - 1; i >= 0; i -= 1) {
    const car = police.copCars[i];
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d > DESPAWN_CAR) {
      police.copCars.splice(i, 1);
      continue;
    }
    if (d < SEEN_RADIUS && !hidden) anyNear = true;
    car.siren += dt;
    const target = hidden ? searchTarget(police, car, player, now) : chaseTarget(police, car, player, playerCar);
    if (!hidden) car.search = null;
    const steer = Math.max(-1, Math.min(1, steerAngle(car, target.x, target.y, 2.4) + separationSteer(police, car)));
    const speed = carSpeed(car);
    let throttle = hidden ? 0.6 : 1;
    if (d < 70 && speed > 260) throttle = 0.2;
    driveCar(car, dt, throttle, steer, false, police.city);
    // A cop car wedged against a wall gives up and reappears down the road.
    if (speed < 12) {
      car.stuckAt += dt;
      if (car.stuckAt > 3) {
        const spot = randomRoadPoint(police.random, player.x, player.y, 650, 900);
        car.x = spot.x;
        car.y = spot.y;
        car.vx = 0;
        car.vy = 0;
        car.stuckAt = 0;
      }
    } else car.stuckAt = 0;
  }

  // Foot cops run at the player and, at three stars and up, shoot.
  for (let i = police.footCops.length - 1; i >= 0; i -= 1) {
    const cop = police.footCops[i];
    if (cop.dead) {
      if (now > cop.downUntil) police.footCops.splice(i, 1);
      continue;
    }
    cop.speed = POLICE.footSpeedBase + POLICE.footSpeedPerStar * stars;
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d > DESPAWN_FOOT) {
      police.footCops.splice(i, 1);
      continue;
    }
    if (d < SEEN_RADIUS && !hidden) anyNear = true;
    const want = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = want;
    const stopAt = player.onFoot ? 30 : 200;
    // A hidden player is not chased: the foot cops hold their ground.
    if (d > stopAt && !hidden) {
      cop.x += Math.cos(want) * cop.speed * dt;
      cop.y += Math.sin(want) * cop.speed * dt;
      resolveCircle(police.city, cop, 12);
    }
    if (stars >= 3 && player.onFoot && d < POLICE.copShootRange && now - cop.shootAt > POLICE.copShotCooldown) {
      cop.shootAt = now;
      const spread = (police.random.next() - 0.5) * 0.35;
      hooks.onCopShot(cop, want + spread);
    }
    // An arrest needs a cop right on top of a slow player.
    const playerSpeed = playerCar ? carSpeed(playerCar) : player.speed;
    if (d < 44 && playerSpeed < 70 && !hidden) {
      police.bust += POLICE.bustFillRate * dt;
    }
  }

  // A stopped car boxed in by a cop car is an arrest too.
  if (playerCar && carSpeed(playerCar) < 25 && !hidden) {
    for (const car of police.copCars) {
      if (Math.hypot(car.x - player.x, car.y - player.y) < carRadius(car) + 42) {
        police.bust += POLICE.bustFillRate * dt;
        break;
      }
    }
  }
  if (police.bust > 0 && !wanted) police.bust = 0;
  if (police.bust < 1) {
    // Drain unless a cop is still close enough to hold the player.
    const holding = police.footCops.some((c) => !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 90);
    if (!holding) police.bust = Math.max(0, police.bust - POLICE.bustDrainRate * dt);
  }
  if (police.bust >= 1) {
    hooks.onBusted();
    return;
  }

  // Heat fades once no cop has seen the player for a while. At the hideout
  // it fades three times faster: the safe house does its job.
  if (anyNear) police.lastSeenAt = now;
  else if (wanted && now - police.lastSeenAt > POLICE.heatDecayDelay) {
    police.heat = Math.max(0, police.heat - POLICE.heatDecayRate * (hidden ? 3 : 1) * dt);
    police.stars = starsFromHeat(police.heat);
  }

  // Keep cop cars inside the world (they chase through the beach too).
  for (const car of police.copCars) {
    car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
    car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  }
}
