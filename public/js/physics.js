// ─── Fighter Jet Flight Dynamics Engine ───
import { AIRCRAFT } from './aircraft.js';

const GRAVITY = 9.81;
const AIR_DENSITY_SEA = 1.225;
const EARTH_RADIUS = 6378137;
const SPEED_OF_SOUND = 343;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getAirDensity(alt) {
  return AIR_DENSITY_SEA * Math.exp(-alt / 10000);
}

export function createFlightState(aircraftType, lat, lon, alt, heading) {
  return {
    aircraftType,
    latitude: lat,
    longitude: lon,
    altitudeMSL: alt,
    heading: heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    afterburner: false,
    vs: 0,
    pitchRate: 0,
    rollRate: 0,
    yawRate: 0,
    aoa: 0,
    gForce: 1,
    mach: 0,
    onGround: true,
    gearDown: true,
    speedBrake: false,
    stalling: false,
    crashed: false,
    terrainHeight: 0,
    agl: 0,
    health: 100,
    alive: true,
    // G-effect
    gEffectVision: 1.0, // 1=clear, 0=blackout
    gSustained: 1.0,    // rolling avg G
    // Fuel
    fuel: 100,
    // Autopilot (from existing code)
    autopilot: false,
    targetLat: 0,
    targetLon: 0,
    targetAlt: 0,
  };
}

export function updatePhysics(state, input, dt, getTerrainHeight) {
  if (!state.alive || state.crashed || dt > 0.1) return;
  dt = Math.min(dt, 0.05);

  const ac = AIRCRAFT[state.aircraftType];
  if (!ac) return;

  // ─── Control Input ───
  let { pitchInput, rollInput, yawInput } = input;

  const controlAuth = clamp(state.speed / 80, 0, 1);
  const pitchRateMax = ac.pitchRateMax * controlAuth;
  const rollRateMax = ac.rollRateMax * controlAuth;
  const yawRateMax = ac.yawRateMax * controlAuth;

  // G-effect reduces control authority
  const gMult = state.gEffectVision;
  state.pitchRate += (pitchInput * pitchRateMax * gMult - state.pitchRate * 3) * dt;
  state.rollRate += (rollInput * rollRateMax * gMult - state.rollRate * 3) * dt;
  state.yawRate += (yawInput * yawRateMax * gMult - state.yawRate * 2) * dt;

  state.pitch += state.pitchRate * dt;
  state.roll += state.rollRate * dt;
  state.heading += state.yawRate * dt;

  // Auto-level roll when no input
  if (Math.abs(rollInput) < 0.1) {
    state.roll *= (1 - 0.3 * dt);
  }
  state.pitch = clamp(state.pitch, -Math.PI / 2.5, Math.PI / 2.5);

  // ─── Throttle & Afterburner ───
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.5);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.5);

  // Afterburner: above 95% throttle with AB toggled
  const useAB = state.afterburner && state.throttle > 0.95;
  const thrustMax = useAB ? ac.maxThrust : ac.dryThrust;

  // Fuel consumption
  const fuelRate = useAB ? 0.8 : 0.2; // %/second at full throttle
  state.fuel -= state.throttle * fuelRate * dt;
  if (state.fuel <= 0) {
    state.fuel = 0;
    state.throttle = 0;
  }

  // ─── Aerodynamics ───
  const rho = getAirDensity(state.altitudeMSL);
  const dynamicPressure = 0.5 * rho * state.speed * state.speed;

  state.aoa = state.pitch;
  state.mach = state.speed / SPEED_OF_SOUND;

  // Lift
  let CL = ac.clBase + ac.clPerAoa * state.aoa;
  state.stalling = Math.abs(state.aoa) > ac.stallAngle;
  if (state.stalling) CL *= 0.4;
  CL = clamp(CL, -ac.clMax, ac.clMax);
  const lift = dynamicPressure * ac.wingArea * CL;

  // Drag
  let CD = ac.cdMin + ac.cdInducedK * CL * CL
    + (state.gearDown ? 0.025 : 0)
    + (state.speedBrake ? 0.06 : 0);
  // Compressibility drag (wave drag above Mach 0.8)
  if (state.mach > 0.8) {
    CD += 0.1 * Math.pow(state.mach - 0.8, 2);
  }
  const drag = dynamicPressure * ac.wingArea * CD;

  // Thrust (scales with air density at altitude)
  const thrustEff = state.throttle * thrustMax * (0.7 + 0.3 * (rho / AIR_DENSITY_SEA));
  // Damage reduces thrust
  const thrustMult = state.health > 25 ? 1.0 : 0.5;

  const cosPitch = Math.cos(state.pitch);
  const sinPitch = Math.sin(state.pitch);

  const netForward = thrustEff * thrustMult - drag - ac.mass * GRAVITY * sinPitch;
  const netUp = lift * cosPitch - ac.mass * GRAVITY * cosPitch;

  const accelForward = netForward / ac.mass;
  const accelUp = netUp / ac.mass;

  state.speed += accelForward * dt;
  state.speed = Math.max(0, state.speed);

  const verticalSpeed = state.speed * sinPitch;
  const horizontalSpeed = state.speed * cosPitch;

  // ─── Bank-induced turn ───
  if (!state.onGround && state.speed > 30) {
    const turnRate = (GRAVITY * Math.tan(state.roll)) / Math.max(state.speed, 30);
    state.heading += turnRate * dt;
  }

  // Ground steering
  if (state.onGround && state.speed < 50) {
    if (input.yawInput < 0) state.heading -= 0.8 * dt;
    if (input.yawInput > 0) state.heading += 0.8 * dt;
  }

  // ─── Position integration ───
  state.altitudeMSL += verticalSpeed * dt;
  state.latitude += (horizontalSpeed * Math.cos(state.heading) * dt) / EARTH_RADIUS;
  state.longitude += (horizontalSpeed * Math.sin(state.heading) * dt) / (EARTH_RADIUS * Math.cos(state.latitude));

  // ─── Terrain ───
  const terrainH = getTerrainHeight(state.longitude, state.latitude);
  if (terrainH !== undefined && terrainH !== null) {
    state.terrainHeight = terrainH;
  }
  state.agl = state.altitudeMSL - state.terrainHeight;

  const gearHeight = state.gearDown ? 5 : 2;
  state.onGround = state.agl <= gearHeight + 0.5;

  if (state.onGround) {
    state.altitudeMSL = state.terrainHeight + gearHeight;
    state.agl = gearHeight;
    if (state.vs < -0.5) state.vs = 0;

    // Braking
    if (state.speedBrake) {
      state.speed *= (1 - 2.0 * dt);
      if (state.speed < 0.5) state.speed = 0;
    } else {
      state.speed *= (1 - 0.05 * dt);
    }

    if (state.pitch > 0.05) state.pitch *= 0.95;
    if (state.pitch < -0.02) state.pitch = -0.02;

    // Crash detection
    if (!state.gearDown && state.speed > 10) {
      state.crashed = true;
      state.alive = false;
    }
    if (verticalSpeed < -15 && state.speed > 30) {
      state.crashed = true;
      state.alive = false;
    }
  }

  // ─── G-Force ───
  state.gForce = 1 + accelUp / GRAVITY;

  // Energy bleed in turns
  const gLoad = Math.abs(state.gForce);
  if (gLoad > 1 && state.speed > 50) {
    const energyBleed = (gLoad - 1) * 2.0 * dt;
    state.speed = Math.max(state.speed - energyBleed, 50);
  }

  // ─── G-Effect (blackout/redout) ───
  state.gSustained = state.gSustained * 0.95 + state.gForce * 0.05; // rolling avg

  let targetVision = 1.0;
  if (state.gSustained > 7) {
    targetVision = clamp(1.0 - (state.gSustained - 7) / 3, 0, 1); // 7G->tunnel, 10G->blackout
  } else if (state.gSustained < -2) {
    targetVision = clamp(1.0 - (-state.gSustained - 2) / 2, 0, 1); // redout
  }
  // Smooth transition
  state.gEffectVision += (targetVision - state.gEffectVision) * dt * 2;
  state.gEffectVision = clamp(state.gEffectVision, 0, 1);

  state.vs = verticalSpeed;

  // Health-based damage effects
  if (state.health <= 0 && state.alive) {
    state.alive = false;
    state.crashed = true;
  }
}

export function applyDamage(state, amount) {
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0) {
    state.alive = false;
  }
}

export function respawn(state, lat, lon, alt, heading) {
  state.latitude = lat;
  state.longitude = lon;
  state.altitudeMSL = alt;
  state.heading = heading;
  state.pitch = 0;
  state.roll = 0;
  state.speed = 200;
  state.throttle = 0.7;
  state.afterburner = false;
  state.vs = 0;
  state.pitchRate = 0;
  state.rollRate = 0;
  state.yawRate = 0;
  state.onGround = false;
  state.gearDown = false;
  state.speedBrake = false;
  state.crashed = false;
  state.stalling = false;
  state.alive = true;
  state.health = 100;
  state.fuel = 100;
  state.gEffectVision = 1.0;
  state.gSustained = 1.0;
}
