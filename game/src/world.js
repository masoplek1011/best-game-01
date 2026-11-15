// The game's rules and state, with no drawing and no browser in it: the player
// ship, bullets, the swarm, power-ups, waves, collisions, score and the win/lose
// conditions. step() advances one fixed step and returns a list of events (with
// positions) so the caller can play sounds and spawn particles without the world
// knowing about either. Nothing here allocates after createWorld returns, except
// the small per-step event list.

import { FIELD, PLAYER, BULLET, ENEMY_BULLET, POWERUP, WAVE_BANNER_SECONDS, WIN_WAVE } from './config.js';
import { createEnemy, updateEnemy, KIND_MITE, KIND_SPLITTER } from './enemies.js';
import { buildWave } from './waves.js';

export const POWER_SPREAD = 'spread';
export const POWER_HEAL = 'heal';
export const POWER_SHIELD = 'shield';
export const POWER_RAPID = 'rapid';
const POWER_KINDS = [POWER_SPREAD, POWER_HEAL, POWER_SHIELD, POWER_RAPID];

const POWER_COLORS = {
  spread: '#ffe45e',
  heal: '#5cff8a',
  shield: '#6fd8ff',
  rapid: '#ff9df5',
};

function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    fireTimer: 0, dashTimer: 0, dashCooldown: 0,
    spreadTimer: 0, rapidTimer: 0, shieldTimer: 0, invuln: 0,
  };
  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const powerups = [];
  const state = {
    player, bullets, enemyBullets, enemies, powerups,
    score: 0, wave: 1, wavePhase: 'banner', bannerTimer: WAVE_BANNER_SECONDS,
    waveTimer: 0, time: 0, over: false, victory: false, spawnLeft: 0,
    stats: { kills: 0, shots: 0, hits: 0, powerupsTaken: 0, dashes: 0 },
  };
  let spawnQueue = [];

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.angle = -Math.PI / 2;
    player.hp = PLAYER.maxHp;
    player.fireTimer = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.spreadTimer = 0;
    player.rapidTimer = 0;
    player.shieldTimer = 0;
    player.invuln = 0;
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies.length = 0;
    powerups.length = 0;
    state.score = 0;
    state.wave = 1;
    state.wavePhase = 'banner';
    state.bannerTimer = WAVE_BANNER_SECONDS;
    state.waveTimer = 0;
    state.time = 0;
    state.over = false;
    state.victory = false;
    state.stats.kills = 0;
    state.stats.shots = 0;
    state.stats.hits = 0;
    state.stats.powerupsTaken = 0;
    state.stats.dashes = 0;
    spawnQueue = buildWave(1, random);
    state.spawnLeft = spawnQueue.length;
  }

  function startWave(wave) {
    state.wave = wave;
    state.wavePhase = 'banner';
    state.bannerTimer = WAVE_BANNER_SECONDS;
    state.waveTimer = 0;
    spawnQueue = buildWave(wave, random);
    state.spawnLeft = spawnQueue.length;
  }

  /** Enemies left in this wave: alive plus still queued to spawn. */
  function enemiesLeft() {
    return enemies.length + spawnQueue.length;
  }

  function fireBullet(angle, damage) {
    const nose = player.radius + 6;
    bullets.push({
      x: player.x + Math.cos(angle) * nose,
      y: player.y + Math.sin(angle) * nose,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: BULLET.life, damage, radius: BULLET.radius,
    });
  }

  function dropPowerup(x, y) {
    if (random() >= POWERUP.dropChance) return;
    const kind = POWER_KINDS[Math.floor(random() * POWER_KINDS.length)];
    const angle = random() * Math.PI * 2;
    powerups.push({
      kind, x, y,
      vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
      life: POWERUP.life, radius: POWERUP.radius, color: POWER_COLORS[kind],
    });
  }

  function killEnemy(index, events) {
    const enemy = enemies[index];
    enemies.splice(index, 1);
    state.stats.kills += 1;
    state.score += enemy.score;
    events.push({ type: 'enemyDied', x: enemy.x, y: enemy.y, kind: enemy.kind, score: enemy.score });
    if (enemy.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) {
        const mite = createEnemy(KIND_MITE, state.wave, random);
        mite.x = enemy.x + (i === 0 ? -24 : 24);
        mite.y = enemy.y;
        enemies.push(mite);
      }
    }
    dropPowerup(enemy.x, enemy.y);
  }

  function hurtPlayer(damage, events) {
    if (player.invuln > 0 || player.shieldTimer > 0 || player.dashTimer > 0 || state.over) return;
    player.hp = Math.max(0, player.hp - damage);
    player.invuln = PLAYER.hurtInvuln;
    events.push({ type: 'playerHurt', x: player.x, y: player.y });
    if (player.hp <= 0) {
      state.over = true;
      events.push({ type: 'gameOver', x: player.x, y: player.y, score: state.score });
    }
  }

  function applyPowerup(powerup, events) {
    state.stats.powerupsTaken += 1;
    if (powerup.kind === POWER_HEAL) {
      player.hp = Math.min(player.maxHp, player.hp + POWERUP.healAmount);
    } else if (powerup.kind === POWER_SPREAD) {
      player.spreadTimer = POWERUP.spreadSeconds;
    } else if (powerup.kind === POWER_RAPID) {
      player.rapidTimer = POWERUP.rapidSeconds;
    } else if (powerup.kind === POWER_SHIELD) {
      player.shieldTimer = POWERUP.shieldSeconds;
    }
    events.push({ type: 'pickup', x: powerup.x, y: powerup.y, kind: powerup.kind });
  }

  /**
   * One fixed step. `ctrl` is { mx, my, aimX, aimY, firing, dash }. With `ambient`
   * set (the title screen's backdrop) enemies drift but nothing shoots, nothing
   * collides and nothing scores.
   */
  function step(dt, ctrl, ambient = false) {
    const events = [];
    state.time += dt;

    if (ambient) {
      // Drift in a straight line and wrap around the edges, so the title
      // backdrop roams instead of piling every enemy onto the centre.
      for (const enemy of enemies) {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.phase += dt;
        if (enemy.x < -40) enemy.x = FIELD.width + 40;
        if (enemy.x > FIELD.width + 40) enemy.x = -40;
        if (enemy.y < -40) enemy.y = FIELD.height + 40;
        if (enemy.y > FIELD.height + 40) enemy.y = -40;
      }
      return events;
    }
    if (state.over || state.victory) return events;

    // --- player movement and dash ---
    let mx = ctrl.mx;
    let my = ctrl.my;
    const moveLength = Math.hypot(mx, my);
    if (moveLength > 1) { mx /= moveLength; my /= moveLength; }
    player.angle = Math.atan2(ctrl.aimY - player.y, ctrl.aimX - player.x);
    if (ctrl.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const dashAngle = moveLength > 0 ? Math.atan2(my, mx) : player.angle;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invuln = Math.max(player.invuln, 0.25);
      state.stats.dashes += 1;
      events.push({ type: 'dash', x: player.x, y: player.y, angle: dashAngle });
    }
    const speed = player.dashTimer > 0 ? PLAYER.dashSpeed : PLAYER.speed;
    if (player.dashTimer > 0) {
      const angle = moveLength > 0 ? Math.atan2(my, mx) : player.angle;
      player.x += Math.cos(angle) * speed * dt;
      player.y += Math.sin(angle) * speed * dt;
      player.dashTimer -= dt;
    } else {
      player.x += mx * speed * dt;
      player.y += my * speed * dt;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y));
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.spreadTimer = Math.max(0, player.spreadTimer - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.shieldTimer = Math.max(0, player.shieldTimer - dt);

    // --- firing ---
    player.fireTimer -= dt;
    if (ctrl.firing && player.fireTimer <= 0) {
      const interval = player.rapidTimer > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
      player.fireTimer = interval;
      if (player.spreadTimer > 0) {
        fireBullet(player.angle - 0.2, PLAYER.spreadDamage);
        fireBullet(player.angle, PLAYER.bulletDamage);
        fireBullet(player.angle + 0.2, PLAYER.spreadDamage);
        state.stats.shots += 3;
      } else {
        fireBullet(player.angle, PLAYER.bulletDamage);
        state.stats.shots += 1;
      }
      events.push({ type: 'shoot', x: player.x, y: player.y, angle: player.angle });
    }

    // --- wave flow ---
    if (state.wavePhase === 'banner') {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        state.wavePhase = 'fight';
        events.push({ type: 'waveStart', wave: state.wave });
      }
    } else {
      state.waveTimer += dt;
      while (spawnQueue.length > 0 && spawnQueue[0].at <= state.waveTimer) {
        const spawn = spawnQueue.shift();
        state.spawnLeft = spawnQueue.length;
        enemies.push(createEnemy(spawn.kind, state.wave, random));
      }
      if (spawnQueue.length === 0 && enemies.length === 0) {
        if (state.wave >= WIN_WAVE) {
          state.victory = true;
          events.push({ type: 'victory', score: state.score });
        } else {
          const bonus = 100 * state.wave;
          state.score += bonus;
          events.push({ type: 'waveClear', wave: state.wave, bonus });
          startWave(state.wave + 1);
        }
      }
    }

    // --- enemies ---
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const enemy = enemies[i];
      updateEnemy(enemy, player.x, player.y, dt, (x, y, angle) => {
        enemyBullets.push({
          x, y,
          vx: Math.cos(angle) * ENEMY_BULLET.speed,
          vy: Math.sin(angle) * ENEMY_BULLET.speed,
          life: ENEMY_BULLET.life, radius: ENEMY_BULLET.radius,
        });
        events.push({ type: 'enemyShoot', x, y });
      });
      enemy.x = Math.min(FIELD.width + 60, Math.max(-60, enemy.x));
      enemy.y = Math.min(FIELD.height + 60, Math.max(-60, enemy.y));
      if (circlesOverlap(enemy, { x: player.x, y: player.y, radius: player.radius })) {
        hurtPlayer(enemy.touch, events);
        // A chaser that rams the player bounces off instead of sticking.
        enemy.x -= (player.x - enemy.x) * 0.1;
        enemy.y -= (player.y - enemy.y) * 0.1;
      }
    }

    // --- player bullets vs enemies ---
    for (let b = bullets.length - 1; b >= 0; b -= 1) {
      const bullet = bullets[b];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullets.splice(b, 1);
        continue;
      }
      for (let e = enemies.length - 1; e >= 0; e -= 1) {
        if (circlesOverlap(bullet, enemies[e])) {
          const enemy = enemies[e];
          enemy.hp -= bullet.damage;
          state.stats.hits += 1;
          events.push({ type: 'hit', x: bullet.x, y: bullet.y });
          bullets.splice(b, 1);
          if (enemy.hp <= 0) killEnemy(e, events);
          break;
        }
      }
    }

    // --- enemy bullets vs player ---
    for (let b = enemyBullets.length - 1; b >= 0; b -= 1) {
      const bullet = enemyBullets[b];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        enemyBullets.splice(b, 1);
        continue;
      }
      if (circlesOverlap(bullet, { x: player.x, y: player.y, radius: player.radius })) {
        enemyBullets.splice(b, 1);
        hurtPlayer(ENEMY_BULLET.damage, events);
      }
    }

    // --- power-ups drift, magnetise and get collected ---
    for (let i = powerups.length - 1; i >= 0; i -= 1) {
      const powerup = powerups[i];
      powerup.life -= dt;
      const dx = player.x - powerup.x;
      const dy = player.y - powerup.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 150) {
        powerup.vx += (dx / distance) * 260 * dt;
        powerup.vy += (dy / distance) * 260 * dt;
      }
      powerup.x += powerup.vx * dt;
      powerup.y += powerup.vy * dt;
      powerup.vx *= 0.98;
      powerup.vy *= 0.98;
      if (powerup.life <= 0) { powerups.splice(i, 1); continue; }
      if (circlesOverlap(powerup, { x: player.x, y: player.y, radius: player.radius + 6 })) {
        powerups.splice(i, 1);
        applyPowerup(powerup, events);
      }
    }

    return events;
  }

  /** Fill the arena with slowly drifting enemies for the title screen backdrop. */
  function spawnAmbient(count) {
    for (let i = 0; i < count; i += 1) {
      const enemy = createEnemy(i % 3 === 0 ? KIND_SPLITTER : 'chaser', 1, random);
      enemy.x = 120 + random() * (FIELD.width - 240);
      enemy.y = 120 + random() * (FIELD.height - 240);
      // A steady drift in a random direction; the ambient step wraps them around.
      const angle = random() * Math.PI * 2;
      const drift = 30 + random() * 40;
      enemy.vx = Math.cos(angle) * drift;
      enemy.vy = Math.sin(angle) * drift;
      enemies.push(enemy);
    }
  }

  /** Stage a finished winning run for the victory screenshot. */
  function stageVictory() {
    reset();
    state.score = 2450;
    state.wave = WIN_WAVE;
    state.wavePhase = 'fight';
    state.bannerTimer = 0;
    state.stats.kills = 87;
    state.stats.shots = 412;
    state.stats.hits = 301;
    state.stats.powerupsTaken = 9;
    state.stats.dashes = 14;
    state.victory = true;
    player.hp = 62;
    enemies.length = 0;
    spawnQueue = [];
    state.spawnLeft = 0;
  }

  reset();
  return { state, reset, step, startWave, enemiesLeft, spawnAmbient, stageVictory };
}
