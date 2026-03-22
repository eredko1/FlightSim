// ─── Procedural Audio Engine (Web Audio API) ───
// All sounds synthesized — no external files needed.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this._engine = null;
    this._wind = null;
    this._missileWarning = null;
    this._stallWarning = null;
    this._gEffectFilter = null;
    this._missileWarningActive = false;
    this._stallActive = false;
    this._gunBurstTimer = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { return; }

    // Master → G-effect lowpass → destination
    this._gEffectFilter = this.ctx.createBiquadFilter();
    this._gEffectFilter.type = 'lowpass';
    this._gEffectFilter.frequency.value = 20000;
    this._gEffectFilter.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this._gEffectFilter);

    this._initEngine();
    this._initWind();
    this.initialized = true;
  }

  _initEngine() {
    const ctx = this.ctx;
    // Low sawtooth for turbine core
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 80;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 120;

    // Filter to shape jet sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;

    // Noise for exhaust
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 300;
    noiseFilter.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.06;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.3;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(engineGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(engineGain);
    engineGain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    noise.start();

    this._engine = { osc1, osc2, filter, noiseFilter, noiseGain, oscGain, engineGain };
  }

  _initWind() {
    const ctx = this.ctx;
    const noiseLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this._wind = { filter, gain };
  }

  update(state, dt) {
    if (!this.initialized || !this.ctx || !state) return;

    const t = this.ctx.currentTime;

    // Engine: pitch/volume scale with throttle
    if (this._engine) {
      const throttle = state.throttle || 0;
      const ab = state.afterburner && throttle > 0.95;
      const basePitch = 60 + throttle * 140 + (ab ? 80 : 0);
      this._engine.osc1.frequency.setTargetAtTime(basePitch, t, 0.1);
      this._engine.osc2.frequency.setTargetAtTime(basePitch * 1.5, t, 0.1);
      this._engine.filter.frequency.setTargetAtTime(200 + throttle * 800 + (ab ? 400 : 0), t, 0.1);
      this._engine.engineGain.gain.setTargetAtTime(0.15 + throttle * 0.35 + (ab ? 0.2 : 0), t, 0.1);
      this._engine.noiseGain.gain.setTargetAtTime(0.04 + throttle * 0.12 + (ab ? 0.08 : 0), t, 0.05);
    }

    // Wind: scales with airspeed
    if (this._wind) {
      const speedNorm = Math.min(1, (state.speed || 0) / 500);
      this._wind.gain.gain.setTargetAtTime(speedNorm * 0.25, t, 0.2);
      this._wind.filter.frequency.setTargetAtTime(400 + speedNorm * 3000, t, 0.2);
    }

    // G-effect muffling
    if (this._gEffectFilter) {
      const vision = state.gEffectVision !== undefined ? state.gEffectVision : 1;
      const freq = 2000 + vision * 18000;
      this._gEffectFilter.frequency.setTargetAtTime(freq, t, 0.1);
    }

    // Stall warning
    if (state.stalling && !state.onGround && !this._stallActive) {
      this._startStallWarning();
    } else if ((!state.stalling || state.onGround) && this._stallActive) {
      this._stopStallWarning();
    }
  }

  playGunBurst() {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Short noise burst
    const len = 0.05;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + len);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + len);

    // Low thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.2, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playMissileLaunch() {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Rising whoosh
    const len = 1.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.8);
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.05, now + len);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + len);
  }

  playExplosion(distance) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = Math.max(0.05, 0.6 - (distance || 0) / 10000);

    // Low rumble
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.5);

    // Noise burst
    const nLen = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * nLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
    }
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(vol * 0.5, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + nLen);
    nSrc.connect(nGain);
    nGain.connect(this.masterGain);
    nSrc.start(now);
    nSrc.stop(now + nLen);
  }

  setMissileWarning(active) {
    if (!this.initialized) return;
    if (active && !this._missileWarningActive) {
      this._startMissileWarning();
    } else if (!active && this._missileWarningActive) {
      this._stopMissileWarning();
    }
  }

  _startMissileWarning() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1500;

    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 4; // 4 beeps per second

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    lfo.start();
    this._missileWarning = { osc, lfo, gain };
    this._missileWarningActive = true;
  }

  _stopMissileWarning() {
    if (this._missileWarning) {
      try {
        this._missileWarning.osc.stop();
        this._missileWarning.lfo.stop();
      } catch {}
      this._missileWarning = null;
    }
    this._missileWarningActive = false;
  }

  _startStallWarning() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 300;

    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 8;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    lfo.start();
    this._stallWarning = { osc, lfo, gain };
    this._stallActive = true;
  }

  _stopStallWarning() {
    if (this._stallWarning) {
      try {
        this._stallWarning.osc.stop();
        this._stallWarning.lfo.stop();
      } catch {}
      this._stallWarning = null;
    }
    this._stallActive = false;
  }

  playGearToggle() {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Mechanical clunk
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);

    // Click
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const cGain = ctx.createGain();
    cGain.gain.value = 0.15;
    src.connect(cGain);
    cGain.connect(this.masterGain);
    src.start(now + 0.05);
  }

  setMasterVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
    }
  }

  dispose() {
    this._stopMissileWarning();
    this._stopStallWarning();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}
