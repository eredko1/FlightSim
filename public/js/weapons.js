// ─── Weapons Systems: Guns, IR Missiles, Radar Missiles ───
import { WEAPONS, AIRCRAFT } from './aircraft.js';

const EARTH_RADIUS = 6378137;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Projectile types ───
export class Bullet {
  constructor(lat, lon, alt, heading, pitch, speed, weapon, ownerId) {
    this.lat = lat;
    this.lon = lon;
    this.alt = alt;
    this.heading = heading;
    this.pitch = pitch;
    this.speed = speed + weapon.muzzleVelocity;
    this.weapon = weapon;
    this.ownerId = ownerId;
    this.life = weapon.range / this.speed;
    this.age = 0;
    this.alive = true;
    this.isTracer = false;
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.life) { this.alive = false; return; }

    const hs = this.speed * Math.cos(this.pitch);
    const vs = this.speed * Math.sin(this.pitch);
    this.alt += vs * dt;
    this.lat += (hs * Math.cos(this.heading) * dt) / EARTH_RADIUS;
    this.lon += (hs * Math.sin(this.heading) * dt) / (EARTH_RADIUS * Math.cos(this.lat));

    // Gravity drop
    this.pitch -= 9.81 / this.speed * dt * 0.3;
  }
}

export class Missile {
  constructor(lat, lon, alt, heading, pitch, launchSpeed, weapon, ownerId, targetId) {
    this.lat = lat;
    this.lon = lon;
    this.alt = alt;
    this.heading = heading;
    this.pitch = pitch;
    this.speed = launchSpeed + 50; // initial boost
    this.weapon = weapon;
    this.ownerId = ownerId;
    this.targetId = targetId;
    this.alive = true;
    this.age = 0;
    this.burnTime = weapon.burnTime;
    this.maxAge = weapon.burnTime + 10; // coast for extra 10s after burnout
    this.trail = []; // for visual trail
    this.isRadar = weapon.type === 'radar';
    this.isActive = false; // radar missile goes active at activeRange
  }

  update(dt, targetState) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.maxAge) { this.alive = false; return; }

    // Thrust phase
    if (this.age < this.burnTime) {
      this.speed += (this.weapon.speed - this.speed) * dt * 2;
    } else {
      // Coast: lose speed to drag
      this.speed *= (1 - 0.15 * dt);
      if (this.speed < 100) { this.alive = false; return; }
    }

    // Guidance: proportional navigation toward target
    if (targetState && targetState.alive) {
      const dLat = targetState.latitude - this.lat;
      const dLon = targetState.longitude - this.lon;
      const dAlt = targetState.altitudeMSL - this.alt;

      const distH = Math.sqrt(dLat * dLat + dLon * dLon) * EARTH_RADIUS;
      const dist3d = Math.sqrt(distH * distH + dAlt * dAlt);

      // Check active range for radar missiles
      if (this.isRadar && dist3d < (this.weapon.activeRange || 16000)) {
        this.isActive = true;
      }

      // Bearing to target
      const targetBearing = Math.atan2(
        dLon * Math.cos(this.lat),
        dLat
      );
      const targetPitch = Math.atan2(dAlt, distH);

      // Proportional navigation
      let headingError = targetBearing - this.heading;
      while (headingError > Math.PI) headingError -= 2 * Math.PI;
      while (headingError < -Math.PI) headingError += 2 * Math.PI;

      let pitchError = targetPitch - this.pitch;

      const turnLimit = this.weapon.turnRate * dt;
      this.heading += clamp(headingError * 3, -turnLimit, turnLimit);
      this.pitch += clamp(pitchError * 3, -turnLimit, turnLimit);

      // Proximity fuse (10m)
      if (dist3d < 15) {
        this.detonated = true;
        this.alive = false;
        return;
      }
    } else {
      // No target - fly straight (dumb fire)
    }

    // Move
    const hs = this.speed * Math.cos(this.pitch);
    const vs = this.speed * Math.sin(this.pitch);
    this.alt += vs * dt;
    this.lat += (hs * Math.cos(this.heading) * dt) / EARTH_RADIUS;
    this.lon += (hs * Math.sin(this.heading) * dt) / (EARTH_RADIUS * Math.cos(this.lat));

    // Terrain collision
    if (this.alt < 0) { this.alive = false; this.detonated = true; }

    // Trail point (every 100ms)
    if (Math.floor(this.age * 10) > Math.floor((this.age - dt) * 10)) {
      this.trail.push({ lat: this.lat, lon: this.lon, alt: this.alt, time: this.age });
      if (this.trail.length > 80) this.trail.shift();
    }
  }
}

// ─── Weapon Manager ───
export class WeaponManager {
  constructor() {
    this.bullets = [];
    this.missiles = [];
    this.explosions = []; // { lat, lon, alt, age, maxAge }
    this.gunTimer = 0;
  }

  fireGun(state, weaponState, dt) {
    const ac = AIRCRAFT[state.aircraftType];
    const gun = WEAPONS[ac.gun];
    if (weaponState.gunAmmo <= 0) return;

    this.gunTimer += dt;
    const interval = 1 / gun.rateOfFire;
    let tracerCount = 0;

    while (this.gunTimer >= interval && weaponState.gunAmmo > 0) {
      this.gunTimer -= interval;
      weaponState.gunAmmo--;
      tracerCount++;

      const spread = gun.spread;
      const h = state.heading + (Math.random() - 0.5) * spread;
      const p = state.pitch + (Math.random() - 0.5) * spread;

      const b = new Bullet(
        state.latitude, state.longitude, state.altitudeMSL,
        h, p, state.speed, gun, 'player'
      );
      b.isTracer = (tracerCount % gun.tracerInterval === 0);
      this.bullets.push(b);
    }
  }

  stopGun() {
    this.gunTimer = 0;
  }

  fireIRMissile(state, weaponState, targetState) {
    if (weaponState.irCount <= 0) return null;
    if (weaponState.irLockProgress < 1.0) return null;
    if (weaponState.missileCooldown > 0) return null;

    const ac = AIRCRAFT[state.aircraftType];
    const wpn = WEAPONS[ac.irMissile];

    weaponState.irCount--;
    weaponState.missileCooldown = 1.5;
    weaponState.irLockProgress = 0;
    weaponState.irLockTarget = null;

    const m = new Missile(
      state.latitude, state.longitude, state.altitudeMSL,
      state.heading, state.pitch, state.speed,
      wpn, 'player', targetState?.id
    );
    this.missiles.push(m);
    return m;
  }

  fireRadarMissile(state, weaponState, targetState) {
    if (weaponState.radarCount <= 0) return null;
    if (weaponState.radarLockProgress < 1.0) return null;
    if (weaponState.missileCooldown > 0) return null;

    const ac = AIRCRAFT[state.aircraftType];
    const wpn = WEAPONS[ac.radarMissile];

    weaponState.radarCount--;
    weaponState.missileCooldown = 2.0;

    const m = new Missile(
      state.latitude, state.longitude, state.altitudeMSL,
      state.heading, state.pitch, state.speed,
      wpn, 'player', targetState?.id
    );
    this.missiles.push(m);
    return m;
  }

  deployFlares(weaponState) {
    if (weaponState.flares <= 0 || weaponState.cmsTimer > 0) return false;
    weaponState.flares--;
    weaponState.cmsTimer = 0.5;
    return true;
  }

  deployChaff(weaponState) {
    if (weaponState.chaff <= 0 || weaponState.cmsTimer > 0) return false;
    weaponState.chaff--;
    weaponState.cmsTimer = 0.5;
    return true;
  }

  updateLocks(state, weaponState, targets, dt) {
    const ac = AIRCRAFT[state.aircraftType];

    // IR lock
    const irWpn = WEAPONS[ac.irMissile];
    let bestIR = null;
    let bestIRAngle = irWpn.lockCone;

    for (const t of targets) {
      if (!t.alive || t.team === state.team) continue;
      const angle = angleTo(state, t);
      if (angle < bestIRAngle) {
        bestIRAngle = angle;
        bestIR = t;
      }
    }

    if (bestIR && bestIR === weaponState.irLockTarget) {
      weaponState.irLockProgress = Math.min(1, weaponState.irLockProgress + dt / irWpn.lockTime);
    } else if (bestIR) {
      weaponState.irLockTarget = bestIR;
      weaponState.irLockProgress = 0;
    } else {
      weaponState.irLockTarget = null;
      weaponState.irLockProgress = 0;
    }

    // Radar lock (wider cone, faster lock, longer range)
    const radarWpn = WEAPONS[ac.radarMissile];
    let bestRadar = null;
    let bestRadarDist = radarWpn.maxRange;

    for (const t of targets) {
      if (!t.alive || t.team === state.team) continue;
      const angle = angleTo(state, t);
      const dist = distanceTo(state, t);
      if (angle < 0.5 && dist < bestRadarDist) { // 30° radar cone
        bestRadarDist = dist;
        bestRadar = t;
      }
    }

    if (bestRadar && bestRadar === weaponState.radarLockTarget) {
      weaponState.radarLockProgress = Math.min(1, weaponState.radarLockProgress + dt / radarWpn.lockTime);
    } else if (bestRadar) {
      weaponState.radarLockTarget = bestRadar;
      weaponState.radarLockProgress = 0;
    } else {
      weaponState.radarLockTarget = null;
      weaponState.radarLockProgress = 0;
    }

    // Cooldowns
    if (weaponState.missileCooldown > 0) weaponState.missileCooldown -= dt;
    if (weaponState.cmsTimer > 0) weaponState.cmsTimer -= dt;
  }

  update(dt, entities) {
    // Update bullets
    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter(b => b.alive);

    // Update missiles
    for (const m of this.missiles) {
      const target = entities.find(e => e.id === m.targetId);
      m.update(dt, target);

      // Check if countermeasures broke lock
      if (target && m.alive) {
        if (!m.isRadar && target._flaresActive) {
          if (Math.random() < m.weapon.flareVuln * dt) {
            m.targetId = null; // lost lock
          }
        }
        if (m.isRadar && target._chaffActive) {
          if (Math.random() < m.weapon.chaffVuln * dt) {
            m.targetId = null;
          }
        }
      }

      // Detonation
      if (m.detonated && target) {
        this.explosions.push({
          lat: m.lat, lon: m.lon, alt: m.alt,
          age: 0, maxAge: 2.0
        });
      }
    }
    this.missiles = this.missiles.filter(m => m.alive);

    // Update explosions
    for (const e of this.explosions) e.age += dt;
    this.explosions = this.explosions.filter(e => e.age < e.maxAge);

    // Bullet hit detection
    const hits = [];
    for (const b of this.bullets) {
      for (const e of entities) {
        if (e.id === b.ownerId || !e.alive) continue;
        const dist = distanceBetween(b, e);
        if (dist < 15) { // 15m hit radius
          hits.push({ bullet: b, target: e, damage: b.weapon.damage });
          b.alive = false;
          break;
        }
      }
    }

    // Missile hit detection (proximity fuse)
    for (const m of this.missiles) {
      if (m.detonated) {
        for (const e of entities) {
          if (e.id === m.ownerId || !e.alive) continue;
          const dist = distanceBetween(m, e);
          if (dist < 30) { // 30m blast radius
            hits.push({ missile: m, target: e, damage: m.weapon.damage });
          }
        }
      }
    }

    return hits;
  }

  clear() {
    this.bullets = [];
    this.missiles = [];
    this.explosions = [];
  }
}

// ─── Utility ───
function angleTo(from, to) {
  const dLat = to.latitude - from.latitude;
  const dLon = to.longitude - from.longitude;
  const bearing = Math.atan2(dLon * Math.cos(from.latitude), dLat);
  let diff = bearing - from.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff);
}

function distanceTo(from, to) {
  const dLat = (to.latitude - from.latitude) * EARTH_RADIUS;
  const dLon = (to.longitude - from.longitude) * EARTH_RADIUS * Math.cos(from.latitude);
  const dAlt = to.altitudeMSL - from.altitudeMSL;
  return Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
}

export function distanceBetween(a, b) {
  const dLat = ((b.latitude || b.lat) - (a.latitude || a.lat)) * EARTH_RADIUS;
  const dLon = ((b.longitude || b.lon) - (a.longitude || a.lon)) * EARTH_RADIUS * Math.cos(a.latitude || a.lat);
  const dAlt = (b.altitudeMSL || b.alt) - (a.altitudeMSL || a.alt);
  return Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
}
