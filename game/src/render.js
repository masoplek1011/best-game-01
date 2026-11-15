// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 arena is fitted to the window, preserving its aspect. All art is drawn
// in code — a neon starfield, glowing ships and geometric swarm shapes on a deep
// violet palette — with a full HUD and a panel for every screen.

import { FIELD, FONT, PALETTE, WIN_WAVE } from './config.js';
import { KIND_CHASER, KIND_MITE, KIND_SPLITTER, KIND_WEAVER } from './enemies.js';
import { POWER_HEAL, POWER_RAPID, POWER_SHIELD, POWER_SPREAD } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const ENEMY_COLORS = {
  chaser: PALETTE.chaser,
  weaver: PALETTE.weaver,
  splitter: PALETTE.splitter,
  mite: PALETTE.mite,
};

const POWER_LABELS = {
  spread: 'SPREAD',
  heal: 'HEAL',
  shield: 'SHIELD',
  rapid: 'RAPID',
};

function makeStars() {
  // A fixed starfield, seeded by hand so every run paints the same sky.
  let seed = 1337;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < 140; i += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, size: 0.6 + next() * 1.8, twinkle: next() * Math.PI * 2 });
  }
  return stars;
}

export function createRenderer(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars();
  const fonts = new Map();

  function font(size, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  }

  function drawBackground(time) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Soft nebula blobs.
    const blobs = [
      [300, 180, 260, PALETTE.nebulaA],
      [1020, 540, 300, PALETTE.nebulaB],
      [980, 120, 200, PALETTE.nebulaC],
    ];
    for (const [x, y, radius, color] of blobs) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(5,6,15,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Faint grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 0; y <= FIELD.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    // Twinkling stars.
    for (const star of stars) {
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 1.5 + star.twinkle);
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(player, time) {
    const blink = player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.shieldTimer > 0) {
      ctx.strokeStyle = PALETTE.powerShield;
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 6);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemy(enemy, time) {
    const color = ENEMY_COLORS[enemy.kind];
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (enemy.kind === KIND_CHASER) {
      // Spiked orb.
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.8;
        const radius = i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 3;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2a001f';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_WEAVER) {
      ctx.rotate(time * 1.4);
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius - 4);
      ctx.lineTo(enemy.radius, 0);
      ctx.lineTo(0, enemy.radius + 4);
      ctx.lineTo(-enemy.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06283a';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_SPLITTER) {
      ctx.rotate(enemy.wobble || 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + time * 0.4;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4a2c00';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#4a2c00';
      ctx.beginPath();
      ctx.arc(-8, -4, 4, 0, Math.PI * 2);
      ctx.arc(9, 5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mite: small darting triangle.
      ctx.rotate(Math.atan2(enemy.vy, enemy.vx));
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-9, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Health bar over hurt enemies.
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 4);
      ctx.fillStyle = color;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawPowerup(powerup, time) {
    const pulse = 1 + 0.12 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = powerup.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0b1030';
    ctx.strokeStyle = powerup.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, powerup.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = powerup.color;
    ctx.font = font(15, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = powerup.kind === POWER_HEAL ? '+' : powerup.kind === POWER_SPREAD ? '3' : powerup.kind === POWER_SHIELD ? 'O' : '»';
    ctx.fillText(glyph, 0, 1);
    ctx.restore();
    text(POWER_LABELS[powerup.kind], powerup.x, powerup.y + powerup.radius + 16, 11, powerup.color, 'center', 'bold');
  }

  function drawHud(state, best) {
    const player = state.player;
    // Top-left: score and best.
    text(`SCORE ${state.score}`, 24, 40, 26, PALETTE.text, 'left', 'bold');
    text(`BEST ${best}`, 24, 66, 15, PALETTE.muted, 'left');
    // Top-centre: wave and enemies left.
    text(`WAVE ${state.wave} / ${WIN_WAVE}`, FIELD.width / 2, 40, 26, PALETTE.gold, 'center', 'bold');
    const left = state.wavePhase === 'banner' ? 'GET READY' : `${state.enemies.length + state.spawnLeft} HOSTILES LEFT`;
    text(left, FIELD.width / 2, 66, 15, PALETTE.muted, 'center');
    // Top-right: hull bar.
    const barWidth = 220;
    const barX = FIELD.width - 24 - barWidth;
    text('HULL', barX - 10, 40, 18, PALETTE.text, 'right', 'bold');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(barX, 48, barWidth, 14);
    const hpFraction = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpFraction > 0.5 ? PALETTE.player : hpFraction > 0.25 ? PALETTE.gold : PALETTE.danger;
    ctx.fillRect(barX, 48, barWidth * hpFraction, 14);
    text(`${Math.ceil(player.hp)}`, barX + barWidth / 2, 60, 12, '#05060f', 'center', 'bold');
    // Bottom-left: dash cooldown and active power-ups.
    const dashReady = player.dashCooldown <= 0;
    text(dashReady ? 'DASH READY [SHIFT]' : `DASH ${player.dashCooldown.toFixed(1)}s`, 24, FIELD.height - 24, 15, dashReady ? PALETTE.player : PALETTE.muted, 'left', 'bold');
    let powerX = 24;
    const active = [];
    if (player.spreadTimer > 0) active.push(['SPREAD', player.spreadTimer, PALETTE.powerSpread]);
    if (player.rapidTimer > 0) active.push(['RAPID', player.rapidTimer, PALETTE.powerRapid]);
    if (player.shieldTimer > 0) active.push(['SHIELD', player.shieldTimer, PALETTE.powerShield]);
    for (const [label, seconds, color] of active) {
      text(`${label} ${Math.ceil(seconds)}s`, powerX, FIELD.height - 52, 15, color, 'left', 'bold');
      powerX += 130;
    }
    // Wave banner.
    if (state.wavePhase === 'banner') {
      ctx.globalAlpha = Math.min(1, state.bannerTimer * 2);
      text(`WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 40, 64, PALETTE.gold, 'center', 'bold');
      text(state.wave === 1 ? 'Survive the swarm — clear wave 10 to win' : 'The swarm grows stronger', FIELD.width / 2, FIELD.height / 2 + 6, 20, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawPanel(title, titleColor, lines, prompt) {
    const width = 680;
    const height = 150 + lines.length * 36 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = 'rgba(5,6,15,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();
    text(title, FIELD.width / 2, y + 78, 52, titleColor, 'center', 'bold');
    lines.forEach((line, index) => {
      text(line.text, FIELD.width / 2, y + 132 + index * 36, line.size || 20, line.color || PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center', 'bold');
  }

  function accuracy(state) {
    return state.stats.shots === 0 ? 0 : Math.round((100 * state.stats.hits) / state.stats.shots);
  }

  /** Paint one frame: the field, the HUD, then a panel for the screen the game is on. */
  function draw(state, screen, best) {
    const time = state.time;
    const shake = effects.offset();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawBackground(time);
    for (const bullet of state.enemyBullets) {
      ctx.shadowColor = PALETTE.enemyBullet;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (const powerup of state.powerups) drawPowerup(powerup, time);
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    if (screen !== SCREEN_TITLE) drawPlayer(state.player, time);
    for (const bullet of state.bullets) {
      ctx.shadowColor = PALETTE.bullet;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = PALETTE.bullet;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    effects.draw(ctx);
    ctx.restore();

    if (screen === SCREEN_TITLE) {
      text('NEON VOID', FIELD.width / 2, 190, 84, PALETTE.player, 'center', 'bold');
      text('— STARFALL ARENA —', FIELD.width / 2, 232, 24, PALETTE.gold, 'center', 'bold');
      text('Blast the void swarm. Survive all 10 waves. Win the arena.', FIELD.width / 2, 300, 22, PALETTE.text, 'center');
      text('WASD / arrows — fly      Mouse — aim      Hold click / Space — fire', FIELD.width / 2, 344, 19, PALETTE.muted, 'center');
      text('Shift — dash      P — pause      M — mute      Grab power-ups: spread, rapid, shield, heal', FIELD.width / 2, 376, 19, PALETTE.muted, 'center');
      text(`BEST ${best}`, FIELD.width / 2, 428, 20, PALETTE.gold, 'center', 'bold');
      const pulse = 0.65 + 0.35 * Math.sin(time * 3);
      ctx.globalAlpha = pulse;
      text('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 500, 24, PALETTE.player, 'center', 'bold');
      ctx.globalAlpha = 1;
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PALETTE.text, [{ text: 'The swarm waits for no one — except now.' }], 'Press P or click to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('SHIP DESTROYED', PALETTE.danger, [
        { text: `Final score  ${state.score}`, size: 24, color: PALETTE.text },
        { text: `Best  ${best}`, size: 20, color: PALETTE.gold },
        { text: `Reached wave ${state.wave}  •  ${state.stats.kills} kills  •  ${accuracy(state)}% accuracy`, size: 20 },
        { text: 'The void claims another pilot.', size: 20 },
      ], 'Press Enter or click to fly again');
    } else if (screen === SCREEN_VICTORY) {
      drawPanel('ARENA CHAMPION', PALETTE.gold, [
        { text: `Final score  ${state.score}`, size: 24, color: PALETTE.text },
        { text: `Best  ${best}`, size: 20, color: PALETTE.gold },
        { text: `All 10 waves cleared  •  ${state.stats.kills} kills  •  ${accuracy(state)}% accuracy`, size: 20 },
        { text: 'The starfall ends. The arena is yours.', size: 20 },
      ], 'Press Enter or click to play again');
    }
  }

  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  return { draw };
}
