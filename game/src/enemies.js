// The void swarm: four enemy kinds, each with its own shape, movement and threat.
// A chaser hunts the player. A weaver strafes in a sine wave and fires slow orbs.
// A splitter lumbers in and breaks into two mites when destroyed. A mite is a
// small, fast chaser born from a splitter. This file owns enemy behaviour only;
// spawning order and difficulty live in waves.js, combat in world.js.

export const KIND_CHASER = 'chaser';
export const KIND_WEAVER = 'weaver';
export const KIND_SPLITTER = 'splitter';
export const KIND_MITE = 'mite';

const BASE = {
  chaser: { radius: 17, hp: 22, speed: 105, score: 50, touch: 14 },
  weaver: { radius: 16, hp: 18, speed: 85, score: 80, touch: 10 },
  splitter: { radius: 30, hp: 70, speed: 48, score: 120, touch: 18 },
  mite: { radius: 10, hp: 8, speed: 190, score: 25, touch: 8 },
};

function pickEdgeSpawn(random, margin = 50) {
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: random() * 1280, y: -margin };
  if (side === 1) return { x: random() * 1280, y: 720 + margin };
  if (side === 2) return { x: -margin, y: random() * 720 };
  return { x: 1280 + margin, y: random() * 720 };
}

/** Build one enemy of `kind` for `wave`, entering from a random arena edge. */
export function createEnemy(kind, wave, random) {
  const base = BASE[kind];
  const at = pickEdgeSpawn(random);
  return {
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp: Math.round(base.hp * (1 + 0.09 * (wave - 1))),
    maxHp: Math.round(base.hp * (1 + 0.09 * (wave - 1))),
    speed: base.speed * (1 + 0.035 * (wave - 1)) * (0.9 + random() * 0.2),
    score: base.score,
    touch: base.touch,
    phase: random() * Math.PI * 2,
    shootTimer: 1.2 + random() * 1.4,
    wobble: 0,
  };
}

/**
 * Move one enemy for a step. `onShoot(x, y, angle)` is called when a weaver fires.
 * Returns nothing; the enemy object is updated in place.
 */
export function updateEnemy(enemy, playerX, playerY, dt, onShoot) {
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;
  enemy.phase += dt;

  if (enemy.kind === KIND_CHASER || enemy.kind === KIND_MITE) {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
  } else if (enemy.kind === KIND_WEAVER) {
    // Sine strafe: drift toward the player while sliding sideways.
    const strafe = Math.sin(enemy.phase * 2.2) * 130;
    enemy.vx = nx * enemy.speed * 0.55 + -ny * strafe * 0.35;
    enemy.vy = ny * enemy.speed * 0.55 + nx * strafe * 0.35;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && distance < 620) {
      enemy.shootTimer = 2.1 + Math.random() * 0.7;
      onShoot(enemy.x, enemy.y, Math.atan2(dy, dx));
    }
  } else if (enemy.kind === KIND_SPLITTER) {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
    enemy.wobble = Math.sin(enemy.phase * 3) * 0.12;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}
