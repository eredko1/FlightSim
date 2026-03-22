// ─── Game Manager: Ties physics, weapons, AI, HUD together ───
import { AIRCRAFT, createWeaponState, getSelectedWeapon } from './aircraft.js';
import { createFlightState, updatePhysics, respawn, applyDamage } from './physics.js';
import { WeaponManager, distanceBetween } from './weapons.js';
import { AIFighter, spawnAIWave } from './ai.js';
import { CombatHUD } from './hud-combat.js';

export class Game {
  constructor() {
    this.state = null;          // player flight state
    this.weaponState = null;
    this.weaponManager = new WeaponManager();
    this.combatHUD = new CombatHUD();
    this.aiUnits = [];
    this.allEntities = [];      // player + AI + remote players
    this.gameMode = 'coop';     // 'coop', 'tdm', 'ffa'
    this.scores = { nato: 0, opfor: 0, wave: 1, kills: 0, deaths: 0, lives: 10 };
    this.playerTeam = 'nato';
    this.respawnTimer = 0;
    this.waveTimer = 0;
    this.waveActive = false;
    this.paused = false;
    this.firing = false;

    // Multiplayer (stubbed for now)
    this.remotePlayers = [];
    this.isMultiplayer = false;
  }

  init(aircraftType, lat, lon, alt, heading) {
    const latRad = typeof lat === 'number' && Math.abs(lat) > Math.PI ? lat : lat;
    this.state = createFlightState(aircraftType, lat, lon, alt, heading);
    this.state.id = 'player';
    this.state.team = this.playerTeam;
    this.state.name = 'YOU';
    this.weaponState = createWeaponState(aircraftType);
    this.weaponManager.clear();
    this.aiUnits = [];
    this.scores = { nato: 0, opfor: 0, wave: 0, kills: 0, deaths: 0, lives: 10 };
    this.respawnTimer = 0;
    this.waveTimer = 3; // 3 second delay before first wave
    this.waveActive = false;
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  startWave() {
    this.scores.wave++;
    const enemyTeam = this.playerTeam === 'nato' ? 'opfor' : 'nato';
    const newAIs = spawnAIWave(
      this.scores.wave,
      this.state.latitude,
      this.state.longitude,
      this.state.altitudeMSL + 500,
      enemyTeam
    );
    this.aiUnits.push(...newAIs);
    this.waveActive = true;
    return newAIs.length;
  }

  update(dt, input, getTerrainHeight) {
    if (this.paused) return;

    // ─── Player physics ───
    if (this.state.alive) {
      updatePhysics(this.state, input, dt, (lon, lat) => {
        const h = getTerrainHeight(lon, lat);
        return h !== undefined ? h : 0;
      });
    } else {
      // Respawn timer
      this.respawnTimer += dt;
      if (this.respawnTimer > 5 && (this.gameMode !== 'coop' || this.scores.lives > 0)) {
        this.respawnPlayer();
      }
    }

    // ─── Build entity list ───
    this.allEntities = [this.state, ...this.aiUnits, ...this.remotePlayers];

    // ─── AI updates ───
    for (const ai of this.aiUnits) {
      ai.update(dt, this.state, this.allEntities, (lon, lat) => {
        const h = getTerrainHeight(lon, lat);
        return h !== undefined ? h : 0;
      }, this.weaponManager);
    }

    // Remove dead AI
    const deadAI = this.aiUnits.filter(a => !a.alive);
    for (const dead of deadAI) {
      this.scores.kills++;
      if (dead.team === 'opfor') this.scores.nato++;
      else this.scores.opfor++;

      this.combatHUD.addKill('YOU', dead.name, 'KILL', '#00ff88');
      this.weaponManager.explosions.push({
        lat: dead.latitude, lon: dead.longitude, alt: dead.altitudeMSL,
        age: 0, maxAge: 2.5,
      });
    }
    this.aiUnits = this.aiUnits.filter(a => a.alive);

    // ─── Weapons ───
    // Player firing
    if (this.firing && this.state.alive) {
      const wpn = getSelectedWeapon(this.state.aircraftType, this.weaponState);
      if (wpn.type === 'gun') {
        this.weaponManager.fireGun(this.state, this.weaponState, dt);
      }
    } else {
      this.weaponManager.stopGun();
    }

    // Lock updates
    this.weaponManager.updateLocks(this.state, this.weaponState, this.allEntities, dt);

    // Weapon/projectile updates + hit detection
    const hits = this.weaponManager.update(dt, this.allEntities);

    // Process hits
    for (const hit of hits) {
      const target = hit.target;
      const damage = hit.damage;
      applyDamage(target, damage);

      if (target.id === 'player') {
        // Player got hit
        if (!this.state.alive) {
          this.scores.deaths++;
          if (this.gameMode === 'coop') this.scores.lives--;
          this.combatHUD.addKill('ENEMY', 'YOU', 'HIT', '#ff4444');
        }
      }
    }

    // ─── Wave management (all combat modes) ───
    if (this.gameMode === 'coop' || this.gameMode === 'tdm' || this.gameMode === 'ffa') {
      if (this.aiUnits.length === 0 && this.waveActive) {
        this.waveActive = false;
        this.waveTimer = 5; // 5 seconds between waves
      }
      if (!this.waveActive && this.waveTimer > 0) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
          const count = this.startWave();
          this.combatHUD.addKill('WAVE', `${this.scores.wave} (${count} bandits)`, 'INCOMING', '#ffaa00');
        }
      }
    }

    // ─── Combat HUD update ───
    this.combatHUD.update(dt);
  }

  respawnPlayer() {
    const offsetLat = (Math.random() - 0.5) * 0.05;
    const offsetLon = (Math.random() - 0.5) * 0.05;
    respawn(
      this.state,
      this.state.latitude + offsetLat,
      this.state.longitude + offsetLon,
      this.state.terrainHeight + 800,
      this.state.heading
    );
    this.weaponState = createWeaponState(this.state.aircraftType);
    this.respawnTimer = 0;
  }

  fireWeapon() {
    if (!this.state.alive) return;

    const wpn = getSelectedWeapon(this.state.aircraftType, this.weaponState);
    if (wpn.type === 'ir') {
      const target = this.weaponState.irLockTarget;
      this.weaponManager.fireIRMissile(this.state, this.weaponState, target);
    } else if (wpn.type === 'radar') {
      const target = this.weaponState.radarLockTarget;
      this.weaponManager.fireRadarMissile(this.state, this.weaponState, target);
    }
    // Gun is handled in update() via this.firing flag
  }

  cycleWeapon() {
    this.weaponState.selectedIndex = (this.weaponState.selectedIndex + 1) % 3;
  }

  deployFlares() {
    this.weaponManager.deployFlares(this.weaponState);
    this.state._flaresActive = true;
    setTimeout(() => { this.state._flaresActive = false; }, 2000);
  }

  deployChaff() {
    this.weaponManager.deployChaff(this.weaponState);
    this.state._chaffActive = true;
    setTimeout(() => { this.state._chaffActive = false; }, 2000);
  }

  drawCombatHUD(ctx, w, h) {
    this.combatHUD.draw(
      ctx, w, h, this.state, this.weaponState,
      this.allEntities, this.weaponManager.missiles,
      this.scores, this.gameMode
    );
  }

  getVisibleMissiles() {
    return this.weaponManager.missiles.filter(m => m.alive);
  }

  getExplosions() {
    return this.weaponManager.explosions;
  }

  getTracers() {
    return this.weaponManager.bullets.filter(b => b.isTracer && b.alive);
  }
}
