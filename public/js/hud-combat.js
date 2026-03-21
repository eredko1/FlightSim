// ─── Combat HUD: Radar, Targeting, Kill Feed, Weapons, Health ───
import { AIRCRAFT, WEAPONS, getSelectedWeapon, getWeaponCount } from './aircraft.js';
import { distanceBetween } from './weapons.js';

const EARTH_RADIUS = 6378137;

export class CombatHUD {
  constructor() {
    this.killFeed = []; // { text, time, color }
    this.threatWarning = null;
    this.showScoreboard = false;
  }

  addKill(killerName, victimName, weaponName, color) {
    this.killFeed.unshift({
      text: `${killerName} [${weaponName}] ${victimName}`,
      time: 5.0,
      color: color || '#ff4444',
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  update(dt) {
    for (const k of this.killFeed) k.time -= dt;
    this.killFeed = this.killFeed.filter(k => k.time > 0);
  }

  draw(ctx, w, h, state, weaponState, entities, missiles, scores, gameMode) {
    const cx = w / 2;
    const cy = h / 2;
    const mobile = w < 768;
    const scale = mobile ? 0.7 : 1.0;

    // ─── Health Bar ───
    this.drawHealthBar(ctx, cx, cy, w, state, scale);

    // ─── Weapon Status ───
    this.drawWeaponPanel(ctx, w, h, state, weaponState, scale);

    // ─── Radar Display ───
    if (!mobile) {
      this.drawRadar(ctx, w, h, state, entities, scale);
    }

    // ─── Target Indicators ───
    this.drawTargetIndicators(ctx, w, h, state, weaponState, entities);

    // ─── Missile Warning ───
    this.drawMissileWarning(ctx, cx, cy, w, h, state, missiles, scale);

    // ─── Kill Feed ───
    this.drawKillFeed(ctx, w, scale);

    // ─── G-Effect Overlay ───
    this.drawGEffect(ctx, w, h, state);

    // ─── Score ───
    if (scores) {
      this.drawScore(ctx, w, scores, gameMode, scale);
    }
  }

  drawHealthBar(ctx, cx, cy, w, state, scale) {
    const barW = 200 * scale;
    const barH = 6 * scale;
    const x = cx - barW / 2;
    const y = cy + 60 * scale;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);

    const pct = state.health / 100;
    let color = '#00ff44';
    if (pct < 0.5) color = '#ffaa00';
    if (pct < 0.25) color = '#ff2222';

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * pct, barH);

    // HP text
    ctx.font = `${10 * scale}px "Courier New"`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(state.health)}%`, cx, y + barH + 12 * scale);
  }

  drawWeaponPanel(ctx, w, h, state, weaponState, scale) {
    const ac = AIRCRAFT[state.aircraftType];
    if (!ac) return;

    const x = w - 180 * scale;
    const y = h - 120 * scale;
    const lh = 16 * scale;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 8, y - 8, 175 * scale, 110 * scale);

    ctx.font = `${11 * scale}px "Courier New"`;
    ctx.textAlign = 'left';

    const weapons = [
      { name: WEAPONS[ac.gun].name.split(' ')[0], count: weaponState.gunAmmo, type: 'GUN' },
      { name: WEAPONS[ac.irMissile].name.split(' ')[0], count: weaponState.irCount, type: 'IR' },
      { name: WEAPONS[ac.radarMissile].name.split(' ')[0], count: weaponState.radarCount, type: 'RDR' },
    ];

    for (let i = 0; i < weapons.length; i++) {
      const wp = weapons[i];
      const selected = i === weaponState.selectedIndex;
      const yy = y + i * (lh + 4);

      ctx.fillStyle = selected ? '#00ff88' : '#446655';
      const marker = selected ? '>' : ' ';
      ctx.fillText(`${marker} ${wp.type}: ${wp.name}`, x, yy);

      // Ammo indicator
      ctx.textAlign = 'right';
      ctx.fillText(`${wp.count}`, x + 165 * scale, yy);
      ctx.textAlign = 'left';
    }

    // Countermeasures
    const cmsY = y + 3 * (lh + 4) + 4;
    ctx.fillStyle = '#886644';
    ctx.fillText(`FLR:${weaponState.flares} CHF:${weaponState.chaff}`, x, cmsY);

    // Fuel
    ctx.fillStyle = state.fuel > 20 ? '#446655' : '#ff4444';
    ctx.fillText(`FUEL:${Math.round(state.fuel)}%`, x + 100 * scale, cmsY);

    // Afterburner indicator
    if (state.afterburner && state.throttle > 0.95) {
      ctx.fillStyle = '#ff8800';
      ctx.font = `bold ${12 * scale}px "Courier New"`;
      ctx.fillText('AB', x + 145 * scale, cmsY);
    }
  }

  drawRadar(ctx, w, h, state, entities, scale) {
    const radarR = 70 * scale;
    const cx = 90 * scale;
    const cy = h - 100 * scale;

    // Background
    ctx.fillStyle = 'rgba(0,20,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, radarR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,255,0,0.2)';
    ctx.lineWidth = 1;
    // Range rings
    for (const r of [0.33, 0.66, 1.0]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radarR * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cross
    ctx.beginPath();
    ctx.moveTo(cx - radarR, cy); ctx.lineTo(cx + radarR, cy);
    ctx.moveTo(cx, cy - radarR); ctx.lineTo(cx, cy + radarR);
    ctx.stroke();

    // Range label
    ctx.font = `${8 * scale}px "Courier New"`;
    ctx.fillStyle = 'rgba(0,255,0,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('30km', cx, cy + radarR + 10 * scale);

    const radarRange = 30000; // 30km

    // Entities
    for (const e of entities) {
      if (!e.alive || e.id === 'player') continue;
      const dLat = (e.latitude - state.latitude) * EARTH_RADIUS;
      const dLon = (e.longitude - state.longitude) * EARTH_RADIUS * Math.cos(state.latitude);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist > radarRange) continue;

      // Rotate to aircraft heading
      const bearing = Math.atan2(dLon, dLat) - state.heading;
      const normDist = dist / radarRange;
      const rx = cx + Math.sin(bearing) * radarR * normDist;
      const ry = cy - Math.cos(bearing) * radarR * normDist;

      const isFriendly = e.team === state.team;
      ctx.fillStyle = isFriendly ? '#00ff44' : '#ff4444';
      ctx.fillRect(rx - 2, ry - 2, 4, 4);
    }

    // Player (center)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx + 3, cy + 3);
    ctx.fill();
  }

  drawTargetIndicators(ctx, w, h, state, weaponState, entities) {
    // Draw diamond around locked targets
    for (const e of entities) {
      if (!e.alive || e.id === 'player' || e.team === state.team) continue;

      const isIRTarget = weaponState.irLockTarget === e;
      const isRadarTarget = weaponState.radarLockTarget === e;

      if (!isIRTarget && !isRadarTarget) continue;

      // Simple screen-space indicator (centered since we don't have projection)
      // Show lock info at top of screen
      const dist = Math.round(distanceBetween(state, e));
      const distKm = (dist / 1000).toFixed(1);

      ctx.font = '14px "Courier New"';
      ctx.textAlign = 'center';

      if (isIRTarget) {
        const progress = weaponState.irLockProgress;
        ctx.fillStyle = progress >= 1 ? '#ff0000' : '#ffaa00';
        const label = progress >= 1 ? 'IR LOCK' : `IR ${Math.round(progress * 100)}%`;
        ctx.fillText(`${label} — ${distKm}km — ${e.name || 'BANDIT'}`, w / 2, h - 40);
      }

      if (isRadarTarget) {
        const progress = weaponState.radarLockProgress;
        ctx.fillStyle = progress >= 1 ? '#ff0000' : '#00aaff';
        const label = progress >= 1 ? 'RDR LOCK' : `RDR ${Math.round(progress * 100)}%`;
        ctx.fillText(`${label} — ${distKm}km — ${e.name || 'BANDIT'}`, w / 2, h - 60);
      }
    }
  }

  drawMissileWarning(ctx, cx, cy, w, h, state, missiles, scale) {
    const incoming = missiles.filter(m => m.alive && m.targetId === 'player');
    if (incoming.length === 0) return;

    const blink = Math.sin(Date.now() * 0.015) > 0;
    if (!blink) return;

    ctx.fillStyle = '#ff0000';
    ctx.font = `bold ${20 * scale}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.fillText('MISSILE', cx, cy - 80 * scale);

    // Direction arrows
    for (const m of incoming) {
      const dLat = (m.lat - state.latitude) * EARTH_RADIUS;
      const dLon = (m.lon - state.longitude) * EARTH_RADIUS * Math.cos(state.latitude);
      const bearing = Math.atan2(dLon, dLat) - state.heading;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      const distKm = (dist / 1000).toFixed(1);

      // Arrow on edge of screen pointing toward missile
      const ax = cx + Math.sin(bearing) * 100 * scale;
      const ay = cy - Math.cos(bearing) * 100 * scale;

      ctx.beginPath();
      ctx.arc(ax, ay, 8 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${10 * scale}px "Courier New"`;
      ctx.fillText(`${distKm}km`, ax, ay + 18 * scale);
    }
  }

  drawKillFeed(ctx, w, scale) {
    ctx.font = `${12 * scale}px "Courier New"`;
    ctx.textAlign = 'right';

    for (let i = 0; i < this.killFeed.length; i++) {
      const k = this.killFeed[i];
      const alpha = Math.min(1, k.time);
      ctx.fillStyle = k.color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
      if (!k.color.startsWith('rgba')) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = k.color;
      }
      ctx.fillText(k.text, w - 15, 70 + i * 18 * scale);
      ctx.globalAlpha = 1;
    }
  }

  drawGEffect(ctx, w, h, state) {
    if (state.gEffectVision >= 0.95) return;

    const intensity = 1 - state.gEffectVision;

    if (state.gSustained > 5) {
      // Blackout (tunnel vision -> black)
      ctx.fillStyle = `rgba(0,0,0,${intensity * 0.9})`;
      ctx.fillRect(0, 0, w, h);

      // Tunnel vision: clear center, dark edges
      if (intensity < 0.7) {
        const gradient = ctx.createRadialGradient(w/2, h/2, w * 0.15, w/2, h/2, w * 0.5);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (state.gSustained < -1) {
      // Redout
      ctx.fillStyle = `rgba(200,0,0,${intensity * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawScore(ctx, w, scores, gameMode, scale) {
    ctx.font = `bold ${14 * scale}px "Courier New"`;
    ctx.textAlign = 'center';

    if (gameMode === 'tdm') {
      // NATO vs OPFOR
      ctx.fillStyle = '#4488ff';
      ctx.fillText(`NATO: ${scores.nato || 0}`, w / 2 - 60, 55);
      ctx.fillStyle = '#ff4444';
      ctx.fillText(`OPFOR: ${scores.opfor || 0}`, w / 2 + 60, 55);
    } else if (gameMode === 'coop') {
      ctx.fillStyle = '#00ff88';
      ctx.fillText(`WAVE ${scores.wave || 1} — KILLS: ${scores.kills || 0}`, w / 2, 55);
    }
  }
}
