// ─── Weather & Dynamic Day/Night System ───

const WEATHER_TYPES = {
  clear:    { fogDensity: 0.0001, visibility: 50000, skyBrightness: 0,    skySaturation: 0,    turbulence: 0,   particles: null },
  overcast: { fogDensity: 0.0008, visibility: 15000, skyBrightness: -0.1, skySaturation: -0.2, turbulence: 0.1, particles: null },
  rain:     { fogDensity: 0.0015, visibility: 8000,  skyBrightness: -0.2, skySaturation: -0.3, turbulence: 0.3, particles: 'rain' },
  storm:    { fogDensity: 0.004,  visibility: 3000,  skyBrightness: -0.35,skySaturation: -0.4, turbulence: 0.7, particles: 'rain' },
  snow:     { fogDensity: 0.003,  visibility: 2000,  skyBrightness: 0.05, skySaturation: -0.5, turbulence: 0.2, particles: 'snow' },
  fog:      { fogDensity: 0.015,  visibility: 500,   skyBrightness: -0.05,skySaturation: -0.3, turbulence: 0,   particles: null },
};

const WEATHER_NAMES = Object.keys(WEATHER_TYPES);

export class WeatherSystem {
  constructor() {
    this.viewer = null;
    this.currentWeather = 'clear';
    this.targetWeather = 'clear';
    this.transitionProgress = 1; // 1 = fully transitioned
    this.transitionSpeed = 0.15; // per second

    // Current interpolated values
    this._fogDensity = 0.0001;
    this._skyBrightness = 0;
    this._skySaturation = 0;
    this._turbulenceLevel = 0;

    // Particles
    this._particles = [];
    this._maxParticles = 300;

    // Lightning
    this._lightningTimer = 0;
    this._lightningFlash = 0;
    this._lightningCooldown = 0;
    this._minLightningInterval = 5;

    // Time
    this._timeMultiplier = 0; // 0 = paused (use manual cycling)

    // Turbulence noise
    this._turbTime = 0;
  }

  init(viewer) {
    this.viewer = viewer;
  }

  setWeather(type) {
    if (!WEATHER_TYPES[type]) return;
    if (type === this.currentWeather && this.transitionProgress >= 1) return;
    this.targetWeather = type;
    this.transitionProgress = 0;
  }

  cycleWeather() {
    const idx = WEATHER_NAMES.indexOf(this.currentWeather);
    const next = WEATHER_NAMES[(idx + 1) % WEATHER_NAMES.length];
    this.setWeather(next);
    return next;
  }

  getWeather() { return this.currentWeather; }

  getVisibility() {
    return WEATHER_TYPES[this.currentWeather]?.visibility || 50000;
  }

  setTimeMultiplier(mult) {
    this._timeMultiplier = mult;
    if (this.viewer) {
      this.viewer.clock.shouldAnimate = mult > 0;
      this.viewer.clock.multiplier = mult;
    }
  }

  getTurbulence() {
    const level = this._turbulenceLevel;
    if (level < 0.05) return { pitch: 0, roll: 0, yaw: 0 };

    const t = this._turbTime;
    return {
      pitch: (Math.sin(t * 2.3) * 0.5 + Math.sin(t * 5.7) * 0.3 + Math.sin(t * 11.1) * 0.2) * level * 0.15,
      roll:  (Math.sin(t * 1.7) * 0.5 + Math.sin(t * 4.3) * 0.3 + Math.sin(t * 9.7) * 0.2) * level * 0.2,
      yaw:   (Math.sin(t * 3.1) * 0.5 + Math.sin(t * 7.9) * 0.3) * level * 0.08,
    };
  }

  update(dt) {
    this._turbTime += dt;

    // Transition
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + this.transitionSpeed * dt);
      if (this.transitionProgress >= 1) {
        this.currentWeather = this.targetWeather;
      }
    }

    // Interpolate parameters
    const from = WEATHER_TYPES[this.currentWeather];
    const to = WEATHER_TYPES[this.targetWeather];
    const t = this.transitionProgress;

    this._fogDensity = from.fogDensity + (to.fogDensity - from.fogDensity) * t;
    this._skyBrightness = from.skyBrightness + (to.skyBrightness - from.skyBrightness) * t;
    this._skySaturation = from.skySaturation + (to.skySaturation - from.skySaturation) * t;
    this._turbulenceLevel = from.turbulence + (to.turbulence - from.turbulence) * t;

    // Apply to Cesium
    if (this.viewer) {
      const scene = this.viewer.scene;
      scene.fog.density = this._fogDensity;
      scene.skyAtmosphere.brightnessShift = this._skyBrightness;
      scene.skyAtmosphere.saturationShift = this._skySaturation;
    }

    // Lightning (storms only)
    if (this.currentWeather === 'storm' || this.targetWeather === 'storm') {
      this._lightningCooldown -= dt;
      if (this._lightningCooldown <= 0 && Math.random() < 0.03 * dt) {
        this._lightningFlash = 0.8;
        this._lightningCooldown = this._minLightningInterval + Math.random() * 10;
      }
    }
    if (this._lightningFlash > 0) {
      this._lightningFlash -= dt * 4;
      if (this._lightningFlash < 0) this._lightningFlash = 0;
    }

    // Update particles
    this._updateParticles(dt);
  }

  _updateParticles(dt) {
    const current = WEATHER_TYPES[this.transitionProgress >= 1 ? this.currentWeather : this.targetWeather];
    const particleType = current.particles;

    if (!particleType) {
      this._particles = [];
      return;
    }

    // Spawn new particles
    const spawnRate = particleType === 'rain'
      ? (this.currentWeather === 'storm' ? 50 : 25)
      : 15; // snow

    for (let i = 0; i < spawnRate * dt * 10 && this._particles.length < this._maxParticles; i++) {
      this._particles.push({
        x: Math.random(),
        y: -Math.random() * 0.1,
        speed: particleType === 'rain' ? (0.8 + Math.random() * 0.4) : (0.1 + Math.random() * 0.15),
        drift: particleType === 'snow' ? (Math.random() - 0.5) * 0.1 : (Math.random() - 0.5) * 0.02,
        size: particleType === 'rain' ? (1 + Math.random()) : (2 + Math.random() * 2),
        type: particleType,
      });
    }

    // Update
    for (const p of this._particles) {
      p.y += p.speed * dt;
      p.x += p.drift * dt;
    }

    // Remove off-screen
    this._particles = this._particles.filter(p => p.y < 1.1 && p.x > -0.1 && p.x < 1.1);
  }

  drawParticles(ctx, w, h, aircraftSpeed, aircraftHeading) {
    if (this._particles.length === 0 && this._lightningFlash <= 0) return;

    // Lightning flash
    if (this._lightningFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this._lightningFlash * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Speed-based streak angle
    const speedFactor = Math.min(1, (aircraftSpeed || 0) / 300);

    for (const p of this._particles) {
      const px = p.x * w;
      const py = p.y * h;

      if (p.type === 'rain') {
        const streakLen = 8 + speedFactor * 20;
        ctx.strokeStyle = `rgba(180,200,255,${0.3 + Math.random() * 0.2})`;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.drift * 50, py - streakLen);
        ctx.stroke();
      } else {
        // Snow
        ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fog overlay for fog/storm
    if (this._fogDensity > 0.005) {
      const fogAlpha = Math.min(0.4, (this._fogDensity - 0.005) * 20);
      ctx.fillStyle = `rgba(180,180,190,${fogAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Dark overlay for storms/overcast
    if (this._skyBrightness < -0.1) {
      const darkAlpha = Math.min(0.25, Math.abs(this._skyBrightness) * 0.5);
      ctx.fillStyle = `rgba(0,0,0,${darkAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  dispose() {
    this._particles = [];
    this.viewer = null;
  }
}
