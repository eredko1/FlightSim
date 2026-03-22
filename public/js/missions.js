// ─── Mission / Campaign System ───
import { distanceBetween } from './weapons.js';

const EARTH_RADIUS = 6378137;

// ─── Mission Definitions ───

const MISSIONS = [
  {
    id: 'first-flight',
    name: 'First Flight',
    description: 'Complete a basic flight training exercise over New York City.',
    briefing: 'Welcome to flight school. Take off from the runway, fly to the marked waypoint over Manhattan, then return and land safely. Keep it steady.',
    aircraft: ['C172'],
    location: { lat: 40.64, lon: -73.78, alt: 30, heading: 310 },
    weather: 'clear',
    timeOfDay: 10,
    objectives: [
      { type: 'waypoint', lat: 40.758, lon: -73.985, alt: 600, radius: 500, description: 'Fly to waypoint over Times Square', current: 0, completed: false },
      { type: 'land', description: 'Land safely', completed: false },
    ],
    spawnEnemies: [],
    rewards: { unlocks: 'top-gun' },
    timeLimit: 0,
  },
  {
    id: 'top-gun',
    name: 'Top Gun',
    description: 'Engage and destroy 5 MiG-29 Fulcrums over the Pacific.',
    briefing: 'Intel reports a flight of MiG-29s operating 50nm west of San Francisco. Scramble and intercept. Fox 3.',
    aircraft: ['F15'],
    location: { lat: 37.5, lon: -123.5, alt: 5000, heading: 270 },
    weather: 'clear',
    timeOfDay: 12,
    objectives: [
      { type: 'destroy', count: 5, targetType: 'MIG29', current: 0, completed: false, description: 'Destroy 5 MiG-29s' },
      { type: 'survive', completed: false, description: 'Survive the engagement' },
    ],
    spawnEnemies: [
      { type: 'MIG29', tier: 'veteran', count: 3, lat: 37.5, lon: -124.0, alt: 6000, team: 'opfor' },
      { type: 'MIG29', tier: 'ace', count: 2, lat: 37.6, lon: -124.2, alt: 7000, team: 'opfor', delay: 30 },
    ],
    rewards: { unlocks: 'night-raid' },
    timeLimit: 600,
  },
  {
    id: 'night-raid',
    name: 'Night Raid',
    description: 'Destroy ground targets under cover of darkness using precision munitions.',
    briefing: 'A high-value target complex has been identified. You will approach at altitude in the B-2 Spirit and deliver JDAMs on three target coordinates. Stealth is your armor — stay above 3000m.',
    aircraft: ['B2'],
    location: { lat: 34.0, lon: -118.0, alt: 8000, heading: 90 },
    weather: 'overcast',
    timeOfDay: 2,
    objectives: [
      { type: 'waypoint', lat: 34.05, lon: -117.8, alt: 8000, radius: 800, description: 'Strike target Alpha', current: 0, completed: false },
      { type: 'waypoint', lat: 34.1, lon: -117.6, alt: 8000, radius: 800, description: 'Strike target Bravo', current: 0, completed: false },
      { type: 'waypoint', lat: 34.02, lon: -117.5, alt: 8000, radius: 800, description: 'Strike target Charlie', current: 0, completed: false },
      { type: 'survive', completed: false, description: 'Return to base safely' },
    ],
    spawnEnemies: [],
    rewards: { unlocks: 'helicopter-rescue' },
    timeLimit: 900,
  },
  {
    id: 'helicopter-rescue',
    name: 'Helicopter Rescue',
    description: 'Fly to three crash sites and hold position to extract survivors.',
    briefing: 'Three downed pilots await extraction in the mountains north of base. Fly to each beacon and hold a stable hover for 10 seconds to winch them aboard. Watch your altitude in the valleys.',
    aircraft: ['AH64'],
    location: { lat: 35.0, lon: -117.5, alt: 500, heading: 0 },
    weather: 'clear',
    timeOfDay: 7,
    objectives: [
      { type: 'hover', lat: 35.05, lon: -117.45, alt: 200, radius: 100, duration: 10, description: 'Extract survivor at site Alpha', current: 0, completed: false },
      { type: 'hover', lat: 35.1, lon: -117.4, alt: 300, radius: 100, duration: 10, description: 'Extract survivor at site Bravo', current: 0, completed: false },
      { type: 'hover', lat: 35.15, lon: -117.35, alt: 250, radius: 100, duration: 10, description: 'Extract survivor at site Charlie', current: 0, completed: false },
      { type: 'survive', completed: false, description: 'Return safely' },
    ],
    spawnEnemies: [],
    rewards: { unlocks: 'canyon-run' },
    timeLimit: 0,
  },
  {
    id: 'canyon-run',
    name: 'Canyon Run',
    description: 'Thread your aircraft through a series of altitude gates in the Grand Canyon.',
    briefing: 'Think you can fly? Prove it. Navigate through eight altitude gates carved through the Grand Canyon at speed. Miss a gate and you fail. Hit the walls and... well, don\'t.',
    aircraft: [],
    location: { lat: 36.1, lon: -112.3, alt: 2000, heading: 90 },
    weather: 'clear',
    timeOfDay: 15,
    objectives: [
      { type: 'waypoint', lat: 36.1, lon: -112.2, alt: 1500, radius: 500, description: 'Gate 1', current: 0, completed: false },
      { type: 'waypoint', lat: 36.105, lon: -112.1, alt: 1400, radius: 500, description: 'Gate 2', current: 0, completed: false },
      { type: 'waypoint', lat: 36.095, lon: -112.0, alt: 1300, radius: 500, description: 'Gate 3', current: 0, completed: false },
      { type: 'waypoint', lat: 36.11, lon: -111.9, alt: 1200, radius: 500, description: 'Gate 4', current: 0, completed: false },
      { type: 'waypoint', lat: 36.09, lon: -111.8, alt: 1100, radius: 500, description: 'Gate 5', current: 0, completed: false },
      { type: 'waypoint', lat: 36.1, lon: -111.7, alt: 1300, radius: 500, description: 'Gate 6', current: 0, completed: false },
      { type: 'waypoint', lat: 36.108, lon: -111.6, alt: 1500, radius: 500, description: 'Gate 7', current: 0, completed: false },
      { type: 'waypoint', lat: 36.1, lon: -111.5, alt: 1800, radius: 500, description: 'Gate 8', current: 0, completed: false },
      { type: 'survive', completed: false, description: 'Don\'t crash' },
    ],
    spawnEnemies: [],
    rewards: { unlocks: 'ace-combat' },
    timeLimit: 300,
  },
  {
    id: 'ace-combat',
    name: 'Ace Combat',
    description: 'Survive 10 waves of increasingly dangerous enemies.',
    briefing: 'You are alone against the world. Enemy flights will engage in successive waves, each stronger than the last. Survive all ten and earn the title of Ace. Good luck — you\'ll need it.',
    aircraft: ['F15'],
    location: { lat: 36.0, lon: -115.0, alt: 5000, heading: 0 },
    weather: 'clear',
    timeOfDay: 14,
    objectives: [
      { type: 'destroy', count: 30, targetType: 'any', current: 0, completed: false, description: 'Destroy all enemies across 10 waves' },
      { type: 'survive', completed: false, description: 'Stay alive' },
    ],
    spawnEnemies: [
      { type: 'MIG29', tier: 'rookie', count: 2, lat: 36.0, lon: -115.3, alt: 5000, team: 'opfor', wave: 1 },
      { type: 'MIG29', tier: 'rookie', count: 3, lat: 36.0, lon: -115.3, alt: 5500, team: 'opfor', wave: 2 },
      { type: 'MIG29', tier: 'veteran', count: 2, lat: 36.0, lon: -115.3, alt: 5000, team: 'opfor', wave: 3 },
      { type: 'MIG29', tier: 'veteran', count: 3, lat: 36.0, lon: -115.3, alt: 5500, team: 'opfor', wave: 4 },
      { type: 'MIG29', tier: 'veteran', count: 4, lat: 36.0, lon: -115.3, alt: 6000, team: 'opfor', wave: 5 },
      { type: 'MIG29', tier: 'ace', count: 2, lat: 36.0, lon: -115.3, alt: 5000, team: 'opfor', wave: 6 },
      { type: 'MIG29', tier: 'ace', count: 3, lat: 36.0, lon: -115.3, alt: 5500, team: 'opfor', wave: 7 },
      { type: 'MIG29', tier: 'ace', count: 4, lat: 36.0, lon: -115.3, alt: 6000, team: 'opfor', wave: 8 },
      { type: 'MIG29', tier: 'ace', count: 4, lat: 36.05, lon: -115.3, alt: 6500, team: 'opfor', wave: 9 },
      { type: 'MIG29', tier: 'ace', count: 5, lat: 36.05, lon: -115.3, alt: 7000, team: 'opfor', wave: 10 },
    ],
    rewards: { unlocks: 'dogfight-championship' },
    timeLimit: 0,
  },
  {
    id: 'escort-mission',
    name: 'Escort Mission',
    description: 'Protect a convoy moving along a waypoint path from enemy air attacks.',
    briefing: 'A supply convoy is moving through hostile territory along a fixed route. Enemy interceptors will attempt to destroy the convoy. Keep them safe — if the convoy takes too many hits, the mission fails.',
    aircraft: ['F15'],
    location: { lat: 38.0, lon: -122.0, alt: 4000, heading: 45 },
    weather: 'clear',
    timeOfDay: 11,
    objectives: [
      { type: 'destroy', count: 12, targetType: 'any', current: 0, completed: false, description: 'Eliminate all enemy interceptors' },
      { type: 'survive', completed: false, description: 'Survive the escort' },
    ],
    escortPath: [
      { lat: 38.0, lon: -122.0, alt: 1000 },
      { lat: 38.1, lon: -121.8, alt: 1000 },
      { lat: 38.2, lon: -121.6, alt: 1000 },
      { lat: 38.3, lon: -121.4, alt: 1000 },
    ],
    spawnEnemies: [
      { type: 'MIG29', tier: 'rookie', count: 3, lat: 38.05, lon: -121.9, alt: 4000, team: 'opfor', delay: 10 },
      { type: 'MIG29', tier: 'veteran', count: 3, lat: 38.15, lon: -121.7, alt: 4500, team: 'opfor', delay: 60 },
      { type: 'MIG29', tier: 'veteran', count: 3, lat: 38.25, lon: -121.5, alt: 5000, team: 'opfor', delay: 120 },
      { type: 'MIG29', tier: 'ace', count: 3, lat: 38.3, lon: -121.4, alt: 5500, team: 'opfor', delay: 180 },
    ],
    rewards: { unlocks: 'storm-chaser' },
    timeLimit: 0,
  },
  {
    id: 'dogfight-championship',
    name: 'Dogfight Championship',
    description: '1v1 against an elite ace pilot. Only one walks away.',
    briefing: 'The enemy\'s top ace has issued a challenge — a duel over the desert, no missiles, guns only. Merge at 5000 meters and may the best pilot win. Honor demands you accept.',
    aircraft: ['F15'],
    location: { lat: 35.0, lon: -116.0, alt: 5000, heading: 0 },
    weather: 'clear',
    timeOfDay: 17,
    objectives: [
      { type: 'destroy', count: 1, targetType: 'SU27', current: 0, completed: false, description: 'Defeat the enemy ace' },
      { type: 'survive', completed: false, description: 'Don\'t get shot down' },
    ],
    spawnEnemies: [
      { type: 'SU27', tier: 'ace', count: 1, lat: 35.05, lon: -116.0, alt: 5000, team: 'opfor', heading: 180 },
    ],
    rewards: {},
    timeLimit: 0,
  },
  {
    id: 'free-flight',
    name: 'Free Flight',
    description: 'No objectives. Pick any aircraft and explore the world.',
    briefing: 'The sky is yours. No enemies, no timers, no objectives. Just you, the aircraft, and the open sky. Enjoy.',
    aircraft: [],
    location: { lat: 40.64, lon: -73.78, alt: 1000, heading: 0 },
    weather: 'clear',
    timeOfDay: 10,
    objectives: [],
    spawnEnemies: [],
    rewards: {},
    timeLimit: 0,
  },
  {
    id: 'storm-chaser',
    name: 'Storm Chaser',
    description: 'Fly through severe turbulence and maintain altitude within tight limits for 3 minutes.',
    briefing: 'A massive storm cell has formed over the Midwest. Meteorological command needs readings from inside the cell at exactly 3000m altitude. Hold your altitude within plus or minus 100 meters for three full minutes. The turbulence will fight you every second.',
    aircraft: [],
    location: { lat: 39.0, lon: -95.0, alt: 3000, heading: 270 },
    weather: 'storm',
    timeOfDay: 14,
    objectives: [
      { type: 'altitude', targetAlt: 3000, tolerance: 100, duration: 180, current: 0, completed: false, description: 'Maintain altitude (3000m +/-100m) for 3 minutes' },
      { type: 'survive', completed: false, description: 'Survive the storm' },
    ],
    spawnEnemies: [],
    rewards: {},
    timeLimit: 300,
  },
];


// ─── Deep clone helper ───

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}


// ─── Bearing and distance helpers ───

function geoDistance(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dLat = (lat2 - lat1) * EARTH_RADIUS;
  const dLon = (lon2 - lon1) * EARTH_RADIUS * Math.cos(lat1 * Math.PI / 180);
  const dAlt = alt2 - alt1;
  return Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);
}

function geoBearing(lat1, lon1, lat2, lon2) {
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  return Math.atan2(dLon * Math.cos(lat1 * Math.PI / 180), dLat);
}


// ─── Mission System ───

export class MissionSystem {
  constructor() {
    this._missions = MISSIONS;
    this._active = null;       // deep-cloned mission currently running
    this._elapsed = 0;         // seconds since mission start
    this._briefingTimer = 0;   // countdown for briefing fade
    this._complete = false;
    this._failed = false;
    this._failReason = '';
    this._events = [];         // queued events for caller to consume
    this._nextWaypointIdx = 0; // index of next incomplete waypoint/hover objective
    this._spawnedDelays = {};  // track which delay-based spawns have fired
    this._spawnedWaves = {};   // track which wave-based spawns have fired
    this._currentWave = 0;     // for ace-combat style wave progression
    this._overlayTimer = 0;    // how long to show COMPLETE/FAILED overlay
    this._killCount = 0;       // total kills tracked during mission
    this._lastGameState = null;
  }

  // ─── Query API ───

  getMissions() {
    return this._missions.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      briefing: m.briefing,
      aircraft: m.aircraft,
      timeLimit: m.timeLimit,
    }));
  }

  getMission(id) {
    return this._missions.find(m => m.id === id) || null;
  }

  getCurrentMission() {
    return this._active;
  }

  getMissionTime() {
    return this._elapsed;
  }

  isComplete() {
    return this._complete;
  }

  isFailed() {
    return this._failed;
  }

  getObjectiveStatus() {
    if (!this._active) return [];
    return this._active.objectives.map(obj => {
      let progress = '';
      if (obj.type === 'destroy') {
        progress = `${obj.current}/${obj.count}`;
      } else if (obj.type === 'hover' || obj.type === 'altitude' || obj.type === 'time') {
        const dur = obj.duration || 0;
        progress = `${Math.min(obj.current, dur).toFixed(1)}/${dur}s`;
      }
      return {
        description: obj.description || obj.type,
        progress,
        completed: obj.completed,
      };
    });
  }

  // ─── Lifecycle ───

  startMission(id) {
    const template = this._missions.find(m => m.id === id);
    if (!template) return null;

    this._active = deepClone(template);
    this._elapsed = 0;
    this._briefingTimer = 8;
    this._complete = false;
    this._failed = false;
    this._failReason = '';
    this._events = [];
    this._nextWaypointIdx = 0;
    this._spawnedDelays = {};
    this._spawnedWaves = {};
    this._currentWave = 0;
    this._overlayTimer = 0;
    this._killCount = 0;
    this._lastGameState = null;

    // Build spawn info for the caller — immediate spawns (no delay, no wave or wave === 1)
    const immediateSpawns = this._active.spawnEnemies.filter(s => {
      const isImmediate = !s.delay || s.delay === 0;
      const isFirstWave = !s.wave || s.wave === 1;
      return isImmediate && isFirstWave;
    });

    // Mark first-wave spawns as done
    for (let i = 0; i < this._active.spawnEnemies.length; i++) {
      const s = this._active.spawnEnemies[i];
      if ((!s.delay || s.delay === 0) && (!s.wave || s.wave === 1)) {
        this._spawnedWaves[i] = true;
        this._spawnedDelays[i] = true;
      }
    }
    if (immediateSpawns.length > 0) {
      this._currentWave = 1;
    }

    return {
      mission: this._active,
      spawnInfo: immediateSpawns,
    };
  }

  abort() {
    this._active = null;
    this._complete = false;
    this._failed = false;
    this._elapsed = 0;
    this._events = [];
  }

  // ─── Core Update ───

  update(dt, gameState, aiUnits) {
    if (!this._active || this._complete || this._failed) return [];

    this._elapsed += dt;
    this._events = [];
    this._lastGameState = gameState;

    if (this._briefingTimer > 0) {
      this._briefingTimer -= dt;
    }
    if (this._overlayTimer > 0) {
      this._overlayTimer -= dt;
    }

    // ─── Time limit check ───
    if (this._active.timeLimit > 0 && this._elapsed >= this._active.timeLimit) {
      this._fail('Time expired');
      return this._events;
    }

    // ─── Player alive check ───
    if (gameState && !gameState.alive) {
      this._fail('Aircraft destroyed');
      return this._events;
    }

    // ─── Delayed enemy spawns ───
    const newSpawns = this._checkDelayedSpawns();
    if (newSpawns.length > 0) {
      this._events.push({ type: 'spawn_enemies', spawns: newSpawns });
    }

    // ─── Wave-based enemy spawns (ace-combat style) ───
    const waveSpawns = this._checkWaveSpawns(aiUnits);
    if (waveSpawns.length > 0) {
      this._events.push({ type: 'spawn_enemies', spawns: waveSpawns });
    }

    // ─── Check each objective ───
    for (const obj of this._active.objectives) {
      if (obj.completed) continue;

      switch (obj.type) {
        case 'destroy':
          this._checkDestroy(obj, aiUnits);
          break;
        case 'waypoint':
          this._checkWaypoint(obj, gameState);
          break;
        case 'hover':
          this._checkHover(obj, gameState, dt);
          break;
        case 'altitude':
          this._checkAltitude(obj, gameState, dt);
          break;
        case 'land':
          this._checkLand(obj, gameState);
          break;
        case 'time':
          this._checkTime(obj, dt);
          break;
        case 'survive':
          // Handled after all others
          break;
      }
    }

    // ─── Survive objective: completes when all non-survive objectives are done ───
    const nonSurvive = this._active.objectives.filter(o => o.type !== 'survive');
    const allNonSurviveDone = nonSurvive.length === 0 || nonSurvive.every(o => o.completed);
    for (const obj of this._active.objectives) {
      if (obj.type === 'survive' && !obj.completed && allNonSurviveDone) {
        obj.completed = true;
        this._events.push({ type: 'objective_complete', objective: obj });
      }
    }

    // ─── Mission complete check ───
    if (this._active.objectives.length > 0 && this._active.objectives.every(o => o.completed)) {
      this._complete = true;
      this._overlayTimer = 5;
      this._events.push({ type: 'mission_complete', mission: this._active });
    }

    return this._events;
  }

  // ─── Objective Checkers ───

  _checkDestroy(obj, aiUnits) {
    const prevCurrent = obj.current;

    if (obj.targetType === 'any') {
      const aliveCount = aiUnits.filter(a => a.alive).length;
      const totalSpawned = this._getTotalSpawnCount();
      obj.current = totalSpawned - aliveCount;
    } else {
      const aliveOfType = aiUnits.filter(a => a.alive && a.aircraftType === obj.targetType).length;
      const totalOfType = this._getSpawnCountByType(obj.targetType);
      obj.current = totalOfType - aliveOfType;
    }

    if (obj.current > prevCurrent) {
      this._killCount = obj.current;
    }

    if (obj.current >= obj.count) {
      obj.completed = true;
      this._events.push({ type: 'objective_complete', objective: obj });
    }
  }

  _checkWaypoint(obj, gameState) {
    if (!gameState) return;
    const radius = obj.radius || 500;
    const dist = geoDistance(
      gameState.latitude, gameState.longitude, gameState.altitudeMSL,
      obj.lat, obj.lon, obj.alt
    );
    if (dist < radius) {
      obj.completed = true;
      this._events.push({ type: 'objective_complete', objective: obj });
    }
  }

  _checkHover(obj, gameState, dt) {
    if (!gameState) return;
    const radius = obj.radius || 100;
    const dist = geoDistance(
      gameState.latitude, gameState.longitude, gameState.altitudeMSL,
      obj.lat, obj.lon, obj.alt
    );
    if (dist < radius) {
      obj.current = (obj.current || 0) + dt;
      if (obj.current >= obj.duration) {
        obj.completed = true;
        this._events.push({ type: 'objective_complete', objective: obj });
      }
    } else {
      // Reset progress if you leave the zone
      obj.current = 0;
    }
  }

  _checkAltitude(obj, gameState, dt) {
    if (!gameState) return;
    const diff = Math.abs(gameState.altitudeMSL - obj.targetAlt);
    if (diff <= obj.tolerance) {
      obj.current = (obj.current || 0) + dt;
      if (obj.current >= obj.duration) {
        obj.completed = true;
        this._events.push({ type: 'objective_complete', objective: obj });
      }
    } else {
      // Reset — must maintain continuously
      obj.current = 0;
    }
  }

  _checkLand(obj, gameState) {
    if (!gameState) return;
    if (gameState.onGround && gameState.speed < 5 && gameState.gearDown) {
      obj.completed = true;
      this._events.push({ type: 'objective_complete', objective: obj });
    }
  }

  _checkTime(obj, dt) {
    obj.current = (obj.current || 0) + dt;
    if (obj.current >= obj.duration) {
      obj.completed = true;
      this._events.push({ type: 'objective_complete', objective: obj });
    }
  }

  // ─── Spawn Management ───

  _checkDelayedSpawns() {
    const spawns = [];
    for (let i = 0; i < this._active.spawnEnemies.length; i++) {
      if (this._spawnedDelays[i]) continue;
      const s = this._active.spawnEnemies[i];
      if (s.delay && s.delay > 0 && !s.wave && this._elapsed >= s.delay) {
        this._spawnedDelays[i] = true;
        spawns.push(s);
      }
    }
    return spawns;
  }

  _checkWaveSpawns(aiUnits) {
    // Wave spawns: trigger next wave when all current-wave enemies are dead
    const hasWaveSpawns = this._active.spawnEnemies.some(s => s.wave);
    if (!hasWaveSpawns) return [];

    const aliveEnemies = aiUnits.filter(a => a.alive && a.team === 'opfor').length;
    if (aliveEnemies > 0) return [];

    const nextWave = this._currentWave + 1;
    const spawns = [];
    for (let i = 0; i < this._active.spawnEnemies.length; i++) {
      if (this._spawnedWaves[i]) continue;
      const s = this._active.spawnEnemies[i];
      if (s.wave === nextWave) {
        this._spawnedWaves[i] = true;
        spawns.push(s);
      }
    }
    if (spawns.length > 0) {
      this._currentWave = nextWave;
      this._events.push({ type: 'wave_start', wave: nextWave });
    }
    return spawns;
  }

  _getTotalSpawnCount() {
    let total = 0;
    for (let i = 0; i < this._active.spawnEnemies.length; i++) {
      if (this._spawnedDelays[i] || this._spawnedWaves[i]) {
        total += this._active.spawnEnemies[i].count;
      }
    }
    return total;
  }

  _getSpawnCountByType(type) {
    let total = 0;
    for (let i = 0; i < this._active.spawnEnemies.length; i++) {
      if ((this._spawnedDelays[i] || this._spawnedWaves[i]) && this._active.spawnEnemies[i].type === type) {
        total += this._active.spawnEnemies[i].count;
      }
    }
    return total;
  }

  _fail(reason) {
    this._failed = true;
    this._failReason = reason;
    this._overlayTimer = 5;
    this._events.push({ type: 'mission_failed', reason, mission: this._active });
  }

  // ─── HUD Rendering ───

  drawMissionHUD(ctx, w, h) {
    if (!this._active) return;

    const mobile = w < 768;
    const scale = mobile ? 0.7 : 1.0;

    // ─── Briefing overlay (fades out over 8 seconds) ───
    if (this._briefingTimer > 0) {
      this._drawBriefing(ctx, w, h, scale);
    }

    // ─── Objective list (top-left) ───
    this._drawObjectives(ctx, w, h, scale);

    // ─── Mission timer ───
    if (this._active.timeLimit > 0) {
      this._drawTimer(ctx, w, h, scale);
    }

    // ─── Waypoint indicator ───
    this._drawWaypointIndicator(ctx, w, h);

    // ─── Mission Complete / Failed overlay ───
    if ((this._complete || this._failed) && this._overlayTimer > 0) {
      this._drawEndOverlay(ctx, w, h, scale);
    }
  }

  _drawBriefing(ctx, w, h, scale) {
    const alpha = Math.min(1.0, this._briefingTimer / 2.0); // fade out over last 2 seconds
    const boxW = Math.min(600 * scale, w * 0.8);
    const boxH = 160 * scale;
    const x = (w - boxW) / 2;
    const y = h * 0.15;

    // Background
    ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * alpha})`;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.6 * alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxW, boxH);

    // Mission name
    ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
    ctx.font = `bold ${20 * scale}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(this._active.name.toUpperCase(), w / 2, y + 30 * scale);

    // Briefing text — word-wrap
    ctx.fillStyle = `rgba(200, 220, 240, ${alpha})`;
    ctx.font = `${13 * scale}px monospace`;
    const lines = this._wrapText(ctx, this._active.briefing, boxW - 40 * scale);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, y + 58 * scale + i * 18 * scale);
    }

    ctx.textAlign = 'left';
  }

  _drawObjectives(ctx, w, h, scale) {
    const x = 16 * scale;
    let y = 80 * scale;
    const lineH = 22 * scale;

    ctx.font = `bold ${13 * scale}px monospace`;
    ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('OBJECTIVES', x, y);
    y += lineH;

    ctx.font = `${12 * scale}px monospace`;
    for (const obj of this._active.objectives) {
      const check = obj.completed ? '\u2611' : '\u2610';
      let text = `${check} ${obj.description || obj.type}`;

      // Progress suffix
      if (!obj.completed) {
        if (obj.type === 'destroy') {
          text += ` (${obj.current}/${obj.count})`;
        } else if (obj.type === 'hover' || obj.type === 'altitude' || obj.type === 'time') {
          const dur = obj.duration || 0;
          text += ` (${Math.min(obj.current || 0, dur).toFixed(0)}/${dur}s)`;
        }
      }

      ctx.fillStyle = obj.completed ? 'rgba(0, 255, 100, 0.8)' : 'rgba(220, 230, 240, 0.85)';
      ctx.fillText(text, x, y);
      y += lineH;
    }
  }

  _drawTimer(ctx, w, h, scale) {
    const remaining = Math.max(0, this._active.timeLimit - this._elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const x = w / 2;
    const y = 30 * scale;

    ctx.font = `bold ${18 * scale}px monospace`;
    ctx.textAlign = 'center';

    // Flash red when under 30 seconds
    if (remaining < 30) {
      const flash = Math.sin(this._elapsed * 4) > 0;
      ctx.fillStyle = flash ? 'rgba(255, 50, 50, 0.95)' : 'rgba(255, 150, 50, 0.9)';
    } else {
      ctx.fillStyle = 'rgba(220, 230, 240, 0.85)';
    }

    ctx.fillText(timeStr, x, y);
    ctx.textAlign = 'left';
  }

  _drawWaypointIndicator(ctx, w, h) {
    // Find the first incomplete waypoint or hover objective
    const wpObj = this._active.objectives.find(o =>
      !o.completed && (o.type === 'waypoint' || o.type === 'hover') && o.lat !== undefined
    );
    if (!wpObj) return;

    // Need player state cached from update() to compute bearing
    if (!this._lastGameState) return;
    const gs = this._lastGameState;

    const bearing = geoBearing(gs.latitude, gs.longitude, wpObj.lat, wpObj.lon);
    const playerHeading = gs.heading || 0;
    const relAngle = bearing - playerHeading;

    // Draw arrow at screen edge pointing toward waypoint
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    const ax = cx + Math.sin(relAngle) * radius;
    const ay = cy - Math.cos(relAngle) * radius;

    // Distance label
    const dist = geoDistance(gs.latitude, gs.longitude, gs.altitudeMSL, wpObj.lat, wpObj.lon, wpObj.alt);
    const distKm = (dist / 1000).toFixed(1);

    // Arrow triangle
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(relAngle);

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-8, 8);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 200, 0.85)';
    ctx.fill();

    ctx.restore();

    // Distance text near arrow
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(0, 255, 200, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(`${distKm} km`, ax, ay + 22);
    ctx.textAlign = 'left';
  }

  _drawEndOverlay(ctx, w, h, scale) {
    const alpha = Math.min(1.0, this._overlayTimer / 1.0); // fade in quickly

    // Full-screen dim
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';

    if (this._complete) {
      ctx.font = `bold ${40 * scale}px monospace`;
      ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
      ctx.fillText('MISSION COMPLETE', w / 2, h / 2 - 20 * scale);

      ctx.font = `${16 * scale}px monospace`;
      ctx.fillStyle = `rgba(180, 255, 200, ${alpha * 0.8})`;
      const timeStr = this._formatTime(this._elapsed);
      ctx.fillText(`Time: ${timeStr}`, w / 2, h / 2 + 20 * scale);

      if (this._active.rewards && this._active.rewards.unlocks) {
        ctx.font = `${13 * scale}px monospace`;
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha * 0.7})`;
        ctx.fillText(`Unlocked: ${this._active.rewards.unlocks}`, w / 2, h / 2 + 48 * scale);
      }
    } else {
      ctx.font = `bold ${40 * scale}px monospace`;
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      ctx.fillText('MISSION FAILED', w / 2, h / 2 - 20 * scale);

      ctx.font = `${16 * scale}px monospace`;
      ctx.fillStyle = `rgba(255, 150, 150, ${alpha * 0.8})`;
      ctx.fillText(this._failReason, w / 2, h / 2 + 20 * scale);
    }

    ctx.textAlign = 'left';
  }

  // ─── Helpers ───

  _wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
