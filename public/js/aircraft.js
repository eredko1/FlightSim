// ─── Aircraft Type Definitions: F-15C Eagle & MiG-29A Fulcrum ───

export const AIRCRAFT = {
  F15: {
    id: 'F15',
    name: 'F-15C Eagle',
    faction: 'nato',
    mass: 12700,
    wingArea: 56.5,
    maxThrust: 211400,    // with afterburner
    dryThrust: 129600,    // military power
    maxSpeed: 717,        // m/s (Mach 2.5)
    stallSpeed: 62,
    maxG: 9.0,
    negG: -3.0,
    rollRateMax: 4.2,     // rad/s
    pitchRateMax: 1.4,
    yawRateMax: 0.8,
    clBase: 0.2,
    clPerAoa: 5.0,
    clMax: 1.6,
    cdMin: 0.022,
    cdInducedK: 0.045,
    stallAngle: 0.30,
    // Weapons loadout
    gun: 'M61',
    gunAmmo: 940,
    irMissile: 'AIM9M',
    irCount: 4,
    radarMissile: 'AIM120C',
    radarCount: 4,
    flares: 30,
    chaff: 30,
    // Visual
    color: [0.2, 0.3, 0.8],  // blue-ish
    length: 19.4,
    wingspan: 13.0,
  },

  MIG29: {
    id: 'MIG29',
    name: 'MiG-29A Fulcrum',
    faction: 'opfor',
    mass: 11000,
    wingArea: 38.0,
    maxThrust: 178400,
    dryThrust: 108000,
    maxSpeed: 694,        // Mach 2.3
    stallSpeed: 57,
    maxG: 9.0,
    negG: -3.0,
    rollRateMax: 4.7,     // more agile in close
    pitchRateMax: 1.5,
    yawRateMax: 0.85,
    clBase: 0.22,
    clPerAoa: 5.2,
    clMax: 1.7,           // better high-AOA
    cdMin: 0.024,
    cdInducedK: 0.042,
    stallAngle: 0.33,     // higher AOA tolerance
    // Weapons
    gun: 'GSH301',
    gunAmmo: 150,
    irMissile: 'R73',
    irCount: 4,
    radarMissile: 'R77',
    radarCount: 2,
    flares: 30,
    chaff: 30,
    // Visual
    color: [0.8, 0.2, 0.2],  // red-ish
    length: 17.3,
    wingspan: 11.4,
  },
};

export const WEAPONS = {
  M61: {
    id: 'M61', type: 'gun', name: 'M61A1 Vulcan',
    rateOfFire: 100, muzzleVelocity: 1050,
    damage: 5, range: 2000, spread: 0.008, tracerInterval: 5,
  },
  GSH301: {
    id: 'GSH301', type: 'gun', name: 'GSh-30-1',
    rateOfFire: 25, muzzleVelocity: 860,
    damage: 12, range: 1800, spread: 0.010, tracerInterval: 3,
  },
  AIM9M: {
    id: 'AIM9M', type: 'ir', name: 'AIM-9M Sidewinder',
    speed: 850, maxRange: 18000, minRange: 300,
    turnRate: 0.5, lockCone: 0.35, lockTime: 2.0,
    damage: 85, flareVuln: 0.4, burnTime: 8,
  },
  R73: {
    id: 'R73', type: 'ir', name: 'R-73 Archer',
    speed: 900, maxRange: 20000, minRange: 300,
    turnRate: 0.6, lockCone: 0.5, lockTime: 1.5,
    damage: 80, flareVuln: 0.35, burnTime: 7,
  },
  AIM120C: {
    id: 'AIM120C', type: 'radar', name: 'AIM-120C AMRAAM',
    speed: 1200, maxRange: 75000, minRange: 1000,
    turnRate: 0.35, lockTime: 0.5,
    damage: 95, chaffVuln: 0.3, burnTime: 10, activeRange: 16000,
  },
  R77: {
    id: 'R77', type: 'radar', name: 'R-77 Vympel',
    speed: 1150, maxRange: 60000, minRange: 800,
    turnRate: 0.40, lockTime: 0.6,
    damage: 90, chaffVuln: 0.35, burnTime: 9, activeRange: 14000,
  },
};

// Create a fresh weapon state for an aircraft type
export function createWeaponState(aircraftType) {
  const ac = AIRCRAFT[aircraftType];
  return {
    selectedIndex: 0,  // 0=gun, 1=ir, 2=radar
    gunAmmo: ac.gunAmmo,
    irCount: ac.irCount,
    radarCount: ac.radarCount,
    flares: ac.flares,
    chaff: ac.chaff,
    gunCooldown: 0,
    missileCooldown: 0,
    cmsTimer: 0,
    // Lock state
    irLockTarget: null,
    irLockProgress: 0,    // 0 to 1
    radarLockTarget: null,
    radarLockProgress: 0,
  };
}

export function getSelectedWeapon(aircraftType, weaponState) {
  const ac = AIRCRAFT[aircraftType];
  const weapons = [
    WEAPONS[ac.gun],
    WEAPONS[ac.irMissile],
    WEAPONS[ac.radarMissile],
  ];
  return weapons[weaponState.selectedIndex];
}

export function getWeaponCount(weaponState) {
  const idx = weaponState.selectedIndex;
  if (idx === 0) return weaponState.gunAmmo;
  if (idx === 1) return weaponState.irCount;
  return weaponState.radarCount;
}
