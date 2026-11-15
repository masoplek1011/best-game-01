// Every tuning number and colour for Neon Void in one place. The arena is a fixed
// 1280x720 logical field; the renderer fits it to the window, so no rule here
// depends on the screen size. Win by clearing wave 10; lose when hull hits 0.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Clear this wave to win the run. */
export const WIN_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 350,
  maxHp: 100,
  fireInterval: 0.17,
  rapidInterval: 0.09,
  bulletSpeed: 760,
  bulletDamage: 12,
  spreadDamage: 9,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.5,
  hurtInvuln: 0.9,
  contactDamage: 14,
};

export const BULLET = { radius: 5, life: 1.1 };
export const ENEMY_BULLET = { radius: 7, speed: 230, damage: 9, life: 4 };

export const POWERUP = {
  radius: 16,
  life: 12,
  dropChance: 0.13,
  spreadSeconds: 12,
  rapidSeconds: 10,
  shieldSeconds: 6,
  healAmount: 35,
};

/** Seconds a wave banner shows before the swarm starts pouring in. */
export const WAVE_BANNER_SECONDS = 2.2;

export const PALETTE = {
  backdrop: '#05060f',
  nebulaA: '#1b0f3a',
  nebulaB: '#0a2a3a',
  nebulaC: '#3a0f2a',
  grid: '#131a33',
  star: '#cfe6ff',
  player: '#4dffd2',
  playerCore: '#eafff6',
  bullet: '#ffe45e',
  enemyBullet: '#ff5e7a',
  chaser: '#ff4fd8',
  weaver: '#4fc3ff',
  splitter: '#ffb347',
  mite: '#ff8a5c',
  powerSpread: '#ffe45e',
  powerHeal: '#5cff8a',
  powerShield: '#6fd8ff',
  powerRapid: '#ff9df5',
  text: '#eef4ff',
  muted: '#93a1c4',
  gold: '#ffd166',
  danger: '#ff4f6d',
  panel: '#0b1030',
  panelEdge: '#2a3a7a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
