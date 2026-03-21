// ─── AI Opponents: Rookie, Veteran, Ace ───
import { AIRCRAFT, createWeaponState, WEAPONS } from './aircraft.js';
import { updatePhysics, applyDamage } from './physics.js';
import { Missile } from './weapons.js';

const EARTH_RADIUS = 6378137;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const AI_TIERS = {
  rookie: {
    reactionTime: 2.0, aimAccuracy: 0.3, turnAggro: 0.5,
    useMissiles: false, useCms: false, maxG: 5,
    bvr: false, terrainAware: false, label: 'ROOKIE',
  },
  veteran: {
    reactionTime: 0.8, aimAccuracy: 0.65, turnAggro: 0.8,
    useMissiles: true, useCms: true, maxG: 7,
    bvr: false, terrainAware: true, label: 'VETERAN',
  },
  ace: {
    reactionTime: 0.3, aimAccuracy: 0.85, turnAggro: 1.0,
    useMissiles: true, useCms: true, maxG: 9,
    bvr: true, terrainAware: true, label: 'ACE',
  },
};

let nextAiId = 1;

export class AIFighter {
  constructor(tier, aircraftType, lat, lon, alt, heading, team) {
    this.id = 'ai_' + (nextAiId++);
    this.tier = AI_TIERS[tier] || AI_TIERS.rookie;
    this.tierName = tier;
    this.team = team;
    this.name = `${this.tier.label} ${nextAiId - 1}`;

    this.aircraftType = aircraftType;
    this.latitude = lat;
    this.longitude = lon;
    this.altitudeMSL = alt;
    this.heading = heading;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 200;
    this.throttle = 0.7;
    this.afterburner = false;
    this.vs = 0;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawRate = 0;
    this.aoa = 0;
    this.gForce = 1;
    this.mach = 0;
    this.onGround = false;
    this.gearDown = false;
    this.speedBrake = false;
    this.stalling = false;
    this.crashed = false;
    this.terrainHeight = 0;
    this.agl = 500;
    this.health = 100;
    this.alive = true;
    this.fuel = 100;
    this.gEffectVision = 1.0;
    this.gSustained = 1.0;

    // AI state machine
    this.state = 'patrol'; // patrol, engage, attack, evade, extend
    this.target = null;
    this.reactionTimer = 0;
    this.stateTimer = 0;
    this.fireTimer = 0;

    // Weapons
    this.weaponState = createWeaponState(aircraftType);
    this._flaresActive = false;
    this._chaffActive = false;
    this._cmsTimer = 0;

    // Patrol waypoints (circle pattern)
    this.patrolCenter = { lat, lon };
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolRadius = 3000 + Math.random() * 2000;
    this.patrolAlt = alt;
  }

  update(dt, playerState, allEntities, getTerrainHeight, weaponManager) {
    if (!this.alive) return;

    this.stateTimer += dt;
    this.reactionTimer += dt;
    this._cmsTimer = Math.max(0, this._cmsTimer - dt);
    this._flaresActive = this._cmsTimer > 0;
    this._chaffActive = this._cmsTimer > 0;

    // Find closest enemy
    const enemies = allEntities.filter(e =>
      e.alive && e.id !== this.id && e.team !== this.team
    );
    const closest = this.findClosest(enemies);
    const distToClosest = closest ? this.distTo(closest) : Infinity;

    // State transitions
    this.updateState(closest, distToClosest, weaponManager);

    // Generate control input based on AI state
    const input = this.generateInput(dt, closest, distToClosest, getTerrainHeight, weaponManager);

    // Run physics (reuse player physics engine)
    updatePhysics(this, input, dt, (lon, lat) => {
      const h = getTerrainHeight(lon, lat);
      return h !== undefined ? h : 0;
    });

    // Fire weapons
    this.updateWeapons(dt, closest, distToClosest, weaponManager);
  }

  updateState(closest, dist, weaponManager) {
    // Check for incoming missiles
    const incomingMissile = weaponManager.missiles.find(m =>
      m.alive && m.targetId === this.id
    );

    if (incomingMissile && this.tier.useCms) {
      this.state = 'evade';
      this.stateTimer = 0;
      return;
    }

    switch (this.state) {
      case 'patrol':
        if (closest && dist < 15000) {
          if (this.reactionTimer > this.tier.reactionTime) {
            this.target = closest;
            this.state = 'engage';
            this.stateTimer = 0;
          }
        }
        break;

      case 'engage':
        if (!closest || !closest.alive) { this.state = 'patrol'; break; }
        if (dist < 2000) { this.state = 'attack'; this.stateTimer = 0; }
        if (this.health < 30) { this.state = 'extend'; this.stateTimer = 0; }
        break;

      case 'attack':
        if (!closest || !closest.alive) { this.state = 'patrol'; break; }
        if (dist > 5000) { this.state = 'engage'; this.stateTimer = 0; }
        if (this.health < 30) { this.state = 'extend'; this.stateTimer = 0; }
        break;

      case 'evade':
        if (this.stateTimer > 4) { // Evade for 4 seconds
          this.state = closest ? 'engage' : 'patrol';
          this.stateTimer = 0;
        }
        break;

      case 'extend':
        if (this.stateTimer > 8) { // Disengage for 8 seconds
          this.state = 'patrol';
          this.stateTimer = 0;
        }
        break;
    }
  }

  generateInput(dt, target, dist, getTerrainHeight, weaponManager) {
    const input = { pitchInput: 0, rollInput: 0, yawInput: 0, throttleUp: false, throttleDown: false };
    const aggro = this.tier.turnAggro;

    switch (this.state) {
      case 'patrol': {
        // Circle patrol pattern
        this.patrolAngle += dt * 0.05;
        const wpLat = this.patrolCenter.lat + (this.patrolRadius / EARTH_RADIUS) * Math.cos(this.patrolAngle);
        const wpLon = this.patrolCenter.lon + (this.patrolRadius / EARTH_RADIUS) * Math.sin(this.patrolAngle) / Math.cos(this.patrolCenter.lat);

        this.steerToward(input, wpLat, wpLon, this.patrolAlt, 0.3);
        this.throttle = 0.5;
        break;
      }

      case 'engage': {
        if (!target) break;
        // Fly toward target
        this.steerToward(input, target.latitude, target.longitude, target.altitudeMSL, aggro);
        this.throttle = 0.9;
        this.afterburner = dist > 8000;
        break;
      }

      case 'attack': {
        if (!target) break;
        // Lead pursuit
        const leadTime = dist / (this.speed || 200);
        const leadLat = target.latitude + (target.speed || 0) * Math.cos(target.heading || 0) * leadTime * 0.3 / EARTH_RADIUS;
        const leadLon = target.longitude + (target.speed || 0) * Math.sin(target.heading || 0) * leadTime * 0.3 / (EARTH_RADIUS * Math.cos(target.latitude));

        this.steerToward(input, leadLat, leadLon, target.altitudeMSL, aggro);
        this.throttle = 0.8;
        this.afterburner = false;
        break;
      }

      case 'evade': {
        // Hard break turn + deploy countermeasures
        input.rollInput = (Math.sin(this.stateTimer * 2) > 0) ? 1 : -1;
        input.pitchInput = -0.8 * aggro;
        this.throttle = 1.0;
        this.afterburner = true;

        if (this._cmsTimer <= 0 && this.tier.useCms) {
          if (this.weaponState.flares > 0) {
            this.weaponState.flares--;
            this._cmsTimer = 0.5;
          }
          if (this.weaponState.chaff > 0) {
            this.weaponState.chaff--;
          }
        }
        break;
      }

      case 'extend': {
        // Fly away from threat
        if (target) {
          const awayBearing = Math.atan2(
            (this.longitude - target.longitude) * Math.cos(this.latitude),
            this.latitude - target.latitude
          );
          this.steerToHeading(input, awayBearing, 0.5);
        }
        input.pitchInput = -0.2; // slight climb
        this.throttle = 1.0;
        this.afterburner = true;
        break;
      }
    }

    // Terrain avoidance
    if (this.tier.terrainAware && this.agl < 200) {
      input.pitchInput = -1; // PULL UP
      this.throttle = 1.0;
    }

    return input;
  }

  steerToward(input, targetLat, targetLon, targetAlt, aggro) {
    const dLat = targetLat - this.latitude;
    const dLon = targetLon - this.longitude;
    const bearing = Math.atan2(dLon * Math.cos(this.latitude), dLat);

    this.steerToHeading(input, bearing, aggro);

    // Pitch toward target altitude
    const altError = targetAlt - this.altitudeMSL;
    const targetPitch = clamp(altError * 0.003, -0.3, 0.3) * aggro;
    input.pitchInput = clamp((targetPitch - this.pitch) * 3, -1, 1);
  }

  steerToHeading(input, targetHeading, aggro) {
    let headingError = targetHeading - this.heading;
    while (headingError > Math.PI) headingError -= 2 * Math.PI;
    while (headingError < -Math.PI) headingError += 2 * Math.PI;

    const targetRoll = clamp(headingError * 1.5 * aggro, -0.8, 0.8);
    input.rollInput = clamp((targetRoll - this.roll) * 2, -1, 1);
  }

  updateWeapons(dt, target, dist, weaponManager) {
    if (!target || !target.alive) return;
    this.fireTimer += dt;

    const angle = this.angleTo(target);

    // Gun: close range, on target
    if (dist < 1500 && angle < 0.15 && this.fireTimer > 0.1) {
      if (Math.random() < this.tier.aimAccuracy) {
        const ac = AIRCRAFT[this.aircraftType];
        const gun = WEAPONS[ac.gun];
        if (this.weaponState.gunAmmo > 0) {
          this.weaponState.gunAmmo--;
          // Simplified: direct hit check based on accuracy
          const hitChance = this.tier.aimAccuracy * (1 - dist / 2000) * (1 - angle / 0.15);
          if (Math.random() < hitChance * 0.3) {
            applyDamage(target, gun.damage);
            weaponManager.explosions.push({
              lat: target.latitude, lon: target.longitude, alt: target.altitudeMSL,
              age: 0, maxAge: 0.3,
            });
          }
        }
      }
      this.fireTimer = 0;
    }

    // IR missile
    if (this.tier.useMissiles && dist < 8000 && dist > 500 && angle < 0.5 && this.weaponState.irCount > 0) {
      if (this.fireTimer > 3) {
        const ac = AIRCRAFT[this.aircraftType];
        const wpn = WEAPONS[ac.irMissile];
        this.weaponState.irCount--;
        const m = new Missile(
          this.latitude, this.longitude, this.altitudeMSL,
          this.heading, this.pitch, this.speed,
          wpn, this.id, target.id
        );
        weaponManager.missiles.push(m);
        this.fireTimer = 0;
      }
    }
  }

  findClosest(enemies) {
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      const d = this.distTo(e);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  distTo(other) {
    const dLat = (other.latitude - this.latitude) * EARTH_RADIUS;
    const dLon = (other.longitude - this.longitude) * EARTH_RADIUS * Math.cos(this.latitude);
    const dAlt = (other.altitudeMSL || 0) - this.altitudeMSL;
    return Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
  }

  angleTo(other) {
    const dLat = other.latitude - this.latitude;
    const dLon = other.longitude - this.longitude;
    const bearing = Math.atan2(dLon * Math.cos(this.latitude), dLat);
    let diff = bearing - this.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff);
  }
}

export function spawnAIWave(waveNum, centerLat, centerLon, baseAlt, team) {
  const ais = [];
  let count, tiers;

  if (waveNum <= 3) {
    count = waveNum + 1;
    tiers = ['rookie'];
  } else if (waveNum <= 6) {
    count = waveNum;
    tiers = ['rookie', 'veteran'];
  } else {
    count = Math.min(waveNum + 1, 10);
    tiers = ['veteran', 'ace'];
  }

  for (let i = 0; i < count; i++) {
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    const acType = team === 'opfor' ? 'MIG29' : 'F15';
    const angle = (i / count) * Math.PI * 2;
    const spawnR = 5000 / EARTH_RADIUS;
    const lat = centerLat + spawnR * Math.cos(angle);
    const lon = centerLon + spawnR * Math.sin(angle) / Math.cos(centerLat);
    const alt = baseAlt + 500 + Math.random() * 1000;
    const heading = angle + Math.PI; // face center

    ais.push(new AIFighter(tier, acType, lat, lon, alt, heading, team));
  }

  return ais;
}
