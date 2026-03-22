// ─── Scoring & Leaderboard System ───

const KILL_SCORES = { rookie: 100, veteran: 150, ace: 250 };
const STREAK_NAMES = [
  '', '', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'KILLING SPREE',
  'RAMPAGE', 'UNSTOPPABLE', 'GODLIKE', 'LEGENDARY'
];
const GRADES = [
  { min: 10000, grade: 'S', color: '#ffdd00' },
  { min: 5000,  grade: 'A', color: '#00ff88' },
  { min: 2500,  grade: 'B', color: '#44aaff' },
  { min: 1000,  grade: 'C', color: '#aaaaaa' },
  { min: 500,   grade: 'D', color: '#ff8844' },
  { min: 0,     grade: 'F', color: '#ff4444' },
];

const LS_KEY = 'flightsim_leaderboard_';

export class Leaderboard {
  constructor() {
    this.score = 0;
    this.kills = 0;
    this.killsByTier = { rookie: 0, veteran: 0, ace: 0 };
    this.streak = 0;
    this.bestStreak = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;
    this.wavesCleared = 0;
    this.timeAlive = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.gameMode = 'coop';
    this.missionId = null;
    this.aircraft = 'F15';
    this._popups = []; // floating score popups
    this._streakMessage = '';
    this._streakTimer = 0;
    this._gameOver = false;
    this._summaryData = null;
  }

  reset(gameMode, missionId) {
    this.score = 0;
    this.kills = 0;
    this.killsByTier = { rookie: 0, veteran: 0, ace: 0 };
    this.streak = 0;
    this.bestStreak = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;
    this.wavesCleared = 0;
    this.timeAlive = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.gameMode = gameMode || 'coop';
    this.missionId = missionId || null;
    this._popups = [];
    this._streakMessage = '';
    this._streakTimer = 0;
    this._gameOver = false;
    this._summaryData = null;
  }

  addKill(tierName, weaponType) {
    const baseScore = KILL_SCORES[tierName] || 100;
    const points = Math.round(baseScore * this.comboMultiplier);

    this.kills++;
    this.killsByTier[tierName] = (this.killsByTier[tierName] || 0) + 1;
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    this.score += points;

    // Combo
    this.comboTimer = 5;
    if (this.comboMultiplier < 3) {
      this.comboMultiplier = Math.min(3, 1 + (this.streak - 1) * 0.5);
    }

    // Streak message
    if (this.streak >= 3 && this.streak < STREAK_NAMES.length) {
      this._streakMessage = STREAK_NAMES[this.streak];
      this._streakTimer = 2;
    } else if (this.streak >= STREAK_NAMES.length) {
      this._streakMessage = `${this.streak}x KILL STREAK`;
      this._streakTimer = 2;
    }

    // Popup
    this._popups.push({ text: `+${points}`, y: 0, alpha: 1, timer: 1.5 });
  }

  addMissileDodge() {
    const points = Math.round(50 * this.comboMultiplier);
    this.score += points;
    this._popups.push({ text: `+${points} DODGE`, y: 0, alpha: 1, timer: 1.5 });
  }

  addWaveClear(waveNum) {
    this.wavesCleared++;
    const points = 200 + (waveNum - 1) * 50;
    this.score += points;
    this._popups.push({ text: `+${points} WAVE CLEAR`, y: 0, alpha: 1, timer: 2 });
  }

  onPlayerDeath() {
    this.streak = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
  }

  update(dt, playerAlive, playerHealth) {
    if (this._gameOver) return;

    // Time alive
    if (playerAlive) this.timeAlive += dt;

    // Survival bonus
    if (playerAlive && Math.floor(this.timeAlive) % 30 === 0 && Math.floor(this.timeAlive) > 0 &&
        Math.floor(this.timeAlive - dt) % 30 !== 0) {
      this.score += 10;
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
      }
    }

    // Streak message decay
    if (this._streakTimer > 0) this._streakTimer -= dt;

    // Popups
    for (const p of this._popups) {
      p.y -= 40 * dt;
      p.timer -= dt;
      p.alpha = Math.max(0, p.timer / 1.5);
    }
    this._popups = this._popups.filter(p => p.timer > 0);

    // Reset streak on death
    if (!playerAlive && this.streak > 0) {
      this.onPlayerDeath();
    }
  }

  getScore() { return this.score; }
  getComboMultiplier() { return this.comboMultiplier; }
  getKillStreak() { return this.streak; }

  endGame(aircraft) {
    if (this._gameOver) return;
    this._gameOver = true;
    this.aircraft = aircraft || 'F15';

    // Accuracy bonus
    const accuracy = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0;
    const accuracyBonus = Math.round(accuracy * 500);
    this.score += accuracyBonus;

    const grade = this._calcGrade();
    this._summaryData = {
      score: this.score,
      kills: this.kills,
      killsByTier: { ...this.killsByTier },
      bestStreak: this.bestStreak,
      wavesCleared: this.wavesCleared,
      timeAlive: this.timeAlive,
      accuracy: Math.round(accuracy * 100),
      accuracyBonus,
      grade,
      aircraft: this.aircraft,
    };

    // Save to localStorage
    this._saveScore(this._summaryData);
    return this._summaryData;
  }

  getGameSummary() { return this._summaryData; }

  _calcGrade() {
    for (const g of GRADES) {
      if (this.score >= g.min) return g;
    }
    return GRADES[GRADES.length - 1];
  }

  _saveScore(summary) {
    const key = LS_KEY + (this.missionId || this.gameMode);
    let board = [];
    try { board = JSON.parse(localStorage.getItem(key)) || []; } catch {}

    board.push({
      name: 'MAVERICK',
      score: summary.score,
      kills: summary.kills,
      grade: summary.grade.grade,
      aircraft: summary.aircraft,
      waves: summary.wavesCleared,
      date: new Date().toISOString().slice(0, 10),
    });

    board.sort((a, b) => b.score - a.score);
    board = board.slice(0, 20);
    try { localStorage.setItem(key, JSON.stringify(board)); } catch {}
  }

  getLeaderboard(gameMode) {
    const key = LS_KEY + (gameMode || this.gameMode);
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  }

  clearLeaderboard(gameMode) {
    const key = LS_KEY + (gameMode || this.gameMode);
    try { localStorage.removeItem(key); } catch {}
  }

  drawScoreHUD(ctx, w, h, scale) {
    scale = scale || 1;

    // Score counter (top-right area, below existing HUD)
    ctx.font = `bold ${16 * scale}px "Courier New"`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`SCORE: ${this.score}`, w - 15, 45 * scale);

    // Combo multiplier
    if (this.comboMultiplier > 1) {
      ctx.font = `bold ${14 * scale}px "Courier New"`;
      ctx.fillStyle = this.comboMultiplier >= 2.5 ? '#ffdd00' : '#ffaa00';
      ctx.fillText(`x${this.comboMultiplier.toFixed(1)} COMBO`, w - 15, 62 * scale);

      // Combo timer bar
      const barW = 60 * scale;
      const barX = w - 15 - barW;
      const barY = 66 * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(barX, barY, barW * (this.comboTimer / 5), 3);
    }

    // Kill streak message
    if (this._streakTimer > 0 && this._streakMessage) {
      const alpha = Math.min(1, this._streakTimer);
      ctx.font = `bold ${24 * scale}px "Courier New"`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,221,0,${alpha})`;
      ctx.fillText(this._streakMessage, w / 2, h / 2 - 120 * scale);
    }

    // Score popups
    ctx.font = `bold ${14 * scale}px "Courier New"`;
    ctx.textAlign = 'center';
    for (const p of this._popups) {
      ctx.fillStyle = `rgba(0,255,136,${p.alpha})`;
      ctx.fillText(p.text, w / 2, h / 2 + 100 * scale + p.y);
    }
  }

  drawLeaderboard(ctx, w, h) {
    const board = this.getLeaderboard();
    if (board.length === 0) return;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

    ctx.font = 'bold 24px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('LEADERBOARD', w / 2, h * 0.1 + 40);

    // Header
    const startY = h * 0.1 + 70;
    const lh = 24;
    ctx.font = '12px "Courier New"';
    ctx.fillStyle = '#667';
    ctx.textAlign = 'left';
    const cols = [w * 0.15, w * 0.22, w * 0.42, w * 0.55, w * 0.65, w * 0.75, w * 0.85];
    ctx.fillText('#', cols[0], startY);
    ctx.fillText('NAME', cols[1], startY);
    ctx.fillText('SCORE', cols[2], startY);
    ctx.fillText('KILLS', cols[3], startY);
    ctx.fillText('GRADE', cols[4], startY);
    ctx.fillText('JET', cols[5], startY);
    ctx.fillText('DATE', cols[6], startY);

    // Entries
    ctx.font = '13px "Courier New"';
    for (let i = 0; i < Math.min(board.length, 15); i++) {
      const e = board[i];
      const y = startY + (i + 1) * lh;
      const isRecent = this._summaryData && e.score === this._summaryData.score;

      ctx.fillStyle = isRecent ? '#00ff88' : '#aaa';
      ctx.fillText(`${i + 1}`, cols[0], y);
      ctx.fillText(e.name, cols[1], y);
      ctx.fillText(`${e.score}`, cols[2], y);
      ctx.fillText(`${e.kills}`, cols[3], y);

      const gradeInfo = GRADES.find(g => g.grade === e.grade) || GRADES[GRADES.length - 1];
      ctx.fillStyle = gradeInfo.color;
      ctx.fillText(e.grade, cols[4], y);

      ctx.fillStyle = isRecent ? '#00ff88' : '#aaa';
      ctx.fillText(e.aircraft, cols[5], y);
      ctx.fillText(e.date || '', cols[6], y);
    }
  }

  drawGameSummary(ctx, w, h) {
    const s = this._summaryData;
    if (!s) return;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(w * 0.15, h * 0.1, w * 0.7, h * 0.8);

    const cx = w / 2;
    let y = h * 0.1 + 50;

    // Title
    ctx.font = 'bold 28px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('MISSION COMPLETE', cx, y);
    y += 50;

    // Grade
    ctx.font = 'bold 60px "Courier New"';
    ctx.fillStyle = s.grade.color;
    ctx.fillText(s.grade.grade, cx, y);
    y += 50;

    // Stats
    ctx.font = '16px "Courier New"';
    ctx.fillStyle = '#aaa';
    const stats = [
      [`TOTAL SCORE`, `${s.score}`],
      [`KILLS`, `${s.kills}`],
      [`BEST STREAK`, `${s.bestStreak}`],
      [`WAVES CLEARED`, `${s.wavesCleared}`],
      [`TIME ALIVE`, `${Math.floor(s.timeAlive / 60)}m ${Math.floor(s.timeAlive % 60)}s`],
      [`ACCURACY`, `${s.accuracy}% (+${s.accuracyBonus})`],
      [`AIRCRAFT`, `${s.aircraft}`],
    ];

    for (const [label, value] of stats) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#667';
      ctx.fillText(label, cx - 150, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ddd';
      ctx.fillText(value, cx + 150, y);
      y += 28;
    }

    // Kill breakdown
    y += 10;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#557';
    ctx.font = '12px "Courier New"';
    const breakdown = Object.entries(s.killsByTier)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join('  ');
    if (breakdown) ctx.fillText(breakdown, cx, y);
  }
}
